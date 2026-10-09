"""
Dashboard Ejecutivo: KPIs de nivel de servicio (OTIF), costos globales,
utilización de flota, rotación de inventario, y la gráfica central del curso:
Trade-off Costo vs. Nivel de Servicio en función del número de instalaciones.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go

from database.db import run_query
from models.freight import Shipment
from models.network import Node, Corridor
from utils.network_algorithms import build_graph, network_stats, cost_vs_service_tradeoff
from utils.report_exporter import dataframe_to_excel_bytes, dataframe_to_pdf_bytes
from utils.map_utils import render_colombia_network_map, map_legend_html

st.set_page_config(page_title="Dashboard Ejecutivo", page_icon="🏭", layout="wide")

from database.db import ensure_database_ready
ensure_database_ready()

from utils.theme import (apply_page_theme, page_header, render_kpi_card, CYAN, ELECTRIC_BLUE,
                         EMERALD, ROSE, STATUS_COLORS)
apply_page_theme()
page_header("🏭", "Dashboard Ejecutivo",
            "Torre de control de la red logística de Colombia: servicio, costo, flota y fletes en curso.")

OTIF_TARGET = 95.0

# --------------------------------------------------------------------------
# KPIs principales
# --------------------------------------------------------------------------
otif = Shipment.otif_kpi()
total_cost_df = run_query("SELECT COALESCE(SUM(total_cost),0) c FROM shipments")
fleet_df = run_query("SELECT status, COUNT(*) n FROM vehicles GROUP BY status")
n_vehicles = fleet_df["n"].sum() if not fleet_df.empty else 0
n_active = fleet_df.loc[fleet_df["status"].isin(["Disponible", "En Ruta"]), "n"].sum() if not fleet_df.empty else 0
utilization = round(100 * n_active / n_vehicles, 1) if n_vehicles else 0

rotation_df = run_query("""
    SELECT COALESCE(SUM(CASE WHEN movement_type='Outbound-Despacho' THEN quantity ELSE 0 END),0) despachado,
           COALESCE(SUM(CASE WHEN movement_type LIKE 'Inbound%' THEN quantity ELSE 0 END),0) recibido
    FROM warehouse_movements
