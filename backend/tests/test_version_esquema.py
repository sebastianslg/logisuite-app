"""
Versión del esquema en el mensaje de arranque (`init_db.py`).

El mensaje decía «actualizada al esquema v4» aunque la base ya iba en la v18: era un número escrito a mano que se quedó
atrás. Ahora `SCHEMA_VERSION` se deriva de las migraciones enganchadas, y estas pruebas vigilan que no vuelva a
desfasarse: el mensaje de una base existente lleva la versión real y esa versión coincide con el último
`schema_vNN.py` de `app/database/`.
"""
import re
from pathlib import Path

import app.database.db as db
import app.init_db as init_db


def _version_de_los_archivos() -> int:
    """Versión más alta entre los módulos `schema_vNN.py` de app/database (el último esquema disponible)."""
    numeros = [int(m.group(1)) for archivo in Path(db.__file__).parent.glob("schema_v*.py")
               if (m := re.fullmatch(r"schema_v(\d+)\.py", archivo.name))]
    return max(numeros)


def test_la_version_sale_del_ultimo_esquema():
    """Si se agrega `schema_v19.py` y se olvida sumarlo a `MIGRACIONES`, esto falla y avisa: la versión anunciada y la
    lista de migraciones no pueden separarse."""
    assert init_db.SCHEMA_VERSION == _version_de_los_archivos()


def test_el_mensaje_de_una_base_existente_lleva_la_version(tmp_path, monkeypatch, capsys):
    """La rama de «base existente» (la de cada arranque en producción) anuncia la versión real, no una fija."""
    path = str(tmp_path / "version.db")
    monkeypatch.setattr(db, "DB_PATH", path)
    monkeypatch.setattr(init_db, "DB_PATH", path)
    init_db.init_database()                 # base nueva: se crea, se puebla y se aplican todas las migraciones
    capsys.readouterr()                     # el mensaje de creación no lleva versión: se descarta
    init_db.init_database()                 # base existente: la rama que imprime la versión
    salida = capsys.readouterr().out
    assert f"esquema v{init_db.SCHEMA_VERSION}" in salida
