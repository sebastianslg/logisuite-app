"""
Pruebas de la flota de vehículos y de la red de bodegas: estado derivado, inhabilitación por
fallas, mantenimientos, asignación a envíos sin cruces de horario, sustitución de vehículos,
inventario, movimientos y traslados. Usan una base SQLite temporal propia.
"""
import json
from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient

import app.database.db as db
import app.init_db as init_db
from app.engine import fleet, warehouses


@pytest.fixture(scope="module")
def client(tmp_path_factory):
    path = str(tmp_path_factory.mktemp("fleet") / "fleet.db")
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


def rows(sql, params=()):
    return db.run_query(sql, params).to_dict(orient="records")


def vehicles(client, **q):
    return client.get("/api/fleet/vehicles", params=q).json()["items"]


def new_vehicle(client, code, **kw):
    body = {"code": code, "mode": "terrestre", "vehicle_type": "Camión sencillo", "year": 2022,
            "usuario": "Tester", **kw}
    return client.post("/api/fleet/vehicles", json=body)


def bookings_overlap(buffer_h=0.0):
    """Cruces de horario de un mismo vehículo en fl_assignments."""
    by: dict = {}
    for a in rows("SELECT * FROM fl_assignments"):
        by.setdefault(a["vehicle_id"], []).append((datetime.fromisoformat(a["start_at"]), datetime.fromisoformat(a["end_at"]), a))
    bad = []
    for vid, lst in by.items():
        lst.sort(key=lambda x: x[0])
        for (s1, e1, a1), (s2, e2, a2) in zip(lst, lst[1:]):
            if s2 < e1 - timedelta(hours=buffer_h):
                bad.append((vid, a1["shipment_code"], a2["shipment_code"]))
    return bad


# ---------------------------------------------------------------------------
class TestFlotaSemilla:

    def test_flota_de_los_cinco_modos(self, client):
        vs = vehicles(client)
        assert len(vs) >= 50
        assert {v["mode"] for v in vs} == {"terrestre", "fluvial", "maritimo", "aereo", "ferreo"}
        assert all(v["capacity_t"] > 0 for v in vs)

    def test_estados_derivados_de_la_semilla(self, client):
        vs = {v["code"]: v for v in vehicles(client)}
        por_estado: dict = {}
        for v in vs.values():
            por_estado.setdefault(v["status"], []).append(v)
        assert por_estado.get("Inhabilitado"), "debe haber vehículos inhabilitados por falla o licencia"
        assert por_estado.get("En mantenimiento")
        assert por_estado.get("Mantenimiento vencido")
        assert por_estado.get("Disponible")
        for v in vs.values():
            assert v["operable"] == (v["status"] in ("Disponible", "Reservado", "En ruta"))
            if v["status"] in ("Inhabilitado", "En mantenimiento", "Mantenimiento vencido"):
                assert v["blockers"], f"{v['code']} no explica por qué no opera"

    def test_cada_tramo_pendiente_tiene_vehiculo_de_la_flota(self, client):
        codes = {v["code"] for v in vehicles(client)}
        for r in rows("SELECT route_json, status FROM mm_shipments WHERE status != 'Entregado'"):
            for leg in json.loads(r["route_json"])["legs"]:
                a = leg["asset"]
                assert "own" in a
                if a["own"]:
                    assert set(a["plates"]) <= codes

    def test_ningun_vehiculo_en_dos_tramos_a_la_vez(self, client):
        assert bookings_overlap() == []

    def test_los_vehiculos_no_operables_no_tienen_tramos_futuros_propios(self, client):
        now = datetime.now().isoformat(timespec="minutes")
        for v in vehicles(client):
            if v["operable"] or v["status"] == "En ruta":
                continue
            fut = rows("SELECT * FROM fl_assignments WHERE vehicle_id = ? AND end_at > ? AND start_at > ?", (v["id"], now, now))
            assert not fut, f"{v['code']} ({v['status']}) tiene tramos futuros"

    def test_kilometraje_sube_con_la_operacion(self, client):
        busy = next(v for v in vehicles(client) if v["trips_total"] > 0 and v["mode"] == "terrestre")
        later = fleet.vehicle_detail(busy["id"], datetime.now() + timedelta(days=5))
        assert later["odometer_km"] > busy["odometer_km"]
        assert later["service"]["km_left"] < busy["service"]["km_left"]


