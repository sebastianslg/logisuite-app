"""
Lecturas de operación sin pandas (tarea B4).

`fetch_all` devuelve listas de dicts y los vacíos como None, mientras que `run_query` armaba un DataFrame
en cada consulta. Estas pruebas fijan lo que ven los usuarios a través de las funciones que cambiaron
—historial de auditoría, parámetros, numeración de envíos, vías, historial de trayectos, reporte operativo
y flota en vivo— y cubren los casos vacíos (sin filas, con NULL en la base, filtros que no encuentran nada),
que es justo donde pandas y los dicts podrían diferir.

No se prueba aquí lo que sigue con pandas a propósito (consultas que se agregan con DataFrame).
"""
from datetime import datetime

import pytest

import app.database.db as db
import app.init_db as init_db
from app.engine import history as H, operations as ops, report, telemetry
from app.engine.multimodal import MultimodalNetwork

AHORA = datetime(2026, 11, 20, 12, 0, 0)


@pytest.fixture(scope="module")
def base(tmp_path_factory):
    """Base de ejemplo en un archivo temporal (como la de la app), compartida por el módulo."""
    path = str(tmp_path_factory.mktemp("lecturas") / "lecturas.db")
    mp = pytest.MonkeyPatch()
    mp.setattr(db, "DB_PATH", path)
    mp.setattr(init_db, "DB_PATH", path)
    init_db.init_database()
    yield path
    mp.undo()


def _codigos() -> list:
    return sorted(r["shipment_code"] for r in db.fetch_all("SELECT shipment_code FROM mm_shipments"))


def test_historial_de_auditoria_devuelve_dicts_y_filtra(base):
    db.run_write("INSERT INTO audit_log (username, action, table_name, record_id, detail, timestamp) "
                 "VALUES (?, ?, ?, ?, ?, ?)",
                 ("Prueba B4", "UPDATE", "mm_shipments", "LS-2611-0777", "Ruta redirigida", "2026-11-10 09:00:00"))
    data = ops.audit_search(usuario="Prueba B4", accion="UPDATE")
    assert data["total"] == 1
    assert isinstance(data["items"][0], dict)  # sin DataFrame de por medio
    assert data["items"][0]["record_id"] == "LS-2611-0777"
    # Un filtro sin coincidencias entrega la lista vacía y el total en cero, no un DataFrame vacío
    assert ops.audit_search(usuario="nadie-con-ese-nombre") == {"total": 0, "items": []}
    # El texto busca en el detalle y en el registro
    assert ops.audit_search(q="0777")["total"] == 1
    # Facetas: cada valor con cuántas líneas tiene; los NULL del historial no se ofrecen como filtro
    facetas = ops.audit_facets()
    assert {"value": "Prueba B4", "count": 1} in facetas["usuarios"]
    assert all(f["value"] for f in facetas["usuarios"] + facetas["acciones"] + facetas["tablas"])
    # Las líneas sueltas respetan los filtros de tabla y de registro
    assert all(e["table_name"] == "mm_shipments" for e in ops.audit_entries(limit=10, table="mm_shipments"))
    assert ops.audit_entries(limit=10, record="no-existe") == []


def test_parametros_y_numeracion_con_huecos(base):
    # Un parámetro que no existe devuelve el respaldo (o ""), no la primera fila de un DataFrame vacío
    assert ops._param("NO_EXISTE_B4") == ""
    assert ops._param("NO_EXISTE_B4", "respaldo") == "respaldo"
    ops._set_param("B4_PRUEBA", "42")
    assert ops._param("B4_PRUEBA") == "42"

    existentes = [int(c.rsplit("-", 1)[1]) for c in _codigos()]
    # Un DELETE sin registro (record_id NULL) no puede romper la numeración: se ignora al leer el historial
    db.run_write("INSERT INTO audit_log (username, action, table_name, record_id, detail, timestamp) "
                 "VALUES ('sistema', 'DELETE', 'mm_shipments', NULL, NULL, '2026-11-11 10:00:00')")
    # Un consecutivo borrado no se reutiliza: la numeración sigue después del más alto visto
    alto = max(existentes) + 500
    db.run_write("INSERT INTO audit_log (username, action, table_name, record_id, detail, timestamp) "
                 "VALUES ('sistema', 'DELETE', 'mm_shipments', ?, NULL, '2026-11-11 10:01:00')",
                 (f"LS-2611-{alto:04d}",))
    assert ops.next_code(AHORA) == f"LS-2611-{alto + 1:04d}"


