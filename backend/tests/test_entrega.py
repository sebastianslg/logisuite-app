"""
Prueba de entrega (POD): registro con firma, validaciones, anulación, remesa en PDF, seguimiento público sin datos
personales y borrado de nombre y firma por plazo de conservación.
"""
import base64
import struct
import zlib
from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient

import app.database.db as db
import app.init_db as init_db
from app.engine import delivery


def png(w=40, h=12) -> str:
    """Un PNG real y pequeño (trazo negro sobre blanco), como el que dibuja el navegador."""
    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    rows = b"".join(b"\x00" + bytes([0 if (x == y * 3) else 255 for x in range(w)]) for y in range(h))
    data = (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 0, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(rows)) + chunk(b"IEND", b""))
    return "data:image/png;base64," + base64.b64encode(data).decode()


@pytest.fixture(scope="module")
def client(tmp_path_factory):
    path = str(tmp_path_factory.mktemp("pod") / "pod.db")
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


def delivered(client, n=0):
    items = client.get("/api/shipments", params={"status": "Entregado"}).json()["items"]
    assert len(items) > n, "la semilla debe tener envíos entregados"
    return items[n]["code"]


def body(**kw):
    return {"received_by": "María Pérez", "condition": "conforme", "signature": png(), "usuario": "Ana", **kw}


def test_envio_sin_llegar_no_admite_entrega(client):
    items = client.get("/api/shipments", params={"status": "Programado"}).json()["items"]
    code = items[0]["code"]
    g = client.get(f"/api/shipments/{code}/delivery").json()
    assert g["arrived"] is False and g["can_record"] is False and g["delivery"] is None
    r = client.put(f"/api/shipments/{code}/delivery", json=body())
    assert r.status_code == 422 and "aún no llega" in r.json()["detail"]


def test_registrar_entrega_con_firma(client):
    code = delivered(client)
    assert client.get(f"/api/shipments/{code}/delivery").json()["can_record"] is True
    r = client.put(f"/api/shipments/{code}/delivery", json=body(notes="Recibido en portería"))
    assert r.status_code == 200, r.text
    d = r.json()["delivery"]
    assert d["received_by"] == "María Pérez" and d["condition_label"] == "Conforme"
    assert d["signature"].startswith("data:image/png;base64,") and d["recorded_by"] == "Ana"
    assert r.json()["can_record"] is False
    log = rows("SELECT * FROM audit_log WHERE record_id = ? AND table_name = 'mm_deliveries'", (code,))
    assert log and "María Pérez" in log[-1]["detail"]
    # una sola por envío
    again = client.put(f"/api/shipments/{code}/delivery", json=body())
    assert again.status_code == 422 and "Anúlala" in again.json()["detail"]


def test_validaciones(client):
    code = delivered(client, 1)
    url = f"/api/shipments/{code}/delivery"
    assert "nombre" in client.put(url, json=body(received_by=" a ")).json()["detail"]
    assert "novedad" in client.put(url, json=body(condition="con_novedad")).json()["detail"]
    assert client.put(url, json=body(signature="data:image/png;base64,PGh0bWw+")).status_code == 422  # HTML disfrazado
    assert client.put(url, json=body(signature="no es una imagen")).status_code == 422
    future = (datetime.now() + timedelta(days=2)).isoformat(timespec="minutes")
    assert "fecha" in client.put(url, json=body(received_at=future)).json()["detail"]
    assert client.put(url, json=body(condition="perdida")).status_code == 422
    assert client.get(url).json()["delivery"] is None  # nada quedó guardado
    ok = client.put(url, json=body(condition="con_novedad", notes="Dos cajas con el empaque roto"))
    assert ok.status_code == 200 and ok.json()["delivery"]["condition_label"] == "Con novedad"


def test_envio_inexistente(client):
    assert client.get("/api/shipments/NO-EXISTE/delivery").status_code == 404
    assert client.put("/api/shipments/NO-EXISTE/delivery", json=body()).status_code == 404


def test_remesa_lleva_la_firma(client):
    code = delivered(client)
    r = client.get(f"/api/shipments/{code}/remesa")
    assert r.status_code == 200 and r.content.startswith(b"%PDF")
    assert b"/Subtype /Image" in r.content  # la firma va incrustada
    sin = client.get(f"/api/shipments/{delivered(client, 2)}/remesa")
    assert sin.status_code == 200 and b"/Subtype /Image" not in sin.content


def test_seguimiento_publico_sin_nombre_ni_firma(client):
    code = delivered(client)
    token = client.post(f"/api/shipments/{code}/tracking", params={"usuario": "Ana"}).json()["token"]
    view = client.get(f"/api/tracking/{token}").json()
    assert view["delivery"]["confirmed"] is True and view["delivery"]["condition_label"] == "Conforme"
    text = str(view)
    assert "María" not in text and "base64" not in text


def test_anular(client):
    code = delivered(client)
    r = client.delete(f"/api/shipments/{code}/delivery", params={"usuario": "Ana"})
    assert r.status_code == 200 and r.json()["delivery"] is None and r.json()["can_record"] is True
    assert client.delete(f"/api/shipments/{code}/delivery").status_code == 422
    log = rows("SELECT detail FROM audit_log WHERE record_id = ? AND action = 'DELETE' AND table_name = 'mm_deliveries'", (code,))
    assert log and "anulada" in log[-1]["detail"]


def test_plazo_de_conservacion_borra_nombre_y_firma(client):
    code = delivered(client, 3)
    old = (datetime.now() - timedelta(days=1)).isoformat(timespec="minutes")
    dep = rows("SELECT departure_at FROM mm_shipments WHERE shipment_code = ?", (code,))[0]["departure_at"]
    at = max(old, dep)
    assert client.put(f"/api/shipments/{code}/delivery", json=body(received_at=at)).status_code == 200
    assert delivery.purge_expired(datetime.now() + timedelta(days=40), 30) >= 1
    d = client.get(f"/api/shipments/{code}/delivery").json()["delivery"]
    assert d["received_by"] is None and d["signature"] is None and d["purged"] is True
    assert d["condition"] == "conforme"  # el estado y las fechas se conservan
    assert delivery.purge_expired(datetime.now(), 0) == 0  # sin plazo no borra nada


def test_borrar_el_envio_borra_su_entrega(client):
    code = delivered(client, 4)
    assert client.put(f"/api/shipments/{code}/delivery", json=body()).status_code == 200
    assert client.delete(f"/api/shipments/{code}", params={"usuario": "Ana"}).status_code == 200
    assert rows("SELECT * FROM mm_deliveries WHERE shipment_code = ?", (code,)) == []
