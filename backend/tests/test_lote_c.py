"""
Pruebas de la bitácora (notas e incidencias), adjuntos, carga masiva de envíos, tendencias del resumen,
historial con período anterior, reporte operativo, resumen por cliente y TRM oficial.
Usan una base SQLite temporal propia.
"""
import base64
import io
import os
from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient

import app.database.db as db
import app.init_db as init_db


@pytest.fixture(scope="module")
def client(tmp_path_factory):
    path = str(tmp_path_factory.mktemp("lotec") / "lotec.db")
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


def _new(client, **kw):
    body = {"origin": "Bogotá", "destination": "Medellín", "cargo": "Repuestos", "weight_t": 12,
            "priority": "costo", "client": "Cliente Lote C",
            "departure_at": (datetime.now() - timedelta(hours=2)).isoformat(timespec="minutes"),
            "usuario": "Tester", **kw}
    r = client.post("/api/shipments", json=body)
    assert r.status_code == 201, r.text
    return r.json()


def test_nota_e_incidencia_con_retraso(client):
    s = _new(client)
    code = s["code"]
    r = client.post(f"/api/shipments/{code}/events", json={"kind": "nota", "body": "Cliente pide llamar al llegar"})
    assert r.status_code == 201 and r.json()["kind_label"] == "Nota" and not r.json()["incident"]
    # Una nota no suma retraso
    assert client.post(f"/api/shipments/{code}/events", json={"kind": "nota", "body": "x", "delay_h": 2}).status_code == 422
    inc = client.post(f"/api/shipments/{code}/events",
                      json={"kind": "derrumbe", "body": "Derrumbe en La Línea", "delay_h": 6, "usuario": "Tester"})
    assert inc.status_code == 201
    det = client.get(f"/api/shipments/{code}").json()
    # eta_at es la ETA planeada; el retraso se muestra aparte (+6 h), como en el resto de la app
    assert det["delay_h"] == pytest.approx(6) and det["delay_fmt"]
    items = client.get(f"/api/shipments/{code}/events").json()["items"]
    assert [e["kind"] for e in items] == ["nota", "derrumbe"]
    # Incidencias: no se borran, se resuelven; las notas sí se borran
    inc_id = inc.json()["event_id"]
    assert client.delete(f"/api/shipments/{code}/events/{inc_id}").status_code == 422
    assert client.post(f"/api/shipments/{code}/events/{inc_id}/resolve").json()["resolved_at"]
    assert client.delete(f"/api/shipments/{code}/events/{items[0]['event_id']}").status_code == 200
    assert client.get("/api/incidents?days=7").json()["count"] >= 1
    assert client.get("/api/shipments/NO-EXISTE/events").status_code == 404
    # El historial registra la incidencia
    audit = client.get(f"/api/audit?record={code}").json()["items"]
    assert any("Derrumbe" in a["detail"] for a in audit)


def test_adjuntos(client):
    code = _new(client)["code"]
    pdf = b"%PDF-1.4 prueba"
    r = client.post(f"/api/shipments/{code}/attachments",
                    json={"filename": "Remesa ñandú.pdf", "content_b64": base64.b64encode(pdf).decode(), "autorizado": True})
    assert r.status_code == 201, r.text
    att = r.json()
    f = client.get(f"/api/shipments/{code}/attachments/{att['attachment_id']}")
    assert f.status_code == 200 and f.content == pdf and f.headers["content-type"] == "application/pdf"
    assert "UTF-8''" in f.headers["content-disposition"]
    # Tipo no permitido y base64 dañado
    bad = client.post(f"/api/shipments/{code}/attachments", json={"filename": "virus.exe", "content_b64": "AAAA", "autorizado": True})
    assert bad.status_code == 422
    assert client.post(f"/api/shipments/{code}/attachments",
                       json={"filename": "a.pdf", "content_b64": "no es base64!", "autorizado": True}).status_code == 422
    # Un nombre con ruta no escapa de la carpeta
    r2 = client.post(f"/api/shipments/{code}/attachments",
                     json={"filename": "../../etc/x.txt", "content_b64": base64.b64encode(b"hola").decode(), "autorizado": True})
    assert r2.status_code == 201 and r2.json()["filename"] == "x.txt"
    assert client.get(f"/api/shipments/{code}/attachments").json()["count"] == 2
    # Borrar el envío borra sus archivos
    from app.engine import journal
    folder = os.path.join(journal.attachments_dir(), code)
    assert len(os.listdir(folder)) == 2
    assert client.delete(f"/api/shipments/{code}").status_code == 200
    assert os.listdir(folder) == []


