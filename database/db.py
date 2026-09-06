"""
db.py
Capa de acceso a datos (Data Access Layer). Encapsula la conexión SQLite
y expone helpers reutilizados por todos los modelos y páginas de Streamlit.
"""
import sqlite3
import os
import pandas as pd
from contextlib import contextmanager

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "logistics.db")


def get_connection() -> sqlite3.Connection:
    """Crea una conexión con claves foráneas activadas y row_factory tipo dict."""
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.row_factory = sqlite3.Row
    return conn


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
