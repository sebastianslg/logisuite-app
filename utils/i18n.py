"""
i18n.py
Internacionalización simple basada en diccionarios (español / inglés).
Se usa t("clave") en las páginas; si la clave no existe, devuelve la clave
misma para que nunca se rompa la interfaz.
"""
import streamlit as st

TRANSLATIONS = {
    "es": {
        # Navegación y generales
        "app_title": "LogiSuite — Plataforma de Logística, Distribución y Transporte",
        "app_subtitle": "Aplicación web 100% nativa para la nube · Streamlit + SQLite + NetworkX",
        "modules": "Módulos funcionales",
        "system_status": "Estado del sistema",
        "language": "Idioma",
        "search": "Búsqueda global",
        "search_placeholder": "SKU, placa, documento, envío...",
        "export_excel": "Descargar Excel",
        "export_pdf": "Descargar PDF",
        "export_all": "Exportar todo",
        "save": "Guardar",
        "update": "Actualizar",
        "register": "Registrar",
        "calculate": "Calcular",
        "no_data": "No hay datos registrados.",
        "alerts": "Alertas",
        "total": "Total",
        # Módulos
        "warehouse": "Gestión de Almacenes",
        "freight": "Gestión de Carga y Fletes",
        "transportation": "Gestión de Transporte",
        "fleet": "Gestión de Flota",
        "customs": "Gestión Aduanera",
        "simulation": "Simulación de Red",
        "dashboard": "Dashboard Ejecutivo",
        # KPIs
        "otif": "OTIF (Entregas a tiempo y completas)",
        "total_cost": "Costo total",
        "fleet_utilization": "Utilización de flota",
        "rotation_index": "Índice de rotación",
        "service_level": "Nivel de servicio",
        "avg_distance": "Distancia promedio",
        # Inventario
        "inventory": "Inventario",
        "sku": "SKU",
        "product": "Producto",
        "quantity": "Cantidad",
        "zone": "Zona",
        "critical_stock": "Stock crítico",
        "overstock": "Sobre-stock",
        "valuation": "Valoración",
    },
    "en": {
        "app_title": "LogiSuite — Logistics, Distribution and Transportation Platform",
        "app_subtitle": "100% cloud-native web application · Streamlit + SQLite + NetworkX",
        "modules": "Functional modules",
        "system_status": "System status",
        "language": "Language",
        "search": "Global search",
        "search_placeholder": "SKU, plate, document, shipment...",
        "export_excel": "Download Excel",
        "export_pdf": "Download PDF",
        "export_all": "Export all",
        "save": "Save",
        "update": "Update",
        "register": "Register",
        "calculate": "Calculate",
        "no_data": "No data recorded.",
        "alerts": "Alerts",
        "total": "Total",
        "warehouse": "Warehouse Management",
        "freight": "Freight Management",
        "transportation": "Transportation Management",
        "fleet": "Fleet Management",
        "customs": "Customs Management",
        "simulation": "Network Simulation",
        "dashboard": "Executive Dashboard",
        "otif": "OTIF (On-Time In-Full)",
        "total_cost": "Total cost",
        "fleet_utilization": "Fleet utilization",
        "rotation_index": "Rotation index",
        "service_level": "Service level",
        "avg_distance": "Average distance",
        "inventory": "Inventory",
        "sku": "SKU",
        "product": "Product",
        "quantity": "Quantity",
        "zone": "Zone",
        "critical_stock": "Critical stock",
        "overstock": "Overstock",
        "valuation": "Valuation",
    },
}


def get_language() -> str:
    """Idioma activo en la sesión (por defecto español)."""
    return st.session_state.get("lang", "es")


def set_language(lang: str) -> None:
    st.session_state["lang"] = lang if lang in TRANSLATIONS else "es"


def t(key: str) -> str:
    """Traduce una clave al idioma activo. Si no existe, devuelve la clave."""
    lang = get_language()
    return TRANSLATIONS.get(lang, {}).get(key, TRANSLATIONS["es"].get(key, key))


def language_selector(location="sidebar") -> None:
    """Renderiza el selector de idioma."""
    container = st.sidebar if location == "sidebar" else st
    opciones = {"es": "🇪🇸 Español", "en": "🇬🇧 English"}
    actual = get_language()
    seleccion = container.selectbox(
        t("language"), options=list(opciones.keys()),
        format_func=lambda k: opciones[k],
        index=list(opciones.keys()).index(actual), key="lang_selector",
    )
    if seleccion != actual:
        set_language(seleccion)
        st.rerun()
