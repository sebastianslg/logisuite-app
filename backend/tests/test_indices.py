"""
Índices de la migración v18 (schema_v18.py).

Comprueba tres cosas sobre una base temporal propia (nunca la de la aplicación):
- que `init_database()` los crea en una base nueva y que una base que ya existía sin ellos los recibe al arrancar;
- que la migración se puede correr dos veces sin fallar (es idempotente y solo agrega);
- que las consultas que los motivaron dejan de recorrer la tabla entera (EXPLAIN QUERY PLAN: SEARCH ... USING INDEX).

También vigila que no se repita un índice: dos índices con las mismas columnas en la misma tabla solo gastan espacio y
hacen más lenta cada escritura.
"""
import sqlite3

import pytest

import app.database.db as db
import app.init_db as init_db
from app.database.schema_v18 import INDEXES, apply_v18_migration

# Consultas representativas: la lista de envíos, el historial por tabla, el ingreso y las sesiones.
CONSULTAS = {
    "idx_v18_ship_status_departure":
        ("SELECT * FROM mm_shipments WHERE status = ? ORDER BY departure_at DESC LIMIT 50", ("En Ruta",)),
    "idx_v18_audit_table":
        ("SELECT record_id FROM audit_log WHERE table_name = 'mm_shipments' AND action = 'DELETE'", ()),
    "idx_v18_sessions_user":
        ("DELETE FROM user_sessions WHERE user_id = ?", (1,)),
    "idx_v18_auth_codes_email":
        ("SELECT created_at FROM auth_codes WHERE email = ? ORDER BY code_id DESC LIMIT 1", ("nadie@ejemplo.co",)),
}


@pytest.fixture(scope="module")
def base(tmp_path_factory):
    """Base temporal nueva, creada con `init_database()` como en un despliegue."""
    path = str(tmp_path_factory.mktemp("indices") / "indices.db")
    mp = pytest.MonkeyPatch()
    mp.setattr(db, "DB_PATH", path)
    mp.setattr(init_db, "DB_PATH", path)
    init_db.init_database()
    yield path
    mp.undo()


def _conexion(path: str) -> sqlite3.Connection:
    return sqlite3.connect(path)


def _indices(path: str) -> dict[str, str]:
    """Índices de usuario: nombre -> tabla (los automáticos de UNIQUE/PRIMARY KEY quedan fuera)."""
    conn = _conexion(path)
    try:
        return {r[0]: r[1] for r in conn.execute(
            "SELECT name, tbl_name FROM sqlite_master WHERE type = 'index' AND sql IS NOT NULL")}
    finally:
        conn.close()


def _plan(path: str, sql: str, params: tuple) -> str:
    conn = _conexion(path)
    try:
        return " | ".join(r[3] for r in conn.execute("EXPLAIN QUERY PLAN " + sql, params))
    finally:
        conn.close()


def test_los_indices_existen_tras_init_db(base):
    indices = _indices(base)
    esperados = {
        "idx_v18_ship_status_departure": "mm_shipments",
        "idx_v18_audit_table": "audit_log",
        "idx_v18_sessions_user": "user_sessions",
        "idx_v18_auth_codes_email": "auth_codes",
    }
    for nombre, tabla in esperados.items():
        assert indices.get(nombre) == tabla, f"falta {nombre} en {tabla}"


def test_son_los_cuatro_de_la_migracion(base):
    """Ni uno más ni uno menos: lo que declara schema_v18.py es lo que queda en la base."""
    conn = _conexion(base)
    try:
        nombres = {r[0] for r in conn.execute(
            "SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_v18%'")}
    finally:
        conn.close()
    assert nombres == {sql.split(" ON ")[0].split()[-1] for sql in INDEXES}


def test_no_repite_indices_que_ya_existian(base):
    """Ninguno de los nuevos repite las columnas de un índice anterior en la misma tabla: el repetido no sirve y
    cuesta en cada escritura. (Ya hay un par repetido de antes: el esquema v15 repitió el de estado de la v3.)"""
    conn = _conexion(base)
    try:
        columnas: dict[tuple, list] = {}
        for tabla in ("mm_shipments", "audit_log", "user_sessions", "auth_codes"):
            for fila in conn.execute(f"PRAGMA index_list({tabla})").fetchall():
                nombre = fila[1]
                cols = tuple(r[2] for r in conn.execute(f"PRAGMA index_info({nombre})").fetchall())
                columnas.setdefault((tabla, cols), []).append(nombre)
    finally:
        conn.close()
    for (tabla, cols), nombres in columnas.items():
        nuevos = [n for n in nombres if n.startswith("idx_v18")]
        assert not nuevos or len(nombres) == 1, f"{nuevos} repiten {tabla}{cols} de {nombres}"


def test_la_migracion_es_idempotente(base):
    """Correrla otra vez (y otra) no falla ni cambia los índices: solo agrega los que falten."""
    antes = {n: t for n, t in _indices(base).items() if n.startswith("idx_v18")}
    conn = _conexion(base)
    try:
        apply_v18_migration(conn)
        apply_v18_migration(conn)
    finally:
        conn.close()
    assert {n: t for n, t in _indices(base).items() if n.startswith("idx_v18")} == antes


def test_una_base_existente_los_recibe_al_arrancar(tmp_path, monkeypatch):
    """Un despliegue anterior ya tiene la base: al arrancar con la versión nueva se le agregan los índices y sigue
    entrando por la rama de «base existente» (no la borra ni la vuelve a sembrar)."""
    path = str(tmp_path / "existente.db")
    monkeypatch.setattr(db, "DB_PATH", path)
    monkeypatch.setattr(init_db, "DB_PATH", path)
    init_db.init_database()                     # base nueva, ya con la v18
    conn = _conexion(path)
    try:
        for sql in INDEXES:                     # se simula la base de antes: sin los índices de la v18
            nombre = sql.split(" ON ")[0].split()[-1]
            conn.execute(f"DROP INDEX {nombre}")
        conn.commit()
        assert not [n for n in _indices(path) if n.startswith("idx_v18")]
    finally:
        conn.close()

    init_db.init_database()                     # rama de base existente: solo migra
    assert all(n in _indices(path) for n in ("idx_v18_ship_status_departure", "idx_v18_audit_table",
                                             "idx_v18_sessions_user", "idx_v18_auth_codes_email"))


@pytest.mark.parametrize("indice", list(CONSULTAS))
def test_las_consultas_usan_el_indice(base, indice):
    """La consulta que motivó cada índice lo usa: SEARCH con el índice, no un recorrido de la tabla."""
    sql, params = CONSULTAS[indice]
    plan = _plan(base, sql, params)
    assert "SEARCH" in plan, plan
    assert indice in plan, plan
    assert "SCAN" not in plan, plan


def test_la_lista_ya_no_ordena_aparte(base):
    """Filtrar por un estado y ordenar por salida (`sort=salida` de la lista) salía con un árbol temporal; con el índice
    compuesto sale en orden de una vez. El orden por defecto (CASE de estados) sí ordena aparte: el índice ayuda a
    filtrar y a contar, no a ese orden."""
    plan = _plan(base, *CONSULTAS["idx_v18_ship_status_departure"])
    assert "TEMP B-TREE" not in plan, plan
