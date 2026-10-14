"""
colombia_ciudades.py
Categorías de ciudades y municipios para filtrar el mapa y el simulador.

- principal:      capitales de departamento y los grandes centros logísticos.
- dificil_acceso: municipios sin vía terrestre conectada a la red (solo se llega
                  por río, mar o aire). Se calcula a partir de la red, no a mano,
                  de modo que sigue siendo válido al sumar más municipios.
- municipio:      el resto.

No se inventan vías: un municipio solo entra a la red si tiene una conexión real.
"""
from __future__ import annotations

CATEGORIES = ("principal", "municipio", "dificil_acceso")

CATEGORY_LABELS = {"principal": "Ciudades principales", "municipio": "Municipios",
                   "dificil_acceso": "Difícil acceso"}

PRINCIPALES = frozenset({
    "Bogotá", "Medellín", "Cali", "Barranquilla", "Cartagena", "Bucaramanga", "Santa Marta",
    "Cúcuta", "Pereira", "Manizales", "Ibagué", "Pasto", "Neiva", "Villavicencio", "Armenia",
    "Montería", "Valledupar", "Sincelejo", "Popayán", "Tunja", "Buenaventura", "Barrancabermeja",
    "Riohacha", "Florencia", "Yopal", "Quibdó", "Leticia",
    # Resto de capitales: con los 27 anteriores completan los 32 departamentos y Bogotá.
    "Arauca", "Mocoa", "San José del Guaviare", "Inírida", "Mitú", "Puerto Carreño", "San Andrés",
    # Centros logísticos regionales
    "Cartago", "Tuluá", "Girardot", "Sogamoso", "Duitama", "Ocaña", "Maicao", "Ipiales", "Tumaco",
    "Apartadó", "Pitalito", "Soacha", "Rionegro",
})


def category_of(city: str, modes: list[str]) -> str:
    """Categoría de una ciudad según su nombre y los modos que la sirven."""
    if "terrestre" not in modes and "ferreo" not in modes:
        return "dificil_acceso"
    return "principal" if city in PRINCIPALES else "municipio"
