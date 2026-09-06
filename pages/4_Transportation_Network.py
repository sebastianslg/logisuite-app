"""
Módulo 3 - Transportation Management: mapa geográfico interactivo de la red,
planificación de rutas (Dijkstra: distancia mínima / costo mínimo), asignación
de vehículo y conductor, y control de tiempos ETA vs. reales.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import streamlit as st
import pandas as pd

from models.network import Node, Corridor
from models.freight import Shipment
from models.fleet import Vehicle, Driver
from models.transportation import Route
from utils.network_algorithms import build_graph, shortest_path
from utils.map_utils import build_network_deck

st.set_page_config(page_title="Transportation Network", page_icon="🗺️", layout="wide")
st.title("🗺️ Transportation Management")
st.caption("Topología real de la red, optimización de rutas y asignación de recursos.")

nodes = Node.all()
corridors = Corridor.all()

tab1, tab2, tab3 = st.tabs(["🗺️ Mapa de la red", "🧭 Planificar ruta", "🚦 Rutas y asignación"])

with tab1:
    st.subheader("Mapa geográfico de la red de distribución")
    legend_cols = st.columns(6)
    colors = {"Planta": "🔴", "Almacen": "🔵", "CD": "🟢", "Cliente": "🟠", "Hub": "🟣", "Gateway": "⚫"}
    for i, (k, v) in enumerate(colors.items()):
        legend_cols[i].markdown(f"{v} {k}")
    deck = build_network_deck(nodes, corridors)
    st.pydeck_chart(deck, use_container_width=True)
    st.caption(f"{len(nodes)} nodos activos · {len(corridors)} corredores de transporte")

with tab2:
    st.subheader("Planificación de rutas (algoritmo de menor distancia / menor costo)")
    node_map = {n["node_id"]: f"{n['name']} ({n['node_type']})" for n in nodes}
    c1, c2, c3 = st.columns(3)
    origin = c1.selectbox("Origen", options=list(node_map.keys()), format_func=lambda x: node_map[x], key="o1")
    dest = c2.selectbox("Destino", options=list(node_map.keys()), format_func=lambda x: node_map[x], key="d1")
    criterion = c3.selectbox("Optimizar por", options=["distance", "cost"],
                              format_func=lambda x: "Menor distancia" if x == "distance" else "Menor costo")

    if st.button("Calcular ruta óptima", type="primary"):
        G = build_graph(nodes, corridors)
        result = shortest_path(G, origin, dest, weight=criterion)
        if result["found"]:
            st.session_state["last_route"] = result
            path_names = [node_map[n] for n in result["path"]]
            st.success(" → ".join(path_names))
            m1, m2, m3 = st.columns(3)
            m1.metric("Distancia total", f"{result['distance_km']} km")
            m2.metric("Costo total", f"${result['cost']:,.2f}")
            m3.metric("Tiempo estimado", f"{result['time_h']} h")
        else:
            st.error("No existe una ruta disponible entre estos nodos con los corredores activos.")

    if "last_route" in st.session_state and st.session_state["last_route"]["found"]:
        st.markdown("**Ruta resaltada en el mapa:**")
        deck2 = build_network_deck(nodes, corridors, highlight_path=st.session_state["last_route"]["path"])
        st.pydeck_chart(deck2, use_container_width=True)

with tab3:
    st.subheader("Rutas registradas · asignación de vehículo/conductor y ETA vs. real")
    routes = Route.all()
    if routes:
        rdf = pd.DataFrame(routes)
        rdf["ruta"] = rdf["path"].apply(lambda p: " → ".join(str(x) for x in p))
        show = rdf[["route_id", "shipment_id", "algorithm", "total_distance_km", "total_cost",
                     "eta_hours", "actual_hours", "desviacion_pct", "plate", "driver_name"]]
        show.columns = ["Ruta", "Envío", "Algoritmo", "Distancia (km)", "Costo", "ETA (h)",
                        "Tiempo Real (h)", "Desviación %", "Vehículo", "Conductor"]
        st.dataframe(show, use_container_width=True, hide_index=True)

        st.markdown("#### Asignar vehículo y conductor a una ruta")
        vehicles = [v for v in Vehicle.all() if v["status"] == "Disponible"]
        drivers = [d for d in Driver.all() if d["status"] == "Activo"]
        if vehicles and drivers:
            c1, c2, c3 = st.columns(3)
            route_id = c1.selectbox("Ruta", options=rdf["route_id"].tolist())
            veh_map = {v["vehicle_id"]: f"{v['plate']} ({v['vehicle_type']})" for v in vehicles}
            drv_map = {d["driver_id"]: d["name"] for d in drivers}
            veh_id = c2.selectbox("Vehículo disponible", options=list(veh_map.keys()), format_func=lambda x: veh_map[x])
            drv_id = c3.selectbox("Conductor activo", options=list(drv_map.keys()), format_func=lambda x: drv_map[x])
            if st.button("Asignar", type="primary"):
                Route.assign_vehicle_driver(route_id, veh_id, drv_id)
                st.success("Vehículo y conductor asignados. Vehículo marcado 'En Ruta'.")
                st.rerun()
        else:
            st.warning("No hay vehículos disponibles o conductores activos para asignar.")

        st.markdown("#### Registrar tiempo real de entrega (control ETA vs. real)")
        route_id2 = st.selectbox("Ruta a actualizar", options=rdf["route_id"].tolist(), key="rt2")
        actual_h = st.number_input("Tiempo real de tránsito (horas)", min_value=0.0, value=10.0)
        if st.button("Registrar tiempo real"):
            Route.register_actual_time(route_id2, actual_h)
            st.success("Tiempo real registrado.")
            st.rerun()
    else:
        st.info("No hay rutas registradas todavía. Registra un envío en Freight Management primero.")
