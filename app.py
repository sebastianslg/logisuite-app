"""
app.py
Punto de entrada de LogiSuite, la plataforma de Logística, Distribución y
Transporte. Inicializa la base de datos automáticamente en el primer arranque
(clave para un despliegue instantáneo en Streamlit Community Cloud), ofrece la
búsqueda global, el selector de idioma y tema, y presenta el estado del sistema.
"""
import os
import sys

import streamlit as st

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database.db import db_exists, run_query
from init_db import init_database

st.set_page_config(
    page_title="LogiSuite | Logística, Distribución y Transporte",
    page_icon="🚛",
    layout="wide",
    initial_sidebar_state="expanded",
)

# La base se crea y se puebla sola la primera vez que arranca la app.
if not db_exists():
    with st.spinner("Inicializando base de datos y datos de prueba..."):
        init_database(reset=False)

from utils.i18n import t, language_selector          # noqa: E402
from utils.auth import login_form, render_sidebar_user  # noqa: E402
from utils.alerts import alert_counts                # noqa: E402
from utils.data_tools import global_search           # noqa: E402

if not login_form():
    st.stop()

# ---------------------------------------------------------------------------
# Barra lateral: usuario, idioma, tema y búsqueda global
# ---------------------------------------------------------------------------
render_sidebar_user()
language_selector()

with st.sidebar:
    st.divider()
    # El tema se aplica inyectando CSS, de modo que el usuario puede alternarlo
    # sin tocar .streamlit/config.toml ni reiniciar la aplicación.
    modo_oscuro = st.toggle("🌙 Modo oscuro", value=st.session_state.get("dark_mode", False),
                             help="Alterna entre tema claro y oscuro en toda la aplicación")
    st.session_state["dark_mode"] = modo_oscuro

    st.divider()
    st.markdown(f"### 🔎 {t('search')}")
    consulta = st.text_input(t("search"), placeholder=t("search_placeholder"),
                              label_visibility="collapsed")
    if consulta and len(consulta.strip()) >= 2:
        resultados = global_search(consulta.strip())
        if not resultados:
            st.caption("Sin coincidencias.")
        else:
            st.caption(f"{len(resultados)} coincidencia(s)")
            for r in resultados[:15]:
                st.markdown(f"**{r.get('identificador','')}** · {r.get('tipo','')}  \n"
                            f"<span style='font-size:0.82rem;color:#666'>"
                            f"{r.get('modulo','')} — {r.get('descripcion','')}</span>",
                            unsafe_allow_html=True)

# ---------------------------------------------------------------------------
# Estilos: paleta clara por defecto, oscura si el usuario la activa
# ---------------------------------------------------------------------------
if modo_oscuro:
    st.markdown("""
    <style>
    .stApp {background-color:#12181F; color:#E8EDF2;}
    section[data-testid="stSidebar"] {background-color:#1B242F;}
    .main-title {font-size:2.3rem; font-weight:800; color:#7FD1C1; margin-bottom:0;}
    .subtitle {font-size:1.05rem; color:#A9B6C2; margin-top:0;}
    .module-card {background-color:#1B242F; border-left:6px solid #2A9D8F;
                  padding:16px 20px; border-radius:8px; margin-bottom:12px;}
    .module-card h4 {margin:0 0 6px 0; color:#7FD1C1;}
    .module-card p {margin:0; color:#C3CDD7; font-size:0.92rem;}
    </style>
    """, unsafe_allow_html=True)
else:
    st.markdown("""
    <style>
    .main-title {font-size:2.3rem; font-weight:800; color:#264653; margin-bottom:0;}
    .subtitle {font-size:1.05rem; color:#555; margin-top:0;}
    .module-card {background-color:#F7F9F9; border-left:6px solid #2A9D8F;
                  padding:16px 20px; border-radius:8px; margin-bottom:12px;}
    .module-card h4 {margin:0 0 6px 0; color:#264653;}
    .module-card p {margin:0; color:#444; font-size:0.92rem;}
    </style>
    """, unsafe_allow_html=True)

