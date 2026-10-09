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

# El sistema de diseño (CSS global + plantilla Plotly) se inyecta al arrancar,
# antes del login, para que también la pantalla de acceso salga con el tema.
from utils.theme import apply_page_theme, render_kpi_card, CYAN, EMERALD, TEXT_MUTED
apply_page_theme()

from utils.i18n import t, language_selector
from utils.auth import login_form, render_sidebar_user
from utils.alerts import alert_counts
from utils.data_tools import global_search

if not login_form():
    st.stop()

# ---------------------------------------------------------------------------
# Barra lateral: usuario, idioma y búsqueda global
# ---------------------------------------------------------------------------
render_sidebar_user()
language_selector()

with st.sidebar:
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
                            f"<span style='font-size:0.82rem;color:{TEXT_MUTED}'>"
                            f"{r.get('modulo','')} — {r.get('descripcion','')}</span>",
                            unsafe_allow_html=True)

# ---------------------------------------------------------------------------
# CSS específico de la portada: hero con brillo cyan y tarjetas de módulo
# glassmorphism, sobre el CSS global de utils/theme.py.
# ---------------------------------------------------------------------------
st.markdown(f"""
<style>
.lg-hero {{
    position: relative; overflow: hidden; border-radius: 16px; padding: 40px 44px;
    margin-bottom: 22px; border: 1px solid rgba(255,255,255,0.08);
    background:
        radial-gradient(700px 300px at 0% 0%, rgba(0,242,254,0.14), transparent 60%),
        radial-gradient(600px 300px at 100% 100%, rgba(16,185,129,0.10), transparent 60%),
        rgba(255,255,255,0.02);
}}
.lg-hero h1 {{
    font-size: 2.6rem; font-weight: 800; margin: 0 0 10px 0; letter-spacing: -0.03em;
    background: linear-gradient(90deg, #F8FAFC 0%, {CYAN} 60%, {EMERALD} 100%);
    -webkit-background-clip: text; background-clip: text; color: transparent !important;
    -webkit-text-fill-color: transparent;
}}
.lg-hero p {{ color: {TEXT_MUTED} !important; font-size: 1.05rem; margin: 0; max-width: 640px; }}
.lg-hero .lg-badge {{
    display: inline-block; background: rgba(0,242,254,0.08); color: {CYAN} !important;
    border: 1px solid rgba(0,242,254,0.25); padding: 4px 12px; border-radius: 999px;
    font-size: 0.74rem; margin-bottom: 16px; letter-spacing: 0.08em; font-weight: 600;
}}
.lg-module-card .lg-icon-badge {{
    display: inline-flex; align-items: center; justify-content: center;
    width: 40px; height: 40px; border-radius: 10px; font-size: 1.2rem; margin-bottom: 8px;
    background: rgba(0,242,254,0.08); border: 1px solid rgba(0,242,254,0.20);
}}
.lg-module-card p {{ margin: 0 0 4px 0; color: {TEXT_MUTED} !important; font-size: 0.9rem; line-height: 1.45; }}
.lg-hover-extra {{
    max-height: 0; opacity: 0; overflow: hidden;
    transition: max-height 0.25s ease, opacity 0.2s ease;
    border-top: 1px dashed rgba(0,242,254,0.25); margin-top: 0;
}}
[data-testid="stVerticalBlockBorderWrapper"]:hover .lg-hover-extra {{
    max-height: 220px; opacity: 1; margin-top: 10px; padding-top: 8px;
}}
.lg-hover-extra ul {{ margin: 0; padding-left: 18px; }}
.lg-hover-extra li {{ font-size: 0.83rem; color: {TEXT_MUTED} !important; margin-bottom: 3px; }}
.lg-hover-hint {{ font-size: 0.72rem; color: {CYAN} !important; font-weight: 600;
                   margin-top: 6px; letter-spacing: 0.02em; opacity: 0.8; }}
[data-testid="stVerticalBlockBorderWrapper"] {{ transition: border-color 0.2s ease, transform 0.2s ease; }}
[data-testid="stVerticalBlockBorderWrapper"]:hover {{ border-color: rgba(0,242,254,0.25) !important; }}

/* st.page_link vestido como botón/chip sin alterar su navegación */
div[data-testid="stPageLink"] {{
    background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08);
    border-radius: 10px; padding: 6px 4px; transition: all 0.15s ease;
}}
div[data-testid="stPageLink"]:hover {{
    border-color: rgba(0,242,254,0.45); box-shadow: 0 6px 20px rgba(0,242,254,0.10);
    transform: translateY(-2px);
}}
div[data-testid="stPageLink"] p {{ font-weight: 600 !important; font-size: 0.92rem !important; color: #E2E8F0 !important; }}
.lg-module-link div[data-testid="stPageLink"] p {{ font-size: 1.02rem !important; }}
</style>
""", unsafe_allow_html=True)

