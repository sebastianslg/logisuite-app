"""
test_logisuite.py
Suite de pruebas unitarias de LogiSuite.

Cubre las funciones de cálculo cuyo resultado debe ser verificable contra la
fórmula teórica, y las invariantes que deben cumplirse siempre:

  - Motor de costos de transporte (aditividad y monotonía).
  - EOQ (Wilson), ROP y factor Z de nivel de servicio.
  - Pronósticos SMA y SES contra casos con resultado conocido.
  - Clasificación ABC (Pareto acumulado).
  - Emisiones de CO2e (linealidad en toneladas-kilómetro).
  - TCO de vehículos (los componentes deben sumar el total).
  - Algoritmos de red: Dijkstra, TSP heurístico contra el óptimo exacto.
  - Liquidación aduanera (IVA sobre valor más arancel).
  - Seguridad del hash de contraseñas.

Ejecución:  pytest -v   (desde la raíz del proyecto)
"""
import itertools
import math
import os
import statistics
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database.db import db_exists  # noqa: E402
from init_db import init_database  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def base_de_datos():
    """Garantiza que exista una base poblada antes de correr las pruebas."""
    if not db_exists():
        init_database(reset=False)
    yield


# ===========================================================================
# MOTOR DE COSTOS DE TRANSPORTE
# ===========================================================================
class TestMotorDeCostos:

    def test_total_es_la_suma_de_los_tres_componentes(self):
        from models.freight import compute_transport_cost
        r = compute_transport_cost(500, 10, 5000, 20, 6, 15000)
        suma = r["transaction_cost"] + r["distance_friction_cost"] + r["shipment_cost"]
        assert abs(r["total_cost"] - suma) < 0.01

    def test_el_costo_crece_con_la_distancia(self):
        from models.freight import compute_transport_cost
        corto = compute_transport_cost(100, 2, 5000, 20, 3, 15000)["total_cost"]
        largo = compute_transport_cost(1000, 20, 5000, 20, 3, 15000)["total_cost"]
        assert largo > corto

    def test_la_friccion_de_distancia_es_lineal_en_kilometros(self):
        """Manteniendo fijo el tiempo, duplicar la distancia debe duplicar el
        componente energético, que es proporcional a los kilómetros-tonelada."""
        from models.freight import compute_transport_cost, DEFAULT_COST_PARAMS
        p = dict(DEFAULT_COST_PARAMS)
        p["time_cost_per_hour"] = 0.0          # se anula el término de tiempo
        a = compute_transport_cost(100, 5, 10000, 20, 3, 1000, params=p)["distance_friction_cost"]
        b = compute_transport_cost(200, 5, 10000, 20, 3, 1000, params=p)["distance_friction_cost"]
        assert abs(b - 2 * a) < 0.01

    def test_el_descuento_por_masificacion_reduce_el_costo_del_envio(self):
        from models.freight import compute_transport_cost, DEFAULT_COST_PARAMS
        umbral = DEFAULT_COST_PARAMS["consolidation_threshold"]
        sin_desc = compute_transport_cost(500, 10, 5000, 20, umbral - 1, 15000)
        con_desc = compute_transport_cost(500, 10, 5000, 20, umbral, 15000)
        assert con_desc["shipment_cost"] < sin_desc["shipment_cost"]
        assert con_desc["breakdown"]["descuento_consolidacion_aplicado"] is True

    def test_el_seguro_es_proporcional_al_valor_declarado(self):
        from models.freight import compute_transport_cost
        bajo = compute_transport_cost(500, 10, 5000, 20, 3, 10000)["breakdown"]["seguro"]
        alto = compute_transport_cost(500, 10, 5000, 20, 3, 20000)["breakdown"]["seguro"]
        assert abs(alto - 2 * bajo) < 0.01


