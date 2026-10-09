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

from models.fleet import Vehicle, Driver, MaintenanceRecord, VEHICLE_CLASSES, vehicle_label
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

from utils.theme import (apply_page_theme, page_header, render_kpi_row, ROW_TINT,
                         STATUS_COLORS, CYAN, ELECTRIC_BLUE, EMERALD, AMBER, ROSE)
apply_page_theme()

if not login_form():
    st.stop()
render_sidebar_user()

page_header("🚛", "Fleet Management", "Vehículos, conductores, mantenimiento y analítica de costo de propiedad.")

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
        df["vehicle_type"] = df["vehicle_type"].map(vehicle_label)
        df.columns = ["Placa", "Tipo", "Capacidad (kg)", "Capacidad (m³)", "Estado",
                      "Odómetro (km)", "Sede"]

        disponibles = int((df["Estado"] == "Disponible").sum())
        en_ruta = int((df["Estado"] == "En Ruta").sum())
        render_kpi_row([
            {"title": "Vehículos", "value": len(df),
             "delta": f"{en_ruta} en ruta", "is_positive": None, "icon": "🚛"},
            {"title": "Capacidad total", "value": f"{df['Capacidad (kg)'].sum() / 1000:,.0f} t",
             "icon": "⚖️"},
            {"title": "Km acumulados", "value": f"{df['Odómetro (km)'].sum():,.0f}", "icon": "🛣️"},
            {"title": "Disponibles ahora", "value": f"{disponibles} / {len(df)}",
             "delta": f"{100 * disponibles / len(df):.0f}% de la flota",
             "is_positive": disponibles > 0, "icon": "🟢"},
        ])

        tint = {"Disponible": "ok", "En Ruta": "info", "Mantenimiento": "warn",
                "Fuera de Servicio": "bad"}

        def color_status(row):
            return [ROW_TINT[tint.get(row["Estado"], "none")]] * len(row)

        st.dataframe(
            df.style.apply(color_status, axis=1), width="stretch", hide_index=True,
            column_config={
                "Capacidad (kg)": st.column_config.NumberColumn(format="%d kg"),
                "Odómetro (km)": st.column_config.ProgressColumn(
                    format="%d km", min_value=0, max_value=float(df["Odómetro (km)"].max() or 1)),
            })

        c1, c2 = st.columns(2)
        with c1:
            sdf = df.groupby("Estado").size().reset_index(name="Cantidad")
            figs = px.pie(sdf, names="Estado", values="Cantidad", hole=0.6,
                           color="Estado", color_discrete_map=STATUS_COLORS,
                           title="Estado operativo de la flota")
            figs.update_traces(marker=dict(line=dict(color="#0A0E17", width=2)))
            st.plotly_chart(figs, width="stretch")
        with c2:
            figc = px.bar(df.sort_values("Capacidad (kg)", ascending=False), x="Placa",
                           y="Capacidad (kg)", color="Tipo",
                           title="Capacidad de carga por vehículo")
            st.plotly_chart(figc, width="stretch")

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
        prev = mdf[mdf["Tipo"] == "Preventivo"]["Costo (USD)"].sum()
        corr = mdf[mdf["Tipo"] == "Correctivo"]["Costo (USD)"].sum()
        render_kpi_row([
            {"title": "Costo total", "value": f"${mdf['Costo (USD)'].sum():,.2f}", "icon": "🔧"},
            {"title": "Preventivo", "value": f"${prev:,.2f}", "icon": "🛡️"},
            {"title": "Correctivo", "value": f"${corr:,.2f}",
             "delta": "supera al preventivo" if corr > prev else "bajo control",
             "is_positive": corr <= prev, "icon": "🚨"},
        ])
        st.dataframe(mdf, width="stretch", hide_index=True,
                     column_config={"Costo (USD)": st.column_config.NumberColumn(format="$%.2f")})
        if corr > prev and prev >= 0:
            st.warning("El gasto correctivo supera al preventivo. Un plan preventivo más frecuente "
                       "suele reducir el costo total al evitar fallas mayores.")

        figm = px.bar(mdf, x="Vehículo", y="Costo (USD)", color="Tipo",
                       color_discrete_map={"Preventivo": CYAN, "Correctivo": ROSE},
                       title="Gasto de mantenimiento por vehículo y tipo")
        st.plotly_chart(figm, width="stretch")
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
                return [ROW_TINT["critical"]] * len(row)
            if row["Alerta"]:
                return [ROW_TINT["bad"]] * len(row)
            return [""] * len(row)

        vencidas = int((ddf["Días para vencer"] < 0).sum())
        proximas = int(ddf["Alerta"].sum()) - vencidas
        render_kpi_row([
            {"title": "Conductores", "value": len(ddf), "icon": "🧑‍✈️"},
            {"title": "Licencias vencidas", "value": vencidas,
             "delta": "no asignables" if vencidas else "ninguna", "is_positive": vencidas == 0,
             "icon": "🚫"},
            {"title": "Por vencer (≤30 días)", "value": max(proximas, 0), "icon": "⏳"},
        ])
        st.dataframe(ddf.style.apply(alert_color, axis=1), width="stretch", hide_index=True)
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
        tdf["tipo"] = tdf["tipo"].map(vehicle_label)
        disp = tdf[["placa", "tipo", "odometro_km", "litros_estimados", "costo_combustible",
                     "costo_mantenimiento", "n_mantenimientos", "depreciacion_anual",
                     "tco_total", "costo_por_km"]].copy()
        disp.columns = ["Placa", "Tipo", "Odómetro (km)", "Litros est.", "Combustible",
                        "Mantenimiento", "N° mant.", "Depreciación anual", "TCO total",
                        "Costo por km"]
        st.dataframe(disp, width="stretch", hide_index=True)

        peor = tdf.loc[tdf["costo_por_km"].idxmax()]
        render_kpi_row([
            {"title": "TCO de la flota", "value": f"${tdf['tco_total'].sum():,.0f}", "icon": "💰"},
            {"title": "Costo medio por km", "value": f"${tdf['costo_por_km'].mean():.3f}", "icon": "📏"},
            {"title": "Más costoso por km", "value": peor["placa"],
             "delta": f"${peor['costo_por_km']:.3f}/km", "is_positive": False, "icon": "⚠️"},
        ])

        figt = go.Figure()
        for col, nombre, color in [("costo_combustible", "Combustible", CYAN),
                                     ("costo_mantenimiento", "Mantenimiento", ROSE),
                                     ("depreciacion_anual", "Depreciación", ELECTRIC_BLUE)]:
            figt.add_trace(go.Bar(x=tdf["placa"], y=tdf[col], name=nombre, marker_color=color))
        figt.update_layout(barmode="stack", height=420, xaxis_title="Vehículo",
                            yaxis_title="USD", title="Composición del TCO por vehículo",
                            legend=dict(orientation="h", y=1.12))
        st.plotly_chart(figt, width="stretch")

        figk = px.bar(tdf.sort_values("costo_por_km", ascending=False), x="placa", y="costo_por_km",
                       color="tipo",
                       labels={"placa": "Vehículo", "costo_por_km": "USD por km", "tipo": "Tipo"},
                       title="Eficiencia económica: costo por kilómetro")
        st.plotly_chart(figk, width="stretch")

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
                return [ROW_TINT["critical"]] * len(row)
            if row["Km faltantes"] <= intervalo * 0.15:
                return [ROW_TINT["warn"]] * len(row)
            return [ROW_TINT["ok"]] * len(row)

        st.dataframe(disp.style.apply(color_urgencia, axis=1), width="stretch",
                     hide_index=True)

        vencidos = int(fdf["vencido"].sum())
        proximos = int(fdf["alerta"].sum()) - vencidos
        render_kpi_row([
            {"title": "Mantenimientos vencidos", "value": vencidos,
             "delta": "atender ya" if vencidos else "ninguno", "is_positive": vencidos == 0,
             "icon": "🚫"},
            {"title": "Próximos (≤15% del intervalo)", "value": max(proximos, 0), "icon": "⏳"},
            {"title": "Al día", "value": len(fdf) - int(fdf["alerta"].sum()), "icon": "✅"},
        ])

        if vencidos:
            st.error(f"🚫 {vencidos} vehículo(s) superaron su kilometraje objetivo de mantenimiento.")

        figf = px.bar(fdf.sort_values("km_faltantes"), x="placa", y="km_faltantes",
                       color="km_faltantes",
                       color_continuous_scale=[[0, ROSE], [0.5, AMBER], [1, EMERALD]],
                       labels={"placa": "Vehículo", "km_faltantes": "Km hasta el próximo servicio"},
                       title="Kilómetros restantes hasta el próximo mantenimiento")
        figf.add_hline(y=0, line_dash="dash", line_color=ROSE)
        st.plotly_chart(figf, width="stretch")

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

    total = len(vdf)
    operativos = int(vdf["status"].isin(["Disponible", "En Ruta"]).sum()) if not vdf.empty else 0
    tarjetas = [{"title": "Utilización de flota", "value": f"{100*operativos/total:.1f}%" if total else "N/D",
                 "delta": "operativos / total", "is_positive": None, "icon": "📈"}]
    for estado, etiqueta, icono in [("Disponible", "Disponibles", "🟢"), ("En Ruta", "En ruta", "🔵"),
                                    ("Mantenimiento", "En mantenimiento", "🟡"),
                                    ("Fuera de Servicio", "Fuera de servicio", "🔴")]:
        n = int((vdf["status"] == estado).sum()) if not vdf.empty else 0
        tarjetas.append({"title": etiqueta, "value": n,
                         "delta": f"{100*n/total:.0f}% de la flota" if total else None,
                         "is_positive": None, "icon": icono})
    render_kpi_row(tarjetas)

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
            st.plotly_chart(figg, width="stretch")
    else:
        st.info("No hay rutas programadas asignadas a vehículos. Programa una ruta multi-parada "
                "en el módulo de Transportation para ver el diagrama de ocupación.")

    libres = vdf[vdf["status"] == "Disponible"] if not vdf.empty else pd.DataFrame()
    if not libres.empty:
        st.markdown("##### Vehículos libres para asignación inmediata")
        ldf = libres[["plate", "vehicle_type", "capacity_kg", "capacity_m3", "home_name"]].copy()
        ldf["vehicle_type"] = ldf["vehicle_type"].map(vehicle_label)
        ldf.columns = ["Placa", "Tipo", "Capacidad (kg)", "Capacidad (m³)", "Sede"]
        st.dataframe(ldf, width="stretch", hide_index=True)

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

        render_kpi_row([
            {"title": "Críticas", "value": int((adf["severidad"] == "critica").sum()), "icon": "🔴"},
            {"title": "Altas", "value": int((adf["severidad"] == "alta").sum()), "icon": "🟠"},
            {"title": "Medias", "value": int((adf["severidad"] == "media").sum()), "icon": "🟡"},
        ])

        disp = adf[["severidad", "tipo", "titulo", "detalle", "referencia"]].copy()
        disp.columns = ["Severidad", "Tipo", "Elemento", "Detalle", "Referencia"]

        def color_sev(row):
            tint = {"critica": "critical", "alta": "bad", "media": "warn"}
            return [ROW_TINT[tint.get(row["Severidad"], "none")]] * len(row)

        st.dataframe(disp.style.apply(color_sev, axis=1), width="stretch", hide_index=True)

        figa = px.bar(adf.groupby(["tipo", "severidad"]).size().reset_index(name="n"),
                       x="tipo", y="n", color="severidad",
                       color_discrete_map={"critica": ROSE, "alta": AMBER,
                                            "media": ELECTRIC_BLUE, "baja": EMERALD},
                       labels={"tipo": "Tipo de alerta", "n": "Cantidad", "severidad": "Severidad"},
                       title="Alertas de flota por tipo y severidad")
        st.plotly_chart(figa, width="stretch")

# ==========================================================================
# 8. REGISTRAR
# ==========================================================================
with tabs[7]:
    st.subheader("Registrar nuevo vehículo")
    nodes = Node.all()
    node_map = {n["node_id"]: n["name"] for n in nodes}
    with st.form("veh_form"):
        c1, c2 = st.columns(2)
        plate = c1.text_input("Placa", placeholder="ABC-123")
        vtype = c2.selectbox("Tipo", options=list(VEHICLE_CLASSES.keys()), format_func=vehicle_label)
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
