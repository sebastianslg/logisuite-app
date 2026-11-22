"""
Carga masiva de envíos (task B7: cobertura de `app.engine.shipments_io`).

Se prueban las reglas que el despachador vive a diario cuando sube un Excel: los alias de encabezado, las fechas en
sus formatos, que la vista previa no guarde nada, que confirmar cree solo las filas buenas y deje rastro en el
historial, y que un archivo enorme, vacío o ilegible se informe con un mensaje claro en vez de tumbar la API.

La base es temporal (como en tests/test_guard.py) y se siembra completa, porque cada fila válida se crea con
`operations.create_shipment`, que asigna vehículos de la flota real.
"""
import base64
import io
import json

import pandas as pd
import pytest
from openpyxl import Workbook, load_workbook

import app.database.db as db
import app.init_db as init_db
from app.engine import shipments_io
from app.engine.common import OperationError
from app.engine.multimodal import MultimodalNetwork

AHORA = pd.Timestamp("2026-11-20 09:00").to_pydatetime()


@pytest.fixture(scope="module")
def base(tmp_path_factory):
    path = str(tmp_path_factory.mktemp("cobertura_envios") / "envios.db")
    mp = pytest.MonkeyPatch()
    mp.setattr(db, "DB_PATH", path)
    mp.setattr(init_db, "DB_PATH", path)
    init_db.init_database()
    yield path
    mp.undo()


@pytest.fixture(scope="module")
def red(base):
    return MultimodalNetwork.from_db()


def _csv(texto: str, nombre: str = "envios.csv") -> tuple:
    return nombre, base64.b64encode(texto.encode("utf-8")).decode()


def _xlsx(filas: list) -> tuple:
    wb = Workbook()
    ws = wb.active
    for fila in filas:
        ws.append(fila)
    buf = io.BytesIO()
    wb.save(buf)
    return "envios.xlsx", base64.b64encode(buf.getvalue()).decode()


def _importar(red, archivo: tuple, commit: bool = False) -> dict:
    nombre, contenido = archivo
    return shipments_io.import_shipments(red, nombre, contenido, "Tester", AHORA, commit)


def _envios() -> int:
    return int(db.fetch_all("SELECT COUNT(*) AS n FROM mm_shipments")[0]["n"])


CABECERA = "origen;destino;carga;cliente;peso_t;salida"


class TestLecturaDelArchivo:
    """Lo que pasa antes de mirar cada fila: alias, formatos, límites y archivos dañados."""

    def test_los_alias_de_encabezado_se_entienden(self, red):
        # "peso" y "fecha_salida" son los nombres viejos de las columnas; el peso con coma decimal es un número
        archivo = _csv("origen;destino;carga;cliente;peso;fecha_salida;retraso\n"
                       "Bogotá;Cartagena;Café;ACME;12,5;15/11/2026 08:00;3\n")
        data = _importar(red, archivo)
        assert data["rows"] == 1 and data["valid"] == 1, data
        fila = data["results"][0]
        assert fila["weight_t"] == pytest.approx(12.5)          # "12,5" se lee como 12.5
        assert fila["departure_at"] == "2026-11-15T08:00"        # DD/MM/AAAA HH:MM
        # La vista previa trae el resumen calculado del envío que se crearía
        assert fila["modes"] and fila["time_fmt"] and fila["cost"] > 0

    @pytest.mark.parametrize("texto", ["2026-11-15 08:00", "2026-11-15T08:00", "2026-11-15",
                                       "15/11/2026 08:00", "15/11/2026"])
    def test_las_fechas_admitidas_se_normalizan(self, red, texto):
        archivo = _csv(f"{CABECERA}\nCali;Buenaventura;Azúcar;Ingenio;30;{texto}\n")
        fila = _importar(red, archivo)["results"][0]
        assert fila["ok"] and fila["departure_at"].startswith("2026-11-15T"), (texto, fila)

    def test_una_fecha_imposible_dice_que_formatos_usar(self, red):
        archivo = _csv(f"{CABECERA}\nCali;Buenaventura;Azúcar;Ingenio;30;mañana\n")
        fila = _importar(red, archivo)["results"][0]
        assert not fila["ok"]
        assert "Fecha de salida no reconocida" in fila["error"] and "AAAA-MM-DD" in fila["error"]

    def test_sin_la_columna_obligatoria_no_se_lee_el_archivo(self, red):
        with pytest.raises(OperationError) as exc:
            _importar(red, _csv("origen;destino\nBogotá;Cali\n"))
        assert "Faltan columnas" in str(exc.value) and "peso_t" in str(exc.value)

    def test_una_fecha_de_excel_se_lee_como_fecha(self, red):
        # La plantilla trae la salida como fecha de Excel (no como texto): tiene que entenderse igual
        filas = [["origen", "destino", "carga", "cliente", "peso_t", "salida"],
                 ["Bogotá", "Cartagena", "Café", "ACME", 5, pd.Timestamp("2026-11-25 06:00").to_pydatetime()]]
        data = _importar(red, _xlsx(filas))
        assert data["valid"] == 1, data
        assert data["results"][0]["departure_at"] == "2026-11-25T06:00"

    def test_una_celda_obligatoria_vacia_dice_que_falta(self, red):
        archivo = _csv(f"{CABECERA}\n"
                       "Bogotá;Cartagena;Café;ACME;;2026-11-25 06:00\n"
                       "Bogotá;Cartagena;Café;ACME;5;\n")
        filas = _importar(red, archivo)["results"]
        assert not filas[0]["ok"] and "Falta peso_t" in filas[0]["error"]
        assert not filas[1]["ok"] and "Falta la fecha de salida" in filas[1]["error"]

    def test_un_archivo_vacio_se_rechaza(self, red):
        with pytest.raises(OperationError) as exc:
            _importar(red, _csv(f"{CABECERA}\n"))
        assert "no tiene filas" in str(exc.value)

    def test_un_archivo_danado_se_informa(self, red):
        with pytest.raises(OperationError):
            _importar(red, ("envios.csv", "###"))
        with pytest.raises(OperationError) as exc:
            _importar(red, ("envios.xlsx", base64.b64encode(b"esto no es un xlsx").decode()))
        assert "No se pudo leer el archivo" in str(exc.value)

    def test_mas_de_quinientas_filas_se_rechaza_antes_de_validar(self, red):
        # Todas las filas traen una ciudad que no existe: si el tope se moviera detrás de la validación,
        # el error sería el de las filas y no el del tamaño
        filas = [CABECERA] + [f"Atlántida;Cali;Carga {i};Cliente;5;2026-11-20 08:00" for i in range(501)]
        with pytest.raises(OperationError) as exc:
            _importar(red, _csv("\n".join(filas) + "\n"))
        assert "501 filas" in str(exc.value) and "máximo por carga es 500" in str(exc.value)


