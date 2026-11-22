"""
Cumplimiento de las entregas («a tiempo y completo») por modo y por cliente.

La plataforma no guarda cantidad entregada frente a la pedida, así que el «in full» de OTIF no se puede medir:
el indicador es «entregas a tiempo» y reutiliza la definición del tablero (entregado con `delay_h` en cero).
Estas pruebas fijan esa definición, la igualdad con la cifra del resumen cuando toda la base cae en la ventana
(el tablero no filtra por fechas: la diferencia conocida queda fijada aquí), los casos borde —sin entregas, un
cliente, más de diez, justo en el límite— y que el reporte PDF lleve la sección y resista nombres con «&» y «<».
"""
import json
from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient

import app.database.db as db
import app.init_db as init_db
from app.engine import otif


@pytest.fixture(scope="module")
def base(tmp_path_factory):
    """Base de ejemplo en un archivo temporal (como la de la app), compartida por el módulo."""
    path = str(tmp_path_factory.mktemp("cumplimiento") / "cumplimiento.db")
    mp = pytest.MonkeyPatch()
    mp.setattr(db, "DB_PATH", path)
    mp.setattr(init_db, "DB_PATH", path)
    init_db.init_database()
    yield path
    mp.undo()


@pytest.fixture(scope="module")
def client(base):
    from app import main
    main.network.cache_clear()
    main._last_sync = 0.0
    with TestClient(main.app) as c:
        yield c
    main.network.cache_clear()


@pytest.fixture
def controladas(base):
    """Los envíos de prueba se borran al terminar: no deben quedar en el tablero ni en el reporte."""
    yield
    db.run_write("DELETE FROM mm_shipments WHERE shipment_code LIKE 'LS-CUMPLE-%'")


def _leg(mode: str, km: float) -> dict:
    """Un tramo con lo que leen el cumplimiento, el reparto modal y la huella (modo y distancia)."""
    return {"mode": mode, "from": {}, "to": {}, "corridors": [f"corredor-{mode}"], "distance_km": km,
            "time_h": km / 50.0, "cost": 0.0, "start_h": 0.0, "end_h": km / 50.0, "path": [], "stops": [],
            "segments": []}


def _envio(code: str, entregado: datetime, client: str = "Cliente de prueba", legs: list | None = None,
           delay_h: float = 0.0) -> dict:
    """Un envío entregado con su llegada real en `entregado`; la salida se calcula hacia atrás.

    `mm_shipments` no tiene columna de fecha de entrega: la fecha real es salida + duración + retraso
    (`otif.delivered_at`), y de ahí sale la salida que se guarda.
    """
    legs = legs or [_leg("terrestre", 300.0)]
    total_h = sum(leg["time_h"] for leg in legs)
    departure = entregado - timedelta(hours=total_h + delay_h)
    return {
        "shipment_code": code, "origin_city": "Bogotá", "dest_city": "Medellín", "cargo": "Carga de prueba",
        "weight_t": 10.0, "priority": "balanceado", "status": "Entregado", "client": client,
        "departure_at": departure.isoformat(timespec="minutes"),
        "eta_at": (departure + timedelta(hours=total_h)).isoformat(timespec="minutes"),
        "delay_h": delay_h, "distance_km": sum(leg["distance_km"] for leg in legs), "total_time_h": total_h,
        "total_cost": 100.0, "modes": ",".join(dict.fromkeys(leg["mode"] for leg in legs)),
        "n_transfers": len(legs) - 1,
        "route_json": json.dumps({"legs": legs, "transfers": [], "timeline": []}),
        "created_at": datetime.now().isoformat(timespec="minutes"),
    }


def _guardar(fila: dict) -> None:
    cols = list(fila)
    db.run_write(f"INSERT INTO mm_shipments ({', '.join(cols)}) VALUES ({', '.join('?' * len(cols))})",
                 tuple(fila[c] for c in cols))


