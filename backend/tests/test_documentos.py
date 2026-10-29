"""
SOAT y revisión técnico-mecánica de los vehículos de carretera: estado derivado, avisos, inhabilitación, que no se
asignen viajes que terminan con un documento vencido, reasignación al vencerse y la migración v12.
"""
import sqlite3
from datetime import date, datetime, timedelta

import pytest
from fastapi.testclient import TestClient

import app.database.db as db
import app.init_db as init_db
from app.database.schema_v12 import apply_v12_migration, seed_dates
from app.engine import fleet


@pytest.fixture(scope="module")
def client(tmp_path_factory):
    path = str(tmp_path_factory.mktemp("docs") / "docs.db")
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


def day(n: int) -> str:
    return (date.today() + timedelta(days=n)).isoformat()


def test_la_semilla_trae_documentos_solo_en_carretera(client):
    vs = vehicles(client)
    road = [v for v in vs if v["mode"] == "terrestre"]
    other = [v for v in vs if v["mode"] != "terrestre"]
    assert road and all(v["soat_expiry"] and v["rtm_expiry"] for v in road)
    assert all(len(v["documents"]) == 2 for v in road)
    assert all(v["documents"] == [] and v["soat_expiry"] is None for v in other)
    # todos vigentes o por vencer: la semilla no deja vehículos inhabilitados por documentos
    assert not any(d["state"] == "Vencido" for v in road for d in v["documents"])


def test_por_vencer_avisa_y_aparece_en_el_resumen(client):
    soon = [v for v in vehicles(client, mode="terrestre") if any(d["state"] == "Por vencer" for d in v["documents"])]
    assert soon, "la semilla debe tener algún documento por vencer"
    v = soon[0]
    assert v["operable"] or v["status"] in ("Inhabilitado", "Mantenimiento vencido", "En mantenimiento")
    assert any("vence en" in w for w in v["warnings"])
    due = client.get("/api/fleet/summary").json()["documents_due"]
    assert any(x["code"] == v["code"] for x in due)
    assert [x["days_left"] for x in due] == sorted(x["days_left"] for x in due)


def test_soat_vencido_inhabilita_y_libera_sus_viajes(client):
    now = datetime.now().isoformat(timespec="minutes")
    busy = next(v for v in vehicles(client, mode="terrestre")
                if v["operable"] and rows("SELECT 1 FROM fl_assignments WHERE vehicle_id = ? AND start_at > ?", (v["id"], now)))
    r = client.put(f"/api/fleet/vehicles/{busy['id']}", json={"soat_expiry": day(-1), "usuario": "Ana"})
    assert r.status_code == 200, r.text
    v = r.json()
    assert v["status"] == "Inhabilitado" and any("SOAT vencido" in b for b in v["blockers"])
    assert not rows("SELECT 1 FROM fl_assignments WHERE vehicle_id = ? AND end_at > ?", (busy["id"], now))
    log = rows("SELECT detail FROM audit_log WHERE record_id = ? ORDER BY audit_id DESC LIMIT 1", (busy["code"],))[0]
    assert "SOAT" in log["detail"]


def test_vence_en_pocos_dias_conserva_lo_anterior_y_suelta_lo_posterior(client):
    vid = client.post("/api/fleet/vehicles", json={"code": "DOC-010", "mode": "terrestre", "vehicle_type": "Camión sencillo",
                                                   "year": 2023, "usuario": "Ana"}).json()["id"]
    codes = []
    for days in (3, 12):
        r = client.post("/api/shipments", json={
            "origin": "Bogotá", "destination": "Tunja", "cargo": f"Docs {days}", "weight_t": 2, "client": "QA",
            "priority": "costo", "forced_modes": ["terrestre"], "usuario": "Ana",
            "departure_at": (datetime.now() + timedelta(days=days)).isoformat(timespec="minutes")})
        code = r.json()["code"]
        pin = client.put(f"/api/shipments/{code}/legs/0/vehicle", json={"vehicle_ids": [vid], "usuario": "Ana"})
        assert pin.status_code == 200, pin.text
        codes.append(code)
    first = rows("SELECT * FROM fl_assignments WHERE vehicle_id = ? AND shipment_code = ?", (vid, codes[0]))[0]
    expiry = datetime.fromisoformat(first["end_at"]).date().isoformat()  # vigente hasta el día en que termina el primero
    r = client.put(f"/api/fleet/vehicles/{vid}", json={"rtm_expiry": expiry, "usuario": "Ana"})
    assert r.status_code == 200, r.text
    mine = {a["shipment_code"] for a in rows("SELECT shipment_code FROM fl_assignments WHERE vehicle_id = ?", (vid,))}
    assert codes[0] in mine and codes[1] not in mine
    assert r.json()["reassigned"]["replaced"] or r.json()["reassigned"]["outsourced"]
    note = rows("SELECT route_note FROM mm_shipments WHERE shipment_code = ?", (codes[1],))[0]["route_note"]
    assert "técnico-mecánica" in note


