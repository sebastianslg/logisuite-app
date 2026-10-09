"""
theme.py
Sistema de diseño de LogiSuite (estilo Vercel/Linear, modo oscuro).

Concentra en un solo lugar:
  - La paleta corporativa (Cyan, Azul Eléctrico, Esmeralda sobre fondo #0A0E17).
  - El CSS global (tipografía Inter, sidebar, ocultar el chrome nativo de
    Streamlit, ancho útil del 95%).
  - Las tarjetas KPI con efecto glassmorphism (`render_kpi_card`).
  - La plantilla de Plotly con fondo transparente, que se fija como default
    para que TODOS los `px.` / `go.Figure` de la página la hereden sin tener
    que tocar cada gráfico.

La aplicación es exclusivamente oscura: .streamlit/config.toml fija
base="dark" y este módulo asume ese fondo en todos sus colores.
"""
import html

import plotly.graph_objects as go
import plotly.io as pio
import streamlit as st

# ---------------------------------------------------------------------------
# Paleta corporativa
# ---------------------------------------------------------------------------
CYAN = "#00F2FE"
ELECTRIC_BLUE = "#4FACFE"
EMERALD = "#10B981"
VIOLET = "#8B5CF6"
AMBER = "#F59E0B"
ROSE = "#F43F5E"

BG = "#0A0E17"
SURFACE = "#0F172A"
SIDEBAR_BG = "#06080E"
TEXT = "#F8FAFC"
TEXT_MUTED = "#94A3B8"
BORDER = "rgba(255,255,255,0.08)"

# Claves históricas conservadas: auth.py, illustrations.py y app.py las usan.
BRAND = {
    "primary": CYAN,
    "primary_dark": ELECTRIC_BLUE,
    "secondary": SURFACE,
    "accent": ROSE,
    "warning": AMBER,
    "info": ELECTRIC_BLUE,
    "success": EMERALD,
}

COLORWAY = [CYAN, ELECTRIC_BLUE, EMERALD, VIOLET, AMBER, ROSE, "#22D3EE", "#34D399"]

PLOTLY_TEMPLATE = "logisuite_dark"


def _build_plotly_template() -> go.layout.Template:
    """Plantilla basada en plotly_dark con fondo 100% transparente, para que los
    gráficos se fundan con las tarjetas y el fondo de la aplicación."""
    tpl = go.layout.Template(pio.templates["plotly_dark"])
    tpl.layout.update(
        colorway=COLORWAY,
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        font=dict(family="Inter, -apple-system, Segoe UI, sans-serif", color="#CBD5E1", size=13),
        title=dict(font=dict(color=TEXT, size=16)),
        xaxis=dict(gridcolor="rgba(148,163,184,0.10)", zerolinecolor="rgba(148,163,184,0.18)",
                   linecolor="rgba(148,163,184,0.18)"),
        yaxis=dict(gridcolor="rgba(148,163,184,0.10)", zerolinecolor="rgba(148,163,184,0.18)",
                   linecolor="rgba(148,163,184,0.18)"),
        legend=dict(bgcolor="rgba(0,0,0,0)", font=dict(color="#CBD5E1")),
        hoverlabel=dict(bgcolor=SURFACE, bordercolor=CYAN, font=dict(color=TEXT)),
        margin=dict(l=20, r=20, t=40, b=20),
    )
    return tpl


pio.templates[PLOTLY_TEMPLATE] = _build_plotly_template()
pio.templates.default = PLOTLY_TEMPLATE


