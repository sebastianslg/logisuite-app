"""
network_algorithms.py
Algoritmos de red de distribución usando NetworkX:
  - construcción del grafo dirigido a partir de nodos/corredores activos
  - ruta más corta (distancia) y de menor costo (Dijkstra)
  - simulación de impacto de agregar/eliminar un nodo sobre distancia promedio,
    costo total de la red y nivel de servicio (OTIF proxy)
  - curva de trade-off Costo vs. Nivel de Servicio en función del número de instalaciones
"""
import networkx as nx
import itertools
import random


def build_graph(nodes: list, corridors: list, excluded_node_ids: set = None) -> nx.DiGraph:
    """Construye un grafo dirigido ponderado. nodes y corridors vienen de los
    modelos Node.all() / Corridor.all()."""
    excluded_node_ids = excluded_node_ids or set()
    G = nx.DiGraph()
    for n in nodes:
        if n["node_id"] in excluded_node_ids:
            continue
        G.add_node(n["node_id"], name=n["name"], node_type=n["node_type"],
                   lat=n["latitude"], lon=n["longitude"])
    for c in corridors:
        if c["origin_node_id"] in excluded_node_ids or c["dest_node_id"] in excluded_node_ids:
            continue
        if c["origin_node_id"] not in G or c["dest_node_id"] not in G:
            continue
        cost = c["distance_km"] * c["cost_per_km"]
        G.add_edge(c["origin_node_id"], c["dest_node_id"],
                   distance=c["distance_km"], time=c["transit_time_h"],
                   cost=cost, mode=c["mode"])
        # Los corredores se asumen bidireccionales para la topología de red
        G.add_edge(c["dest_node_id"], c["origin_node_id"],
                   distance=c["distance_km"], time=c["transit_time_h"],
                   cost=cost, mode=c["mode"])
    return G


def shortest_path(G: nx.DiGraph, origin: int, dest: int, weight: str = "distance") -> dict:
    """weight: 'distance' o 'cost'. Devuelve el camino, distancia total, costo total y tiempo."""
    try:
        path = nx.shortest_path(G, origin, dest, weight=weight)
    except (nx.NetworkXNoPath, nx.NodeNotFound):
        return {"path": [], "distance_km": None, "cost": None, "time_h": None, "found": False}
    total_distance = sum(G[path[i]][path[i + 1]]["distance"] for i in range(len(path) - 1))
    total_cost = sum(G[path[i]][path[i + 1]]["cost"] for i in range(len(path) - 1))
    total_time = sum(G[path[i]][path[i + 1]]["time"] for i in range(len(path) - 1))
    return {"path": path, "distance_km": round(total_distance, 1),
            "cost": round(total_cost, 2), "time_h": round(total_time, 2), "found": True}


def network_stats(G: nx.DiGraph, client_type: str = "Cliente") -> dict:
    """Distancia promedio ponderada y costo total de la red, calculados sobre
    las rutas más cortas desde cada Planta/CD/Almacen/Hub/Gateway hacia cada Cliente."""
    sources = [n for n, d in G.nodes(data=True) if d.get("node_type") != client_type]
    clients = [n for n, d in G.nodes(data=True) if d.get("node_type") == client_type]
    distances, costs, reachable, total_pairs = [], [], 0, 0
    for s, c in itertools.product(sources, clients):
        total_pairs += 1
        try:
            d = nx.shortest_path_length(G, s, c, weight="distance")
            cost = nx.shortest_path_length(G, s, c, weight="cost")
            distances.append(d)
            costs.append(cost)
            reachable += 1
        except (nx.NetworkXNoPath, nx.NodeNotFound):
            continue
    service_level = round(100 * reachable / total_pairs, 1) if total_pairs else 0.0
    return {
        "avg_distance_km": round(sum(distances) / len(distances), 1) if distances else None,
        "total_network_cost": round(sum(costs), 2) if costs else None,
        "avg_cost": round(sum(costs) / len(costs), 2) if costs else None,
        "service_level_pct": service_level,
        "reachable_pairs": reachable,
        "total_pairs": total_pairs,
        "n_nodes": G.number_of_nodes(),
        "n_edges": G.number_of_edges(),
    }


def simulate_node_removal(nodes: list, corridors: list, node_id_to_remove: int) -> dict:
    """Compara estadísticas de la red ANTES y DESPUÉS de eliminar un nodo
    (ej. cerrar un CD). Este es el núcleo de la herramienta de simulación."""
    G_before = build_graph(nodes, corridors)
    G_after = build_graph(nodes, corridors, excluded_node_ids={node_id_to_remove})
    stats_before = network_stats(G_before)
    stats_after = network_stats(G_after)

    def _delta(a, b):
        if a is None or b is None:
            return None
        return round(b - a, 2)

    return {
        "before": stats_before,
        "after": stats_after,
        "delta_avg_distance_km": _delta(stats_before["avg_distance_km"], stats_after["avg_distance_km"]),
        "delta_total_cost": _delta(stats_before["total_network_cost"], stats_after["total_network_cost"]),
        "delta_service_level_pct": _delta(stats_before["service_level_pct"], stats_after["service_level_pct"]),
    }


def cost_vs_service_tradeoff(nodes: list, corridors: list, facility_type: str = "CD") -> list:
    """Construye la curva de trade-off Costo vs. Nivel de Servicio variando el
    número de instalaciones (CDs) activas en la red, de 0 hasta el total disponible.
    Para cada tamaño k, se prueban varias combinaciones aleatorias (muestreo, no
    fuerza bruta total) y se reporta la mejor combinación encontrada (mayor
    nivel de servicio al menor costo) — representa el objetivo central del curso:
    reducir el costo de suministro manteniendo/mejorando el nivel de servicio."""
    facilities = [n["node_id"] for n in nodes if n["node_type"] == facility_type]
    other_nodes_ids = {n["node_id"] for n in nodes if n["node_type"] != facility_type}
    results = []
    random.seed(42)
    max_k = len(facilities)
    for k in range(max_k + 1):
        excluded_candidates = list(itertools.combinations(facilities, max_k - k))
        sample = excluded_candidates if len(excluded_candidates) <= 8 else random.sample(excluded_candidates, 8)
        best = None
        for excl in sample:
            G = build_graph(nodes, corridors, excluded_node_ids=set(excl))
            stats = network_stats(G)
            if stats["total_network_cost"] is None:
                continue
            score = stats["service_level_pct"] - 0.001 * stats["total_network_cost"]
            if best is None or score > best["score"]:
                best = {**stats, "score": score, "n_facilities_active": k}
        if best:
            results.append(best)
    return sorted(results, key=lambda r: r["n_facilities_active"])
