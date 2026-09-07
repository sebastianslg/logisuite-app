"""
app.py
Portada de LogiSuite. Inicializa la base de datos, aplica el tema visual
compartido, y ofrece búsqueda global, selector de idioma/tema, banda de
alertas y el resumen de módulos con el estado del sistema.
"""
import os
import sys

import streamlit as st

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database.db import run_query, ensure_database_ready

st.set_page_config(
    page_title="LogiSuite | Logística, Distribución y Transporte",
    page_icon="🚛",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ensure_database_ready() aplica el esquema completo (base + extensiones v2)
# de forma idempotente en cada arranque, así una base desplegada antes de una
# migración de esquema se pone al día sin perder datos (ver database/db.py).
ensure_database_ready()

from utils.i18n import t, language_selector
from utils.auth import login_form, render_sidebar_user
from utils.alerts import alert_counts
from utils.data_tools import global_search
from utils.theme import apply_page_theme, BRAND

if not login_form():
    st.stop()

# ---------------------------------------------------------------------------
# Barra lateral: usuario, idioma, tema y búsqueda global
# ---------------------------------------------------------------------------
render_sidebar_user()
language_selector()

with st.sidebar:
    st.divider()
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
                            f"<span style='font-size:0.82rem;color:#888'>"
                            f"{r.get('modulo','')} — {r.get('descripcion','')}</span>",
                            unsafe_allow_html=True)

# apply_page_theme() lee st.session_state['dark_mode'] recién actualizado por
# el toggle de arriba, así que se llama DESPUÉS: fija el template de Plotly
# para toda la página e inyecta el CSS base compartido con las demás páginas.
dark = apply_page_theme()

# ---------------------------------------------------------------------------
# CSS específico de la portada: banner "hero" con ilustración SVG propia
# (sin depender de imágenes externas, para que nunca se rompa en el despliegue)
# ---------------------------------------------------------------------------
hero_text_color = "#FFFFFF"
card_bg = "#1B242F" if dark else "#FFFFFF"
card_text = "#C3CDD7" if dark else "#444444"
card_title = "#7FD1C1" if dark else BRAND["secondary"]
chip_bg = "#1B242F" if dark else "#F0F7F6"

st.markdown(f"""
<style>
.lg-hero {{
    background: linear-gradient(120deg, {BRAND["secondary"]} 0%, {BRAND["primary_dark"]} 55%, {BRAND["primary"]} 100%);
    border-radius: 18px;
    padding: 38px 42px;
    margin-bottom: 22px;
    position: relative;
    overflow: hidden;
    box-shadow: 0 8px 24px rgba(0,0,0,0.18);
}}
.lg-hero h1 {{
    color: {hero_text_color}; font-size: 2.4rem; font-weight: 800; margin: 0 0 8px 0;
}}
.lg-hero p {{
    color: rgba(255,255,255,0.88); font-size: 1.08rem; margin: 0; max-width: 640px;
}}
.lg-hero .lg-badge {{
    display:inline-block; background: rgba(255,255,255,0.18); color:#fff;
    padding: 4px 14px; border-radius: 999px; font-size: 0.8rem; margin-bottom: 14px;
    letter-spacing: 0.03em;
}}
.lg-chip-row {{ display:flex; gap:14px; flex-wrap:wrap; margin: 18px 0 26px 0; }}
.lg-chip {{
    background: {chip_bg}; border-radius: 12px; padding: 14px 18px; flex:1;
    min-width: 150px; text-align:center; border: 1px solid rgba(42,157,143,0.25);
    transition: transform 0.15s ease;
}}
.lg-chip .icon {{ font-size: 1.6rem; }}
.lg-chip .label {{ font-size: 0.85rem; color: {card_text}; margin-top:4px; font-weight:600; }}
.lg-module-card {{
    background-color: {card_bg}; border-radius: 14px; padding: 18px 20px;
    margin-bottom: 14px; border: 1px solid rgba(42,157,143,0.18);
    box-shadow: 0 2px 8px rgba(0,0,0,0.05);
    transition: box-shadow 0.15s ease;
}}
.lg-module-card:hover {{ box-shadow: 0 4px 16px rgba(42,157,143,0.25); }}
.lg-module-card .lg-icon-badge {{
    display:inline-flex; align-items:center; justify-content:center;
    width:42px; height:42px; border-radius:12px; font-size:1.3rem;
    background: linear-gradient(135deg, {BRAND["primary"]}, {BRAND["primary_dark"]});
    margin-bottom:8px;
}}
.lg-module-card h4 {{ margin:2px 0 6px 0; color:{card_title}; font-size:1.05rem; }}
.lg-module-card p {{ margin:0; color:{card_text}; font-size:0.9rem; line-height:1.4; }}
</style>
""", unsafe_allow_html=True)

