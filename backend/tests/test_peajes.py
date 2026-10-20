"""
Pruebas de la tabla de peajes: lectura de valores en pesos y validación de la carga de archivos.
No escriben en la base: la carga real se verifica con la API.
Ejecución: pytest -v  (desde backend/)
"""
import base64

import pytest

from app.engine import tolls
from app.engine.common import OperationError


class TestPesos:

    @pytest.mark.parametrize("entrada, esperado", [
        (29400, 29400.0),
        (29400.0, 29400.0),
        ("29400", 29400.0),
        ("$ 29.400", 29400.0),
        ("29,400", 29400.0),
    ])
    def test_acepta_formatos_de_pesos(self, entrada, esperado):
        assert tolls._pesos(entrada) == esperado

    def test_rechaza_negativos_vacios_y_texto(self):
        for malo in (-1, None, "", "gratis"):
            with pytest.raises(OperationError):
                tolls._pesos(malo)


class TestCargaDeArchivos:

    def test_csv_sin_columna_de_peaje_se_rechaza_antes_de_tocar_la_base(self):
        contenido = base64.b64encode(b"link_id,otra\n1,2\n").decode()
        with pytest.raises(OperationError, match="peaje_cop"):
            tolls.import_file("peajes.csv", contenido, "prueba")

    def test_excel_sin_link_id_se_rechaza(self):
        import io
        import pandas as pd
        buf = io.BytesIO()
        pd.DataFrame({"peaje_cop": [1000]}).to_excel(buf, index=False)
        contenido = base64.b64encode(buf.getvalue()).decode()
        with pytest.raises(OperationError, match="link_id"):
            tolls.import_file("peajes.xlsx", contenido, "prueba")