def _prueba() -> list:
    return db.fetch_all("SELECT * FROM mm_shipments WHERE shipment_code LIKE 'LS-CUMPLE-%' ORDER BY shipment_code")


def test_el_total_coincide_con_el_tablero(client):
    """La cifra de «Hoy» y la del resumen del tablero («OTIF 30 días») son la misma: misma definición (entregado con
    `delay_h` en cero) y misma ventana (los últimos 30 días, por fecha de entrega)."""
    hoy = client.get("/api/today").json()
    tablero = client.get("/api/dashboard/summary").json()
    c = hoy["cumplimiento"]

    assert c["pct"] == tablero["kpis"]["otif"]["value"]
    assert c["entregas"] == tablero["kpis"]["delivered"]["value"]
    ahora = datetime.fromisoformat(hoy["now"])
    entregados = db.fetch_all("SELECT * FROM mm_shipments WHERE status = 'Entregado'")
    if len(otif.delivered_in_window(entregados, ahora)) == len(entregados):
        # La base sembrada: 12 entregas recientes, 10 a tiempo
        assert c["pct"] == pytest.approx(83.3)
        assert c["entregas"] == 12 and c["a_tiempo"] == 10

    # El campo es nuevo y no reemplaza a ninguno de los que ya usa la pantalla
    assert {"now", "window_h", "departures", "arrivals", "to_sign", "incidents", "fleet_documents",
            "counts"} <= set(hoy)
    assert c["window_days"] == otif.WINDOW_DAYS == 30
    assert c["pct_fmt"] == "83,3 %"
    assert sum(m["entregas"] for m in c["by_mode"]) == c["entregas"]
    assert c["a_tiempo"] == sum(m["a_tiempo"] for m in c["by_mode"])
    # Los clientes quedan en el reporte, no en la pantalla del día
    assert "by_client" not in c and all("label" in m for m in c["by_mode"])


def test_ni_hoy_ni_el_tablero_cuentan_la_entrega_de_hace_31_dias(client, base, controladas):
    """El tablero rotulaba «OTIF 30 días» pero contaba todo el histórico; ahora filtra por la misma ventana que «Hoy»."""
    hoy_antes = client.get("/api/today").json()["cumplimiento"]["entregas"]
    tablero_antes = client.get("/api/dashboard/summary").json()["kpis"]["delivered"]["value"]
    assert hoy_antes == tablero_antes

    _guardar(_envio("LS-CUMPLE-50", datetime.now() - timedelta(days=31), client="Cliente Viejo"))

    assert client.get("/api/today").json()["cumplimiento"]["entregas"] == hoy_antes
    assert client.get("/api/dashboard/summary").json()["kpis"]["delivered"]["value"] == tablero_antes


def test_hoy_lee_los_envios_una_sola_vez(client, monkeypatch):
    """El bloque se arma con la lectura que ya hace la pantalla: no repite la consulta pesada."""
    from app.engine import today as T
    consultas = []
    original = T.fetch_all

    def espia(sql, params=()):
        consultas.append(sql)
        return original(sql, params)

    monkeypatch.setattr(T, "fetch_all", espia)
    assert client.get("/api/today").json()["cumplimiento"]["entregas"] > 0
    assert sum(1 for sql in consultas if "FROM mm_shipments" in sql) == 1


def test_sin_entregas_es_sin_dato_y_no_cero():
    """Sin entregas no hay 0 %: no hay nada que cumplir, y las tablas quedan vacías."""
    r = otif.summarize([])
    assert r == {"entregas": 0, "a_tiempo": 0, "pct": None, "by_mode": [], "by_client": []}


def test_hoy_sin_entregas_en_la_ventana_tampoco_da_cero(base):
    """Pasada la ventana de 30 días, el bloque de «Hoy» queda sin dato («N/D»), no en 0 %."""
    from app.engine import today as T
    c = T.board(datetime.now() + timedelta(days=3650))["cumplimiento"]
    assert (c["entregas"], c["a_tiempo"], c["pct"], c["pct_fmt"], c["by_mode"]) == (0, 0, None, "N/D", [])


