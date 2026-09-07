"""
Módulo 2 - Freight Management (versión avanzada).

Registro y tracking de envíos, motor parametrizado de costos con sus tres
componentes, y las funcionalidades avanzadas:
  - Consolidación real de cargas que comparten corredor y ventana de fechas.
  - Simulador de tarifas por modo de transporte (costo y tiempo comparados).
  - Huella de carbono por envío y por modo.
  - Serie temporal del costo por km de cada corredor.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from datetime import date, datetime

from models.freight import Shipment, compute_transport_cost, DEFAULT_COST_PARAMS
from models.network import Node, Corridor
from models.consolidation import (Consolidation, candidates_for_consolidation,
                                  evaluate_consolidation, ShipmentEmission,
                                  corridor_cost_history)
from utils.network_algorithms import build_graph, shortest_path
from utils.fleet_analytics import compute_emissions, compare_modes_emissions, EMISSION_FACTORS
from utils.report_exporter import dataframe_to_excel_bytes, dataframe_to_pdf_bytes
from utils.auth import login_form, render_sidebar_user, require_write_or_warn
from utils.audit import log_action

st.set_page_config(page_title="Freight Management", page_icon="🚚", layout="wide")

from database.db import ensure_database_ready
ensure_database_ready()

from utils.theme import apply_page_theme
apply_page_theme()

if not login_form():
    st.stop()
render_sidebar_user()

st.title("🚚 Freight Management")
st.caption("Registro de envíos, consolidación de carga, motor de costos y huella de carbono.")

nodes = Node.all()
corridors = Corridor.all()
node_map = {n["node_id"]: f"{n['name']} ({n['node_type']})" for n in nodes}

tabs = st.tabs(["📋 Envíos y tracking", "➕ Registrar envío", "⚙️ Motor de costos",
                "📦 Consolidación", "🔀 Simulador de modos", "🌱 Huella de carbono",
                "📈 Historial de costos"])

# ==========================================================================
# 1. ENVÍOS Y TRACKING
# ==========================================================================
with tabs[0]:
    ships = Shipment.all()
    if ships:
        df = pd.DataFrame(ships)[["shipment_id", "origin_name", "dest_name", "cargo_units",
                                   "weight_kg", "volume_m3", "status", "promised_date",
                                   "delivered_date", "total_cost"]]
        df.columns = ["ID", "Origen", "Destino", "Unidades", "Peso (kg)", "Volumen (m3)",
                      "Estado", "Fecha Prometida", "Fecha Entrega", "Costo Total"]

        def color_estado(row):
            colors = {"Entregado": "#D5F5E3", "En Transito": "#D6EAF8", "Retrasado": "#FADBD8",
                      "Consolidado": "#E8DAEF", "Registrado": ""}
            return [f"background-color: {colors.get(row['Estado'], '')}"] * len(row)

        st.dataframe(df.style.apply(color_estado, axis=1), use_container_width=True, hide_index=True)

        otif = Shipment.otif_kpi()
        k1, k2, k3 = st.columns(3)
        k1.metric("OTIF", f"{otif['otif_pct']}%" if otif["otif_pct"] is not None else "N/D")
        k2.metric("Costo total de envíos", f"${df['Costo Total'].sum():,.2f}")
        k3.metric("Envíos registrados", len(df))

        st.subheader("Actualizar estado de un envío")
        c1, c2 = st.columns(2)
        sel = c1.selectbox("Envío", options=df["ID"].tolist())
        new_status = c2.selectbox("Nuevo estado", options=Shipment.STATUSES)
        deliv_date = None
        if new_status == "Entregado":
            deliv_date = st.date_input("Fecha de entrega", value=date.today()).strftime("%Y-%m-%d")
        if st.button("Actualizar estado", type="primary") and require_write_or_warn():
            Shipment.update_status(sel, new_status, deliv_date)
            log_action("UPDATE", "shipments", str(sel), f"estado -> {new_status}")
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

# ==========================================================================
# 2. REGISTRAR ENVÍO
# ==========================================================================
with tabs[1]:
    st.subheader("Registrar nuevo envío")
    with st.form("ship_form"):
        c1, c2 = st.columns(2)
        origin = c1.selectbox("Nodo de origen", options=list(node_map.keys()),
                               format_func=lambda x: node_map[x])
        dest = c2.selectbox("Nodo de destino", options=list(node_map.keys()),
                             format_func=lambda x: node_map[x])
        c3, c4 = st.columns(2)
        cargo_units = c3.number_input("Unidades de carga", min_value=1, value=1)
        weight = c4.number_input("Peso total (kg)", min_value=0.0, value=1000.0)
        c5, c6 = st.columns(2)
        volume = c5.number_input("Volumen total (m3)", min_value=0.0, value=5.0)
        declared_value = c6.number_input("Valor declarado (USD)", min_value=0.0, value=10000.0)
        promised = st.date_input("Fecha prometida de entrega", value=date.today())
        submitted = st.form_submit_button("Calcular costo y registrar envío", type="primary")

        if submitted:
            if origin == dest:
                st.error("El origen y el destino no pueden ser el mismo nodo.")
            elif not require_write_or_warn():
                pass
            else:
                G = build_graph(nodes, corridors)
                route = shortest_path(G, origin, dest, weight="distance")
                if not route["found"]:
                    st.error("No existe un corredor de transporte que conecte estos nodos.")
                else:
                    breakdown = compute_transport_cost(
                        distance_km=route["distance_km"], transit_time_h=route["time_h"],
                        weight_kg=weight, volume_m3=volume, cargo_units=cargo_units,
                        declared_value=declared_value)
                    sid = Shipment(None, origin, dest, cargo_units, weight, volume, "Registrado",
                                    promised.strftime("%Y-%m-%d"), "",
                                    breakdown["transaction_cost"], breakdown["distance_friction_cost"],
                                    breakdown["shipment_cost"], breakdown["total_cost"]).save()
                    # Se calcula y persiste la huella de carbono del envío
                    em = compute_emissions(route["distance_km"], weight, "Terrestre")
                    ShipmentEmission(None, sid, "Terrestre", route["distance_km"],
                                      em["ton_km"], em["kg_co2e"],
                                      datetime.now().strftime("%Y-%m-%d %H:%M")).save()
                    log_action("INSERT", "shipments", str(sid),
                               f"{node_map[origin]} -> {node_map[dest]}")
                    st.success(f"Envío #{sid} registrado. Distancia {route['distance_km']} km · "
                               f"Costo ${breakdown['total_cost']:,.2f} · "
                               f"Huella {em['kg_co2e']:,.1f} kg CO₂e")
                    st.json(breakdown["breakdown"])

# ==========================================================================
# 3. MOTOR DE COSTOS
# ==========================================================================
with tabs[2]:
    st.subheader("⚙️ Motor parametrizado de costos de transporte")
    st.caption("Los tres componentes del costo se calculan por separado para que su origen sea "
               "trazable: (a) transacción, (b) fricción de la distancia, (c) costo del envío.")

    with st.expander("Parámetros del motor (editables en esta simulación)"):
        p = {}
        pc1, pc2 = st.columns(2)
        p["insurance_rate"] = pc1.number_input("Tasa de seguro (% del valor)", value=DEFAULT_COST_PARAMS["insurance_rate"] * 100, step=0.1) / 100
        p["customs_flat_fee"] = pc2.number_input("Trámites aduaneros (USD fijos)", value=DEFAULT_COST_PARAMS["customs_flat_fee"])
        p["energy_cost_per_km_ton"] = pc1.number_input("Costo energético (USD/km/ton)", value=DEFAULT_COST_PARAMS["energy_cost_per_km_ton"], format="%.3f")
        p["time_cost_per_hour"] = pc2.number_input("Costo del tiempo (USD/hora)", value=DEFAULT_COST_PARAMS["time_cost_per_hour"])
        p["packaging_cost_per_m3"] = pc1.number_input("Empaque (USD/m3)", value=DEFAULT_COST_PARAMS["packaging_cost_per_m3"])
        p["consolidation_discount"] = pc2.number_input("Descuento por masificación (%)", value=DEFAULT_COST_PARAMS["consolidation_discount"] * 100) / 100
        p["consolidation_threshold"] = pc1.number_input("Umbral de masificación (unidades)", value=DEFAULT_COST_PARAMS["consolidation_threshold"], step=1)

    c1, c2, c3 = st.columns(3)
    distance_km = c1.number_input("Distancia (km)", value=500.0, key="mc_d")
    transit_h = c1.number_input("Tiempo de tránsito (h)", value=10.0, key="mc_t")
    weight_kg = c2.number_input("Peso (kg)", value=5000.0, key="mc_w")
    volume_m3 = c2.number_input("Volumen (m3)", value=20.0, key="mc_v")
    cargo_units = c3.number_input("Unidades de carga", value=6, step=1, key="mc_u")
    declared_value = c3.number_input("Valor declarado (USD)", value=15000.0, key="mc_val")

    result = compute_transport_cost(distance_km, transit_h, weight_kg, volume_m3,
                                     int(cargo_units), declared_value, params=p)
    st.divider()
    m1, m2, m3, m4 = st.columns(4)
    m1.metric("(a) Costo de Transacción", f"${result['transaction_cost']:,.2f}")
    m2.metric("(b) Fricción de la Distancia", f"${result['distance_friction_cost']:,.2f}")
    m3.metric("(c) Costo del Envío", f"${result['shipment_cost']:,.2f}")
    m4.metric("Costo Total", f"${result['total_cost']:,.2f}")

    comp_df = pd.DataFrame({
        "Componente": ["Transacción", "Fricción de distancia", "Costo del envío"],
        "Valor": [result["transaction_cost"], result["distance_friction_cost"], result["shipment_cost"]],
    })
    figc = px.pie(comp_df, names="Componente", values="Valor", hole=0.45,
                   color_discrete_sequence=["#264653", "#2A9D8F", "#E9C46A"],
                   title="Composición del costo total")
    st.plotly_chart(figc, use_container_width=True)
    st.caption("Desglose detallado:")
    st.json(result["breakdown"])

# ==========================================================================
# 4. CONSOLIDACIÓN
# ==========================================================================
with tabs[3]:
    st.subheader("📦 Consolidación de carga")
    st.caption("Agrupa envíos que comparten corredor y ventana de fechas. El ahorro proviene de "
               "pagar el costo de transacción una sola vez y de superar el umbral de masificación.")

    ventana = st.slider("Ventana de agrupación (días)", 1, 30, 7)
    grupos = candidates_for_consolidation(window_days=ventana)

    if not grupos:
        st.info("No hay grupos consolidables con esta ventana. Se requieren al menos 2 envíos en "
                "estado 'Registrado' con el mismo origen y destino dentro de la ventana de fechas.")
    else:
        st.success(f"Se encontraron {len(grupos)} grupo(s) consolidable(s).")
        G = build_graph(nodes, corridors)
        resumen = []
        for i, g in enumerate(grupos):
            ruta = shortest_path(G, g["origin_node_id"], g["dest_node_id"], weight="distance")
            dist = ruta["distance_km"] if ruta["found"] else 100.0
            tiempo = ruta["time_h"] if ruta["found"] else 2.0
            valor = max(g["costo_individual_total"] * 10, 1000)
            ev = evaluate_consolidation(g, dist, tiempo, valor)
            resumen.append({
                "Grupo": i + 1,
                "Origen": g["origin_name"], "Destino": g["dest_name"],
                "Envíos": g["n_envios"], "IDs": ", ".join(map(str, g["shipment_ids"])),
                "Peso (kg)": g["total_weight_kg"], "Volumen (m3)": g["total_volume_m3"],
                "Costo separado": ev["costo_antes"], "Costo consolidado": ev["costo_despues"],
                "Ahorro": ev["ahorro"], "Ahorro %": ev["ahorro_pct"],
            })
        rdf = pd.DataFrame(resumen)
        st.dataframe(rdf, use_container_width=True, hide_index=True)

        a1, a2 = st.columns(2)
        a1.metric("Ahorro potencial total", f"${rdf['Ahorro'].sum():,.2f}")
        a2.metric("Ahorro promedio", f"{rdf['Ahorro %'].mean():.1f}%")

        figs = go.Figure()
        figs.add_trace(go.Bar(x=rdf["Grupo"], y=rdf["Costo separado"], name="Sin consolidar",
                               marker_color="#E76F51"))
        figs.add_trace(go.Bar(x=rdf["Grupo"], y=rdf["Costo consolidado"], name="Consolidado",
                               marker_color="#2A9D8F"))
        figs.update_layout(barmode="group", height=380, xaxis_title="Grupo",
                            yaxis_title="Costo (USD)", legend=dict(orientation="h", y=1.12))
        st.plotly_chart(figs, use_container_width=True)

        st.markdown("##### Ejecutar consolidación")
        gsel = st.selectbox("Grupo a consolidar", options=list(range(1, len(grupos) + 1)),
                            format_func=lambda i: f"Grupo {i}: {grupos[i-1]['origin_name']} → "
                                                   f"{grupos[i-1]['dest_name']} ({grupos[i-1]['n_envios']} envíos)")
        nombre = st.text_input("Nombre de la consolidación",
                                value=f"CONS-{date.today().strftime('%Y%m%d')}-{gsel}")
        if st.button("📦 Consolidar este grupo", type="primary") and require_write_or_warn():
            g = grupos[gsel - 1]
            fila = resumen[gsel - 1]
            cid = Consolidation(None, nombre, g["origin_node_id"], g["dest_node_id"],
                                 date.today().strftime("%Y-%m-%d"), g["total_weight_kg"],
                                 g["total_volume_m3"], fila["Costo separado"],
                                 fila["Costo consolidado"], fila["Ahorro"]).save(g["shipment_ids"])
            log_action("INSERT", "consolidations", str(cid),
                       f"{g['n_envios']} envíos, ahorro ${fila['Ahorro']:,.2f}")
            st.success(f"Consolidación #{cid} creada. Los envíos pasaron a estado 'Consolidado'.")
            st.rerun()

    st.divider()
    st.markdown("##### Consolidaciones registradas")
    cons = Consolidation.all()
    if cons:
        cdf = pd.DataFrame(cons)[["consolidation_id", "name", "origin_name", "dest_name",
                                   "consolidation_date", "n_envios", "total_weight_kg",
                                   "cost_before", "cost_after", "savings"]]
        cdf.columns = ["ID", "Nombre", "Origen", "Destino", "Fecha", "Envíos", "Peso (kg)",
                       "Costo antes", "Costo después", "Ahorro"]
        st.dataframe(cdf, use_container_width=True, hide_index=True)
        st.metric("Ahorro acumulado por consolidación", f"${cdf['Ahorro'].sum():,.2f}")
    else:
        st.caption("Aún no se ha ejecutado ninguna consolidación.")

# ==========================================================================
# 5. SIMULADOR DE MODOS
# ==========================================================================
with tabs[4]:
    st.subheader("🔀 Simulador de tarifas por modo de transporte")
    st.caption("Compara costo, tiempo y emisiones de un mismo envío bajo cada modo. Los modos "
               "difieren en velocidad, costo por km e intensidad de carbono, así que el modo "
               "más barato rara vez es el más rápido ni el más limpio.")

    c1, c2, c3 = st.columns(3)
    sim_dist = c1.number_input("Distancia (km)", min_value=1.0, value=800.0, key="sm_d")
    sim_peso = c2.number_input("Peso (kg)", min_value=1.0, value=15000.0, key="sm_w")
    sim_vol = c3.number_input("Volumen (m3)", min_value=0.1, value=45.0, key="sm_v")
    c4, c5 = st.columns(2)
    sim_unid = c4.number_input("Unidades de carga", min_value=1, value=8, key="sm_u")
    sim_valor = c5.number_input("Valor declarado (USD)", min_value=0.0, value=40000.0, key="sm_val")

    # Perfil operativo de cada modo: velocidad media y multiplicador de costo
    PERFIL_MODOS = {
        "Terrestre": {"velocidad_kmh": 55, "factor_costo": 1.00},
        "Maritimo":  {"velocidad_kmh": 15, "factor_costo": 0.45},
        "Fluvial":   {"velocidad_kmh": 20, "factor_costo": 0.60},
        "Aereo":     {"velocidad_kmh": 750, "factor_costo": 4.20},
    }
    filas = []
    for modo, perf in PERFIL_MODOS.items():
        tiempo = sim_dist / perf["velocidad_kmh"]
        params = dict(DEFAULT_COST_PARAMS)
        params["energy_cost_per_km_ton"] *= perf["factor_costo"]
        costo = compute_transport_cost(sim_dist, tiempo, sim_peso, sim_vol,
                                        int(sim_unid), sim_valor, params=params)
        em = compute_emissions(sim_dist, sim_peso, modo)
        filas.append({
            "Modo": modo,
            "Tiempo (h)": round(tiempo, 1),
            "Tiempo (días)": round(tiempo / 24, 2),
            "Costo transacción": costo["transaction_cost"],
            "Fricción distancia": costo["distance_friction_cost"],
            "Costo envío": costo["shipment_cost"],
            "Costo total": costo["total_cost"],
            "kg CO₂e": em["kg_co2e"],
        })
    sdf = pd.DataFrame(filas)
    st.dataframe(sdf, use_container_width=True, hide_index=True)

    mejor_costo = sdf.loc[sdf["Costo total"].idxmin()]
    mejor_tiempo = sdf.loc[sdf["Tiempo (h)"].idxmin()]
    mejor_co2 = sdf.loc[sdf["kg CO₂e"].idxmin()]
    b1, b2, b3 = st.columns(3)
    b1.metric("💰 Más económico", mejor_costo["Modo"], f"${mejor_costo['Costo total']:,.2f}")
    b2.metric("⏱️ Más rápido", mejor_tiempo["Modo"], f"{mejor_tiempo['Tiempo (h)']:.1f} h")
    b3.metric("🌱 Menos emisiones", mejor_co2["Modo"], f"{mejor_co2['kg CO₂e']:,.1f} kg CO₂e")

    figm = go.Figure()
    figm.add_trace(go.Bar(x=sdf["Modo"], y=sdf["Costo total"], name="Costo total (USD)",
                           marker_color="#2A9D8F"))
    figm.add_trace(go.Scatter(x=sdf["Modo"], y=sdf["kg CO₂e"], name="kg CO₂e", yaxis="y2",
                               mode="lines+markers", line=dict(color="#E76F51", width=3)))
    figm.update_layout(yaxis=dict(title="Costo (USD)"),
                        yaxis2=dict(title="kg CO₂e", overlaying="y", side="right"),
                        height=420, legend=dict(orientation="h", y=1.12))
    st.plotly_chart(figm, use_container_width=True)

    if mejor_costo["Modo"] != mejor_tiempo["Modo"]:
        dif_costo = mejor_tiempo["Costo total"] - mejor_costo["Costo total"]
        dif_horas = mejor_costo["Tiempo (h)"] - mejor_tiempo["Tiempo (h)"]
        if dif_horas > 0:
            st.info(f"Trade-off: pasar de **{mejor_costo['Modo']}** a **{mejor_tiempo['Modo']}** "
                    f"ahorra {dif_horas:,.1f} horas pero cuesta ${dif_costo:,.2f} más, es decir "
                    f"**${dif_costo/dif_horas:,.2f} por hora ganada**.")

# ==========================================================================
# 6. HUELLA DE CARBONO
# ==========================================================================
with tabs[5]:
    st.subheader("🌱 Huella de carbono de la operación")
    st.caption("Emisiones estimadas con factores por tonelada-kilómetro. "
               "Fórmula: kg CO₂e = factor(modo) × toneladas × kilómetros.")

    fdf = pd.DataFrame([{"Modo": m, "kg CO₂e por ton-km": f} for m, f in EMISSION_FACTORS.items()])
    st.dataframe(fdf, use_container_width=True, hide_index=True)

    st.markdown("##### Calcular y registrar la huella de los envíos existentes")
    if st.button("♻️ Recalcular huella de todos los envíos") and require_write_or_warn():
        G = build_graph(nodes, corridors)
        n = 0
        for s in Shipment.all():
            ruta = shortest_path(G, s["origin_node_id"], s["dest_node_id"], weight="distance")
            if not ruta["found"]:
                continue
            em = compute_emissions(ruta["distance_km"], s["weight_kg"], "Terrestre")
            ShipmentEmission(None, s["shipment_id"], "Terrestre", ruta["distance_km"],
                              em["ton_km"], em["kg_co2e"],
                              datetime.now().strftime("%Y-%m-%d %H:%M")).save()
            n += 1
        log_action("UPDATE", "shipment_emissions", "-", f"recalculo masivo de {n} envíos")
        st.success(f"Huella recalculada para {n} envíos.")
        st.rerun()

    emis = ShipmentEmission.all()
    if emis:
        edf = pd.DataFrame(emis)[["shipment_id", "origin_name", "dest_name", "mode",
                                   "distance_km", "weight_kg", "ton_km", "kg_co2e"]]
        edf.columns = ["Envío", "Origen", "Destino", "Modo", "Distancia (km)", "Peso (kg)",
                       "ton-km", "kg CO₂e"]
        st.dataframe(edf, use_container_width=True, hide_index=True)

        t1, t2, t3 = st.columns(3)
        t1.metric("Huella total", f"{edf['kg CO₂e'].sum():,.1f} kg CO₂e")
        t2.metric("Equivalente", f"{edf['kg CO₂e'].sum()/1000:,.2f} ton CO₂e")
        t3.metric("Intensidad media",
                  f"{edf['kg CO₂e'].sum()/edf['ton-km'].sum():.4f} kg/ton-km"
                  if edf["ton-km"].sum() > 0 else "N/D")

        fige = px.bar(edf.sort_values("kg CO₂e", ascending=False),
                       x="Envío", y="kg CO₂e", color="Distancia (km)",
                       color_continuous_scale="Teal",
                       title="Huella de carbono por envío")
        st.plotly_chart(fige, use_container_width=True)

        st.download_button("📊 Exportar huella a Excel",
                            dataframe_to_excel_bytes(edf, "Huella", "Huella de Carbono por Envío"),
                            "huella_carbono.xlsx",
                            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    else:
        st.info("Aún no se ha calculado la huella de ningún envío. Usa el botón de recálculo.")

# ==========================================================================
# 7. HISTORIAL DE COSTOS POR CORREDOR
# ==========================================================================
with tabs[6]:
    st.subheader("📈 Evolución del costo por kilómetro de cada corredor")
    st.caption("Serie temporal del costo unitario y del índice de combustible, para analizar "
               "cómo la volatilidad energética se traslada a la tarifa de transporte.")

    hist = corridor_cost_history()
    if not hist:
        st.info("No hay historial de costos registrado.")
    else:
        hdf = pd.DataFrame(hist)
        hdf["corredor"] = hdf["origin_name"] + " → " + hdf["dest_name"]
        opciones = sorted(hdf["corredor"].unique())
        sel = st.multiselect("Corredores a graficar", options=opciones, default=opciones[:4])
        sub = hdf[hdf["corredor"].isin(sel)] if sel else hdf

        if not sub.empty:
            figh = px.line(sub, x="record_date", y="cost_per_km", color="corredor",
                            markers=True, labels={"record_date": "Fecha",
                                                   "cost_per_km": "Costo por km (USD)",
                                                   "corredor": "Corredor"},
                            title="Costo por km a lo largo del tiempo")
            figh.update_layout(height=430, legend=dict(orientation="h", y=-0.25))
            st.plotly_chart(figh, use_container_width=True)

            figf = px.line(sub, x="record_date", y="fuel_index", color="corredor",
                            labels={"record_date": "Fecha", "fuel_index": "Índice de combustible"},
                            title="Índice de combustible (base 100)")
            figf.update_layout(height=350, showlegend=False)
            st.plotly_chart(figf, use_container_width=True)

            st.markdown("##### Variación por corredor")
            resumen = sub.groupby("corredor").agg(
                inicial=("cost_per_km", "first"), final=("cost_per_km", "last"),
                minimo=("cost_per_km", "min"), maximo=("cost_per_km", "max"),
                promedio=("cost_per_km", "mean")).reset_index()
            resumen["variación %"] = (100 * (resumen["final"] - resumen["inicial"])
                                       / resumen["inicial"]).round(2)
            resumen[["inicial", "final", "minimo", "maximo", "promedio"]] = \
                resumen[["inicial", "final", "minimo", "maximo", "promedio"]].round(3)
            resumen.columns = ["Corredor", "Inicial", "Final", "Mínimo", "Máximo",
                               "Promedio", "Variación %"]
            st.dataframe(resumen, use_container_width=True, hide_index=True)
