"""
Dos lecturas frecuentes que la suite base no ejercitaba (en la cobertura base, el cuerpo de las dos quedaba sin
ejecutar): la lista de enlaces para compartir (`/api/exports`, la usa el diálogo de compartir de la lista de envíos)
y la lista de fallas de la flota (`/api/fleet/faults`, la usa la tabla de fallas de Flota). Se prueban de punta a
punta: crear, listar, ver el efecto de revocar o resolver, y comprobar el contrato que consume la interfaz.

Usa una base SQLite temporal propia, como test_guard y test_etag_red.
"""
import pytest
from fastapi.testclient import TestClient

import app.database.db as db
import app.init_db as init_db
from app import main


@pytest.fixture(scope="module")
def client(tmp_path_factory):
    path = str(tmp_path_factory.mktemp("rutas_frecuentes") / "rutas_frecuentes.db")
    mp = pytest.MonkeyPatch()
    mp.setattr(db, "DB_PATH", path)
    mp.setattr(init_db, "DB_PATH", path)
    main.network.cache_clear()
    main._last_sync = 0.0
    with TestClient(main.app) as c:
        yield c
    main.network.cache_clear()
    main._cache.clear()
    mp.undo()


def test_la_lista_de_enlaces_para_compartir(client):
    """Compartir crea el enlace; la lista lo devuelve con `codes` como lista y el camino para abrirlo, y refleja la
    revocación en la misma lectura que usa el panel."""
    codes = [s["code"] for s in client.get("/api/shipments").json()["items"][:2]]
    creado = client.post("/api/exports", json={"codes": codes, "moneda": "USD"})
    assert creado.status_code == 201, creado.text
    token = creado.json()["token"]

    lista = client.get("/api/exports")
    assert lista.status_code == 200
    data = lista.json()
    assert data["count"] == len(data["items"]) >= 1
    enlace = next(i for i in data["items"] if i["token"] == token)
    assert enlace["codes"] == codes                  # vuelve como lista, no como el texto separado por comas
    assert enlace["path"] == f"/api/exports/{token}"
    assert enlace["currency"] == "USD"
    assert enlace["revoked_at"] is None

    # El enlace recién creado abre el PDF y, al revocarlo, la lista lo marca y el camino deja de servir.
    assert client.get(enlace["path"]).status_code == 200
    assert client.delete(f"/api/exports/{token}").status_code == 200
    despues = next(i for i in client.get("/api/exports").json()["items"] if i["token"] == token)
    assert despues["revoked_at"]
    assert client.get(enlace["path"]).status_code == 404


def test_la_lista_de_fallas_de_la_flota(client):
    """Flota lista las fallas con su vehículo y filtra por estado; al resolver una, sale de las abiertas y aparece en
    las resueltas (los dos filtros que ofrece la pantalla)."""
    vehiculo = next(x for x in client.get("/api/fleet/vehicles").json()["items"] if not x["retired"])
    creada = client.post(f"/api/fleet/vehicles/{vehiculo['id']}/faults", json={
        "severity": "Leve", "category": "Iluminación", "description": "Luz de placa quemada (prueba)"})
    assert creada.status_code == 201, creada.text
    falla = creada.json()["faults"][0]

    abiertas = client.get("/api/fleet/faults", params={"status": "abiertas"})
    assert abiertas.status_code == 200
    filas = abiertas.json()["items"]
    assert abiertas.json()["count"] == len(filas) >= 1
    encontrada = next(f for f in filas if f["fault_id"] == falla["fault_id"])
    assert encontrada["code"] == vehiculo["code"]
    assert encontrada["vehicle_type"] == vehiculo["vehicle_type"]
    assert encontrada["status"] == "Abierta"
    assert all(f["status"] != "Resuelta" for f in filas), "«abiertas» no debe traer resueltas"

    resuelta = client.put(f"/api/fleet/faults/{falla['fault_id']}", json={
        "status": "Resuelta", "resolution": "Cambio de la luz de placa", "repair_cost_usd": 25})
    assert resuelta.status_code == 200, resuelta.text
    assert all(f["fault_id"] != falla["fault_id"] for f in client.get(
        "/api/fleet/faults", params={"status": "abiertas"}).json()["items"])
    historial = client.get("/api/fleet/faults", params={"status": "Resuelta"}).json()["items"]
    cerrada = next(f for f in historial if f["fault_id"] == falla["fault_id"])
    assert cerrada["resolved_at"] and cerrada["resolution"] == "Cambio de la luz de placa"
