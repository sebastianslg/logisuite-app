"""
Pruebas del motor multimodal (grafo expandido por modo con transbordos).
Ejecución: pytest -v  (desde backend/)
"""
import json
from datetime import datetime, timedelta

import pytest

from app.database.db import db_exists
from app.init_db import init_database


@pytest.fixture(scope="module")
def net():
    if not db_exists():
        init_database(reset=False)
    from app.engine.multimodal import MultimodalNetwork
    return MultimodalNetwork.from_db()


def _legs(r):
    return [(l["mode"], l["from"]["code"], l["to"]["code"]) for l in r["legs"]]


class TestRedColombia:

    def test_cubre_los_cinco_modos(self, net):
        assert {l["mode"] for l in net.links} == {"terrestre", "fluvial", "maritimo", "aereo", "ferreo"}

    def test_incluye_los_hubs_y_corredores_pedidos(self, net):
        for code in ("PORT-CTG", "PORT-BUN", "PORT-BAQ", "RIV-LET", "BOG-AIR", "CTG-AIR", "LET-AIR",
                     "RAIL-CHI"):
            assert code in net.nodes
        corredores = {l["corridor"] for l in net.links}
        for c in ("Ruta del Sol", "Troncal del Magdalena", "Troncal de Occidente", "Río Magdalena",
                  "Corredor férreo Fenoco", "Ríos Amazonas y Putumayo"):
            assert c in corredores

    def test_los_trazados_empiezan_y_terminan_en_sus_nodos(self, net):
        for l in net.links:
            o, d = net.nodes[l["origin_code"]], net.nodes[l["dest_code"]]
            assert l["geometry"][0] == pytest.approx([o["longitude"], o["latitude"]], abs=1e-3)
            assert l["geometry"][-1] == pytest.approx([d["longitude"], d["latitude"]], abs=1e-3)


class TestEnrutamientoMultimodal:

    def test_leticia_cartagena_por_tiempo_vuela_con_escala_en_bogota(self, net):
        r = net.route("Leticia", "Cartagena", 5, "tiempo")
        assert _legs(r) == [("aereo", "LET-AIR", "BOG-AIR"), ("aereo", "BOG-AIR", "CTG-AIR")]
        # La escala es una conexión real, no un "paso" gratuito por El Dorado
        assert r["n_transfers"] == 1
        assert r["transfers"][0]["node"]["code"] == "BOG-AIR"

    def test_leticia_cartagena_balanceado_vuela_y_transborda_a_carretera(self, net):
        r = net.route("Leticia", "Cartagena", 5, "balanceado")
        assert r["modes"] == ["aereo", "terrestre"]
        assert r["legs"][0]["to"]["code"] == "BOG-AIR"
        t = r["transfers"][0]
        assert (t["from_mode"], t["to_mode"]) == ("aereo", "terrestre")

    def test_leticia_cartagena_por_costo_usa_el_rio(self, net):
        r = net.route("Leticia", "Cartagena", 5, "costo")
        assert r["modes"][0] == "fluvial"

    def test_cada_prioridad_es_optima_en_su_propio_criterio(self, net):
        rutas = {p: net.route("Leticia", "Cartagena", 5, p) for p in ("tiempo", "costo", "balanceado")}
        assert rutas["tiempo"]["time_h"] <= min(r["time_h"] for r in rutas.values()) + 1e-9
        assert rutas["costo"]["cost"] <= min(r["cost"] for r in rutas.values()) + 1e-9

    def test_la_capacidad_del_avion_excluye_cargas_mayores(self, net):
        r = net.route("Leticia", "Cartagena", 30, "tiempo")
        assert ("aereo", "LET-AIR", "BOG-AIR") not in _legs(r)

    def test_los_totales_cuadran_con_tramos_y_transbordos(self, net):
        r = net.route("Leticia", "Cartagena", 5, "balanceado")
        tiempo = sum(l["time_h"] for l in r["legs"]) + sum(t["time_h"] for t in r["transfers"])
        costo = sum(l["cost"] for l in r["legs"]) + sum(t["cost"] for t in r["transfers"])
        assert r["time_h"] == pytest.approx(tiempo)
        assert r["cost"] == pytest.approx(costo)

    def test_la_linea_de_tiempo_es_monotona_y_cierra_en_el_total(self, net):
        r = net.route("Leticia", "Cartagena", 5, "balanceado")
        ts = [p["t_h"] for p in r["timeline"]]
        assert ts == sorted(ts)
        assert ts[-1] == pytest.approx(r["time_h"])

    def test_carbon_al_puerto_va_por_ferrocarril(self, net):
        assert net.route("Chiriguaná", "Santa Marta", 2000, "costo")["modes"] == ["ferreo"]

    def test_granel_por_el_magdalena(self, net):
        r = net.route("Barrancabermeja", "Cartagena", 900, "costo")
        assert r["modes"] == ["fluvial"]
        assert "Canal del Dique" in r["legs"][0]["corridors"]

    def test_ubicacion_desconocida_falla_con_mensaje_claro(self, net):
        from app.engine.multimodal import RoutingError
        with pytest.raises(RoutingError):
            net.route("Atlántida", "Cartagena", 5, "tiempo")


class TestEstadoDeEnvios:

    def _envio(self, net, delay=0.0):
        from app.engine.dispatch import build_shipment
        import random
        t = ("Leticia", "Cartagena", "Prueba", 5, 5, "balanceado", "Cliente")
        return build_shipment(net, t, datetime(2026, 1, 1, 8, 0), 1, random.Random(1), delay)

    def test_ciclo_de_vida(self, net):
        from app.engine.dispatch import status_at
        s = self._envio(net)
        salida = datetime.fromisoformat(s["departure_at"])
        route = json.loads(s["route_json"])
        tr = route["transfers"][0]
        assert status_at(s, salida - timedelta(hours=1))["status"] == "Programado"
        assert status_at(s, salida + timedelta(hours=1))["status"] == "En Ruta"
        en_transbordo = salida + timedelta(hours=tr["start_h"] + tr["time_h"] / 2)
        assert status_at(s, en_transbordo)["status"] == "Transferencia Modal"
        fin = salida + timedelta(hours=s["total_time_h"] + 0.1)
        assert status_at(s, fin)["status"] == "Entregado"

    def test_el_retraso_posterga_la_entrega(self, net):
        from app.engine.dispatch import status_at
        s = self._envio(net, delay=10)
        salida = datetime.fromisoformat(s["departure_at"])
        tras_eta = salida + timedelta(hours=s["total_time_h"] + 5)
        assert status_at(s, tras_eta)["status"] in ("Retrasado", "Transferencia Modal")
        assert status_at(s, tras_eta + timedelta(hours=6))["status"] == "Entregado"
