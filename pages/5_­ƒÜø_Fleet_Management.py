"""
Módulo 4 - Fleet Management: vehículos, mantenimientos preventivos/correctivos
con historial de odómetro, y conductores con licencias y vigencias.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import streamlit as st
import pandas as pd
from datetime import date

from models.fleet import Vehicle, Driver, MaintenanceRecord
from models.network import Node
from utils.report_exporter import dataframe_to_excel_bytes, dataframe_to_pdf_bytes

st.set_page_config(page_title="Fleet Management", page_icon="🚛", layout="wide")
st.title("🚛 Fleet Management")

tab1, tab2, tab3, tab4 = st.tabs(["🚚 Vehículos", "🔧 Mantenimiento", "🧑‍✈️ Conductores", "➕ Registrar"])

with tab1:
    vehicles = Vehicle.all()
    if vehicles:
        df = pd.DataFrame(vehicles)[["plate", "vehicle_type", "capacity_kg", "capacity_m3",
                                       "status", "odometer_km", "home_name"]]
        df.columns = ["Placa", "Tipo", "Capacidad (kg)", "Capacidad (m3)", "Estado", "Odómetro (km)", "Sede"]
        def color_status(row):
            colors = {"Disponible": "#D5F5E3", "En Ruta": "#D6EAF8", "Mantenimiento": "#FCF3CF",
                      "Fuera de Servicio": "#FADBD8"}
            return [f"background-color: {colors.get(row['Estado'],'')}"] * len(row)
        st.dataframe(df.style.apply(color_status, axis=1), use_container_width=True, hide_index=True)
        ce1, ce2 = st.columns(2)
        with ce1:
            st.download_button("📊 Excel", dataframe_to_excel_bytes(df, "Flota", "Vehículos de la Flota"),
                                "flota.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        with ce2:
            st.download_button("📄 PDF", dataframe_to_pdf_bytes(df, "Vehículos de la Flota"),
                                "flota.pdf", "application/pdf")
    else:
        st.info("No hay vehículos registrados.")

with tab2:
    st.subheader("Historial de mantenimientos")
    records = MaintenanceRecord.all()
    if records:
        mdf = pd.DataFrame(records)[["plate", "maintenance_type", "maintenance_date",
                                       "odometer_km", "cost", "description"]]
        mdf.columns = ["Vehículo", "Tipo", "Fecha", "Odómetro (km)", "Costo", "Descripción"]
        st.dataframe(mdf, use_container_width=True, hide_index=True)
        st.metric("Costo total de mantenimiento", f"${mdf['Costo'].sum():,.0f}")

    st.subheader("Registrar mantenimiento")
    vehicles = Vehicle.all()
    if vehicles:
        veh_map = {v["vehicle_id"]: v["plate"] for v in vehicles}
        with st.form("maint_form"):
            veh_id = st.selectbox("Vehículo", options=list(veh_map.keys()), format_func=lambda x: veh_map[x])
            mtype = st.selectbox("Tipo", options=["Preventivo", "Correctivo"])
            mdate = st.date_input("Fecha", value=date.today())
            odo = st.number_input("Odómetro actual (km)", min_value=0.0)
            cost = st.number_input("Costo", min_value=0.0)
            desc = st.text_area("Descripción")
            if st.form_submit_button("Registrar", type="primary"):
                MaintenanceRecord(None, veh_id, mtype, mdate.strftime("%Y-%m-%d"), odo, cost, desc).save()
                if mtype == "Preventivo" or mtype == "Correctivo":
                    pass
                st.success("Mantenimiento registrado.")
                st.rerun()

with tab3:
    drivers = Driver.all()
    if drivers:
        ddf = pd.DataFrame(drivers)[["name", "license_number", "license_category",
                                       "license_expiry", "status", "dias_para_vencer", "alerta_vencimiento"]]
        ddf.columns = ["Nombre", "Licencia", "Categoría", "Vigencia", "Estado", "Días para vencer", "Alerta"]
        def alert_color(row):
            return ["background-color:#FADBD8" if row["Alerta"] else ""] * len(row)
        st.dataframe(ddf.style.apply(alert_color, axis=1), use_container_width=True, hide_index=True)
        n_alert = ddf["Alerta"].sum()
        if n_alert:
            st.error(f"⚠️ {n_alert} conductor(es) con licencia próxima a vencer (≤30 días)")
    else:
        st.info("No hay conductores registrados.")

with tab4:
    st.subheader("Registrar nuevo vehículo")
    nodes = Node.all()
    node_map = {n["node_id"]: n["name"] for n in nodes}
    with st.form("veh_form"):
        plate = st.text_input("Placa")
        vtype = st.selectbox("Tipo", options=["Camion 2 ejes", "Camion 3 ejes", "Tractomula", "Furgon", "Van"])
        cap_kg = st.number_input("Capacidad (kg)", min_value=0.0)
        cap_m3 = st.number_input("Capacidad (m3)", min_value=0.0)
        home = st.selectbox("Sede", options=list(node_map.keys()), format_func=lambda x: node_map[x])
        if st.form_submit_button("Registrar vehículo", type="primary"):
            Vehicle(None, plate, vtype, cap_kg, cap_m3, "Disponible", 0, home).save()
            st.success("Vehículo registrado.")
            st.rerun()

    st.subheader("Registrar nuevo conductor")
    with st.form("drv_form"):
        name = st.text_input("Nombre")
        lic = st.text_input("Número de licencia")
        cat = st.selectbox("Categoría", options=["C1", "C2", "C3"])
        exp = st.date_input("Fecha de vencimiento de la licencia")
        if st.form_submit_button("Registrar conductor", type="primary"):
            Driver(None, name, lic, cat, exp.strftime("%Y-%m-%d")).save()
            st.success("Conductor registrado.")
            st.rerun()