""")
rotation_idx = None
if not rotation_df.empty and rotation_df.iloc[0]["recibido"] > 0:
    rotation_idx = round(rotation_df.iloc[0]["despachado"] / rotation_df.iloc[0]["recibido"], 2)

transito_df = run_query("""SELECT COUNT(*) n, COALESCE(SUM(weight_kg),0) kg,
                                  COALESCE(SUM(status='Retrasado'),0) retrasados
                           FROM shipments WHERE status IN ('En Transito','Retrasado')""")
n_activos = int(transito_df.iloc[0]["n"])
ton_transito = float(transito_df.iloc[0]["kg"]) / 1000
n_retrasados = int(transito_df.iloc[0]["retrasados"])
n_shipments = int(run_query("SELECT COUNT(*) c FROM shipments").iloc[0]["c"])
total_cost = float(total_cost_df.iloc[0]["c"])

c1, c2, c3 = st.columns(3)
with c1:
    if otif["otif_pct"] is not None:
        gap = otif["otif_pct"] - OTIF_TARGET
        render_kpi_card("OTIF (On-Time-In-Full)", f"{otif['otif_pct']}%",
                        f"{gap:+.1f} pts vs. meta {OTIF_TARGET:.0f}%", gap >= 0, "🎯")
    else:
        render_kpi_card("OTIF (On-Time-In-Full)", "N/D", "sin entregas aún", None, "🎯")
with c2:
    render_kpi_card("Costo total de fletes", f"${total_cost:,.0f}",
                    f"${total_cost / n_shipments:,.0f} promedio por envío" if n_shipments else None,
                    None, "💵")
with c3:
    render_kpi_card("Utilización de flota", f"{utilization}%",
                    f"{n_active} de {n_vehicles} vehículos operativos", utilization >= 80, "🚛")

c4, c5, c6 = st.columns(3)
with c4:
    render_kpi_card("Fletes en curso", n_activos,
                    f"{n_retrasados} retrasado(s)" if n_retrasados else "todos a tiempo",
                    n_retrasados == 0, "🛣️")
with c5:
    render_kpi_card("Carga en tránsito", f"{ton_transito:,.1f} t", icon="📦")
with c6:
    render_kpi_card("Índice de rotación", rotation_idx if rotation_idx is not None else "N/D",
                    "despachado / recibido" if rotation_idx is not None else None, None, "🔄")

# --------------------------------------------------------------------------
# Mapa de la red (pydeck / WebGL) a todo el ancho
# --------------------------------------------------------------------------
st.subheader("🛰️ Red logística nacional en tiempo real")
st.markdown(map_legend_html(), unsafe_allow_html=True)
render_colombia_network_map(height=600)
st.caption("Arcos: corredores troncales y ruta marítima. Arcos brillantes: fletes en tránsito. "
           "Columnas: toneladas movidas por nodo. Pasa el cursor sobre cualquier elemento.")

st.divider()

# --------------------------------------------------------------------------
# Estado de envíos y costos por componente
# --------------------------------------------------------------------------
colA, colB = st.columns(2)
with colA:
    st.subheader("Estado de envíos")
    status_df = run_query("SELECT status, COUNT(*) cantidad FROM shipments GROUP BY status")
    if not status_df.empty:
        fig = px.pie(status_df, names="status", values="cantidad", hole=0.6,
                     color="status", color_discrete_map=STATUS_COLORS)
        fig.update_traces(marker=dict(line=dict(color="#0A0E17", width=2)))
        st.plotly_chart(fig, width="stretch")
    else:
        st.info("Aún no hay envíos registrados.")

with colB:
    st.subheader("Costo total por componente")
    cost_df = run_query("""SELECT
        SUM(transaction_cost) AS 'Costo de Transaccion',
        SUM(distance_friction_cost) AS 'Friccion de Distancia',
        SUM(shipment_cost) AS 'Costo del Envio' FROM shipments""")
    if not cost_df.empty and cost_df.iloc[0].sum() > 0:
        melted = cost_df.T.reset_index()
        melted.columns = ["Componente", "Valor"]
        fig2 = px.bar(melted, x="Componente", y="Valor", color="Componente",
                      color_discrete_sequence=[CYAN, ELECTRIC_BLUE, EMERALD], text_auto=".2s")
        fig2.update_layout(showlegend=False)
        st.plotly_chart(fig2, width="stretch")
    else:
        st.info("Sin datos de costos aún.")

st.divider()

# --------------------------------------------------------------------------
# Trade-off Costo vs. Nivel de Servicio (objetivo central del curso)
# --------------------------------------------------------------------------
st.subheader("📈 Trade-off: Costo Total de la Red vs. Nivel de Servicio")
st.caption("Objetivo central: reducir el costo de suministro manteniendo o mejorando el nivel de "
           "servicio, al variar el número de Centros de Distribución (CDs) activos.")

nodes = Node.all()
corridors = Corridor.all()

if st.button("🔄 Recalcular curva de trade-off", type="primary"):
    st.session_state["tradeoff"] = cost_vs_service_tradeoff(nodes, corridors, facility_type="CD")

if "tradeoff" not in st.session_state:
    st.session_state["tradeoff"] = cost_vs_service_tradeoff(nodes, corridors, facility_type="CD")

tradeoff = st.session_state["tradeoff"]
if tradeoff:
    df_t = pd.DataFrame(tradeoff)
    fig3 = go.Figure()
    fig3.add_trace(go.Scatter(x=df_t["n_facilities_active"], y=df_t["total_network_cost"],
                               name="Costo total de la red", mode="lines+markers",
                               line=dict(color=ROSE, width=3), yaxis="y1"))
    fig3.add_trace(go.Scatter(x=df_t["n_facilities_active"], y=df_t["service_level_pct"],
                               name="Nivel de servicio (%)", mode="lines+markers",
                               line=dict(color=CYAN, width=3), yaxis="y2"))
    fig3.update_layout(
        xaxis_title="Número de instalaciones (CDs) activas",
        yaxis=dict(title="Costo total de la red (USD)", side="left"),
        yaxis2=dict(title="Nivel de servicio (%)", side="right", overlaying="y", range=[0, 105]),
        legend=dict(orientation="h", y=1.12), height=460,
    )
    st.plotly_chart(fig3, width="stretch")
    with st.expander("Ver tabla de datos de la curva"):
        st.dataframe(df_t[["n_facilities_active", "avg_distance_km", "total_network_cost",
                            "service_level_pct", "n_nodes", "n_edges"]],
                     width="stretch", hide_index=True)
else:
    st.warning("No hay suficientes nodos/corredores para construir la curva. Agrega nodos tipo 'CD'.")

st.divider()

# --------------------------------------------------------------------------
# Estadísticas actuales de la red
# --------------------------------------------------------------------------
st.subheader("🌐 Estadísticas actuales de la red completa")
G = build_graph(nodes, corridors)
stats = network_stats(G)
s1, s2, s3, s4 = st.columns(4)
with s1:
    render_kpi_card("Nodos", stats["n_nodes"], icon="📍")
with s2:
    render_kpi_card("Corredores (dirigidos)", stats["n_edges"], icon="🛣️")
with s3:
    render_kpi_card("Distancia promedio a clientes",
                    f"{stats['avg_distance_km']} km" if stats['avg_distance_km'] else "N/D", icon="📏")
with s4:
    render_kpi_card("Nivel de servicio (cobertura)", f"{stats['service_level_pct']}%",
                    icon="🛡️")

st.divider()
st.subheader("⬇️ Exportar reporte ejecutivo")
export_df = run_query("""
    SELECT s.shipment_id, no.name origen, nd.name destino, s.status, s.total_cost,
           s.promised_date, s.delivered_date
    FROM shipments s JOIN nodes no ON s.origin_node_id=no.node_id
    JOIN nodes nd ON s.dest_node_id=nd.node_id ORDER BY s.shipment_id
""")
ce1, ce2 = st.columns(2)
with ce1:
    st.download_button("📊 Descargar Excel", dataframe_to_excel_bytes(export_df, "Dashboard",
                        "Reporte Ejecutivo de Envios"), "reporte_ejecutivo.xlsx",
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
with ce2:
    st.download_button("📄 Descargar PDF", dataframe_to_pdf_bytes(export_df, "Reporte Ejecutivo de Envíos"),
                        "reporte_ejecutivo.pdf", "application/pdf")
