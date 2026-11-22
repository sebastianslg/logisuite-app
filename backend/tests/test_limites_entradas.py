"""
Límites de las entradas de la API (tarea B5).

Un texto de 10.000 caracteres, un número de 1e12 o una lista de 5.000 elementos deben responder 422 (el detalle de
validación de FastAPI, no el del motor de rutas) en todos los modelos y parámetros de consulta, y las peticiones que la
app hace de verdad deben seguir pasando con 200/201. Usa una base SQLite temporal propia.
"""
from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient

import app.database.db as db
import app.init_db as init_db
from conftest import admin_headers

ENORME = "x" * 10_000             # texto de 10.000 caracteres
NUMERO = 10 ** 12                 # número absurdo (1e12)
LISTA = ["LS-2611-0001"] * 5_000  # lista de 5.000 elementos


@pytest.fixture(scope="module")
def client(tmp_path_factory):
    path = str(tmp_path_factory.mktemp("limites") / "limites.db")
    mp = pytest.MonkeyPatch()
    mp.setattr(db, "DB_PATH", path)
    mp.setattr(init_db, "DB_PATH", path)
    from app import main
    main.network.cache_clear()
    main._last_sync = 0.0
    with TestClient(main.app) as c:
        yield c
    main.network.cache_clear()
    mp.undo()


def _rechazado(res, campo: str) -> None:
    """422 de validación (lista de errores de FastAPI) con el campo culpable entre los señalados."""
    assert res.status_code == 422, res.text
    detalle = res.json()["detail"]
    assert isinstance(detalle, list) and detalle, detalle
    assert any(campo in error.get("loc", ()) for error in detalle), (campo, detalle)


# (método, ruta, cuerpo, campo que debe señalar la validación)
CASOS_CUERPO = [
    ("post", "/api/routes/simulate", {"origen": ENORME, "destino": "Cartagena"}, "origen"),
    ("post", "/api/routes/simulate", {"origen": "Bogotá", "destino": "Cartagena", "peso_t": NUMERO}, "peso_t"),
    ("post", "/api/routes/simulate", {"origen": "Bogotá", "destino": "Cartagena", "modos": LISTA}, "modos"),
    ("post", "/api/routes/simulate", {"origen": "Bogotá", "destino": "Cartagena", "vias": LISTA}, "vias"),
    ("post", "/api/shipments/preview",
     {"origin": "Bogotá", "destination": "Medellín", "cargo": ENORME, "weight_t": 5,
      "departure_at": "2026-11-21T08:00"}, "cargo"),
    ("post", "/api/shipments",
     {"origin": "Bogotá", "destination": "Medellín", "cargo": "Café", "weight_t": NUMERO,
      "departure_at": "2026-11-21T08:00", "delay_h": 1}, "weight_t"),
    ("put", "/api/shipments/NO-EXISTE", {"client": ENORME}, "client"),
    ("post", "/api/shipments/import", {"filename": ENORME, "content_b64": "AAAA"}, "filename"),
    ("post", "/api/tables/conductores/import", {"filename": ENORME, "content_b64": "AAAA"}, "filename"),
    ("post", "/api/shipments/NO-EXISTE/attachments",
     {"filename": ENORME, "content_b64": "AAAA", "autorizado": True}, "filename"),
    ("post", "/api/shipments/NO-EXISTE/events", {"kind": "nota", "body": ENORME}, "body"),
    ("post", "/api/corridors/status", {"corridor": ENORME, "active": False, "reason": "prueba"}, "corridor"),
    ("post", "/api/corridors/status", {"corridor": "Canal del Dique", "active": False, "reason": ENORME}, "reason"),
    ("post", "/api/nodes/status", {"code": ENORME, "active": False, "reason": "prueba"}, "code"),
    ("put", "/api/settings/fx", {"rate": NUMERO, "date": "2026-11-21", "source": "Prueba"}, "rate"),
    ("put", "/api/settings/fx", {"rate": 4000, "date": ENORME, "source": "Prueba"}, "date"),
    ("put", "/api/settings/fx", {"rate": 4000, "date": "2026-11-21", "source": ENORME}, "source"),
    ("put", "/api/tolls/1", {"tolls_cop": NUMERO}, "tolls_cop"),
    ("put", "/api/tolls/1", {"tolls_cop": 0, "note": ENORME}, "note"),
    ("put", "/api/settings/replenish", {"enabled": True, "usuario": ENORME}, "usuario"),
    ("put", "/api/settings/mail-alerts", {"kind": ENORME, "enabled": True}, "kind"),
    ("put", "/api/shipments/NO-EXISTE/actual-cost", {"amount": NUMERO}, "amount"),
    ("put", "/api/shipments/NO-EXISTE/delivery",
     {"received_by": "Ana", "signature": "data:image/png;base64,AAAA", "received_at": ENORME}, "received_at"),
    ("put", "/api/shipments/NO-EXISTE/client-email", {"email": ENORME}, "email"),
    ("post", "/api/shipments/NO-EXISTE/tracking/token/email", {"email": ENORME}, "email"),
    ("post", "/api/exports", {"codes": LISTA}, "codes"),
    ("post", "/api/exports", {"codes": [ENORME]}, "codes"),
    ("post", "/api/consents",
     {"browser_id": ENORME, "context": "primer_uso",
      "items": [{"document": "terminos", "text": "Acepto", "accepted": True}]}, "browser_id"),
    ("post", "/api/client-errors", {"path": "/x", "message": ENORME}, "message"),
    ("post", "/api/auth/otp/request", {"email": ENORME}, "email"),
    ("post", "/api/auth/otp/verify", {"email": ENORME, "code": "123456"}, "email"),
    ("post", "/api/auth/password", {"identifier": ENORME, "password": "x"}, "identifier"),
    ("post", "/api/auth/password/change", {"current": ENORME, "new": "x"}, "current"),
    ("post", "/api/demo-requests", {"name": ENORME}, "name"),
    ("post", "/api/companies", {"name": ENORME}, "name"),
    ("post", "/api/admin/users", {"email": ENORME, "full_name": "X"}, "email"),
]


