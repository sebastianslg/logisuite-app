"""
Módulo 1 - Warehouse Management: inventario por zona de rotación, ciclo
Inbound/Outbound, alertas de stock crítico/sobre-stock y reportes.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import streamlit as st
import pandas as pd
from datetime import date

from models.warehouse import Warehouse, InventoryItem, WarehouseMovement, rotation_report
from models.network import Node
from utils.report_exporter import dataframe_to_excel_bytes, dataframe_to_pdf_bytes

st.set_page_config(page_title="Warehouse Management", page_icon="📦", layout="wide")
st.title("📦 Warehouse Management")
st.caption("Freight Distribution Cluster: ciclo Inbound (recepción/inspección) y "
           "Outbound (picking/empaque/despacho).")

tab1, tab2, tab3, tab4 = st.tabs(["📋 Inventario", "➕ Nuevo movimiento", "🚨 Alertas de stock",
                                    "📊 Rotación y valoración"])

with tab1:
    warehouses = Warehouse.all()
    wh_options = {w["warehouse_id"]: f"{w['name']} ({w['city']})" for w in warehouses}
    selected_wh = st.selectbox("Filtrar por almacén", options=[None] + list(wh_options.keys()),
                                format_func=lambda x: "Todos" if x is None else wh_options[x])
    items = InventoryItem.all(warehouse_id=selected_wh)
    if items:
        df = pd.DataFrame(items)[["sku", "name", "warehouse_name", "zone", "quantity",
                                   "min_stock", "max_stock", "unit_cost", "valuation", "stock_status"]]
        df.columns = ["SKU", "Producto", "Almacén", "Zona", "Cantidad", "Stock Min", "Stock Max",
                      "Costo Unitario", "Valoración", "Estado"]
        def highlight(row):
            color = "#FADBD8" if "CRITICO" in row["Estado"] else ("#FCF3CF" if "SOBRE" in row["Estado"] else "")
            return [f"background-color: {color}"] * len(row)
        st.dataframe(df.style.apply(highlight, axis=1), use_container_width=True, hide_index=True)

        ce1, ce2 = st.columns(2)
        with ce1:
            st.download_button("📊 Excel", dataframe_to_excel_bytes(df, "Inventario", "Inventario de Almacenes"),
                                "inventario.xlsx",
                                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        with ce2:
            st.download_button("📄 PDF", dataframe_to_pdf_bytes(df, "Inventario de Almacenes"),
                                "inventario.pdf", "application/pdf")
    else:
        st.info("No hay ítems de inventario registrados.")

with tab2:
    st.subheader("Registrar movimiento de inventario")
    items_all = InventoryItem.all()
    if not items_all:
        st.warning("Registra primero ítems de inventario en la base de datos.")
    else:
        item_map = {i["item_id"]: f"{i['sku']} - {i['name']} ({i['warehouse_name']})" for i in items_all}
        with st.form("mov_form"):
            item_id = st.selectbox("Ítem", options=list(item_map.keys()), format_func=lambda x: item_map[x])
            mtype = st.selectbox("Tipo de movimiento", options=WarehouseMovement.INBOUND_TYPES +
                                  WarehouseMovement.OUTBOUND_TYPES)
            qty = st.number_input("Cantidad", min_value=0.0, step=1.0)
            mdate = st.date_input("Fecha", value=date.today())
            ref = st.text_input("Referencia / documento")
            submitted = st.form_submit_button("Registrar movimiento", type="primary")
            if submitted and qty > 0:
                WarehouseMovement(None, item_id, mtype, qty, mdate.strftime("%Y-%m-%d"), ref).save()
                st.success("Movimiento registrado y stock actualizado.")
                st.rerun()

    st.subheader("Historial de movimientos")
    moves = WarehouseMovement.all()
    if moves:
        mdf = pd.DataFrame(moves)[["movement_date", "sku", "item_name", "movement_type", "quantity", "reference"]]
        mdf.columns = ["Fecha", "SKU", "Producto", "Tipo", "Cantidad", "Referencia"]
        st.dataframe(mdf, use_container_width=True, hide_index=True)

with tab3:
    st.subheader("🚨 Alertas automáticas de stock crítico y sobre-stock")
    items = InventoryItem.all()
    if items:
        df = pd.DataFrame(items)
        critical = df[df["stock_status"].str.contains("CRITICO")]
        over = df[df["stock_status"].str.contains("SOBRE")]
        c1, c2 = st.columns(2)
        with c1:
            st.error(f"⚠️ {len(critical)} ítem(s) en stock crítico (bajo mínimo)")
            if not critical.empty:
                st.dataframe(critical[["sku", "name", "warehouse_name", "quantity", "min_stock"]],
                             hide_index=True, use_container_width=True)
        with c2:
            st.warning(f"📦 {len(over)} ítem(s) en sobre-stock (sobre máximo)")
            if not over.empty:
                st.dataframe(over[["sku", "name", "warehouse_name", "quantity", "max_stock"]],
                             hide_index=True, use_container_width=True)
    else:
        st.info("No hay ítems para evaluar.")

with tab4:
    st.subheader("📊 Reporte de rotación de inventario y valoración de existencias")
    rep = rotation_report()
    if rep:
        rdf = pd.DataFrame(rep)
        rdf.columns = ["SKU", "Producto", "Zona", "node_id", "Almacén", "Unidades Despachadas",
                       "Stock Actual", "Costo Unitario", "Valoración"]
        rdf = rdf.drop(columns=["node_id"])
        st.dataframe(rdf, use_container_width=True, hide_index=True)
        st.metric("Valoración total de inventario", f"${rdf['Valoración'].sum():,.0f}")
        ce1, ce2 = st.columns(2)
        with ce1:
            st.download_button("📊 Excel", dataframe_to_excel_bytes(rdf, "Rotacion", "Rotación y Valoración"),
                                "rotacion.xlsx",
                                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        with ce2:
            st.download_button("📄 PDF", dataframe_to_pdf_bytes(rdf, "Rotación y Valoración"),
                                "rotacion.pdf", "application/pdf")
    else:
        st.info("No hay datos de rotación aún.")
