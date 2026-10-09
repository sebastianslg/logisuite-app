"""
dispatch.py
Generación de envíos multimodales y cálculo de su estado en el tiempo.

El estado de un envío no es un valor fijo: se deriva del reloj real a partir
de su salida, su duración total, su retraso operativo y las ventanas de
transbordo de su ruta. Así la tabla de envíos y la telemetría de flota
siempre coinciden:

    antes de la salida                  -> Programado
    dentro de una ventana de transbordo -> Transferencia Modal
    pasado el ETA con retraso pendiente -> Retrasado
    en tránsito                         -> En Ruta
    después de la llegada real          -> Entregado

Los clientes y transportadores son ficticios.
"""
from __future__ import annotations

import json
import math
import random
from datetime import datetime, timedelta

from app.engine.multimodal import MultimodalNetwork, RoutingError

# origen, destino, carga, peso mínimo t, peso máximo t, prioridad, cliente
TEMPLATES = [
    ("Leticia", "Cartagena", "Pescado amazónico refrigerado", 4, 8, "tiempo", "Amazonía Fresh"),
    ("Leticia", "Bogotá", "Frutas amazónicas (copoazú, arazá)", 3, 6, "balanceado", "Amazonía Fresh"),
    ("Bogotá", "Leticia", "Medicamentos y vacunas", 2, 5, "tiempo", "Farma Andes"),
    ("Puerto Asís", "Leticia", "Víveres e insumos de construcción", 150, 320, "costo", "Abastos del Sur"),
    ("Buenaventura", "Bogotá", "Contenedor 40' de importación", 22, 28, "balanceado", "Andina Retail"),
    ("Bogotá", "Buenaventura", "Café excelso de exportación", 25, 30, "costo", "Cafés de la Cordillera"),
    ("Cartagena", "Bogotá", "Contenedor de importación (electrónica)", 18, 26, "balanceado", "Andina Retail"),
    ("Medellín", "Cartagena", "Textiles de exportación", 18, 24, "balanceado", "Textiles del Aburrá"),
    ("Cali", "Cartagena", "Azúcar refinada a granel", 800, 1500, "costo", "Ingenios del Valle"),
    ("Barranquilla", "Barrancabermeja", "Fertilizante NPK a granel", 600, 1000, "costo", "Agroinsumos Caribe"),
    ("Barrancabermeja", "Cartagena", "Combustibles líquidos", 800, 1100, "costo", "Caribe Energía"),
    ("Chiriguaná", "Santa Marta", "Carbón térmico de exportación", 1500, 2400, "costo", "Minera del Cesar"),
    ("Medellín", "Bogotá", "Electrodomésticos", 15, 20, "balanceado", "Hogar Total"),
    ("Cali", "Medellín", "Confitería y chocolates", 12, 18, "balanceado", "Dulces del Pacífico"),
    ("Bucaramanga", "Barranquilla", "Productos avícolas refrigerados", 10, 16, "tiempo", "Avícola Santandereana"),
    ("Neiva", "Bogotá", "Arroz paddy", 25, 32, "costo", "Molinos del Huila"),
    ("Pasto", "Cali", "Lácteos", 8, 12, "tiempo", "Lácteos de Nariño"),
    ("Bogotá", "Santa Marta", "Maquinaria agrícola", 20, 30, "balanceado", "Agromaq"),
    ("Villavicencio", "Bogotá", "Ganado en pie", 14, 18, "tiempo", "Llanos Ganaderos"),
    ("Cartagena", "Medellín", "Resinas plásticas", 24, 30, "costo", "Polímeros Andinos"),
    ("Bogotá", "Cartagena", "Flores de exportación", 6, 10, "tiempo", "Flores de la Sabana"),
    ("Cali", "Bogotá", "Contenedor refrigerado", 18, 24, "balanceado", "Frío Andino"),
]

TRUCK_CLASSES = [(35, "Tractomula 3S3"), (18, "Dobletroque"), (10, "Camión Sencillo"), (5, "Turbo NPR")]
VESSELS_SEA = ["MV Caribe Star", "MV Bahía de Cartagena", "MV Pacífico Andino", "MV Sierra Nevada"]
CONVOYS = ["Convoy Magdalena 03", "Convoy Magdalena 07", "Convoy Dique 02", "Convoy Putumayo 01"]


def _plate(rng: random.Random) -> str:
    letters = "ABCDEFGHJKLMNPRSTUVWXYZ"
    return (rng.choice("STWXUQKG") + rng.choice(letters) + rng.choice(letters)
            + "-" + f"{rng.randint(100, 999)}")


def _asset_for(mode: str, weight_t: float, rng: random.Random) -> dict:
    if mode == "terrestre":
        cls = next((c for cap, c in reversed(TRUCK_CLASSES) if cap >= weight_t), "Tractomula 3S3")
        units = math.ceil(weight_t / 35) if weight_t > 35 else 1
        return {"id": _plate(rng), "type": cls, "units": units,
                "carrier": rng.choice(["Transandina Cargo", "Llanos Express", "Carga Segura del Norte"])}
    if mode == "aereo":
        return {"id": f"LS {rng.randint(700, 799)}", "type": "Carguero B737-800BCF", "units": 1,
                "carrier": "Andes Air Cargo"}
    if mode == "fluvial":
        return {"id": rng.choice(CONVOYS), "type": "Convoy de barcazas", "units": 1,
                "carrier": "Fluvial del Magdalena"}
    if mode == "maritimo":
        return {"id": rng.choice(VESSELS_SEA), "type": "Buque de cabotaje", "units": 1,
                "carrier": "Caribe Shipping Line"}
    return {"id": f"Tren {rng.randint(10, 60)}", "type": "Tren de carga", "units": 1,
            "carrier": "Ferrocarril del Norte"}


