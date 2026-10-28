"""Avisos ntfy: solo con NTFY_TOPIC, en JSON (tildes en el título) y sin bloquear ni romper la operación."""
import json
import threading

from app.engine import notify


def test_sin_tema_no_envia(monkeypatch):
    monkeypatch.delenv("NTFY_TOPIC", raising=False)
    assert notify.send("Hola", "x") is False


def test_envia_json_con_enlace(monkeypatch):
    sent = {}
    done = threading.Event()

    class Resp:
        def close(self):
            pass

    def fake_urlopen(req, timeout):
        sent["url"] = req.full_url
        sent["body"] = json.loads(req.data.decode("utf-8"))
        done.set()
        return Resp()

    monkeypatch.setenv("NTFY_TOPIC", "westvane-prueba")
    monkeypatch.setenv("DOMAIN", "ejemplo.org")
    monkeypatch.setattr(notify.urllib.request, "urlopen", fake_urlopen)
    assert notify.send("Incidencia: Falla mecánica", "Bogotá -> Cali", tags="rotating_light", priority="high", path="/envios/LS-1")
    assert done.wait(5)
    b = sent["body"]
    assert b["topic"] == "westvane-prueba" and b["title"] == "Incidencia: Falla mecánica"
    assert b["priority"] == 4 and b["click"] == "https://ejemplo.org/envios/LS-1"


def test_un_fallo_de_red_no_rompe(monkeypatch):
    done = threading.Event()

    def boom(req, timeout):
        done.set()
        raise OSError("sin red")

    monkeypatch.setenv("NTFY_TOPIC", "t")
    monkeypatch.setattr(notify.urllib.request, "urlopen", boom)
    assert notify.send("a", "b")
    assert done.wait(5)