@pytest.mark.parametrize("metodo, ruta, cuerpo, campo", CASOS_CUERPO,
                         ids=[f"{m.upper()} {r} · {c}" for m, r, _, c in CASOS_CUERPO])
def test_cuerpo_enorme_responde_422(client, metodo, ruta, cuerpo, campo):
    _rechazado(getattr(client, metodo)(ruta, json=cuerpo), campo)


# (método, ruta, parámetros de consulta, campo que debe señalar la validación)
CASOS_CONSULTA = [
    ("get", "/api/shipments", {"q": ENORME}, "q"),
    ("get", "/api/shipments", {"status": ENORME}, "status"),
    ("get", "/api/shipments", {"modes": ENORME}, "modes"),
    ("get", "/api/shipments", {"limit": NUMERO}, "limit"),
    ("get", "/api/shipments", {"limit": 0}, "limit"),
    ("get", "/api/shipments", {"offset": -1}, "offset"),
    ("get", "/api/shipments", {"sort": ENORME}, "sort"),
    ("get", "/api/audit", {"limit": NUMERO}, "limit"),
    ("get", "/api/audit", {"offset": -5}, "offset"),
    ("get", "/api/audit", {"q": ENORME}, "q"),
    ("get", "/api/audit", {"desde": ENORME}, "desde"),
    ("get", "/api/audit", {"usuario": ENORME}, "usuario"),
    ("get", "/api/audit/export.csv", {"limit": NUMERO}, "limit"),
    ("get", "/api/client-errors", {"limit": NUMERO}, "limit"),
    ("get", "/api/history", {"days": NUMERO}, "days"),
    ("get", "/api/incidents", {"days": NUMERO}, "days"),
    ("get", "/api/incidents", {"days": 0}, "days"),
    ("get", "/api/sustainability/summary", {"days": NUMERO}, "days"),
    ("get", "/api/reports/operations", {"days": NUMERO}, "days"),
    ("get", "/api/consents", {"browser_id": ENORME}, "browser_id"),
    ("delete", "/api/shipments/NO-EXISTE", {"usuario": ENORME}, "usuario"),
]


@pytest.mark.parametrize("metodo, ruta, parametros, campo", CASOS_CONSULTA,
                         ids=[f"{m.upper()} {r} · {c}" for m, r, _, c in CASOS_CONSULTA])
def test_consulta_enorme_responde_422(client, metodo, ruta, parametros, campo):
    _rechazado(getattr(client, metodo)(ruta, params=parametros), campo)


def test_la_carga_masiva_tiene_tope_de_base64(client):
    """El cuerpo entero lo limita guard.py a 16 MB; el base64 se corta antes de decodificarlo (10 MB reales)."""
    _rechazado(client.post("/api/shipments/import",
                           json={"filename": "envios.xlsx", "content_b64": "A" * 14_000_001}), "content_b64")


