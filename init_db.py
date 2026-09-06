"""
init_db.py
Crea el esquema relacional y carga datos de prueba automáticamente.
Se ejecuta una sola vez (o se detecta y omite si la base ya existe) para que
el despliegue en Streamlit Community Cloud funcione sin pasos manuales.

Uso manual: python init_db.py --reset   (borra y recrea todo desde cero)
"""
import os
import sys
import sqlite3
import argparse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database.schema import SCHEMA_SQL
from database.db import DB_PATH


def init_database(reset: bool = False):
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    if reset and os.path.exists(DB_PATH):
        os.remove(DB_PATH)

    is_new = not os.path.exists(DB_PATH)

    conn = sqlite3.connect(DB_PATH)
    conn.executescript(SCHEMA_SQL)
    conn.commit()
    conn.close()

    if is_new:
        from utils.seed_data import seed_all
        seed_all()
        print(f"Base de datos creada y poblada en: {DB_PATH}")
    else:
        print(f"Base de datos ya existente, esquema verificado en: {DB_PATH}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--reset", action="store_true", help="Borra y recrea la base de datos")
    args = parser.parse_args()
    init_database(reset=args.reset)