# ---------------------------------------------------------------------------
# HERO: banner de bienvenida con ilustración SVG (ruta + camión + nodos)
# ---------------------------------------------------------------------------
from utils.illustrations import warehouse_scene_svg
# El SVG se compacta en una sola línea: sus líneas en blanco seguidas de
# líneas indentadas harían que Markdown lo pinte como bloque de código.
hero_svg = " ".join(warehouse_scene_svg(width=260, height=170).split())

st.markdown(f"""
<div class="lg-hero">
    <span class="lg-badge">TMS · RED LOGÍSTICA DE COLOMBIA</span>
    <h1>{t('app_title')}</h1>
    <p>{t('app_subtitle')} — CEDIs, puertos y corredores troncales de Colombia sobre
    mapas WebGL, optimización de rutas, motor de costos y simulación de la red.</p>
    <div style="position:absolute; right:28px; bottom:0; opacity:0.55;">{hero_svg}</div>
</div>
""", unsafe_allow_html=True)

# ---------------------------------------------------------------------------
# Fila de accesos rápidos: enlaces reales a las páginas más usadas
# (estilo "Rastrear / Cotizar / Recoger", pero funcionales de verdad)
# ---------------------------------------------------------------------------
accesos_rapidos = [
    ("pages/1_Dashboard_Ejecutivo.py", "Dashboard Ejecutivo", "🏭"),
    ("pages/8_Centro_de_Alertas.py", "Centro de Alertas", "🚨"),
    ("pages/4_Transportation_Network.py", "Mapa de la Red", "🗺️"),
    ("pages/9_Importar_Exportar.py", "Importar / Exportar", "📥"),
    ("pages/10_Administracion.py", "Administración", "⚙️"),
]
chip_cols = st.columns(len(accesos_rapidos))
for col, (destino, etiqueta, icono) in zip(chip_cols, accesos_rapidos):
    with col:
        st.page_link(destino, label=etiqueta, icon=icono, width="stretch")

st.write("")

