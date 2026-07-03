"""
app.py
Backend Flask del Gestor de Turnos para Barbería.

Expone:
  - Vistas HTML (cliente y panel del barbero)
  - API REST en JSON para servicios y turnos
"""

from datetime import datetime, timedelta
from flask import Flask, render_template, request, jsonify
from database import get_connection, init_db

app = Flask(__name__)

HORA_APERTURA = "09:00"
HORA_CIERRE = "19:00"


# ---------------------------------------------------------------------------
# Helpers de lógica de negocio
# ---------------------------------------------------------------------------

def _a_minutos(hhmm: str) -> int:
    """Convierte 'HH:MM' a minutos desde medianoche, para comparar horarios fácil."""
    h, m = map(int, hhmm.split(":"))
    return h * 60 + m


def hay_superposicion(fecha, hora_inicio, duracion_minutos, conn, turno_id_excluir=None):
    """
    Revisa si un nuevo turno se solaparía con otro turno ya confirmado
    el mismo día. Se usa tanto al crear como al reprogramar un turno.
    """
    inicio_nuevo = _a_minutos(hora_inicio)
    fin_nuevo = inicio_nuevo + duracion_minutos

    query = """
        SELECT t.id, t.hora, s.duracion_minutos
        FROM turnos t
        JOIN servicios s ON s.id = t.servicio_id
        WHERE t.fecha = ? AND t.estado = 'confirmado'
    """
    params = [fecha]
    if turno_id_excluir is not None:
        query += " AND t.id != ?"
        params.append(turno_id_excluir)

    for fila in conn.execute(query, params).fetchall():
        inicio_existente = _a_minutos(fila["hora"])
        fin_existente = inicio_existente + fila["duracion_minutos"]
        # Dos rangos se superponen si uno empieza antes de que el otro termine
        if inicio_nuevo < fin_existente and inicio_existente < fin_nuevo:
            return True
    return False


def generar_horarios_disponibles(fecha, duracion_minutos, conn):
    """Genera la lista de horarios libres para una fecha y servicio dados."""
    inicio_jornada = _a_minutos(HORA_APERTURA)
    fin_jornada = _a_minutos(HORA_CIERRE)
    hoy = datetime.now().strftime("%Y-%m-%d")
    hora_actual = _a_minutos(datetime.now().strftime("%H:%M")) if fecha == hoy else 0
    inicio_jornada = max(inicio_jornada, hora_actual)
    paso = 15  # los turnos se ofrecen cada 15 minutos

    disponibles = []
    actual = inicio_jornada
    while actual + duracion_minutos <= fin_jornada:
        hh = f"{actual // 60:02d}:{actual % 60:02d}"
        if not hay_superposicion(fecha, hh, duracion_minutos, conn):
            disponibles.append(hh)
        actual += paso
    return disponibles


# ---------------------------------------------------------------------------
# Vistas (HTML)
# ---------------------------------------------------------------------------

@app.route("/")
def index():
    """Página de reserva de turnos para el cliente."""
    return render_template("index.html")


@app.route("/panel")
def panel():
    """Panel de administración para el barbero."""
    return render_template("panel.html")


# ---------------------------------------------------------------------------
# API: Servicios
# ---------------------------------------------------------------------------

@app.route("/api/servicios", methods=["GET"])
def listar_servicios():
    conn = get_connection()
    servicios = conn.execute("SELECT * FROM servicios ORDER BY id").fetchall()
    conn.close()
    return jsonify([dict(s) for s in servicios])


@app.route("/api/servicios", methods=["POST"])
def crear_servicio():
    datos = request.get_json(silent=True) or {}
    nombre = datos.get("nombre", "").strip()
    duracion = datos.get("duracion_minutos")
    precio = datos.get("precio")

    if not nombre or not duracion or precio is None:
        return jsonify({"error": "Se requieren nombre, duracion_minutos y precio"}), 400
    if int(duracion) <= 0 or float(precio) < 0:
        return jsonify({"error": "Duración debe ser mayor a 0 y precio no puede ser negativo"}), 400

    conn = get_connection()
    cursor = conn.execute(
        "INSERT INTO servicios (nombre, duracion_minutos, precio) VALUES (?, ?, ?)",
        (nombre, int(duracion), float(precio))
    )
    conn.commit()
    nuevo_id = cursor.lastrowid
    conn.close()
    return jsonify({"mensaje": "Servicio creado", "id": nuevo_id}), 201


@app.route("/api/servicios/<int:servicio_id>", methods=["PUT"])
def editar_servicio(servicio_id):
    datos = request.get_json(silent=True) or {}
    nombre = datos.get("nombre", "").strip()
    duracion = datos.get("duracion_minutos")
    precio = datos.get("precio")

    if not nombre or not duracion or precio is None:
        return jsonify({"error": "Se requieren nombre, duracion_minutos y precio"}), 400
    if int(duracion) <= 0 or float(precio) < 0:
        return jsonify({"error": "Duración debe ser mayor a 0 y precio no puede ser negativo"}), 400

    conn = get_connection()
    servicio = conn.execute("SELECT id FROM servicios WHERE id = ?", (servicio_id,)).fetchone()
    if servicio is None:
        conn.close()
        return jsonify({"error": "Servicio no encontrado"}), 404

    conn.execute(
        "UPDATE servicios SET nombre = ?, duracion_minutos = ?, precio = ? WHERE id = ?",
        (nombre, int(duracion), float(precio), servicio_id)
    )
    conn.commit()
    conn.close()
    return jsonify({"mensaje": "Servicio actualizado"})


