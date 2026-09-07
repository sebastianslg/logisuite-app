"""
Módulo 3 - Transportation Management (versión avanzada).

Mapa geográfico de la red, ruteo óptimo y gestión de recursos:
  - Ruta punto a punto (Dijkstra) con comparación de criterios.
  - Ruteo multi-parada (TSP) con vecino más cercano + mejora 2-opt.
  - Validación de capacidad de vehículo antes de asignar.
  - Programación de rutas y diagrama de Gantt.
  - Control de ETA vs. tiempo real.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import json
import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from datetime import date, datetime, timedelta

from models.network import Node, Corridor
from models.fleet import Vehicle, Driver
from models.transportation import Route
from database.db import run_query, run_write
from utils.network_algorithms import build_graph, shortest_path
from utils.advanced_optimization import (solve_multi_stop_route, compare_routing_criteria,
                                          check_vehicle_capacity)
from utils.map_utils import build_network_deck
from utils.report_exporter import dataframe_to_excel_bytes, dataframe_to_pdf_bytes
from utils.auth import login_form, render_sidebar_user, require_write_or_warn
from utils.audit import log_action

st.set_page_config(page_title="Transportation Network", page_icon="🗺️", layout="wide")

if not login_form():
    st.stop()
render_sidebar_user()

st.title("🗺️ Transportation Management")
st.caption("Topología real de la red, optimización de rutas y asignación de recursos.")

nodes = Node.all()
corridors = Corridor.all()
node_map = {n["node_id"]: n["name"] for n in nodes}
node_map_full = {n["node_id"]: f"{n['name']} ({n['node_type']})" for n in nodes}

tabs = st.tabs(["🗺️ Mapa de la red", "🧭 Ruta punto a punto", "🔄 Comparar algoritmos",
                "📍 Ruta multi-parada", "🚦 Asignación y capacidad", "📅 Programación (Gantt)",
                "⏱️ ETA vs. real"])

# ==========================================================================
# 1. MAPA
# ==========================================================================
with tabs[0]:
    st.subheader("Mapa geográfico de la red de distribución")
    leyenda = {"Planta": "🔴", "Almacen": "🔵", "CD": "🟢", "Cliente": "🟠",
               "Hub": "🟣", "Gateway": "⚫"}
    cols = st.columns(len(leyenda))
    for col, (tipo, icono) in zip(cols, leyenda.items()):
        col.markdown(f"{icono} {tipo}")

    st.pydeck_chart(build_network_deck(nodes, corridors), use_container_width=True)
    st.caption(f"{len(nodes)} nodos activos · {len(corridors)} corredores de transporte")

    c1, c2 = st.columns(2)
    with c1:
        tdf = pd.DataFrame(nodes).groupby("node_type").size().reset_index(name="cantidad")
        tdf.columns = ["Tipo de nodo", "Cantidad"]
        figt = px.bar(tdf, x="Tipo de nodo", y="Cantidad", color="Tipo de nodo",
                       color_discrete_sequence=px.colors.qualitative.Set2,
                       title="Composición de la red por tipo de nodo")
        figt.update_layout(showlegend=False, height=340)
        st.plotly_chart(figt, use_container_width=True)
    with c2:
        cdf = pd.DataFrame(corridors).groupby("mode").agg(
            corredores=("corridor_id", "count"), km_totales=("distance_km", "sum")).reset_index()
        cdf.columns = ["Modo", "Corredores", "Km totales"]
        figc = px.pie(cdf, names="Modo", values="Km totales", hole=0.45,
                       color_discrete_sequence=px.colors.sequential.Teal,
                       title="Kilómetros de red por modo de transporte")
        figc.update_layout(height=340)
        st.plotly_chart(figc, use_container_width=True)

# ==========================================================================
# 2. RUTA PUNTO A PUNTO
# ==========================================================================
with tabs[1]:
    st.subheader("Ruta óptima entre dos nodos")
    c1, c2, c3 = st.columns(3)
    origin = c1.selectbox("Origen", options=list(node_map_full.keys()),
                           format_func=lambda x: node_map_full[x], key="o1")
    dest = c2.selectbox("Destino", options=list(node_map_full.keys()),
                         format_func=lambda x: node_map_full[x], key="d1")
    criterio = c3.selectbox("Optimizar por", options=["distance", "cost", "time"],
                             format_func=lambda x: {"distance": "Menor distancia",
                                                     "cost": "Menor costo",
                                                     "time": "Menor tiempo"}[x])

    if st.button("Calcular ruta óptima", type="primary"):
        G = build_graph(nodes, corridors)
        peso = {"distance": "distance", "cost": "cost", "time": "time"}[criterio]
        result = shortest_path(G, origin, dest, weight=peso)
        if result["found"]:
            st.session_state["last_route"] = result
            st.success(" → ".join(node_map[n] for n in result["path"]))
            m1, m2, m3, m4 = st.columns(4)
            m1.metric("Distancia total", f"{result['distance_km']} km")
            m2.metric("Costo total", f"${result['cost']:,.2f}")
            m3.metric("Tiempo estimado", f"{result['time_h']} h")
            m4.metric("Saltos", len(result["path"]) - 1)
        else:
            st.error("No existe ruta entre estos nodos con los corredores activos.")

    if st.session_state.get("last_route", {}).get("found"):
        st.markdown("**Ruta resaltada sobre el mapa:**")
        st.pydeck_chart(build_network_deck(nodes, corridors,
                                            highlight_path=st.session_state["last_route"]["path"]),
                         use_container_width=True)

# ==========================================================================
# 3. COMPARAR ALGORITMOS
# ==========================================================================
with tabs[2]:
    st.subheader("🔄 Comparación de criterios de ruteo")
    st.caption("La ruta más corta no siempre es la más barata ni la más rápida: cada criterio "
               "optimiza una función objetivo distinta sobre la misma red.")
    c1, c2 = st.columns(2)
    o2 = c1.selectbox("Origen", options=list(node_map_full.keys()),
                       format_func=lambda x: node_map_full[x], key="o2")
    d2 = c2.selectbox("Destino", options=list(node_map_full.keys()),
                       format_func=lambda x: node_map_full[x], index=min(9, len(nodes) - 1), key="d2")

    if st.button("Comparar los tres criterios", type="primary"):
        comp = compare_routing_criteria(nodes, corridors, o2, d2)
        encontradas = [c for c in comp if c["encontrada"]]
        if not encontradas:
            st.error("No hay ruta disponible entre estos nodos.")
        else:
            cdf = pd.DataFrame(encontradas)[["criterio", "ruta", "n_saltos", "distancia_km",
                                              "costo", "tiempo_h"]]
            cdf.columns = ["Criterio", "Ruta resultante", "Saltos", "Distancia (km)",
                           "Costo (USD)", "Tiempo (h)"]
            st.dataframe(cdf, use_container_width=True, hide_index=True)

            b1, b2, b3 = st.columns(3)
            b1.metric("Menor distancia", f"{cdf['Distancia (km)'].min():,.0f} km")
            b2.metric("Menor costo", f"${cdf['Costo (USD)'].min():,.2f}")
            b3.metric("Menor tiempo", f"{cdf['Tiempo (h)'].min():,.1f} h")

            norm = cdf.copy()
            for col in ["Distancia (km)", "Costo (USD)", "Tiempo (h)"]:
                mx = norm[col].max()
                norm[col] = 100 * norm[col] / mx if mx else 0
            figr = go.Figure()
            for _, row in norm.iterrows():
                figr.add_trace(go.Scatterpolar(
                    r=[row["Distancia (km)"], row["Costo (USD)"], row["Tiempo (h)"]],
                    theta=["Distancia", "Costo", "Tiempo"], fill="toself", name=row["Criterio"]))
            figr.update_layout(polar=dict(radialaxis=dict(visible=True, range=[0, 100])),
                                height=430, title="Perfil relativo de cada criterio (100 = peor)")
            st.plotly_chart(figr, use_container_width=True)

            if cdf["Ruta resultante"].nunique() == 1:
                st.info("En este par origen-destino los tres criterios coinciden en la misma ruta: "
                        "la red no ofrece un camino alternativo que cambie el compromiso.")
            else:
                st.info("Los criterios producen rutas distintas: existe un trade-off real entre "
                        "distancia, costo y tiempo en este par origen-destino.")

# ==========================================================================
# 4. RUTA MULTI-PARADA
# ==========================================================================
with tabs[3]:
    st.subheader("📍 Ruteo multi-parada (TSP con vecino más cercano + 2-opt)")
    st.caption("Se resuelve el circuito depósito → paradas → depósito. El vecino más cercano da "
               "una solución inicial rápida y el 2-opt la mejora invirtiendo segmentos mientras "
               "eso reduzca el recorrido.")

    c1, c2 = st.columns([1, 2])
    depot = c1.selectbox("Depósito (origen y retorno)", options=list(node_map_full.keys()),
                          format_func=lambda x: node_map_full[x], key="depot")
    paradas = c2.multiselect("Paradas a visitar",
                              options=[n for n in node_map_full if n != depot],
                              format_func=lambda x: node_map_full[x],
                              default=[n for n in node_map_full if n != depot][:4])
    criterio_ms = st.radio("Criterio", ["distance", "cost"], horizontal=True,
                            format_func=lambda x: "Distancia" if x == "distance" else "Costo")

    if st.button("🧮 Resolver ruta multi-parada", type="primary"):
        if len(paradas) < 2:
            st.warning("Selecciona al menos 2 paradas.")
        else:
            res = solve_multi_stop_route(nodes, corridors, depot, paradas, weight=criterio_ms)
            if not res["found"]:
                st.error("No se pudo construir un circuito: hay paradas inalcanzables.")
                if res.get("paradas_inalcanzables"):
                    st.write("Inalcanzables:", [node_map[p] for p in res["paradas_inalcanzables"]])
            else:
                st.session_state["ms_result"] = res
                secuencia = [depot] + res["orden_paradas"] + [depot]
                st.success(" → ".join(node_map[n] for n in secuencia))

                m1, m2, m3, m4 = st.columns(4)
                m1.metric("Distancia del circuito", f"{res['distancia_total_km']:,.0f} km")
                m2.metric("Tiempo total", f"{res['tiempo_total_h']:,.1f} h")
                m3.metric("Costo total", f"${res['costo_total']:,.2f}")
                m4.metric("Mejora del 2-opt", f"{res['mejora_pct']:.2f}%",
                          help=f"Vecino más cercano: {res['costo_nn']:,.0f} → 2-opt: {res['costo_2opt']:,.0f}")

                if res["mejora_pct"] > 0:
                    st.info(f"El 2-opt mejoró la solución inicial en {res['mejora_pct']:.2f}%, "
                            f"eliminando cruces del recorrido del vecino más cercano.")
                else:
                    st.info("El vecino más cercano ya era óptimo localmente: el 2-opt no encontró "
                            "ninguna inversión de segmento que redujera el recorrido.")

                tdf = pd.DataFrame(res["tramos"])
                tdf["Desde"] = tdf["desde"].map(node_map)
                tdf["Hasta"] = tdf["hasta"].map(node_map)
                disp = tdf[["Desde", "Hasta", "distancia_km", "tiempo_h", "costo"]]
                disp.columns = ["Desde", "Hasta", "Distancia (km)", "Tiempo (h)", "Costo (USD)"]
                st.dataframe(disp, use_container_width=True, hide_index=True)

    if "ms_result" in st.session_state and st.session_state["ms_result"].get("found"):
        res = st.session_state["ms_result"]
        secuencia = [depot] + res["orden_paradas"] + [depot]
        st.markdown("**Circuito sobre el mapa:**")
        st.pydeck_chart(build_network_deck(nodes, corridors, highlight_path=secuencia),
                         use_container_width=True)

        st.markdown("##### Guardar y programar esta ruta")
        vehiculos = Vehicle.all()
        gc1, gc2, gc3 = st.columns(3)
        nombre = gc1.text_input("Nombre de la ruta", value=f"RUTA-{date.today().strftime('%Y%m%d')}")
        veh_map = {v["vehicle_id"]: f"{v['plate']} ({v['vehicle_type']})" for v in vehiculos}
        veh_sel = gc2.selectbox("Vehículo asignado", options=[None] + list(veh_map.keys()),
                                 format_func=lambda x: "Sin asignar" if x is None else veh_map[x])
        inicio = gc3.date_input("Fecha de inicio programada", value=date.today())

        if st.button("💾 Guardar ruta programada") and require_write_or_warn():
            fin = datetime.combine(inicio, datetime.min.time()) + timedelta(hours=res["tiempo_total_h"])
            rid = run_write(
                """INSERT INTO multi_stop_routes (name, depot_node_id, stops_json, algorithm,
                   total_distance_km, total_time_h, total_cost, vehicle_id, scheduled_start,
                   scheduled_end, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
                (nombre, depot, json.dumps(res["orden_paradas"]), "nn_2opt",
                 res["distancia_total_km"], res["tiempo_total_h"], res["costo_total"],
                 veh_sel, inicio.strftime("%Y-%m-%d %H:%M"), fin.strftime("%Y-%m-%d %H:%M"),
                 datetime.now().strftime("%Y-%m-%d %H:%M")))
            log_action("INSERT", "multi_stop_routes", str(rid), nombre)
            st.success(f"Ruta '{nombre}' guardada y programada.")
            st.rerun()

