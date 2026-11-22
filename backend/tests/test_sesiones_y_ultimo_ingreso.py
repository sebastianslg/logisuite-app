"""
Último ingreso por cuenta (lo que ve Administración) y «Mis sesiones» (listar y cerrar las demás).

Comprueba también lo que NO debe pasar: la lista trae solo las sesiones de la cuenta que pregunta, el id de cada sesión
no es el token, cerrar las demás no toca las de otra cuenta, sin sesión ambas rutas responden 401 y la base no guarda la
IP ni cabeceras completas (solo el User-Agent recortado a 200 caracteres).

La migración v19 (`users.last_login_at`, `user_sessions.user_agent`) se prueba dos veces sobre una base de antes para
vigilar que sea aditiva e idempotente.
"""
import hashlib
import re
import sqlite3
from datetime import datetime

import pytest
from fastapi.testclient import TestClient

import app.database.db as db
import app.init_db as init_db
from app.database.schema_v19 import apply_v19_migration
from app.engine import auth_otp

CLAVE = "clave-de-prueba-123"
UA_EDGE = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) "
           "Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0")
UA_FIREFOX = "Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0"
UA_IPHONE = ("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) "
             "Version/17.0 Mobile/15E148 Safari/604.1")
FECHA = re.compile(r"^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$")


@pytest.fixture(scope="module")
def client(tmp_path_factory):
    """Base temporal con la semilla y dos cuentas: «profesor» (administrador) y «ajena» (otra persona)."""
    path = str(tmp_path_factory.mktemp("sesiones") / "sesiones.db")
    mp = pytest.MonkeyPatch()
    mp.setattr(db, "DB_PATH", path)
    mp.setattr(init_db, "DB_PATH", path)
    mp.setenv("WESTVANE_DEV_OTP", "1")          # solo pruebas: el código viaja en la respuesta
    mp.setenv("WESTVANE_OTP_COOLDOWN_S", "0")
    mp.delenv("SMTP_HOST", raising=False)
    mp.delenv("ADMIN_EMAIL", raising=False)
    from app import main
    main.network.cache_clear()
    main._last_sync = 0.0
    with TestClient(main.app) as c:
        auth_otp.set_password_account("profesor", CLAVE, "Profesor de prueba", "admin")
        auth_otp.set_password_account("ajena", "otra-clave-larga-1", "Otra cuenta", "lector", "ajena@ejemplo.invalid")
        yield c
    main.network.cache_clear()
    mp.undo()


def login(client, ident: str = "profesor", pw: str = CLAVE, ua: str = UA_EDGE):
    """Ingreso con contraseña con el User-Agent indicado (el que la petición llevaría en el navegador)."""
    return client.post("/api/auth/password", json={"identifier": ident, "password": pw}, headers={"User-Agent": ua})


def token_de(client, ident: str = "profesor", pw: str = CLAVE, ua: str = UA_EDGE) -> tuple[str, dict]:
    """Token de una sesión nueva y su cabecera Authorization."""
    res = login(client, ident, pw, ua)
    assert res.status_code == 200, res.text
    token = res.json()["token"]
    return token, {"Authorization": f"Bearer {token}"}


def etiqueta(token: str) -> str:
    """El id que la lista debe mostrar para una sesión: sha256 de los primeros 16 caracteres del token."""
    return hashlib.sha256(token[:16].encode()).hexdigest()


def usuario_id(username: str) -> int:
    return int(db.fetch_all("SELECT user_id FROM users WHERE username = ?", (username,))[0]["user_id"])


def usuarios(client, headers: dict) -> dict[str, dict]:
    res = client.get("/api/admin/users", headers=headers)
    assert res.status_code == 200, res.text
    return {u["username"]: u for u in res.json()["items"]}


# ---------------------------------------------------------------------------
# Nombre legible del navegador
# ---------------------------------------------------------------------------

CASOS_NAVEGADOR = [
    (UA_EDGE, "Edge en Windows"),
    ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) "
     "Chrome/120.0.0.0 Safari/537.36", "Chrome en Windows"),
    ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) "
     "Version/17.0 Safari/605.1.15", "Safari en macOS"),
    (UA_IPHONE, "Safari en iPhone"),
    ("Mozilla/5.0 (iPad; CPU OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) "
     "Version/16.6 Mobile/15E148 Safari/604.1", "Safari en iPad"),
    ("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) "
     "Chrome/120.0.0.0 Mobile Safari/537.36", "Chrome en Android"),
    (UA_FIREFOX, "Firefox en Linux"),
    ("Mozilla/5.0 (Android 14; Mobile; rv:121.0) Gecko/121.0 Firefox/121.0", "Firefox en Android"),
    ("curl/8.4.0", "Navegador desconocido"),
    ("", "Navegador desconocido"),
]


