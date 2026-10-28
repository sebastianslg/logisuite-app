"""
Documentos legales y registro de aceptaciones: versiones vigentes, datos del responsable desde el entorno,
aceptación con prueba (texto de la casilla, formulario, resumen de IP), revocación, exportación y la
declaración de autorización obligatoria al subir adjuntos o importar. Base SQLite temporal propia.
"""
import base64
import csv
import io
from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient

import app.database.db as db
import app.init_db as init_db
from app.engine import legal

BID = "nav-0123456789abcdef"


@pytest.fixture(scope="module")
def client(tmp_path_factory):
    path = str(tmp_path_factory.mktemp("legal") / "legal.db")
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


def _accept(client, docs=("terminos", "privacidad"), accepted=True, bid=BID, ip="203.0.113.9"):
    items = [{"document": d, "version": legal.VERSIONS[d], "accepted": accepted, "text": f"Acepto {d}"} for d in docs]
    return client.post("/api/consents", json={"browser_id": bid, "subject": "Ana Pérez", "context": "primer_uso",
                                              "items": items}, headers={"x-forwarded-for": ip, "user-agent": "Prueba/1.0"})


def test_info_y_responsable_desde_el_entorno(client, monkeypatch):
    for k in legal.RESPONSIBLE_FIELDS:
        monkeypatch.delenv(k, raising=False)
    info = client.get("/api/legal").json()
    assert info["versions"]["terminos"] and info["required"] == ["terminos", "privacidad"]
    assert info["responsible"]["complete"] is False
    monkeypatch.setenv("LEGAL_NAME", "Westvane S.A.S.")
    monkeypatch.setenv("LEGAL_ID", "900.000.000-1")
    monkeypatch.setenv("LEGAL_CITY", "Bogotá")
    monkeypatch.setenv("LEGAL_EMAIL", "datos@ejemplo.co")
    assert legal.responsible()["complete"] is True


def test_sin_aceptar_queda_pendiente(client):
    st = client.get("/api/consents", params={"browser_id": "nav-nuevo-0000000001"}).json()
    assert st["pending"] == ["terminos", "privacidad"]


def test_aceptar_guarda_la_prueba_sin_la_ip(client):
    st = _accept(client)
    assert st.status_code == 201 and st.json()["pending"] == []
    rows = list(csv.DictReader(io.StringIO(client.get("/api/consents/export").text)))
    mine = [r for r in rows if r["browser_id"] == BID]
    assert {r["document"] for r in mine} == {"terminos", "privacidad"}
    r = mine[0]
    assert r["subject"] == "Ana Pérez" and r["context"] == "primer_uso" and r["checkbox_text"].startswith("Acepto")
    assert r["user_agent"] == "Prueba/1.0" and r["accepted"] == "1"
    assert r["ip_hash"] and "203.0.113.9" not in client.get("/api/consents/export").text
    # La misma IP da el mismo resumen (sirve como prueba) y otra IP, otro distinto
    assert legal.ip_hash("203.0.113.9") == r["ip_hash"] != legal.ip_hash("198.51.100.1")


def test_revocar_vuelve_a_pedir(client):
    assert _accept(client, docs=("privacidad",), accepted=False).json()["pending"] == ["privacidad"]
    assert _accept(client, docs=("privacidad",)).json()["pending"] == []


def test_version_vencida_o_documento_desconocido(client):
    bad = client.post("/api/consents", json={"browser_id": BID, "context": "primer_uso",
                                             "items": [{"document": "terminos", "version": "2000-01-01", "text": "x"}]})
    assert bad.status_code == 422 and "vigente" in bad.json()["detail"]
    assert client.post("/api/consents", json={"browser_id": BID, "context": "primer_uso",
                                              "items": [{"document": "otro", "text": "x"}]}).status_code == 422
    assert client.post("/api/consents", json={"browser_id": "corto!", "context": "primer_uso",
                                              "items": [{"document": "terminos", "text": "x"}]}).status_code == 422
    assert client.post("/api/consents", json={"browser_id": BID, "context": "otro",
                                              "items": [{"document": "terminos", "text": "x"}]}).status_code == 422


def test_adjuntos_e_importacion_exigen_la_declaracion(client):
    body = {"origin": "Bogotá", "destination": "Medellín", "cargo": "Repuestos", "weight_t": 5, "priority": "costo",
            "client": "Legal", "departure_at": (datetime.now() - timedelta(hours=1)).isoformat(timespec="minutes")}
    code = client.post("/api/shipments", json=body).json()["code"]
    pdf = base64.b64encode(b"%PDF-1.4 x").decode()
    r = client.post(f"/api/shipments/{code}/attachments", json={"filename": "r.pdf", "content_b64": pdf})
    assert r.status_code == 422 and "autorización" in r.json()["detail"]
    assert client.post(f"/api/shipments/{code}/attachments",
                       json={"filename": "r.pdf", "content_b64": pdf, "autorizado": True}).status_code == 201
    csv_b64 = base64.b64encode("origen;destino;carga;cliente;peso_t;salida\nCali;Buenaventura;Azúcar;Ingenio;30;15/11/2026 08:00\n".encode()).decode()
    assert client.post("/api/shipments/import", json={"filename": "e.csv", "content_b64": csv_b64, "commit": True}).status_code == 422
    # La vista previa no guarda nada: no la necesita
    assert client.post("/api/shipments/import", json={"filename": "e.csv", "content_b64": csv_b64}).status_code == 200


def test_plazo_de_conservacion_de_adjuntos(client, monkeypatch):
    from app.engine import journal
    body = {"origin": "Bogotá", "destination": "Cali", "cargo": "X", "weight_t": 3, "priority": "costo", "client": "Plazo",
            "departure_at": (datetime.now() - timedelta(days=40)).isoformat(timespec="minutes")}
    code = client.post("/api/shipments", json=body).json()["code"]
    pdf = base64.b64encode(b"%PDF-1.4 x").decode()
    assert client.post(f"/api/shipments/{code}/attachments", json={"filename": "a.pdf", "content_b64": pdf, "autorizado": True}).status_code == 201
    monkeypatch.setenv("ATTACHMENT_RETENTION_DAYS", "0")
    assert journal.purge_expired(datetime.now()) == 0  # sin plazo no se borra nada
    client.get("/api/shipments")  # sincroniza: el envío de hace 40 días ya está entregado
    monkeypatch.setenv("ATTACHMENT_RETENTION_DAYS", "30")
    assert journal.purge_expired(datetime.now()) >= 1
    assert client.get(f"/api/shipments/{code}/attachments").json()["count"] == 0
