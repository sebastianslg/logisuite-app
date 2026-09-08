"""
theme.py
Tema visual compartido por toda la aplicación: paleta de marca, CSS global
(fondo, tarjetas, tipografía) y sincronización del tema claro/oscuro con los
gráficos de Plotly.

Antes cada página creaba sus gráficos con el template por defecto de Plotly
(fondo blanco), sin importar si el usuario había activado el modo oscuro en la
barra lateral. El resultado eran gráficos con fondo blanco flotando sobre un
fondo oscuro — la inconsistencia visual que se veía "mal". La corrección real
es fijar `plotly.io.templates.default` ANTES de que la página cree sus figuras,
así todo `px.` y `go.Figure` de esa página hereda automáticamente el tema
correcto sin tener que tocar cada gráfico uno por uno.
"""
import streamlit as st
import plotly.io as pio

# ---------------------------------------------------------------------------
# Paleta de marca (coherente con .streamlit/config.toml)
# ---------------------------------------------------------------------------
BRAND = {
    "primary": "#2A9D8F",      # verde-azulado principal
    "primary_dark": "#1B6E63",
    "secondary": "#264653",    # azul petróleo (texto/encabezados)
    "accent": "#E76F51",       # coral (alertas/énfasis)
    "warning": "#E9C46A",      # amarillo (advertencias)
    "info": "#457B9D",         # azul medio
}

COLORWAY = [BRAND["primary"], BRAND["accent"], BRAND["secondary"],
            BRAND["warning"], BRAND["info"], "#8AB17D", "#B69AD6", "#F4A261"]


def is_dark_mode() -> bool:
    return bool(st.session_state.get("dark_mode", False))


def apply_page_theme() -> bool:
    """Se llama al inicio de cada página (igual que ensure_database_ready()).

    1. Fija el template por defecto de Plotly según el modo claro/oscuro
       vigente, para que TODOS los gráficos de la página salgan consistentes
       con el fondo, sin tener que modificar cada llamada a px./go.Figure.
    2. Inyecta el CSS de fondo y tarjetas para que el look sea el mismo en
       todas las páginas, no solo en la portada.

    Devuelve el booleano de modo oscuro, por si la página lo necesita.
    """
    dark = is_dark_mode()

    base_template = "plotly_dark" if dark else "plotly_white"
    custom = pio.templates[base_template]
    custom.layout.colorway = COLORWAY
    custom.layout.paper_bgcolor = "rgba(0,0,0,0)"
    custom.layout.plot_bgcolor = "rgba(0,0,0,0)"
    custom.layout.font.color = "#E8EDF2" if dark else "#264653"
    pio.templates["logisuite"] = custom
    pio.templates.default = "logisuite"

    if dark:
        st.markdown("""
        <style>
        .stApp {background-color:#12181F; color:#E8EDF2;}
        section[data-testid="stSidebar"] {background-color:#1B242F;}
        h1, h2, h3, h4, h5, p, span, label {color:#E8EDF2 !important;}
        .lg-card {background-color:#1B242F; border-left:6px solid #2A9D8F;
                   padding:16px 20px; border-radius:10px; margin-bottom:12px;}
        .lg-card h4 {margin:0 0 6px 0; color:#7FD1C1 !important;}
        .lg-card p {margin:0; color:#C3CDD7 !important; font-size:0.92rem;}
        div[data-testid="stMetric"] {background-color:#1B242F; border-radius:10px;
             padding:10px 14px; border:1px solid #2A3644;}
        </style>
        """, unsafe_allow_html=True)
    else:
        st.markdown("""
        <style>
        .lg-card {background-color:#FFFFFF; border-left:6px solid #2A9D8F;
                   padding:16px 20px; border-radius:10px; margin-bottom:12px;
                   box-shadow:0 1px 4px rgba(0,0,0,0.06);}
        .lg-card h4 {margin:0 0 6px 0; color:#264653;}
        .lg-card p {margin:0; color:#444; font-size:0.92rem;}
        div[data-testid="stMetric"] {background-color:#F7F9F9; border-radius:10px;
             padding:10px 14px; border:1px solid #E7ECEC;}
        </style>
        """, unsafe_allow_html=True)

    # Menú lateral: Streamlit genera automáticamente la navegación a partir de
    # pages/, así que en vez de reemplazarla por un componente frágil, se
    # embellece la navegación REAL con CSS: iconos más grandes, resaltado al
    # pasar el mouse y un indicador de la página activa, para que se sienta
    # como un menú desplegable "premium" sin arriesgar que deje de funcionar.
    sidebar_link_bg = "rgba(255,255,255,0.06)" if dark else "rgba(42,157,143,0.07)"
    sidebar_link_hover = "rgba(42,157,143,0.28)" if dark else "rgba(42,157,143,0.18)"
    sidebar_active = BRAND_PRIMARY = "#2A9D8F"
    st.markdown(f"""
    <style>
    [data-testid="stSidebarNav"] {{ padding-top: 6px; }}
    [data-testid="stSidebarNav"] ul li {{ margin-bottom: 3px; }}
    [data-testid="stSidebarNav"] a {{
        border-radius: 10px !important;
        padding: 8px 12px !important;
        background: {sidebar_link_bg};
        transition: all 0.15s ease;
        font-weight: 500;
    }}
    [data-testid="stSidebarNav"] a:hover {{
        background: {sidebar_link_hover} !important;
        transform: translateX(3px);
    }}
    [data-testid="stSidebarNav"] a[aria-current="page"] {{
        background: {sidebar_active} !important;
        box-shadow: 0 2px 8px rgba(42,157,143,0.35);
    }}
    [data-testid="stSidebarNav"] a[aria-current="page"] span {{ color:#FFFFFF !important; }}
    </style>
    """, unsafe_allow_html=True)

    return dark


def page_header(icon: str, title: str, subtitle: str = "") -> None:
    """Mini-banner de cabecera consistente para todas las páginas (no solo la
    portada), con el mismo degradado de marca que el hero de app.py. Sustituye
    a los pares sueltos st.title()/st.caption() para que las 10 páginas
    compartan una misma identidad visual en vez de un h1 plano sobre blanco."""
    import streamlit as st
    subtitle_html = (f'<p style="color:rgba(255,255,255,0.9); font-size:0.96rem; '
                      f'margin:4px 0 0 0;">{subtitle}</p>') if subtitle else ""
    st.markdown(f"""
    <div style="background: linear-gradient(120deg, {BRAND['secondary']} 0%,
                {BRAND['primary_dark']} 60%, {BRAND['primary']} 100%);
                border-radius: 14px; padding: 20px 26px; margin-bottom: 18px;
                box-shadow: 0 4px 14px rgba(0,0,0,0.12);">
        <h2 style="color:#FFFFFF; margin:0; font-size:1.6rem;">{icon} {title}</h2>
        {subtitle_html}
    </div>
    """, unsafe_allow_html=True)
