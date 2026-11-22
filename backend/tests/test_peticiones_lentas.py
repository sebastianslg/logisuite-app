"""
Peticiones lentas: dejan un WARNING con método, ruta anónima y milisegundos; las rápidas (o con el umbral alto) no
registran nada. La ruta no puede llevar datos personales. Usan una base SQLite temporal propia, como test_guard.
"""
import logging
import re
import time

import pytest
from fastapi.testclient import TestClient

import app.database.db as db
import app.init_db as init_db
from app import main


@pytest.fixture(scope="module")
def client(tmp_path_factory):
    path = str(tmp_path_factory.mktemp("lentas") / "lentas.db")
    mp = pytest.MonkeyPatch()
    mp.setattr(db, "DB_PATH", path)
    mp.setattr(init_db, "DB_PATH", path)
    main.network.cache_clear()
    main._last_sync = 0.0
    with TestClient(main.app) as c:
        yield c
    main.network.cache_clear()
    mp.undo()


@pytest.fixture
def lento(monkeypatch):
    """Hace que GET /api/locations tarde 50 ms, sin escribir en la base ni esperar a nadie más."""
    red = main.network()

    def tardar():
        time.sleep(0.05)
        return red

    monkeypatch.setattr(main, "network", tardar)
    yield


def _avisos(caplog):
    return [r for r in caplog.records if r.name == "westvane.lento"]


def test_peticion_lenta_deja_un_warning_con_la_ruta_anonima(client, lento, monkeypatch, caplog):
    monkeypatch.setenv("WESTVANE_SLOW_MS", "1")
    with caplog.at_level(logging.WARNING, logger="westvane.lento"):
        r = client.get("/api/locations", params={"cliente": "ana.perez@ejemplo.co"})
    assert r.status_code == 200
    registros = _avisos(caplog)
    assert len(registros) == 1, [r.getMessage() for r in registros]
    aviso = registros[0]
    assert aviso.levelno == logging.WARNING
    texto = aviso.getMessage()
    assert "GET" in texto and "/api/locations" in texto
    assert re.search(r"\d+ ms", texto)
    # Sin query string y sin datos personales: la ruta va anonimizada
    assert "?" not in texto and "ana" not in texto and "ejemplo.co" not in texto


def test_umbral_alto_no_registra_nada(client, lento, monkeypatch, caplog):
    monkeypatch.setenv("WESTVANE_SLOW_MS", "60000")
    with caplog.at_level(logging.WARNING, logger="westvane.lento"):
        assert client.get("/api/locations").status_code == 200
        assert client.get("/api/health").status_code == 200
    assert _avisos(caplog) == []


def test_umbral_cero_apaga_el_registro(client, lento, monkeypatch, caplog):
    monkeypatch.setenv("WESTVANE_SLOW_MS", "0")
    with caplog.at_level(logging.WARNING, logger="westvane.lento"):
        assert client.get("/api/locations").status_code == 200
    assert _avisos(caplog) == []


def test_ruta_anonima_quita_datos_personales():
    # Código de envío: fuera, y las palabras fijas de la ruta se conservan
    assert main.ruta_anonima("/api/shipments/LS-2611-0031") == "/api/shipments/{id}"
    assert main.ruta_anonima("/api/shipments/LS-2611-0031/delivery") == "/api/shipments/{id}/delivery"
    # Ids numéricos
    assert main.ruta_anonima("/api/warehouses/12/stock/SKU-0097") == "/api/warehouses/{id}/stock/{id}"
    assert main.ruta_anonima("/api/shipments/LS-2611-0031/legs/2/vehicles") == "/api/shipments/{id}/legs/{id}/vehicles"
    # Correo
    assert main.ruta_anonima("/api/admin/users/ana.perez@ejemplo.co/role") == "/api/admin/users/{correo}/role"
    # Token del enlace de seguimiento o de exportación
    token = "kQ3fZ9rT2xL8mVbN4pC7wY1sD6hJ0aE5uR"
    assert main.ruta_anonima(f"/api/tracking/{token}") == "/api/tracking/{token}"
    # Texto libre (nombre con mayúsculas y espacios)
    assert main.ruta_anonima("/api/clients/Núñez Hermanos Transportes") == "/api/clients/{texto}"
    # Query string completa fuera, aunque traiga correo y token
    assert main.ruta_anonima("/api/shipments/LS-2611-0031?cliente=ana@ejemplo.co&token=" + token) == "/api/shipments/{id}"
    # Las rutas fijas no se tocan
    assert main.ruta_anonima("/api/network/multimodal") == "/api/network/multimodal"
    assert main.ruta_anonima("/api/tables/vehiculos/export.xlsx") == "/api/tables/vehiculos/export.xlsx"
    assert main.ruta_anonima("/api/v1/shipments") == "/api/v1/shipments"