def build_shipment(network: MultimodalNetwork, template: tuple, departure: datetime,
                   seq: int, rng: random.Random, delay_h: float = 0.0) -> dict:
    origin, dest, cargo, wmin, wmax, priority, client = template
    weight = round(rng.uniform(wmin, wmax), 1 if wmax < 50 else 0)
    route = network.route(origin, dest, weight, priority)
    for leg in route["legs"]:
        leg["asset"] = _asset_for(leg["mode"], weight, rng)
    eta = departure + timedelta(hours=route["time_h"])
    return {
        "shipment_code": f"LS-{departure:%y%m}-{seq:04d}",
        "origin_city": origin, "dest_city": dest, "cargo": cargo, "weight_t": weight,
        "priority": priority, "client": client,
        "departure_at": departure.isoformat(timespec="minutes"),
        "eta_at": eta.isoformat(timespec="minutes"),
        "delay_h": round(delay_h, 1),
        "distance_km": route["distance_km"], "total_time_h": route["time_h"],
        "total_cost": route["cost"], "modes": ",".join(route["modes"]),
        "n_transfers": route["n_transfers"],
        "route_json": json.dumps({k: route[k] for k in ("legs", "transfers", "timeline")}),
        "created_at": datetime.now().isoformat(timespec="minutes"),
    }


def status_at(shipment: dict, now: datetime, route: dict = None) -> dict:
    """Estado, avance (0-1) y hora de ruta del envío en el instante `now`."""
    departure = datetime.fromisoformat(shipment["departure_at"])
    total = float(shipment["total_time_h"]) or 1e-6
    delay = float(shipment.get("delay_h") or 0.0)
    elapsed = (now - departure).total_seconds() / 3600
    if elapsed < 0:
        return {"status": "Programado", "progress": 0.0, "route_h": 0.0}
    if elapsed >= total + delay:
        return {"status": "Entregado", "progress": 1.0, "route_h": total}
    # El retraso estira el recorrido: la carga avanza más lento que lo planeado
    route_h = elapsed * total / (total + delay)
    if route is None:
        route = json.loads(shipment["route_json"])
    in_transfer = any(t["start_h"] <= route_h < t["start_h"] + t["time_h"]
                      for t in route.get("transfers", []))
    if in_transfer:
        status = "Transferencia Modal"
    elif delay > 0 and elapsed > total:
        status = "Retrasado"
    else:
        status = "En Ruta"
    return {"status": status, "progress": route_h / total, "route_h": route_h}


def generate_initial_shipments(network: MultimodalNetwork, now: datetime, seed: int = 2610) -> list:
    """Carga inicial: historial entregado, envíos en tránsito (algunos en
    transbordo y otros retrasados) y despachos programados."""
    rng = random.Random(seed)
    shipments, seq = [], 1

    def add(template, departure, delay=0.0):
        nonlocal seq
        try:
            s = build_shipment(network, template, departure, seq, rng, delay)
        except RoutingError:
            return None
        seq += 1
        shipments.append(s)
        return s

    # Historial: 12 entregados en los últimos 20 días; dos llegaron tarde
    for i in range(12):
        t = TEMPLATES[i % len(TEMPLATES)]
        add(t, now - timedelta(days=rng.uniform(12, 20)), delay=6.0 if i in (3, 8) else 0.0)

    # En tránsito: cada plantilla una vez, a mitad de camino. Los tres primeros
    # con transbordo quedan dentro de su ventana para que haya cargas en
    # "Transferencia Modal" desde el arranque.
    in_transfer = 0
    for i, t in enumerate(TEMPLATES):
        probe = add(t, now)  # se recalcula la salida con la duración real
        if probe is None:
            continue
        total = probe["total_time_h"]
        route = json.loads(probe["route_json"])
        if route["transfers"] and in_transfer < 3:
            in_transfer += 1
            tr = route["transfers"][0]
            elapsed = tr["start_h"] + tr["time_h"] * 0.5
            delay = 0.0
        elif i % 5 == 4:
            # Retrasado: ya pasó el ETA y aún no llega
            delay = round(total * 0.25 + 4, 1)
            elapsed = total + delay * 0.5
        else:
            elapsed = total * rng.uniform(0.15, 0.85)
            delay = 0.0
        departure = now - timedelta(hours=elapsed)
        probe["departure_at"] = departure.isoformat(timespec="minutes")
        probe["eta_at"] = (departure + timedelta(hours=total)).isoformat(timespec="minutes")
        probe["delay_h"] = delay

    # Programados: salen en las próximas 72 horas
    for i in range(6):
        t = TEMPLATES[(i * 5 + 3) % len(TEMPLATES)]
        add(t, now + timedelta(hours=rng.uniform(4, 72)))

    for s in shipments:
        s["status"] = status_at(s, now)["status"]
    return shipments
