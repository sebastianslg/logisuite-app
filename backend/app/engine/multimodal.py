"""
multimodal.py
Motor de enrutamiento multimodal sobre NetworkX.

Modelo: grafo expandido por estados. Cada nodo físico se replica una vez por
cada modo que opera en él: (BOG-AIR, aereo), (BOG-AIR, terrestre)... Así:

  - Un enlace de transporte une estados del MISMO modo: (u, m) -> (v, m).
  - Un transbordo es una arista entre dos modos del MISMO nodo:
    (n, aereo) -> (n, terrestre), con el tiempo y el costo de manipulación
    propios del tipo de nodo (aeropuerto, puerto, terminal férrea...).

En el modo aéreo la carga no "atraviesa" un aeropuerto en el mismo avión: se
desembarca y conecta. Por eso cada aeropuerto tiene un estado de llegada
(`aereo_arr`) y uno de salida (`aereo`), unidos por una arista de conexión con
su tiempo y su costo. Una escala LET -> BOG -> CTG cuenta como transbordo.

Dijkstra sobre este grafo encuentra la ruta óptima y, por construcción, cuenta
y costea cada cambio de modo. El origen y el destino pueden ser un nodo
(`LET-AIR`) o una ciudad (`Leticia`): en el segundo caso un supernodo conecta
con todos los nodos y modos de esa ciudad sin costo.

Prioridades:
  - tiempo:     minimiza horas totales (tránsito + transbordos).
  - costo:      minimiza USD (fijos + t-km + transbordos).
  - balanceado: costo generalizado = USD + valor del tiempo de la carga
                (VALUE_OF_TIME_USD_PER_T_H por tonelada y hora).

Un enlace cuya capacidad por despacho es menor que el peso del envío se
excluye: 30 t no salen de Leticia en el carguero de 20 t.

Vías cerradas: un corredor marcado como cerrado en mm_corridor_status sigue en
la red (el mapa lo muestra) pero sus enlaces no entran al grafo de ruteo.

Restricciones opcionales por envío:
  - allowed_modes:      solo se usan enlaces de esos modos.
  - required_corridors: la ruta debe pasar por cada corredor indicado (máx. 3).
    Se resuelve con un grafo por capas: cada capa es el subconjunto de
    corredores ya recorridos, y el destino solo se alcanza en la capa completa.
"""
from __future__ import annotations

import json
import math
from dataclasses import dataclass, field

import networkx as nx

PRIORITIES = ("tiempo", "costo", "balanceado")
MAX_REQUIRED_CORRIDORS = 3
VALUE_OF_TIME_USD_PER_T_H = 12.0
AIR_CONNECTION_FACTOR = 0.6   # conexión aérea: fracción del transbordo del aeropuerto

_SRC, _DST = ("__SRC__", "*"), ("__DST__", "*")


def _arrival(mode: str) -> str:
    """Estado al que llega un enlace de este modo."""
    return "aereo_arr" if mode == "aereo" else mode


def _base_mode(state_mode: str) -> str:
    return state_mode.removesuffix("_arr")


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


class RoutingError(ValueError):
    """Origen/destino desconocido o sin ruta factible."""


