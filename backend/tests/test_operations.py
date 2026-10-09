"""
Pruebas de operación: vías cerradas, envíos editables, TRM, historial, PDF y
enlaces para compartir. Usan una base SQLite temporal propia (no la de la app).
Ejecución: pytest -v  (desde backend/)
"""
import json
from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient

import app.database.db as db
import app.init_db as init_db


@pytest.fixture(scope="module")
def client(tmp_path_factory):
    path = str(tmp_path_factory.mktemp("ops") / "ops.db")
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


def _rows(sql, params=()):
    return db.run_query(sql, params).to_dict(orient="records")


def _new(client, **kw):
    body = {"origin": "Bogotá", "destination": "Medellín", "cargo": "Repuestos", "weight_t": 12,
            "priority": "costo", "client": "Cliente de prueba",
            "departure_at": (datetime.now() + timedelta(days=2)).isoformat(timespec="minutes"),
            "usuario": "Tester", **kw}
    return client.post("/api/shipments", json=body)


# ---------------------------------------------------------------------------
class TestRestriccionesDelMotor:

    def test_modos_forzados(self, client):
        r = client.post("/api/routes/simulate", json={
            "origen": "Bogotá", "destino": "Cartagena", "prioridad": "tiempo", "peso_t": 5,
            "modos": ["terrestre"]})
        assert r.status_code == 200
        assert set(r.json()["route"]["modes"]) == {"terrestre"}

    def test_via_forzada(self, client):
        r = client.post("/api/routes/simulate", json={
            "origen": "Bogotá", "destino": "Cartagena", "prioridad": "tiempo", "peso_t": 20,
            "vias": ["Río Magdalena"]})
        assert r.status_code == 200
        corredores = {c for l in r.json()["route"]["legs"] for c in l["corridors"]}
        assert "Río Magdalena" in corredores

    def test_via_desconocida(self, client):
        r = client.post("/api/routes/simulate", json={
            "origen": "Bogotá", "destino": "Cartagena", "vias": ["Vía inexistente"]})
        assert r.status_code == 422


# ---------------------------------------------------------------------------
class TestEnviosEditables:

    def test_crear_calcula_ruta_y_registra(self, client):
        r = _new(client)
        assert r.status_code == 201, r.text
        s = r.json()
        assert s["source"] == "manual" and s["created_by"] == "Tester"
        assert s["legs"] and s["status"] == "Programado"
        log = _rows("SELECT * FROM audit_log WHERE record_id = ? AND action = 'INSERT'", (s["code"],))
        assert log and log[0]["username"] == "Tester"

    def test_crear_con_modo_forzado(self, client):
        s = _new(client, forced_modes=["aereo"], weight_t=3).json()
        assert set(s["modes"]) == {"aereo"} and s["forced_modes"] == ["aereo"]

    def test_crear_invalido(self, client):
        assert _new(client, origin="Atlántida").status_code == 422
        assert _new(client, weight_t=-1).status_code == 422

    def test_editar_recalcula(self, client):
        code = _new(client).json()["code"]
        r = client.put(f"/api/shipments/{code}", json={"weight_t": 30, "delay_h": 5, "usuario": "Ana"})
        assert r.status_code == 200
        s = r.json()
        assert s["weight_t"] == 30 and s["delay_h"] == 5 and s["updated_by"] == "Ana"
        log = _rows("SELECT detail FROM audit_log WHERE record_id = ? AND action = 'UPDATE'", (code,))
        assert "12" in log[0]["detail"] and "30" in log[0]["detail"]

    def test_borrar_y_no_reutilizar_codigo(self, client):
        code = _new(client).json()["code"]
        assert client.delete(f"/api/shipments/{code}", params={"usuario": "Ana"}).status_code == 200
        assert client.get(f"/api/shipments/{code}").status_code == 404
        nuevo = _new(client).json()["code"]
        assert int(nuevo.rsplit("-", 1)[1]) > int(code.rsplit("-", 1)[1])

    def test_borrar_envio_semilla(self, client):
        seed = _rows("SELECT shipment_code FROM mm_shipments WHERE source = 'seed' LIMIT 1")[0]
        assert client.delete(f"/api/shipments/{seed['shipment_code']}").status_code == 200


# ---------------------------------------------------------------------------
def _pending_corridors(code):
    from app.engine.dispatch import status_at
    s = _rows("SELECT * FROM mm_shipments WHERE shipment_code = ?", (code,))[0]
    route = json.loads(s["route_json"])
    h = status_at(s, datetime.now(), route)["route_h"]
    from app.engine.operations import _seg_corridors, _segments
    return s, {c for l in route["legs"] if l["end_h"] > h and not l.get("interrupted")
               for sg in _segments(l) if sg["end_h"] > h for c in _seg_corridors(sg)}