# ---------------------------------------------------------------------------
# Banda de alertas activas
# ---------------------------------------------------------------------------
conteo = alert_counts()
if conteo["total"]:
    a1, a2, a3, a4 = st.columns(4)
    with a1:
        render_kpi_card("Alertas críticas", conteo["critica"],
                        "requieren acción" if conteo["critica"] else "sin pendientes",
                        conteo["critica"] == 0, "🔴")
    with a2:
        render_kpi_card("Alertas altas", conteo["alta"], icon="🟠")
    with a3:
        render_kpi_card("Alertas medias", conteo["media"], icon="🟡")
    with a4:
        render_kpi_card(f"{t('alerts')} ({t('total')})", conteo["total"], icon="🚨")
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
        ("pages/2_Warehouse_Management.py", "📦", "Warehouse Management",
         "Inventario en tiempo real, ciclo Inbound/Outbound, alertas de stock, pronóstico de "
         "demanda, EOQ, punto de reorden, clasificación ABC y trazabilidad de SKU.",
         ["Pronóstico de demanda (SMA/SES)", "EOQ y Punto de Reorden", "Clasificación ABC (Pareto)",
          "Ocupación por zona", "Trazabilidad de SKU"]),
        ("pages/3_Freight_Management.py", "🚚", "Freight Management",
         "Registro y tracking de envíos, motor de costos de tres componentes, consolidación de "
         "carga, simulador de modos de transporte y huella de carbono.",
         ["Motor de costos (3 componentes)", "Consolidación de carga", "Simulador de modos",
          "Huella de carbono", "Historial de costos por corredor"]),
        ("pages/4_Transportation_Network.py", "🗺️", "Transportation Management",
         "Mapa geográfico de la red, ruteo con Dijkstra, circuitos multi-parada (TSP con 2-opt), "
         "validación de capacidad, programación en Gantt y control de ETA vs. real.",
         ["Mapa geográfico interactivo", "Ruteo multi-parada (TSP)", "Validación de capacidad",
          "Programación en Gantt", "Control de ETA vs. real"]),
        ("pages/5_Fleet_Management.py", "🚛", "Fleet Management",
         "Vehículos y conductores, mantenimiento preventivo y correctivo, costo total de "
         "propiedad (TCO) y predicción del próximo servicio.",
         ["Costo Total de Propiedad (TCO)", "Predicción de mantenimiento", "Disponibilidad de flota",
          "Vigencia de licencias", "Alertas combinadas"]),
        ("pages/6_Customs_Management.py", "🛃", "Customs Management",
         "Documentación aduanera, liquidación de tributos, escenarios arancelarios comparados y "
         "checklist de completitud documental.",
         ["Escenarios arancelarios", "Checklist documental", "Línea de tiempo de trámites",
          "Liquidación de tributos"]),
        ("pages/7_Simulacion_Red.py", "🔬", "Simulación y Optimización",
         "Cierre de nodos, ubicación óptima de instalaciones, criticidad de la red, simulación "
         "de Monte Carlo y análisis de sensibilidad.",
         ["Ubicación óptima de instalaciones", "Criticidad de la red", "Simulación Monte Carlo",
          "Sensibilidad de costos", "Simulación de cierre de nodo"]),
        ("pages/8_Centro_de_Alertas.py", "🚨", "Centro de Alertas",
         "Todas las alertas del sistema consolidadas y priorizadas por severidad.",
         ["Stock crítico", "Licencias por vencer", "Documentos por vencer", "Envíos retrasados"]),
        ("pages/9_Importar_Exportar.py", "📥", "Importar / Exportar",
         "Carga masiva desde CSV o Excel con validación fila por fila, y exportación consolidada.",
         ["Plantillas descargables", "Validación fila por fila", "Exportación consolidada"]),
        ("pages/10_Administracion.py", "⚙️", "Administración",
         "Usuarios y roles, bitácora de auditoría y parámetros del sistema.",
         ["Gestión de usuarios y roles", "Bitácora de auditoría", "Parámetros del sistema"]),
    ]
    grid = st.columns(2)
    for i, (destino, icon, title, desc, features) in enumerate(modules):
        with grid[i % 2]:
            with st.container(border=True):
                st.markdown(f'<div class="lg-module-card"><div class="lg-icon-badge">{icon}</div></div>',
                            unsafe_allow_html=True)
                st.markdown('<div class="lg-module-link">', unsafe_allow_html=True)
                st.page_link(destino, label=title, width="stretch")
                st.markdown('</div>', unsafe_allow_html=True)
                st.markdown(f'<div class="lg-module-card"><p>{desc}</p></div>', unsafe_allow_html=True)
                items_html = "".join(f"<li>{f}</li>" for f in features)
                st.markdown(f"""
                <div class="lg-hover-extra">
                    <ul>{items_html}</ul>
                </div>
                <div class="lg-hover-hint">Pasa el mouse para ver el detalle</div>
                """, unsafe_allow_html=True)