# ---------------------------------------------------------------------------
class TestAltaYEdicion:

    def test_crear_editar_y_validar(self, client):
        r = new_vehicle(client, "tst-001", home_warehouse_id=1)
        assert r.status_code == 201, r.text
        v = r.json()
        assert v["code"] == "TST-001" and v["status"] == "Disponible" and v["capacity_t"] == 10
        assert new_vehicle(client, "TST-001").status_code == 422                           # placa repetida
        assert new_vehicle(client, "TST-002", vehicle_type="Carguero B767-300BCF").status_code == 422  # tipo de otro modo
        assert new_vehicle(client, "TST-003", mode="espacial").status_code == 422
        assert new_vehicle(client, "TST-004", capacity_t=-3).status_code == 422
        e = client.put(f"/api/fleet/vehicles/{v['id']}", json={"make": "JAC", "model": "N75", "capacity_t": 11, "usuario": "Tester"})
        assert e.status_code == 200 and e.json()["make"] == "JAC" and e.json()["capacity_t"] == 11

    def test_borrar_solo_si_no_tiene_historial(self, client):
        v = new_vehicle(client, "TST-DEL").json()
        assert client.delete(f"/api/fleet/vehicles/{v['id']}").status_code == 200
        con_historial = next(x for x in vehicles(client) if x["trips_total"] > 0)
        r = client.delete(f"/api/fleet/vehicles/{con_historial['id']}")
        assert r.status_code == 422 and "baja" in r.json()["detail"]

    def test_baja_y_reincorporacion(self, client):
        v = new_vehicle(client, "TST-BAJA").json()
        assert client.post(f"/api/fleet/vehicles/{v['id']}/retire", json={"usuario": "T"}).status_code == 422  # motivo obligatorio
        r = client.post(f"/api/fleet/vehicles/{v['id']}/retire", json={"reason": "Siniestro total", "usuario": "T"})
        assert r.status_code == 200 and r.json()["status"] == "Dado de baja" and not r.json()["operable"]
        m = client.post(f"/api/fleet/vehicles/{v['id']}/maintenance", json={
            "kind": "Preventivo", "scheduled_start": (datetime.now() + timedelta(days=2)).isoformat()})
        assert m.status_code == 422  # un vehículo dado de baja no se programa
        a = client.post(f"/api/fleet/vehicles/{v['id']}/reactivate", json={"usuario": "T"})
        assert a.json()["status"] == "Disponible"