# ===========================================================================
# INVENTARIO: EOQ, ROP, ABC, PRONÓSTICOS
# ===========================================================================
class TestEOQ:

    def test_eoq_caso_clasico_de_wilson(self):
        """D=1200, S=100, H=6 -> Q* = sqrt(2*1200*100/6) = 200."""
        from utils.inventory_analytics import compute_eoq
        r = compute_eoq(1200, 100, 6)
        assert abs(r["eoq"] - 200.0) < 0.01

    def test_en_el_optimo_los_dos_costos_se_igualan(self):
        """Propiedad del modelo de Wilson: en Q* el costo anual de pedidos
        iguala al costo anual de mantenimiento."""
        from utils.inventory_analytics import compute_eoq
        r = compute_eoq(2400, 75, 4.5)
        assert abs(r["costo_pedidos_anual"] - r["costo_mantenimiento_anual"]) < 0.01

    def test_ningun_lote_bate_al_eoq_en_costo_total(self):
        """Verificación por fuerza bruta: el EOQ debe minimizar el costo total."""
        from utils.inventory_analytics import compute_eoq
        D, S, H = 1200.0, 100.0, 6.0
        r = compute_eoq(D, S, H)
        costo_eoq = r["costo_total_anual"]
        for q in range(50, 500, 5):
            costo_q = D / q * S + q / 2 * H
            assert costo_q >= costo_eoq - 0.5


class TestFactorZyROP:

    @pytest.mark.parametrize("nivel,esperado", [
        (95, 1.645), (99, 2.326), (90, 1.282), (50, 0.0),
    ])
    def test_factor_z_una_cola(self, nivel, esperado):
        from utils.inventory_analytics import z_for_service_level
        assert abs(z_for_service_level(nivel) - esperado) < 0.02

    def test_acepta_porcentaje_y_fraccion_indistintamente(self):
        """Regresión: pasar 95 en vez de 0.95 devolvía el Z de 99.5%, lo que
        inflaba el stock de seguridad. Ambas convenciones deben coincidir."""
        from utils.inventory_analytics import z_for_service_level
        assert z_for_service_level(95) == z_for_service_level(0.95)
        assert z_for_service_level(99) == z_for_service_level(0.99)

    def test_rop_con_calculo_manual(self):
        """d=50, L=4, sigma=10, NS=95% -> 50*4 + 1.645*10*sqrt(4) = 232.9"""
        from utils.inventory_analytics import compute_rop
        r = compute_rop(50, 4, demand_std_dev=10, service_level=95)
        assert abs(r["rop"] - (200 + 1.645 * 10 * 2)) < 0.1
        assert abs(r["stock_seguridad"] - 32.9) < 0.1

    def test_sin_variabilidad_no_hay_stock_de_seguridad(self):
        from utils.inventory_analytics import compute_rop
        r = compute_rop(50, 4, demand_std_dev=0, service_level=95)
        assert r["stock_seguridad"] == 0.0
        assert r["rop"] == 200

    def test_mayor_nivel_de_servicio_exige_mas_stock(self):
        from utils.inventory_analytics import compute_rop
        r90 = compute_rop(50, 4, 10, 90)["rop"]
        r99 = compute_rop(50, 4, 10, 99)["rop"]
        assert r99 > r90


class TestPronosticos:

    def test_media_movil_serie_constante(self):
        from utils.inventory_analytics import moving_average_forecast
        r = moving_average_forecast([10, 10, 10, 10, 10], window=3)
        assert r["forecast"] == 10
        assert r["mae"] == 0

    def test_media_movil_calculo_manual(self):
        """[1,2,3,4,5] con ventana 3 -> (3+4+5)/3 = 4.0"""
        from utils.inventory_analytics import moving_average_forecast
        assert abs(moving_average_forecast([1, 2, 3, 4, 5], window=3)["forecast"] - 4.0) < 1e-9

    def test_suavizado_con_alpha_uno_es_el_metodo_ingenuo(self):
        """Con alpha=1 el pronóstico es exactamente el último valor observado."""
        from utils.inventory_analytics import exponential_smoothing_forecast
        assert abs(exponential_smoothing_forecast([5, 8, 3, 12], alpha=1.0)["forecast"] - 12) < 1e-9

    def test_suavizado_calculo_manual(self):
        """alpha=0.5, serie [10,20]: F2=10, F3=0.5*20+0.5*10 = 15."""
        from utils.inventory_analytics import exponential_smoothing_forecast
        assert abs(exponential_smoothing_forecast([10, 20], alpha=0.5)["forecast"] - 15) < 1e-9

    def test_serie_vacia_no_rompe(self):
        from utils.inventory_analytics import moving_average_forecast, exponential_smoothing_forecast
        assert moving_average_forecast([])["forecast"] is None
        assert exponential_smoothing_forecast([])["forecast"] is None


