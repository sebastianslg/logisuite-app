"""
illustrations.py
Ilustraciones vectoriales (SVG) propias, de temática logística, para dar a la
aplicación un fondo visual atractivo sin depender de fotografías externas.

Se generan como SVG inline —no son fotos de stock ni archivos descargados—
precisamente para evitar dos problemas reales: (1) usar imágenes con derechos
de autor sin licencia verificable, y (2) depender de una URL externa que puede
romperse o dejar de cargar en el despliegue. Todo esto vive en el propio
repositorio y se renderiza instantáneamente en cualquier entorno.
"""
from utils.theme import BRAND


def warehouse_scene_svg(width: int = 420, height: int = 260) -> str:
    """Escena de bodega: estantería con cajas, montacargas y piso, en los
    colores de marca. Pensada como ilustración principal del hero/login."""
    return f"""
    <svg width="{width}" height="{height}" viewBox="0 0 420 260" xmlns="http://www.w3.org/2000/svg">
      <!-- piso -->
      <rect x="0" y="215" width="420" height="45" fill="rgba(255,255,255,0.08)"/>
      <line x1="0" y1="215" x2="420" y2="215" stroke="rgba(255,255,255,0.25)" stroke-width="2"/>

      <!-- estanteria izquierda -->
      <g transform="translate(15,40)">
        <rect x="0" y="0" width="8" height="175" fill="rgba(255,255,255,0.35)"/>
        <rect x="95" y="0" width="8" height="175" fill="rgba(255,255,255,0.35)"/>
        <rect x="0" y="15" width="103" height="5" fill="rgba(255,255,255,0.25)"/>
        <rect x="0" y="75" width="103" height="5" fill="rgba(255,255,255,0.25)"/>
        <rect x="0" y="135" width="103" height="5" fill="rgba(255,255,255,0.25)"/>
        <!-- cajas en estanteria -->
        <rect x="10" y="-28" width="34" height="28" rx="2" fill="#F4A261"/>
        <rect x="50" y="-22" width="30" height="22" rx="2" fill="#E9C46A"/>
        <rect x="10" y="32" width="36" height="28" rx="2" fill="#E9C46A"/>
        <rect x="55" y="35" width="30" height="25" rx="2" fill="#F4A261"/>
        <rect x="12" y="92" width="32" height="28" rx="2" fill="#F4A261"/>
        <rect x="52" y="90" width="34" height="30" rx="2" fill="#FFFFFF" opacity="0.85"/>
      </g>

      <!-- estanteria derecha (mas atras, mas pequena = perspectiva) -->
      <g transform="translate(330,60) scale(0.8)">
        <rect x="0" y="0" width="6" height="150" fill="rgba(255,255,255,0.28)"/>
        <rect x="70" y="0" width="6" height="150" fill="rgba(255,255,255,0.28)"/>
        <rect x="0" y="10" width="76" height="4" fill="rgba(255,255,255,0.2)"/>
        <rect x="0" y="70" width="76" height="4" fill="rgba(255,255,255,0.2)"/>
        <rect x="8" y="-22" width="26" height="22" rx="2" fill="#E9C46A" opacity="0.9"/>
        <rect x="40" y="-18" width="24" height="18" rx="2" fill="#F4A261" opacity="0.9"/>
        <rect x="8" y="18" width="28" height="24" rx="2" fill="#FFFFFF" opacity="0.7"/>
      </g>

      <!-- pallet con cajas apiladas, centro -->
      <g transform="translate(155,150)">
        <rect x="-5" y="55" width="90" height="10" rx="2" fill="#8D6E63"/>
        <rect x="0" y="10" width="38" height="45" rx="2" fill="#F4A261"/>
        <rect x="42" y="0" width="38" height="55" rx="2" fill="#E9C46A"/>
        <rect x="10" y="-25" width="28" height="35" rx="2" fill="#FFFFFF" opacity="0.9"/>
        <line x1="0" y1="30" x2="38" y2="30" stroke="rgba(0,0,0,0.15)" stroke-width="2"/>
        <line x1="42" y1="27" x2="80" y2="27" stroke="rgba(0,0,0,0.15)" stroke-width="2"/>
      </g>

      <!-- montacargas simplificado -->
      <g transform="translate(250,175)">
        <rect x="0" y="10" width="42" height="24" rx="3" fill="#264653"/>
        <rect x="42" y="0" width="10" height="34" fill="#F4A261"/>
        <rect x="50" y="-8" width="6" height="42" fill="#FFD166"/>
        <circle cx="10" cy="38" r="8" fill="#1B242F"/>
        <circle cx="10" cy="38" r="3" fill="#CBD5D9"/>
        <circle cx="34" cy="38" r="8" fill="#1B242F"/>
        <circle cx="34" cy="38" r="3" fill="#CBD5D9"/>
      </g>

      <!-- luces de techo, decorativo -->
      <circle cx="60" cy="20" r="4" fill="rgba(255,209,102,0.7)"/>
      <circle cx="210" cy="14" r="4" fill="rgba(255,209,102,0.7)"/>
      <circle cx="360" cy="20" r="4" fill="rgba(255,209,102,0.7)"/>
    </svg>
    """


def route_truck_svg(width: int = 230, height: int = 150) -> str:
    """Camión + ruta punteada + nodos, usada en accesos rápidos y banners
    secundarios (versión compacta de la escena de transporte)."""
    return f"""
    <svg width="{width}" height="{height}" viewBox="0 0 230 150" xmlns="http://www.w3.org/2000/svg">
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


def box_pattern_data_uri(opacity: float = 0.05, color: str = None) -> str:
    """Patrón repetible de cajas/paquetes en isometría simple, para usar como
    fondo ambiental de toda la página (muy sutil, no compite con el contenido).
    Devuelve un data-URI listo para 'background-image: url(...)' en CSS."""
    import base64
    c = color or BRAND["secondary"]
    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120">
        <g opacity="{opacity}" fill="{c}">
            <rect x="10" y="10" width="34" height="34" rx="3"/>
            <rect x="70" y="40" width="28" height="28" rx="3"/>
            <rect x="30" y="80" width="30" height="30" rx="3"/>
        </g>
    </svg>"""
    encoded = base64.b64encode(svg.encode("utf-8")).decode("ascii")
    return f"data:image/svg+xml;base64,{encoded}"


def page_background_css(dark: bool) -> str:
    """CSS del fondo ambiental de toda la app: color base + patrón de cajas
    muy tenue, para que ya no sea un blanco/negro plano sino que tenga textura
    de marca, sin distraer del contenido ni afectar la legibilidad."""
    uri = box_pattern_data_uri(opacity=0.05 if not dark else 0.08,
                                color="#264653" if not dark else "#2A9D8F")
    return f"""
    <style>
    .stApp {{
        background-image: url("{uri}");
        background-repeat: repeat;
        background-size: 120px 120px;
    }}
    </style>
    """