def test_un_solo_cliente_y_el_modo_del_tramo_mas_largo(base, controladas):
    """Cada envío cuenta en el modo que domina su distancia, y el cliente se agrupa sin importar la ruta."""
    ahora = datetime.now()
    _guardar(_envio("LS-CUMPLE-01", ahora - timedelta(days=2), client="Cliente Uno",
                    legs=[_leg("terrestre", 200.0), _leg("maritimo", 800.0)]))
    _guardar(_envio("LS-CUMPLE-02", ahora - timedelta(days=3), client="Cliente Uno",
                    legs=[_leg("maritimo", 100.0), _leg("terrestre", 900.0)]))
    _guardar(_envio("LS-CUMPLE-03", ahora - timedelta(days=1), client="Cliente Dos", delay_h=0.5))

    r = otif.summarize(_prueba())
    assert (r["entregas"], r["a_tiempo"], r["pct"]) == (3, 2, 66.7)

    modos = {m["mode"]: m for m in r["by_mode"]}
    assert modos["maritimo"]["entregas"] == 1 and modos["maritimo"]["pct"] == 100.0
    assert modos["terrestre"]["entregas"] == 2 and modos["terrestre"]["pct"] == 50.0
    assert modos["maritimo"]["label"] == "Marítimo"

    assert [c["client"] for c in r["by_client"]] == ["Cliente Uno", "Cliente Dos"]
    assert r["by_client"][0]["pct"] == 100.0 and r["by_client"][1]["pct"] == 0.0


def test_mas_de_diez_clientes_se_agrupan_en_otros(base, controladas):
    ahora = datetime.now()
    for i in range(1, 13):
        _guardar(_envio(f"LS-CUMPLE-{i:02d}", ahora - timedelta(days=1),
                        client=f"Cliente {i:02d}", delay_h=0.0 if i % 4 else 2.0))

    r = otif.summarize(_prueba())
    assert r["entregas"] == 12
    # Diez clientes con nombre y el resto sumado: la tabla del reporte no crece sin fin
    assert len(r["by_client"]) == 11
    assert [c["client"] for c in r["by_client"][:10]] == [f"Cliente {i:02d}" for i in range(1, 11)]
    otros = r["by_client"][-1]
    assert otros["client"] == "Otros" and otros["entregas"] == 2
    # Los dos últimos son el 11 (a tiempo) y el 12 (tarde): el porcentaje de «Otros» se calcula con sus sumas
    assert otros["a_tiempo"] == 1 and otros["pct"] == 50.0
    assert sum(c["entregas"] for c in r["by_client"]) == r["entregas"]


def test_justo_en_el_limite_del_retraso(base, controladas):
    """Retraso cero es a tiempo; un minuto de retraso ya no. El borde de la ventana también cuenta."""
    ahora = datetime.now()
    _guardar(_envio("LS-CUMPLE-20", ahora - timedelta(days=1), delay_h=0.0))
    _guardar(_envio("LS-CUMPLE-21", ahora - timedelta(days=1), delay_h=0.1))
    r = otif.summarize(_prueba())
    assert (r["entregas"], r["a_tiempo"], r["pct"]) == (2, 1, 50.0)

    # El sin retraso cuenta como a tiempo; el de una décima de hora ya no
    filas = _prueba()
    assert {f["shipment_code"]: otif.on_time(f) for f in filas} == {"LS-CUMPLE-20": True, "LS-CUMPLE-21": False}

    # Borde inferior de la ventana de 30 días: entra el que llega justo en el límite, no el de un segundo antes
    borde = ahora - timedelta(days=otif.WINDOW_DAYS)
    fila = {"shipment_code": "BORDE", "status": "Entregado", "client": "Uno", "modes": "terrestre",
            "route_json": '{"legs": []}', "departure_at": borde.isoformat(), "total_time_h": 0.0, "delay_h": 0.0}
    assert otif.delivered_at(fila) == borde
    assert otif.delivered_in_window([fila], ahora) == [fila]
    fila["departure_at"] = (borde - timedelta(seconds=1)).isoformat()
    assert otif.delivered_in_window([fila], ahora) == []


