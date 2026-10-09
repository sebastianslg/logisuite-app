"""
map_utils.py
Motor de mapas WebGL (pydeck / deck.gl) de LogiSuite.

- `build_network_deck()`: construye el Deck de la red (nodos, corredores 3D,
  ruta resaltada, columnas de volumen). Lo usan Transporte y Simulación.
- `render_colombia_network_map()`: lo pinta a todo el ancho, centrado en
  Colombia, con los fletes activos resaltados. Si no recibe datos, los lee de
  la base.

El mapa base es CARTO Dark Matter, que no requiere token. Si existe la
variable de entorno MAPBOX_API_KEY se usa mapbox://styles/mapbox/dark-v11.
"""
import json
import os

import pandas as pd
import pydeck as pdk

# Vista inicial: Colombia completa, con inclinación para que los arcos y las
# columnas se lean en 3D.
COLOMBIA_VIEW = {"latitude": 4.57, "longitude": -74.29, "zoom": 5.5, "pitch": 45, "bearing": 0}

# Colores RGBA por tipo de nodo (paleta de utils/theme.py)
NODE_COLORS = {
    "CD": [0, 242, 254, 235],        # CEDI: cyan
    "Gateway": [79, 172, 254, 245],  # Puerto: azul eléctrico
    "Hub": [16, 185, 129, 235],      # Hub: esmeralda
    "Almacen": [139, 92, 246, 230],  # Almacén: violeta
    "Planta": [245, 158, 11, 230],   # Planta: ámbar
    "Cliente": [148, 163, 184, 200], # Cliente: gris pizarra
}
NODE_LABELS = {"CD": "CEDI", "Gateway": "Puerto", "Hub": "Hub logístico",
               "Almacen": "Almacén", "Planta": "Planta", "Cliente": "Cliente"}
# Radio en metros: los puertos se ven más grandes que los CEDIs.
NODE_RADIUS = {"Gateway": 26000, "CD": 18000, "Hub": 14000, "Almacen": 13000,
               "Planta": 13000, "Cliente": 8000}

MODE_COLORS = {
    "Terrestre": ([16, 185, 129, 150], [0, 242, 254, 150]),   # esmeralda -> cyan
    "Maritimo": ([79, 172, 254, 170], [139, 92, 246, 170]),   # azul -> violeta
    "Fluvial": ([34, 211, 238, 150], [79, 172, 254, 150]),
    "Aereo": ([245, 158, 11, 160], [244, 63, 94, 160]),
}

TOOLTIP = {
    "html": "{tip}",
    "style": {
        "backgroundColor": "rgba(15,23,42,0.92)", "color": "#F8FAFC",
        "fontFamily": "Inter, sans-serif", "fontSize": "12px",
        "border": "1px solid rgba(0,242,254,0.35)", "borderRadius": "8px",
        "padding": "8px 10px", "boxShadow": "0 8px 24px rgba(0,0,0,0.45)",
    },
}


def _base_map() -> dict:
    """Proveedor y estilo del mapa base oscuro (sin token si no hay Mapbox)."""
    if os.environ.get("MAPBOX_API_KEY"):
        return {"map_provider": "mapbox", "map_style": "mapbox://styles/mapbox/dark-v11",
                "api_keys": {"mapbox": os.environ["MAPBOX_API_KEY"]}}
    return {"map_provider": "carto", "map_style": pdk.map_styles.CARTO_DARK}


def _node_tip(n: dict) -> str:
    label = NODE_LABELS.get(n.get("node_type"), n.get("node_type", ""))
    city = n.get("city") or ""
    return (f"<b style='color:#00F2FE'>{n.get('name', '')}</b><br/>"
            f"<span style='color:#94A3B8'>{label}{' · ' + city if city else ''}</span><br/>"
            f"<span style='color:#64748B'>{n.get('latitude', 0):.4f}, {n.get('longitude', 0):.4f}</span>")