@pytest.mark.parametrize("ua,esperado", CASOS_NAVEGADOR)
def test_resumir_navegador_con_user_agents_reales(ua, esperado):
    """Reglas simples pero en orden: Edge/Chrome/Safari se contienen, y Android e iPhone dicen «Linux» y «Mac»."""
    assert auth_otp.resumir_navegador(ua) == esperado


def test_resumir_navegador_sin_sistema_reconocido_solo_dice_el_navegador():
    assert auth_otp.resumir_navegador("curl-like Chrome/120.0.0.0") == "Chrome"
    assert auth_otp.resumir_navegador(None) == "Navegador desconocido"


# ---------------------------------------------------------------------------
# Mis sesiones: listar
# ---------------------------------------------------------------------------

def test_lista_solo_mi_cuenta_y_la_actual_primero(client):
    t1, _ = token_de(client, ua=UA_EDGE)
    t2, h2 = token_de(client, ua=UA_FIREFOX)
    t_otra, _ = token_de(client, "ajena", "otra-clave-larga-1", ua=UA_IPHONE)

    res = client.get("/api/auth/sessions", headers=h2)
    assert res.status_code == 200, res.text
    items = res.json()["items"]

    # Solo las sesiones de «profesor»: la de la otra cuenta no aparece por ningún lado
    ahora = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    propias = {r["session_id"] for r in db.fetch_all(
        "SELECT session_id FROM user_sessions WHERE user_id = ? AND expires_at >= ?", (usuario_id("profesor"), ahora))}
    assert {i["id"] for i in items} == {etiqueta(s) for s in propias}
    assert etiqueta(t_otra) not in {i["id"] for i in items}

    # La actual primero y marcada; las demás, no
    assert items[0]["current"] is True and items[0]["id"] == etiqueta(t2)
    assert [i["current"] for i in items].count(True) == 1
    assert items[0]["browser"] == "Firefox en Linux"
    assert any(i["browser"] == "Edge en Windows" for i in items[1:])
    for i in items:
        assert FECHA.match(i["created_at"]) and FECHA.match(i["expires_at"])
        assert len(i["id"]) == 64 and re.fullmatch(r"[0-9a-f]{64}", i["id"])

    # Ni el token ni la IP (ni el nombre del cliente de las pruebas) viajan en la respuesta
    assert t1 not in res.text and t2 not in res.text
    assert "testclient" not in res.text and "127.0.0.1" not in res.text


def test_el_id_no_es_el_token_y_la_cookie_tambien_sirve(client):
    token, _ = token_de(client)
    client.cookies.set("westvane_session", token)
    try:
        res = client.get("/api/auth/sessions")
    finally:
        client.cookies.clear()
    assert res.status_code == 200, res.text
    actual = res.json()["items"][0]
    assert actual["current"] is True
    assert actual["id"] != token and token[:16] not in actual["id"]
    assert actual["id"] == etiqueta(token)


def test_sin_sesion_las_dos_rutas_responden_401(client):
    assert client.get("/api/auth/sessions").status_code == 401
    assert client.post("/api/auth/sessions/close-others").status_code == 401
    falso = {"Authorization": "Bearer token-que-no-existe"}
    assert client.get("/api/auth/sessions", headers=falso).status_code == 401
    assert client.post("/api/auth/sessions/close-others", headers=falso).status_code == 401
    client.cookies.set("westvane_session", "token-que-no-existe")
    try:
        assert client.get("/api/auth/sessions").status_code == 401
    finally:
        client.cookies.clear()


# ---------------------------------------------------------------------------
# Mis sesiones: cerrar las demás
# ---------------------------------------------------------------------------

