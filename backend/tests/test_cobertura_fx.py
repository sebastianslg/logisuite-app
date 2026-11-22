"""
TRM oficial (task B7: cobertura de `app.engine.fx`).

La TRM convierte a pesos todo lo que se cotiza en dólares (peajes incluidos) y se consulta al servicio de datos
abiertos solo cuando alguien lo pide. Aquí se prueba qué hace con una respuesta buena, con una vacía, con una que no
tiene el formato esperado y cuando el servicio no responde; y que la nueva tasa quede en la base, en el historial y en
el motor. La red no se toca: `urlopen` se sustituye por una respuesta de mentira.
"""
import json
import urllib.error
from dataclasses import replace
from datetime import datetime

import pytest

import app.database.db as db
import app.init_db as init_db
from app.engine import fx, tolls
from app.engine import operations as ops
from app.engine.common import OperationError
from app.engine.multimodal import MultimodalNetwork


@pytest.fixture(scope="module")
def base(tmp_path_factory):
    path = str(tmp_path_factory.mktemp("cobertura_trm") / "trm.db")
    mp = pytest.MonkeyPatch()
    mp.setattr(db, "DB_PATH", path)
    mp.setattr(init_db, "DB_PATH", path)
    init_db.init_database()
    yield path
    mp.undo()


class Respuesta:
    """Lo mínimo que `fetch_latest` usa de la respuesta de urllib: leer el cuerpo dentro de un `with`."""

    def __init__(self, cuerpo: bytes):
        self._cuerpo = cuerpo

    def read(self) -> bytes:
        return self._cuerpo

    def __enter__(self):
        return self

    def __exit__(self, *_excepcion):
        return False


def _servicio_responde(monkeypatch, cuerpo) -> list:
    """Sustituye la llamada al servicio; devuelve la lista de peticiones para poder revisarlas."""
    peticiones = []
    datos = cuerpo if isinstance(cuerpo, bytes) else json.dumps(cuerpo).encode("utf-8")

    def urlopen(peticion, timeout=None):
        peticiones.append((peticion.full_url, timeout))
        return Respuesta(datos)

    monkeypatch.setattr(fx.urllib.request, "urlopen", urlopen)
    return peticiones


def _servicio_caido(monkeypatch):
    def urlopen(*_args, **_kwargs):
        raise urllib.error.URLError("sin red")

    monkeypatch.setattr(fx.urllib.request, "urlopen", urlopen)


def _auditoria_trm() -> list:
    return db.fetch_all("SELECT username, detail FROM audit_log WHERE record_id = 'FX_USD_COP' "
                        "ORDER BY audit_id")


class TestLecturaDelServicio:
    """La respuesta de datos.gov.co traducida a {'rate', 'date'}, y sus fallos con mensaje claro."""

    def test_lee_la_ultima_trm_publicada(self, monkeypatch):
        peticiones = _servicio_responde(monkeypatch, [
            {"valor": "3925.55", "vigenciadesde": "2026-11-19T00:00:00.000"}])
        assert fx.fetch_latest() == {"rate": 3925.55, "date": "2026-11-19"}
        # Se pide la más reciente y con un tiempo máximo: la pantalla no puede quedarse colgada
        url, timeout = peticiones[0]
        assert "32sa-8pi3" in url and "DESC" in url and timeout == fx.TIMEOUT_S

    def test_una_respuesta_vacia_lo_dice(self, monkeypatch):
        _servicio_responde(monkeypatch, [])
        with pytest.raises(OperationError) as exc:
            fx.fetch_latest()
        assert "no devolvió datos" in str(exc.value)

    @pytest.mark.parametrize("cuerpo", [[{"otro_campo": 1}], [{"valor": "no-es-un-numero", "vigenciadesde": "2026-11-19"}]])
    def test_una_respuesta_con_otro_formato_lo_dice(self, monkeypatch, cuerpo):
        _servicio_responde(monkeypatch, cuerpo)
        with pytest.raises(OperationError) as exc:
            fx.fetch_latest()
        assert "formato esperado" in str(exc.value)

    def test_un_cuerpo_que_no_es_json_lo_dice(self, monkeypatch):
        _servicio_responde(monkeypatch, b"<html>mantenimiento</html>")
        with pytest.raises(OperationError) as exc:
            fx.fetch_latest()
        assert "No se pudo consultar la TRM oficial" in str(exc.value)

    def test_sin_conexion_avisa_y_no_inventa_una_tasa(self, monkeypatch, base):
        antes = ops.get_fx()
        _servicio_caido(monkeypatch)
        with pytest.raises(OperationError) as exc:
            fx.update_from_official("Tester")
        assert "No se pudo consultar la TRM oficial" in str(exc.value) and "a mano" in str(exc.value)
        assert ops.get_fx() == antes, "si la consulta falla, la TRM guardada no se toca"


