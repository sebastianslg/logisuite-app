"""
Núcleo de diseño de red / Herramientas de simulación:
  - Impacto de agregar o eliminar un nodo (ej. cerrar un CD) sobre distancia
    promedio, costo total y nivel de servicio.
  - Análisis de sensibilidad ante fluctuaciones de demanda, costos laborales
    y materias primas (aplicado sobre el motor de costos de Freight Management).
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import streamlit as st
import pandas as pd
import plotly.graph_objects as go

from models.network import Node, Corridor
from utils.network_algorithms import simulate_node_removal, build_graph, network_stats
from utils.map_utils import build_network_deck
from models.freight import compute_transport_cost, DEFAULT_COST_PARAMS

st.set_page_config(page_title="Simulación de Red", page_icon="🔬", layout="wide")
st.title("🔬 Herramientas de Simulación y Análisis de Red")

nodes = Node.all()
corridors = Corridor.all()

tab1, tab2 = st.tabs(["🏭 Simular cierre/apertura de nodo", "📉 Sensibilidad de costos"])

with tab1:
    st.subheader("Impacto de eliminar un nodo de la red")
    st.caption("Simula, por ejemplo, el cierre de un Centro de Distribución y observa el "
               "efecto inmediato sobre la distancia promedio, el costo total de la red y el "
               "nivel de servicio (cobertura de clientes alcanzables).")

    removable = [n for n in nodes if n["node_type"] != "Cliente"]
    node_map = {n["node_id"]: f"{n['name']} ({n['node_type']})" for n in removable}
    node_to_remove = st.selectbox("Nodo a simular su cierre", options=list(node_map.keys()),
                                   format_func=lambda x: node_map[x])

    if st.button("▶️ Ejecutar simulación", type="primary"):
        result = simulate_node_removal(nodes, corridors, node_to_remove)
        st.session_state["sim_result"] = result
        st.session_state["sim_node"] = node_to_remove

    if "sim_result" in st.session_state:
        r = st.session_state["sim_result"]
        st.markdown(f"### Resultado: cierre de **{node_map.get(st.session_state['sim_node'], '')}**")
        c1, c2, c3 = st.columns(3)
        c1.metric("Δ Distancia promedio", f"{r['delta_avg_distance_km']} km" if r['delta_avg_distance_km'] is not None else "N/D",
                   delta=r['delta_avg_distance_km'])
        c2.metric("Δ Costo total de la red", f"${r['delta_total_cost']:,.0f}" if r['delta_total_cost'] is not None else "N/D",
                   delta=r['delta_total_cost'])
        c3.metric("Δ Nivel de servicio", f"{r['delta_service_level_pct']} pp" if r['delta_service_level_pct'] is not None else "N/D",
                   delta=r['delta_service_level_pct'])

        comp_df = pd.DataFrame({
            "Métrica": ["Distancia promedio (km)", "Costo total de la red (USD)", "Nivel de servicio (%)"],
            "Antes": [r["before"]["avg_distance_km"], r["before"]["total_network_cost"], r["before"]["service_level_pct"]],
            "Después": [r["after"]["avg_distance_km"], r["after"]["total_network_cost"], r["after"]["service_level_pct"]],
        })
        st.dataframe(comp_df, use_container_width=True, hide_index=True)

        fig = go.Figure(data=[
            go.Bar(name="Antes", x=comp_df["Métrica"], y=comp_df["Antes"], marker_color="#264653"),
            go.Bar(name="Después", x=comp_df["Métrica"], y=comp_df["Después"], marker_color="#E76F51"),
        ])
        fig.update_layout(barmode="group", height=400)
        st.plotly_chart(fig, use_container_width=True)

        st.markdown("#### Mapa de la red sin el nodo simulado")
        remaining_nodes = [n for n in nodes if n["node_id"] != st.session_state["sim_node"]]
        remaining_corridors = [c for c in corridors if c["origin_node_id"] != st.session_state["sim_node"]
                                and c["dest_node_id"] != st.session_state["sim_node"]]
        st.pydeck_chart(build_network_deck(remaining_nodes, remaining_corridors), use_container_width=True)
    else:
        st.info("Selecciona un nodo y ejecuta la simulación para ver el impacto.")

with tab2:
    st.subheader("📉 Análisis de sensibilidad de costos de transporte")
    st.caption("Evalúa cómo varía el costo total de un envío tipo ante fluctuaciones porcentuales "
               "en demanda (peso/volumen), costos laborales (componente tiempo) y materias "
               "primas / energía (componente distancia-energía).")

    c1, c2, c3 = st.columns(3)
    base_weight = c1.number_input("Peso base (kg)", value=5000.0)
    base_volume = c1.number_input("Volumen base (m3)", value=20.0)
    base_distance = c2.number_input("Distancia (km)", value=500.0)
    base_time = c2.number_input("Tiempo de tránsito (h)", value=10.0)
    base_value = c3.number_input("Valor declarado (USD)", value=15000.0)
    base_units = c3.number_input("Unidades de carga", value=6, step=1)

    st.markdown("##### Rango de variación a simular")
    demand_range = st.slider("Variación de demanda (peso/volumen) %", -50, 100, (-20, 40), step=5)
    labor_range = st.slider("Variación de costo laboral (tiempo) %", -50, 100, (-20, 40), step=5)
    energy_range = st.slider("Variación de costo energético/materias primas %", -50, 100, (-20, 40), step=5)

    steps = list(range(demand_range[0], demand_range[1] + 1, 10))
    rows = []
    for pct in steps:
        params = dict(DEFAULT_COST_PARAMS)
        params["time_cost_per_hour"] *= (1 + labor_range[1] / 100.0) if pct == steps[-1] else params["time_cost_per_hour"]
        params["energy_cost_per_km_ton"] *= (1 + energy_range[1] / 100.0) if pct == steps[-1] else params["energy_cost_per_km_ton"]
        result = compute_transport_cost(
            base_distance, base_time, base_weight * (1 + pct / 100.0),
            base_volume * (1 + pct / 100.0), int(base_units), base_value, params=params,
        )
        rows.append({"Variacion_demanda_pct": pct, "Costo_total": result["total_cost"],
                     "Friccion_distancia": result["distance_friction_cost"],
                     "Costo_transaccion": result["transaction_cost"],
                     "Costo_envio": result["shipment_cost"]})
    sens_df = pd.DataFrame(rows)

    fig2 = go.Figure()
    fig2.add_trace(go.Scatter(x=sens_df["Variacion_demanda_pct"], y=sens_df["Costo_total"],
                               mode="lines+markers", name="Costo Total", line=dict(color="#E76F51", width=3)))
    fig2.add_trace(go.Scatter(x=sens_df["Variacion_demanda_pct"], y=sens_df["Friccion_distancia"],
                               mode="lines+markers", name="Fricción de Distancia", line=dict(color="#2A9D8F")))
    fig2.add_trace(go.Scatter(x=sens_df["Variacion_demanda_pct"], y=sens_df["Costo_envio"],
                               mode="lines+markers", name="Costo del Envío", line=dict(color="#264653")))
    fig2.update_layout(xaxis_title="Variación de demanda (%)", yaxis_title="Costo (USD)", height=450,
                        legend=dict(orientation="h", y=1.1))
    st.plotly_chart(fig2, use_container_width=True)
    st.caption("Nota: el último punto del rango incorpora además los extremos superiores de "
               "variación de costo laboral y energético seleccionados en los sliders, para "
               "ilustrar el efecto combinado de un escenario adverso.")
    st.dataframe(sens_df, use_container_width=True, hide_index=True)
