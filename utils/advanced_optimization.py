"""
advanced_optimization.py
Algoritmos avanzados de diseño y operación de la red:

  - Ruteo multi-parada (TSP): heurística del vecino más cercano + mejora 2-opt.
  - Facility Location: selección óptima de qué instalaciones abrir
    (búsqueda exhaustiva para redes pequeñas, greedy para redes grandes).
  - Análisis de robustez: identificación de nodos críticos de la red.
  - Simulación de Monte Carlo de demanda variable.
"""
import itertools
import math
import random
from typing import List, Optional

import networkx as nx

from utils.network_algorithms import build_graph, network_stats


# ---------------------------------------------------------------------------
# RUTEO MULTI-PARADA (TSP)
# ---------------------------------------------------------------------------
def _path_cost(G: nx.DiGraph, order: List[int], depot: int, weight: str = "distance") -> Optional[float]:
    """Costo total de recorrer depot -> paradas en orden -> depot.
    Devuelve None si algún tramo no es alcanzable."""
    seq = [depot] + list(order) + [depot]
    total = 0.0
    for i in range(len(seq) - 1):
        try:
            total += nx.shortest_path_length(G, seq[i], seq[i + 1], weight=weight)
        except (nx.NetworkXNoPath, nx.NodeNotFound):
            return None
    return total


def nearest_neighbor_tsp(G: nx.DiGraph, depot: int, stops: List[int],
                          weight: str = "distance") -> dict:
    """Heurística del vecino más cercano.

    Desde el depósito, se visita repetidamente la parada no visitada más
    cercana. Es rápida (O(n²)) pero no óptima; sirve como solución inicial."""
    unvisited = list(stops)
    current = depot
    order = []
    while unvisited:
        best_stop, best_d = None, float("inf")
        for s in unvisited:
            try:
                d = nx.shortest_path_length(G, current, s, weight=weight)
            except (nx.NetworkXNoPath, nx.NodeNotFound):
                continue
            if d < best_d:
                best_d, best_stop = d, s
        if best_stop is None:
            break  # paradas restantes inalcanzables
        order.append(best_stop)
        unvisited.remove(best_stop)
        current = best_stop

    cost = _path_cost(G, order, depot, weight)
    return {"order": order, "cost": round(cost, 2) if cost is not None else None,
            "algorithm": "nearest_neighbor", "unreachable": unvisited}


def two_opt_improve(G: nx.DiGraph, depot: int, order: List[int],
                     weight: str = "distance", max_iter: int = 100) -> dict:
    """Mejora 2-opt: invierte segmentos de la ruta mientras eso reduzca el costo.

    Es la mejora local clásica sobre una solución de vecino más cercano;
    elimina los cruces que deja la heurística inicial."""
    if len(order) < 3:
        cost = _path_cost(G, order, depot, weight)
        return {"order": order, "cost": round(cost, 2) if cost is not None else None,
                "algorithm": "nn_2opt", "iterations": 0}

    best_order = list(order)
    best_cost = _path_cost(G, best_order, depot, weight)
    if best_cost is None:
        return {"order": order, "cost": None, "algorithm": "nn_2opt", "iterations": 0}

    improved = True
    iterations = 0
    while improved and iterations < max_iter:
        improved = False
        iterations += 1
        for i in range(len(best_order) - 1):
            for j in range(i + 1, len(best_order)):
                candidate = best_order[:i] + best_order[i:j + 1][::-1] + best_order[j + 1:]
                cand_cost = _path_cost(G, candidate, depot, weight)
                if cand_cost is not None and cand_cost < best_cost - 1e-9:
                    best_order, best_cost = candidate, cand_cost
                    improved = True
    return {"order": best_order, "cost": round(best_cost, 2), "algorithm": "nn_2opt",
            "iterations": iterations}