def test_una_consulta_normal_sigue_pasando(client):
    """Los valores que manda la app: la cotización, la lista paginada, la auditoría y los tableros."""
    ruta = {"origen": "Bogotá", "destino": "Cartagena", "prioridad": "costo", "peso_t": 12.5,
            "modos": ["terrestre"], "vias": []}
    assert client.post("/api/routes/simulate", json=ruta).status_code == 200
    # La página pide 25 y el calendario 1.000; los filtros y el orden viajan como los manda la app
    for parametros in ({"limit": 25, "offset": 0, "sort": "estado"},
                       {"limit": 1000, "status": "En Ruta,Retrasado", "modes": "terrestre"},
                       {"q": "Bogotá", "firmar": "true"}):
        assert client.get("/api/shipments", params=parametros).status_code == 200, parametros
    assert client.get("/api/audit", params={"limit": 50, "q": "LS", "desde": "2026-01-01"}).status_code == 200
    assert client.get("/api/history", params={"days": 30}).status_code == 200
    assert client.get("/api/incidents", params={"days": 7}).status_code == 200
    assert client.get("/api/sustainability/summary", params={"days": 30}).status_code == 200
    assert client.get("/api/reports/operations", params={"days": 7}).status_code == 200


def _envio(client) -> str:
    cuerpo = {"origin": "Bogotá", "destination": "Medellín", "cargo": "Café excelso", "weight_t": 12.5,
              "priority": "costo", "client": "Cafés de la Cordillera",
              "departure_at": (datetime.now() + timedelta(hours=3)).isoformat(timespec="minutes"),
              "delay_h": 0, "forced_modes": ["terrestre"], "forced_corridors": [],
              "usuario": "Pruebas de límites"}
    r = client.post("/api/shipments", json=cuerpo)
    assert r.status_code == 201, r.text
    return r.json()["code"]


def test_un_envio_normal_pasa_por_sus_rutas(client):
    """Editar, bitácora, costo real, correo del cliente, adjunto y exportación con valores normales."""
    code = _envio(client)
    assert client.put(f"/api/shipments/{code}", json={"cargo": "Café excelso en sacos", "delay_h": 1,
                                                      "usuario": "Pruebas"}).status_code == 200
    assert client.post(f"/api/shipments/{code}/events",
                       json={"kind": "nota", "body": "Sin novedad en el cargue", "delay_h": 0,
                             "usuario": "Pruebas"}).status_code == 201
    assert client.put(f"/api/shipments/{code}/actual-cost",
                      json={"amount": 1250, "moneda": "USD", "note": "Factura 123",
                            "usuario": "Pruebas"}).status_code == 200
    assert client.put(f"/api/shipments/{code}/client-email", json={"email": "cliente@ejemplo.co"},
                      headers=admin_headers()).status_code == 200
    # Un PDF pequeño y válido como adjunto (journal comprueba que el contenido corresponda a la extensión)
    assert client.post(f"/api/shipments/{code}/attachments",
                       json={"filename": "remesa.pdf", "content_b64": "JVBERi0xLjcK",
                             "autorizado": True}).status_code == 201
    assert client.post("/api/exports", json={"codes": [code], "moneda": "USD",
                                             "usuario": "Pruebas"}).status_code == 201


def test_las_consultas_con_sesion_siguen_pasando(client):
    """Los límites no estorban a las pantallas que piden sesión (consentimientos, errores y auditoría en CSV)."""
    assert client.get("/api/consents", params={"browser_id": "nav-pruebas-0000000001"}).status_code == 200
    h = admin_headers()
    assert client.get("/api/client-errors", params={"limit": 20}, headers=h).status_code == 200
    assert client.get("/api/audit/export.csv", params={"limit": 1000}, headers=h).status_code == 200


def test_un_retraso_exagerado_lo_rechaza_el_motor_en_espanol(client):
    """delay_h no tiene tope en el modelo: lo valida el motor, con un mensaje que el formulario puede mostrar tal cual."""
    r = client.post("/api/shipments", json={"origin": "Bogotá", "destination": "Medellín", "cargo": "Café", "client": "Cliente de prueba",
                                            "weight_t": 5, "departure_at": "2026-11-21T08:00", "delay_h": 25000})
    assert r.status_code == 422 and isinstance(r.json()["detail"], str) and "2.000" in r.json()["detail"]


def test_exportar_la_lista_completa_cabe_en_el_tope(client):
    """La lista pide hasta 1000 envíos y manda todos sus códigos a exportar: 400 códigos no deben dar 422 por tamaño."""
    r = client.post("/api/exports", json={"codes": [f"LS-0000-{i:04d}" for i in range(400)], "moneda": "USD"})
    assert r.status_code != 422 or "at most" not in str(r.json())