st.markdown(f'<p class="main-title">🚛 {t("app_title")}</p>', unsafe_allow_html=True)
st.markdown(f'<p class="subtitle">{t("app_subtitle")}</p>', unsafe_allow_html=True)

# ---------------------------------------------------------------------------
# Banda de alertas activas
# ---------------------------------------------------------------------------
conteo = alert_counts()
if conteo["total"]:
    a1, a2, a3, a4 = st.columns(4)
    a1.metric("🔴 Críticas", conteo["critica"])
    a2.metric("🟠 Altas", conteo["alta"])
    a3.metric("🟡 Medias", conteo["media"])
    a4.metric(f"🚨 {t('alerts')} ({t('total')})", conteo["total"])
    if conteo["critica"]:
        st.error(f"Hay {conteo['critica']} alerta(s) crítica(s) sin atender. "
                 "Revisa el Centro de Alertas en el menú lateral.")

st.divider()

# ---------------------------------------------------------------------------
# Módulos y estado del sistema
# ---------------------------------------------------------------------------
col1, col2 = st.columns([2, 1])

with col1:
    st.markdown(f"### {t('modules')}")
    modules = [
        ("📦 Warehouse Management",
         "Inventario en tiempo real, ciclo Inbound/Outbound, alertas de stock, pronóstico de "
         "demanda, EOQ, punto de reorden, clasificación ABC y trazabilidad de SKU."),
        ("🚚 Freight Management",
         "Registro y tracking de envíos, motor de costos de tres componentes, consolidación de "
         "carga, simulador de modos de transporte y huella de carbono."),
        ("🗺️ Transportation Management",
         "Mapa geográfico de la red, ruteo con Dijkstra, circuitos multi-parada (TSP con 2-opt), "
         "validación de capacidad, programación en Gantt y control de ETA vs. real."),
        ("🚛 Fleet Management",
         "Vehículos y conductores, mantenimiento preventivo y correctivo, costo total de "
         "propiedad (TCO) y predicción del próximo servicio."),
        ("🛃 Customs Management",
         "Documentación aduanera, liquidación de tributos, escenarios arancelarios comparados y "
         "checklist de completitud documental."),
        ("🔬 Simulación y Optimización",
         "Cierre de nodos, ubicación óptima de instalaciones, criticidad de la red, simulación "
         "de Monte Carlo y análisis de sensibilidad."),
        ("🚨 Centro de Alertas",
         "Todas las alertas del sistema consolidadas y priorizadas por severidad."),
        ("📥 Importar / Exportar",
         "Carga masiva desde CSV o Excel con validación fila por fila, y exportación consolidada."),
        ("⚙️ Administración",
         "Usuarios y roles, bitácora de auditoría y parámetros del sistema."),
    ]
    for title, desc in modules:
        st.markdown(f'<div class="module-card"><h4>{title}</h4><p>{desc}</p></div>',
                    unsafe_allow_html=True)

with col2:
    st.markdown(f"### {t('system_status')}")

    def _count(sql: str) -> int:
        try:
            return int(run_query(sql).iloc[0]["c"])
        except Exception:
            return 0

    st.metric("Nodos activos en la red", _count("SELECT COUNT(*) c FROM nodes WHERE active=1"))
    st.metric("Corredores de transporte", _count("SELECT COUNT(*) c FROM corridors WHERE active=1"))
    st.metric("Envíos registrados", _count("SELECT COUNT(*) c FROM shipments"))
    st.metric("SKUs en inventario", _count("SELECT COUNT(*) c FROM inventory_items"))
    st.metric("Vehículos en flota", _count("SELECT COUNT(*) c FROM vehicles"))
    st.metric("Documentos aduaneros", _count("SELECT COUNT(*) c FROM customs_documents"))

    st.info("Usa el menú lateral para navegar entre módulos. El Dashboard Ejecutivo consolida "
            "los KPIs de toda la red.", icon="ℹ️")

st.divider()
st.caption("Proyecto académico de Distribución y Transporte · SQLite relacional con claves "
           "foráneas · Optimización de rutas y redes con NetworkX · Visualización geográfica "
           "con pydeck · Reportes exportables en Excel y PDF")