with col2:
    st.markdown(f"### {t('system_status')}")

    def _count(sql: str) -> int:
        try:
            return int(run_query(sql).iloc[0]["c"])
        except Exception:
            return 0

    estado = [
        ("Nodos activos en la red", "SELECT COUNT(*) c FROM nodes WHERE active=1", "📍"),
        ("Corredores de transporte", "SELECT COUNT(*) c FROM corridors WHERE active=1", "🛣️"),
        ("Envíos registrados", "SELECT COUNT(*) c FROM shipments", "📦"),
        ("SKUs en inventario", "SELECT COUNT(*) c FROM inventory_items", "🏷️"),
        ("Vehículos en flota", "SELECT COUNT(*) c FROM vehicles", "🚛"),
        ("Documentos aduaneros", "SELECT COUNT(*) c FROM customs_documents", "🛃"),
    ]
    sc1, sc2 = st.columns(2)
    for i, (titulo, sql, icono) in enumerate(estado):
        with (sc1 if i % 2 == 0 else sc2):
            render_kpi_card(titulo, _count(sql), icon=icono)

    st.info("Usa el menú lateral para navegar entre módulos. El Dashboard Ejecutivo consolida "
            "los KPIs de toda la red.", icon="ℹ️")

st.divider()

# ---------------------------------------------------------------------------
# Actividad reciente: últimos envíos y alertas activas (datos reales, no
# decorativos), para que la portada se sienta viva y no solo un catálogo
# estático de módulos.
# ---------------------------------------------------------------------------
st.markdown("### 🕒 Actividad reciente")
act1, act2 = st.columns(2)

with act1:
    st.markdown("**Últimos envíos registrados**")
    recientes = run_query("""
        SELECT s.shipment_id, no.name AS origen, nd.name AS destino, s.status, s.total_cost
        FROM shipments s
        JOIN nodes no ON s.origin_node_id = no.node_id
        JOIN nodes nd ON s.dest_node_id = nd.node_id
        ORDER BY s.shipment_id DESC LIMIT 5
    """)
    if recientes.empty:
        st.caption("Aún no hay envíos registrados.")
    else:
        estado_color = {"Entregado": "🟢", "En Transito": "🔵", "Retrasado": "🔴",
                         "Consolidado": "🟣", "Registrado": "⚪"}
        for _, r in recientes.iterrows():
            icono = estado_color.get(r["status"], "⚪")
            st.markdown(f"{icono} **#{r['shipment_id']}** {r['origen']} → {r['destino']} "
                        f"· {r['status']} · ${r['total_cost']:,.0f}")

with act2:
    st.markdown("**Alertas activas más urgentes**")
    from utils.alerts import get_all_alerts
    urgentes = get_all_alerts()
    if not urgentes:
        st.caption("✅ No hay alertas activas en este momento.")
    else:
        orden = {"critica": 0, "alta": 1, "media": 2, "baja": 3}
        urgentes = sorted(urgentes, key=lambda a: orden.get(a.get("severidad"), 9))[:5]
        sev_icon = {"critica": "🔴", "alta": "🟠", "media": "🟡", "baja": "🟢"}
        for a in urgentes:
            icono = sev_icon.get(a.get("severidad"), "⚪")
            st.markdown(f"{icono} **{a.get('titulo','')}** — {a.get('detalle','')}")
        st.page_link("pages/8_Centro_de_Alertas.py", label="Ver todas las alertas", icon="🚨")

st.divider()
st.caption("Proyecto académico de Distribución y Transporte · SQLite relacional con claves "
           "foráneas · Optimización de rutas y redes con NetworkX · Visualización geográfica "
           "con pydeck · Reportes exportables en Excel y PDF")