# ---------------------------------------------------------------------------
# CSS global
# ---------------------------------------------------------------------------
_GLOBAL_CSS = f"""
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');

html, body, [class*="css"], .stApp, .stMarkdown, button, input, textarea, select {{
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
}}
.stApp {{
    background:
        radial-gradient(1200px 600px at 85% -10%, rgba(0,242,254,0.06), transparent 60%),
        radial-gradient(900px 500px at -10% 110%, rgba(16,185,129,0.05), transparent 60%),
        {BG};
    color: {TEXT};
}}

/* Chrome nativo de Streamlit fuera */
#MainMenu, header[data-testid="stHeader"], footer, [data-testid="stToolbar"],
[data-testid="stDecoration"], [data-testid="stStatusWidget"] {{
    visibility: hidden; height: 0; display: none;
}}

/* Ancho útil del 95% */
.block-container, [data-testid="stMainBlockContainer"] {{
    max-width: 95% !important;
    padding-top: 1.6rem !important;
    padding-bottom: 2rem !important;
    padding-left: 1.5rem !important;
    padding-right: 1.5rem !important;
}}

/* Sidebar */
section[data-testid="stSidebar"] {{
    background-color: {SIDEBAR_BG} !important;
    border-right: 1px solid rgba(255,255,255,0.04);
}}
section[data-testid="stSidebar"] > div {{ background-color: {SIDEBAR_BG}; }}
[data-testid="stSidebarNav"] {{ padding-top: 6px; }}
[data-testid="stSidebarNav"] ul li {{ margin-bottom: 2px; }}
[data-testid="stSidebarNav"] a {{
    border-radius: 8px !important; padding: 7px 12px !important;
    transition: background 0.15s ease, transform 0.15s ease; font-weight: 500;
}}
[data-testid="stSidebarNav"] a:hover {{
    background: rgba(255,255,255,0.04) !important; transform: translateX(2px);
}}
[data-testid="stSidebarNav"] a[aria-current="page"] {{
    background: rgba(0,242,254,0.08) !important;
    box-shadow: inset 2px 0 0 {CYAN};
}}
[data-testid="stSidebarNav"] a[aria-current="page"] span {{ color: {CYAN} !important; }}

/* Tipografía */
h1, h2, h3, h4 {{ color: {TEXT} !important; letter-spacing: -0.02em; font-weight: 700; }}
h3 {{ font-size: 1.15rem !important; }}
p, label, span, li {{ color: #CBD5E1; }}
hr {{ border-color: {BORDER} !important; }}

/* Contenedores, tabs, expanders */
[data-testid="stVerticalBlockBorderWrapper"] {{
    border-color: {BORDER} !important; border-radius: 12px !important;
    background: rgba(255,255,255,0.015);
}}
[data-testid="stExpander"] details {{
    border: 1px solid {BORDER} !important; border-radius: 12px !important;
    background: rgba(255,255,255,0.02);
}}
.stTabs [data-baseweb="tab-list"] {{ gap: 4px; border-bottom: 1px solid {BORDER}; }}
.stTabs [data-baseweb="tab"] {{
    background: transparent; border-radius: 8px 8px 0 0; padding: 8px 14px; color: {TEXT_MUTED};
}}
.stTabs [aria-selected="true"] {{ color: {CYAN} !important; }}
.stTabs [data-baseweb="tab-highlight"] {{ background-color: {CYAN} !important; }}

/* Botones */
.stButton > button, .stDownloadButton > button, .stFormSubmitButton > button {{
    border-radius: 8px !important; border: 1px solid rgba(255,255,255,0.10) !important;
    background: rgba(255,255,255,0.03) !important; color: {TEXT} !important;
    font-weight: 500; transition: all 0.15s ease;
}}
.stButton > button:hover, .stDownloadButton > button:hover, .stFormSubmitButton > button:hover {{
    border-color: {CYAN} !important; box-shadow: 0 0 0 1px rgba(0,242,254,0.25),
    0 6px 20px rgba(0,242,254,0.10); transform: translateY(-1px);
}}
button[kind^="primary"], button[data-testid^="stBaseButton-primary"] {{
    background: linear-gradient(135deg, {CYAN} 0%, {ELECTRIC_BLUE} 100%) !important;
    color: #04121A !important; border: none !important; font-weight: 600;
}}
button[kind^="primary"] p, button[data-testid^="stBaseButton-primary"] p {{
    color: #04121A !important; font-weight: 600;
}}

/* Inputs */
[data-baseweb="input"], [data-baseweb="select"] > div, [data-baseweb="textarea"] {{
    background-color: rgba(255,255,255,0.03) !important; border-color: rgba(255,255,255,0.10) !important;
    border-radius: 8px !important;
}}

/* DataFrames */
[data-testid="stDataFrame"], [data-testid="stTable"] {{
    border: 1px solid {BORDER}; border-radius: 12px; overflow: hidden;
}}

/* st.metric residual (páginas secundarias): mismo lenguaje visual */
div[data-testid="stMetric"] {{
    background: rgba(255,255,255,0.03); border: 1px solid {BORDER};
    border-radius: 12px; padding: 12px 16px;
}}
div[data-testid="stMetricValue"] {{ color: {TEXT}; font-weight: 700; }}

/* Mapas pydeck */
[data-testid="stDeckGlJsonChart"] {{
    border-radius: 14px; overflow: hidden; border: 1px solid {BORDER};
}}

/* Tarjeta informativa heredada */
.lg-card {{
    background: rgba(255,255,255,0.03); border: 1px solid {BORDER};
    border-left: 3px solid {CYAN}; padding: 14px 18px; border-radius: 12px; margin-bottom: 12px;
}}
.lg-card h4 {{ margin: 0 0 6px 0; color: {CYAN} !important; }}
.lg-card p {{ margin: 0; color: {TEXT_MUTED} !important; font-size: 0.92rem; }}

/* KPI cards (glassmorphism) */
.kpi-card {{
    position: relative; overflow: hidden;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 12px; padding: 18px 20px; margin-bottom: 14px;
    backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
    transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
    min-height: 118px;
}}
.kpi-card::before {{
    content: ""; position: absolute; inset: 0 0 auto 0; height: 1px;
    background: linear-gradient(90deg, transparent, rgba(0,242,254,0.55), transparent);
    opacity: 0; transition: opacity 0.2s ease;
}}
.kpi-card:hover {{
    transform: translateY(-3px);
    border-color: rgba(0,242,254,0.28);
    box-shadow: 0 10px 30px rgba(0,0,0,0.35), 0 0 24px rgba(0,242,254,0.08);
}}
.kpi-card:hover::before {{ opacity: 1; }}
.kpi-head {{ display: flex; align-items: center; justify-content: space-between; }}
.kpi-title {{
    font-size: 0.74rem; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase;
    color: {TEXT_MUTED} !important;
}}
.kpi-icon {{
    display: inline-flex; align-items: center; justify-content: center;
    width: 32px; height: 32px; border-radius: 8px; font-size: 1rem;
    background: rgba(0,242,254,0.08); border: 1px solid rgba(0,242,254,0.18);
}}
.kpi-value {{
    font-size: 1.85rem; font-weight: 700; color: {TEXT} !important;
    margin-top: 10px; letter-spacing: -0.02em; line-height: 1.1;
}}
.kpi-delta {{
    display: inline-block; margin-top: 8px; font-size: 0.78rem; font-weight: 600;
    padding: 2px 8px; border-radius: 999px;
}}
.kpi-delta.pos {{ color: {EMERALD} !important; background: rgba(16,185,129,0.10); }}
.kpi-delta.neg {{ color: {ROSE} !important; background: rgba(244,63,94,0.10); }}
.kpi-delta.neu {{ color: {TEXT_MUTED} !important; background: rgba(148,163,184,0.10); }}

/* Cabecera de página */
.lg-page-header {{
    border: 1px solid {BORDER}; border-radius: 14px; padding: 20px 24px; margin-bottom: 20px;
    background: linear-gradient(120deg, rgba(0,242,254,0.07) 0%, rgba(79,172,254,0.04) 45%,
                rgba(16,185,129,0.04) 100%);
}}
.lg-page-header h2 {{ margin: 0; font-size: 1.55rem; color: {TEXT} !important; }}
.lg-page-header p {{ margin: 6px 0 0 0; color: {TEXT_MUTED} !important; font-size: 0.95rem; }}
.lg-eyebrow {{
    font-size: 0.72rem; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase;
    color: {CYAN} !important;
}}
</style>
"""


