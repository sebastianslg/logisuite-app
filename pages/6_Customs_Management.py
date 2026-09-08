"""
Módulo 5 - Customs Management (versión avanzada).

Documentación aduanera, aranceles e impuestos, y las funcionalidades avanzadas:
  - Simulador comparativo de escenarios arancelarios (tratados comerciales).
  - Checklist de completitud documental por envío según tipo de operación.
  - Línea de tiempo del estado del trámite.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from datetime import date

from models.customs import CustomsDocument, CustomsDuty
from models.freight import Shipment
from models.consolidation import TariffScenario
from database.db import run_query
from utils.report_exporter import dataframe_to_excel_bytes, dataframe_to_pdf_bytes
from utils.auth import login_form, render_sidebar_user, require_write_or_warn
from utils.audit import log_action

st.set_page_config(page_title="Customs Management", page_icon="🛃", layout="wide")

from database.db import ensure_database_ready
ensure_database_ready()

from utils.theme import apply_page_theme, page_header
apply_page_theme()

if not login_form():
    st.stop()
render_sidebar_user()

page_header("🛃", "Customs Management", "Documentación aduanera, tributos de importación y control de trámites.")

# Documentos exigidos según el tipo de operación aduanera
DOCS_REQUERIDOS = {
    "Importación": ["Bill of Lading", "Manifiesto de Carga", "Declaracion de Importacion",
                     "Certificado de Origen"],
    "Exportación": ["Bill of Lading", "Manifiesto de Carga", "Declaracion de Exportacion"],
}

tabs = st.tabs(["📄 Documentación", "💰 Aranceles", "🌍 Escenarios arancelarios",
                "✅ Checklist documental", "🕒 Línea de tiempo", "➕ Registrar"])

# ==========================================================================
# 1. DOCUMENTACIÓN
# ==========================================================================
with tabs[0]:
    docs = CustomsDocument.all()
    if docs:
        ddf = pd.DataFrame(docs)[["doc_id", "shipment_id", "doc_type", "doc_number", "issue_date",
                                    "expiry_date", "status", "dias_para_vencer", "alerta_vencimiento"]]
        ddf.columns = ["ID", "Envío", "Tipo de Documento", "Número", "Emisión", "Vencimiento",
                       "Estado", "Días para vencer", "Alerta"]

        def alert_style(row):
            if row["Estado"] == "Rechazado":
                return ["background-color: #F5B7B1"] * len(row)
            if row["Alerta"]:
                return ["background-color: #FADBD8"] * len(row)
            if row["Estado"] == "Liberado":
                return ["background-color: #D5F5E3"] * len(row)
            return [""] * len(row)

        st.dataframe(ddf.style.apply(alert_style, axis=1), use_container_width=True, hide_index=True)

        k1, k2, k3, k4 = st.columns(4)
        k1.metric("Documentos", len(ddf))
        k2.metric("Liberados", int((ddf["Estado"] == "Liberado").sum()))
        k3.metric("En trámite", int(ddf["Estado"].isin(["Pendiente", "En Revision"]).sum()))
        k4.metric("Por vencer (≤15 días)", int(ddf["Alerta"].sum()))

        n_alert = int(ddf["Alerta"].sum())
        if n_alert:
            st.error(f"⚠️ {n_alert} documento(s) próximo(s) a vencer.")

        figs = px.pie(ddf.groupby("Estado").size().reset_index(name="n"), names="Estado", values="n",
                       hole=0.45, color="Estado",
                       color_discrete_map={"Liberado": "#2A9D8F", "En Revision": "#457B9D",
                                            "Pendiente": "#E9C46A", "Rechazado": "#E76F51"},
                       title="Estado de los trámites aduaneros")
        st.plotly_chart(figs, use_container_width=True)

        st.subheader("Actualizar estado de trámite")
        c1, c2 = st.columns(2)
        sel = c1.selectbox("Documento", options=ddf["ID"].tolist(),
                            format_func=lambda x: f"#{x} - "
                                                   f"{ddf[ddf['ID']==x]['Tipo de Documento'].iloc[0]} "
                                                   f"({ddf[ddf['ID']==x]['Número'].iloc[0]})")
        new_status = c2.selectbox("Nuevo estado", options=CustomsDocument.STATUSES)
        if st.button("Actualizar estado", type="primary") and require_write_or_warn():
            CustomsDocument.update_status(sel, new_status)
            log_action("UPDATE", "customs_documents", str(sel), f"estado -> {new_status}")
            st.success("Estado actualizado.")
            st.rerun()

        ce1, ce2 = st.columns(2)
        with ce1:
            st.download_button("📊 Excel", dataframe_to_excel_bytes(ddf, "Aduanas", "Documentación Aduanera"),
                                "aduanas.xlsx",
                                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        with ce2:
            st.download_button("📄 PDF", dataframe_to_pdf_bytes(ddf, "Documentación Aduanera"),
                                "aduanas.pdf", "application/pdf")
    else:
        st.info("No hay documentos aduaneros registrados.")

# ==========================================================================
# 2. ARANCELES
# ==========================================================================
with tabs[1]:
    duties = CustomsDuty.all()
    if duties:
        dudf = pd.DataFrame(duties)[["shipment_id", "tariff_pct", "taxable_value", "taxes", "total_duty"]]
        dudf.columns = ["Envío", "Arancel (%)", "Valor Gravable", "Impuestos (IVA)", "Total a Pagar"]
        st.dataframe(dudf, use_container_width=True, hide_index=True)
        k1, k2 = st.columns(2)
        k1.metric("Total de tributos", f"${dudf['Total a Pagar'].sum():,.2f}")
        k2.metric("Valor gravable acumulado", f"${dudf['Valor Gravable'].sum():,.2f}")

    st.subheader("Calculadora de aranceles e impuestos")
    st.caption("Secuencia de liquidación: sobre el valor en aduana se aplica el arancel, y el IVA "
               "se calcula sobre el valor más el arancel (no sobre el valor puro).")
    c1, c2, c3 = st.columns(3)
    value = c1.number_input("Valor gravable (USD)", min_value=0.0, value=10000.0)
    tariff = c2.number_input("Arancel (%)", min_value=0.0, value=8.0)
    vat = c3.number_input("IVA (%)", min_value=0.0, value=19.0)
    calc = CustomsDuty.compute(value, tariff, vat)

    m1, m2, m3, m4 = st.columns(4)
    m1.metric("Valor del arancel", f"${calc['tariff_amount']:,.2f}")
    m2.metric("IVA", f"${calc['taxes']:,.2f}")
    m3.metric("Total tributos", f"${calc['total_duty']:,.2f}")
    m4.metric("Costo total nacionalizado", f"${value + calc['total_duty']:,.2f}")

    ships = Shipment.all()
    if ships:
        ship_map = {s["shipment_id"]: f"Envío #{s['shipment_id']} ({s['origin_name']} → {s['dest_name']})"
                    for s in ships}
        ship_sel = st.selectbox("Asociar el cálculo a un envío", options=list(ship_map.keys()),
                                 format_func=lambda x: ship_map[x])
        if st.button("Guardar liquidación", type="primary") and require_write_or_warn():
            CustomsDuty(None, ship_sel, tariff, value, calc["taxes"], calc["total_duty"]).save()
            log_action("INSERT", "customs_duties", str(ship_sel), f"total ${calc['total_duty']}")
            st.success("Liquidación guardada.")
            st.rerun()

# ==========================================================================
# 3. ESCENARIOS ARANCELARIOS
# ==========================================================================
with tabs[2]:
    st.subheader("🌍 Simulador comparativo de escenarios arancelarios")
    st.caption("Compara el costo total de nacionalizar la misma mercancía según el origen y el "
               "acuerdo comercial aplicable. La diferencia entre escenarios es el valor económico "
               "de la preferencia arancelaria.")

    valor_sim = st.number_input("Valor en aduana de la mercancía (USD)", min_value=100.0,
                                 value=50000.0, step=1000.0)
    escenarios = TariffScenario.compare(valor_sim)

    if not escenarios:
        st.info("No hay escenarios arancelarios registrados.")
    else:
        edf = pd.DataFrame(escenarios)
        disp = edf[["escenario", "origen", "arancel_pct", "iva_pct", "otros_pct", "arancel",
                     "iva", "otros_gastos", "total_tributos", "costo_total_importacion"]].copy()
        disp.columns = ["Escenario", "Origen", "Arancel %", "IVA %", "Otros %", "Arancel",
                        "IVA", "Otros gastos", "Total tributos", "Costo nacionalizado"]

        def color_mejor(row):
            if row.name == 0:
                return ["background-color: #D5F5E3"] * len(row)
            if row.name == len(disp) - 1:
                return ["background-color: #FADBD8"] * len(row)
            return [""] * len(row)

        st.dataframe(disp.style.apply(color_mejor, axis=1), use_container_width=True, hide_index=True)

        mejor, peor = escenarios[0], escenarios[-1]
        ahorro = peor["costo_total_importacion"] - mejor["costo_total_importacion"]
        k1, k2, k3 = st.columns(3)
        k1.metric("✅ Escenario más favorable", mejor["escenario"],
                  f"${mejor['costo_total_importacion']:,.2f}")
        k2.metric("❌ Escenario más costoso", peor["escenario"],
                  f"${peor['costo_total_importacion']:,.2f}")
        k3.metric("Ahorro por preferencia arancelaria", f"${ahorro:,.2f}",
                  f"{100*ahorro/peor['costo_total_importacion']:.1f}%")

        figc = go.Figure()
        figc.add_trace(go.Bar(x=edf["escenario"], y=edf["valor_gravable"],
                               name="Valor en aduana", marker_color="#264653"))
        figc.add_trace(go.Bar(x=edf["escenario"], y=edf["arancel"], name="Arancel",
                               marker_color="#E76F51"))
        figc.add_trace(go.Bar(x=edf["escenario"], y=edf["iva"], name="IVA",
                               marker_color="#E9C46A"))
        figc.add_trace(go.Bar(x=edf["escenario"], y=edf["otros_gastos"], name="Otros gastos",
                               marker_color="#2A9D8F"))
        figc.update_layout(barmode="stack", height=440, xaxis_title="Escenario",
                            yaxis_title="USD", title="Costo nacionalizado por escenario",
                            legend=dict(orientation="h", y=1.12))
        st.plotly_chart(figc, use_container_width=True)

        st.info(f"Importar bajo **{mejor['escenario']}** en lugar de **{peor['escenario']}** "
                f"reduce el costo total en **${ahorro:,.2f}** sobre una mercancía de "
                f"${valor_sim:,.2f}. Acreditar el origen con el certificado correspondiente es "
                "lo que habilita esa preferencia.")

        st.download_button("📊 Exportar comparación",
                            dataframe_to_excel_bytes(disp, "Escenarios", "Escenarios Arancelarios"),
                            "escenarios_arancelarios.xlsx",
                            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")

# ==========================================================================
# 4. CHECKLIST DOCUMENTAL
# ==========================================================================
with tabs[3]:
    st.subheader("✅ Checklist de completitud documental")
    st.caption("Verifica qué documentos exige cada tipo de operación y cuáles faltan por envío.")

    tipo_op = st.radio("Tipo de operación", list(DOCS_REQUERIDOS.keys()), horizontal=True)
    requeridos = DOCS_REQUERIDOS[tipo_op]
    st.write("Documentos exigidos:", " · ".join(requeridos))

    ships = Shipment.all()
    docs = CustomsDocument.all()
    if not ships:
        st.info("No hay envíos registrados.")
    else:
        docs_por_envio = {}
        for d in docs:
            docs_por_envio.setdefault(d["shipment_id"], {})[d["doc_type"]] = d["status"]

        filas = []
        for s in ships:
            presentes = docs_por_envio.get(s["shipment_id"], {})
            fila = {"Envío": s["shipment_id"],
                    "Ruta": f"{s['origin_name']} → {s['dest_name']}"}
            completos = 0
            for req in requeridos:
                estado = presentes.get(req)
                if estado == "Liberado":
                    fila[req] = "✅ Liberado"
                    completos += 1
                elif estado in ("Pendiente", "En Revision"):
                    fila[req] = f"🕒 {estado}"
                elif estado == "Rechazado":
                    fila[req] = "❌ Rechazado"
                else:
                    fila[req] = "⬜ Falta"
            fila["Completitud"] = round(100 * completos / len(requeridos), 1)
            filas.append(fila)

        cdf = pd.DataFrame(filas)

        def color_completitud(row):
            if row["Completitud"] == 100:
                return ["background-color: #D5F5E3"] * len(row)
            if row["Completitud"] >= 50:
                return ["background-color: #FCF3CF"] * len(row)
            return ["background-color: #FADBD8"] * len(row)

        st.dataframe(cdf.style.apply(color_completitud, axis=1), use_container_width=True,
                     hide_index=True)

        k1, k2, k3 = st.columns(3)
        k1.metric("Envíos con expediente completo", int((cdf["Completitud"] == 100).sum()))
        k2.metric("Envíos incompletos", int((cdf["Completitud"] < 100).sum()))
        k3.metric("Completitud media", f"{cdf['Completitud'].mean():.1f}%")

        figb = px.bar(cdf.sort_values("Completitud"), x="Envío", y="Completitud",
                       color="Completitud", color_continuous_scale="RdYlGn", range_color=[0, 100],
                       labels={"Completitud": "% documentos liberados"},
                       title=f"Completitud documental para operación de {tipo_op}")
        figb.add_hline(y=100, line_dash="dash", line_color="green")
        st.plotly_chart(figb, use_container_width=True)

        incompletos = cdf[cdf["Completitud"] < 100]
        if not incompletos.empty:
            st.warning(f"⚠️ {len(incompletos)} envío(s) no pueden despacharse: su expediente "
                       f"documental para {tipo_op.lower()} está incompleto.")

# ==========================================================================
# 5. LÍNEA DE TIEMPO
# ==========================================================================
with tabs[4]:
    st.subheader("🕒 Línea de tiempo de los trámites")
    st.caption("Progresión de cada documento desde su emisión hasta su liberación o vencimiento.")

    docs = CustomsDocument.all()
    if not docs:
        st.info("No hay documentos para mostrar.")
    else:
        tdf = pd.DataFrame(docs)
        tdf["etiqueta"] = tdf["doc_type"] + " (" + tdf["doc_number"] + ")"
        tdf["inicio"] = pd.to_datetime(tdf["issue_date"], errors="coerce")
        tdf["fin"] = pd.to_datetime(tdf["expiry_date"], errors="coerce")
        # Los documentos sin vencimiento se dibujan con una duración nominal para
        # que aparezcan en la línea de tiempo en lugar de desaparecer del gráfico.
        tdf["fin"] = tdf["fin"].fillna(tdf["inicio"] + pd.Timedelta(days=30))
        tdf = tdf.dropna(subset=["inicio"])

        if not tdf.empty:
            figl = px.timeline(tdf, x_start="inicio", x_end="fin", y="etiqueta", color="status",
                                color_discrete_map={"Liberado": "#2A9D8F", "En Revision": "#457B9D",
                                                     "Pendiente": "#E9C46A", "Rechazado": "#E76F51"},
                                hover_data=["shipment_id"],
                                labels={"etiqueta": "Documento", "status": "Estado"},
                                title="Vigencia y estado de los documentos aduaneros")
            figl.update_yaxes(autorange="reversed")
            figl.add_vline(x=pd.Timestamp(date.today()), line_dash="dash", line_color="red",
                            annotation_text="Hoy")
            figl.update_layout(height=420)
            st.plotly_chart(figl, use_container_width=True)

        st.markdown("##### Progresión del flujo de estados")
        flujo = ["Pendiente", "En Revision", "Liberado"]
        conteo = [int((tdf["status"] == e).sum()) for e in flujo]
        figf = go.Figure(go.Funnel(y=flujo, x=conteo,
                                    marker=dict(color=["#E9C46A", "#457B9D", "#2A9D8F"])))
        figf.update_layout(height=330, title="Documentos por etapa del trámite")
        st.plotly_chart(figf, use_container_width=True)

        rechazados = int((tdf["status"] == "Rechazado").sum())
        if rechazados:
            st.error(f"❌ {rechazados} documento(s) rechazado(s) requieren corrección y reenvío.")

# ==========================================================================
# 6. REGISTRAR
# ==========================================================================
with tabs[5]:
    st.subheader("Registrar nuevo documento aduanero")
    ships = Shipment.all()
    if not ships:
        st.warning("Registra primero un envío en Freight Management.")
    else:
        ship_map = {s["shipment_id"]: f"Envío #{s['shipment_id']} ({s['origin_name']} → {s['dest_name']})"
                    for s in ships}
        with st.form("doc_form"):
            ship_sel = st.selectbox("Envío", options=list(ship_map.keys()),
                                     format_func=lambda x: ship_map[x])
            c1, c2 = st.columns(2)
            dtype = c1.selectbox("Tipo de documento", options=CustomsDocument.DOC_TYPES)
            docnum = c2.text_input("Número de documento")
            c3, c4 = st.columns(2)
            issue = c3.date_input("Fecha de emisión", value=date.today())
            status = c4.selectbox("Estado inicial", options=CustomsDocument.STATUSES)
            has_expiry = st.checkbox("¿Tiene fecha de vencimiento?")
            expiry = st.date_input("Fecha de vencimiento") if has_expiry else None
            if st.form_submit_button("Registrar documento", type="primary"):
                if not docnum.strip():
                    st.error("El número de documento es obligatorio.")
                elif require_write_or_warn():
                    CustomsDocument(None, ship_sel, dtype, docnum.strip(),
                                     issue.strftime("%Y-%m-%d"),
                                     expiry.strftime("%Y-%m-%d") if expiry else None,
                                     status).save()
                    log_action("INSERT", "customs_documents", docnum.strip(), dtype)
                    st.success("Documento registrado.")
                    st.rerun()

    st.divider()
    st.subheader("Registrar escenario arancelario")
    with st.form("esc_form"):
        c1, c2 = st.columns(2)
        nombre = c1.text_input("Nombre del escenario", placeholder="Ej. TLC con Canadá")
        origen = c2.text_input("País/bloque de origen", placeholder="Ej. Canadá")
        c3, c4, c5 = st.columns(3)
        ar = c3.number_input("Arancel (%)", min_value=0.0, value=5.0)
        iva_e = c4.number_input("IVA (%)", min_value=0.0, value=19.0)
        otros = c5.number_input("Otros gastos (%)", min_value=0.0, value=0.5)
        notas = st.text_area("Notas")
        if st.form_submit_button("Registrar escenario", type="primary"):
            if not nombre.strip():
                st.error("El nombre del escenario es obligatorio.")
            elif require_write_or_warn():
                TariffScenario(None, nombre.strip(), origen.strip(), ar, iva_e, otros, notas).save()
                log_action("INSERT", "tariff_scenarios", nombre.strip(), f"arancel {ar}%")
                st.success("Escenario registrado.")
                st.rerun()