# ==========================================================================
# 5. ASIGNACIÓN Y CAPACIDAD
# ==========================================================================
with tabs[4]:
    st.subheader("🚦 Asignación de vehículo y conductor con validación de capacidad")
    st.caption("El sistema impide asignar un vehículo cuya capacidad en peso o volumen sea "
               "insuficiente para la carga del envío.")

    rutas = Route.all()
    if not rutas:
        st.info("No hay rutas registradas. Registra un envío en Freight Management primero.")
    else:
        rdf = pd.DataFrame(rutas)
        show = rdf[["route_id", "shipment_id", "algorithm", "total_distance_km", "total_cost",
                     "eta_hours", "actual_hours", "desviacion_pct", "plate", "driver_name"]].copy()
        show.columns = ["Ruta", "Envío", "Algoritmo", "Distancia (km)", "Costo", "ETA (h)",
                        "Real (h)", "Desviación %", "Vehículo", "Conductor"]
        st.dataframe(show, use_container_width=True, hide_index=True)

        st.markdown("##### Asignar recursos a una ruta")
        route_id = st.selectbox("Ruta", options=rdf["route_id"].tolist())
        envio = run_query("""SELECT s.* FROM shipments s JOIN routes r
                              ON r.shipment_id = s.shipment_id WHERE r.route_id = ?""",
                           (route_id,))
        if envio.empty:
            st.warning("La ruta no tiene un envío asociado.")
        else:
            e = envio.to_dict(orient="records")[0]
            i1, i2 = st.columns(2)
            i1.metric("Peso de la carga", f"{e['weight_kg']:,.0f} kg")
            i2.metric("Volumen de la carga", f"{e['volume_m3']:,.1f} m³")

            vehiculos = Vehicle.all()
            evaluacion = []
            for v in vehiculos:
                chk = check_vehicle_capacity(v, e["weight_kg"], e["volume_m3"])
                evaluacion.append({
                    "vehicle_id": v["vehicle_id"], "Placa": v["plate"], "Tipo": v["vehicle_type"],
                    "Estado": v["status"],
                    "Cap. peso (kg)": v["capacity_kg"], "Cap. vol (m³)": v["capacity_m3"],
                    "Uso peso %": chk["utilizacion_peso_pct"],
                    "Uso vol %": chk["utilizacion_volumen_pct"],
                    "Apto": "✅ Sí" if chk["apto"] else "❌ No",
                    "Limitante": chk["factor_limitante"] or "—",
                    "_apto": chk["apto"], "_disponible": v["status"] == "Disponible",
                })
            edf = pd.DataFrame(evaluacion)

            def color_apto(row):
                if not row["_apto"]:
                    return ["background-color: #FADBD8"] * len(row)
                if not row["_disponible"]:
                    return ["background-color: #FCF3CF"] * len(row)
                return ["background-color: #D5F5E3"] * len(row)

            st.dataframe(edf.drop(columns=["vehicle_id"]).style.apply(color_apto, axis=1),
                         use_container_width=True, hide_index=True,
                         column_config={"_apto": None, "_disponible": None})

            aptos = edf[edf["_apto"] & edf["_disponible"]]
            if aptos.empty:
                st.error("⚠️ Ningún vehículo disponible tiene capacidad suficiente para esta carga. "
                         "Considera dividir el envío o consolidarlo en un vehículo mayor.")
            else:
                drivers = [d for d in Driver.all() if d["status"] == "Activo"]
                a1, a2 = st.columns(2)
                veh_opts = {int(r["vehicle_id"]): r["Placa"] for _, r in aptos.iterrows()}
                veh_id = a1.selectbox("Vehículo apto y disponible", options=list(veh_opts.keys()),
                                       format_func=lambda x: veh_opts[x])
                if drivers:
                    drv_map = {d["driver_id"]: (d["name"] + (" ⚠️ licencia por vencer"
                                                             if d["alerta_vencimiento"] else ""))
                               for d in drivers}
                    drv_id = a2.selectbox("Conductor activo", options=list(drv_map.keys()),
                                           format_func=lambda x: drv_map[x])
                    drv = [d for d in drivers if d["driver_id"] == drv_id][0]
                    if drv["alerta_vencimiento"]:
                        st.warning(f"⚠️ La licencia de {drv['name']} vence en "
                                   f"{drv['dias_para_vencer']} días ({drv['license_expiry']}). "
                                   "Verifica la vigencia antes de despachar.")
                    if st.button("Asignar recursos", type="primary") and require_write_or_warn():
                        Route.assign_vehicle_driver(route_id, veh_id, drv_id)
                        log_action("UPDATE", "routes", str(route_id),
                                   f"vehículo {veh_opts[veh_id]}, conductor {drv['name']}")
                        st.success("Vehículo y conductor asignados. Vehículo marcado 'En Ruta'.")
                        st.rerun()
                else:
                    st.warning("No hay conductores activos disponibles.")