def test_cerrar_las_demas_cierra_solo_las_de_mi_cuenta(client):
    t1, h1 = token_de(client)
    t2, h2 = token_de(client)
    t_otra, h_otra = token_de(client, "ajena", "otra-clave-larga-1")
    t_otra2, h_otra2 = token_de(client, "ajena", "otra-clave-larga-1")

    vivas = len(db.fetch_all("SELECT 1 FROM user_sessions WHERE user_id = ?", (usuario_id("profesor"),)))
    res = client.post("/api/auth/sessions/close-others", headers=h1)
    assert res.status_code == 200, res.text
    assert res.json() == {"closed": vivas - 1}

    # La sesión que pidió el cierre sigue; las demás de la cuenta, no
    assert client.get("/api/auth/me", headers=h1).status_code == 200
    assert client.get("/api/auth/me", headers=h2).status_code == 401
    # Y las de la otra cuenta siguen intactas
    assert client.get("/api/auth/me", headers=h_otra).status_code == 200
    assert client.get("/api/auth/me", headers=h_otra2).status_code == 200

    # El historial deja la acción sin tokens ni contraseñas
    log = db.fetch_all("SELECT detail FROM audit_log WHERE detail LIKE 'Cierre de las demás sesiones%' "
                       "ORDER BY audit_id DESC LIMIT 1")
    assert log and "Cierre de las demás sesiones" in log[0]["detail"]
    assert t1 not in log[0]["detail"] and t2 not in log[0]["detail"] and CLAVE not in log[0]["detail"]

    # Repetir el cierre no falla y ya no hay nada más que cerrar
    assert client.post("/api/auth/sessions/close-others", headers=h1).json() == {"closed": 0}


# ---------------------------------------------------------------------------
# Último ingreso, fallos y bloqueo en la lista de Administración
# ---------------------------------------------------------------------------

def test_la_lista_de_administracion_trae_ultimo_ingreso_fallos_y_bloqueo(client):
    auth_otp.create_user_record("nunca.entro@ejemplo.invalid", "Nunca Entró", "lector")
    # Se fuerza un último ingreso viejo: al entrar debe quedar el de ahora
    db.run_write("UPDATE users SET last_login_at = '2020-01-01 00:00:00' WHERE username = 'profesor'")
    _, h = token_de(client)

    filas = usuarios(client, h)
    profe = filas["profesor"]
    assert FECHA.match(profe["last_login_at"] or "") and profe["last_login_at"] > "2020-01-01 00:00:00"
    assert profe["failed_logins"] == 0 and profe["locked"] is False
    assert isinstance(profe["failed_logins"], int) and isinstance(profe["locked"], bool)
    assert "locked_until" not in profe
    # Una cuenta creada y que nunca entró: sin último ingreso
    assert filas["nunca.entro"]["last_login_at"] is None
    assert filas["nunca.entro"]["failed_logins"] == 0 and filas["nunca.entro"]["locked"] is False

    # Dos fallos con contraseña: se cuentan, todavía sin bloqueo, y no pisan el último ingreso
    auth_otp.set_password_account("falla", "clave-buena-12345", "Falla", "lector")
    for _ in range(2):
        assert login(client, "falla", "mala-mala-mala").status_code == 422
    falla = usuarios(client, h)["falla"]
    assert falla["failed_logins"] == 2 and falla["locked"] is False and falla["last_login_at"] is None
    assert usuarios(client, h)["profesor"]["last_login_at"] == profe["last_login_at"]

    # Al llegar al máximo la cuenta queda bloqueada; el contador se reinicia al bloquear
    for _ in range(auth_otp.MAX_PASSWORD_FAILURES - 2):
        assert login(client, "falla", "mala-mala-mala").status_code == 422
    falla = usuarios(client, h)["falla"]
    assert falla["locked"] is True and falla["failed_logins"] == 0


def test_el_codigo_al_correo_tambien_anota_el_ingreso_y_el_navegador(client):
    auth_otp.create_user_record("por.codigo@ejemplo.invalid", "Por Código", "lector")
    db.run_write("UPDATE users SET last_login_at = NULL WHERE username = 'por.codigo'")
    pedido = client.post("/api/auth/otp/request", json={"email": "por.codigo@ejemplo.invalid"}).json()
    res = client.post("/api/auth/otp/verify", json={"email": "por.codigo@ejemplo.invalid", "code": pedido["dev_code"]},
                      headers={"User-Agent": UA_IPHONE})
    assert res.status_code == 200, res.text
    token = res.json()["token"]

    fila = db.fetch_all("SELECT user_agent FROM user_sessions WHERE session_id = ?", (token,))[0]
    assert fila["user_agent"] == UA_IPHONE
    ultimo = db.fetch_all("SELECT last_login_at FROM users WHERE username = 'por.codigo'")[0]["last_login_at"]
    assert FECHA.match(ultimo or "")
    # Y su «Mis sesiones» lo resume
    actual = client.get("/api/auth/sessions", headers={"Authorization": f"Bearer {token}"}).json()["items"][0]
    assert actual["current"] is True and actual["browser"] == "Safari en iPhone"


