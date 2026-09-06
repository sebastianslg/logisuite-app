"""
app.py
Punto de entrada de la aplicación web de Logística, Distribución y Transporte.
Inicializa la base de datos automáticamente en el primer arranque (clave para
un despliegue instantáneo en Streamlit Community Cloud) y define la portada.
"""
import os
import sys
import streamlit as st

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database.db import db_exists
from init_db import init_database

st.set_page_config(
    page_title="LogiSuite | Logística, Distribución y Transporte",
    page_icon="🚛",
    layout="wide",
    initial_sidebar_state="expanded",
)

if not db_exists():
    with st.spinner("Inicializando base de datos y datos de prueba..."):
        init_database(reset=False)

st.markdown("""
<style>
.main-title {font-size: 2.3rem; font-weight: 800; color: #264653; margin-bottom:0;}
.subtitle {font-size: 1.05rem; color: #555; margin-top:0;}
.module-card {background-color:#F7F9F9; border-left: 6px solid #2A9D8F;
              padding: 16px 20px; border-radius: 8px; margin-bottom: 12px;}
.module-card h4 {margin:0 0 6px 0; color:#264653;}
.module-card p {margin:0; color:#444; font-size:0.92rem;}
</style>
""", unsafe_allow_html=True)

st.markdown('<p class="main-title">🚛 LogiSuite — Plataforma de Logística, Distribución y Transporte</p>',
            unsafe_allow_html=True)
st.markdown('<p class="subtitle">Aplicación web 100% nativa para la nube · Streamlit + SQLite + NetworkX</p>',
            unsafe_allow_html=True)
st.divider()

col1, col2 = st.columns([2, 1])
with col1:
    st.markdown("### Módulos funcionales")
    modules = [
        ("📦 Warehouse Management", "Inventario en tiempo real, ciclo Inbound/Outbound, "
         "alertas de stock crítico/sobre-stock y reportes de rotación."),
        ("🚚 Freight Management", "Registro de envíos, consolidación y motor de costos "
         "(transacción, fricción de distancia, costo del envío)."),
        ("🗺️ Transportation Network", "Ruteo con NetworkX (Dijkstra), mapa geográfico interactivo, "
         "asignación de vehículo/conductor y ETA vs. real."),
        ("🚛 Fleet Management", "Vehículos, capacidad, mantenimientos preventivos/correctivos y "
         "conductores con licencias y vigencias."),
        ("🛃 Customs Management", "Documentación aduanera, aranceles/impuestos y alertas de "
         "vencimiento de permisos."),
        ("🔬 Simulación de Red", "Impacto de abrir/cerrar instalaciones sobre distancia, costo y "
         "nivel de servicio; curva de trade-off Costo vs. Servicio."),
    ]
    for title, desc in modules:
        st.markdown(f'<div class="module-card"><h4>{title}</h4><p>{desc}</p></div>',
                    unsafe_allow_html=True)

with col2:
    st.markdown("### Estado del sistema")
    from database.db import run_query
    n_nodes = run_query("SELECT COUNT(*) c FROM nodes WHERE active=1").iloc[0]["c"]
    n_ship = run_query("SELECT COUNT(*) c FROM shipments").iloc[0]["c"]
    n_veh = run_query("SELECT COUNT(*) c FROM vehicles").iloc[0]["c"]
    n_docs = run_query("SELECT COUNT(*) c FROM customs_documents").iloc[0]["c"]
    st.metric("Nodos activos en la red", int(n_nodes))
    st.metric("Envíos registrados", int(n_ship))
    st.metric("Vehículos en flota", int(n_veh))
    st.metric("Documentos aduaneros", int(n_docs))
    st.info("Usa el menú lateral para navegar entre módulos. El Dashboard "
            "Ejecutivo consolida los KPIs de toda la red.", icon="ℹ️")

st.divider()
st.caption("Proyecto académico de Distribución y Transporte · Base de datos SQLite relacional · "
           "Optimización de rutas con NetworkX · Visualización geográfica con pydeck")