# ---------------------------------------------------------------------------
class TestFallas:

    def _busy_truck(self, client):
        return next(v for v in vehicles(client, mode="terrestre")
                    if v["operable"] and v["upcoming_assignments"] + (1 if v["current"] else 0) > 0
                    and v["driver"] and v["driver"]["license_days_left"] > 60)

    def test_falla_inhabilita_y_reasigna_los_envios(self, client):
        v = self._busy_truck(client)
        before = rows("SELECT DISTINCT shipment_code FROM fl_assignments WHERE vehicle_id = ? AND end_at > ?",
                      (v["id"], datetime.now().isoformat(timespec="minutes")))
        assert before
        r = client.post(f"/api/fleet/vehicles/{v['id']}/faults", json={
            "severity": "Moderada", "category": "Motor", "description": "Pérdida de potencia al subir", "usuario": "Mecánico"})
        assert r.status_code == 201, r.text
        d = r.json()
        assert d["status"] == "Inhabilitado" and not d["operable"] and d["blocking_faults"] == 1
        moved = {x["shipment_code"] for x in d["reassigned"]["replaced"] + d["reassigned"]["outsourced"]}
        assert moved == {b["shipment_code"] for b in before}
        for code in moved:
            sh = rows("SELECT * FROM mm_shipments WHERE shipment_code = ?", (code,))[0]
            assert v["code"] not in sh["route_json"].replace(f"{v['code']} sustituido", "") or "sustituido" in sh["route_note"] or "tercero" in sh["route_note"]
            assert "Vehículo" in sh["route_note"] or "vehículo" in sh["route_note"]
        left = rows("SELECT * FROM fl_assignments WHERE vehicle_id = ? AND end_at > ?", (v["id"], datetime.now().isoformat(timespec="minutes")))
        assert left == []
        hist = rows("SELECT action, detail FROM audit_log WHERE table_name = 'fl_faults' ORDER BY audit_id DESC LIMIT 1")
        assert "inhabilitado" in hist[0]["detail"]
        assert bookings_overlap() == []

    def test_resolver_la_falla_vuelve_a_habilitarlo(self, client):
        v = new_vehicle(client, "TST-FAL").json()
        f = client.post(f"/api/fleet/vehicles/{v['id']}/faults", json={
            "severity": "Moderada", "category": "Frenos", "description": "Pastillas gastadas al límite"}).json()
        fid = f["faults"][0]["fault_id"]
        assert f["status"] == "Inhabilitado"
        assert client.put(f"/api/fleet/faults/{fid}", json={"status": "Resuelta"}).status_code == 422   # falta la solución
        r = client.put(f"/api/fleet/faults/{fid}", json={"status": "Resuelta", "resolution": "Cambio de pastillas", "repair_cost_usd": 80})
        assert r.status_code == 200 and r.json()["status"] == "Disponible" and r.json()["open_faults"] == 0

    def test_falla_leve_no_inhabilita_y_la_critica_siempre(self, client):
        v = new_vehicle(client, "TST-LEV").json()
        leve = client.post(f"/api/fleet/vehicles/{v['id']}/faults", json={
            "severity": "Leve", "category": "Iluminación", "description": "Luz de placa quemada"}).json()
        assert leve["operable"] and leve["open_faults"] == 1 and leve["warnings"]
        crit = client.post(f"/api/fleet/vehicles/{v['id']}/faults", json={
            "severity": "Crítica", "category": "Frenos", "description": "Sin frenos", "blocks_operation": False}).json()
        assert crit["status"] == "Inhabilitado"
        fid = crit["faults"][0]["fault_id"]
        assert client.put(f"/api/fleet/faults/{fid}", json={"blocks_operation": False}).status_code == 422

    def test_validaciones_del_reporte(self, client):
        v = new_vehicle(client, "TST-VAL").json()
        base = {"severity": "Leve", "category": "Motor", "description": "Ruido extraño en frío"}
        assert client.post(f"/api/fleet/vehicles/{v['id']}/faults", json={**base, "severity": "Gravísima"}).status_code == 422
        assert client.post(f"/api/fleet/vehicles/{v['id']}/faults", json={**base, "category": "Magia"}).status_code == 422
        assert client.post(f"/api/fleet/vehicles/{v['id']}/faults", json={**base, "description": "x"}).status_code == 422
        assert client.post("/api/fleet/vehicles/999999/faults", json=base).status_code == 422


# ---------------------------------------------------------------------------
class TestMantenimiento:

    def test_programar_cruce_y_ciclo_completo(self, client):
        v = new_vehicle(client, "TST-MNT", last_service_at=(datetime.now() - timedelta(days=100)).date().isoformat(),
                        service_interval_days=120).json()
        start = datetime.now() + timedelta(days=3)
        r = client.post(f"/api/fleet/vehicles/{v['id']}/maintenance", json={
            "kind": "Preventivo", "scheduled_start": start.isoformat(), "duration_h": 10, "workshop": "Taller Propio", "est_cost_usd": 300})
        assert r.status_code == 201, r.text
        mid = r.json()["next_maintenance"]["id"]
        # se cruza con el anterior
        assert client.post(f"/api/fleet/vehicles/{v['id']}/maintenance", json={
            "kind": "Inspección", "scheduled_start": (start + timedelta(hours=2)).isoformat()}).status_code == 422
        s = client.post(f"/api/fleet/maintenance/{mid}/start", json={"usuario": "Jefe de taller"})
        assert s.status_code == 200 and s.json()["status"] == "En mantenimiento" and not s.json()["operable"]
        c = client.post(f"/api/fleet/maintenance/{mid}/complete", json={"cost_usd": 340, "notes": "Cambio de aceite y filtros"})
        d = c.json()
        assert c.status_code == 200 and d["status"] == "Disponible"
        assert d["service"]["days_left"] > 110 and d["service"]["state"] == "Al día"       # el contador volvió a empezar
        assert d["maintenance_cost_usd"] == 340
        assert client.post(f"/api/fleet/maintenance/{mid}/complete", json={}).status_code == 422  # ya está cerrado

    def test_mantenimiento_programado_reasigna_lo_que_se_cruza(self, client):
        v = next(x for x in vehicles(client, mode="terrestre")
                 if x["operable"] and x["upcoming_assignments"] > 0 and not x["current"])
        a = rows("SELECT * FROM fl_assignments WHERE vehicle_id = ? AND start_at > ? ORDER BY start_at LIMIT 1",
                 (v["id"], datetime.now().isoformat(timespec="minutes")))[0]
        start = datetime.fromisoformat(a["start_at"]) - timedelta(hours=1)
        r = client.post(f"/api/fleet/vehicles/{v['id']}/maintenance", json={
            "kind": "Correctivo", "scheduled_start": start.isoformat(), "duration_h": 30})
        assert r.status_code == 201, r.text
        assert any(x["shipment_code"] == a["shipment_code"] for x in r.json()["reassigned"]["replaced"] + r.json()["reassigned"]["outsourced"])
        assert not rows("SELECT 1 FROM fl_assignments WHERE vehicle_id = ? AND assign_id = ?", (v["id"], a["assign_id"]))

    def test_correctivo_ligado_a_una_falla_la_resuelve(self, client):
        v = new_vehicle(client, "TST-COR").json()
        f = client.post(f"/api/fleet/vehicles/{v['id']}/faults", json={
            "severity": "Moderada", "category": "Transmisión", "description": "Salta la marcha en tercera"}).json()
        fid = f["faults"][0]["fault_id"]
        m = client.post(f"/api/fleet/vehicles/{v['id']}/maintenance", json={
            "kind": "Correctivo", "scheduled_start": (datetime.now() + timedelta(hours=1)).isoformat(), "duration_h": 12, "fault_id": fid}).json()
        assert [x for x in m["faults"] if x["fault_id"] == fid][0]["status"] == "En reparación"
        done = client.post(f"/api/fleet/maintenance/{m['next_maintenance']['id']}/complete", json={"cost_usd": 500}).json()
        assert [x for x in done["faults"] if x["fault_id"] == fid][0]["status"] == "Resuelta"
        assert done["status"] == "Disponible"

    def test_cancelar(self, client):
        v = new_vehicle(client, "TST-CAN").json()
        m = client.post(f"/api/fleet/vehicles/{v['id']}/maintenance", json={
            "kind": "Inspección", "scheduled_start": (datetime.now() + timedelta(days=4)).isoformat()}).json()
        c = client.post(f"/api/fleet/maintenance/{m['next_maintenance']['id']}/cancel", json={})
        assert c.status_code == 200 and c.json()["next_maintenance"] is None


