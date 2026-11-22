"""
Peajes por tramo (task B7: cobertura de `app.engine.tolls`).

Los peajes entran en la cotización de cada envío (el motor los convierte a dólares con la TRM y los suma al flete), así
que una tabla de peajes mal guardada cambia todos los precios. Aquí se prueba el ciclo completo que usa el despachador:
leer la tabla, guardar un valor en pesos, cargar un Excel o un CSV (informando las filas malas sin detener el resto) y
exportar el CSV para editarlo y volver a cargarlo. La base es temporal y se siembra completa.
"""
import base64
import io

import pandas as pd
import pytest

import app.database.db as db
import app.init_db as init_db
from app.engine import operations as ops, tolls
from app.engine.common import OperationError
from app.engine.multimodal import MultimodalNetwork


@pytest.fixture(scope="module")
def base(tmp_path_factory):
    path = str(tmp_path_factory.mktemp("cobertura_peajes") / "peajes.db")
    mp = pytest.MonkeyPatch()
    mp.setattr(db, "DB_PATH", path)
    mp.setattr(init_db, "DB_PATH", path)
    init_db.init_database()
    yield path
    mp.undo()


def _fila(link_id: int) -> dict:
    return db.fetch_all("SELECT * FROM mm_links WHERE link_id = ?", (link_id,))[0]


def _un_tramo_terrestre() -> int:
    return int(db.fetch_all("SELECT link_id FROM mm_links WHERE mode = 'terrestre' AND active = 1 "
                            "ORDER BY link_id LIMIT 1")[0]["link_id"])


def _un_tramo_de_otro_modo() -> int:
    return int(db.fetch_all("SELECT link_id FROM mm_links WHERE mode != 'terrestre' "
                            "ORDER BY link_id LIMIT 1")[0]["link_id"])


def _csv(texto: str) -> str:
    return base64.b64encode(texto.encode("utf-8")).decode()


class TestTablaDePeajes:
    """La lectura y el guardado de un valor: lo que el usuario ve y lo que queda en el historial."""

    def test_solo_lista_tramos_terrestres_activos(self, base):
        items = tolls.list_tolls()
        assert items, "la red sembrada tiene tramos terrestres"
        terrestres = {int(r["link_id"]) for r in db.fetch_all(
            "SELECT link_id FROM mm_links WHERE mode = 'terrestre' AND active = 1")}
        assert {int(i["link_id"]) for i in items} == terrestres
        # Un tramo desactivado desaparece de la tabla (la semilla los deja todos activos, así que se apaga uno aquí)
        apagado = next(iter(terrestres))
        db.run_write("UPDATE mm_links SET active = 0 WHERE link_id = ?", (apagado,))
        try:
            despues = tolls.list_tolls()
            assert apagado not in {int(i["link_id"]) for i in despues}
            assert {int(i["link_id"]) for i in despues} == terrestres - {apagado}
        finally:
            db.run_write("UPDATE mm_links SET active = 1 WHERE link_id = ?", (apagado,))
        # Cada fila trae la procedencia y los nombres de los nodos, que es lo que se muestra en la tabla
        assert {"link_id", "corridor", "origin", "destination", "distance_km", "tolls_cop",
                "tolls_note", "tolls_source", "tolls_updated_at"} <= set(items[0])
        assert all(i["origin"] and i["destination"] for i in items)

    def test_guardar_un_peaje_lo_deja_y_firma_el_historial(self, base):
        link_id = _un_tramo_terrestre()
        antes = _fila(link_id)
        res = tolls.update_toll(link_id, "$ 29.400", "Tarifa de la caseta", "Invías 2026", "Operadora")
        assert res == {"link_id": link_id, "tolls_cop": 29400.0}
        despues = _fila(link_id)
        assert despues["tolls_cop"] == 29400.0
        assert despues["tolls_note"] == "Tarifa de la caseta" and despues["tolls_source"] == "Invías 2026"
        assert despues["tolls_updated_at"] and despues["tolls_updated_at"] != antes["tolls_updated_at"]
        log = db.fetch_all("SELECT username, action, table_name, record_id, detail FROM audit_log "
                           "WHERE table_name = 'mm_links' AND record_id = ? ORDER BY audit_id DESC LIMIT 1",
                           (str(link_id),))[0]
        assert log["username"] == "Operadora" and log["action"] == "UPDATE"
        assert "Peaje por despacho: 29,400 COP" in log["detail"]
        # Y la tabla vuelve a mostrar lo guardado, sin necesidad de reiniciar
        fila = next(i for i in tolls.list_tolls() if int(i["link_id"]) == link_id)
        assert fila["tolls_cop"] == 29400.0 and fila["tolls_note"] == "Tarifa de la caseta"

    def test_una_nota_o_fuente_vacia_se_guarda_como_nula(self, base):
        link_id = _un_tramo_terrestre()
        tolls.update_toll(link_id, 0, "", "", "Operadora")
        fila = _fila(link_id)
        assert fila["tolls_cop"] == 0 and fila["tolls_note"] is None and fila["tolls_source"] is None

    def test_no_se_toca_un_tramo_inexistente_ni_uno_de_otro_modo(self, base):
        for link_id in (999_999, _un_tramo_de_otro_modo()):
            with pytest.raises(LookupError):
                tolls.update_toll(link_id, 1000, None, None, "Operadora")
        # Nada cambió: solo los tramos terrestres tienen peaje editable
        assert _fila(_un_tramo_de_otro_modo())["tolls_cop"] != 1000

    def test_un_valor_que_no_es_pesos_no_se_guarda(self, base):
        link_id = _un_tramo_terrestre()
        previo = _fila(link_id)["tolls_cop"]
        with pytest.raises(OperationError):
            tolls.update_toll(link_id, "gratis", None, None, "Operadora")
        assert _fila(link_id)["tolls_cop"] == previo

    def test_un_peaje_negativo_se_rechaza(self, base):
        # Un peaje negativo abarataría la cotización: es un error del archivo o del formulario, no un descuento
        link_id = _un_tramo_terrestre()
        previo = _fila(link_id)["tolls_cop"]
        with pytest.raises(OperationError) as exc:
            tolls.update_toll(link_id, -50_000, None, None, "Operadora")
        assert "negativo" in str(exc.value)
        assert _fila(link_id)["tolls_cop"] == previo