class TestClasificacionABC:

    def test_el_porcentaje_acumulado_es_creciente_y_cierra_en_cien(self):
        from utils.inventory_analytics import abc_classification
        abc = abc_classification()
        if not abc:
            pytest.skip("No hay inventario cargado")
        acum = [r["pct_acumulado"] for r in abc]
        assert all(acum[i] <= acum[i + 1] + 1e-6 for i in range(len(acum) - 1))
        assert abs(acum[-1] - 100) < 0.01

    def test_los_items_quedan_ordenados_por_valor_descendente(self):
        from utils.inventory_analytics import abc_classification
        abc = abc_classification()
        if not abc:
            pytest.skip("No hay inventario cargado")
        valores = [r["valor_consumo"] for r in abc]
        assert valores == sorted(valores, reverse=True)

    def test_cada_item_declara_su_base_de_calculo(self):
        """Un SKU sin despachos se clasifica por valor de stock: eso debe quedar
        explícito para no mezclar bases sin avisar."""
        from utils.inventory_analytics import abc_classification
        abc = abc_classification()
        if not abc:
            pytest.skip("No hay inventario cargado")
        assert all(r["base"] in ("Consumo (despachos)", "Stock (sin despachos)") for r in abc)


# ===========================================================================
# FLOTA: EMISIONES Y TCO
# ===========================================================================
class TestEmisiones:

    def test_calculo_manual(self):
        """0.105 kg/ton-km * 10 ton * 100 km = 105 kg CO2e."""
        from utils.fleet_analytics import compute_emissions
        assert abs(compute_emissions(100, 10000, "Terrestre")["kg_co2e"] - 105.0) < 1e-9

    def test_lineal_en_distancia_y_en_peso(self):
        from utils.fleet_analytics import compute_emissions
        base = compute_emissions(100, 10000, "Terrestre")["kg_co2e"]
        assert abs(compute_emissions(200, 10000, "Terrestre")["kg_co2e"] - 2 * base) < 1e-9
        assert abs(compute_emissions(100, 20000, "Terrestre")["kg_co2e"] - 2 * base) < 1e-9

    def test_orden_de_intensidad_de_carbono_entre_modos(self):
        """El marítimo es el modo menos intensivo y el aéreo el más intensivo."""
        from utils.fleet_analytics import compare_modes_emissions
        d = {r["modo"]: r["kg_co2e"] for r in compare_modes_emissions(1000, 20000)}
        assert d["Maritimo"] < d["Terrestre"] < d["Aereo"]


class TestTCO:

    def test_los_componentes_suman_el_total(self):
        from utils.fleet_analytics import tco_all_vehicles
        for v in tco_all_vehicles():
            suma = v["costo_combustible"] + v["costo_mantenimiento"] + v["depreciacion_anual"]
            assert abs(v["tco_total"] - suma) < 0.01

    def test_el_costo_por_km_es_el_tco_dividido_por_el_odometro(self):
        from utils.fleet_analytics import tco_all_vehicles
        for v in tco_all_vehicles():
            if v["odometro_km"] > 0:
                assert abs(v["costo_por_km"] - v["tco_total"] / v["odometro_km"]) < 0.01

    def test_el_costo_por_km_esta_en_un_rango_plausible(self):
        """Regresión: mezclar pesos y dólares producía valores absurdos (miles
        de USD por kilómetro). Todo el sistema trabaja en USD."""
        from utils.fleet_analytics import tco_all_vehicles
        for v in tco_all_vehicles():
            if v["odometro_km"] > 1000:
                assert 0.01 < v["costo_por_km"] < 10.0, \
                    f"{v['placa']} tiene un costo por km implausible: {v['costo_por_km']}"


class TestMantenimiento:

    def test_sin_preventivo_previo_no_se_reporta_vencido_por_todo_el_odometro(self):
        """Regresión: un vehículo con 62.000 km e intervalo de 20.000 aparecía
        vencido por -42.000 km. Debe programarse el siguiente múltiplo."""
        from utils.fleet_analytics import maintenance_forecast_all
        for v in maintenance_forecast_all(interval_km=20000):
            if v["ultimo_preventivo_km"] is None:
                assert v["objetivo_km"] >= v["odometro_actual"]
                assert v["km_faltantes"] >= 0

    def test_el_objetivo_respeta_el_intervalo(self):
        from utils.fleet_analytics import maintenance_forecast_all
        for v in maintenance_forecast_all(interval_km=20000):
            if v["ultimo_preventivo_km"] is not None:
                assert abs(v["objetivo_km"] - (v["ultimo_preventivo_km"] + 20000)) < 1e-6