# ---------------------------------------------------------------------------
class TestConductoresYEnvios:

    def test_licencia_vencida_inhabilita(self, client):
        d = client.post("/api/fleet/drivers", json={"name": "Conductor de prueba", "license_cat": "C2",
                                                    "license_expiry": (datetime.now() - timedelta(days=3)).date().isoformat()})
        assert d.status_code == 201
        did = d.json()["driver_id"]
        assert d.json()["license_state"] == "Vencida"
        v = new_vehicle(client, "TST-LIC", driver_id=did)
        assert v.status_code == 201 and v.json()["status"] == "Inhabilitado"
        assert any("licencia" in b for b in v.json()["blockers"])
        # un conductor, un vehículo
        assert new_vehicle(client, "TST-LIC2", driver_id=did).status_code == 422
        ok = client.put(f"/api/fleet/drivers/{did}", json={"license_expiry": (datetime.now() + timedelta(days=400)).date().isoformat()})
        assert ok.json()["license_state"] == "Vigente"
        assert client.get(f"/api/fleet/vehicles/{v.json()['id']}").json()["status"] == "Disponible"

    def test_envio_nuevo_usa_flota_y_al_borrarlo_la_libera(self, client):
        body = {"origin": "Bogotá", "destination": "Medellín", "cargo": "Prueba de flota", "weight_t": 12, "client": "QA",
                "priority": "costo", "departure_at": (datetime.now() + timedelta(days=3)).isoformat(timespec="minutes"), "usuario": "T"}
        r = client.post("/api/shipments", json=body)
        assert r.status_code == 201, r.text
        code = r.json()["code"]
        legs = json.loads(rows("SELECT route_json FROM mm_shipments WHERE shipment_code = ?", (code,))[0]["route_json"])["legs"]
        assert all("own" in l["asset"] for l in legs)
        n = rows("SELECT COUNT(*) c FROM fl_assignments WHERE shipment_code = ?", (code,))[0]["c"]
        assert n == sum(1 for l in legs if l["asset"]["own"])
        assert bookings_overlap() == []
        assert client.delete(f"/api/shipments/{code}?usuario=T").status_code == 200
        assert rows("SELECT COUNT(*) c FROM fl_assignments WHERE shipment_code = ?", (code,))[0]["c"] == 0

    def test_carga_enorme_se_terceriza(self, client):
        body = {"origin": "Bogotá", "destination": "Tunja", "cargo": "Carga excepcional", "weight_t": 900, "client": "QA",
                "priority": "costo", "forced_modes": ["terrestre"],
                "departure_at": (datetime.now() + timedelta(days=5)).isoformat(timespec="minutes"), "usuario": "T"}
        r = client.post("/api/shipments", json=body)
        assert r.status_code == 201, r.text
        legs = json.loads(rows("SELECT route_json FROM mm_shipments WHERE shipment_code = ?", (r.json()["code"],))[0]["route_json"])["legs"]
        assert any(l["asset"]["outsourced"] for l in legs)

    def test_resumen(self, client):
        s = client.get("/api/fleet/summary").json()
        assert s["total"] >= 50 and 0 < s["availability_pct"] <= 100
        assert s["open_faults"] and s["maintenance_due"] and set(s["by_status"]) >= {"Disponible", "Inhabilitado"}


