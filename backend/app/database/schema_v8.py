"""
schema_v8.py
Registro de aceptaciones (prueba de la autorización, Ley 1581 de 2012 y Decreto 1074 de 2015).

- mm_consents: cada vez que alguien acepta (o revoca) un documento o una declaración: qué documento y en qué
  versión, el texto exacto de la casilla, desde qué formulario, quién (nombre declarado y un identificador de
  navegador al azar), cuándo y desde dónde (la IP no se guarda: solo un resumen irreversible con sal secreta).
  Las filas no se editan ni se borran: una revocación es otra fila con accepted = 0.

- mm_client_errors: errores de JavaScript que ocurren en los navegadores (mensaje, pila, página sin parámetros,
  navegador), para enterarse de un fallo sin que nadie lo reporte. Se conservan los últimos 500.

Es aditivo: solo crea tablas e índices si faltan.
"""

SCHEMA_V8_SQL = """
CREATE TABLE IF NOT EXISTS mm_consents (
    consent_id    INTEGER PRIMARY KEY AUTOINCREMENT,
    browser_id    TEXT    NOT NULL,
    subject       TEXT    NOT NULL,
    document      TEXT    NOT NULL,
    version       TEXT    NOT NULL,
    accepted      INTEGER NOT NULL CHECK (accepted IN (0, 1)),
    checkbox_text TEXT    NOT NULL,
    context       TEXT    NOT NULL,
    ip_hash       TEXT,
    user_agent    TEXT,
    created_at    TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_consents_browser ON mm_consents (browser_id, document, created_at);
CREATE INDEX IF NOT EXISTS ix_consents_created ON mm_consents (created_at);

CREATE TABLE IF NOT EXISTS mm_client_errors (
    error_id   INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL,
    path       TEXT NOT NULL,
    message    TEXT NOT NULL,
    stack      TEXT,
    user_agent TEXT,
    release    TEXT
);
"""


def apply_v8_migration(conn):
    conn.executescript(SCHEMA_V8_SQL)
    conn.commit()
