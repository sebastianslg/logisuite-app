"""
db.py
Capa de acceso a datos (Data Access Layer). Encapsula la conexión SQLite
y expone helpers reutilizados por los modelos, el motor de red y la API.

La ruta de la base se toma de WESTVANE_DB_PATH (volumen de Docker) y, si no
existe, de backend/data/logistics.db. LOGISUITE_DB_PATH (nombre anterior de la
app) sigue siendo válida y tiene prioridad, para no perder la base de los
despliegues que ya la definen.
"""
import sqlite3
import os
import pandas as pd
from contextlib import contextmanager

_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DB_PATH = (os.environ.get("LOGISUITE_DB_PATH")
           or os.environ.get("WESTVANE_DB_PATH")
           or os.path.join(_BACKEND_DIR, "data", "logistics.db"))


def get_connection() -> sqlite3.Connection:
    """Crea una conexión con claves foráneas activadas y row_factory tipo dict."""
    # timeout: espera hasta 10 s a que otro hilo suelte la escritura en vez de fallar con "database is locked"
    conn = sqlite3.connect(DB_PATH, check_same_thread=False, timeout=10)
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.row_factory = sqlite3.Row
    return conn


def enable_wal() -> None:
    """Modo WAL: las lecturas no esperan a las escrituras (queda guardado en el archivo de la base)."""
    conn = sqlite3.connect(DB_PATH, timeout=10)
    try:
        conn.execute("PRAGMA journal_mode=WAL;")
        conn.execute("PRAGMA synchronous=NORMAL;")
    finally:
        conn.close()


@contextmanager
def db_cursor(commit: bool = False):
    """Context manager que entrega un cursor y opcionalmente confirma la transacción."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        yield cur
        if commit:
            conn.commit()
    finally:
        conn.close()


def run_query(sql: str, params: tuple = ()) -> pd.DataFrame:
    """Ejecuta un SELECT y devuelve un DataFrame de pandas."""
    conn = get_connection()
    try:
        df = pd.read_sql_query(sql, conn, params=params)
    finally:
        conn.close()
    return df


def run_write(sql: str, params: tuple = ()) -> int:
    """Ejecuta INSERT/UPDATE/DELETE y devuelve el lastrowid o el rowcount."""
    with db_cursor(commit=True) as cur:
        cur.execute(sql, params)
        return cur.lastrowid if cur.lastrowid else cur.rowcount


def run_many(sql: str, seq_of_params: list) -> None:
    """Ejecuta un INSERT/UPDATE por lotes."""
    with db_cursor(commit=True) as cur:
        cur.executemany(sql, seq_of_params)


def db_exists() -> bool:
    return os.path.exists(DB_PATH)
