"""
Limpieza de lo que ya no sirve para entrar: sesiones vencidas y códigos de ingreso viejos (auth_otp.purge_expired_auth).

Comprueba también lo que NO debe pasar: las sesiones vigentes (siguen valiendo en get_user_by_session) y los códigos
recientes (usados o vencidos hace menos de siete días) se quedan, y la función no borra de más al repetirse.
"""
from datetime import datetime, timedelta

import pytest

import app.database.db as db
import app.init_db as init_db
from app.engine import auth_otp

FECHA = "%Y-%m-%d %H:%M:%S"
CUENTA = "limpieza@ejemplo.invalid"


@pytest.fixture(scope="module")
def cuenta(tmp_path_factory):
    """Base temporal con el esquema y los datos semilla, y una cuenta a la que colgarle sesiones y códigos."""
    path = str(tmp_path_factory.mktemp("limpieza") / "limpieza.db")
    mp = pytest.MonkeyPatch()
    mp.setattr(db, "DB_PATH", path)
    mp.setattr(init_db, "DB_PATH", path)
    init_db.init_database()
    user = auth_otp.create_user_record(CUENTA, "Cuenta de limpieza", "lector")
    yield user
    mp.undo()


def _sesion(user_id: int, session_id: str, dias: float, ignorar_si_existe: bool = False) -> None:
    """Inserta una sesión que vence dentro de `dias` días (negativo: ya vencida)."""
    base = datetime.now()
    db.run_write(
        f"INSERT {'OR IGNORE ' if ignorar_si_existe else ''}INTO user_sessions (session_id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
        (session_id, user_id, (base + timedelta(days=dias)).strftime(FECHA), base.strftime(FECHA)),
    )


def _codigo(vence_dias: float, usada_dias: float | None = None) -> int:
    """Inserta un código que vence dentro de `vence_dias` días y, si se pide, se marcó usado hace `usada_dias` días."""
    base = datetime.now()
    usado = (base - timedelta(days=usada_dias)).strftime(FECHA) if usada_dias is not None else None
    return db.run_write(
        """INSERT INTO auth_codes (email, code_hash, salt, attempts, expires_at, used_at, created_at)
           VALUES (?, ?, ?, 0, ?, ?, ?)""",
        (CUENTA, "hash-de-prueba", "sal-de-prueba",
         (base + timedelta(days=vence_dias)).strftime(FECHA), usado, base.strftime(FECHA)),
    )


def _ids_sesiones() -> set[str]:
    return {r["session_id"] for r in db.fetch_all("SELECT session_id FROM user_sessions")}


def _ids_codigos() -> set[int]:
    return {int(r["code_id"]) for r in db.fetch_all("SELECT code_id FROM auth_codes")}


def test_borra_las_sesiones_vencidas_y_los_codigos_viejos(cuenta):
    uid = int(cuenta["user_id"])
    _sesion(uid, "sesion-vencida-ayer", -1)
    _sesion(uid, "sesion-vencida-hace-mes", -30)
    _sesion(uid, "sesion-vigente", 5)

    codigos_viejos = {
        _codigo(-10),                      # venció hace diez días y nunca se usó
        _codigo(-20, usada_dias=20),       # se usó hace veinte días (y venció entonces)
    }
    codigos_recientes = {
        _codigo(-1),                       # venció ayer: todavía se conserva
        _codigo(-1, usada_dias=1),         # usado ayer
        _codigo(15 / 1440),                # vigente, recién pedido (15 minutos)
    }

    res = auth_otp.purge_expired_auth()

    assert set(res) == {"sesiones", "codigos"}
    assert res == {"sesiones": 2, "codigos": 2}
    # Queda la sesión vigente y ningún código viejo
    assert _ids_sesiones() == {"sesion-vigente"}
    assert _ids_codigos() == codigos_recientes
    assert not (_ids_codigos() & codigos_viejos)


def test_la_sesion_vigente_sigue_valiendo_y_la_borrada_ya_no(cuenta):
    # get_user_by_session rechaza y borra una sesión vencida, aunque no la hubiera limpiado esta función
    _sesion(int(cuenta["user_id"]), "sesion-vigente", 5, ignorar_si_existe=True)
    _sesion(int(cuenta["user_id"]), "sesion-vencida-suelta", -1)
    assert auth_otp.get_user_by_session("sesion-vencida-suelta") is None

    user = auth_otp.get_user_by_session("sesion-vigente")
    assert user is not None and user["user_id"] == int(cuenta["user_id"]) and user["email"] == CUENTA
    assert auth_otp.get_user_by_session("sesion-vencida-ayer") is None


def test_repetir_la_limpieza_no_borra_nada_mas(cuenta):
    """Idempotente: lo que quedó (vigente y reciente) no se toca en una segunda pasada."""
    sesiones, codigos = _ids_sesiones(), _ids_codigos()
    assert auth_otp.purge_expired_auth() == {"sesiones": 0, "codigos": 0}
    assert _ids_sesiones() == sesiones and _ids_codigos() == codigos


def test_la_fecha_de_corte_se_puede_fijar(cuenta):
    """Con `now` se fija el momento: a los cuatro días lo de hoy sigue valiendo; a los nueve, un código de mañana ya
    venció hace más de siete días y se borra."""
    uid = int(cuenta["user_id"])
    _sesion(uid, "sesion-para-dentro-de-tres-dias", 3)
    codigo_manana = _codigo(1)
    codigo_lejano = _codigo(20)
    ahora = datetime.now()

    assert auth_otp.purge_expired_auth(ahora) == {"sesiones": 0, "codigos": 0}
    assert "sesion-para-dentro-de-tres-dias" in _ids_sesiones()

    # Cuatro días después esa sesión ya venció, pero los códigos siguen dentro del plazo de conservación
    assert auth_otp.purge_expired_auth(ahora + timedelta(days=4))["sesiones"] == 1
    assert "sesion-para-dentro-de-tres-dias" not in _ids_sesiones()
    assert {codigo_manana, codigo_lejano} <= _ids_codigos()

    # Nueve días después, el código que vencía mañana ya lleva más de siete días vencido; el de veinte días se queda
    auth_otp.purge_expired_auth(ahora + timedelta(days=9))
    assert codigo_manana not in _ids_codigos()
    assert codigo_lejano in _ids_codigos()


def test_la_pasada_diaria_llama_a_la_limpieza(cuenta, monkeypatch):
    """Si alguien quita la llamada de main._purge_attachments_daily, las sesiones vencidas se acumularían en silencio."""
    from app import main

    llamadas = []
    monkeypatch.setattr(auth_otp, "purge_expired_auth", lambda now: llamadas.append(now) or {})
    monkeypatch.setattr(main, "_last_purge_day", "")
    ahora = datetime.now()
    try:
        main._purge_attachments_daily(ahora)
    except Exception:
        pass  # lo demás de la pasada (adjuntos, correos) no es lo que se prueba aquí
    assert llamadas == [ahora]