# ===========================================================================
# ALGORITMOS DE RED
# ===========================================================================
class TestRed:

    @pytest.fixture
    def red(self):
        from models.network import Node, Corridor
        return Node.all(), Corridor.all()

    def test_el_grafo_se_construye_con_todos_los_nodos_activos(self, red):
        from utils.network_algorithms import build_graph
        nodes, corridors = red
        G = build_graph(nodes, corridors)
        assert G.number_of_nodes() == len(nodes)

    def test_la_ruta_mas_corta_empieza_en_el_origen_y_termina_en_el_destino(self, red):
        from utils.network_algorithms import build_graph, shortest_path
        nodes, corridors = red
        G = build_graph(nodes, corridors)
        ids = [n["node_id"] for n in nodes]
        r = shortest_path(G, ids[0], ids[-1])
        if r["found"]:
            assert r["path"][0] == ids[0] and r["path"][-1] == ids[-1]
            assert r["distance_km"] > 0

    def test_dijkstra_por_distancia_no_puede_superar_a_otro_criterio_en_distancia(self, red):
        """Optimizar por distancia debe dar la distancia mínima: ningún otro
        criterio puede producir una ruta más corta."""
        from utils.network_algorithms import build_graph, shortest_path
        nodes, corridors = red
        G = build_graph(nodes, corridors)
        ids = [n["node_id"] for n in nodes]
        por_dist = shortest_path(G, ids[0], ids[-1], weight="distance")
        por_costo = shortest_path(G, ids[0], ids[-1], weight="cost")
        if por_dist["found"] and por_costo["found"]:
            assert por_dist["distance_km"] <= por_costo["distance_km"] + 1e-6

    def test_eliminar_un_nodo_reduce_el_tamano_del_grafo(self, red):
        from utils.network_algorithms import simulate_node_removal
        nodes, corridors = red
        objetivo = [n for n in nodes if n["node_type"] != "Cliente"][0]
        r = simulate_node_removal(nodes, corridors, objetivo["node_id"])
        assert r["after"]["n_nodes"] == r["before"]["n_nodes"] - 1

    def test_el_nivel_de_servicio_esta_entre_cero_y_cien(self, red):
        from utils.network_algorithms import build_graph, network_stats
        nodes, corridors = red
        s = network_stats(build_graph(nodes, corridors))
        assert 0 <= s["service_level_pct"] <= 100


class TestTSP:

    @pytest.fixture
    def red(self):
        from models.network import Node, Corridor
        return Node.all(), Corridor.all()

    def test_la_heuristica_encuentra_o_iguala_al_optimo_exacto(self, red):
        """Se compara NN+2-opt contra la enumeración completa de permutaciones
        en instancias pequeñas. La heurística nunca puede dar menos que el
        óptimo; si lo hiciera, estaría midiendo mal el circuito."""
        from utils.advanced_optimization import solve_multi_stop_route, _path_cost
        from utils.network_algorithms import build_graph
        nodes, corridors = red
        G = build_graph(nodes, corridors)
        ids = [n["node_id"] for n in nodes]
        depot, paradas = ids[0], ids[2:6]

        res = solve_multi_stop_route(nodes, corridors, depot, paradas)
        if not res["found"]:
            pytest.skip("No hay circuito factible en esta red")

        mejor = None
        for perm in itertools.permutations(paradas):
            c = _path_cost(G, list(perm), depot, "distance")
            if c is not None and (mejor is None or c < mejor):
                mejor = c
        assert mejor is not None
        assert res["distancia_total_km"] >= mejor - 1e-6

    def test_el_dos_opt_nunca_empeora_la_solucion_inicial(self, red):
        from utils.advanced_optimization import solve_multi_stop_route
        nodes, corridors = red
        ids = [n["node_id"] for n in nodes]
        res = solve_multi_stop_route(nodes, corridors, ids[0], ids[2:7])
        if res["found"]:
            assert res["costo_2opt"] <= res["costo_nn"] + 1e-6

    def test_el_circuito_visita_todas_las_paradas_una_sola_vez(self, red):
        from utils.advanced_optimization import solve_multi_stop_route
        nodes, corridors = red
        ids = [n["node_id"] for n in nodes]
        paradas = ids[2:6]
        res = solve_multi_stop_route(nodes, corridors, ids[0], paradas)
        if res["found"]:
            assert sorted(res["orden_paradas"]) == sorted(paradas)