class TestElPeajeEnLaCotizacion:
    """El motivo de todo esto: el peaje guardado tiene que verse en el costo de una ruta."""

    def test_el_peaje_guardado_sube_el_costo_de_la_ruta_en_dolares(self, base):
        ops.set_fx(4000, "2026-11-20", "Prueba", "Tester")
        # Se fuerza carretera: en tiempo puro el avión gana y no tendría peajes que mirar
        antes = MultimodalNetwork.from_db().route("Bogotá", "Cartagena", 10, "tiempo",
                                                  allowed_modes={"terrestre"})
        tramo = antes["legs"][0]
        seg = tramo["segments"][0]
        enlace = next(l for l in MultimodalNetwork.from_db().links
                      if l["mode"] == "terrestre" and l["corridor"] == seg["corridor"]
                      and {l["origin_code"], l["dest_code"]} == {seg["from"], seg["to"]})
        previo = float(enlace["tolls_cop"] or 0)
        tolls.update_toll(int(enlace["link_id"]), 400_000, None, None, "Tester")

        despues = MultimodalNetwork.from_db().route("Bogotá", "Cartagena", 10, "tiempo",
                                                    allowed_modes={"terrestre"})
        # La ruta no cambia (se eligió por tiempo) y el peaje sube justo lo que se guardó, pasado a USD con la TRM
        assert [l["segments"][0]["from"] for l in despues["legs"]] == [l["segments"][0]["from"] for l in antes["legs"]]
        subida = 400_000 / 4000 - previo / 4000
        assert despues["cost_breakdown"]["peajes"] == pytest.approx(
            antes["cost_breakdown"]["peajes"] + subida, rel=1e-6)
        # El peaje no se inventa: lo que se cobra es lo cargado, convertido con la TRM
        assert despues["cost_breakdown"]["peajes"] > antes["cost_breakdown"]["peajes"]