def _b64_xlsx(rows):
    from openpyxl import Workbook
    wb = Workbook()
    ws = wb.active
    for r in rows:
        ws.append(r)
    buf = io.BytesIO()
    wb.save(buf)
    return base64.b64encode(buf.getvalue()).decode()


def test_carga_masiva_vista_previa_y_confirmar(client):
    salida = datetime.now() + timedelta(days=1)
    content = _b64_xlsx([
        ["origen", "destino", "carga", "cliente", "peso_t", "salida", "prioridad"],
        ["Bogotá", "Cartagena", "Café", "Importados SAS", 20, salida, "costo"],
        ["Atlántida", "Cartagena", "Café", "Importados SAS", 20, salida, ""],
        ["Medellín", "Bogotá", "Flores", "Importados SAS", "", salida, ""],
    ])
    before = len(client.get("/api/shipments?limit=1000").json()["items"])
    preview = client.post("/api/shipments/import", json={"filename": "envios.xlsx", "content_b64": content}).json()
    assert preview["rows"] == 3 and preview["valid"] == 1 and preview["errors"] == 2 and not preview["committed"]
    assert preview["results"][0]["modes"] and preview["results"][1]["row"] == 3
    assert len(client.get("/api/shipments?limit=1000").json()["items"]) == before  # nada guardado
    done = client.post("/api/shipments/import",
                       json={"filename": "envios.xlsx", "content_b64": content, "commit": True, "usuario": "Tester", "autorizado": True}).json()
    assert len(done["created"]) == 1
    assert len(client.get("/api/shipments?limit=1000").json()["items"]) == before + 1
    # CSV con separador ; y fecha DD/MM/AAAA
    csv = "origen;destino;carga;cliente;peso_t;salida\nCali;Buenaventura;Azúcar;Ingenio;30;15/11/2026 08:00\n"
    r = client.post("/api/shipments/import",
                    json={"filename": "e.csv", "content_b64": base64.b64encode(csv.encode()).decode()}).json()
    assert r["valid"] == 1 and r["results"][0]["departure_at"].startswith("2026-11-15T08:00")
    # Faltan columnas
    bad = base64.b64encode(b"origen,destino\nBogota,Cali\n").decode()
    assert client.post("/api/shipments/import", json={"filename": "x.csv", "content_b64": bad}).status_code == 422
    t = client.get("/api/shipments/import/template")
    assert t.status_code == 200 and t.content[:2] == b"PK"


def test_tendencias_y_periodo_anterior(client):
    data = client.get("/api/dashboard/summary").json()
    tr = data["trends"]
    assert len(tr["series"]) == 14
    assert tr["series"][-1]["in_transit"] == data["kpis"]["active"]["value"]
    assert set(tr["week_vs_prev"]) == {"in_transit", "delayed", "cost_in_transit", "dispatched", "tons"}
    h = client.get("/api/history?days=7").json()
    assert {"shipments", "tons", "cost", "change_pct"} <= set(h["previous"])


def test_reporte_y_clientes(client):
    r = client.get("/api/reports/operations?days=7")
    assert r.status_code == 200 and r.content[:4] == b"%PDF"
    assert client.get("/api/reports/operations?days=0").status_code == 422
    c = client.get("/api/clients").json()
    assert c["count"] >= 1
    total = sum(x["shipments"] for x in c["items"])
    assert total == len(client.get("/api/shipments?limit=1000").json()["items"])
    first = c["items"][0]
    assert first["cost"] >= c["items"][-1]["cost"] and first["recent"]


def test_trm_oficial(client, monkeypatch):
    from app.engine import fx
    monkeypatch.setattr(fx, "fetch_latest", lambda: {"rate": 3148.02, "date": "2026-10-28"})
    r = client.post("/api/settings/fx/official?usuario=Tester").json()
    assert r["fx"]["rate"] == pytest.approx(3148.02) and "datos.gov.co" in r["fx"]["source"] and r["changed"]
    assert client.post("/api/settings/fx/official").json()["changed"] is False

    def boom():
        raise fx.OperationError("sin conexión")
    monkeypatch.setattr(fx, "fetch_latest", boom)
    assert client.post("/api/settings/fx/official").status_code == 502