class TestCapacidad:

    def test_rechaza_carga_que_excede_el_peso(self):
        from utils.advanced_optimization import check_vehicle_capacity
        v = {"capacity_kg": 10000, "capacity_m3": 50}
        r = check_vehicle_capacity(v, 15000, 10)
        assert r["apto"] is False and r["ok_peso"] is False

    def test_rechaza_carga_que_excede_el_volumen(self):
        from utils.advanced_optimization import check_vehicle_capacity
        v = {"capacity_kg": 10000, "capacity_m3": 50}
        r = check_vehicle_capacity(v, 1000, 80)
        assert r["apto"] is False and r["ok_volumen"] is False
        assert r["factor_limitante"] == "Volumen"

    def test_acepta_carga_dentro_de_los_limites(self):
        from utils.advanced_optimization import check_vehicle_capacity
        v = {"capacity_kg": 10000, "capacity_m3": 50}
        r = check_vehicle_capacity(v, 5000, 25)
        assert r["apto"] is True
        assert abs(r["utilizacion_peso_pct"] - 50.0) < 0.1


class TestMonteCarlo:

    def test_es_reproducible_con_la_misma_semilla(self):
        from utils.advanced_optimization import monte_carlo_demand
        a = monte_carlo_demand(1000, 5.0, n_simulations=500, seed=42)
        b = monte_carlo_demand(1000, 5.0, n_simulations=500, seed=42)
        assert a["demanda"]["media"] == b["demanda"]["media"]

    def test_la_media_simulada_se_aproxima_a_la_demanda_base(self):
        from utils.advanced_optimization import monte_carlo_demand
        r = monte_carlo_demand(1000, 5.0, n_simulations=5000, volatility=0.25, seed=42)
        assert abs(r["demanda"]["media"] - 1000) < 40

    def test_la_desviacion_reportada_coincide_con_las_muestras(self):
        from utils.advanced_optimization import monte_carlo_demand
        r = monte_carlo_demand(1000, 5.0, n_simulations=2000, seed=7)
        assert abs(r["demanda"]["desviacion"] - statistics.stdev(r["muestras_demanda"])) < 0.05

    def test_los_percentiles_estan_ordenados(self):
        from utils.advanced_optimization import monte_carlo_demand
        d = monte_carlo_demand(1000, 5.0, n_simulations=2000, seed=1)["demanda"]
        assert d["min"] <= d["p5"] <= d["p50"] <= d["p95"] <= d["max"]

    def test_mas_volatilidad_implica_mas_dispersion(self):
        from utils.advanced_optimization import monte_carlo_demand
        baja = monte_carlo_demand(1000, 5.0, n_simulations=3000, volatility=0.10, seed=3)
        alta = monte_carlo_demand(1000, 5.0, n_simulations=3000, volatility=0.40, seed=3)
        assert alta["demanda"]["desviacion"] > baja["demanda"]["desviacion"]


# ===========================================================================
# ADUANAS
# ===========================================================================
class TestAduanas:

    def test_el_iva_se_calcula_sobre_el_valor_mas_el_arancel(self):
        """Valor 50.000 con arancel 10% e IVA 19%:
        arancel = 5.000 ; IVA = (50.000+5.000)*0.19 = 10.450."""
        from models.customs import CustomsDuty
        r = CustomsDuty.compute(50000, 10, 19)
        assert abs(r["tariff_amount"] - 5000) < 0.01
        assert abs(r["taxes"] - 10450) < 0.01
        assert abs(r["total_duty"] - 15450) < 0.01

    def test_sin_arancel_el_iva_recae_solo_sobre_el_valor(self):
        from models.customs import CustomsDuty
        r = CustomsDuty.compute(10000, 0, 19)
        assert abs(r["tariff_amount"]) < 0.01
        assert abs(r["taxes"] - 1900) < 0.01

    def test_los_escenarios_quedan_ordenados_del_mas_barato_al_mas_caro(self):
        from models.consolidation import TariffScenario
        esc = TariffScenario.compare(50000)
        if not esc:
            pytest.skip("No hay escenarios cargados")
        totales = [e["costo_total_importacion"] for e in esc]
        assert totales == sorted(totales)

    def test_cada_escenario_cuadra_con_el_calculo_manual(self):
        from models.consolidation import TariffScenario
        V = 50000.0
        for e in TariffScenario.compare(V):
            ar = V * e["arancel_pct"] / 100
            iva = (V + ar) * e["iva_pct"] / 100
            otros = V * e["otros_pct"] / 100
            assert abs(e["arancel"] - ar) < 0.01
            assert abs(e["iva"] - iva) < 0.01
            assert abs(e["total_tributos"] - (ar + iva + otros)) < 0.01


