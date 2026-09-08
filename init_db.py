"""
init_db.py
Crea el esquema relacional (base + extensiones v2) y carga datos de prueba
automáticamente. Se ejecuta una sola vez, o se detecta y omite si la base ya
existe, para que el despliegue en Streamlit Community Cloud funcione sin pasos
manuales.

Uso manual: python init_db.py --reset   (borra y recrea todo desde cero)
"""
import os
import sys
import sqlite3
import argparse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database.schema import SCHEMA_SQL
from database.schema_v2 import SCHEMA_V2_SQL
from database.db import DB_PATH


def init_database(reset: bool = False):
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    if reset and os.path.exists(DB_PATH):
        os.remove(DB_PATH)

    is_new = not os.path.exists(DB_PATH)

    # El esquema base y las extensiones se aplican siempre: usan
    # CREATE TABLE IF NOT EXISTS, así que actualizar una base existente a la
    # versión nueva es seguro y no destruye datos (migración aditiva).
    conn = sqlite3.connect(DB_PATH)
    conn.executescript(SCHEMA_SQL)
    conn.executescript(SCHEMA_V2_SQL)
    conn.commit()
    conn.close()

    if is_new:
        from utils.seed_data import seed_all
        seed_all()
        print(f"Base de datos creada y poblada en: {DB_PATH}")
    else:
        # Base existente: se asegura que las tablas CENTRALES tengan datos si
        # por alguna razón están vacías (ej. un despliegue anterior que se
        # interrumpió a medias), y que las tablas nuevas del esquema v2 tengan
        # sus datos semilla (usuarios, parámetros, escenarios). Ambas
        # funciones son idempotentes: no duplican ni tocan datos ya presentes.
        from utils.seed_data import ensure_core_seeded, seed_v2_only
        ensure_core_seeded()
        seed_v2_only()
        print(f"Base de datos existente actualizada al esquema v2 en: {DB_PATH}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--reset", action="store_true", help="Borra y recrea la base de datos")
    args = parser.parse_args()
    init_database(reset=args.reset)