class TestVistaPreviaYConfirmacion:
    """La regla de oro: sin confirmar no se escribe nada; al confirmar, solo lo válido y con su línea en el historial."""

    TEXTO = (f"{CABECERA}\n"
             "Bogotá;Cartagena;Repuestos para pruebas;Taller Central;8;2026-11-25 06:00\n"
             "Atlántida;Cartagena;Carga perdida;Taller Central;8;2026-11-25 06:00\n")

    def test_la_vista_previa_no_guarda_y_la_confirmacion_crea_solo_lo_valido(self, red):
        antes = _envios()
        previa = _importar(red, _csv(self.TEXTO))
        assert previa["committed"] is False and previa["created"] == []
        assert previa["rows"] == 2 and previa["valid"] == 1 and previa["errors"] == 1
        assert _envios() == antes, "la vista previa no puede escribir envíos"
        # Las filas se numeran como en la hoja: el encabezado es la 1
        assert [r["row"] for r in previa["results"]] == [2, 3]
        assert previa["results"][0]["ok"] and not previa["results"][1]["ok"]
        assert "Ubicación desconocida" in previa["results"][1]["error"]

        confirmada = _importar(red, _csv(self.TEXTO), commit=True)
        assert confirmada["committed"] is True and len(confirmada["created"]) == 1
        codigo = confirmada["created"][0]
        assert _envios() == antes + 1
        fila = db.fetch_all("SELECT shipment_code, weight_t, source, created_by, client, route_status "
                            "FROM mm_shipments WHERE shipment_code = ?", (codigo,))[0]
        assert fila["weight_t"] == pytest.approx(8)
        assert fila["source"] == "manual" and fila["created_by"] == "Tester"
        assert fila["client"] == "Taller Central" and fila["route_status"] == "ok"

    def test_la_carga_confirmada_queda_en_el_historial(self, red):
        nombre, contenido = _csv(self.TEXTO, nombre="lote-de-prueba.csv")
        shipments_io.import_shipments(red, nombre, contenido, "Tester", AHORA, True)
        log = db.fetch_all("SELECT username, action, table_name, detail FROM audit_log "
                           "WHERE action = 'IMPORT' ORDER BY audit_id DESC LIMIT 1")[0]
        assert log["username"] == "Tester" and log["table_name"] == "mm_shipments"
        assert "lote-de-prueba.csv" in log["detail"]
        assert "1 envío(s) creados" in log["detail"] and "1 con error" in log["detail"]

    def test_sin_filas_validas_no_deja_linea_de_importacion(self, red):
        antes = db.fetch_all("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'IMPORT'")[0]["n"]
        malo = _csv(f"{CABECERA}\nAtlántida;Cali;X;Y;5;2026-11-25 06:00\n")
        data = _importar(red, malo, commit=True)
        assert data["created"] == [] and data["valid"] == 0
        despues = db.fetch_all("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'IMPORT'")[0]["n"]
        assert despues == antes, "una carga sin envíos creados no debe registrarse como importación"

    def test_las_columnas_opcionales_guian_la_ruta(self, red):
        archivo = _csv(f"{CABECERA};modos;vias\n"
                       "Bogotá;Cartagena;Combustible;Caribe;20;2026-11-25 06:00;;Río Magdalena\n"
                       "Bogotá;Buenaventura;Café;Exportadora;20;2026-11-25 06:00;terrestre;\n")
        previa = _importar(red, archivo)
        assert previa["valid"] == 2, previa
        # El modo forzado y la vía forzada ya se ven en la vista previa
        assert previa["results"][1]["modes"] == ["terrestre"]
        assert "fluvial" in previa["results"][0]["modes"]
        # Y al confirmar, la ruta guardada cumple lo mismo
        creada = _importar(red, archivo, commit=True)
        assert len(creada["created"]) == 2
        guardadas = []
        for code in creada["created"]:
            row = db.fetch_all("SELECT route_json FROM mm_shipments WHERE shipment_code = ?", (code,))[0]
            guardadas.append(json.loads(row["route_json"]))
        assert all(lg["mode"] == "terrestre" for lg in guardadas[1]["legs"])
        assert "Río Magdalena" in {c for lg in guardadas[0]["legs"] for c in lg["corridors"]}


