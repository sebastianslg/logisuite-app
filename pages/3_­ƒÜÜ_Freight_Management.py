"""
Módulo 2 - Freight Management: registro de envíos, tracking de estado y
motor parametrizado de costos de transporte (3 componentes explícitos).
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import streamlit as st
import pandas as pd
from datetime import date

from models.freight import Shipment, compute_transport_cost, DEFAULT_COST_PARAMS
from models.network import Node, Corridor
from utils.network_algorithms import build_graph, shortest_path
from utils.report_exporter import dataframe_to_excel_bytes, dataframe_to_pdf_bytes

st.set_page_config(page_title="Freight Management", page_icon="🚚", layout="wide")
st.title("🚚 Freight Management")
st.caption("Registro de envíos, consolidación de carga y motor de costos de transporte.")

tab1, tab2, tab3 = st.tabs(["📋 Envíos y tracking", "➕ Registrar envío", "⚙️ Motor de costos"])

with tab1:
    ships = Shipment.all()
    if ships:
        df = pd.DataFrame(ships)[["shipment_id", "origin_name", "dest_name", "cargo_units",
                                   "weight_kg", "volume_m3", "status", "promised_date",
                                   "delivered_date", "total_cost"]]
        df.columns = ["ID", "Origen", "Destino", "Unidades", "Peso (kg)", "Volumen (m3)",
                      "Estado", "Fecha Prometida", "Fecha Entrega", "Costo Total"]
        st.dataframe(df, use_container_width=True, hide_index=True)

        st.subheader("Actualizar estado de un envío")
        sel = st.selectbox("Envío", options=df["ID"].tolist())
        new_status = st.selectbox("Nuevo estado", options=Shipment.STATUSES)
        deliv_date = None
        if new_status == "Entregado":
            deliv_date = st.date_input("Fecha de entrega", value=date.today()).strftime("%Y-%m-%d")
        if st.button("Actualizar estado", type="primary"):
            Shipment.update_status(sel, new_status, deliv_date)
            st.success("Estado actualizado.")
            st.rerun()

        ce1, ce2 = st.columns(2)
        with ce1:
            st.download_button("📊 Excel", dataframe_to_excel_bytes(df, "Envios", "Envíos y Tracking"),
                                "envios.xlsx",
                                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        with ce2:
            st.download_button("📄 PDF", dataframe_to_pdf_bytes(df, "Envíos y Tracking"),
                                "envios.pdf", "application/pdf")
    else:
        st.info("No hay envíos registrados.")

with tab2:
    st.subheader("Registrar nuevo envío")
    nodes = Node.all()
    node_map = {n["node_id"]: f"{n['name']} ({n['node_type']})" for n in nodes}
    with st.form("ship_form"):
        c1, c2 = st.columns(2)
        origin = c1.selectbox("Nodo de origen", options=list(node_map.keys()), format_func=lambda x: node_map[x])
        dest = c2.selectbox("Nodo de destino", options=list(node_map.keys()), format_func=lambda x: node_map[x])
        cargo_units = st.number_input("Unidades de carga", min_value=1, value=1)
        weight = st.number_input("Peso total (kg)", min_value=0.0, value=1000.0)
        volume = st.number_input("Volumen total (m3)", min_value=0.0, value=5.0)
        declared_value = st.number_input("Valor declarado de la mercancía (USD)", min_value=0.0, value=10000.0)
        promised = st.date_input("Fecha prometida de entrega", value=date.today())
        submitted = st.form_submit_button("Calcular costo y registrar envío", type="primary")

        if submitted:
            if origin == dest:
                st.error("El origen y destino no pueden ser el mismo nodo.")
            else:
                corridors = Corridor.all()
                G = build_graph(nodes, corridors)
                route = shortest_path(G, origin, dest, weight="distance")
                if not route["found"]:
                    st.error("No existe un corredor de transporte que conecte estos nodos.")
                else:
                    breakdown = compute_transport_cost(
                        distance_km=route["distance_km"], transit_time_h=route["time_h"],
                        weight_kg=weight, volume_m3=volume, cargo_units=cargo_units,
                        declared_value=declared_value,
                    )
                    sid = Shipment(None, origin, dest, cargo_units, weight, volume, "Registrado",
                                    promised.strftime("%Y-%m-%d"), "",
                                    breakdown["transaction_cost"], breakdown["distance_friction_cost"],
                                    breakdown["shipment_cost"], breakdown["total_cost"]).save()
                    st.success(f"Envío #{sid} registrado. Distancia: {route['distance_km']} km · "
                               f"Costo total: ${breakdown['total_cost']:,.2f}")
                    st.json(breakdown["breakdown"])

with tab3:
    st.subheader("⚙️ Motor parametrizado de costos de transporte")
    st.markdown("Simula el desglose de costo para un envío hipotético ajustando los parámetros.")
    with st.expander("Parámetros del motor (valores por defecto)"):
        st.json(DEFAULT_COST_PARAMS)

    c1, c2, c3 = st.columns(3)
    distance_km = c1.number_input("Distancia (km)", value=500.0)
    transit_h = c1.number_input("Tiempo de tránsito (h)", value=10.0)
    weight_kg = c2.number_input("Peso (kg)", value=5000.0)
    volume_m3 = c2.number_input("Volumen (m3)", value=20.0)
    cargo_units = c3.number_input("Unidades de carga", value=6, step=1)
    declared_value = c3.number_input("Valor declarado (USD)", value=15000.0)

    result = compute_transport_cost(distance_km, transit_h, weight_kg, volume_m3,
                                     int(cargo_units), declared_value)
    st.divider()
    m1, m2, m3, m4 = st.columns(4)
    m1.metric("(a) Costo de Transacción", f"${result['transaction_cost']:,.2f}")
    m2.metric("(b) Fricción de la Distancia", f"${result['distance_friction_cost']:,.2f}")
    m3.metric("(c) Costo del Envío", f"${result['shipment_cost']:,.2f}")
    m4.metric("Costo Total", f"${result['total_cost']:,.2f}")
    st.caption("Desglose detallado:")
    st.json(result["breakdown"])
