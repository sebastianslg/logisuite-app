"""
search.py
Búsqueda global de la paleta (Ctrl K): envíos, vehículos, bodegas y clientes en una sola llamada.

Se resuelve en el servidor con SQL parametrizado: cuatro consultas cortas con LIKE y un tope de
filas por tipo, para no traer las tablas enteras al navegador. Los comodines `%` y `_` del texto
del usuario se escapan con `ESCAPE '\\'`, así que se buscan como letras y no como comodines.

Tildes y mayúsculas: el LIKE de SQLite ignora las mayúsculas solo en ASCII (`LOWER('Á')` devuelve
'Á') y no normaliza tildes. Por eso la comparación se hace sobre columnas plegadas (minúsculas y
sin tildes) y con el texto del usuario plegado igual: así «bogota», «Bogotá» y «BOGOTÁ» encuentran
lo mismo, y «narino» encuentra «Nariño». No se pliegan otras letras (ç, å, …): deben coincidir tal
cual. Sin ese plegado, «bogota» no encontraría «Bogotá» y «BOGOTÁ» tampoco.

Parte de la paleta (B4): el contrato de la respuesta es
{"query": "<q recortado>", "items": [{"type", "title", "subtitle", "href"}], "truncated": bool},
con los tipos en el orden envíos, vehículos, bodegas y clientes. `truncated` avisa que algún tipo
tenía más coincidencias que el límite y quedaron por fuera.
"""
from __future__ import annotations

from urllib.parse import quote

from app.database.db import fetch_all

LIMITE_POR_DEFECTO = 5
LIMITE_MINIMO, LIMITE_MAXIMO = 1, 10
LARGO_MINIMO = 2  # con una sola letra la respuesta sería media base y no ayuda a elegir

# Letras que se pliegan para comparar: vocales con tilde, diéresis y ñ, en sus dos formas. La
# ñ se pliega a n porque en una búsqueda la gente escribe «narino» y espera encontrar «Nariño».
_CON_TILDE = "áéíóúüñÁÉÍÓÚÜÑ"
_SIN_TILDE = "aeiouunaeiouun"


def _plegado(columna: str) -> str:
    """Expresión SQL de una columna en minúsculas y sin tildes, para comparar sin depender de
    cómo la escribió el usuario ni de cómo quedó guardada.

    Los reemplazos van uno por letra antes del LOWER porque SQLite solo pasa a minúsculas las
    letras ASCII; se cubren las dos formas (mayúscula y minúscula) para que un dato guardado como
    «BOGOTÁ» también coincida. La tabla más grande aquí son los envíos (cientos de filas), así que
    expresar el plegado en SQL sale más barato que traer las filas a Python."""
    expresion = columna
    for con_tilde, sin_tilde in zip(_CON_TILDE, _SIN_TILDE):
        expresion = f"REPLACE({expresion}, '{con_tilde}', '{sin_tilde}')"
    return f"LOWER({expresion})"


def _patron(texto: str) -> str:
    """Patrón LIKE del texto del usuario: plegado y con sus comodines escapados."""
    plano = texto.translate(str.maketrans(_CON_TILDE, _SIN_TILDE)).lower()
    # La barra invertida va primero: si no, se escaparían los escapes que se acaban de poner.
    plano = plano.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{plano}%"


def _where(columnas: tuple[str, ...], patron: str) -> tuple[str, tuple]:
    """Cláusula WHERE que busca el mismo patrón en varias columnas, todas plegadas."""
    sql = " OR ".join(f"{_plegado(columna)} LIKE ? ESCAPE '\\'" for columna in columnas)
    return sql, (patron,) * len(columnas)


