/**
 * cliente.js
 * Maneja la página de reserva de turnos: carga servicios, consulta horarios
 * disponibles según fecha + servicio elegidos, y envía la reserva.
 */

const elServiciosGrid = document.getElementById("servicios-grid");
const elFecha = document.getElementById("fecha");
const elHorariosGrid = document.getElementById("horarios-grid");
const elNombre = document.getElementById("nombre");
const elTelefono = document.getElementById("telefono");
const elBtnReservar = document.getElementById("btn-reservar");
const elMensaje = document.getElementById("mensaje-resultado");

let servicios = [];
let servicioSeleccionadoId = null;
let horarioSeleccionado = null;

// La fecha mínima seleccionable es hoy
const hoy = new Date().toISOString().split("T")[0];
elFecha.min = hoy;
elFecha.value = hoy;

async function cargarServicios() {
  const respuesta = await fetch("/api/servicios");
  servicios = await respuesta.json();

  elServiciosGrid.innerHTML = "";
  servicios.forEach((servicio) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "servicio-card";
    card.innerHTML = `
      <strong>${servicio.nombre}</strong>
      <span>${servicio.duracion_minutos} min · $${servicio.precio.toLocaleString("es-AR")}</span>
    `;
    card.addEventListener("click", () => seleccionarServicio(servicio.id, card));
    elServiciosGrid.appendChild(card);
  });
}

function seleccionarServicio(id, cardEl) {
  servicioSeleccionadoId = id;
  document
    .querySelectorAll(".servicio-card")
    .forEach((c) => c.classList.remove("seleccionado"));
  cardEl.classList.add("seleccionado");
  horarioSeleccionado = null;
  cargarHorarios();
}

async function cargarHorarios() {
  if (!servicioSeleccionadoId || !elFecha.value) {
    elHorariosGrid.innerHTML = "";
    return;
  }

  elHorariosGrid.innerHTML = `<p class="vacio">Buscando horarios...</p>`;

  const params = new URLSearchParams({
    fecha: elFecha.value,
    servicio_id: servicioSeleccionadoId,
  });
  const respuesta = await fetch(`/api/horarios-disponibles?${params}`);
  const datos = await respuesta.json();

  elHorariosGrid.innerHTML = "";

  if (!datos.horarios || datos.horarios.length === 0) {
    elHorariosGrid.innerHTML = `<p class="vacio">No hay horarios disponibles ese día. Probá con otra fecha.</p>`;
    actualizarBotonReservar();
    return;
  }

  datos.horarios.forEach((hora) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "horario-btn";
    btn.textContent = hora;
    btn.addEventListener("click", () => seleccionarHorario(hora, btn));
    elHorariosGrid.appendChild(btn);
  });

  actualizarBotonReservar();
}

function seleccionarHorario(hora, btnEl) {
  horarioSeleccionado = hora;
  document
    .querySelectorAll(".horario-btn")
    .forEach((b) => b.classList.remove("seleccionado"));
  btnEl.classList.add("seleccionado");
  actualizarBotonReservar();
}

function actualizarBotonReservar() {
  const listo =
    servicioSeleccionadoId &&
    horarioSeleccionado &&
    elNombre.value.trim() &&
    elTelefono.value.trim();
  elBtnReservar.disabled = !listo;
}

async function reservarTurno() {
  elBtnReservar.disabled = true;
  elMensaje.innerHTML = "";

  const cuerpo = {
    cliente_nombre: elNombre.value.trim(),
    cliente_telefono: elTelefono.value.trim(),
    servicio_id: servicioSeleccionadoId,
    fecha: elFecha.value,
    hora: horarioSeleccionado,
  };

  try {
    const respuesta = await fetch("/api/turnos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo),
    });
    const datos = await respuesta.json();

    if (!respuesta.ok) {
      mostrarMensaje(datos.error || "No se pudo reservar el turno.", "error");
      // Si el horario ya no está disponible, refrescamos la lista
      cargarHorarios();
      return;
    }

    mostrarMensaje(
      `¡Turno confirmado para el ${cuerpo.fecha} a las ${cuerpo.hora}! Te esperamos.`,
      "exito"
    );
    elNombre.value = "";
    elTelefono.value = "";
    horarioSeleccionado = null;
    cargarHorarios();
  } catch (error) {
    mostrarMensaje("Error de conexión. Intentá nuevamente.", "error");
  } finally {
    actualizarBotonReservar();
  }
}

function mostrarMensaje(texto, tipo) {
  elMensaje.innerHTML = `<div class="mensaje ${tipo}">${texto}</div>`;
}

elFecha.addEventListener("change", cargarHorarios);
elNombre.addEventListener("input", actualizarBotonReservar);
elTelefono.addEventListener("input", actualizarBotonReservar);
elBtnReservar.addEventListener("click", reservarTurno);

cargarServicios();