def _corridor_tip(c: dict) -> str:
    return (f"<b>{c['origin_name']} ↔ {c['dest_name']}</b><br/>"
            f"<span style='color:#94A3B8'>{c['mode']} · {c['distance_km']:,.0f} km · "
            f"{c.get('transit_time_h', 0):,.1f} h</span>")


def _segments(path: list, coords: dict) -> list:
    rows = []
    for a, b in zip(path, path[1:]):
        if a in coords and b in coords:
            rows.append({"from_lon": coords[a][0], "from_lat": coords[a][1],
                         "to_lon": coords[b][0], "to_lat": coords[b][1]})
    return rows


def build_network_deck(nodes: list, corridors: list, highlight_path: list = None,
                       active_paths: list = None, node_volume: dict = None,
                       show_labels: bool = True, view: dict = None) -> pdk.Deck:
    """Deck de la red logística.

    nodes / corridors: salida de Node.all() / Corridor.all().
    highlight_path: lista de node_id de una ruta a resaltar (ej. Dijkstra).
    active_paths: lista de dicts {"path": [node_id...], "label": str} con los
        fletes en curso; se dibujan como arcos cyan brillantes.
    node_volume: {node_id: valor} para extruir columnas 3D sobre los nodos
        (ej. toneladas despachadas o capacidad del CEDI).
    """
    node_df = pd.DataFrame(nodes)
    coords = {}
    if not node_df.empty:
        node_df["color"] = node_df["node_type"].map(lambda t: NODE_COLORS.get(t, [148, 163, 184, 200]))
        node_df["radius"] = node_df["node_type"].map(lambda t: NODE_RADIUS.get(t, 10000))
        node_df["tip"] = [_node_tip(r) for r in node_df.to_dict(orient="records")]
        coords = {r["node_id"]: (r["longitude"], r["latitude"]) for r in nodes}

    layers = []

    # 1. Corredores viales / marítimos como arcos 3D
    if corridors:
        arc_df = pd.DataFrame([{
            "from_lon": c["origin_lon"], "from_lat": c["origin_lat"],
            "to_lon": c["dest_lon"], "to_lat": c["dest_lat"],
            "src_color": MODE_COLORS.get(c["mode"], MODE_COLORS["Terrestre"])[0],
            "dst_color": MODE_COLORS.get(c["mode"], MODE_COLORS["Terrestre"])[1],
            "height": 0.9 if c["mode"] == "Maritimo" else 0.35,
            "tip": _corridor_tip(c),
        } for c in corridors])
        layers.append(pdk.Layer(
            "ArcLayer", data=arc_df, id="corredores",
            get_source_position=["from_lon", "from_lat"],
            get_target_position=["to_lon", "to_lat"],
            get_source_color="src_color", get_target_color="dst_color",
            get_height="height", get_width=2.2, width_min_pixels=1.5,
            great_circle=False, pickable=True, auto_highlight=True,
            highlight_color=[0, 242, 254, 255],
        ))

    # 2. Fletes activos: halo ancho translúcido + arco brillante encima
    if active_paths and coords:
        rows = []
        for ap in active_paths:
            for seg in _segments(ap.get("path", []), coords):
                seg["tip"] = ap.get("label", "Flete activo")
                rows.append(seg)
        if rows:
            active_df = pd.DataFrame(rows)
            for layer_id, width, alpha in (("fletes-halo", 10, 45), ("fletes", 3.5, 255)):
                layers.append(pdk.Layer(
                    "ArcLayer", data=active_df, id=layer_id,
                    get_source_position=["from_lon", "from_lat"],
                    get_target_position=["to_lon", "to_lat"],
                    get_source_color=[0, 242, 254, alpha], get_target_color=[16, 185, 129, alpha],
                    get_height=0.5, get_width=width, width_min_pixels=2,
                    pickable=layer_id == "fletes",
                ))

    # 3. Ruta resaltada (resultado del optimizador)
    if highlight_path and len(highlight_path) > 1 and coords:
        rows = _segments(highlight_path, coords)
        if rows:
            hl_df = pd.DataFrame(rows)
            hl_df["tip"] = "<b style='color:#F59E0B'>Ruta óptima</b>"
            layers.append(pdk.Layer(
                "ArcLayer", data=hl_df, id="ruta-optima",
                get_source_position=["from_lon", "from_lat"],
                get_target_position=["to_lon", "to_lat"],
                get_source_color=[245, 158, 11, 255], get_target_color=[244, 63, 94, 255],
                get_height=0.6, get_width=6, width_min_pixels=3, pickable=True,
            ))

    if not node_df.empty:
        # 4. Columnas 3D con el volumen de cada nodo
        if node_volume:
            col_df = node_df[node_df["node_id"].isin(node_volume.keys())].copy()
            if not col_df.empty:
                max_v = max(node_volume.values()) or 1
                col_df["elevation"] = col_df["node_id"].map(lambda i: 160000 * node_volume[i] / max_v)
                col_df["tip"] = [f"{t}<br/><span style='color:#10B981'>Volumen: {node_volume[i]:,.0f}</span>"
                                 for t, i in zip(col_df["tip"], col_df["node_id"])]
                layers.append(pdk.Layer(
                    "ColumnLayer", data=col_df, id="volumen",
                    get_position=["longitude", "latitude"], get_elevation="elevation",
                    elevation_scale=1, radius=9000, disk_resolution=24, extruded=True,
                    get_fill_color=[0, 242, 254, 90], pickable=True, auto_highlight=True,
                ))

        # 5. Halo exterior de CEDIs y puertos
        halo_df = node_df[node_df["node_type"].isin(["CD", "Gateway"])].copy()
        if not halo_df.empty:
            halo_df["halo_radius"] = halo_df["radius"] * 2.4
            halo_df["halo_color"] = halo_df["color"].map(lambda c: c[:3] + [38])
            layers.append(pdk.Layer(
                "ScatterplotLayer", data=halo_df, id="halo",
                get_position=["longitude", "latitude"], get_radius="halo_radius",
                get_fill_color="halo_color", stroked=False, pickable=False,
            ))

        # 6. Nodos
        layers.append(pdk.Layer(
            "ScatterplotLayer", data=node_df, id="nodos",
            get_position=["longitude", "latitude"], get_radius="radius",
            radius_min_pixels=3, radius_max_pixels=22,
            get_fill_color="color", stroked=True, get_line_color=[10, 14, 23, 255],
            line_width_min_pixels=1.5, pickable=True, auto_highlight=True,
            highlight_color=[255, 255, 255, 120],
        ))

        # 7. Etiquetas de CEDIs y puertos
        if show_labels:
            text_df = node_df[node_df["node_type"].isin(["CD", "Gateway", "Hub"])].copy()
            if not text_df.empty:
                text_df["label"] = text_df["name"].str.replace(r"\s*\(.*\)", "", regex=True)
                layers.append(pdk.Layer(
                    "TextLayer", data=text_df, id="etiquetas",
                    get_position=["longitude", "latitude"], get_text="label",
                    get_size=12, get_color=[226, 232, 240, 230], get_pixel_offset=[0, -22],
                    font_family="Inter, sans-serif", font_weight=600,
                    character_set="auto", billboard=True,
                    font_settings={"sdf": True}, outline_width=2,
                    outline_color=[10, 14, 23, 255],
                ))

    view_state = pdk.ViewState(**(view or COLOMBIA_VIEW))
    return pdk.Deck(layers=layers, initial_view_state=view_state, tooltip=TOOLTIP,
                    **_base_map())


