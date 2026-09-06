"""
Módulo 5 - Customs Management: documentación aduanera por envío, control de
aranceles/impuestos y alertas automáticas de vencimiento de permisos.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import streamlit as st
import pandas as pd
from datetime import date

from models.customs import CustomsDocument, CustomsDuty
from models.freight import Shipment
from utils.report_exporter import dataframe_to_excel_bytes, dataframe_to_pdf_bytes

st.set_page_config(page_title="Customs Management", page_icon="🛃", layout="wide")
st.title("🛃 Customs Management")

tab1, tab2, tab3 = st.tabs(["📄 Documentación aduanera", "💰 Aranceles e impuestos", "➕ Registrar documento"])

with tab1:
    docs = CustomsDocument.all()
    if docs:
        ddf = pd.DataFrame(docs)[["doc_id", "shipment_id", "doc_type", "doc_number", "issue_date",
                                    "expiry_date", "status", "dias_para_vencer", "alerta_vencimiento"]]
        ddf.columns = ["ID", "Envío", "Tipo de Documento", "Número", "Emisión", "Vencimiento",
                       "Estado", "Días para vencer", "Alerta"]
        def alert_style(row):
            return ["background-color:#FADBD8" if row["Alerta"] else ""] * len(row)
        st.dataframe(ddf.style.apply(alert_style, axis=1), use_container_width=True, hide_index=True)
        n_alert = ddf["Alerta"].sum()
        if n_alert:
            st.error(f"⚠️ {n_alert} documento(s) próximo(s) a vencer (≤15 días)")

        st.subheader("Actualizar estado de trámite")
        sel = st.selectbox("Documento", options=ddf["ID"].tolist())
        new_status = st.selectbox("Nuevo estado", options=CustomsDocument.STATUSES)
        if st.button("Actualizar estado", type="primary"):
            CustomsDocument.update_status(sel, new_status)
            st.success("Estado actualizado.")
            st.rerun()

        ce1, ce2 = st.columns(2)
        with ce1:
            st.download_button("📊 Excel", dataframe_to_excel_bytes(ddf, "Aduanas", "Documentación Aduanera"),
                                "aduanas.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        with ce2:
            st.download_button("📄 PDF", dataframe_to_pdf_bytes(ddf, "Documentación Aduanera"),
                                "aduanas.pdf", "application/pdf")
    else:
        st.info("No hay documentos aduaneros registrados.")

with tab2:
    duties = CustomsDuty.all()
    if duties:
        dudf = pd.DataFrame(duties)[["shipment_id", "tariff_pct", "taxable_value", "taxes", "total_duty"]]
        dudf.columns = ["Envío", "Arancel (%)", "Valor Gravable", "Impuestos (IVA)", "Total a Pagar"]
        st.dataframe(dudf, use_container_width=True, hide_index=True)
        st.metric("Total de aranceles e impuestos", f"${dudf['Total a Pagar'].sum():,.0f}")

    st.subheader("Calculadora de aranceles e impuestos")
    c1, c2, c3 = st.columns(3)
    value = c1.number_input("Valor gravable (USD)", min_value=0.0, value=10000.0)
    tariff = c2.number_input("Arancel (%)", min_value=0.0, value=8.0)
    vat = c3.number_input("IVA / impuesto (%)", min_value=0.0, value=19.0)
    calc = CustomsDuty.compute(value, tariff, vat)
    m1, m2, m3 = st.columns(3)
    m1.metric("Valor del arancel", f"${calc['tariff_amount']:,.2f}")
    m2.metric("Impuestos", f"${calc['taxes']:,.2f}")
    m3.metric("Total a pagar", f"${calc['total_duty']:,.2f}")

    ships = Shipment.all()
    if ships:
        ship_map = {s["shipment_id"]: f"Envío #{s['shipment_id']} ({s['origin_name']} → {s['dest_name']})" for s in ships}
        ship_sel = st.selectbox("Asociar a envío", options=list(ship_map.keys()), format_func=lambda x: ship_map[x])
        if st.button("Guardar cálculo de arancel", type="primary"):
            CustomsDuty(None, ship_sel, tariff, value, calc["taxes"], calc["total_duty"]).save()
            st.success("Cálculo de arancel guardado.")
            st.rerun()

with tab3:
    st.subheader("Registrar nuevo documento aduanero")
    ships = Shipment.all()
    if ships:
        ship_map = {s["shipment_id"]: f"Envío #{s['shipment_id']} ({s['origin_name']} → {s['dest_name']})" for s in ships}
        with st.form("doc_form"):
            ship_sel = st.selectbox("Envío", options=list(ship_map.keys()), format_func=lambda x: ship_map[x])
            dtype = st.selectbox("Tipo de documento", options=CustomsDocument.DOC_TYPES)
            docnum = st.text_input("Número de documento")
            issue = st.date_input("Fecha de emisión", value=date.today())
            has_expiry = st.checkbox("¿Tiene fecha de vencimiento?")
            expiry = st.date_input("Fecha de vencimiento") if has_expiry else None
            status = st.selectbox("Estado inicial", options=CustomsDocument.STATUSES)
            if st.form_submit_button("Registrar documento", type="primary"):
                CustomsDocument(None, ship_sel, dtype, docnum, issue.strftime("%Y-%m-%d"),
                                 expiry.strftime("%Y-%m-%d") if expiry else None, status).save()
                st.success("Documento registrado.")
                st.rerun()
    else:
        st.warning("Registra primero un envío en Freight Management.")
