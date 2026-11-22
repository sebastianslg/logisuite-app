"""
Protecciones de la API: límite de escrituras por cliente, tamaño máximo del cuerpo, adjuntos cuyo contenido no
corresponde a la extensión y documentación oculta en producción. Usan una base SQLite temporal propia.
"""
import base64
import io
import zipfile
from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient

import app.database.db as db
import app.init_db as init_db
from app.api import guard
from app.engine import journal


@pytest.fixture(scope="module")
def client(tmp_path_factory):
    path = str(tmp_path_factory.mktemp("guard") / "guard.db")
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


@pytest.fixture
def limited(monkeypatch):
    monkeypatch.setenv("WESTVANE_RATE_LIMIT", "5")
    guard.reset()
    yield
    guard.reset()


def test_limite_de_escrituras_por_cliente(client, limited):
    # Cinco escrituras se aceptan (aunque fallen por validación); la sexta del mismo cliente recibe 429
    ip = {"x-forwarded-for": "203.0.113.7"}
    for _ in range(5):
        assert client.post("/api/shipments", json={}, headers=ip).status_code == 422
    r = client.post("/api/shipments", json={}, headers=ip)
    assert r.status_code == 429
    assert int(r.headers["retry-after"]) >= 1
    assert "espera" in r.json()["detail"]
    # Otro cliente no se ve afectado, y las lecturas no cuentan
    assert client.post("/api/shipments", json={}, headers={"x-forwarded-for": "198.51.100.2"}).status_code == 422
    assert client.get("/api/health", headers=ip).status_code == 200


def test_el_ingreso_tiene_su_propio_limite_por_ip(client, monkeypatch):
    """10 intentos por minuto y por IP: el 11.º responde 429 con mensaje propio y Retry-After."""
    monkeypatch.setenv("WESTVANE_RATE_LIMIT", "1000")       # el general, alto: aquí se mide el del ingreso
    monkeypatch.setenv("WESTVANE_AUTH_RATE_LIMIT", "10")
    guard.reset()
    ip = {"x-forwarded-for": "203.0.113.40"}
    for _ in range(10):
        r = client.post("/api/auth/password", json={"identifier": "nadie", "password": "x"}, headers=ip)
        assert r.status_code == 422, r.status_code            # credenciales malas: todavía no es 429
    r = client.post("/api/auth/password", json={"identifier": "nadie", "password": "x"}, headers=ip)
    assert r.status_code == 429
    assert "intentos de ingreso" in r.json()["detail"]
    assert int(r.headers["Retry-After"]) >= 1
    # Otra IP no queda castigada
    assert client.post("/api/auth/password", json={"identifier": "nadie", "password": "x"},
                       headers={"x-forwarded-for": "203.0.113.41"}).status_code == 422
    # Pedir código por correo comparte el mismo cubo de ingreso
    assert client.post("/api/auth/otp/request", json={"email": "x@y.co"}, headers=ip).status_code == 429
    guard.reset()


def test_el_limite_del_ingreso_no_afecta_al_resto(client, monkeypatch):
    monkeypatch.setenv("WESTVANE_RATE_LIMIT", "1000")
    monkeypatch.setenv("WESTVANE_AUTH_RATE_LIMIT", "1")
    guard.reset()
    ip = {"x-forwarded-for": "203.0.113.50"}
    assert client.post("/api/auth/password", json={"identifier": "nadie", "password": "x"}, headers=ip).status_code == 422
    assert client.post("/api/auth/password", json={"identifier": "nadie", "password": "x"}, headers=ip).status_code == 429
    # Una escritura normal de la app sigue pasando
    assert client.put("/api/settings/replenish", json={"enabled": False, "usuario": "T"}, headers=ip).status_code == 200
    guard.reset()


def test_el_limite_del_ingreso_se_puede_apagar(client, monkeypatch):
    monkeypatch.setenv("WESTVANE_AUTH_RATE_LIMIT", "0")
    guard.reset()
    ip = {"x-forwarded-for": "203.0.113.60"}
    for _ in range(15):
        assert client.post("/api/auth/password", json={"identifier": "nadie", "password": "x"}, headers=ip).status_code == 422
    guard.reset()


def test_ventana_deslizante():
    guard.reset()
    import os
    os.environ["WESTVANE_RATE_LIMIT"] = "2"
    try:
        assert guard.check_rate("a", "/api/x", now=0) is None
        assert guard.check_rate("a", "/api/x", now=1) is None
        assert guard.check_rate("a", "/api/x", now=2) is not None
        assert guard.check_rate("a", "/api/x", now=61) is None  # la primera ya salió de la ventana
    finally:
        os.environ["WESTVANE_RATE_LIMIT"] = "0"
        guard.reset()


def test_cuerpo_demasiado_grande(client):
    r = client.post("/api/shipments", content=b"{}", headers={"content-type": "application/json",
                                                               "content-length": str(guard.MAX_BODY_BYTES + 1)})
    assert r.status_code == 413


def _code(client):
    body = {"origin": "Bogotá", "destination": "Medellín", "cargo": "Repuestos", "weight_t": 5, "priority": "costo",
            "client": "Guardia", "departure_at": (datetime.now() - timedelta(hours=1)).isoformat(timespec="minutes"),
            "usuario": "Tester"}
    r = client.post("/api/shipments", json=body)
    assert r.status_code == 201, r.text
    return r.json()["code"]


def _post(client, code, name, data):
    return client.post(f"/api/shipments/{code}/attachments",
                       json={"filename": name, "content_b64": base64.b64encode(data).decode(), "autorizado": True})


def _office(folder):
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("[Content_Types].xml", "<Types/>")
        z.writestr(f"{folder}document.xml", "<x/>")
    return buf.getvalue()


def test_adjunto_disfrazado_se_rechaza(client):
    code = _code(client)
    html = b"<html><script>alert(1)</script></html>"
    for name in ("remesa.pdf", "foto.png", "foto.jpg", "foto.webp", "hoja.xlsx", "carta.docx"):
        r = _post(client, code, name, html)
        assert r.status_code == 422, name
        assert "no corresponde" in r.json()["detail"]
    assert _post(client, code, "datos.csv", b"a,b\x00c").status_code == 422
    assert _post(client, code, "otra.xlsx", _office("word/")).status_code == 422  # un Word renombrado


def test_adjuntos_reales_se_aceptan(client):
    code = _code(client)
    ok = {
        "remesa.pdf": b"%PDF-1.7\n...",
        "foto.png": b"\x89PNG\r\n\x1a\n" + b"0" * 20,
        "foto.jpg": b"\xff\xd8\xff\xe0" + b"0" * 20,
        "foto.webp": b"RIFF\x10\x00\x00\x00WEBPVP8 " + b"0" * 8,
        "hoja.xlsx": _office("xl/"),
        "carta.docx": _office("word/"),
        "notas.txt": "Entregar en portería, señor Núñez".encode("utf-8"),
        "lista.csv": "código;peso\nA1;3,5".encode("cp1252"),
    }
    for name, data in ok.items():
        assert _post(client, code, name, data).status_code == 201, name
    assert journal._content_matches(".pdf", b"  %PDF-1.4")


def test_documentacion_oculta_en_produccion(monkeypatch):
    import importlib
    from app import main
    monkeypatch.setenv("WESTVANE_ENV", "production")
    prod = importlib.reload(main)
    try:
        assert prod.app.docs_url is None and prod.app.openapi_url is None
    finally:
        monkeypatch.delenv("WESTVANE_ENV")
        importlib.reload(main)