def load_active_paths() -> list:
    """Fletes en curso (En Tránsito / Retrasado) con el camino que les calculó
    el ruteador, para dibujarlos sobre el mapa."""
    from database.db import run_query
    df = run_query("""
        SELECT s.shipment_id, s.status, s.weight_kg, no.name AS origen, nd.name AS destino,
               r.path_json, v.plate
        FROM shipments s
        JOIN routes r ON r.shipment_id = s.shipment_id
        JOIN nodes no ON no.node_id = s.origin_node_id
        JOIN nodes nd ON nd.node_id = s.dest_node_id
        LEFT JOIN vehicles v ON v.vehicle_id = r.vehicle_id
        WHERE s.status IN ('En Transito', 'Retrasado')
    """)
    paths = []
    for r in df.to_dict(orient="records"):
        try:
            path = json.loads(r["path_json"])
        except (TypeError, ValueError):
            continue
        color = "#F43F5E" if r["status"] == "Retrasado" else "#00F2FE"
        label = (f"<b style='color:{color}'>Flete #{r['shipment_id']} · {r['status']}</b><br/>"
                 f"{r['origen']} → {r['destino']}<br/>"
                 f"<span style='color:#94A3B8'>{r['weight_kg'] / 1000:,.1f} t"
                 f"{' · ' + r['plate'] if r.get('plate') else ''}</span>")
        paths.append({"path": path, "label": label})
    return paths


