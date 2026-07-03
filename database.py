"""
database.py
Maneja la conexión a SQLite y la creación del esquema inicial
para el Gestor de Turnos de Barbería.
"""

import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent / "turnos.db"


def get_connection():
    """Devuelve una conexión a la base de datos con las filas como diccionarios."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    """Crea las tablas si no existen y carga servicios de ejemplo."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS servicios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            duracion_minutos INTEGER NOT NULL,
            precio REAL NOT NULL
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS turnos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cliente_nombre TEXT NOT NULL,
            cliente_telefono TEXT NOT NULL,
            servicio_id INTEGER NOT NULL,
            fecha TEXT NOT NULL,        -- formato YYYY-MM-DD
            hora TEXT NOT NULL,         -- formato HH:MM
            estado TEXT NOT NULL DEFAULT 'confirmado',  -- confirmado | cancelado
            creado_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (servicio_id) REFERENCES servicios (id)
        )
    """)

    # Si la tabla de servicios está vacía, cargamos datos de ejemplo
    cursor.execute("SELECT COUNT(*) FROM servicios")
    if cursor.fetchone()[0] == 0:
        servicios_iniciales = [
            ("Corte de cabello", 30, 4500.0),
            ("Arreglo de barba", 20, 3000.0),
            ("Combo (corte + barba)", 45, 7000.0),
            ("Corte + lavado", 40, 5500.0),
            ("Afeitado clásico", 25, 3500.0),
        ]
        cursor.executemany(
            "INSERT INTO servicios (nombre, duracion_minutos, precio) VALUES (?, ?, ?)",
            servicios_iniciales,
        )

    conn.commit()
    conn.close()


if __name__ == "__main__":
    init_db()
    print(f"Base de datos inicializada en: {DB_PATH}")
