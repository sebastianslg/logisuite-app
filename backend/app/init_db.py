"""
init_db.py
Crea el esquema relacional (base + extensiones v2 + red multimodal v3) y carga datos de prueba
automáticamente. Se ejecuta una sola vez, o se detecta y omite si la base ya
existe, para que el despliegue funcione sin pasos manuales.

Uso manual (desde backend/): python -m app.init_db --reset   (borra y recrea todo desde cero)
"""
import os
import re
import sys
import sqlite3
import argparse

# Permite ejecutarlo como script (python app/init_db.py) además de como módulo
# (python -m app.init_db): el paquete `app` vive en backend/.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database.schema import SCHEMA_SQL
from app.database.schema_v2 import SCHEMA_V2_SQL
from app.database.schema_v3 import SCHEMA_V3_SQL
from app.database.schema_v4 import SCHEMA_V4_SQL, apply_v4_migration
from app.database.schema_v6 import apply_v6_migration
from app.database.schema_v7 import apply_v7_migration
from app.database.schema_v8 import apply_v8_migration
from app.database.schema_v9 import apply_v9_migration
from app.database.schema_v10 import apply_v10_migration
from app.database.schema_v11 import apply_v11_migration
from app.database.schema_v12 import apply_v12_migration
from app.database.schema_v13 import apply_v13_migration
from app.database.schema_v14 import apply_v14_migration
from app.database.schema_v15 import apply_v15_migration
from app.database.schema_v16 import apply_v16_migration
from app.database.schema_v17 import apply_v17_migration
from app.database.schema_v18 import apply_v18_migration
from app.database.schema_v5 import SCHEMA_V5_SQL
from app.database.db import DB_PATH

# Migraciones enganchadas, en orden. Cada una lleva su versión en el nombre
# (`apply_vNN_migration`) y de aquí se deriva `SCHEMA_VERSION`: al añadir una
# migración nueva basta con importarla y sumarla a esta lista, y el mensaje de
# arranque anuncia la versión real sin que haya que recordar otro número.
MIGRACIONES = [
    apply_v4_migration,
    apply_v6_migration,
    apply_v7_migration,
    apply_v8_migration,
    apply_v9_migration,
    apply_v10_migration,
    apply_v11_migration,
    apply_v12_migration,
    apply_v13_migration,
    apply_v14_migration,
    apply_v15_migration,
    apply_v16_migration,
    apply_v17_migration,
    apply_v18_migration,
]


def _version_migracion(migracion) -> int:
    """Versión de una migración, leída de su nombre: apply_v18_migration -> 18."""
    return int(re.fullmatch(r"apply_v(\d+)_migration", migracion.__name__).group(1))


# Versión real del esquema: la más alta de las migraciones enganchadas. Los
# bloques SQL sin función (base, v2, v3 y v5) no pueden superar ese máximo
# mientras cada versión nueva llegue como `apply_vNN_migration`; la prueba de
# tests/test_version_esquema.py lo compara con el último schema_vNN.py para que
# no vuelva a desfasarse.
SCHEMA_VERSION = max(_version_migracion(migracion) for migracion in MIGRACIONES)


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
    conn.executescript(SCHEMA_V3_SQL)
    conn.executescript(SCHEMA_V4_SQL)
    conn.executescript(SCHEMA_V5_SQL)
    # Después de los bloques SQL y en orden de versión. La v4 (columnas de
    # mm_shipments y TRM) puede ir aquí sin problema: los bloques de la v5 solo
    # crean tablas de flota y bodegas y no tocan esas columnas.
    for migracion in MIGRACIONES:
        migracion(conn)
    conn.commit()
    conn.close()

    if is_new:
        from app.utils.seed_data import seed_all
        seed_all()
        print(f"Base de datos creada y poblada en: {DB_PATH}")
    else:
        # Base existente: se asegura que las tablas CENTRALES tengan datos si
        # por alguna razón están vacías (ej. un despliegue anterior que se
        # interrumpió a medias), y que las tablas nuevas del esquema v2 tengan
        # sus datos semilla (usuarios, parámetros, escenarios). Ambas
        # funciones son idempotentes: no duplican ni tocan datos ya presentes.
        from app.utils.seed_data import ensure_core_seeded, seed_v2_only
        ensure_core_seeded()
        seed_v2_only()
        print(f"Base de datos existente actualizada al esquema v{SCHEMA_VERSION} en: {DB_PATH}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--reset", action="store_true", help="Borra y recrea la base de datos")
    args = parser.parse_args()
    init_database(reset=args.reset)