def search(q: str, limit: int = LIMITE_POR_DEFECTO) -> dict:
    """Busca `q` en envíos, vehículos, bodegas y clientes y devuelve las primeras coincidencias.

    `limit` es el tope por tipo (1 a 10; fuera de rango se recorta). Un texto de menos de dos
    caracteres tras recortar espacios devuelve una respuesta vacía sin tocar la base.

    Cada elemento lleva `type` (envio, vehiculo, bodega o cliente), `title`, un `subtitle` con el
    contexto y un `href` a la pantalla correspondiente. Los envíos salen del más reciente al más
    antiguo; los clientes, del que más envíos tiene al que menos. `truncated` es True cuando algún
    tipo tenía más coincidencias que el límite.
    """
    texto = (q or "").strip()
    try:
        tope = int(limit)
    except (TypeError, ValueError):
        tope = LIMITE_POR_DEFECTO
    tope = max(LIMITE_MINIMO, min(LIMITE_MAXIMO, tope))
    if len(texto) < LARGO_MINIMO:
        return {"query": texto, "items": [], "truncated": False}

    patron = _patron(texto)
    items: list[dict] = []
    truncated = False

    # Envíos: código, ciudades, carga y cliente (lo mismo que la búsqueda de la lista de envíos).
    where, params = _where(("shipment_code", "origin_city", "dest_city", "cargo", "client"), patron)
    filas = fetch_all(
        f"""SELECT shipment_code, origin_city, dest_city, client
            FROM mm_shipments
            WHERE {where}
            ORDER BY departure_at DESC, shipment_code
            LIMIT ?""",
        (*params, tope + 1),
    )
    truncated = len(filas) > tope
    for fila in filas[:tope]:
        items.append({
            "type": "envio",
            "title": fila["shipment_code"],
            "subtitle": f"{fila['origin_city']} → {fila['dest_city']} · {fila['client']}",
            "href": f"/envios/{fila['shipment_code']}",
        })

    # Vehículos: placa/código, tipo y marca/modelo cuando están registrados.
    where, params = _where(("code", "vehicle_type", "make", "model"), patron)
    filas = fetch_all(
        f"""SELECT vehicle_id, code, vehicle_type, make, model
            FROM fl_vehicles
            WHERE {where}
            ORDER BY code
            LIMIT ?""",
        (*params, tope + 1),
    )
    truncated = truncated or len(filas) > tope
    for fila in filas[:tope]:
        marca = " ".join(str(x) for x in (fila["make"], fila["model"]) if x)
        items.append({
            "type": "vehiculo",
            "title": fila["code"],
            "subtitle": f"{fila['vehicle_type']} · {marca}" if marca else fila["vehicle_type"],
            "href": f"/flota/{int(fila['vehicle_id'])}",
        })

    # Bodegas: nombre, ciudad y código.
    where, params = _where(("name", "city", "code"), patron)
    filas = fetch_all(
        f"""SELECT warehouse_id, code, name, city
            FROM wh_warehouses
            WHERE {where}
            ORDER BY name
            LIMIT ?""",
        (*params, tope + 1),
    )
    truncated = truncated or len(filas) > tope
    for fila in filas[:tope]:
        items.append({
            "type": "bodega",
            "title": fila["name"],
            "subtitle": f"{fila['code']} · {fila['city']}",
            "href": f"/bodegas/{int(fila['warehouse_id'])}",
        })

    # Clientes: el texto del envío (no hay tabla de clientes), con cuántos envíos tiene cada uno.
    where, params = _where(("client",), patron)
    filas = fetch_all(
        f"""SELECT client, COUNT(*) AS n
            FROM mm_shipments
            WHERE {where}
            GROUP BY client
            ORDER BY n DESC, client
            LIMIT ?""",
        (*params, tope + 1),
    )
    truncated = truncated or len(filas) > tope
    for fila in filas[:tope]:
        n = int(fila["n"])
        items.append({
            "type": "cliente",
            "title": fila["client"],
            "subtitle": f"{n} envío" if n == 1 else f"{n} envíos",
            # Codificado: el nombre puede llevar tildes o espacios y viaja en la consulta de la lista.
            "href": f"/envios?q={quote(fila['client'], safe='')}",
        })

    return {"query": texto, "items": items, "truncated": truncated}
