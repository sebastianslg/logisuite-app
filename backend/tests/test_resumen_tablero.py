"""
Resumen del tablero: la versión con SQL debe devolver exactamente lo mismo que la que leía la tabla entera.

La referencia es el código anterior, copiado aquí tal cual sobre las mismas filas; si alguien cambia el resumen y se olvida
de un campo, esta prueba lo dice.
"""
import json
from datetime import datetime

import pytest
from fastapi.testclient import TestClient

import app.database.db as db
import app.init_db as init_db
from app.api import format as F
from app.api import serializers as S
from app.engine import fleet, telemetry, trends, warehouses


@pytest.fixture(scope="module")
def client(tmp_path_factory):
    path = str(tmp_path_factory.mktemp("resumen") / "resumen.db")
    mp = pytest.MonkeyPatch()
    mp.setattr(db, "DB_PATH", path)
    mp.setattr(init_db, "DB_PATH", path)
    from app import main
    main.network.cache_clear()
    main._last_sync = 0.0
    with TestClient(main.app) as c:
        yield c
    main.network.cache_clear()
    mp.undo()


def _legacy(main, now: datetime) -> dict:
    """El resumen anterior, palabra por palabra: lee la tabla completa y cuenta/ suma recorriéndola."""
    rows = db.run_query("SELECT * FROM mm_shipments").to_dict(orient="records")
    counts = {k: 0 for k in ("Programado", "En Ruta", "Transferencia Modal", "Retrasado", "Entregado")}
    in_transit_t, in_transit_cost = 0.0, 0.0
    tkm_by_mode: dict = {}
    corridor_t: dict = {}
    delivered, on_time = 0, 0
    for r in rows:
        counts[r["status"]] = counts.get(r["status"], 0) + 1
        if r["status"] in telemetry.ACTIVE_STATUSES:
            in_transit_t += r["weight_t"]
            in_transit_cost += r["total_cost"]
        if r["status"] == "Entregado":
            delivered += 1
            on_time += 1 if not r["delay_h"] else 0
        if r["status"] == "Programado":
            continue
        route = json.loads(r["route_json"])
        for lg in route["legs"]:
            tkm_by_mode[lg["mode"]] = tkm_by_mode.get(lg["mode"], 0.0) + r["weight_t"] * lg["distance_km"]
            for c in lg["corridors"]:
                corridor_t[c] = corridor_t.get(c, 0.0) + r["weight_t"]

    total_tkm = sum(tkm_by_mode.values()) or 1.0
    modal_split = [{
        "mode": m, "label": F.MODE_LABELS[m], "tkm": round(v),
        "tkm_fmt": F.number(v / 1e6, 2) + " M t-km", "share_pct": F.pct(100 * v / total_tkm),
    } for m, v in sorted(tkm_by_mode.items(), key=lambda kv: -kv[1])]
    all_corridors = [{"corridor": c, "tons": F.tons(t), "tons_fmt": F.tons_fmt(t)}
                     for c, t in sorted(corridor_t.items(), key=lambda kv: -kv[1])]
    active = counts["En Ruta"] + counts["Transferencia Modal"] + counts["Retrasado"]
    otif = 100 * on_time / delivered if delivered else None
    from datetime import timedelta
    days = [(now - timedelta(days=d)).date() for d in range(13, -1, -1)]
    per_day = {d: 0 for d in days}
    for r in rows:
        d = datetime.fromisoformat(r["departure_at"]).date()
        if d in per_day:
            per_day[d] += 1
    fs, ws = fleet.summary(now), warehouses.summary()
    return {
        "generated_at": now.isoformat(timespec="seconds"),
        "status_counts": counts,
        "kpis": {
            "active": {"value": active, "fmt": F.number(active)},
            "in_transfer": {"value": counts["Transferencia Modal"], "fmt": F.number(counts["Transferencia Modal"])},
            "delayed": {"value": counts["Retrasado"], "fmt": F.number(counts["Retrasado"])},
            "tons_in_transit": {"value": F.tons(in_transit_t), "fmt": F.tons_fmt(in_transit_t)},
            "cost_in_transit": {"value": F.money(in_transit_cost), "fmt": F.money_fmt(in_transit_cost)},
            "otif": {"value": F.pct(otif) if otif is not None else None,
                     "fmt": F.pct_fmt(otif) if otif is not None else "N/D"},
            "delivered": {"value": delivered, "fmt": F.number(delivered)},
            "scheduled": {"value": counts["Programado"], "fmt": F.number(counts["Programado"])},
        },
        "modal_split": modal_split,
        "top_corridors": all_corridors[:6],
        "all_corridors": all_corridors,
        "dispatches_14d": [{"date": d.isoformat(), "count": per_day[d]} for d in days],
        "trends": trends.trends(rows, now),
        "alerts": main._alerts(rows, fs, ws, now),
        "network": {"nodes": len(main.network().nodes), "links": len(main.network().links),
                    "modes": S.network_geojson(main.network())["stats"]},
    }


def _igual(a, b, ruta="", tolerancia=1e-6):
    """Compara dos respuestas: los números con tolerancia (la suma en SQL y en Python puede diferir en el último decimal)."""
    if isinstance(a, dict) and isinstance(b, dict):
        assert set(a) == set(b), f"campos distintos en {ruta}: {set(a) ^ set(b)}"
        for k in a:
            _igual(a[k], b[k], f"{ruta}.{k}", tolerancia)
    elif isinstance(a, list) and isinstance(b, list):
        assert len(a) == len(b), f"largo distinto en {ruta}: {len(a)} != {len(b)}"
        for i, (x, y) in enumerate(zip(a, b)):
            _igual(x, y, f"{ruta}[{i}]", tolerancia)
    elif isinstance(a, (int, float)) and isinstance(b, (int, float)) and not isinstance(a, bool) and not isinstance(b, bool):
        assert a == pytest.approx(b, abs=tolerancia, rel=1e-9), f"{ruta}: {a} != {b}"
    else:
        assert a == b, f"{ruta}: {a!r} != {b!r}"


def test_el_resumen_da_lo_mismo_que_antes(client, monkeypatch):
    from app import main
    ahora = datetime(2026, 11, 20, 12, 0, 0)
    monkeypatch.setattr(main, "_sync", lambda: ahora)

    nuevo = client.get("/api/dashboard/summary").json()
    viejo = _legacy(main, ahora)
    _igual(nuevo, viejo)


def test_el_resumen_no_lee_la_tabla_completa(client, monkeypatch):
    """La consulta del resumen debe pedir columnas concretas y no `SELECT *`."""
    from app import main
    consultas = []
    original = main.fetch_all

    def espia(sql, params=()):
        consultas.append(sql)
        return original(sql, params)

    monkeypatch.setattr(main, "fetch_all", espia)
    client.get("/api/dashboard/summary")
    assert consultas, "no se ejecutó ninguna consulta"
    assert not any("SELECT *" in c for c in consultas), [c for c in consultas if "SELECT *" in c]
    assert any("GROUP BY status" in c for c in consultas), "los conteos no se hacen en SQL"