@app.route("/api/servicios/<int:servicio_id>", methods=["DELETE"])
def eliminar_servicio(servicio_id):
    conn = get_connection()
    servicio = conn.execute("SELECT id FROM servicios WHERE id = ?", (servicio_id,)).fetchone()
    if servicio is None:
        conn.close()
        return jsonify({"error": "Servicio no encontrado"}), 404

    # No permitir eliminar si tiene turnos confirmados futuros
    hoy = datetime.now().strftime("%Y-%m-%d")
    turnos_activos = conn.execute(
        "SELECT COUNT(*) FROM turnos WHERE servicio_id = ? AND estado = 'confirmado' AND fecha >= ?",
        (servicio_id, hoy)
    ).fetchone()[0]

    if turnos_activos > 0:
        conn.close()
        return jsonify({
            "error": f"No se puede eliminar: hay {turnos_activos} turno(s) confirmado(s) con este servicio."
        }), 409

    conn.execute("DELETE FROM servicios WHERE id = ?", (servicio_id,))
    conn.commit()
    conn.close()
    return jsonify({"mensaje": "Servicio eliminado"})


# ---------------------------------------------------------------------------
# API: Horarios disponibles
# ---------------------------------------------------------------------------

@app.route("/api/horarios-disponibles", methods=["GET"])
def horarios_disponibles():
    fecha = request.args.get("fecha")
    servicio_id = request.args.get("servicio_id")

    if not fecha or not servicio_id:
        return jsonify({"error": "Se requieren los parámetros 'fecha' y 'servicio_id'"}), 400

    conn = get_connection()
    servicio = conn.execute(
        "SELECT * FROM servicios WHERE id = ?", (servicio_id,)
    ).fetchone()

    if servicio is None:
        conn.close()
        return jsonify({"error": "Servicio no encontrado"}), 404

    horarios = generar_horarios_disponibles(fecha, servicio["duracion_minutos"], conn)
    conn.close()
    return jsonify({"fecha": fecha, "horarios": horarios})


# ---------------------------------------------------------------------------
# API: Turnos
# ---------------------------------------------------------------------------

@app.route("/api/turnos", methods=["GET"])
def listar_turnos():
    """Lista turnos, opcionalmente filtrados por fecha. Usado por el panel del barbero."""
    fecha = request.args.get("fecha")

    conn = get_connection()
    query = """
        SELECT t.id, t.cliente_nombre, t.cliente_telefono, t.fecha, t.hora, t.estado,
               s.nombre AS servicio_nombre, s.duracion_minutos, s.precio
        FROM turnos t
        JOIN servicios s ON s.id = t.servicio_id
        WHERE t.estado = 'confirmado'
    """
    params = []
    if fecha:
        query += " AND t.fecha = ?"
        params.append(fecha)
    query += " ORDER BY t.fecha, t.hora"

    turnos = conn.execute(query, params).fetchall()
    conn.close()
    return jsonify([dict(t) for t in turnos])


@app.route("/api/turnos", methods=["POST"])
def crear_turno():
    """Reserva un nuevo turno, validando que no se superponga con otro."""
    datos = request.get_json(silent=True) or {}

    campos_requeridos = ["cliente_nombre", "cliente_telefono", "servicio_id", "fecha", "hora"]
    faltantes = [c for c in campos_requeridos if not datos.get(c)]
    if faltantes:
        return jsonify({"error": f"Faltan campos requeridos: {', '.join(faltantes)}"}), 400

    conn = get_connection()
    servicio = conn.execute(
        "SELECT * FROM servicios WHERE id = ?", (datos["servicio_id"],)
    ).fetchone()

    if servicio is None:
        conn.close()
        return jsonify({"error": "El servicio seleccionado no existe"}), 404

    # Validación clave: que el horario siga libre (por si dos personas reservan a la vez)
    if hay_superposicion(datos["fecha"], datos["hora"], servicio["duracion_minutos"], conn):
        conn.close()
        return jsonify({"error": "Ese horario ya no está disponible. Elegí otro."}), 409

    cursor = conn.execute(
        """
        INSERT INTO turnos (cliente_nombre, cliente_telefono, servicio_id, fecha, hora)
        VALUES (?, ?, ?, ?, ?)
        """,
        (
            datos["cliente_nombre"],
            datos["cliente_telefono"],
            datos["servicio_id"],
            datos["fecha"],
            datos["hora"],
        ),
    )
    conn.commit()
    nuevo_id = cursor.lastrowid
    conn.close()

    return jsonify({"mensaje": "Turno reservado con éxito", "turno_id": nuevo_id}), 201


@app.route("/api/turnos/<int:turno_id>", methods=["DELETE"])
def cancelar_turno(turno_id):
    """Cancela (no borra físicamente) un turno. Usado por el panel del barbero."""
    conn = get_connection()
    turno = conn.execute("SELECT * FROM turnos WHERE id = ?", (turno_id,)).fetchone()

    if turno is None:
        conn.close()
        return jsonify({"error": "Turno no encontrado"}), 404

    conn.execute("UPDATE turnos SET estado = 'cancelado' WHERE id = ?", (turno_id,))
    conn.commit()
    conn.close()

    return jsonify({"mensaje": "Turno cancelado correctamente"})


# ---------------------------------------------------------------------------

if __name__ == "__main__":
    init_db()
    app.run(debug=True, port=5000)