class TestCargaDeArchivos:
    """Excel o CSV con filas buenas y malas: se guardan las buenas y se informan las malas."""

    def test_csv_actualiza_las_buenas_y_reporta_las_malas_por_fila(self, base):
        bueno = _un_tramo_terrestre()
        otro_modo = _un_tramo_de_otro_modo()
        contenido = _csv("link_id,peaje_cop,nota,fuente\n"
                         f"{bueno},\"$ 12.500\",Caseta norte,Invías 2026\n"
                         f"{otro_modo},5000,Sin peaje,Invías\n"
                         f"{bueno},,Sin valor cargado,\n"
                         "no-es-numero,1000,?,?\n")
        res = tolls.import_file("peajes.csv", contenido, "Operadora")
        assert res["actualizados"] == 1
        # Encabezado en la fila 1: los errores se numeran como en la hoja que ve el usuario
        assert [e["fila"] for e in res["errores"]] == [3, 4, 5]
        assert "No existe el tramo terrestre" in res["errores"][0]["error"]
        assert "vacío" in res["errores"][1]["error"]
        assert res["errores"][2]["error"] == "El link_id no es un número."
        fila = _fila(bueno)
        assert fila["tolls_cop"] == 12500 and fila["tolls_note"] == "Caseta norte"
        assert fila["tolls_source"] == "Invías 2026"

    def test_excel_con_columnas_opcionales(self, base):
        link_id = _un_tramo_terrestre()
        buf = io.BytesIO()
        pd.DataFrame({"link_id": [link_id], "peaje_cop": [8800], "nota": ["Peaje de prueba"],
                      "fuente": ["Acta 12"]}).to_excel(buf, index=False)
        res = tolls.import_file("peajes.xlsx", base64.b64encode(buf.getvalue()).decode(), "Operadora")
        assert res == {"actualizados": 1, "errores": []}
        fila = _fila(link_id)
        assert fila["tolls_cop"] == 8800 and fila["tolls_note"] == "Peaje de prueba"

    def test_un_excel_corrupto_se_informa_y_no_escribe(self, base):
        link_id = _un_tramo_terrestre()
        previo = _fila(link_id)["tolls_cop"]
        contenido = base64.b64encode(b"esto no es un archivo de Excel").decode()
        with pytest.raises(ValueError):           # el endpoint lo traduce a 422
            tolls.import_file("peajes.xlsx", contenido, "Operadora")
        assert _fila(link_id)["tolls_cop"] == previo

    def test_un_csv_sin_filas_no_cambia_nada(self, base):
        res = tolls.import_file("peajes.csv", _csv("link_id,peaje_cop\n"), "Operadora")
        assert res == {"actualizados": 0, "errores": []}

    def test_un_archivo_con_base64_invalido_es_un_error_de_usuario(self, base):
        """Antes este caso respondía 500: base64 roto o vacío debe ser un error de usuario (422 desde el endpoint)."""
        with pytest.raises(OperationError) as exc:
            tolls.import_file("peajes.csv", "###", "Operadora")
        assert "no se puede leer" in str(exc.value)


class TestExportarParaEditar:
    """El ciclo documentado: exportar, editar en Excel y volver a cargar sin que nada se pierda."""

    def test_el_csv_exportado_trae_las_columnas_y_el_mismo_numero_de_filas(self, base):
        texto = tolls.export_csv()
        df = pd.read_csv(io.StringIO(texto), dtype=object)
        assert list(df.columns) == tolls.COLUMNAS_EXPORTACION
        assert len(df) == len(tolls.list_tolls())

    def test_lo_exportado_se_puede_volver_a_cargar_tal_cual(self, base):
        texto = tolls.export_csv()
        res = tolls.import_file("peajes-exportados.csv", _csv(texto), "Operadora")
        assert res["errores"] == []
        assert res["actualizados"] == len(tolls.list_tolls())

    def test_una_nota_que_parece_formula_sale_como_texto(self, base):
        link_id = _un_tramo_terrestre()
        tolls.update_toll(link_id, 1000, "=HYPERLINK(\"http://sitio\",\"toca\")", None, "Operadora")
        df = pd.read_csv(io.StringIO(tolls.export_csv()), dtype=object)
        nota = df.loc[df["link_id"].astype(int) == link_id, "nota"].iloc[0]
        assert nota.startswith("'="), "Excel ejecutaría la nota como fórmula al abrir el CSV"
        # Y vuelve a entrar como el mismo texto, sin perder el apóstrofo protector
        res = tolls.import_file("peajes.csv", _csv(tolls.export_csv()), "Operadora")
        assert res["errores"] == []
        assert _fila(link_id)["tolls_note"].startswith("'=")
