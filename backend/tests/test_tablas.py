"""
Exportación a Excel y carga masiva de la flota, los conductores y el inventario (tables_io.py y /api/tables).
"""
import base64
import io

import pandas as pd
import pytest
from fastapi.testclient import TestClient

import app.database.db as db
import app.init_db as init_db


@pytest.fixture(scope="module")
def client(tmp_path_factory):
    path = str(tmp_path_factory.mktemp("tablas") / "tablas.db")
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


def csv_b64(text: str) -> str:
    return base64.b64encode(text.encode("utf-8")).decode()


def post(client, kind, text, commit=False, autorizado=True, name="datos.csv"):
    return client.post(f"/api/tables/{kind}/import", json={"filename": name, "content_b64": csv_b64(text), "commit": commit,
                                                            "autorizado": autorizado, "usuario": "T"})


def test_exportacion_y_plantilla_de_cada_tabla(client):
    for kind in ("vehiculos", "conductores", "inventario"):
        res = client.get(f"/api/tables/{kind}/export.xlsx")
        assert res.status_code == 200 and res.headers["content-type"].startswith("application/vnd.openxmlformats")
        df = pd.read_excel(io.BytesIO(res.content))
        assert len(df) > 0, kind                                                      # la base de ejemplo trae datos
        tpl = client.get(f"/api/tables/{kind}/template.xlsx")
        assert tpl.status_code == 200 and "plantilla" in tpl.headers["content-disposition"]
    assert client.get("/api/tables/otra/export.xlsx").status_code == 404


def test_lo_exportado_se_puede_volver_a_cargar_y_solo_choca_por_duplicado(client):
    """Los encabezados de la exportación son los de la carga: todo vuelve como «ya existe», nunca como columna inválida."""
    raw = client.get("/api/tables/vehiculos/export.xlsx").content
    res = client.post("/api/tables/vehiculos/import", json={"filename": "v.xlsx", "content_b64": base64.b64encode(raw).decode()})
    assert res.status_code == 200
    body = res.json()
    assert body["rows"] > 0 and body["valid"] == 0
    assert all("Ya existe" in r["error"] for r in body["results"]), [r["error"] for r in body["results"] if "Ya existe" not in r["error"]][:3]


def test_vehiculos_vista_previa_no_guarda_y_confirmar_crea(client):
    texto = "placa,modo,tipo,marca,anio\nZZZ901,Terrestre,Tractomula 3S3,Kenworth,2022\nZZZ902,Nave,Barco,X,2020\nZZZ901,Terrestre,Tractomula 3S3,,\n"
    prev = post(client, "vehiculos", texto).json()
    assert prev["committed"] is False and prev["valid"] == 1 and prev["errors"] == 2
    assert "Modo no válido" in prev["results"][1]["error"] and "repetida" in prev["results"][2]["error"]
    assert client.get("/api/fleet/vehicles", params={"q": "ZZZ901"}).json()["count"] == 0            # nada se guardó
    done = post(client, "vehiculos", texto, commit=True).json()
    assert done["created"] == 1
    found = client.get("/api/fleet/vehicles", params={"q": "ZZZ901"}).json()["items"]
    assert len(found) == 1 and found[0]["make"] == "Kenworth" and found[0]["year"] == 2022
    again = post(client, "vehiculos", "placa,modo,tipo\nzzz901,Terrestre,Tractomula 3S3\n").json()
    assert again["valid"] == 0 and "Ya existe" in again["results"][0]["error"]                       # la placa no distingue mayúsculas


def test_vehiculos_con_bodega_y_conductor_inexistentes_se_rechazan(client):
    texto = "placa,modo,tipo,bodega\nZZZ903,Terrestre,Tractomula 3S3,NO-EXISTE\n"
    assert "no existe" in post(client, "vehiculos", texto).json()["results"][0]["error"]
    texto = "placa,modo,tipo,conductor\nZZZ903,Terrestre,Tractomula 3S3,Nadie Conocido\n"
    assert "no existe" in post(client, "vehiculos", texto).json()["results"][0]["error"]


def test_conductores_exigen_declaracion_y_evitan_duplicados(client):
    texto = "nombre,categoria,licencia_vence\nPrueba Tabla Uno,C2,2030-05-01\nPrueba Tabla Uno,C2,2030-05-01\nMala Fecha,C2,mañana\n"
    assert post(client, "conductores", texto, commit=True, autorizado=False).status_code == 422
    prev = post(client, "conductores", texto).json()
    assert prev["valid"] == 1 and prev["errors"] == 2
    done = post(client, "conductores", texto, commit=True).json()
    assert done["created"] == 1
    assert any(d["name"] == "Prueba Tabla Uno" for d in client.get("/api/fleet/drivers").json()["items"])
    assert post(client, "conductores", "nombre,categoria,licencia_vence\nprueba tabla uno,C2,2030-05-01\n").json()["valid"] == 0


def test_inventario_por_codigo_de_bodega(client):
    bodega = client.get("/api/warehouses").json()["items"][0]["code"]
    texto = f"bodega,sku,nombre,cantidad\n{bodega},TAB-001,Cajas de prueba,10\n{bodega},TAB-001,Repetido,5\nNO-HAY,TAB-002,Sin bodega,1\n"
    prev = post(client, "inventario", texto).json()
    assert prev["valid"] == 1 and prev["errors"] == 2
    assert post(client, "inventario", texto, commit=True).json()["created"] == 1
    wid = next(w["warehouse_id"] for w in client.get("/api/warehouses").json()["items"] if w["code"] == bodega)
    assert any(i["sku"] == "TAB-001" and i["qty"] == 10 for i in client.get(f"/api/warehouses/{wid}").json()["stock"])


def test_archivos_malos_se_informan_sin_tumbar_la_api(client):
    assert client.post("/api/tables/vehiculos/import", json={"filename": "a.csv", "content_b64": "###"}).status_code == 422
    assert "Faltan columnas" in post(client, "vehiculos", "placa,tipo\nA,B\n").json()["detail"]
    assert post(client, "nada", "a,b\n1,2\n").status_code == 422


def test_exportaciones_no_ejecutan_formulas_de_excel(client):
    """Un texto que empieza con = + - @ se abriría como fórmula en Excel: sale con apóstrofo, y los números no se tocan."""
    from app.engine.common import safe_cell
    assert safe_cell("=HYPERLINK(\"http://x\")") == "'=HYPERLINK(\"http://x\")"
    assert safe_cell("@SUM(A1)") == "'@SUM(A1)" and safe_cell("+1+1") == "'+1+1" and safe_cell("-2+3") == "'-2+3"
    assert safe_cell("-12.5") == "-12.5" and safe_cell("Café") == "Café" and safe_cell(7) == 7 and safe_cell(None) is None
    # De punta a punta: una nota maliciosa en un vehículo sale como texto en el Excel y en el CSV de auditoría
    post(client, "vehiculos", "placa,modo,tipo,notas\nFRM001,Terrestre,Tractomula 3S3,=1+1\n", commit=True)
    df = pd.read_excel(io.BytesIO(client.get("/api/tables/vehiculos/export.xlsx").content))
    assert df.loc[df["placa"] == "FRM001", "notas"].iloc[0] == "'=1+1"
    audit = client.get("/api/audit/export.csv").content.decode("utf-8-sig")
    assert not any(line.split(";")[-1].startswith(("=", "@")) for line in audit.splitlines())
