"""
Lecturas caras recordadas: las tablas de la flota (fleet._ctx) y los departamentos de cada ruta (geo._departments_of).
Lo recordado nunca puede quedar viejo: cualquier escritura cambia la huella de la base.
"""
import json
from datetime import datetime

import pytest

import app.database.db as db
import app.init_db as init_db


@pytest.fixture(scope="module")
def base(tmp_path_factory):
    path = str(tmp_path_factory.mktemp("memoria") / "memoria.db")
    mp = pytest.MonkeyPatch()
    mp.setattr(db, "DB_PATH", path)
    mp.setattr(init_db, "DB_PATH", path)
    from fastapi.testclient import TestClient
    from app import main
    main.network.cache_clear()
    main._last_sync = 0.0
    with TestClient(main.app) as c:
        yield c
    main.network.cache_clear()
    mp.undo()


def test_la_huella_cambia_con_cada_escritura(base):
    antes = db.data_version()
    assert db.data_version() == antes                                    # sin escribir, la misma huella
    db.run_write("UPDATE fl_vehicles SET notes = ? WHERE vehicle_id = (SELECT MIN(vehicle_id) FROM fl_vehicles)", ("x",))
    assert db.data_version() != antes


def test_la_flota_recordada_ve_los_cambios_al_instante(base):
    from app.engine import fleet
    now = datetime.now()
    primero = fleet._ctx(now)["vehicles"][0]
    assert fleet._ctx(now)["vehicles"] is fleet._ctx(now)["vehicles"]   # segunda lectura: de memoria
    db.run_write("UPDATE fl_vehicles SET notes = ? WHERE vehicle_id = ?", ("nota nueva", int(primero["vehicle_id"])))
    assert fleet._ctx(now)["vehicles"][0]["notes"] == "nota nueva"
    assert fleet._ctx(now)["now"] is now                                  # la hora siempre es la de la consulta


def test_departamentos_recordados_igual_que_calculados(base):
    from app.engine import geo
    from app.engine.common import records
    rows = records(db.run_query("SELECT route_json, weight_t FROM mm_shipments LIMIT 20"))
    assert rows
    for r in rows:
        assert geo._departments_of(r["route_json"]) == frozenset(geo.departments_on_route(json.loads(r["route_json"])))
    as_text = geo.department_traffic(rows)
    as_dict = geo.department_traffic([{**r, "route_json": json.loads(r["route_json"])} for r in rows])
    assert as_text == as_dict and as_text