def test_historial_de_trayectos_sin_pandas(base):
    h = H.history(AHORA, 30)
    # Los totales cuadran con lo que sale y llega por ciudad y departamento (antes salían de las mismas filas)
    assert h["totals"]["shipments"] == sum(c["out"] for c in h["by_city"])
    assert sum(d["out"] for d in h["by_department"]) == h["totals"]["shipments"]
    assert all(isinstance(c["tons_out"], float) for c in h["by_city"])
    # Ventana sin movimientos: ceros y comparaciones nulas, en vez de NaN
    vacio = H.history(datetime(2030, 1, 1), 30)
    assert vacio["totals"]["shipments"] == 0 and vacio["totals"]["cost"] == 0
    assert vacio["by_city"] == [] and vacio["by_department"] == [] and vacio["by_corridor"] == []
    assert vacio["previous"]["change_pct"] == {"shipments": None, "tons": None, "cost": None}
    # Los departamentos del mapa no dependen de pandas (código a dos dígitos)
    departamentos = H._city_departments()
    assert departamentos and all(len(codigo) == 2 and codigo.isdigit() for codigo in departamentos.values())


def test_reporte_operativo_sin_pandas(base):
    net = MultimodalNetwork.from_db()
    pdf = report.render(net, 7, "USD", ops.get_fx(), AHORA)
    assert pdf.startswith(b"%PDF") and len(pdf) > 2000


def test_flota_en_vivo_sin_pandas(base):
    flota = telemetry.live_fleet(AHORA)
    assert flota, "la base de ejemplo deja envíos en tránsito"
    for item in flota:
        assert isinstance(item["shipment"], dict)  # antes era una fila de DataFrame
        assert item["shipment"]["status"] in telemetry.ACTIVE_STATUSES
        assert -5 < item["position"]["lat"] < 13 and -82 < item["position"]["lon"] < -66
    # Son exactamente los abiertos en esos estados, sin faltar ni sobrar
    en_ruta = [r["shipment_code"] for r in db.fetch_all(
        f"SELECT shipment_code FROM mm_shipments WHERE status IN ({','.join('?' * len(telemetry.ACTIVE_STATUSES))})",
        telemetry.ACTIVE_STATUSES)]
    assert sorted(item["shipment"]["shipment_code"] for item in flota) == sorted(en_ruta)
    # Recalcular estados dos veces con la misma hora no cambia nada la segunda vez
    telemetry.refresh_statuses(AHORA)
    primera = db.fetch_all("SELECT shipment_code, status FROM mm_shipments ORDER BY shipment_code")
    telemetry.refresh_statuses(AHORA)
    assert db.fetch_all("SELECT shipment_code, status FROM mm_shipments ORDER BY shipment_code") == primera


def test_abiertos_editar_y_borrar(base):
    abiertos = ops._open_shipments()
    assert abiertos and all(isinstance(r, dict) and r["status"] != "Entregado" for r in abiertos)

    net = MultimodalNetwork.from_db()
    with pytest.raises(LookupError):
        ops.update_shipment(net, "LS-NO-EXISTE", {"delay_h": 1}, "Prueba B4", AHORA)
    with pytest.raises(LookupError):
        ops.delete_shipment("LS-NO-EXISTE", "Prueba B4")

    codigo = _codigos()[0]
    assert ops.update_shipment(net, codigo, {"delay_h": 2.5}, "Prueba B4", AHORA) == codigo
    fila = db.fetch_all("SELECT delay_h, updated_by FROM mm_shipments WHERE shipment_code = ?", (codigo,))[0]
    assert fila == {"delay_h": 2.5, "updated_by": "Prueba B4"}

    # Borrar deja la fila fuera y el detalle del historial con los datos que había (se leen antes de borrar)
    borrable = _codigos()[-1]
    ops.delete_shipment(borrable, "Prueba B4")
    assert borrable not in _codigos()
    ultimo = db.fetch_all("SELECT record_id, detail FROM audit_log ORDER BY audit_id DESC LIMIT 1")[0]
    assert ultimo["record_id"] == borrable and "Envío borrado" in ultimo["detail"]
    with pytest.raises(LookupError):
        ops.delete_shipment(borrable, "Prueba B4")


@pytest.mark.parametrize("modulo", [H, ops, report, telemetry])
def test_los_modulos_ya_no_leen_con_pandas(modulo):
    """Si alguien vuelve a importar run_query en estos módulos, esta prueba lo avisa (la salida es la misma, el costo no)."""
    assert not hasattr(modulo, "run_query"), f"{modulo.__name__} volvió a usar run_query"