class TestActualizacion:
    """Guardar la TRM nueva: cuándo escribe, cuándo no, y qué queda en el historial."""

    def test_guarda_la_trm_y_la_firma_en_el_historial(self, monkeypatch, base):
        _servicio_responde(monkeypatch, [{"valor": "4123.45", "vigenciadesde": "2026-11-20T00:00:00"}])
        res = fx.update_from_official("Tester")
        assert res["changed"] is True
        assert res["fx"]["rate"] == 4123.45 and res["fx"]["date"] == "2026-11-20"
        assert res["fx"]["source"] == fx.SOURCE
        assert ops.get_fx() == res["fx"]
        log = _auditoria_trm()[-1]
        assert log["username"] == "Tester"
        assert log["detail"].startswith("TRM ") and "4123.45" in log["detail"]
        assert "2026-11-20" in log["detail"] and fx.SOURCE in log["detail"]

    def test_si_la_trm_no_cambio_no_escribe_ni_registra(self, monkeypatch, base):
        _servicio_responde(monkeypatch, [{"valor": "3999.99", "vigenciadesde": "2026-11-19T00:00:00"}])
        assert fx.update_from_official("Tester")["changed"] is True
        antes = len(_auditoria_trm())
        # La misma respuesta otra vez: no hay nada nuevo que guardar ni que registrar
        repetida = fx.update_from_official("Tester")
        assert repetida["changed"] is False and repetida["fx"]["rate"] == 3999.99
        assert len(_auditoria_trm()) == antes, "una TRM repetida no se vuelve a registrar"

    def test_la_trm_guardada_es_la_que_usa_el_motor_para_los_peajes(self, monkeypatch, base):
        _servicio_responde(monkeypatch, [{"valor": "4050", "vigenciadesde": "2026-11-21T00:00:00"}])
        fx.update_from_official("Tester")
        red = MultimodalNetwork.from_db()
        assert red.fx == pytest.approx(4050.0)
        # Un peaje cargado en pesos se cobra según esta TRM: con el doble de tasa, el mismo peaje vale la mitad
        ruta = red.route("Bogotá", "Cartagena", 10, "tiempo", allowed_modes={"terrestre"})
        seg = ruta["legs"][0]["segments"][0]
        enlace = next(l for l in red.links if l["mode"] == "terrestre" and l["corridor"] == seg["corridor"]
                      and {l["origin_code"], l["dest_code"]} == {seg["from"], seg["to"]})
        tolls.update_toll(int(enlace["link_id"]), 405_000, None, None, "Tester")
        con_4050 = MultimodalNetwork.from_db().route("Bogotá", "Cartagena", 10, "tiempo",
                                                     allowed_modes={"terrestre"})
        con_8100 = replace(MultimodalNetwork.from_db(), fx=8100.0).route(
            "Bogotá", "Cartagena", 10, "tiempo", allowed_modes={"terrestre"})
        assert con_4050["cost_breakdown"]["peajes"] > 0
        assert con_8100["cost_breakdown"]["peajes"] == pytest.approx(
            con_4050["cost_breakdown"]["peajes"] / 2, rel=1e-9)


class TestSinRegresiones:
    """Detalles que no deben cambiar: la fecha de la TRM y el formato del número que se guarda."""

    def test_la_fecha_llega_sin_hora(self, monkeypatch):
        _servicio_responde(monkeypatch, [{"valor": "3900", "vigenciadesde": "2026-11-21T00:00:00.000"}])
        assert fx.fetch_latest()["date"] == "2026-11-21"

    def test_la_trm_se_guarda_sin_decimales_inutiles(self, monkeypatch, base):
        _servicio_responde(monkeypatch, [{"valor": "3900.0", "vigenciadesde": "2026-11-22T00:00:00"}])
        fx.update_from_official("Tester")
        guardado = db.fetch_all("SELECT param_value FROM system_params WHERE param_key = 'FX_DATE'")[0]
        assert guardado["param_value"] == "2026-11-22"
        # El valor se guarda con formato compacto (3900, no 3900.0): es el que muestran la API y los PDF
        valor = db.fetch_all("SELECT param_value FROM system_params WHERE param_key = 'FX_USD_COP'")[0]
        assert valor["param_value"] == "3900"
        assert datetime.fromisoformat(ops.get_fx()["date"]).year == 2026