# ---------------------------------------------------------------------------
class TestAsignacionManual:
    """Elegir a mano el vehículo de un tramo: validaciones, fijado y vuelta a automático."""

    @pytest.fixture(scope="class")
    def code(self, client):
        body = {"origin": "Bogotá", "destination": "Tunja", "cargo": "Asignación manual", "weight_t": 5, "client": "QA",
                "priority": "costo", "forced_modes": ["terrestre"], "usuario": "T",
                "departure_at": (datetime.now() + timedelta(days=6)).isoformat(timespec="minutes")}
        r = client.post("/api/shipments", json=body)
        assert r.status_code == 201, r.text
        return r.json()["code"]

    def asset(self, code, i=0):
        r = rows("SELECT route_json FROM mm_shipments WHERE shipment_code = ?", (code,))[0]
        return json.loads(r["route_json"])["legs"][i]["asset"]

    def options(self, client, code, i=0):
        r = client.get(f"/api/shipments/{code}/legs/{i}/vehicles")
        assert r.status_code == 200, r.text
        return r.json()

    def test_opciones_del_tramo(self, client, code):
        o = self.options(client, code)
        assert o["mode"] == "terrestre" and o["locked"] is False and o["multi_allowed"] is True
        assert o["items"] and all(v["id"] for v in o["items"])
        sel = [v for v in o["items"] if v["selected"]]
        assert len(sel) == len(self.asset(code)["vehicle_ids"])
        flags = [v["available"] for v in o["items"] if not v["selected"]]
        assert flags == sorted(flags, reverse=True)  # primero los que sí pueden cubrir el tramo
        assert all(v["reason"] for v in o["items"] if not v["available"])

    def test_fijar_vehiculo_lo_registra_y_no_genera_cruces(self, client, code):
        o = self.options(client, code)
        other = next(v for v in o["items"] if v["available"] and v["fits"] and not v["selected"])
        r = client.put(f"/api/shipments/{code}/legs/0/vehicle", json={"vehicle_ids": [other["id"]], "usuario": "Ana"})
        assert r.status_code == 200, r.text
        a = self.asset(code)
        assert a["pinned"] is True and a["vehicle_ids"] == [other["id"]] and a["plates"] == [other["code"]]
        mine = rows("SELECT * FROM fl_assignments WHERE shipment_code = ? AND leg_index = 0", (code,))
        assert [m["vehicle_id"] for m in mine] == [other["id"]] and mine[0]["load_t"] == pytest.approx(5)
        assert bookings_overlap() == []
        log = rows("SELECT * FROM audit_log WHERE record_id = ? ORDER BY audit_id DESC LIMIT 1", (code,))[0]
        assert log["username"] == "Ana" and "a mano" in log["detail"] and other["code"] in log["detail"]
        assert self.options(client, code)["pinned"] is True

    def test_la_eleccion_sobrevive_al_recalculo_de_la_ruta(self, client, code):
        before = self.asset(code)["vehicle_ids"]
        r = client.put(f"/api/shipments/{code}", json={"departure_at": (datetime.now() + timedelta(days=6, hours=1)).isoformat(timespec="minutes"), "usuario": "T"})
        assert r.status_code == 200, r.text
        a = self.asset(code)
        assert a["vehicle_ids"] == before and a["pinned"] is True

    def test_rechaza_vehiculo_de_otro_modo_o_sin_capacidad_o_inexistente(self, client, code):
        air = next(v for v in vehicles(client) if v["mode"] == "aereo")
        r = client.put(f"/api/shipments/{code}/legs/0/vehicle", json={"vehicle_ids": [air["id"]]})
        assert r.status_code == 422 and "no es de modo" in r.json()["detail"]
        small = next((v for v in self.options(client, code)["items"] if v["available"] and not v["fits"]), None)
        if small:
            r = client.put(f"/api/shipments/{code}/legs/0/vehicle", json={"vehicle_ids": [small["id"]]})
            assert r.status_code == 422 and "capacidad" in r.json()["detail"]
        assert client.put(f"/api/shipments/{code}/legs/0/vehicle", json={"vehicle_ids": [999999]}).status_code == 422
        assert client.put(f"/api/shipments/{code}/legs/0/vehicle", json={"vehicle_ids": ["x"]}).status_code == 422

    def test_rechaza_un_vehiculo_no_operable(self, client, code):
        blocked = next(v for v in self.options(client, code)["items"] if not v["available"] and not v["selected"])
        r = client.put(f"/api/shipments/{code}/legs/0/vehicle", json={"vehicle_ids": [blocked["id"]]})
        assert r.status_code == 422 and blocked["code"] in r.json()["detail"]
        assert self.asset(code)["pinned"] is True  # nada cambió

    def test_tramo_inexistente_y_envio_inexistente(self, client, code):
        assert client.get(f"/api/shipments/{code}/legs/99/vehicles").status_code == 422
        assert client.get("/api/shipments/NO-EXISTE/legs/0/vehicles").status_code == 404
        assert client.put("/api/shipments/NO-EXISTE/legs/0/vehicle", json={"vehicle_ids": [1]}).status_code == 404

    def test_vacio_vuelve_a_automatico(self, client, code):
        r = client.put(f"/api/shipments/{code}/legs/0/vehicle", json={"vehicle_ids": [], "usuario": "Ana"})
        assert r.status_code == 200, r.text
        a = self.asset(code)
        assert "own" in a and not a.get("pinned")
        assert bookings_overlap() == []

    def test_un_tramo_que_ya_salio_no_se_cambia(self, client):
        sh = rows("""SELECT shipment_code FROM mm_shipments WHERE departure_at < ? AND status != 'Entregado' LIMIT 1""",
                  (datetime.now().isoformat(timespec="minutes"),))
        if not sh:
            pytest.skip("la semilla no tiene envíos en curso")
        r = client.put(f"/api/shipments/{sh[0]['shipment_code']}/legs/0/vehicle", json={"vehicle_ids": [1]})
        assert r.status_code == 422 and "ya salió" in r.json()["detail"]

    def test_vehiculo_en_lista_y_detalle_de_envios(self, client):
        res = client.get("/api/shipments").json()
        assert res["count"] > 0
        with_vehicle = [s for s in res["items"] if s.get("vehicle")]
        assert len(with_vehicle) > 0
        v = with_vehicle[0]["vehicle"]
        assert "id" in v and "own" in v and "type" in v
        # En el detalle también debe incluirse
        det = client.get(f"/api/shipments/{with_vehicle[0]['code']}").json()
        assert det.get("vehicle") is not None
        assert isinstance(det.get("vehicles"), list)


