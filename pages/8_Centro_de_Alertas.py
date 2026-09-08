"""
Centro de Alertas: consolida en un solo lugar todas las situaciones que
requieren atención en los 5 módulos (stock crítico, licencias y documentos por
vencer, envíos retrasados, mantenimientos vencidos, vehículos inactivos).
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import streamlit as st
import pandas as pd
import plotly.express as px

from utils.alerts import get_all_alerts, alert_counts
from utils.auth import login_form, render_sidebar_user
from utils.report_exporter import dataframe_to_excel_bytes, dataframe_to_pdf_bytes

st.set_page_config(page_title="Centro de Alertas", page_icon="🚨", layout="wide")

from database.db import ensure_database_ready
ensure_database_ready()

from utils.theme import apply_page_theme, page_header
apply_page_theme()

if not login_form():
    st.stop()
render_sidebar_user()

page_header("🚨", "Centro de Alertas", "Todas las alertas del sistema consolidadas y priorizadas por severidad.")

alertas = get_all_alerts()
conteo = alert_counts()

# --------------------------------------------------------------------------
# Tarjetas de conteo por severidad
# --------------------------------------------------------------------------
c1, c2, c3, c4 = st.columns(4)
c1.metric("🔴 Críticas", conteo["critica"])
c2.metric("🟠 Altas", conteo["alta"])
c3.metric("🟡 Medias", conteo["media"])
c4.metric("Total de alertas", conteo["total"])

if not alertas:
    st.success("✅ No hay alertas activas. Todos los indicadores están dentro de rango.")
    st.stop()

st.divider()

# --------------------------------------------------------------------------
# Filtros
# --------------------------------------------------------------------------
df = pd.DataFrame(alertas)
f1, f2, f3 = st.columns(3)
sev_filter = f1.multiselect("Severidad", options=sorted(df["severidad"].unique()),
                             default=sorted(df["severidad"].unique()))
mod_filter = f2.multiselect("Módulo", options=sorted(df["modulo"].unique()),
                             default=sorted(df["modulo"].unique()))
tipo_filter = f3.multiselect("Tipo", options=sorted(df["tipo"].unique()),
                              default=sorted(df["tipo"].unique()))

filtrado = df[df["severidad"].isin(sev_filter) & df["modulo"].isin(mod_filter)
               & df["tipo"].isin(tipo_filter)]

# --------------------------------------------------------------------------
# Distribución visual
# --------------------------------------------------------------------------
g1, g2 = st.columns(2)
with g1:
    st.subheader("Alertas por módulo")
    por_modulo = df.groupby("modulo").size().reset_index(name="cantidad")
    fig = px.bar(por_modulo, x="modulo", y="cantidad", color="modulo",
                  color_discrete_sequence=px.colors.qualitative.Set2, text_auto=True)
    fig.update_layout(showlegend=False, height=320)
    st.plotly_chart(fig, use_container_width=True)
with g2:
    st.subheader("Alertas por severidad")
    por_sev = df.groupby("severidad").size().reset_index(name="cantidad")
    colores = {"critica": "#E63946", "alta": "#F4A261", "media": "#E9C46A", "baja": "#A8DADC"}
    fig2 = px.pie(por_sev, names="severidad", values="cantidad", hole=0.45,
                   color="severidad", color_discrete_map=colores)
    fig2.update_layout(height=320)
    st.plotly_chart(fig2, use_container_width=True)

st.divider()

# --------------------------------------------------------------------------
# Listado detallado
# --------------------------------------------------------------------------
st.subheader(f"Detalle ({len(filtrado)} alertas)")

iconos = {"critica": "🔴", "alta": "🟠", "media": "🟡", "baja": "🔵"}
for _, a in filtrado.iterrows():
    icono = iconos.get(a["severidad"], "⚪")
    with st.container(border=True):
        col_a, col_b = st.columns([4, 1])
        with col_a:
            st.markdown(f"{icono} **{a['tipo']} — {a['titulo']}**")
            st.caption(a["detalle"])
        with col_b:
            st.markdown(f"`{a['modulo']}`")

st.divider()
st.subheader("⬇️ Exportar alertas")
export_df = filtrado[["severidad", "modulo", "tipo", "titulo", "detalle", "referencia"]]
export_df.columns = ["Severidad", "Módulo", "Tipo", "Título", "Detalle", "Referencia"]
e1, e2 = st.columns(2)
with e1:
    st.download_button("📊 Excel", dataframe_to_excel_bytes(export_df, "Alertas",
                        "Centro de Alertas del Sistema"), "alertas.xlsx",
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
with e2:
    st.download_button("📄 PDF", dataframe_to_pdf_bytes(export_df, "Centro de Alertas del Sistema"),
                        "alertas.pdf", "application/pdf")