def solve_multi_stop_route(nodes: List[dict], corridors: List[dict], depot: int,
                            stops: List[int], weight: str = "distance") -> dict:
    """Resuelve la ruta multi-parada completa: NN + 2-opt, con métricas
    de distancia, tiempo y costo del recorrido resultante."""
    G = build_graph(nodes, corridors)
    nn = nearest_neighbor_tsp(G, depot, stops, weight)
    if not nn["order"]:
        return {"found": False, "message": "Ninguna parada es alcanzable desde el depósito."}

    opt = two_opt_improve(G, depot, nn["order"], weight)

    # Métricas del recorrido final, tramo por tramo
    seq = [depot] + opt["order"] + [depot]
    total_dist = total_time = total_cost = 0.0
    detalle = []
    for i in range(len(seq) - 1):
        try:
            path = nx.shortest_path(G, seq[i], seq[i + 1], weight=weight)
        except (nx.NetworkXNoPath, nx.NodeNotFound):
            continue
        d = sum(G[path[k]][path[k + 1]]["distance"] for k in range(len(path) - 1))
        t = sum(G[path[k]][path[k + 1]]["time"] for k in range(len(path) - 1))
        c = sum(G[path[k]][path[k + 1]]["cost"] for k in range(len(path) - 1))
        total_dist += d
        total_time += t
        total_cost += c
        detalle.append({"desde": seq[i], "hasta": seq[i + 1], "distancia_km": round(d, 1),
                        "tiempo_h": round(t, 2), "costo": round(c, 2)})

    mejora_pct = None
    if nn["cost"] and opt["cost"] and nn["cost"] > 0:
        mejora_pct = round(100 * (nn["cost"] - opt["cost"]) / nn["cost"], 2)

    return {
        "found": True,
        "secuencia": seq,
        "orden_paradas": opt["order"],
        "costo_nn": nn["cost"],
        "costo_2opt": opt["cost"],
        "mejora_pct": mejora_pct,
        "distancia_total_km": round(total_dist, 1),
        "tiempo_total_h": round(total_time, 2),
        "costo_total": round(total_cost, 2),
        "tramos": detalle,
        "paradas_inalcanzables": nn.get("unreachable", []),
    }


# ---------------------------------------------------------------------------
# COMPARACIÓN DE ALGORITMOS DE RUTEO
# ---------------------------------------------------------------------------
def compare_routing_criteria(nodes: List[dict], corridors: List[dict],
                              origin: int, dest: int) -> List[dict]:
    """Compara la ruta óptima según tres criterios: distancia, costo y tiempo.

    Muestra el trade-off: la ruta más corta no siempre es la más barata ni la
    más rápida, que es justamente el punto pedagógico del ruteo en redes."""
    G = build_graph(nodes, corridors)
    id_to_name = {n["node_id"]: n["name"] for n in nodes}
    criterios = [("distance", "Menor distancia"), ("cost", "Menor costo"), ("time", "Menor tiempo")]
    resultados = []
    for weight, etiqueta in criterios:
        try:
            path = nx.shortest_path(G, origin, dest, weight=weight)
        except (nx.NetworkXNoPath, nx.NodeNotFound):
            resultados.append({"criterio": etiqueta, "encontrada": False})
            continue
        d = sum(G[path[i]][path[i + 1]]["distance"] for i in range(len(path) - 1))
        c = sum(G[path[i]][path[i + 1]]["cost"] for i in range(len(path) - 1))
        t = sum(G[path[i]][path[i + 1]]["time"] for i in range(len(path) - 1))
        resultados.append({
            "criterio": etiqueta,
            "encontrada": True,
            "ruta": " → ".join(id_to_name.get(n, str(n)) for n in path),
            "path": path,
            "n_saltos": len(path) - 1,
            "distancia_km": round(d, 1),
            "costo": round(c, 2),
            "tiempo_h": round(t, 2),
        })
    return resultados


