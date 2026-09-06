"""
map_utils.py
Construcción de capas pydeck (puntos + arcos) para representar la topología
real de la red de distribución sobre un mapa geográfico.
"""
import pydeck as pdk
import pandas as pd

NODE_COLORS = {
    "Planta": [230, 57, 70],
    "Almacen": [69, 123, 157],
    "CD": [42, 157, 143],
    "Cliente": [244, 162, 97],
    "Hub": [138, 43, 226],
    "Gateway": [0, 0, 0],
}


def build_network_deck(nodes: list, corridors: list, highlight_path: list = None) -> pdk.Deck:
    node_df = pd.DataFrame(nodes)
    if node_df.empty:
        node_df = pd.DataFrame(columns=["latitude", "longitude", "name", "node_type"])
    node_df["color"] = node_df["node_type"].map(lambda t: NODE_COLORS.get(t, [100, 100, 100]))

    arc_rows = []
    for c in corridors:
        arc_rows.append({
            "from_lon": c["origin_lon"], "from_lat": c["origin_lat"],
            "to_lon": c["dest_lon"], "to_lat": c["dest_lat"],
            "distance_km": c["distance_km"], "mode": c["mode"],
            "origin_name": c["origin_name"], "dest_name": c["dest_name"],
        })
    arc_df = pd.DataFrame(arc_rows)

    layers = []
    if not arc_df.empty:
        layers.append(pdk.Layer(
            "ArcLayer", data=arc_df,
            get_source_position=["from_lon", "from_lat"],
            get_target_position=["to_lon", "to_lat"],
            get_width=3, get_source_color=[100, 149, 237, 160],
            get_target_color=[100, 149, 237, 160], pickable=True,
        ))

    if highlight_path and len(highlight_path) > 1:
        path_rows = []
        id_to_coord = {n["node_id"]: (n["longitude"], n["latitude"]) for n in nodes}
        for i in range(len(highlight_path) - 1):
            a, b = highlight_path[i], highlight_path[i + 1]
            if a in id_to_coord and b in id_to_coord:
                path_rows.append({"from_lon": id_to_coord[a][0], "from_lat": id_to_coord[a][1],
                                   "to_lon": id_to_coord[b][0], "to_lat": id_to_coord[b][1]})
        if path_rows:
            layers.append(pdk.Layer(
                "ArcLayer", data=pd.DataFrame(path_rows),
                get_source_position=["from_lon", "from_lat"],
                get_target_position=["to_lon", "to_lat"],
                get_width=6, get_source_color=[255, 0, 0, 220], get_target_color=[255, 140, 0, 220],
            ))

    if not node_df.empty:
        layers.append(pdk.Layer(
            "ScatterplotLayer", data=node_df,
            get_position=["longitude", "latitude"],
            get_fill_color="color", get_radius=15000, pickable=True,
            stroked=True, get_line_color=[255, 255, 255], line_width_min_pixels=1,
        ))
        text_df = node_df.copy()
        layers.append(pdk.Layer(
            "TextLayer", data=text_df, get_position=["longitude", "latitude"],
            get_text="name", get_size=13, get_color=[20, 20, 20],
            get_pixel_offset=[0, -18],
        ))

    if not node_df.empty:
        view_state = pdk.ViewState(
            latitude=float(node_df["latitude"].mean()),
            longitude=float(node_df["longitude"].mean()),
            zoom=5, pitch=30,
        )
    else:
        view_state = pdk.ViewState(latitude=4.6, longitude=-74.1, zoom=4)

    tooltip = {"html": "<b>{name}</b><br/>{node_type}", "style": {"color": "white"}}
    return pdk.Deck(layers=layers, initial_view_state=view_state, tooltip=tooltip,
                     map_provider="carto", map_style="light")