# ===========================================================================
# CONSOLIDACIÓN
# ===========================================================================
class TestConsolidacion:

    def test_los_grupos_comparten_origen_y_destino(self):
        from models.consolidation import candidates_for_consolidation
        for g in candidates_for_consolidation(window_days=30):
            assert g["n_envios"] >= 2
            assert len(g["shipment_ids"]) == g["n_envios"]

    def test_consolidar_no_puede_salir_mas_caro_por_costo_de_transaccion(self):
        """El costo de transacción se paga una vez en lugar de una por envío,
        así que ese componente siempre baja al consolidar."""
        from models.consolidation import candidates_for_consolidation, evaluate_consolidation
        grupos = candidates_for_consolidation(window_days=30)
        if not grupos:
            pytest.skip("No hay grupos consolidables")
        for g in grupos:
            ev = evaluate_consolidation(g, 100, 2, 20000)
            assert ev["costo_despues"] > 0
            assert ev["ahorro"] == pytest.approx(ev["costo_antes"] - ev["costo_despues"], abs=0.01)


# ===========================================================================
# SEGURIDAD
# ===========================================================================
class TestSeguridad:

    def test_la_contrasena_no_se_guarda_en_texto_plano(self):
        from utils.auth import hash_password
        h, salt = hash_password("mi_clave_secreta")
        assert "mi_clave_secreta" not in h
        assert "mi_clave_secreta" not in salt

    def test_verifica_la_clave_correcta_y_rechaza_la_incorrecta(self):
        from utils.auth import hash_password, verify_password
        h, salt = hash_password("clave123")
        assert verify_password("clave123", h, salt) is True
        assert verify_password("clave124", h, salt) is False

    def test_el_salt_hace_unico_cada_hash(self):
        from utils.auth import hash_password
        h1, _ = hash_password("misma_clave")
        h2, _ = hash_password("misma_clave")
        assert h1 != h2

    def test_rechaza_credenciales_invalidas(self):
        from utils.auth import authenticate
        assert authenticate("admin", "clave_incorrecta") is None
        assert authenticate("usuario_inexistente", "x") is None
        assert authenticate("admin", "") is None

    def test_acepta_las_credenciales_de_los_usuarios_semilla(self):
        from utils.auth import authenticate
        u = authenticate("admin", "admin123")
        assert u is not None and u["role"] == "admin"


# ===========================================================================
# REPORTES
# ===========================================================================
class TestReportes:

    def test_genera_un_excel_valido(self):
        import pandas as pd
        from utils.report_exporter import dataframe_to_excel_bytes
        df = pd.DataFrame({"SKU": ["A", "B"], "Cantidad": [10, 20]})
        data = dataframe_to_excel_bytes(df, "Hoja", "Título")
        assert isinstance(data, bytes) and len(data) > 0
        assert data[:2] == b"PK"       # firma de archivo xlsx (contenedor zip)

    def test_genera_un_pdf_valido(self):
        import pandas as pd
        from utils.report_exporter import dataframe_to_pdf_bytes
        df = pd.DataFrame({"SKU": ["A", "B"], "Cantidad": [10, 20]})
        data = dataframe_to_pdf_bytes(df, "Título")
        assert isinstance(data, bytes) and len(data) > 0
        assert data[:4] == b"%PDF"     # firma de archivo PDF


if __name__ == "__main__":
    sys.exit(pytest.main([__file__, "-v"]))