def inject_global_styles() -> None:
    """Inyecta el CSS global. Llamar una vez por página, tras set_page_config."""
    st.markdown(_GLOBAL_CSS, unsafe_allow_html=True)


def apply_page_theme() -> bool:
    """Punto de entrada que cada página llama al arrancar: fija la plantilla de
    Plotly e inyecta el CSS global. Devuelve True (modo oscuro) por
    compatibilidad con el código que esperaba ese booleano."""
    pio.templates.default = PLOTLY_TEMPLATE
    inject_global_styles()
    return True


# ---------------------------------------------------------------------------
# Componentes
# ---------------------------------------------------------------------------
def kpi_card_html(title: str, value, delta: str = None, is_positive: bool = None,
                  icon: str = "") -> str:
    """HTML de una tarjeta KPI. `is_positive=None` pinta el delta en neutro."""
    if delta is None or delta == "":
        delta_html = ""
    else:
        css = "neu" if is_positive is None else ("pos" if is_positive else "neg")
        arrow = "" if is_positive is None else ("▲ " if is_positive else "▼ ")
        delta_html = f'<span class="kpi-delta {css}">{arrow}{html.escape(str(delta))}</span>'
    icon_html = f'<span class="kpi-icon">{icon}</span>' if icon else ""
    return (
        f'<div class="kpi-card"><div class="kpi-head">'
        f'<span class="kpi-title">{html.escape(str(title))}</span>{icon_html}</div>'
        f'<div class="kpi-value">{html.escape(str(value))}</div>{delta_html}</div>'
    )


