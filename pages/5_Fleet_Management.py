"""
Módulo 4 - Fleet Management (versión avanzada).

Gestión de vehículos y conductores, más la analítica de flota:
  - Costo Total de Propiedad (TCO) por vehículo y por kilómetro.
  - Predicción del próximo mantenimiento preventivo por kilometraje.
  - Panel de disponibilidad y ocupación de la flota.
  - Alertas combinadas de vehículo + conductor.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from datetime import date, datetime

from models.fleet import Vehicle, Driver, MaintenanceRecord
from models.network import Node
from database.db import run_query
from utils.fleet_analytics import (tco_all_vehicles, compute_tco, maintenance_forecast_all,
                                    predict_next_maintenance)
from utils.alerts import fleet_alerts, license_alerts, maintenance_alerts
from utils.report_exporter import dataframe_to_excel_bytes, dataframe_to_pdf_bytes
from utils.auth import login_form, render_sidebar_user, require_write_or_warn
from utils.audit import log_action

st.set_page_config(page_title="Fleet Management", page_icon="🚛", layout="wide")

from database.db import ensure_database_ready
ensure_database_ready()

from utils.theme import apply_page_theme
apply_page_theme()

if not login_form():
    st.stop()
render_sidebar_user()

st.title("🚛 Fleet Management")
st.caption("Vehículos, conductores, mantenimiento y analítica de costo de propiedad.")

tabs = st.tabs(["🚚 Vehículos", "🔧 Mantenimiento", "🧑‍✈️ Conductores", "💰 TCO",
                "🔮 Próximo mantenimiento", "📊 Disponibilidad", "⚠️ Alertas de flota", "➕ Registrar"])

# ==========================================================================
# 1. VEHÍCULOS
# ==========================================================================
with tabs[0]:
    vehicles = Vehicle.all()
    if vehicles:
        df = pd.DataFrame(vehicles)[["plate", "vehicle_type", "capacity_kg", "capacity_m3",
                                       "status", "odometer_km", "home_name"]]
        df.columns = ["Placa", "Tipo", "Capacidad (kg)", "Capacidad (m³)", "Estado",
                      "Odómetro (km)", "Sede"]

        def color_status(row):
            colors = {"Disponible": "#D5F5E3", "En Ruta": "#D6EAF8",
                      "Mantenimiento": "#FCF3CF", "Fuera de Servicio": "#FADBD8"}
            return [f"background-color: {colors.get(row['Estado'], '')}"] * len(row)

        st.dataframe(df.style.apply(color_status, axis=1), use_container_width=True, hide_index=True)

        k1, k2, k3, k4 = st.columns(4)
        k1.metric("Vehículos", len(df))
        k2.metric("Capacidad total", f"{df['Capacidad (kg)'].sum():,.0f} kg")
        k3.metric("Km acumulados", f"{df['Odómetro (km)'].sum():,.0f}")
        disponibles = int((df["Estado"] == "Disponible").sum())
        k4.metric("Disponibles ahora", f"{disponibles} / {len(df)}")

        c1, c2 = st.columns(2)
        with c1:
            sdf = df.groupby("Estado").size().reset_index(name="Cantidad")
            figs = px.pie(sdf, names="Estado", values="Cantidad", hole=0.45,
                           color="Estado",
                           color_discrete_map={"Disponible": "#2A9D8F", "En Ruta": "#457B9D",
                                                "Mantenimiento": "#E9C46A",
                                                "Fuera de Servicio": "#E76F51"},
                           title="Estado operativo de la flota")
            st.plotly_chart(figs, use_container_width=True)
        with c2:
            figc = px.bar(df, x="Placa", y="Capacidad (kg)", color="Tipo",
                           color_discrete_sequence=px.colors.qualitative.Set2,
                           title="Capacidad de carga por vehículo")
            st.plotly_chart(figc, use_container_width=True)

        ce1, ce2 = st.columns(2)
        with ce1:
            st.download_button("📊 Excel", dataframe_to_excel_bytes(df, "Flota", "Vehículos de la Flota"),
                                "flota.xlsx",
                                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        with ce2:
            st.download_button("📄 PDF", dataframe_to_pdf_bytes(df, "Vehículos de la Flota"),
                                "flota.pdf", "application/pdf")
    else:
        st.info("No hay vehículos registrados.")

# ==========================================================================
# 2. MANTENIMIENTO
# ==========================================================================
with tabs[1]:
    st.subheader("Historial de mantenimientos")
    records = MaintenanceRecord.all()
    if records:
        mdf = pd.DataFrame(records)[["plate", "maintenance_type", "maintenance_date",
                                       "odometer_km", "cost", "description"]]
        mdf.columns = ["Vehículo", "Tipo", "Fecha", "Odómetro (km)", "Costo (USD)", "Descripción"]
        st.dataframe(mdf, use_container_width=True, hide_index=True)

        k1, k2, k3 = st.columns(3)
        k1.metric("Costo total", f"${mdf['Costo (USD)'].sum():,.2f}")
        prev = mdf[mdf["Tipo"] == "Preventivo"]["Costo (USD)"].sum()
        corr = mdf[mdf["Tipo"] == "Correctivo"]["Costo (USD)"].sum()
        k2.metric("Preventivo", f"${prev:,.2f}")
        k3.metric("Correctivo", f"${corr:,.2f}")
        if corr > prev and prev >= 0:
            st.warning("El gasto correctivo supera al preventivo. Un plan preventivo más frecuente "
                       "suele reducir el costo total al evitar fallas mayores.")

        figm = px.bar(mdf, x="Vehículo", y="Costo (USD)", color="Tipo",
                       color_discrete_map={"Preventivo": "#2A9D8F", "Correctivo": "#E76F51"},
                       title="Gasto de mantenimiento por vehículo y tipo")
        st.plotly_chart(figm, use_container_width=True)
    else:
        st.info("No hay mantenimientos registrados.")

    st.subheader("Registrar mantenimiento")
    vehicles = Vehicle.all()
    if vehicles:
        veh_map = {v["vehicle_id"]: f"{v['plate']} (odómetro {v['odometer_km']:,.0f} km)"
                   for v in vehicles}
        with st.form("maint_form"):
            veh_id = st.selectbox("Vehículo", options=list(veh_map.keys()),
                                   format_func=lambda x: veh_map[x])
            c1, c2 = st.columns(2)
            mtype = c1.selectbox("Tipo", options=["Preventivo", "Correctivo"])
            mdate = c2.date_input("Fecha", value=date.today())
            c3, c4 = st.columns(2)
            odo_actual = [v for v in vehicles if v["vehicle_id"] == veh_id][0]["odometer_km"]
            odo = c3.number_input("Odómetro actual (km)", min_value=0.0, value=float(odo_actual))
            cost = c4.number_input("Costo (USD)", min_value=0.0, value=120.0)
            desc = st.text_area("Descripción")
            if st.form_submit_button("Registrar", type="primary") and require_write_or_warn():
                MaintenanceRecord(None, veh_id, mtype, mdate.strftime("%Y-%m-%d"),
                                   odo, cost, desc).save()
                log_action("INSERT", "maintenance_records", str(veh_id), f"{mtype} ${cost}")
                st.success("Mantenimiento registrado y odómetro actualizado.")
                st.rerun()

# ==========================================================================
# 3. CONDUCTORES
# ==========================================================================
with tabs[2]:
    drivers = Driver.all()
    if drivers:
        ddf = pd.DataFrame(drivers)[["name", "license_number", "license_category",
                                       "license_expiry", "status", "dias_para_vencer",
                                       "alerta_vencimiento"]]
        ddf.columns = ["Nombre", "Licencia", "Categoría", "Vigencia", "Estado",
                       "Días para vencer", "Alerta"]

        def alert_color(row):
            if row["Días para vencer"] < 0:
                return ["background-color: #F5B7B1"] * len(row)
            if row["Alerta"]:
                return ["background-color: #FADBD8"] * len(row)
            return [""] * len(row)

        st.dataframe(ddf.style.apply(alert_color, axis=1), use_container_width=True, hide_index=True)

        vencidas = int((ddf["Días para vencer"] < 0).sum())
        proximas = int(ddf["Alerta"].sum()) - vencidas
        k1, k2, k3 = st.columns(3)
        k1.metric("Conductores", len(ddf))
        k2.metric("Licencias vencidas", vencidas)
        k3.metric("Por vencer (≤30 días)", max(proximas, 0))
        if vencidas:
            st.error(f"🚫 {vencidas} conductor(es) con licencia VENCIDA. No pueden ser asignados a rutas.")
        elif proximas > 0:
            st.warning(f"⚠️ {proximas} conductor(es) con licencia próxima a vencer.")
    else:
        st.info("No hay conductores registrados.")

# ==========================================================================
# 4. TCO
# ==========================================================================
with tabs[3]:
    st.subheader("💰 Costo Total de Propiedad (TCO) por vehículo")
    st.caption("TCO = combustible estimado + mantenimiento histórico + depreciación anual. "
               "Todos los valores están expresados en USD.")

    precio_comb = st.number_input("Precio del combustible (USD/litro)", min_value=0.1,
                                   value=1.05, step=0.05)
    tco = tco_all_vehicles(fuel_price=precio_comb)
    if not tco:
        st.info("No hay vehículos para analizar.")
    else:
        tdf = pd.DataFrame(tco)
        disp = tdf[["placa", "tipo", "odometro_km", "litros_estimados", "costo_combustible",
                     "costo_mantenimiento", "n_mantenimientos", "depreciacion_anual",
                     "tco_total", "costo_por_km"]].copy()
        disp.columns = ["Placa", "Tipo", "Odómetro (km)", "Litros est.", "Combustible",
                        "Mantenimiento", "N° mant.", "Depreciación anual", "TCO total",
                        "Costo por km"]
        st.dataframe(disp, use_container_width=True, hide_index=True)

        k1, k2, k3 = st.columns(3)
        k1.metric("TCO de la flota", f"${tdf['tco_total'].sum():,.2f}")
        k2.metric("Costo medio por km", f"${tdf['costo_por_km'].mean():.3f}")
        peor = tdf.loc[tdf["costo_por_km"].idxmax()]
        k3.metric("Vehículo más costoso por km", peor["placa"], f"${peor['costo_por_km']:.3f}/km")

        figt = go.Figure()
        for col, nombre, color in [("costo_combustible", "Combustible", "#2A9D8F"),
                                     ("costo_mantenimiento", "Mantenimiento", "#E76F51"),
                                     ("depreciacion_anual", "Depreciación", "#E9C46A")]:
            figt.add_trace(go.Bar(x=tdf["placa"], y=tdf[col], name=nombre, marker_color=color))
        figt.update_layout(barmode="stack", height=420, xaxis_title="Vehículo",
                            yaxis_title="USD", title="Composición del TCO por vehículo",
                            legend=dict(orientation="h", y=1.12))
        st.plotly_chart(figt, use_container_width=True)

        figk = px.bar(tdf.sort_values("costo_por_km", ascending=False), x="placa", y="costo_por_km",
                       color="tipo", color_discrete_sequence=px.colors.qualitative.Set2,
                       labels={"placa": "Vehículo", "costo_por_km": "USD por km", "tipo": "Tipo"},
                       title="Eficiencia económica: costo por kilómetro")
        st.plotly_chart(figk, use_container_width=True)

        st.download_button("📊 Exportar TCO",
                            dataframe_to_excel_bytes(disp, "TCO", "Costo Total de Propiedad"),
                            "tco_flota.xlsx",
                            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")

# ==========================================================================
# 5. PRÓXIMO MANTENIMIENTO
# ==========================================================================
with tabs[4]:
    st.subheader("🔮 Predicción del próximo mantenimiento preventivo")
    st.caption("Se proyecta el kilometraje objetivo del siguiente servicio y se estima la fecha "
               "según el promedio diario de kilómetros recorridos por cada vehículo.")

    intervalo = st.select_slider("Intervalo de mantenimiento preventivo (km)",
                                  options=[5000, 10000, 15000, 20000, 30000, 40000], value=20000)
    fc = maintenance_forecast_all(interval_km=intervalo)
    if not fc:
        st.info("No hay vehículos registrados.")
    else:
        fdf = pd.DataFrame(fc)
        disp = fdf[["placa", "odometro_actual", "ultimo_preventivo_km", "objetivo_km",
                     "km_faltantes", "km_diarios_estimados", "dias_estimados",
                     "fecha_estimada"]].copy()
        disp.columns = ["Placa", "Odómetro actual", "Último preventivo (km)", "Objetivo (km)",
                        "Km faltantes", "Km/día estimados", "Días estimados", "Fecha estimada"]

        def color_urgencia(row):
            if row["Km faltantes"] <= 0:
                return ["background-color: #F5B7B1"] * len(row)
            if row["Km faltantes"] <= intervalo * 0.15:
                return ["background-color: #FCF3CF"] * len(row)
            return ["background-color: #D5F5E3"] * len(row)

        st.dataframe(disp.style.apply(color_urgencia, axis=1), use_container_width=True,
                     hide_index=True)

        vencidos = int(fdf["vencido"].sum())
        proximos = int(fdf["alerta"].sum()) - vencidos
        k1, k2, k3 = st.columns(3)
        k1.metric("Mantenimientos vencidos", vencidos)
        k2.metric("Próximos (≤15% del intervalo)", max(proximos, 0))
        k3.metric("Al día", len(fdf) - int(fdf["alerta"].sum()))

        if vencidos:
            st.error(f"🚫 {vencidos} vehículo(s) superaron su kilometraje objetivo de mantenimiento.")

        figf = px.bar(fdf.sort_values("km_faltantes"), x="placa", y="km_faltantes",
                       color="km_faltantes", color_continuous_scale="RdYlGn",
                       labels={"placa": "Vehículo", "km_faltantes": "Km hasta el próximo servicio"},
                       title="Kilómetros restantes hasta el próximo mantenimiento")
        figf.add_hline(y=0, line_dash="dash", line_color="red")
        st.plotly_chart(figf, use_container_width=True)

        st.info("Nota metodológica: los vehículos sin ningún preventivo registrado no se marcan "
                "como vencidos por todo su odómetro. Se les programa el siguiente múltiplo del "
                "intervalo por encima de su kilometraje actual, que es lo razonable cuando no "
                "existe historial previo.")

# ==========================================================================
# 6. DISPONIBILIDAD
# ==========================================================================
with tabs[5]:
    st.subheader("📊 Disponibilidad y ocupación de la flota")
    ocupacion = run_query("""
        SELECT v.vehicle_id, v.plate, v.vehicle_type, v.status,
               m.name AS ruta, m.scheduled_start, m.scheduled_end,
               m.total_distance_km, m.total_time_h
        FROM vehicles v
        LEFT JOIN multi_stop_routes m ON m.vehicle_id = v.vehicle_id
        ORDER BY v.plate
    """)
    vehicles = Vehicle.all()
    vdf = pd.DataFrame(vehicles)

    k1, k2, k3, k4 = st.columns(4)
    total = len(vdf)
    for col, estado, etiqueta in [(k1, "Disponible", "🟢 Disponibles"),
                                    (k2, "En Ruta", "🔵 En ruta"),
                                    (k3, "Mantenimiento", "🟡 En mantenimiento"),
                                    (k4, "Fuera de Servicio", "🔴 Fuera de servicio")]:
        n = int((vdf["status"] == estado).sum()) if not vdf.empty else 0
        col.metric(etiqueta, n, f"{100*n/total:.0f}% de la flota" if total else "")

    operativos = int(vdf["status"].isin(["Disponible", "En Ruta"]).sum()) if not vdf.empty else 0
    st.metric("Utilización de flota (operativos / total)",
              f"{100*operativos/total:.1f}%" if total else "N/D")

    programadas = ocupacion.dropna(subset=["scheduled_start", "scheduled_end"])
    if not programadas.empty:
        g = programadas.copy()
        g["Inicio"] = pd.to_datetime(g["scheduled_start"], errors="coerce")
        g["Fin"] = pd.to_datetime(g["scheduled_end"], errors="coerce")
        g = g.dropna(subset=["Inicio", "Fin"])
        if not g.empty:
            figg = px.timeline(g, x_start="Inicio", x_end="Fin", y="plate", color="ruta",
                                labels={"plate": "Vehículo", "ruta": "Ruta asignada"},
                                title="Ocupación programada por vehículo")
            figg.update_yaxes(autorange="reversed")
            figg.update_layout(height=380)
            st.plotly_chart(figg, use_container_width=True)
    else:
        st.info("No hay rutas programadas asignadas a vehículos. Programa una ruta multi-parada "
                "en el módulo de Transportation para ver el diagrama de ocupación.")

    libres = vdf[vdf["status"] == "Disponible"] if not vdf.empty else pd.DataFrame()
    if not libres.empty:
        st.markdown("##### Vehículos libres para asignación inmediata")
        ldf = libres[["plate", "vehicle_type", "capacity_kg", "capacity_m3", "home_name"]].copy()
        ldf.columns = ["Placa", "Tipo", "Capacidad (kg)", "Capacidad (m³)", "Sede"]
        st.dataframe(ldf, use_container_width=True, hide_index=True)

# ==========================================================================
# 7. ALERTAS DE FLOTA
# ==========================================================================
with tabs[6]:
    st.subheader("⚠️ Alertas combinadas de la flota")
    st.caption("Situaciones de vehículos, licencias y mantenimiento que requieren atención.")

    todas = fleet_alerts() + license_alerts() + maintenance_alerts()
    if not todas:
        st.success("✅ No hay alertas activas en la flota.")
    else:
        adf = pd.DataFrame(todas)
        orden = {"critica": 0, "alta": 1, "media": 2, "baja": 3}
        adf["_orden"] = adf["severidad"].map(orden).fillna(9)
        adf = adf.sort_values("_orden")

        c1, c2, c3 = st.columns(3)
        c1.metric("🔴 Críticas", int((adf["severidad"] == "critica").sum()))
        c2.metric("🟠 Altas", int((adf["severidad"] == "alta").sum()))
        c3.metric("🟡 Medias", int((adf["severidad"] == "media").sum()))

        disp = adf[["severidad", "tipo", "titulo", "detalle", "referencia"]].copy()
        disp.columns = ["Severidad", "Tipo", "Elemento", "Detalle", "Referencia"]

        def color_sev(row):
            colors = {"critica": "#F5B7B1", "alta": "#FADBD8", "media": "#FCF3CF"}
            return [f"background-color: {colors.get(row['Severidad'], '')}"] * len(row)

        st.dataframe(disp.style.apply(color_sev, axis=1), use_container_width=True, hide_index=True)

        figa = px.bar(adf.groupby(["tipo", "severidad"]).size().reset_index(name="n"),
                       x="tipo", y="n", color="severidad",
                       color_discrete_map={"critica": "#C0392B", "alta": "#E76F51",
                                            "media": "#E9C46A", "baja": "#2A9D8F"},
                       labels={"tipo": "Tipo de alerta", "n": "Cantidad", "severidad": "Severidad"},
                       title="Alertas de flota por tipo y severidad")
        st.plotly_chart(figa, use_container_width=True)

# ==========================================================================
# 8. REGISTRAR
# ==========================================================================
with tabs[7]:
    st.subheader("Registrar nuevo vehículo")
    nodes = Node.all()
    node_map = {n["node_id"]: n["name"] for n in nodes}
    with st.form("veh_form"):
        c1, c2 = st.columns(2)
        plate = c1.text_input("Placa")
        vtype = c2.selectbox("Tipo", options=["Camion 2 ejes", "Camion 3 ejes", "Tractomula",
                                                "Furgon", "Van"])
        c3, c4 = st.columns(2)
        cap_kg = c3.number_input("Capacidad (kg)", min_value=0.0, value=9000.0)
        cap_m3 = c4.number_input("Capacidad (m³)", min_value=0.0, value=35.0)
        c5, c6 = st.columns(2)
        home = c5.selectbox("Sede", options=list(node_map.keys()), format_func=lambda x: node_map[x])
        odo_ini = c6.number_input("Odómetro inicial (km)", min_value=0.0, value=0.0)
        if st.form_submit_button("Registrar vehículo", type="primary"):
            if not plate.strip():
                st.error("La placa es obligatoria.")
            elif require_write_or_warn():
                try:
                    Vehicle(None, plate.strip().upper(), vtype, cap_kg, cap_m3,
                             "Disponible", odo_ini, home).save()
                    log_action("INSERT", "vehicles", plate.strip().upper(), vtype)
                    st.success("Vehículo registrado.")
                    st.rerun()
                except Exception as exc:
                    st.error(f"No se pudo registrar: la placa ya existe o los datos son inválidos. ({exc})")

    st.subheader("Registrar nuevo conductor")
    with st.form("drv_form"):
        c1, c2 = st.columns(2)
        name = c1.text_input("Nombre completo")
        lic = c2.text_input("Número de licencia")
        c3, c4 = st.columns(2)
        cat = c3.selectbox("Categoría", options=["C1", "C2", "C3"])
        exp = c4.date_input("Vencimiento de la licencia")
        if st.form_submit_button("Registrar conductor", type="primary"):
            if not name.strip() or not lic.strip():
                st.error("El nombre y el número de licencia son obligatorios.")
            elif require_write_or_warn():
                try:
                    Driver(None, name.strip(), lic.strip(), cat, exp.strftime("%Y-%m-%d")).save()
                    log_action("INSERT", "drivers", lic.strip(), name.strip())
                    st.success("Conductor registrado.")
                    st.rerun()
                except Exception as exc:
                    st.error(f"No se pudo registrar: la licencia ya existe o los datos son inválidos. ({exc})")