# ==========================================================================
# 6. PROGRAMACIÓN (GANTT)
# ==========================================================================
with tabs[5]:
    st.subheader("📅 Programación de rutas multi-parada")
    prog = run_query("""
        SELECT m.*, n.name AS depot_name, v.plate
        FROM multi_stop_routes m
        JOIN nodes n ON m.depot_node_id = n.node_id
        LEFT JOIN vehicles v ON m.vehicle_id = v.vehicle_id
        ORDER BY m.scheduled_start
    """)
    if prog.empty:
        st.info("No hay rutas programadas. Resuelve una ruta multi-parada y guárdala para verla aquí.")
    else:
        disp = prog[["ms_route_id", "name", "depot_name", "plate", "total_distance_km",
                      "total_time_h", "total_cost", "scheduled_start", "scheduled_end"]].copy()
        disp.columns = ["ID", "Ruta", "Depósito", "Vehículo", "Distancia (km)", "Duración (h)",
                        "Costo", "Inicio", "Fin"]
        st.dataframe(disp, use_container_width=True, hide_index=True)

        gantt = prog.copy()
        gantt["Recurso"] = gantt["plate"].fillna("Sin asignar")
        gantt["Inicio"] = pd.to_datetime(gantt["scheduled_start"], errors="coerce")
        gantt["Fin"] = pd.to_datetime(gantt["scheduled_end"], errors="coerce")
        gantt = gantt.dropna(subset=["Inicio", "Fin"])
        if not gantt.empty:
            figg = px.timeline(gantt, x_start="Inicio", x_end="Fin", y="Recurso",
                                color="name", hover_data=["total_distance_km", "total_cost"],
                                labels={"name": "Ruta"}, title="Ocupación programada de la flota")
            figg.update_yaxes(autorange="reversed")
            figg.update_layout(height=400)
            st.plotly_chart(figg, use_container_width=True)

        st.download_button("📊 Exportar programación",
                            dataframe_to_excel_bytes(disp, "Programacion", "Rutas Programadas"),
                            "programacion_rutas.xlsx",
                            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")

# ==========================================================================
# 7. ETA VS. REAL
# ==========================================================================
with tabs[6]:
    st.subheader("⏱️ Control de tiempos: estimado vs. real")
    rutas = Route.all()
    if not rutas:
        st.info("No hay rutas registradas.")
    else:
        rdf = pd.DataFrame(rutas)
        con_real = rdf[rdf["actual_hours"].notna()].copy()

        if con_real.empty:
            st.info("Ninguna ruta tiene tiempo real registrado todavía.")
        else:
            con_real["Ruta"] = con_real["route_id"].astype(str)
            k1, k2, k3 = st.columns(3)
            k1.metric("Desviación media", f"{con_real['desviacion_pct'].mean():+.1f}%")
            k2.metric("Rutas a tiempo o antes",
                      int((con_real["desviacion_pct"] <= 0).sum()))
            k3.metric("Rutas con retraso", int((con_real["desviacion_pct"] > 0).sum()))

            figd = go.Figure()
            figd.add_trace(go.Bar(x=con_real["Ruta"], y=con_real["eta_hours"],
                                   name="ETA estimado (h)", marker_color="#2A9D8F"))
            figd.add_trace(go.Bar(x=con_real["Ruta"], y=con_real["actual_hours"],
                                   name="Tiempo real (h)", marker_color="#E76F51"))
            figd.update_layout(barmode="group", height=400, xaxis_title="Ruta",
                                yaxis_title="Horas", legend=dict(orientation="h", y=1.12))
            st.plotly_chart(figd, use_container_width=True)

            disp = con_real[["route_id", "shipment_id", "total_distance_km", "eta_hours",
                              "actual_hours", "desviacion_pct", "plate"]].copy()
            disp.columns = ["Ruta", "Envío", "Distancia (km)", "ETA (h)", "Real (h)",
                            "Desviación %", "Vehículo"]

            def color_desv(row):
                if row["Desviación %"] > 20:
                    return ["background-color: #FADBD8"] * len(row)
                if row["Desviación %"] > 5:
                    return ["background-color: #FCF3CF"] * len(row)
                return ["background-color: #D5F5E3"] * len(row)

            st.dataframe(disp.style.apply(color_desv, axis=1), use_container_width=True,
                         hide_index=True)

        st.markdown("##### Registrar tiempo real de una ruta")
        c1, c2 = st.columns(2)
        route_id2 = c1.selectbox("Ruta a actualizar", options=rdf["route_id"].tolist(), key="rt2")
        eta_ref = rdf[rdf["route_id"] == route_id2]["eta_hours"].iloc[0]
        actual_h = c2.number_input("Tiempo real de tránsito (horas)", min_value=0.0,
                                    value=float(eta_ref) if pd.notna(eta_ref) else 10.0)
        if st.button("Registrar tiempo real") and require_write_or_warn():
            Route.register_actual_time(route_id2, actual_h)
            log_action("UPDATE", "routes", str(route_id2), f"tiempo real {actual_h} h")
            st.success("Tiempo real registrado.")
            st.rerun()