# ---------------------------------------------------------------------------
# FACILITY LOCATION - OPTIMIZACIÓN DE UBICACIÓN DE INSTALACIONES
# ---------------------------------------------------------------------------
def optimize_facility_location(nodes: List[dict], corridors: List[dict],
                                facility_type: str = "CD", n_to_open: int = 2,
                                cost_weight: float = 0.001,
                                max_exhaustive: int = 12) -> dict:
    """Determina qué combinación de N instalaciones abrir maximiza el objetivo.

    Objetivo (score) = nivel_de_servicio(%) - cost_weight * costo_total_red
    Es una función de utilidad que refleja el trade-off central del curso:
    maximizar servicio penalizando el costo de suministro.

    Método: búsqueda EXHAUSTIVA si el número de combinaciones es manejable
    (<= max_exhaustive), garantizando el óptimo global; si no, heurística
    GREEDY que abre la instalación que más mejora el score en cada paso."""
    facilities = [n["node_id"] for n in nodes if n["node_type"] == facility_type]
    if not facilities:
        return {"error": f"No hay nodos del tipo '{facility_type}' en la red."}
    n_to_open = max(0, min(n_to_open, len(facilities)))

    id_to_name = {n["node_id"]: n["name"] for n in nodes}

    def _evaluate(open_set: set) -> Optional[dict]:
        excluded = set(facilities) - set(open_set)
        G = build_graph(nodes, corridors, excluded_node_ids=excluded)
        stats = network_stats(G)
        if stats["total_network_cost"] is None:
            return None
        score = stats["service_level_pct"] - cost_weight * stats["total_network_cost"]
        return {**stats, "score": round(score, 3), "abiertas": sorted(open_set)}

    n_combos = len(list(itertools.combinations(facilities, n_to_open))) if n_to_open else 1

    if n_combos <= max_exhaustive:
        metodo = "exhaustivo (óptimo global)"
        mejor, evaluadas = None, []
        for combo in itertools.combinations(facilities, n_to_open):
            r = _evaluate(set(combo))
            if r is None:
                continue
            evaluadas.append(r)
            if mejor is None or r["score"] > mejor["score"]:
                mejor = r
    else:
        metodo = "greedy (heurística)"
        abiertas, evaluadas = set(), []
        for _ in range(n_to_open):
            mejor_paso = None
            for cand in facilities:
                if cand in abiertas:
                    continue
                r = _evaluate(abiertas | {cand})
                if r is None:
                    continue
                r["candidato"] = cand
                if mejor_paso is None or r["score"] > mejor_paso["score"]:
                    mejor_paso = r
            if mejor_paso is None:
                break
            abiertas.add(mejor_paso["candidato"])
            evaluadas.append(mejor_paso)
        mejor = _evaluate(abiertas) if abiertas else _evaluate(set())

    if mejor is None:
        return {"error": "No se pudo evaluar ninguna configuración de red."}

    mejor["nombres_abiertas"] = [id_to_name.get(i, str(i)) for i in mejor["abiertas"]]
    mejor["cerradas"] = [i for i in facilities if i not in mejor["abiertas"]]
    mejor["nombres_cerradas"] = [id_to_name.get(i, str(i)) for i in mejor["cerradas"]]
    return {"mejor": mejor, "metodo": metodo, "combinaciones_evaluadas": len(evaluadas),
            "todas": sorted(evaluadas, key=lambda x: -x["score"])[:15],
            "n_instalaciones_abiertas": n_to_open, "tipo_instalacion": facility_type}


# ---------------------------------------------------------------------------
# ANÁLISIS DE ROBUSTEZ - NODOS CRÍTICOS
# ---------------------------------------------------------------------------
def criticality_analysis(nodes: List[dict], corridors: List[dict]) -> List[dict]:
    """Identifica los nodos más críticos de la red.

    Para cada nodo no-cliente se elimina de la red y se mide cuánto se degrada
    el nivel de servicio y cuánto sube la distancia promedio. Se combina con la
    centralidad de intermediación (betweenness), que mide por cuántas rutas
    más cortas pasa ese nodo — un nodo con alta betweenness es un cuello de
    botella estructural."""
    G_base = build_graph(nodes, corridors)
    base_stats = network_stats(G_base)
    betweenness = nx.betweenness_centrality(G_base, weight="distance")

    id_to_info = {n["node_id"]: n for n in nodes}
    resultados = []
    for n in nodes:
        if n["node_type"] == "Cliente":
            continue  # los clientes son demanda, no infraestructura
        nid = n["node_id"]
        G_sin = build_graph(nodes, corridors, excluded_node_ids={nid})
        stats = network_stats(G_sin)

        caida_servicio = None
        if base_stats["service_level_pct"] is not None and stats["service_level_pct"] is not None:
            caida_servicio = round(base_stats["service_level_pct"] - stats["service_level_pct"], 2)

        aumento_distancia = None
        if base_stats["avg_distance_km"] and stats["avg_distance_km"]:
            aumento_distancia = round(stats["avg_distance_km"] - base_stats["avg_distance_km"], 1)

        # Índice de criticidad: combina la caída de servicio con la centralidad
        criticidad = (caida_servicio or 0) + 100 * betweenness.get(nid, 0)

        resultados.append({
            "node_id": nid,
            "nombre": n["name"],
            "tipo": n["node_type"],
            "betweenness": round(betweenness.get(nid, 0), 4),
            "servicio_sin_nodo_pct": stats["service_level_pct"],
            "caida_servicio_pp": caida_servicio,
            "aumento_distancia_km": aumento_distancia,
            "indice_criticidad": round(criticidad, 2),
        })
    return sorted(resultados, key=lambda x: -x["indice_criticidad"])