# ---------------------------------------------------------------------------
# HERO: banner de bienvenida con ilustración SVG (ruta + camión + nodos)
# ---------------------------------------------------------------------------
hero_svg = """
<svg width="230" height="150" viewBox="0 0 230 150" xmlns="http://www.w3.org/2000/svg">
  <circle cx="35" cy="115" r="5" fill="#FFD166"/>
  <circle cx="105" cy="70" r="5" fill="#FFD166"/>
  <circle cx="175" cy="100" r="5" fill="#FFD166"/>
  <path d="M35 115 Q 70 60 105 70 T 175 100" stroke="rgba(255,255,255,0.55)"
        stroke-width="2.5" fill="none" stroke-dasharray="6 6"/>
  <g transform="translate(120,95)">
    <rect x="0" y="10" width="60" height="28" rx="4" fill="#FFFFFF"/>
    <rect x="60" y="18" width="22" height="20" rx="3" fill="#F4A261"/>
    <rect x="64" y="21" width="10" height="8" fill="#FFFFFF" opacity="0.85"/>
    <circle cx="16" cy="42" r="7" fill="#264653"/>
    <circle cx="16" cy="42" r="3" fill="#CBD5D9"/>
    <circle cx="66" cy="42" r="7" fill="#264653"/>
    <circle cx="66" cy="42" r="3" fill="#CBD5D9"/>
  </g>
  <circle cx="200" cy="35" r="14" fill="rgba(255,255,255,0.15)"/>
  <circle cx="25" cy="35" r="9" fill="rgba(255,255,255,0.12)"/>
</svg>
"""

hcol1, hcol2 = st.columns([3, 1])
with hcol1:
    st.markdown(f"""
    <div class="lg-hero">
        <span class="lg-badge">🚛 100% NATIVO PARA LA NUBE</span>
        <h1>{t('app_title')}</h1>
        <p>{t('app_subtitle')} — mapas geográficos reales, optimización de redes,
        motor de costos parametrizado y simulación de decisiones logísticas.</p>
        <div style="position:absolute; right:24px; top:18px;">{hero_svg}</div>
    </div>
    """, unsafe_allow_html=True)

# ---------------------------------------------------------------------------
# Fila de accesos rápidos (estilo "Rastrear / Cotizar / Recoger")
# ---------------------------------------------------------------------------
st.markdown(f"""
<div class="lg-chip-row">
    <div class="lg-chip"><div class="icon">🏭</div><div class="label">Dashboard Ejecutivo</div></div>
    <div class="lg-chip"><div class="icon">🚨</div><div class="label">Centro de Alertas</div></div>
    <div class="lg-chip"><div class="icon">🗺️</div><div class="label">Mapa de la Red</div></div>
    <div class="lg-chip"><div class="icon">📥</div><div class="label">Importar / Exportar</div></div>
    <div class="lg-chip"><div class="icon">⚙️</div><div class="label">Administración</div></div>
</div>
""", unsafe_allow_html=True)

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
        ("📦", "Warehouse Management",
         "Inventario en tiempo real, ciclo Inbound/Outbound, alertas de stock, pronóstico de "
         "demanda, EOQ, punto de reorden, clasificación ABC y trazabilidad de SKU."),
        ("🚚", "Freight Management",
         "Registro y tracking de envíos, motor de costos de tres componentes, consolidación de "
         "carga, simulador de modos de transporte y huella de carbono."),
        ("🗺️", "Transportation Management",
         "Mapa geográfico de la red, ruteo con Dijkstra, circuitos multi-parada (TSP con 2-opt), "
         "validación de capacidad, programación en Gantt y control de ETA vs. real."),
        ("🚛", "Fleet Management",
         "Vehículos y conductores, mantenimiento preventivo y correctivo, costo total de "
         "propiedad (TCO) y predicción del próximo servicio."),
        ("🛃", "Customs Management",
         "Documentación aduanera, liquidación de tributos, escenarios arancelarios comparados y "
         "checklist de completitud documental."),
        ("🔬", "Simulación y Optimización",
         "Cierre de nodos, ubicación óptima de instalaciones, criticidad de la red, simulación "
         "de Monte Carlo y análisis de sensibilidad."),
        ("🚨", "Centro de Alertas",
         "Todas las alertas del sistema consolidadas y priorizadas por severidad."),
        ("📥", "Importar / Exportar",
         "Carga masiva desde CSV o Excel con validación fila por fila, y exportación consolidada."),
        ("⚙️", "Administración",
         "Usuarios y roles, bitácora de auditoría y parámetros del sistema."),
    ]
    grid = st.columns(2)
    for i, (icon, title, desc) in enumerate(modules):
        with grid[i % 2]:
            st.markdown(f"""
            <div class="lg-module-card">
                <div class="lg-icon-badge">{icon}</div>
                <h4>{title}</h4>
                <p>{desc}</p>
            </div>
            """, unsafe_allow_html=True)

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
