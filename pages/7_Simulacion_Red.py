"""
Núcleo de diseño de red: simulación y optimización.

  - Impacto de cerrar un nodo sobre distancia, costo y nivel de servicio.
  - Optimización de ubicación de instalaciones (facility location) por
    búsqueda exhaustiva u heurística según el tamaño del problema.
  - Análisis de criticidad: qué nodos son cuellos de botella de la red.
  - Simulación de Monte Carlo de demanda variable.
  - Análisis de sensibilidad de costos.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go

from models.network import Node, Corridor
from models.freight import compute_transport_cost, DEFAULT_COST_PARAMS
from utils.network_algorithms import simulate_node_removal, build_graph, network_stats
from utils.advanced_optimization import (optimize_facility_location, criticality_analysis,
                                          monte_carlo_demand)
from utils.map_utils import build_network_deck
from utils.report_exporter import dataframe_to_excel_bytes
from utils.auth import login_form, render_sidebar_user

st.set_page_config(page_title="Simulación de Red", page_icon="🔬", layout="wide")

if not login_form():
    st.stop()
render_sidebar_user()

st.title("🔬 Simulación y Optimización de la Red")

nodes = Node.all()
corridors = Corridor.all()
node_map = {n["node_id"]: f"{n['name']} ({n['node_type']})" for n in nodes}

tabs = st.tabs(["🏭 Cierre de nodo", "🎯 Ubicación óptima de instalaciones",
                "🕸️ Criticidad de la red", "🎲 Monte Carlo", "📉 Sensibilidad de costos"])

# ==========================================================================
# 1. CIERRE DE NODO
# ==========================================================================
with tabs[0]:
    st.subheader("Impacto de eliminar un nodo de la red")
    st.caption("Simula el cierre de una instalación y mide el efecto sobre la distancia promedio "
               "a clientes, el costo total de la red y el nivel de servicio (cobertura alcanzable).")

    removibles = [n for n in nodes if n["node_type"] != "Cliente"]
    rem_map = {n["node_id"]: f"{n['name']} ({n['node_type']})" for n in removibles}
    node_to_remove = st.selectbox("Nodo a simular su cierre", options=list(rem_map.keys()),
                                   format_func=lambda x: rem_map[x])

    if st.button("▶️ Ejecutar simulación", type="primary"):
        st.session_state["sim_result"] = simulate_node_removal(nodes, corridors, node_to_remove)
        st.session_state["sim_node"] = node_to_remove

    if "sim_result" in st.session_state:
        r = st.session_state["sim_result"]
        st.markdown(f"### Resultado: cierre de **{rem_map.get(st.session_state['sim_node'], '')}**")
        c1, c2, c3 = st.columns(3)
        c1.metric("Δ Distancia promedio",
                  f"{r['delta_avg_distance_km']} km" if r["delta_avg_distance_km"] is not None else "N/D",
                  delta=r["delta_avg_distance_km"], delta_color="inverse")
        c2.metric("Δ Costo total de la red",
                  f"${r['delta_total_cost']:,.0f}" if r["delta_total_cost"] is not None else "N/D",
                  delta=r["delta_total_cost"], delta_color="inverse")
        c3.metric("Δ Nivel de servicio",
                  f"{r['delta_service_level_pct']} pp" if r["delta_service_level_pct"] is not None else "N/D",
                  delta=r["delta_service_level_pct"])

        comp_df = pd.DataFrame({
            "Métrica": ["Distancia promedio (km)", "Costo total de la red (USD)",
                        "Nivel de servicio (%)", "Nodos", "Corredores"],
            "Antes": [r["before"]["avg_distance_km"], r["before"]["total_network_cost"],
                      r["before"]["service_level_pct"], r["before"]["n_nodes"], r["before"]["n_edges"]],
            "Después": [r["after"]["avg_distance_km"], r["after"]["total_network_cost"],
                        r["after"]["service_level_pct"], r["after"]["n_nodes"], r["after"]["n_edges"]],
        })
        st.dataframe(comp_df, use_container_width=True, hide_index=True)

        vis = comp_df.head(3)
        fig = go.Figure(data=[
            go.Bar(name="Antes", x=vis["Métrica"], y=vis["Antes"], marker_color="#264653"),
            go.Bar(name="Después", x=vis["Métrica"], y=vis["Después"], marker_color="#E76F51"),
        ])
        fig.update_layout(barmode="group", height=400, legend=dict(orientation="h", y=1.12))
        st.plotly_chart(fig, use_container_width=True)

        if r["delta_service_level_pct"] is not None and r["delta_service_level_pct"] < 0:
            st.error(f"⚠️ Cerrar este nodo deja clientes sin cobertura: el nivel de servicio cae "
                     f"{abs(r['delta_service_level_pct'])} puntos porcentuales.")
        elif r["delta_total_cost"] is not None and r["delta_total_cost"] < 0:
            st.success("Cerrar este nodo reduce el costo total de la red sin perder cobertura. "
                       "Es candidato a racionalización.")

        st.markdown("#### Mapa de la red sin el nodo simulado")
        rid = st.session_state["sim_node"]
        st.pydeck_chart(
            build_network_deck([n for n in nodes if n["node_id"] != rid],
                                [c for c in corridors
                                 if c["origin_node_id"] != rid and c["dest_node_id"] != rid]),
            use_container_width=True)
    else:
        st.info("Selecciona un nodo y ejecuta la simulación para ver el impacto.")

# ==========================================================================
# 2. UBICACIÓN ÓPTIMA DE INSTALACIONES
# ==========================================================================
with tabs[1]:
    st.subheader("🎯 Optimización de ubicación de instalaciones")
    st.caption("Determina qué combinación de instalaciones conviene mantener abiertas para "
               "maximizar el nivel de servicio al menor costo de red. Con pocas combinaciones se "
               "evalúan todas (óptimo global garantizado); si el espacio crece, se usa muestreo.")

    tipos_disponibles = sorted({n["node_type"] for n in nodes if n["node_type"] != "Cliente"})
    c1, c2, c3 = st.columns(3)
    tipo_inst = c1.selectbox("Tipo de instalación a optimizar", options=tipos_disponibles,
                              index=tipos_disponibles.index("CD") if "CD" in tipos_disponibles else 0)
    max_inst = len([n for n in nodes if n["node_type"] == tipo_inst])
    n_abrir = c2.slider("Número de instalaciones a mantener abiertas", 1, max(max_inst, 1),
                         min(2, max_inst))
    peso_costo = c3.number_input("Peso del costo en el score", min_value=0.0, value=0.001,
                                  format="%.4f",
                                  help="Score = nivel de servicio − peso × costo total. "
                                       "Subirlo prioriza el ahorro sobre la cobertura.")

    if st.button("🔍 Buscar la mejor combinación", type="primary"):
        with st.spinner("Evaluando combinaciones de instalaciones..."):
            res = optimize_facility_location(nodes, corridors, facility_type=tipo_inst,
                                              n_to_open=n_abrir, cost_weight=peso_costo)
        st.session_state["fl_result"] = res

    if "fl_result" in st.session_state:
        res = st.session_state["fl_result"]
        mejor = res["mejor"]
        st.success(f"Método: **{res['metodo']}** · {res['combinaciones_evaluadas']} combinación(es) evaluada(s)")

        st.markdown("#### Configuración óptima encontrada")
        c1, c2 = st.columns(2)
        c1.success("**Mantener abiertas:**\n\n" + "\n".join(f"- {n}" for n in mejor["nombres_abiertas"]))
        if mejor["nombres_cerradas"]:
            c2.error("**Cerrar:**\n\n" + "\n".join(f"- {n}" for n in mejor["nombres_cerradas"]))
        else:
            c2.info("No se cierra ninguna instalación en esta configuración.")

        m1, m2, m3, m4 = st.columns(4)
        m1.metric("Nivel de servicio", f"{mejor['service_level_pct']}%")
        m2.metric("Costo total de la red", f"${mejor['total_network_cost']:,.0f}")
        m3.metric("Distancia promedio", f"{mejor['avg_distance_km']} km")
        m4.metric("Score", f"{mejor['score']:.3f}")

        if res.get("todas"):
            tdf = pd.DataFrame(res["todas"])
            tdf["configuración"] = tdf["nombres_abiertas"].apply(lambda x: " + ".join(x) if x else "Ninguna")
            disp = tdf[["configuración", "service_level_pct", "total_network_cost",
                         "avg_distance_km", "score"]].copy()
            disp.columns = ["Configuración", "Nivel de servicio (%)", "Costo total (USD)",
                            "Distancia promedio (km)", "Score"]
            disp = disp.sort_values("Score", ascending=False)

            def color_top(row):
                return ["background-color: #D5F5E3"] * len(row) if row.name == disp.index[0] else [""] * len(row)

            st.markdown("#### Todas las combinaciones evaluadas")
            st.dataframe(disp.style.apply(color_top, axis=1), use_container_width=True, hide_index=True)

            figf = px.scatter(tdf, x="total_network_cost", y="service_level_pct",
                               size="avg_distance_km", color="score",
                               hover_name="configuración", color_continuous_scale="Viridis",
                               labels={"total_network_cost": "Costo total de la red (USD)",
                                        "service_level_pct": "Nivel de servicio (%)",
                                        "score": "Score"},
                               title="Frontera costo-servicio de las configuraciones evaluadas")
            figf.update_layout(height=440)
            st.plotly_chart(figf, use_container_width=True)
            st.caption("Cada punto es una configuración de instalaciones. Las que están arriba y a "
                       "la izquierda dominan: dan más servicio por menos costo.")

        st.markdown("#### Mapa de la red con la configuración óptima")
        cerradas = set(mejor["cerradas"])
        st.pydeck_chart(
            build_network_deck([n for n in nodes if n["node_id"] not in cerradas],
                                [c for c in corridors
                                 if c["origin_node_id"] not in cerradas
                                 and c["dest_node_id"] not in cerradas]),
            use_container_width=True)

# ==========================================================================
# 3. CRITICIDAD DE LA RED
# ==========================================================================
with tabs[2]:
    st.subheader("🕸️ Análisis de criticidad: cuellos de botella de la red")
    st.caption("Combina la centralidad de intermediación (cuánto tráfico pasa por el nodo) con el "
               "daño real medido al eliminarlo. Los nodos más críticos son los que concentran "
               "riesgo: si fallan, la red se degrada más.")

    if st.button("🧪 Ejecutar análisis de criticidad", type="primary"):
        with st.spinner("Evaluando el impacto de eliminar cada nodo..."):
            st.session_state["crit"] = criticality_analysis(nodes, corridors)

    if "crit" in st.session_state:
        cdf = pd.DataFrame(st.session_state["crit"])
        disp = cdf[["nombre", "tipo", "betweenness", "servicio_sin_nodo_pct", "caida_servicio_pp",
                     "aumento_distancia_km", "indice_criticidad"]].copy()
        disp.columns = ["Nodo", "Tipo", "Intermediación", "Servicio sin el nodo (%)",
                        "Caída de servicio (pp)", "Aumento de distancia (km)", "Índice de criticidad"]

        def color_crit(row):
            v = row["Índice de criticidad"]
            if v >= 60:
                return ["background-color: #F5B7B1"] * len(row)
            if v >= 35:
                return ["background-color: #FCF3CF"] * len(row)
            return ["background-color: #D5F5E3"] * len(row)

        st.dataframe(disp.style.apply(color_crit, axis=1), use_container_width=True, hide_index=True)

        top = cdf.iloc[0]
        st.error(f"🔴 Nodo más crítico: **{top['nombre']}** ({top['tipo']}). Su caída reduce el "
                 f"nivel de servicio en {top['caida_servicio_pp']} puntos porcentuales.")

        figc = px.bar(cdf.head(10), x="nombre", y="indice_criticidad", color="tipo",
                       color_discrete_sequence=px.colors.qualitative.Set2,
                       labels={"nombre": "Nodo", "indice_criticidad": "Índice de criticidad",
                                "tipo": "Tipo"},
                       title="Nodos ordenados por criticidad")
        st.plotly_chart(figc, use_container_width=True)

        figs = px.scatter(cdf, x="betweenness", y="caida_servicio_pp", size="indice_criticidad",
                           color="tipo", hover_name="nombre",
                           color_discrete_sequence=px.colors.qualitative.Set2,
                           labels={"betweenness": "Centralidad de intermediación",
                                    "caida_servicio_pp": "Caída de servicio al eliminarlo (pp)",
                                    "tipo": "Tipo"},
                           title="Centralidad estructural vs. daño real medido")
        st.plotly_chart(figs, use_container_width=True)
        st.caption("Un nodo puede tener alta intermediación pero poco daño real si existen rutas "
                   "alternativas. Los que combinan ambas cosas son los verdaderos puntos únicos de falla.")

        st.download_button("📊 Exportar análisis de criticidad",
                            dataframe_to_excel_bytes(disp, "Criticidad", "Análisis de Criticidad de la Red"),
                            "criticidad_red.xlsx",
                            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    else:
        st.info("Ejecuta el análisis para identificar los nodos críticos de la red.")

# ==========================================================================
# 4. MONTE CARLO
# ==========================================================================
with tabs[3]:
    st.subheader("🎲 Simulación de Monte Carlo de demanda variable")
    st.caption("Genera miles de escenarios de demanda y costo unitario aleatorios para estimar la "
               "distribución del costo total y la probabilidad de quedarse sin capacidad. "
               "A diferencia de un análisis determinístico, cuantifica el riesgo.")

    c1, c2, c3 = st.columns(3)
    demanda_base = c1.number_input("Demanda base (unidades)", min_value=1.0, value=1000.0, step=50.0)
    costo_unit = c2.number_input("Costo unitario base (USD)", min_value=0.01, value=5.0, step=0.5)
    n_sims = c3.select_slider("Número de simulaciones",
                               options=[500, 1000, 2000, 5000, 10000], value=2000)
    c4, c5 = st.columns(2)
    volatilidad = c4.slider("Volatilidad (desviación relativa)", 0.05, 0.80, 0.25, 0.05)
    capacidad = c5.number_input("Capacidad disponible (unidades)", min_value=0.0,
                                 value=float(demanda_base * 1.15), step=50.0,
                                 help="Se usa para estimar la probabilidad de desabastecimiento")

    if st.button("🎲 Ejecutar simulación", type="primary"):
        with st.spinner(f"Simulando {n_sims} escenarios..."):
            st.session_state["mc"] = monte_carlo_demand(
                demanda_base, costo_unit, n_simulations=n_sims,
                volatility=volatilidad, capacity=capacidad)

    if "mc" in st.session_state:
        mc = st.session_state["mc"]
        dem, cos = mc["demanda"], mc["costo"]

        st.markdown("#### Distribución de la demanda simulada")
        d1, d2, d3, d4 = st.columns(4)
        d1.metric("Media", f"{dem['media']:,.1f}")
        d2.metric("Desviación estándar", f"{dem['desviacion']:,.1f}")
        d3.metric("Percentil 5", f"{dem['p5']:,.1f}")
        d4.metric("Percentil 95", f"{dem['p95']:,.1f}")

        st.markdown("#### Distribución del costo total")
        k1, k2, k3, k4 = st.columns(4)
        k1.metric("Costo medio", f"${cos['media']:,.2f}")
        k2.metric("Desviación", f"${cos['desviacion']:,.2f}")
        k3.metric("Percentil 5 (optimista)", f"${cos['p5']:,.2f}")
        k4.metric("Percentil 95 (pesimista)", f"${cos['p95']:,.2f}")

        figh = go.Figure()
        figh.add_trace(go.Histogram(x=mc["muestras_costo"], nbinsx=50, marker_color="#2A9D8F",
                                     name="Costo total"))
        figh.add_vline(x=cos["media"], line_dash="dash", line_color="#264653",
                        annotation_text="Media")
        figh.add_vline(x=cos["p95"], line_dash="dot", line_color="#E76F51",
                        annotation_text="P95")
        figh.update_layout(height=400, xaxis_title="Costo total (USD)", yaxis_title="Frecuencia",
                            title="Distribución simulada del costo total", showlegend=False)
        st.plotly_chart(figh, use_container_width=True)

        figd = go.Figure()
        figd.add_trace(go.Histogram(x=mc["muestras_demanda"], nbinsx=50, marker_color="#457B9D",
                                     name="Demanda"))
        figd.add_vline(x=capacidad, line_dash="dash", line_color="red",
                        annotation_text="Capacidad")
        figd.update_layout(height=380, xaxis_title="Demanda (unidades)", yaxis_title="Frecuencia",
                            title="Distribución de la demanda frente a la capacidad", showlegend=False)
        st.plotly_chart(figd, use_container_width=True)

        prob = mc["prob_desabastecimiento_pct"]
        st.metric("Probabilidad de desabastecimiento", f"{prob}%")
        if prob > 20:
            st.error(f"⚠️ En el {prob}% de los escenarios la demanda supera la capacidad de "
                     f"{capacidad:,.0f} unidades. Conviene ampliar capacidad o aumentar el stock "
                     "de seguridad.")
        elif prob > 5:
            st.warning(f"En el {prob}% de los escenarios se supera la capacidad. Es un riesgo "
                       "moderado que debería cubrirse con stock de seguridad.")
        else:
            st.success(f"El riesgo de desabastecimiento es bajo ({prob}%): la capacidad cubre "
                       "prácticamente todos los escenarios simulados.")

        st.caption(f"Rango de planificación: con un 90% de confianza el costo total estará entre "
                   f"${cos['p5']:,.2f} y ${cos['p95']:,.2f}. Esa amplitud, y no solo el promedio, "
                   "es lo que debe presupuestarse.")

# ==========================================================================
# 5. SENSIBILIDAD DE COSTOS
# ==========================================================================
with tabs[4]:
    st.subheader("📉 Análisis de sensibilidad del costo de transporte")
    st.caption("Evalúa cómo responde el costo de un envío tipo ante variaciones de demanda "
               "(peso/volumen), costo laboral (componente tiempo) y costo energético "
               "(componente distancia). Cada factor se varía por separado para aislar su efecto.")

    c1, c2, c3 = st.columns(3)
    base_weight = c1.number_input("Peso base (kg)", value=5000.0, key="sn_w")
    base_volume = c1.number_input("Volumen base (m³)", value=20.0, key="sn_v")
    base_distance = c2.number_input("Distancia (km)", value=500.0, key="sn_d")
    base_time = c2.number_input("Tiempo de tránsito (h)", value=10.0, key="sn_t")
    base_value = c3.number_input("Valor declarado (USD)", value=15000.0, key="sn_val")
    base_units = c3.number_input("Unidades de carga", value=6, step=1, key="sn_u")

    rango = st.slider("Rango de variación a evaluar (%)", -50, 100, (-30, 50), step=10)
    pasos = list(range(rango[0], rango[1] + 1, 10))

    def _costo(pct, factor):
        """Costo total variando UN solo factor en pct por ciento."""
        params = dict(DEFAULT_COST_PARAMS)
        w, v = base_weight, base_volume
        if factor == "demanda":
            w = base_weight * (1 + pct / 100)
            v = base_volume * (1 + pct / 100)
        elif factor == "laboral":
            params["time_cost_per_hour"] *= (1 + pct / 100)
        elif factor == "energia":
            params["energy_cost_per_km_ton"] *= (1 + pct / 100)
        return compute_transport_cost(base_distance, base_time, w, v, int(base_units),
                                       base_value, params=params)["total_cost"]

    filas = []
    for pct in pasos:
        filas.append({"Variación (%)": pct,
                      "Demanda (peso/volumen)": _costo(pct, "demanda"),
                      "Costo laboral (tiempo)": _costo(pct, "laboral"),
                      "Costo energético": _costo(pct, "energia")})
    sdf = pd.DataFrame(filas)

    figs = go.Figure()
    for col, color in [("Demanda (peso/volumen)", "#2A9D8F"),
                        ("Costo laboral (tiempo)", "#E9C46A"),
                        ("Costo energético", "#E76F51")]:
        figs.add_trace(go.Scatter(x=sdf["Variación (%)"], y=sdf[col], mode="lines+markers",
                                   name=col, line=dict(width=3, color=color)))
    figs.add_vline(x=0, line_dash="dash", line_color="#888", annotation_text="Escenario base")
    figs.update_layout(height=460, xaxis_title="Variación del factor (%)",
                        yaxis_title="Costo total del envío (USD)",
                        legend=dict(orientation="h", y=1.12),
                        title="Sensibilidad del costo ante cada factor (variados uno a la vez)")
    st.plotly_chart(figs, use_container_width=True)

    st.dataframe(sdf.round(2), use_container_width=True, hide_index=True)

    # Elasticidad: cuánto cambia el costo por cada 1% de cambio del factor
    base_cost = _costo(0, "demanda")
    st.markdown("##### Elasticidad de cada factor")
    elas = []
    for factor, etiqueta in [("demanda", "Demanda (peso/volumen)"),
                              ("laboral", "Costo laboral (tiempo)"),
                              ("energia", "Costo energético")]:
        c_alto = _costo(10, factor)
        elasticidad = ((c_alto - base_cost) / base_cost) / 0.10 if base_cost else 0
        elas.append({"Factor": etiqueta,
                     "Costo base": round(base_cost, 2),
                     "Costo con +10%": round(c_alto, 2),
                     "Δ Costo": round(c_alto - base_cost, 2),
                     "Elasticidad": round(elasticidad, 4)})
    edf = pd.DataFrame(elas).sort_values("Elasticidad", ascending=False)
    st.dataframe(edf, use_container_width=True, hide_index=True)

    dominante = edf.iloc[0]
    st.info(f"El factor más influyente es **{dominante['Factor']}**: un aumento del 10% eleva el "
            f"costo total en ${dominante['Δ Costo']:,.2f} "
            f"(elasticidad {dominante['Elasticidad']:.3f}). Es donde una negociación o una mejora "
            "de eficiencia rinde más.")

    st.download_button("📊 Exportar análisis de sensibilidad",
                        dataframe_to_excel_bytes(sdf.round(2), "Sensibilidad",
                                                 "Análisis de Sensibilidad de Costos"),
                        "sensibilidad_costos.xlsx",
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