class TestViasCerradas:

    def test_cerrar_requiere_motivo(self, client):
        r = client.post("/api/corridors/status", json={"corridor": "Ruta del Sol", "active": False})
        assert r.status_code == 422

    def test_cerrar_redirige_y_reabrir_restablece(self, client):
        corredores = client.get("/api/corridors").json()["items"]
        objetivo = max(corredores, key=lambda c: len(c["shipments"]))
        assert objetivo["shipments"], "se necesita al menos una vía en uso"
        name = objetivo["corridor"]
        r = client.post("/api/corridors/status", json={
            "corridor": name, "active": False, "reason": "Derrumbe", "usuario": "Operador"})
        assert r.status_code == 200, r.text
        res = r.json()
        afectados = set(res["rerouted"]) | set(res["no_route"]) | set(res["replanned"])
        assert set(objetivo["shipments"]) <= afectados
        for code in res["rerouted"] + res["replanned"]:
            s, pend = _pending_corridors(code)
            assert name not in pend and s["route_status"] == "ok" and s["route_note"]
        for code in res["no_route"]:
            assert _rows("SELECT route_status FROM mm_shipments WHERE shipment_code = ?",
                         (code,))[0]["route_status"] == "sin_ruta"
        red = client.get("/api/network/multimodal").json()
        assert all(f["properties"]["closed"] for f in red["links"]["features"]
                   if f["properties"]["corridor"] == name)
        # Ninguna ruta nueva usa la vía cerrada
        s = client.post("/api/shipments/preview", json={
            "origin": objetivo["segments"][0].split(" - ")[0], "destination": "Cartagena",
            "weight_t": 5, "departure_at": datetime.now().isoformat()})
        if s.status_code == 200:
            assert name not in {c for l in s.json()["route"]["legs"] for c in l["corridors"]}
        # Reabrir
        r = client.post("/api/corridors/status", json={"corridor": name, "active": True, "usuario": "Operador"})
        assert r.status_code == 200
        assert set(res["no_route"]) <= set(r.json()["restored"])
        log = _rows("SELECT action FROM audit_log WHERE record_id = ? ORDER BY audit_id", (name,))
        assert [l["action"] for l in log][-2:] == ["CLOSE", "REOPEN"]

    def test_via_forzada_cerrada(self, client):
        client.post("/api/corridors/status", json={"corridor": "Canal del Dique", "active": False,
                                                   "reason": "Sedimentación"})
        r = _new(client, origin="Barranquilla", destination="Cartagena", forced_corridors=["Canal del Dique"])
        assert r.status_code == 422 and "cerrada" in r.json()["detail"]
        client.post("/api/corridors/status", json={"corridor": "Canal del Dique", "active": True})

    def test_en_transito_conserva_lo_recorrido(self, client):
        """Un envío en tránsito redirigido conserva sus tramos ya completados."""
        from app.engine.dispatch import status_at
        now = datetime.now()
        for s in _rows("SELECT * FROM mm_shipments WHERE status IN ('En Ruta','Retrasado')"):
            route = json.loads(s["route_json"])
            h = status_at(s, now, route)["route_h"]
            futuros = [l for l in route["legs"] if l["start_h"] > h + 1]
            hechos = [l for l in route["legs"] if l["end_h"] < h]
            if futuros and hechos and futuros[-1]["corridors"][0] not in {c for l in hechos for c in l["corridors"]}:
                break
        else:
            pytest.skip("no hay envío en tránsito con tramos hechos y pendientes")
        via = futuros[-1]["corridors"][0]
        client.post("/api/corridors/status", json={"corridor": via, "active": False, "reason": "Paro"})
        nuevo = json.loads(_rows("SELECT route_json FROM mm_shipments WHERE shipment_code = ?",
                                 (s["shipment_code"],))[0]["route_json"])
        assert [l["corridors"] for l in nuevo["legs"][:len(hechos)]] == [l["corridors"] for l in hechos]
        client.post("/api/corridors/status", json={"corridor": via, "active": True})


