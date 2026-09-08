"""
Importar / Exportar: carga masiva de datos desde CSV o Excel con validación
fila por fila, plantillas descargables y exportación consolidada de todo el
sistema a un único Excel multi-hoja.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import streamlit as st
import pandas as pd

from utils.data_tools import (IMPORT_SCHEMAS, validate_import, execute_import,
                                import_template, export_all_to_excel, EXPORT_QUERIES)
from utils.auth import login_form, render_sidebar_user, require_write_or_warn
from utils.audit import log_action
from database.db import run_query

st.set_page_config(page_title="Importar / Exportar", page_icon="🔄", layout="wide")

from database.db import ensure_database_ready
ensure_database_ready()

from utils.theme import apply_page_theme, page_header
apply_page_theme()

if not login_form():
    st.stop()
render_sidebar_user()

page_header("🔄", "Importación y Exportación de Datos", "")

tab1, tab2 = st.tabs(["📥 Importar datos", "📤 Exportar todo"])

# ==========================================================================
# IMPORTACIÓN
# ==========================================================================
with tab1:
    st.subheader("Carga masiva desde CSV o Excel")
    st.caption("El archivo se valida fila por fila antes de insertar nada: si hay errores, "
               "se muestran con el número de fila y el motivo, y no se importa ninguna fila inválida.")

    tipo = st.selectbox("Tipo de datos a importar", options=list(IMPORT_SCHEMAS.keys()),
                         format_func=lambda k: k.capitalize())
    esquema = IMPORT_SCHEMAS[tipo]
    st.info(f"**{esquema['descripcion']}**\n\nColumnas obligatorias: "
            f"`{', '.join(esquema['columnas_requeridas'])}`")

    st.download_button(f"📋 Descargar plantilla de {tipo}", import_template(tipo),
                        f"plantilla_{tipo}.xlsx",
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")

    st.divider()
    archivo = st.file_uploader("Sube tu archivo", type=["csv", "xlsx", "xls"])

    if archivo is not None:
        try:
            if archivo.name.lower().endswith(".csv"):
                df = pd.read_csv(archivo)
            else:
                df = pd.read_excel(archivo)
        except Exception as e:
            st.error(f"No se pudo leer el archivo: {e}")
            df = None

        if df is not None:
            st.markdown(f"**Vista previa** ({len(df)} filas leídas)")
            st.dataframe(df.head(20), use_container_width=True)

            validas, errores = validate_import(df, tipo)

            m1, m2 = st.columns(2)
            m1.metric("✅ Filas válidas", len(validas))
            m2.metric("❌ Filas con error", len(errores))

            if errores:
                st.error(f"Se encontraron {len(errores)} filas con problemas:")
                err_df = pd.DataFrame(errores)
                st.dataframe(err_df, use_container_width=True, hide_index=True)

            if validas:
                st.success(f"{len(validas)} filas están listas para importar.")
                if require_write_or_warn():
                    if st.button(f"⬆️ Importar {len(validas)} filas válidas", type="primary"):
                        insertados = execute_import(validas, tipo)
                        log_action("IMPORT", esquema["tabla"], None,
                                    f"Importacion masiva de {insertados} registros de {tipo}")
                        st.success(f"✅ {insertados} registros importados correctamente.")
                        st.balloons()
            else:
                st.warning("No hay filas válidas para importar. Corrige los errores y vuelve a subir el archivo.")

# ==========================================================================
# EXPORTACIÓN CONSOLIDADA
# ==========================================================================
with tab2:
    st.subheader("Exportación consolidada del sistema")
    st.caption("Genera un único archivo Excel con una hoja por cada módulo del sistema.")

    resumen = []
    for nombre, sql in EXPORT_QUERIES.items():
        try:
            n = len(run_query(sql))
        except Exception:
            n = 0
        resumen.append({"Hoja": nombre, "Registros": n})
    res_df = pd.DataFrame(resumen)
    st.dataframe(res_df, use_container_width=True, hide_index=True)
    st.metric("Total de registros a exportar", int(res_df["Registros"].sum()))

    if st.button("📦 Generar Excel consolidado", type="primary"):
        with st.spinner("Generando archivo..."):
            contenido = export_all_to_excel()
        log_action("EXPORT", "all", None, "Exportacion consolidada de todo el sistema")
        st.download_button("⬇️ Descargar LogiSuite_Completo.xlsx", contenido,
                            "LogiSuite_Completo.xlsx",
                            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        st.success("Archivo generado. Usa el botón de descarga.")