# ---------------------------------------------------------------------------
class TestBodegas:

    def _wh(self, client, **q):
        return client.get("/api/warehouses", params=q).json()["items"]

    def test_red_de_bodegas(self, client):
        ws = self._wh(client)
        assert len(ws) >= 35
        por_ciudad: dict = {}
        for w in ws:
            por_ciudad.setdefault(w["city"], []).append(w)
        assert len(por_ciudad["Bogotá"]) >= 5                         # varias bodegas por ciudad
        assert len({w["role"] for w in ws}) >= 10                    # con roles distintos
        assert all(w["used_m3"] <= w["capacity_m3"] * 1.0001 for w in ws)
        assert all(w["latitude"] and w["longitude"] for w in ws)
        assert any(w["temp_controlled"] for w in ws) and any(w["hazmat"] for w in ws) and any(w["bonded"] for w in ws)

    def test_resumen_y_centros_padre(self, client):
        s = client.get("/api/warehouses/summary").json()
        assert s["warehouses"] >= 35 and s["capacity_m3"] > 0 and 0 < s["occupancy_pct"] < 100
        assert s["low_stock_lines"] > 0
        for n in s["network"]:
            if n["role"] != "hub":
                assert n["parent"], f"{n['code']} no tiene centro padre"

    def test_crear_editar_y_borrar(self, client):
        body = {"name": "Bodega de prueba", "city": "Cali", "role": "ultima_milla", "capacity_m3": 1000, "capacity_pallets": 400,
                "manager": "Prueba", "usuario": "T"}
        r = client.post("/api/warehouses", json=body)
        assert r.status_code == 201, r.text
        w = r.json()
        assert w["code"].startswith("CAL-") and w["latitude"] and w["occupancy_pct"] == 0
        assert client.post("/api/warehouses", json={**body, "role": "inventada"}).status_code == 422
        assert client.post("/api/warehouses", json={**body, "city": "Atlantis"}).status_code == 422
        assert client.post("/api/warehouses", json={**body, "capacity_m3": 5}).status_code == 422
        e = client.put(f"/api/warehouses/{w['warehouse_id']}", json={"name": "Bodega de prueba 2", "capacity_m3": 1500, "usuario": "T"})
        assert e.status_code == 200 and e.json()["name"] == "Bodega de prueba 2"
        assert client.delete(f"/api/warehouses/{w['warehouse_id']}").status_code == 200

    def test_inventario_y_movimientos(self, client):
        w = client.post("/api/warehouses", json={"name": "Bodega stock", "city": "Cali", "role": "regional",
                                                 "capacity_m3": 100, "capacity_pallets": 50}).json()
        wid = w["warehouse_id"]
        item = {"sku": "caja-x", "name": "Cajas de prueba", "category": "Carga seca", "unit": "caja", "qty": 100,
                "min_qty": 20, "max_qty": 300, "volume_m3": 0.2, "weight_kg": 10, "unit_cost_usd": 5}
        assert client.post(f"/api/warehouses/{wid}/stock", json=item).status_code == 201
        assert client.post(f"/api/warehouses/{wid}/stock", json=item).status_code == 422                 # SKU repetido
        assert client.post(f"/api/warehouses/{wid}/stock", json={**item, "sku": "grande", "qty": 1000}).status_code == 422  # no cabe
        det = client.get(f"/api/warehouses/{wid}").json()
        assert det["used_m3"] == 20 and det["occupancy_pct"] == 20
        mv = lambda **k: client.post(f"/api/warehouses/{wid}/movements", json={"sku": "CAJA-X", **k})
        assert mv(kind="Entrada", qty=50).json()["stock"][0]["qty"] == 150
        assert mv(kind="Salida", qty=500).status_code == 422                                              # no hay tanto
        assert mv(kind="Entrada", qty=500).status_code == 422                                             # no hay espacio
        assert mv(kind="Salida", qty=30).json()["stock"][0]["qty"] == 120
        assert mv(kind="Merma", qty=5, note="Mojadas").json()["stock"][0]["qty"] == 115
        a = mv(kind="Ajuste", qty=18).json()
        assert a["stock"][0]["qty"] == 18 and a["stock"][0]["state"] == "Bajo" and any("mínimo" in x for x in a["alerts"])
        kinds = [m["kind"] for m in a["movements"]]
        assert {"Entrada", "Salida", "Merma", "Ajuste"} <= set(kinds)
        assert mv(kind="Robo", qty=1).status_code == 422
        assert client.delete(f"/api/warehouses/{wid}/stock/CAJA-X").status_code == 422                   # aún con existencias
        assert client.delete(f"/api/warehouses/{wid}").status_code == 422                                # con inventario
        assert mv(kind="Merma", qty=18).status_code == 201
        assert client.delete(f"/api/warehouses/{wid}/stock/CAJA-X").status_code == 200
        assert client.delete(f"/api/warehouses/{wid}").status_code == 200

    def _pair(self, client, same_city=False):
        ws = self._wh(client)
        a = next(w for w in ws if w["role"] == "hub" and w["city"] == "Bogotá")
        b = (next(w for w in ws if w["city"] == "Bogotá" and w["role"] == "ultima_milla") if same_city
             else next(w for w in ws if w["role"] == "hub" and w["city"] == "Medellín"))
        return a, b

    def test_traslado_entre_ciudades_crea_un_envio_y_se_recibe_al_llegar(self, client):
        a, b = self._pair(client)
        sku = "PAQ-M"
        stock = lambda wid: next(s for s in client.get(f"/api/warehouses/{wid}").json()["stock"] if s["sku"] == sku)
        a0, b0 = stock(a["warehouse_id"])["qty"], stock(b["warehouse_id"])["qty"]
        r = client.post("/api/warehouses/transfers", json={"from_wh": a["warehouse_id"], "to_wh": b["warehouse_id"], "sku": sku, "qty": 400, "usuario": "T"})
        assert r.status_code == 201, r.text
        t = r.json()
        assert t["status"] == "En tránsito" and t["shipment_code"]
        assert stock(a["warehouse_id"])["qty"] == a0 - 400                       # salió del origen
        assert stock(b["warehouse_id"])["qty"] == b0                             # aún no llega
        fut = datetime.now() + timedelta(days=60)
        assert warehouses.settle_transfers(fut) >= 1
        assert stock(b["warehouse_id"])["qty"] == b0 + 400
        tr = [x for x in client.get("/api/warehouses/transfers").json()["items"] if x["transfer_id"] == t["transfer_id"]][0]
        assert tr["status"] == "Recibido" and tr["received_at"]
        kinds = {m["kind"] for m in client.get(f"/api/warehouses/{b['warehouse_id']}").json()["movements"]}
        assert "Traslado entrada" in kinds

    def test_traslado_cancelado_si_se_borra_el_envio(self, client):
        a, b = self._pair(client)
        sku = "PAQ-S"
        q0 = next(s for s in client.get(f"/api/warehouses/{a['warehouse_id']}").json()["stock"] if s["sku"] == sku)["qty"]
        t = client.post("/api/warehouses/transfers", json={"from_wh": a["warehouse_id"], "to_wh": b["warehouse_id"], "sku": sku, "qty": 200}).json()
        assert client.delete(f"/api/shipments/{t['shipment_code']}?usuario=T").status_code == 200
        warehouses.settle_transfers(datetime.now())
        assert next(s for s in client.get(f"/api/warehouses/{a['warehouse_id']}").json()["stock"] if s["sku"] == sku)["qty"] == q0
        assert [x for x in client.get("/api/warehouses/transfers").json()["items"] if x["transfer_id"] == t["transfer_id"]][0]["status"] == "Cancelado"

    def test_traslado_en_la_misma_ciudad_es_inmediato(self, client):
        a, b = self._pair(client, same_city=True)
        sku = "PAQ-S"
        get = lambda w: next(s for s in client.get(f"/api/warehouses/{w['warehouse_id']}").json()["stock"] if s["sku"] == sku)["qty"]
        a0, b0 = get(a), get(b)
        r = client.post("/api/warehouses/transfers", json={"from_wh": a["warehouse_id"], "to_wh": b["warehouse_id"], "sku": sku, "qty": 100})
        assert r.status_code == 201 and r.json()["status"] == "Recibido" and r.json()["shipment_code"] is None
        assert get(a) == a0 - 100 and get(b) == b0 + 100

    def test_reglas_de_los_traslados(self, client):
        ws = self._wh(client)
        frio = next(w for w in ws if w["role"] == "frio")
        seco = next(w for w in ws if w["role"] == "regional" and w["city"] != frio["city"])
        peligro = next(w for w in ws if w["role"] == "peligrosos")
        sku_med = client.get(f"/api/warehouses/{frio['warehouse_id']}").json()["stock"][0]["sku"]
        r = client.post("/api/warehouses/transfers", json={"from_wh": frio["warehouse_id"], "to_wh": seco["warehouse_id"], "sku": sku_med, "qty": 1})
        assert r.status_code == 422 and "frío" in r.json()["detail"]
        quim = client.get(f"/api/warehouses/{peligro['warehouse_id']}").json()["stock"][0]["sku"]
        r = client.post("/api/warehouses/transfers", json={"from_wh": peligro["warehouse_id"], "to_wh": seco["warehouse_id"], "sku": quim, "qty": 1})
        assert r.status_code == 422 and "peligrosas" in r.json()["detail"]
        assert client.post("/api/warehouses/transfers", json={"from_wh": peligro["warehouse_id"], "to_wh": peligro["warehouse_id"], "sku": quim, "qty": 1}).status_code == 422
        assert client.post("/api/warehouses/transfers", json={"from_wh": seco["warehouse_id"], "to_wh": peligro["warehouse_id"], "sku": "NOEXISTE", "qty": 1}).status_code == 422

    def test_vehiculos_alojados_en_la_bodega(self, client):
        hub = next(w for w in self._wh(client) if w["code"] == "BOG-HUB")
        det = client.get(f"/api/warehouses/{hub['warehouse_id']}").json()
        assert det["vehicles"] >= 3 and len(det["vehicles_list"]) == det["vehicles"]
        assert client.delete(f"/api/warehouses/{hub['warehouse_id']}").status_code == 422