def test_no_se_asigna_un_viaje_que_termina_con_el_documento_vencido(client):
    body = {"code": "DOC-001", "mode": "terrestre", "vehicle_type": "Camión sencillo", "year": 2022,
            "soat_expiry": day(1), "rtm_expiry": day(200), "usuario": "Ana"}
    r = client.post("/api/fleet/vehicles", json=body)
    assert r.status_code == 201, r.text
    vid = r.json()["id"]
    v = fleet._vehicle_row(vid)
    start = datetime.now() + timedelta(days=5)
    assert fleet._doc_valid_through(v, start + timedelta(hours=4)) is False
    assert fleet._doc_valid_through(v, datetime.now() + timedelta(hours=1)) is True
    # el selector de vehículos explica por qué
    ship = client.post("/api/shipments", json={
        "origin": "Bogotá", "destination": "Tunja", "cargo": "Docs", "weight_t": 2, "client": "QA", "priority": "costo",
        "forced_modes": ["terrestre"], "departure_at": start.isoformat(timespec="minutes"), "usuario": "Ana"}).json()
    opts = client.get(f"/api/shipments/{ship['code']}/legs/0/vehicles").json()["items"]
    mine = next(o for o in opts if o["id"] == vid)
    assert mine["available"] is False and "vencen antes de terminar" in mine["reason"]


def test_validaciones_y_otros_modos(client):
    r = client.post("/api/fleet/vehicles", json={"code": "DOC-002", "mode": "terrestre", "vehicle_type": "Camión sencillo",
                                                 "soat_expiry": "31/02/2027"})
    assert r.status_code == 422 and "SOAT" in r.json()["detail"]
    plane = next(v for v in vehicles(client) if v["mode"] == "aereo")
    r = client.put(f"/api/fleet/vehicles/{plane['id']}", json={"soat_expiry": day(10)})
    assert r.status_code == 200 and r.json()["soat_expiry"] is None  # solo aplica a carretera
    new = client.post("/api/fleet/vehicles", json={"code": "DOC-003", "mode": "terrestre", "vehicle_type": "Camión sencillo"})
    assert new.status_code == 201
    assert {d["state"] for d in new.json()["documents"]} == {"Sin registrar"} and new.json()["status"] == "Disponible"


def test_revision_diaria(client):
    assert fleet.enforce_documents(datetime.now()) >= 0
    now = datetime.now().isoformat(timespec="minutes")
    for v in vehicles(client, mode="terrestre"):
        cut = fleet._doc_cutoff(fleet._vehicle_row(v["id"]))
        if cut:
            late = rows("SELECT 1 FROM fl_assignments WHERE vehicle_id = ? AND end_at > ? AND end_at > ?",
                        (v["id"], cut.isoformat(timespec="minutes"), now))
            assert not late, f"{v['code']} tiene viajes después de vencer sus documentos"


def test_migracion_v12_llena_solo_la_semilla_de_carretera_y_es_idempotente():
    con = sqlite3.connect(":memory:")
    con.execute("CREATE TABLE fl_vehicles (vehicle_id INTEGER PRIMARY KEY, code TEXT, mode TEXT, source TEXT)")
    con.executemany("INSERT INTO fl_vehicles VALUES (?,?,?,?)", [
        (1, "ABC123", "terrestre", "semilla"), (2, "XYZ987", "terrestre", "usuario"), (3, "HK-1234", "aereo", "semilla")])
    apply_v12_migration(con)
    got = {r[0]: (r[1], r[2]) for r in con.execute("SELECT vehicle_id, soat_expiry, rtm_expiry FROM fl_vehicles")}
    assert got[1] == seed_dates("ABC123", date.today())
    assert got[2] == (None, None) and got[3] == (None, None)
    con.execute("UPDATE fl_vehicles SET soat_expiry = '2030-01-01' WHERE vehicle_id = 1")
    apply_v12_migration(con)
    assert con.execute("SELECT soat_expiry FROM fl_vehicles WHERE vehicle_id = 1").fetchone()[0] == "2030-01-01"


def test_fechas_de_la_semilla_son_deterministas_y_futuras():
    today = date.today()
    for code in ("ABC123", "TTX902", "QWE555", "LMN010"):
        s, r = seed_dates(code, today)
        assert seed_dates(code, today) == (s, r)
        assert date.fromisoformat(s) > today and date.fromisoformat(r) > today


def test_aviso_diario_de_vencimientos(client, monkeypatch):
    from app.engine import notify
    sent = []
    monkeypatch.setattr(notify, "send", lambda title, msg, **kw: sent.append((title, msg, kw)) or True)
    v = next(x for x in vehicles(client, mode="terrestre") if not x["retired"])
    assert client.put(f"/api/fleet/vehicles/{v['id']}", json={"soat_expiry": day(2), "usuario": "Ana"}).status_code == 200
    assert fleet.notify_due(datetime.now()) is True
    title, msg, kw = sent[-1]
    assert "por vencer" in title and f"{v['code']}: SOAT vence en 2 d" in msg and kw["path"] == "/hoy"
    assert client.put(f"/api/fleet/vehicles/{v['id']}", json={"soat_expiry": day(-3), "usuario": "Ana"}).status_code == 200
    fleet.notify_due(datetime.now())
    title, msg, kw = sent[-1]
    assert "hay vencidos" in title and kw["priority"] == "high" and "venció hace 3 d" in msg


def test_sin_tema_de_ntfy_no_envia(monkeypatch):
    from app.engine import notify
    monkeypatch.delenv("NTFY_TOPIC", raising=False)
    assert notify.send("x", "y") is False