def test_la_ventana_de_30_dias_deja_fuera_lo_viejo(base, controladas):
    ahora = datetime.now()
    _guardar(_envio("LS-CUMPLE-30", ahora - timedelta(days=31)))
    _guardar(_envio("LS-CUMPLE-31", ahora - timedelta(days=5)))
    assert [f["shipment_code"] for f in otif.delivered_in_window(_prueba(), ahora)] == ["LS-CUMPLE-31"]


def test_el_reporte_lleva_la_seccion(client):
    """El PDF del reporte incluye el cumplimiento con sus dos tablas (texto sin comprimir para poder buscarlo)."""
    from reportlab import rl_config
    viejo = rl_config.pageCompression
    rl_config.pageCompression = 0
    try:
        r = client.get("/api/reports/operations", params={"days": 30})
    finally:
        rl_config.pageCompression = viejo
    assert r.status_code == 200 and r.content.startswith(b"%PDF")
    assert b"entregas a tiempo" in r.content     # título de la sección
    assert b"Por modo" in r.content and b"Por cliente" in r.content


def test_el_reporte_resiste_nombres_con_ampersand_y_angulos(client, base, controladas):
    """Un cliente con «&» o «<» rompía el parser del PDF y el reporte entero se perdía (422 y correo sin enviar).

    Las celdas de la sección de cumplimiento vienen de la base y la tabla del PDF las mete en un Paragraph: sin
    escapar, reportlab lanza ValueError y el mes se queda sin reporte. El nombre largo, además, no debe romper el
    ancho de la columna.
    """
    ahora = datetime.now()
    # Tres entregas por cliente: así quedan entre los diez con nombre de la tabla y no en «Otros»
    for i in range(3):
        _guardar(_envio(f"LS-CUMPLE-6{i}", ahora - timedelta(days=2), client="Cliente & Cía <Norte>"))
    largo = ("Distribuidora del Caribe y del Pacifico S.A.S. - Sucursal Cartagena - Zona Franca - "
             "Bodega 12 Manzana 4 Lote 123 Fin-123")
    assert len(largo) == 120
    for i in range(3):
        _guardar(_envio(f"LS-CUMPLE-7{i}", ahora - timedelta(days=3), client=largo))

    from reportlab import rl_config
    viejo = rl_config.pageCompression
    rl_config.pageCompression = 0
    try:
        r = client.get("/api/reports/operations", params={"days": 30})
    finally:
        rl_config.pageCompression = viejo
    assert r.status_code == 200 and r.content.startswith(b"%PDF")
    # reportlab parte el texto en trozos alrededor de «<» y «>», así que se buscan las piezas del nombre
    assert b"Cliente &" in r.content and b"Norte" in r.content
    assert b"Fin-123" in r.content
    # La sección dice con qué ventana cuenta y qué modo muestra la tabla
    assert b"por fecha de entrega" in r.content
    assert b"no es el reparto por tonelada-kil" in r.content


def test_el_reporte_dice_sin_entregas_si_la_ventana_esta_vacia(base):
    """Con el período sin entregas la sección lo dice, en vez de dejar una tabla vacía."""
    from reportlab import rl_config
    from app.engine import operations as ops, report
    from app.engine.multimodal import MultimodalNetwork

    viejo = rl_config.pageCompression
    rl_config.pageCompression = 0
    try:
        pdf = report.render(MultimodalNetwork.from_db(), 30, "USD", ops.get_fx(), datetime.now() + timedelta(days=3650))
    finally:
        rl_config.pageCompression = viejo
    assert pdf.startswith(b"%PDF")
    assert b"Sin entregas en el per" in pdf
    assert b"Por cliente" not in pdf