# ---------------------------------------------------------------------------
# SIMULACIÓN DE MONTE CARLO
# ---------------------------------------------------------------------------
def monte_carlo_demand(base_demand: float, base_cost_per_unit: float,
                        n_simulations: int = 1000, volatility: float = 0.25,
                        capacity: float = None, seed: int = 42) -> dict:
    """Simula demanda variable (distribución normal truncada en cero) y su
    efecto en costo total y nivel de servicio.

    Si se indica una capacidad, el nivel de servicio de cada réplica es
    min(1, capacidad / demanda): la demanda que excede la capacidad no se
    atiende, que es exactamente el riesgo que la simulación busca cuantificar.

    Devuelve percentiles P5/P50/P95, útiles para decisiones bajo incertidumbre."""
    rng = random.Random(seed)
    demandas, costos, servicios = [], [], []

    for _ in range(n_simulations):
        d = rng.gauss(base_demand, base_demand * volatility)
        d = max(0.0, d)
        demandas.append(d)
        costos.append(d * base_cost_per_unit)
        if capacity and capacity > 0:
            servicios.append(min(1.0, capacity / d) * 100 if d > 0 else 100.0)
        else:
            servicios.append(100.0)

    def _pct(data, p):
        s = sorted(data)
        k = int(round((len(s) - 1) * p))
        return round(s[k], 2)

    def _mean(data):
        return round(sum(data) / len(data), 2) if data else None

    def _std(data):
        """Desviación estándar muestral (n-1), que es la que corresponde cuando
        se estima la dispersión a partir de una muestra simulada."""
        if not data or len(data) < 2:
            return 0.0
        m = sum(data) / len(data)
        var = sum((x - m) ** 2 for x in data) / (len(data) - 1)
        return round(math.sqrt(var), 2)

    faltantes = sum(1 for d in demandas if capacity and d > capacity)

    return {
        "n_simulaciones": n_simulations,
        "volatilidad": volatility,
        "demanda": {"media": _mean(demandas), "desviacion": _std(demandas),
                     "p5": _pct(demandas, 0.05),
                     "p50": _pct(demandas, 0.50), "p95": _pct(demandas, 0.95),
                     "min": round(min(demandas), 2), "max": round(max(demandas), 2)},
        "costo": {"media": _mean(costos), "desviacion": _std(costos),
                   "p5": _pct(costos, 0.05),
                   "p50": _pct(costos, 0.50), "p95": _pct(costos, 0.95)},
        "nivel_servicio_pct": {"media": _mean(servicios), "p5": _pct(servicios, 0.05),
                                "p50": _pct(servicios, 0.50), "p95": _pct(servicios, 0.95)},
        "prob_desabastecimiento_pct": round(100 * faltantes / n_simulations, 2) if capacity else 0.0,
        "muestras_demanda": [round(d, 2) for d in demandas],
        "muestras_costo": [round(c, 2) for c in costos],
    }


# ---------------------------------------------------------------------------
# RESTRICCIONES DE CAPACIDAD
# ---------------------------------------------------------------------------
def check_vehicle_capacity(vehicle: dict, weight_kg: float, volume_m3: float) -> dict:
    """Valida si un vehículo puede transportar una carga dada.

    Se revisan ambas restricciones (peso y volumen) porque una carga puede
    'cubicar' antes de alcanzar el límite de peso, y viceversa."""
    cap_kg = float(vehicle.get("capacity_kg", 0))
    cap_m3 = float(vehicle.get("capacity_m3", 0))
    ok_peso = weight_kg <= cap_kg
    ok_volumen = volume_m3 <= cap_m3
    return {
        "apto": ok_peso and ok_volumen,
        "ok_peso": ok_peso,
        "ok_volumen": ok_volumen,
        "utilizacion_peso_pct": round(100 * weight_kg / cap_kg, 1) if cap_kg > 0 else None,
        "utilizacion_volumen_pct": round(100 * volume_m3 / cap_m3, 1) if cap_m3 > 0 else None,
        "exceso_peso_kg": round(max(0.0, weight_kg - cap_kg), 1),
        "exceso_volumen_m3": round(max(0.0, volume_m3 - cap_m3), 2),
        "factor_limitante": ("Peso" if not ok_peso and (cap_kg and weight_kg / cap_kg >= volume_m3 / cap_m3 if cap_m3 else True)
                              else "Volumen" if not ok_volumen else None),
    }
