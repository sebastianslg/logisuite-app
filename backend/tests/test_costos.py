"""
Pruebas del desglose de costos: fletes, peajes, manipulación e impuestos.
Usan la red de la base (o la sembrada) y cambian solo la TRM, los peajes y el impuesto.
Ejecución: pytest -v  (desde backend/)
"""
import copy
from dataclasses import replace

import pytest

from app.database.db import db_exists
from app.init_db import init_database


@pytest.fixture(scope="module")
def red():
    if not db_exists():
        init_database(reset=False)
    from app.engine.multimodal import MultimodalNetwork
    return MultimodalNetwork.from_db()


def _con(red, fx=None, tolls_cop=0.0, tax_rate=0.0):
    """Copia de la red con TRM, peajes por tramo terrestre y tasa de impuesto indicados."""
    links = []
    for l in red.links:
        l2 = copy.copy(l)
        if l2["mode"] == "terrestre":
            l2["tolls_cop"] = tolls_cop
        links.append(l2)
    return replace(red, links=links, fx=fx, tax_rate=tax_rate)


def _ruta(red, weight_t=10.0):
    r = red.route("Bogotá", "Cartagena", weight_t)
    assert r["found"], r
    return r


class TestDesglose:

    def test_las_partes_suman_el_total(self, red):
        r = _ruta(_con(red, fx=4000, tolls_cop=200000, tax_rate=0.19))
        b = r["cost_breakdown"]
        assert b["fletes"] + b["peajes"] + b["manipulacion"] + b["impuestos"] == pytest.approx(b["total"], rel=1e-9)
        assert b["total"] == pytest.approx(r["cost"], rel=1e-9)

    def test_sin_trm_los_peajes_no_se_convierten(self, red):
        r = _ruta(_con(red, fx=None, tolls_cop=200000))
        assert r["cost_breakdown"]["peajes"] == 0

    def test_peajes_se_convierten_con_la_trm_por_cada_tramo_terrestre(self, red):
        r = _ruta(_con(red, fx=4000, tolls_cop=400000))
        enlaces = [s for l in r["legs"] if l["mode"] == "terrestre" for s in l["segments"]]
        assert enlaces, "la ruta debe usar al menos un enlace terrestre"
        # 400 000 COP / 4 000 COP por USD = 100 USD por cada enlace terrestre recorrido
        assert r["cost_breakdown"]["peajes"] == pytest.approx(100 * len(enlaces), rel=1e-9)

    def test_impuesto_es_porcentaje_del_flete_y_la_manipulacion(self, red):
        r = _ruta(_con(red, fx=None, tolls_cop=0, tax_rate=0.19))
        b = r["cost_breakdown"]
        assert b["impuestos"] == pytest.approx(0.19 * (b["fletes"] + b["manipulacion"]), rel=1e-9)

    def test_sin_impuesto_ni_peajes_el_total_es_solo_flete(self, red):
        r = _ruta(_con(red, fx=None, tolls_cop=0, tax_rate=0.0))
        b = r["cost_breakdown"]
        assert b["peajes"] == 0 and b["impuestos"] == 0
        assert b["total"] == pytest.approx(b["fletes"] + b["manipulacion"], rel=1e-9)