@dataclass
class MultimodalNetwork:
    nodes: dict                      # node_code -> dict
    links: list                      # dicts con geometry (lista [lon, lat])
    cities: dict = field(default_factory=dict)  # ciudad -> [node_code]

    @classmethod
    def from_db(cls) -> "MultimodalNetwork":
        from app.database.db import run_query
        nodes = {r["node_code"]: r for r in
                 run_query("SELECT * FROM mm_nodes WHERE active = 1").to_dict(orient="records")}
        closed = {r["corridor"]: r for r in run_query(
            "SELECT * FROM mm_corridor_status WHERE active = 0").to_dict(orient="records")}
        links = []
        for r in run_query("SELECT * FROM mm_links WHERE active = 1").to_dict(orient="records"):
            if r["origin_code"] in nodes and r["dest_code"] in nodes:
                r["geometry"] = json.loads(r["geometry_json"])
                r["closed"] = r["corridor"] in closed
                r["closure_reason"] = closed[r["corridor"]]["reason"] if r["closed"] else None
                links.append(r)
        return cls(nodes=nodes, links=links)

    @property
    def closed_corridors(self) -> set:
        return {l["corridor"] for l in self.links if l.get("closed")}

    @property
    def corridors(self) -> set:
        return {l["corridor"] for l in self.links}

    def __post_init__(self):
        if not self.cities:
            for code, n in self.nodes.items():
                self.cities.setdefault(n["city"], []).append(code)

    # ------------------------------------------------------------------
    def resolve(self, place: str) -> list:
        """Código de nodo o nombre de ciudad (sin distinguir mayúsculas)."""
        if place in self.nodes:
            return [place]
        key = place.strip().lower()
        for city, codes in self.cities.items():
            if city.lower() == key:
                return codes
        for code in self.nodes:
            if code.lower() == key:
                return [code]
        raise RoutingError(f"Ubicación desconocida: '{place}'")

    def modes_at(self, code: str) -> set:
        return {l["mode"] for l in self.links if code in (l["origin_code"], l["dest_code"])}

    # ------------------------------------------------------------------
    def build_graph(self, weight_t: float, excluded: set = frozenset(),
                    allowed_modes: set | None = None) -> nx.DiGraph:
        G = nx.DiGraph()
        for l in self.links:
            o, d = l["origin_code"], l["dest_code"]
            if o in excluded or d in excluded or l["capacity_t"] < weight_t or l.get("closed"):
                continue
            if allowed_modes and l["mode"] not in allowed_modes:
                continue
            attrs = {
                "kind": "link", "mode": l["mode"], "link_id": l["link_id"],
                "corridor": l["corridor"], "distance_km": l["distance_km"], "time_h": l["time_h"],
                "cost": l["fixed_cost"] + l["cost_per_tkm"] * l["distance_km"] * weight_t,
            }
            m = l["mode"]
            G.add_edge((o, m), (d, _arrival(m)), **attrs, geometry=l["geometry"])
            if l["bidirectional"]:
                G.add_edge((d, m), (o, _arrival(m)), **attrs,
                           geometry=list(reversed(l["geometry"])))

        # Transbordos: de la llegada de un modo a la salida de otro
        modes_by_node: dict = {}
        for code, state in list(G.nodes):
            modes_by_node.setdefault(code, set()).add(_base_mode(state))
        for code, modes in modes_by_node.items():
            n = self.nodes[code]
            for m1 in modes:
                for m2 in modes:
                    if m1 != m2:
                        G.add_edge((code, _arrival(m1)), (code, m2), kind="transfer",
                                   mode=f"{m1}>{m2}", distance_km=0.0,
                                   time_h=n["transfer_time_h"],
                                   cost=n["transfer_cost_per_t"] * weight_t)
            if "aereo" in modes:
                G.add_edge((code, "aereo_arr"), (code, "aereo"), kind="transfer",
                           mode="aereo>aereo", distance_km=0.0,
                           time_h=n["transfer_time_h"] * AIR_CONNECTION_FACTOR,
                           cost=n["transfer_cost_per_t"] * AIR_CONNECTION_FACTOR * weight_t)
        return G

    # ------------------------------------------------------------------
    def route(self, origin: str, dest: str, weight_t: float = 10.0,
              priority: str = "balanceado", excluded: set = frozenset(),
              allowed_modes=None, required_corridors=None) -> dict:
        if priority not in PRIORITIES:
            raise RoutingError(f"Prioridad inválida: '{priority}'. Usa {', '.join(PRIORITIES)}.")
        if weight_t <= 0:
            raise RoutingError("El peso debe ser mayor que cero.")
        o_codes, d_codes = self.resolve(origin), self.resolve(dest)
        if set(o_codes) & set(d_codes):
            raise RoutingError("Origen y destino coinciden.")
        allowed = set(allowed_modes or [])
        required = list(dict.fromkeys(required_corridors or []))
        if len(required) > MAX_REQUIRED_CORRIDORS:
            raise RoutingError(f"Se pueden forzar como máximo {MAX_REQUIRED_CORRIDORS} vías.")
        unknown = [c for c in required if c not in self.corridors]
        if unknown:
            raise RoutingError(f"Vía desconocida: {', '.join(unknown)}.")
        blocked = [c for c in required if c in self.closed_corridors]
        if blocked:
            raise RoutingError(f"La vía forzada está cerrada: {', '.join(blocked)}.")

        G = self.build_graph(weight_t, excluded, allowed)
        for code, state in list(G.nodes):
            # Se sale desde un estado de salida y se llega a uno de llegada
            if code in o_codes and not state.endswith("_arr"):
                G.add_edge(_SRC, (code, state), kind="virtual", time_h=0.0, cost=0.0, distance_km=0.0)
            if code in d_codes and state == _arrival(_base_mode(state)):
                G.add_edge((code, state), _DST, kind="virtual", time_h=0.0, cost=0.0, distance_km=0.0)
        if _SRC not in G or _DST not in G:
            raise RoutingError("No hay enlaces que admitan esta carga en el origen o el destino.")

        vot = VALUE_OF_TIME_USD_PER_T_H * weight_t

        def weight(_u, _v, e):
            if priority == "tiempo":
                # Desempate por costo para no elegir rutas absurdamente caras
                return e["time_h"] + e["cost"] * 1e-6
            if priority == "costo":
                return e["cost"] + e["time_h"] * 1e-3
            return e["cost"] + vot * e["time_h"]

        try:
            if required:
                path = self._path_through(G, required, weight)
            else:
                path = nx.dijkstra_path(G, _SRC, _DST, weight=weight)
        except (nx.NetworkXNoPath, nx.NodeNotFound):
            extra = " con las restricciones indicadas" if (allowed or required) else ""
            raise RoutingError(
                f"No existe ruta multimodal de {origin} a {dest} para {weight_t:g} t{extra}.")
        return self._assemble(G, path, origin, dest, weight_t, priority)

    @staticmethod
    def _path_through(G: nx.DiGraph, required: list, weight) -> list:
        """Camino más corto que recorre cada corredor de `required`: grafo por
        capas (estado, máscara de corredores recorridos)."""
        bit = {c: 1 << i for i, c in enumerate(required)}
        full = (1 << len(required)) - 1
        H = nx.DiGraph()
        for u, v, e in G.edges(data=True):
            w = weight(u, v, e)
            add = bit.get(e.get("corridor"), 0) if e["kind"] == "link" else 0
            for mask in range(full + 1):
                H.add_edge((u, mask), (v, mask | add), w=w)
        layered = nx.dijkstra_path(H, (_SRC, 0), (_DST, full), weight="w")
        return [state for state, _mask in layered]

    def compare(self, origin: str, dest: str, weight_t: float = 10.0) -> list:
        """La misma consulta con las tres prioridades (para comparar alternativas)."""
        out = []
        for p in PRIORITIES:
            try:
                out.append(self.route(origin, dest, weight_t, p))
            except RoutingError as exc:
                out.append({"priority": p, "found": False, "error": str(exc)})
        return out

    # ------------------------------------------------------------------
    def _node_brief(self, code: str) -> dict:
        n = self.nodes[code]
        return {"code": code, "name": n["name"], "city": n["city"], "kind": n["kind"],
                "lat": n["latitude"], "lon": n["longitude"]}

    def _assemble(self, G, path, origin, dest, weight_t, priority) -> dict:
        """Agrupa aristas consecutivas del mismo modo en tramos (legs) y
        construye la línea de tiempo para animar el recorrido."""
        legs, transfers, timeline = [], [], []
        clock = 0.0
        current = None
        for u, v in zip(path, path[1:]):
            e = G[u][v]
            if e["kind"] == "virtual":
                continue
            if e["kind"] == "transfer":
                if current:
                    legs.append(current)
                    current = None
                code = u[0]
                transfers.append({
                    "node": self._node_brief(code), "from_mode": _base_mode(u[1]),
                    "to_mode": _base_mode(v[1]),
                    "start_h": clock, "time_h": e["time_h"], "cost": e["cost"],
                })
                lon, lat = self.nodes[code]["longitude"], self.nodes[code]["latitude"]
                timeline.append({"lon": lon, "lat": lat, "t_h": clock, "mode": "transbordo"})
                clock += e["time_h"]
                timeline.append({"lon": lon, "lat": lat, "t_h": clock, "mode": "transbordo"})
                continue

            mode = e["mode"]
            if current is None or current["mode"] != mode:
                if current:
                    legs.append(current)
                current = {"mode": mode, "from": self._node_brief(u[0]), "corridors": [],
                           "distance_km": 0.0, "time_h": 0.0, "cost": 0.0, "start_h": clock,
                           "path": [], "stops": [u[0]]}
            if e["corridor"] not in current["corridors"]:
                current["corridors"].append(e["corridor"])
            geom = e["geometry"]
            # Tiempos a lo largo del trazado, proporcionales a la distancia
            seg = [haversine_km(a[1], a[0], b[1], b[0]) for a, b in zip(geom, geom[1:])]
            total = sum(seg) or 1.0
            t = clock
            pts = geom if not current["path"] else geom[1:]
            if not current["path"]:
                timeline.append({"lon": geom[0][0], "lat": geom[0][1], "t_h": t, "mode": mode})
            for (lon, lat), s in zip(geom[1:], seg):
                t += e["time_h"] * s / total
                timeline.append({"lon": lon, "lat": lat, "t_h": t, "mode": mode})
            current["path"].extend(pts)
            # Segmento por enlace: permite cortar el tramo en el nodo exacto
            # si una de sus vías se cierra (ver operations.reroute)
            current.setdefault("segments", []).append({
                "from": u[0], "to": v[0], "corridor": e["corridor"], "start_h": clock,
                "end_h": clock + e["time_h"], "time_h": e["time_h"],
                "distance_km": e["distance_km"], "cost": e["cost"]})
            current["distance_km"] += e["distance_km"]
            current["time_h"] += e["time_h"]
            current["cost"] += e["cost"]
            current["to"] = self._node_brief(v[0])
            current["stops"].append(v[0])
            clock += e["time_h"]
        if current:
            legs.append(current)

        for leg in legs:
            leg["end_h"] = leg["start_h"] + leg["time_h"]

        total_cost = sum(l["cost"] for l in legs) + sum(t["cost"] for t in transfers)
        return {
            "found": True,
            "origin": origin, "destination": dest, "weight_t": weight_t, "priority": priority,
            "modes": [l["mode"] for l in legs],
            "n_transfers": len(transfers),
            "distance_km": sum(l["distance_km"] for l in legs),
            "time_h": clock,
            "cost": total_cost,
            "legs": legs,
            "transfers": transfers,
            "timeline": timeline,
        }


def network_from_definitions(nodes: list, links: list) -> MultimodalNetwork:
    """Construye la red en memoria (sin base de datos), útil para pruebas."""
    return MultimodalNetwork(nodes={n["node_code"]: n for n in nodes}, links=links)
