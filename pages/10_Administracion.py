"""
Administración: gestión de usuarios y roles, registro de auditoría y
parámetros configurables del sistema. Solo accesible para el rol admin.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import streamlit as st
import pandas as pd
import plotly.express as px

from utils.auth import (login_form, render_sidebar_user, has_role, list_users,
                          create_user, set_user_active, change_password, ROLE_LEVEL)
from utils.audit import get_audit_log, audit_summary, log_action
from database.db import run_query, run_write
from utils.report_exporter import dataframe_to_excel_bytes

st.set_page_config(page_title="Administración", page_icon="⚙️", layout="wide")

from database.db import ensure_database_ready
ensure_database_ready()

from utils.theme import apply_page_theme
apply_page_theme()

if not login_form():
    st.stop()
render_sidebar_user()

st.title("⚙️ Administración del Sistema")

if not has_role("admin"):
    st.error("🔒 Esta sección requiere rol de administrador.")
    st.stop()

tab1, tab2, tab3 = st.tabs(["👥 Usuarios y roles", "📜 Auditoría", "🎛️ Parámetros"])

# ==========================================================================
# USUARIOS
# ==========================================================================
with tab1:
    st.subheader("Usuarios registrados")
    usuarios = list_users()
    if usuarios:
        udf = pd.DataFrame(usuarios)
        udf.columns = ["ID", "Usuario", "Nombre completo", "Rol", "Activo", "Creado"]
        udf["Activo"] = udf["Activo"].map({1: "Sí", 0: "No"})
        st.dataframe(udf, use_container_width=True, hide_index=True)

    st.divider()
    st.markdown("#### Crear nuevo usuario")
    with st.form("nuevo_usuario"):
        c1, c2 = st.columns(2)
        username = c1.text_input("Nombre de usuario")
        full_name = c2.text_input("Nombre completo")
        c3, c4 = st.columns(2)
        password = c3.text_input("Contraseña", type="password")
        role = c4.selectbox("Rol", options=list(ROLE_LEVEL.keys()))
        st.caption("**lector**: solo consulta · **operador**: consulta y registro · "
                   "**admin**: control total del sistema")
        if st.form_submit_button("Crear usuario", type="primary"):
            if not username or not password or not full_name:
                st.error("Todos los campos son obligatorios.")
            elif len(password) < 6:
                st.error("La contraseña debe tener al menos 6 caracteres.")
            else:
                existe = run_query("SELECT 1 FROM users WHERE username = ?", (username,))
                if not existe.empty:
                    st.error(f"El usuario '{username}' ya existe.")
                else:
                    uid = create_user(username, full_name, password, role)
                    log_action("INSERT", "users", str(uid), f"Usuario creado: {username} ({role})")
                    st.success(f"Usuario '{username}' creado con rol {role}.")
                    st.rerun()

    st.divider()
    st.markdown("#### Activar / desactivar usuario")
    if usuarios:
        user_map = {u["user_id"]: f"{u['username']} ({u['role']})" for u in usuarios}
        c5, c6 = st.columns(2)
        uid_sel = c5.selectbox("Usuario", options=list(user_map.keys()),
                                format_func=lambda x: user_map[x])
        accion = c6.selectbox("Acción", options=["Activar", "Desactivar"])
        if st.button("Aplicar"):
            set_user_active(uid_sel, 1 if accion == "Activar" else 0)
            log_action("UPDATE", "users", str(uid_sel), f"{accion} usuario")
            st.success(f"Usuario {accion.lower()}do.")
            st.rerun()

        st.markdown("#### Cambiar contraseña")
        c7, c8 = st.columns(2)
        uid_pwd = c7.selectbox("Usuario a modificar", options=list(user_map.keys()),
                                format_func=lambda x: user_map[x], key="pwd_user")
        nueva = c8.text_input("Nueva contraseña", type="password", key="pwd_new")
        if st.button("Cambiar contraseña"):
            if len(nueva) < 6:
                st.error("La contraseña debe tener al menos 6 caracteres.")
            else:
                change_password(uid_pwd, nueva)
                log_action("UPDATE", "users", str(uid_pwd), "Cambio de contrasena")
                st.success("Contraseña actualizada.")

# ==========================================================================
# AUDITORÍA
# ==========================================================================
with tab2:
    st.subheader("Registro de auditoría")
    resumen = audit_summary()
    st.metric("Total de acciones registradas", resumen["total"])

    if resumen["total"] > 0:
        g1, g2 = st.columns(2)
        with g1:
            st.markdown("**Acciones por tipo**")
            acc_df = pd.DataFrame(resumen["by_action"])
            fig = px.bar(acc_df, x="action", y="n", color="action", text_auto=True,
                          color_discrete_sequence=px.colors.qualitative.Set2)
            fig.update_layout(showlegend=False, height=300)
            st.plotly_chart(fig, use_container_width=True)
        with g2:
            st.markdown("**Acciones por usuario**")
            usr_df = pd.DataFrame(resumen["by_user"])
            fig2 = px.pie(usr_df, names="username", values="n", hole=0.4)
            fig2.update_layout(height=300)
            st.plotly_chart(fig2, use_container_width=True)

    st.divider()
    f1, f2, f3 = st.columns(3)
    usuarios_log = [u["username"] for u in resumen["by_user"]]
    filtro_user = f1.selectbox("Filtrar por usuario", options=["Todos"] + usuarios_log)
    tablas = run_query("SELECT DISTINCT table_name FROM audit_log")["table_name"].tolist() \
        if resumen["total"] > 0 else []
    filtro_tabla = f2.selectbox("Filtrar por tabla", options=["Todas"] + tablas)
    limite = f3.number_input("Máximo de registros", min_value=10, max_value=2000, value=200, step=10)

    log = get_audit_log(limit=int(limite),
                         username=None if filtro_user == "Todos" else filtro_user,
                         table_name=None if filtro_tabla == "Todas" else filtro_tabla)
    if log:
        ldf = pd.DataFrame(log)[["timestamp", "username", "action", "table_name", "record_id", "detail"]]
        ldf.columns = ["Fecha y hora", "Usuario", "Acción", "Tabla", "Registro", "Detalle"]
        st.dataframe(ldf, use_container_width=True, hide_index=True)
        st.download_button("📊 Exportar auditoría a Excel",
                            dataframe_to_excel_bytes(ldf, "Auditoria", "Registro de Auditoría"),
                            "auditoria.xlsx",
                            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    else:
        st.info("Aún no hay acciones registradas en la auditoría.")

# ==========================================================================
# PARÁMETROS DEL SISTEMA
# ==========================================================================
with tab3:
    st.subheader("Parámetros configurables")
    st.caption("Estos valores alimentan los cálculos de EOQ, ROP, TCO, mantenimiento "
               "y el control de acceso. Modificarlos afecta a todos los módulos.")

    params = run_query("SELECT * FROM system_params ORDER BY param_key").to_dict(orient="records")
    if params:
        for p in params:
            with st.container(border=True):
                c1, c2, c3 = st.columns([2, 2, 1])
                c1.markdown(f"**{p['param_key']}**")
                c1.caption(p["description"] or "")
                nuevo = c2.text_input("Valor", value=str(p["param_value"]),
                                       key=f"param_{p['param_key']}", label_visibility="collapsed")
                if c3.button("Guardar", key=f"btn_{p['param_key']}"):
                    run_write("UPDATE system_params SET param_value = ? WHERE param_key = ?",
                               (nuevo, p["param_key"]))
                    log_action("UPDATE", "system_params", p["param_key"],
                                f"{p['param_value']} -> {nuevo}")
                    st.success(f"Parámetro {p['param_key']} actualizado.")
                    st.rerun()

    st.divider()
    st.warning("**AUTH_ENABLED**: si lo pones en `true`, todos los usuarios deberán iniciar "
               "sesión para usar la aplicación. Con `false` (por defecto) la app funciona en "
               "modo demo con acceso libre de administrador.", icon="🔐")