def load_node_volume() -> dict:
    """Toneladas movidas (salida + llegada) por nodo, para las columnas 3D."""
    from database.db import run_query
    df = run_query("""
        SELECT node_id, SUM(t) AS t FROM (
            SELECT origin_node_id AS node_id, weight_kg / 1000.0 AS t FROM shipments
            UNION ALL
            SELECT dest_node_id AS node_id, weight_kg / 1000.0 AS t FROM shipments)
        GROUP BY node_id
    """)
    return {int(r["node_id"]): float(r["t"]) for r in df.to_dict(orient="records") if r["t"]}


def render_colombia_network_map(nodes: list = None, corridors: list = None,
                                highlight_path: list = None, show_active: bool = True,
                                show_volume: bool = True, height: int = 620) -> None:
    """Pinta la red logística de Colombia a todo el ancho con pydeck."""
    import streamlit as st
    if nodes is None or corridors is None:
        from models.network import Node, Corridor
        nodes = Node.all() if nodes is None else nodes
        corridors = Corridor.all() if corridors is None else corridors
    deck = build_network_deck(
        nodes, corridors, highlight_path=highlight_path,
        active_paths=load_active_paths() if show_active else None,
        node_volume=load_node_volume() if show_volume else None,
    )
    st.pydeck_chart(deck, use_container_width=True, height=height)


def map_legend_html() -> str:
    """Leyenda compacta en HTML para acompañar el mapa."""
    items = [("CEDI", NODE_COLORS["CD"]), ("Puerto", NODE_COLORS["Gateway"]),
             ("Hub", NODE_COLORS["Hub"]), ("Cliente", NODE_COLORS["Cliente"])]
    dots = "".join(
        f"<span style='display:inline-flex;align-items:center;gap:6px;margin-right:16px;"
        f"font-size:0.8rem;color:#94A3B8'><span style='width:10px;height:10px;border-radius:50%;"
        f"background:rgb({c[0]},{c[1]},{c[2]});box-shadow:0 0 8px rgb({c[0]},{c[1]},{c[2]})'></span>"
        f"{label}</span>" for label, c in items)
    lines = ("<span style='display:inline-flex;align-items:center;gap:6px;margin-right:16px;"
             "font-size:0.8rem;color:#94A3B8'><span style='width:22px;height:3px;border-radius:2px;"
             "background:linear-gradient(90deg,#10B981,#00F2FE)'></span>Corredor vial</span>"
             "<span style='display:inline-flex;align-items:center;gap:6px;margin-right:16px;"
             "font-size:0.8rem;color:#94A3B8'><span style='width:22px;height:3px;border-radius:2px;"
             "background:linear-gradient(90deg,#4FACFE,#8B5CF6)'></span>Ruta marítima</span>"
             "<span style='display:inline-flex;align-items:center;gap:6px;"
             "font-size:0.8rem;color:#94A3B8'><span style='width:22px;height:3px;border-radius:2px;"
             "background:#00F2FE;box-shadow:0 0 6px #00F2FE'></span>Flete activo</span>")
    return f"<div style='margin:6px 0 10px 0'>{dots}{lines}</div>"