class TestMensajesDeLasFilas:
    """Cada fila mala explica qué corregir; las buenas de la misma carga se guardan igual."""

    def test_peso_prioridad_y_modo_invalidos_se_explican_por_fila(self, red):
        archivo = _csv(f"{CABECERA};prioridad;modos\n"
                       "Bogotá;Cali;A;Cliente;no-es-numero;2026-11-20 08:00;;\n"
                       "Bogotá;Cali;B;Cliente;5;2026-11-20 08:00;carísima;\n"
                       "Bogotá;Cali;C;Cliente;5;2026-11-20 08:00;;barco\n")
        filas = _importar(red, archivo)["results"]
        assert [f["row"] for f in filas] == [2, 3, 4]
        assert "peso_t debe ser un número" in filas[0]["error"]
        assert "Prioridad inválida" in filas[1]["error"]
        assert "Modo inválido: barco" in filas[2]["error"]

    def test_una_carga_demasiado_pesada_se_rechaza_por_fila(self, red):
        # El tope del formulario (20.000 t) vale igual en la carga masiva
        archivo = _csv(f"{CABECERA}\nBogotá;Cartagena;Pesada;Cliente;20001;2026-11-20 08:00\n")
        fila = _importar(red, archivo)["results"][0]
        assert not fila["ok"] and "20.000 t" in fila["error"]

    def test_un_modo_que_no_llega_a_destino_se_informa_sin_crear(self, red):
        # Mitú solo se alcanza por aire: forzar terrestre deja la carga sin enlaces posibles
        archivo = _csv(f"{CABECERA};modos\nMitú;Bogotá;Pesada;Cliente;5;2026-11-20 08:00;terrestre\n")
        data = _importar(red, archivo, commit=True)
        assert data["valid"] == 0 and data["created"] == []
        assert "No hay enlaces que admitan esta carga" in data["results"][0]["error"]


class TestPlantilla:
    """La plantilla que se descarga es la misma que la carga entiende (si no, el usuario copia columnas que fallan)."""

    def test_la_plantilla_trae_columnas_instrucciones_y_formato(self):
        wb = load_workbook(io.BytesIO(shipments_io.template()))
        assert wb.sheetnames == ["Envíos", "Instrucciones"]
        ws = wb["Envíos"]
        encabezados = [c.value for c in ws[1]]
        assert encabezados == ["origen", "destino", "carga", "cliente", "peso_t", "salida", *shipments_io.OPTIONAL]
        assert ws.freeze_panes == "A2"
        assert ws.max_row >= 3, "la plantilla trae filas de ejemplo"
        instrucciones = wb["Instrucciones"]
        assert instrucciones["A1"].value == "Columna"
        assert any("500 filas" in str(c.value) for fila in instrucciones.iter_rows() for c in fila)