def test_el_user_agent_se_guarda_recortado_y_la_ip_no_se_guarda(client):
    largo = "NavegadorRaro/1.0 " + "x" * 400
    token, _ = token_de(client, ua=largo)
    guardado = db.fetch_all("SELECT user_agent FROM user_sessions WHERE session_id = ?", (token,))[0]["user_agent"]
    assert guardado == largo[:200] and len(guardado) == auth_otp.USER_AGENT_MAX

    columnas = {r["name"] for r in db.fetch_all("PRAGMA table_info(user_sessions)")}
    assert "user_agent" in columnas
    assert not {"ip", "client_ip", "remote_addr"} & columnas
    # Tampoco se guardan nombres de cabeceras: solo el texto del User-Agent
    assert guardado.startswith("NavegadorRaro/")


# ---------------------------------------------------------------------------
# Migración v19
# ---------------------------------------------------------------------------

def _columnas(conn: sqlite3.Connection, tabla: str) -> set[str]:
    return {r[1] for r in conn.execute(f"PRAGMA table_info({tabla})").fetchall()}


def test_la_migracion_agrega_las_columnas_a_una_base_de_antes_y_es_idempotente(tmp_path):
    """Una base de la v18 (sin las columnas nuevas): la migración las agrega, corre dos veces sin fallar y no toca datos."""
    path = str(tmp_path / "v19.db")
    conn = sqlite3.connect(path)
    try:
        conn.executescript("""
            CREATE TABLE users (user_id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL);
            CREATE TABLE user_sessions (session_id TEXT PRIMARY KEY, user_id INTEGER NOT NULL,
                                        expires_at TEXT NOT NULL, created_at TEXT NOT NULL);
            INSERT INTO users (username) VALUES ('viejo');
            INSERT INTO user_sessions VALUES ('token-viejo', 1, '2030-01-01 00:00:00', '2026-01-01 00:00:00');
        """)
        conn.commit()
        assert "last_login_at" not in _columnas(conn, "users") and "user_agent" not in _columnas(conn, "user_sessions")

        apply_v19_migration(conn)
        apply_v19_migration(conn)               # dos veces: no falla ni duplica

        assert "last_login_at" in _columnas(conn, "users") and "user_agent" in _columnas(conn, "user_sessions")
        # Las filas que ya estaban siguen igual y las columnas nuevas quedan vacías
        assert conn.execute("SELECT username FROM users").fetchone()[0] == "viejo"
        assert conn.execute("SELECT last_login_at FROM users").fetchone()[0] is None
        assert conn.execute("SELECT session_id, user_agent FROM user_sessions").fetchone() == ("token-viejo", None)
    finally:
        conn.close()


def test_init_db_lleva_la_v19_a_una_base_existente(tmp_path, monkeypatch):
    """Simula un despliegue de la v18 y arranca con la versión nueva: agrega las columnas, no borra la base ni sus datos."""
    path = str(tmp_path / "existente.db")
    monkeypatch.setattr(db, "DB_PATH", path)
    monkeypatch.setattr(init_db, "DB_PATH", path)

    # Base tal como la dejaba la v18: los bloques SQL y todas las migraciones menos la v19
    conn = sqlite3.connect(path)
    try:
        for bloque in (init_db.SCHEMA_SQL, init_db.SCHEMA_V2_SQL, init_db.SCHEMA_V3_SQL,
                       init_db.SCHEMA_V4_SQL, init_db.SCHEMA_V5_SQL):
            conn.executescript(bloque)
        for migracion in init_db.MIGRACIONES:
            if migracion is not apply_v19_migration:
                migracion(conn)
        conn.commit()
        assert "last_login_at" not in _columnas(conn, "users") and "user_agent" not in _columnas(conn, "user_sessions")
    finally:
        conn.close()

    init_db.init_database()                     # rama de «base existente»: solo migra

    conn = sqlite3.connect(path)
    try:
        assert "last_login_at" in _columnas(conn, "users") and "user_agent" in _columnas(conn, "user_sessions")
        assert conn.execute("SELECT COUNT(*) FROM users").fetchone()[0] >= 1   # la semilla sigue ahí
    finally:
        conn.close()