def render_kpi_card(title: str, value, delta: str = None, is_positive: bool = None,
                    icon: str = "") -> None:
    """Tarjeta KPI glassmorphism. Pensada para usarse dentro de st.columns:

        c1, c2 = st.columns(2)
        with c1: render_kpi_card("OTIF", "92%", "+3 pts", True, "🎯")
    """
    st.markdown(kpi_card_html(title, value, delta, is_positive, icon), unsafe_allow_html=True)


def render_kpi_row(cards: list) -> None:
    """Atajo: una fila de tarjetas, cada una como dict con las claves de
    render_kpi_card (title, value, delta, is_positive, icon)."""
    cols = st.columns(len(cards))
    for col, card in zip(cols, cards):
        with col:
            render_kpi_card(**card)


def page_header(icon: str, title: str, subtitle: str = "") -> None:
    """Cabecera consistente para todas las páginas."""
    subtitle_html = f"<p>{subtitle}</p>" if subtitle else ""
    st.markdown(f"""
    <div class="lg-page-header">
        <span class="lg-eyebrow">LogiSuite TMS</span>
        <h2>{icon} {title}</h2>
        {subtitle_html}
    </div>
    """, unsafe_allow_html=True)


# Tintes de fila para DataFrames con .style.apply (legibles sobre fondo oscuro)
ROW_TINT = {
    "ok": "background-color: rgba(16,185,129,0.12)",
    "info": "background-color: rgba(79,172,254,0.12)",
    "warn": "background-color: rgba(245,158,11,0.13)",
    "bad": "background-color: rgba(244,63,94,0.14)",
    "critical": "background-color: rgba(244,63,94,0.24)",
    "none": "",
}

STATUS_COLORS = {"Disponible": EMERALD, "En Ruta": CYAN, "Mantenimiento": AMBER,
                 "Fuera de Servicio": ROSE, "Entregado": EMERALD, "En Transito": CYAN,
                 "Retrasado": ROSE, "Registrado": TEXT_MUTED, "Consolidado": VIOLET}


def dataframe_kwargs() -> dict:
    """Configuración visual estándar para st.dataframe: ancho total, sin índice."""
    return {"width": "stretch", "hide_index": True}
