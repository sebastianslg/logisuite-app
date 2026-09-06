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

st.set_page_config(page_title="Dashboard Ejecutivo", page_icon="🏭", layout="wide")
st.title("🏭 Dashboard Ejecutivo")
st.caption("Vista consolidada de KPIs de toda la red logística.")

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

c1, c2, c3, c4 = st.columns(4)
c1.metric("OTIF (On-Time-In-Full)", f"{otif['otif_pct']}%" if otif["otif_pct"] is not None else "N/D",
          help="Porcentaje de envíos entregados en la fecha prometida o antes.")
c2.metric("Costo total de envíos", f"${total_cost_df.iloc[0]['c']:,.0f}")
c3.metric("Utilización de flota", f"{utilization}%", help="Vehículos Disponibles + En Ruta / Total")
c4.metric("Índice de rotación", rotation_idx if rotation_idx is not None else "N/D")

st.divider()

# --------------------------------------------------------------------------
# Estado de envíos y costos por componente
# --------------------------------------------------------------------------
colA, colB = st.columns(2)
with colA:
    st.subheader("Estado de envíos")
    status_df = run_query("SELECT status, COUNT(*) cantidad FROM shipments GROUP BY status")
    if not status_df.empty:
        fig = px.pie(status_df, names="status", values="cantidad", hole=0.45,
                     color_discrete_sequence=px.colors.sequential.Teal)
        st.plotly_chart(fig, use_container_width=True)
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
                      color_discrete_sequence=["#2A9D8F", "#E76F51", "#264653"], text_auto=".2s")
        fig2.update_layout(showlegend=False)
        st.plotly_chart(fig2, use_container_width=True)
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
                               line=dict(color="#E76F51", width=3), yaxis="y1"))
    fig3.add_trace(go.Scatter(x=df_t["n_facilities_active"], y=df_t["service_level_pct"],
                               name="Nivel de servicio (%)", mode="lines+markers",
                               line=dict(color="#2A9D8F", width=3), yaxis="y2"))
    fig3.update_layout(
        xaxis_title="Número de instalaciones (CDs) activas",
        yaxis=dict(title="Costo total de la red (USD)", side="left"),
        yaxis2=dict(title="Nivel de servicio (%)", side="right", overlaying="y", range=[0, 105]),
        legend=dict(orientation="h", y=1.12), height=460,
    )
    st.plotly_chart(fig3, use_container_width=True)
    with st.expander("Ver tabla de datos de la curva"):
        st.dataframe(df_t[["n_facilities_active", "avg_distance_km", "total_network_cost",
                            "service_level_pct", "n_nodes", "n_edges"]], use_container_width=True)
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
s1.metric("Nodos", stats["n_nodes"])
s2.metric("Corredores (dirigidos)", stats["n_edges"])
s3.metric("Distancia promedio a clientes", f"{stats['avg_distance_km']} km" if stats['avg_distance_km'] else "N/D")
s4.metric("Nivel de servicio (cobertura)", f"{stats['service_level_pct']}%")

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