# ---------------------------------------------------------------------------
class TestMonedaYExportacion:

    def test_cop_sin_trm_falla(self, client):
        code = _new(client).json()["code"]
        assert client.get("/api/settings").json()["fx"]["rate"] is None
        assert client.get(f"/api/shipments/{code}/pdf", params={"moneda": "COP"}).status_code == 422

    def test_trm_valida(self, client):
        assert client.put("/api/settings/fx", json={"rate": 10, "date": "2026-10-09",
                                                    "source": "x"}).status_code == 422
        r = client.put("/api/settings/fx", json={"rate": 3900.5, "date": "2026-10-09",
                                                 "source": "Prueba", "usuario": "Ana"})
        assert r.status_code == 200 and r.json()["fx"]["rate"] == 3900.5

    def test_pdf_individual(self, client):
        code = _new(client).json()["code"]
        r = client.get(f"/api/shipments/{code}/pdf", params={"moneda": "COP"})
        assert r.status_code == 200 and r.content.startswith(b"%PDF")
        assert r.headers["content-disposition"].startswith("inline")
        r = client.get(f"/api/shipments/{code}/pdf", params={"descargar": True})
        assert r.headers["content-disposition"].startswith("attachment")

    def test_pdf_consolidado_y_enlace(self, client):
        codes = [s["code"] for s in client.get("/api/shipments").json()["items"][:5]]
        r = client.post("/api/exports/pdf", json={"codes": codes})
        assert r.status_code == 200 and r.content.startswith(b"%PDF")
        link = client.post("/api/exports", json={"codes": codes, "moneda": "USD", "usuario": "Ana"}).json()
        assert client.get(link["path"]).content.startswith(b"%PDF")
        assert any(i["token"] == link["token"] for i in client.get("/api/exports").json()["items"])
        assert client.delete(link["path"]).status_code == 200
        assert client.get(link["path"]).status_code == 404

    def test_historial(self, client):
        items = client.get("/api/audit", params={"limit": 500}).json()["items"]
        assert {"INSERT", "UPDATE", "DELETE", "CLOSE", "REOPEN", "EXPORT", "REVOKE"} <= {i["action"] for i in items}


class TestReposicion:

    def test_desactivar_reposicion_respeta_borrados(self, client):
        from app import main
        client.put("/api/settings/replenish", json={"enabled": False})
        for s in _rows("SELECT shipment_code FROM mm_shipments"):
            client.delete(f"/api/shipments/{s['shipment_code']}")
        main._last_sync = 0.0
        assert client.get("/api/shipments").json()["count"] == 0
        client.put("/api/settings/replenish", json={"enabled": True})
        main._last_sync = 0.0
        assert client.get("/api/shipments").json()["count"] > 0


class TestRedAmpliada:

    CAPITALES = ["Cúcuta", "Manizales", "Armenia", "Montería", "Valledupar", "Riohacha", "Yopal",
                 "Florencia", "San José del Guaviare", "Quibdó", "Arauca", "Mitú", "Inírida", "San Andrés"]

    @pytest.mark.parametrize("ciudad", CAPITALES)
    def test_capital_alcanzable_desde_bogota(self, client, ciudad):
        r = client.post("/api/routes/simulate", json={"origen": "Bogotá", "destino": ciudad,
                                                      "prioridad": "costo", "peso_t": 5})
        assert r.status_code == 200, r.text

    def test_mitu_solo_por_aire(self, client):
        r = client.post("/api/routes/simulate", json={"origen": "Bogotá", "destino": "Mitú", "peso_t": 5})
        assert r.json()["route"]["modes"][-1] == "aereo"
        r = client.post("/api/routes/simulate", json={"origen": "Bogotá", "destino": "Mitú", "peso_t": 5,
                                                      "modos": ["terrestre"]})
        assert r.status_code == 422

    def test_ferrocarriles_inactivos_sembrados_cerrados(self, client):
        items = {c["corridor"]: c for c in client.get("/api/corridors").json()["items"]}
        for via in ("Ferrocarril del Pacífico", "Ferrocarril Bogotá - Belencito"):
            assert not items[via]["active"] and items[via]["reason"] and items[via]["approximate"]
        r = client.post("/api/routes/simulate", json={"origen": "Buenaventura", "destino": "Cali",
                                                      "peso_t": 20, "modos": ["ferreo"]})
        assert r.status_code == 422

    def test_nuevos_datos_marcados_aproximados(self, client):
        red = client.get("/api/network/multimodal").json()
        nodos = {f["properties"]["code"]: f["properties"] for f in red["nodes"]["features"]}
        assert nodos["CITY-CUC"]["approximate"] and not nodos["CEDI-BOG"]["approximate"]

    def test_siembra_idempotente(self, client):
        from app.utils.seed_data import _seed_mm_network
        antes = db.run_query("SELECT COUNT(*) c FROM mm_links").iloc[0]["c"]
        _seed_mm_network()
        assert db.run_query("SELECT COUNT(*) c FROM mm_links").iloc[0]["c"] == antes
