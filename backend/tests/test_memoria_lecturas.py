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


def test_las_bodegas_recordadas_ven_el_movimiento_al_instante(base):
    """Una entrada de inventario cambia la ocupación en la consulta siguiente, sin esperar a que caduque nada."""
    import math

    from app.engine import warehouses

    # La bodega con más espacio libre que tenga inventario: así la entrada no choca con el tope de volumen
    tienda = max((w for w in warehouses.list_warehouses() if w["stock_lines"] > 0), key=lambda w: w["free_m3"])
    linea = max(base.get(f"/api/warehouses/{tienda['warehouse_id']}").json()["stock"],
                key=lambda x: x["volume_m3"])
    # Suficiente para mover el total (que va redondeado a m³ enteros), sin pasarse del espacio libre
    cantidad = max(1, math.ceil(1.0 / max(linea["volume_m3"], 1e-6)))
    assert cantidad * linea["volume_m3"] <= tienda["free_m3"], "la bodega elegida no tiene espacio"

    antes = warehouses.summary()
    r = base.post(f"/api/warehouses/{tienda['warehouse_id']}/movements",
                  json={"sku": linea["sku"], "kind": "Entrada", "qty": cantidad,
                        "reference": "prueba memoria", "usuario": "T"})
    assert r.status_code == 201, r.text
    despues = warehouses.summary()
    assert despues["used_m3"] > antes["used_m3"], "la ocupación no reflejó la entrada"

    base.post(f"/api/warehouses/{tienda['warehouse_id']}/movements",
              json={"sku": linea["sku"], "kind": "Salida", "qty": cantidad,
                    "reference": "prueba memoria", "usuario": "T"})
    assert warehouses.summary()["used_m3"] == antes["used_m3"]


def test_sin_escrituras_la_lista_se_reutiliza_y_tras_escribir_no(base):
    from app.engine import warehouses

    primera = warehouses.list_warehouses()
    assert warehouses.list_warehouses() is primera, "sin escrituras no debe recalcularse"

    tienda = next(w for w in primera if w["stock_lines"] > 0)
    linea = base.get(f"/api/warehouses/{tienda['warehouse_id']}").json()["stock"][0]
    r = base.post(f"/api/warehouses/{tienda['warehouse_id']}/movements",
                  json={"sku": linea["sku"], "kind": "Entrada", "qty": 1, "usuario": "T"})
    assert r.status_code == 201, r.text
    assert warehouses.list_warehouses() is not primera, "la escritura debe invalidar lo recordado"
