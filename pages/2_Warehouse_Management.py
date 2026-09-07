"""
Módulo 1 - Warehouse Management (versión avanzada).

Además del control operativo de inventario (ciclo Inbound/Outbound, alertas de
stock y valoración), incorpora la analítica de planificación:
  - Pronóstico de demanda por SKU (media móvil y suavizado exponencial).
  - EOQ (modelo de Wilson) y Punto de Reorden con stock de seguridad.
  - Clasificación ABC por valor de consumo (Pareto).
  - Ocupación por zona de rotación (mapa de calor).
  - Trazabilidad completa de un SKU.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from datetime import date

from models.warehouse import Warehouse, InventoryItem, WarehouseMovement, rotation_report
from utils.inventory_analytics import (demand_series, best_forecast, moving_average_forecast,
                                       exponential_smoothing_forecast, compute_eoq, compute_rop,
                                       abc_classification, zone_occupancy, sku_traceability)
from utils.report_exporter import dataframe_to_excel_bytes, dataframe_to_pdf_bytes
from utils.auth import login_form, render_sidebar_user, require_write_or_warn
from utils.audit import log_action

st.set_page_config(page_title="Warehouse Management", page_icon="📦", layout="wide")

if not login_form():
    st.stop()
render_sidebar_user()

st.title("📦 Warehouse Management")
st.caption("Freight Distribution Cluster: ciclo Inbound (recepción/inspección) y "
           "Outbound (picking/empaque/despacho), más analítica de planificación de inventario.")

tabs = st.tabs(["📋 Inventario", "➕ Movimientos", "🚨 Alertas de stock", "📊 Rotación",
                "🔮 Pronóstico", "🧮 EOQ y ROP", "🔤 Clasificación ABC",
                "🗄️ Ocupación por zona", "🔎 Trazabilidad"])

# ==========================================================================
# 1. INVENTARIO
# ==========================================================================
with tabs[0]:
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
        m1, m2 = st.columns(2)
        m1.metric("Valoración total", f"${df['Valoración'].sum():,.0f}")
        m2.metric("SKUs listados", len(df))

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

# ==========================================================================
# 2. MOVIMIENTOS
# ==========================================================================
with tabs[1]:
    st.subheader("Registrar movimiento de inventario")
    items_all = InventoryItem.all()
    if not items_all:
        st.warning("Registra primero ítems de inventario.")
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
            if submitted and qty > 0 and require_write_or_warn():
                WarehouseMovement(None, item_id, mtype, qty, mdate.strftime("%Y-%m-%d"), ref).save()
                log_action("INSERT", "warehouse_movements", str(item_id), f"{mtype} x{qty}")
                st.success("Movimiento registrado y stock actualizado.")
                st.rerun()

    st.subheader("Historial de movimientos")
    moves = WarehouseMovement.all()
    if moves:
        mdf = pd.DataFrame(moves)[["movement_date", "sku", "item_name", "movement_type",
                                    "quantity", "reference"]]
        mdf.columns = ["Fecha", "SKU", "Producto", "Tipo", "Cantidad", "Referencia"]
        st.dataframe(mdf, use_container_width=True, hide_index=True)

# ==========================================================================
# 3. ALERTAS DE STOCK
# ==========================================================================
with tabs[2]:
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

# ==========================================================================
# 4. ROTACIÓN
# ==========================================================================
with tabs[3]:
    st.subheader("📊 Rotación de inventario y valoración de existencias")
    rep = rotation_report()
    if rep:
        rdf = pd.DataFrame(rep)
        rdf.columns = ["SKU", "Producto", "Zona", "node_id", "Almacén", "Unidades Despachadas",
                       "Stock Actual", "Costo Unitario", "Valoración"]
        rdf = rdf.drop(columns=["node_id"])
        st.dataframe(rdf, use_container_width=True, hide_index=True)
        st.metric("Valoración total de inventario", f"${rdf['Valoración'].sum():,.0f}")
        fig = px.bar(rdf.sort_values("Unidades Despachadas", ascending=False),
                     x="SKU", y="Unidades Despachadas", color="Zona",
                     color_discrete_sequence=px.colors.qualitative.Set2,
                     title="Unidades despachadas por SKU")
        st.plotly_chart(fig, use_container_width=True)
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

# ==========================================================================
# 5. PRONÓSTICO DE DEMANDA
# ==========================================================================
with tabs[4]:
    st.subheader("🔮 Pronóstico de demanda por SKU")
    st.caption("Media móvil simple (SMA) y suavizado exponencial simple (SES) sobre el historial "
               "de despachos. Se recomienda el método con menor error absoluto medio (MAE).")
    items_all = InventoryItem.all()
    if not items_all:
        st.info("No hay ítems registrados.")
    else:
        item_map = {i["item_id"]: f"{i['sku']} - {i['name']}" for i in items_all}
        c1, c2, c3 = st.columns(3)
        item_id = c1.selectbox("SKU", options=list(item_map.keys()),
                                format_func=lambda x: item_map[x], key="fc_item")
        window = c2.slider("Ventana de media móvil (n)", 2, 6, 3)
        alpha = c3.slider("Alpha del suavizado (α)", 0.05, 0.95, 0.30, 0.05)

        serie = demand_series(item_id)
        if serie.empty or len(serie) < 2:
            st.warning("Este SKU no tiene suficiente historial de despachos para pronosticar "
                       "(se requieren al menos 2 movimientos 'Outbound-Despacho').")
        else:
            valores = serie["demanda"].astype(float).tolist()
            comp = best_forecast(valores, window=window, alpha=alpha)
            sma, ses = comp["sma"], comp["ses"]

            m1, m2, m3 = st.columns(3)
            m1.metric(f"Pronóstico {sma['method']}", sma["forecast"], help=f"MAE = {sma['mae']}")
            m2.metric(f"Pronóstico {ses['method']}", ses["forecast"], help=f"MAE = {ses['mae']}")
            m3.metric("Método recomendado", comp["mejor_metodo"], help="El de menor MAE histórico")

            fechas = serie["fecha"].tolist()
            fig = go.Figure()
            fig.add_trace(go.Scatter(x=fechas, y=valores, mode="lines+markers",
                                      name="Demanda real", line=dict(color="#264653", width=3)))
            if sma["fitted"]:
                fig.add_trace(go.Scatter(x=fechas[-len(sma["fitted"]):], y=sma["fitted"],
                                          mode="lines", name=f"Ajuste {sma['method']}",
                                          line=dict(color="#2A9D8F", dash="dash")))
            if ses["fitted"]:
                fig.add_trace(go.Scatter(x=fechas[-len(ses["fitted"]):], y=ses["fitted"],
                                          mode="lines", name=f"Ajuste {ses['method']}",
                                          line=dict(color="#E76F51", dash="dot")))
            fig.update_layout(height=420, xaxis_title="Fecha", yaxis_title="Unidades despachadas",
                              legend=dict(orientation="h", y=1.12))
            st.plotly_chart(fig, use_container_width=True)

            mejor_val = sma["forecast"] if comp["mejor_metodo"] == sma["method"] else ses["forecast"]
            st.info(f"Pronóstico para el siguiente período según **{comp['mejor_metodo']}**: "
                    f"**{mejor_val}** unidades.")

# ==========================================================================
# 6. EOQ Y PUNTO DE REORDEN
# ==========================================================================
with tabs[5]:
    st.subheader("🧮 Cantidad Económica de Pedido (EOQ) y Punto de Reorden (ROP)")
    st.latex(r"EOQ = \sqrt{\frac{2 D S}{H}} \qquad\qquad ROP = d \cdot L + z \cdot \sigma_d \cdot \sqrt{L}")
    st.caption("D = demanda anual · S = costo por pedido · H = costo de mantener una unidad al año · "
               "d = demanda diaria promedio · L = lead time · σ_d = desviación de la demanda diaria · "
               "z = factor de la normal (una cola) asociado al nivel de servicio.")

    items_all = InventoryItem.all()
    item_map = {i["item_id"]: f"{i['sku']} - {i['name']}" for i in items_all} if items_all else {}
    sel = st.selectbox("SKU de referencia (precarga su costo unitario)",
                        options=[None] + list(item_map.keys()),
                        format_func=lambda x: "Entrada manual" if x is None else item_map[x],
                        key="eoq_item")
    costo_unit = 100.0
    if sel is not None:
        costo_unit = float([i for i in items_all if i["item_id"] == sel][0]["unit_cost"])

    st.markdown("##### Parámetros EOQ")
    c1, c2, c3 = st.columns(3)
    D = c1.number_input("Demanda anual (D, unidades)", min_value=1.0, value=1200.0, step=50.0)
    S = c2.number_input("Costo por pedido (S, USD)", min_value=0.01, value=100.0, step=5.0)
    tasa = c3.number_input("Tasa de mantenimiento anual (% del costo unitario)",
                           min_value=0.1, value=20.0, step=1.0)
    H = costo_unit * tasa / 100.0
    st.caption(f"Costo unitario de referencia = ${costo_unit:,.2f} → H = ${H:,.2f} por unidad/año")

    eoq = compute_eoq(D, S, H)
    e1, e2, e3, e4 = st.columns(4)
    e1.metric("EOQ (Q*)", f"{eoq['eoq']:,.1f} u")
    e2.metric("Pedidos por año", f"{eoq['pedidos_por_anio']:,.2f}")
    e3.metric("Días entre pedidos", f"{eoq['dias_entre_pedidos']:,.1f}")
    e4.metric("Costo total anual", f"${eoq['costo_total_anual']:,.2f}")
    st.caption("Propiedad del óptimo de Wilson: en Q* el costo anual de pedidos iguala al de "
               f"mantenimiento (${eoq['costo_pedidos_anual']:,.2f} vs ${eoq['costo_mantenimiento_anual']:,.2f}).")

    paso = max(int(eoq["eoq"] / 40), 1)
    qs = list(range(max(int(eoq["eoq"] * 0.2), 1), max(int(eoq["eoq"] * 2.2), 3), paso))
    curva = pd.DataFrame({"Q": qs,
                          "Costo de pedidos": [D / q * S for q in qs],
                          "Costo de mantenimiento": [q / 2 * H for q in qs]})
    curva["Costo total"] = curva["Costo de pedidos"] + curva["Costo de mantenimiento"]
    figq = go.Figure()
    for col, color, w in [("Costo de pedidos", "#2A9D8F", 2), ("Costo de mantenimiento", "#E9C46A", 2),
                           ("Costo total", "#E76F51", 3)]:
        figq.add_trace(go.Scatter(x=curva["Q"], y=curva[col], name=col, line=dict(color=color, width=w)))
    figq.add_vline(x=eoq["eoq"], line_dash="dash", line_color="#264653",
                    annotation_text=f"Q* = {eoq['eoq']:.0f}")
    figq.update_layout(height=400, xaxis_title="Tamaño de pedido (Q)",
                        yaxis_title="Costo anual (USD)", legend=dict(orientation="h", y=1.12))
    st.plotly_chart(figq, use_container_width=True)

    st.divider()
    st.markdown("##### Parámetros del Punto de Reorden")
    r1, r2, r3, r4 = st.columns(4)
    d_diaria = r1.number_input("Demanda diaria promedio (d)", min_value=0.0, value=round(D / 365, 2))
    lead = r2.number_input("Lead time (L, días)", min_value=0.0, value=7.0)
    sigma = r3.number_input("Desviación estándar diaria (σ_d)", min_value=0.0, value=1.5)
    ns = r4.select_slider("Nivel de servicio (%)",
                          options=[50, 75, 80, 85, 90, 95, 97.5, 98, 99, 99.5], value=95)

    rop = compute_rop(d_diaria, lead, sigma, ns)
    p1, p2, p3, p4 = st.columns(4)
    p1.metric("Punto de Reorden", f"{rop['rop']:,.2f} u")
    p2.metric("Demanda en lead time", f"{rop['demanda_durante_lead_time']:,.2f} u")
    p3.metric("Stock de seguridad", f"{rop['stock_seguridad']:,.2f} u")
    p4.metric("Factor z aplicado", rop["z_utilizado"])
    st.info(f"Política resultante: pedir **{eoq['eoq']:,.0f} unidades** cuando el inventario baje a "
            f"**{rop['rop']:,.0f} unidades**. Eso cubre la demanda esperada del lead time más un "
            f"colchón de {rop['stock_seguridad']:,.0f} unidades para un nivel de servicio del {ns}%.")

# ==========================================================================
# 7. CLASIFICACIÓN ABC
# ==========================================================================
with tabs[6]:
    st.subheader("🔤 Clasificación ABC por valor de consumo (Pareto)")
    c1, c2 = st.columns(2)
    a_cut = c1.slider("Corte clase A (% acumulado)", 50.0, 90.0, 80.0, 1.0)
    b_cut = c2.slider("Corte clase B (% acumulado)", float(a_cut + 1), 99.0,
                      float(max(95.0, a_cut + 1)), 1.0)

    abc = abc_classification(a_cut=a_cut, b_cut=b_cut)
    if not abc:
        st.info("No hay ítems para clasificar.")
    else:
        adf = pd.DataFrame(abc)
        show = adf[["sku", "name", "warehouse_name", "zone", "despachos", "unit_cost",
                    "valor_consumo", "pct", "pct_acumulado", "base", "clase"]].copy()
        show.columns = ["SKU", "Producto", "Almacén", "Zona", "Despachos", "Costo Unit.",
                        "Valor de Consumo", "% Individual", "% Acumulado", "Base de cálculo", "Clase"]

        def color_clase(row):
            colors = {"A": "#D5F5E3", "B": "#FCF3CF", "C": "#FADBD8"}
            return [f"background-color: {colors.get(row['Clase'], '')}"] * len(row)

        st.dataframe(show.style.apply(color_clase, axis=1), use_container_width=True, hide_index=True)

        k1, k2, k3 = st.columns(3)
        for col, clase in zip((k1, k2, k3), ("A", "B", "C")):
            sub = adf[adf["clase"] == clase]
            col.metric(f"Clase {clase}", f"{len(sub)} SKU", f"{sub['pct'].sum():.1f}% del valor")

        figp = go.Figure()
        figp.add_trace(go.Bar(x=adf["sku"], y=adf["valor_consumo"], name="Valor de consumo",
                               marker_color="#2A9D8F"))
        figp.add_trace(go.Scatter(x=adf["sku"], y=adf["pct_acumulado"], name="% acumulado",
                                   yaxis="y2", line=dict(color="#E76F51", width=3), mode="lines+markers"))
        figp.update_layout(yaxis=dict(title="Valor de consumo (USD)"),
                            yaxis2=dict(title="% acumulado", overlaying="y", side="right", range=[0, 105]),
                            height=450, legend=dict(orientation="h", y=1.12), xaxis_title="SKU")
        st.plotly_chart(figp, use_container_width=True)

        n_proxy = int((adf["base"] == "Stock (sin despachos)").sum())
        if n_proxy:
            st.warning(f"⚠️ {n_proxy} SKU no tienen despachos registrados y se clasificaron usando el "
                       "valor del stock en mano como aproximación. Su posición en el Pareto todavía no "
                       "está respaldada por demanda real.")

        st.download_button("📊 Exportar ABC a Excel",
                            dataframe_to_excel_bytes(show, "ABC", "Clasificación ABC de Inventario"),
                            "clasificacion_abc.xlsx",
                            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")

# ==========================================================================
# 8. OCUPACIÓN POR ZONA
# ==========================================================================
with tabs[7]:
    st.subheader("🗄️ Ocupación por zona de rotación")
    st.caption("Distribución del inventario entre las zonas de estantería de Alta, Media y Baja rotación.")
    occ = zone_occupancy()
    if not occ:
        st.info("No hay datos de ocupación.")
    else:
        odf = pd.DataFrame(occ)
        metrica = st.radio("Métrica del mapa de calor", ["unidades", "valor"], horizontal=True,
                           format_func=lambda x: "Unidades" if x == "unidades" else "Valor (USD)")
        pivot = odf.pivot_table(index="almacen", columns="zona", values=metrica,
                                 aggfunc="sum", fill_value=0)
        figh = px.imshow(pivot, text_auto=".0f", aspect="auto", color_continuous_scale="Teal",
                          labels=dict(x="Zona de rotación", y="Almacén",
                                      color="Unidades" if metrica == "unidades" else "USD"))
        figh.update_layout(height=380)
        st.plotly_chart(figh, use_container_width=True)

        disp = odf.copy()
        disp.columns = ["Almacén", "Zona", "Unidades", "Valor (USD)", "SKUs"]
        st.dataframe(disp, use_container_width=True, hide_index=True)

        figz = px.sunburst(disp, path=["Almacén", "Zona"], values="Valor (USD)",
                            color="Zona", color_discrete_sequence=px.colors.qualitative.Set2,
                            title="Composición del valor de inventario por almacén y zona")
        st.plotly_chart(figz, use_container_width=True)

# ==========================================================================
# 9. TRAZABILIDAD
# ==========================================================================
with tabs[8]:
    st.subheader("🔎 Trazabilidad completa de un SKU")
    items_all = InventoryItem.all()
    if not items_all:
        st.info("No hay ítems registrados.")
    else:
        item_map = {i["item_id"]: f"{i['sku']} - {i['name']}" for i in items_all}
        item_id = st.selectbox("SKU a rastrear", options=list(item_map.keys()),
                                format_func=lambda x: item_map[x], key="trace_item")
        traza = sku_traceability(item_id)
        if not traza:
            st.info("Este SKU no tiene movimientos registrados.")
        else:
            tdf = pd.DataFrame(traza)
            disp = tdf[["movement_date", "movement_type", "quantity", "delta",
                        "saldo_acumulado", "reference"]].copy()
            disp.columns = ["Fecha", "Tipo de movimiento", "Cantidad", "Efecto en stock",
                            "Saldo acumulado", "Referencia"]

            def color_flujo(row):
                color = "#D5F5E3" if row["Efecto en stock"] > 0 else "#FADBD8"
                return [f"background-color: {color}"] * len(row)

            st.dataframe(disp.style.apply(color_flujo, axis=1), use_container_width=True, hide_index=True)

            figt = go.Figure()
            figt.add_trace(go.Scatter(x=tdf["movement_date"], y=tdf["saldo_acumulado"],
                                       mode="lines+markers", name="Saldo acumulado",
                                       line=dict(color="#2A9D8F", width=3), fill="tozeroy"))
            figt.update_layout(height=380, xaxis_title="Fecha", yaxis_title="Unidades en stock",
                                title="Evolución del saldo de inventario")
            st.plotly_chart(figt, use_container_width=True)

            st.download_button("📊 Exportar trazabilidad",
                                dataframe_to_excel_bytes(disp, "Trazabilidad",
                                                         f"Trazabilidad de {item_map[item_id]}"),
                                "trazabilidad.xlsx",
                                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
