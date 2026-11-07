"""
Robustez de la operación: avisos que no se pierden al cerrar el proceso, plazo del historial y paginación de la lista.
"""
import threading
import time
from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient

import app.database.db as db
import app.init_db as init_db
from app.engine import notify
from app.engine.common import purge_old_audit


@pytest.fixture(scope="module")
def client(tmp_path_factory):
    path = str(tmp_path_factory.mktemp("robustez") / "robustez.db")
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


def test_un_aviso_no_se_pierde_al_cerrar_el_proceso(monkeypatch):
    """send() responde antes de publicar: drenar() espera a que el envío termine (lo que pasa al cerrar el proceso)."""
    enviados = []
    listo = threading.Event()

    def lento(topic, title, message, tags, priority, click):
        time.sleep(0.2)
        enviados.append(title)
        listo.set()

    monkeypatch.setenv("NTFY_TOPIC", "tema-de-prueba")
    monkeypatch.setattr(notify, "_post", lento)
    assert notify.send("Aviso de prueba", "cuerpo") is True
    assert enviados == []                     # todavía no salió: va en un hilo
    assert notify.drenar(timeout=5) >= 1
    assert listo.is_set() and enviados == ["Aviso de prueba"]
    assert notify.drenar() == 0               # ya no queda nada pendiente


def test_sin_tema_no_hay_aviso(monkeypatch):
    monkeypatch.delenv("NTFY_TOPIC", raising=False)
    assert notify.send("x", "y") is False


def test_el_historial_se_recorta_con_el_plazo(client, monkeypatch):
    ahora = datetime.now()
    viejo = (ahora - timedelta(days=100)).isoformat(timespec="seconds")

    def insertar(cuando: str, detalle: str) -> None:
        db.run_write("INSERT INTO audit_log (username, action, table_name, record_id, detail, timestamp) VALUES (?,?,?,?,?,?)",
                     ("prueba", "UPDATE", "mm_shipments", "X", detalle, cuando))

    insertar(viejo, "viejo-1")
    insertar(viejo, "viejo-2")
    insertar(ahora.isoformat(timespec="seconds"), "reciente")

    monkeypatch.delenv("AUDIT_RETENTION_DAYS", raising=False)
    assert purge_old_audit(ahora) == 0                                     # sin plazo, no borra nada
    assert db.run_query("SELECT 1 FROM audit_log WHERE detail = 'viejo-1'").shape[0] == 1

    monkeypatch.setenv("AUDIT_RETENTION_DAYS", "30")
    assert purge_old_audit(ahora) == 2                                     # los dos viejos
    assert db.run_query("SELECT 1 FROM audit_log WHERE detail LIKE 'viejo-%'").empty
    assert not db.run_query("SELECT 1 FROM audit_log WHERE detail = 'reciente'").empty
    assert purge_old_audit(ahora) == 0                                     # la segunda vez no hay nada

    monkeypatch.setenv("AUDIT_RETENTION_DAYS", "no-es-un-numero")
    assert purge_old_audit(ahora) == 0                                     # valor inválido: no borra


def test_la_lista_dice_cuantos_hay_y_no_corta_en_silencio(client):
    todo = client.get("/api/shipments", params={"limit": 1000}).json()
    assert todo["total"] >= todo["count"] > 0
    assert todo["truncated"] is (todo["count"] < todo["total"])

    # Una página pequeña: avisa de que hay más y el desplazamiento funciona
    primera = client.get("/api/shipments", params={"limit": 2}).json()
    assert primera["count"] == 2 and primera["limit"] == 2 and primera["offset"] == 0
    assert primera["truncated"] is True
    segunda = client.get("/api/shipments", params={"limit": 2, "offset": 2}).json()
    assert segunda["offset"] == 2
    assert {i["code"] for i in primera["items"]}.isdisjoint({i["code"] for i in segunda["items"]})

    # El total respeta el filtro de estado
    en_ruta = client.get("/api/shipments", params={"status": "En Ruta", "limit": 1}).json()
    assert en_ruta["total"] == len(client.get("/api/shipments", params={"status": "En Ruta", "limit": 1000}).json()["items"])
