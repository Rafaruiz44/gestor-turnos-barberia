/**
 * panel.js
 * Panel del barbero: gestión de turnos y de servicios (CRUD completo).
 */

// ── Turnos ──────────────────────────────────────────────────────────────────

const elFiltroFecha = document.getElementById("filtro-fecha");
const elListaTurnos = document.getElementById("lista-turnos");

const hoy = new Date().toISOString().split("T")[0];
elFiltroFecha.value = hoy;

async function cargarTurnos() {
  elListaTurnos.innerHTML = `<p class="vacio">Cargando turnos...</p>`;
  const params = new URLSearchParams({ fecha: elFiltroFecha.value });
  const respuesta = await fetch(`/api/turnos?${params}`);
  const turnos = await respuesta.json();

  if (turnos.length === 0) {
    elListaTurnos.innerHTML = `<p class="vacio">No hay turnos reservados para este día.</p>`;
    return;
  }

  elListaTurnos.innerHTML = "";
  turnos.forEach((turno) => {
    const item = document.createElement("div");
    item.className = "turno-item";
    item.innerHTML = `
      <div style="display:flex; align-items:center;">
        <span class="turno-hora">${turno.hora}</span>
        <div class="turno-info">
          <strong>${turno.cliente_nombre}</strong>
          <span>${turno.servicio_nombre} · ${turno.duracion_minutos} min · $${turno.precio.toLocaleString("es-AR")} · Tel: ${turno.cliente_telefono}</span>
        </div>
      </div>
      <button class="btn-cancelar" data-id="${turno.id}">Cancelar</button>
    `;
    elListaTurnos.appendChild(item);
  });

  document.querySelectorAll(".btn-cancelar").forEach((btn) => {
    btn.addEventListener("click", () => cancelarTurno(btn.dataset.id));
  });
}

async function cancelarTurno(id) {
  if (!confirm("¿Seguro que querés cancelar este turno?")) return;
  await fetch(`/api/turnos/${id}`, { method: "DELETE" });
  cargarTurnos();
}

elFiltroFecha.addEventListener("change", cargarTurnos);
cargarTurnos();


// ── Servicios ────────────────────────────────────────────────────────────────

const elListaServicios  = document.getElementById("lista-servicios");
const elFormTitulo      = document.getElementById("form-titulo");
const elNombre          = document.getElementById("srv-nombre");
const elDuracion        = document.getElementById("srv-duracion");
const elPrecio          = document.getElementById("srv-precio");
const elBtnGuardar      = document.getElementById("btn-guardar-servicio");
const elBtnCancelarForm = document.getElementById("btn-cancelar-form");
const elMsgServicio     = document.getElementById("msg-servicio");

let editandoId = null; // null = modo "nuevo", número = modo "editar"

async function cargarServicios() {
  const respuesta = await fetch("/api/servicios");
  const servicios = await respuesta.json();

  elListaServicios.innerHTML = "";

  if (servicios.length === 0) {
    elListaServicios.innerHTML = `<p class="vacio">No hay servicios cargados.</p>`;
    return;
  }

  servicios.forEach((s) => {
    const fila = document.createElement("div");
    fila.className = "servicio-fila";
    fila.innerHTML = `
      <div class="servicio-fila-info">
        <strong>${s.nombre}</strong>
        <span>${s.duracion_minutos} min · $${s.precio.toLocaleString("es-AR")}</span>
      </div>
      <div class="servicio-fila-acciones">
        <button class="btn-editar" data-id="${s.id}" data-nombre="${s.nombre}" data-duracion="${s.duracion_minutos}" data-precio="${s.precio}">Editar</button>
        <button class="btn-eliminar" data-id="${s.id}">Eliminar</button>
      </div>
    `;
    elListaServicios.appendChild(fila);
  });

  document.querySelectorAll(".btn-editar").forEach((btn) => {
    btn.addEventListener("click", () => {
      // Cerrar cualquier formulario inline anterior
      document.querySelectorAll(".form-inline-editar").forEach(f => f.remove());

      editandoId = parseInt(btn.dataset.id);

      // Crear el formulario inline
      const form = document.createElement("div");
      form.className = "form-inline-editar";
      form.innerHTML = `
        <label>Nombre</label>
        <input type="text" class="ei-nombre" value="${btn.dataset.nombre}">
        <label>Duración (minutos)</label>
        <input type="number" class="ei-duracion" min="5" step="5" value="${btn.dataset.duracion}">
        <label>Precio ($)</label>
        <input type="number" class="ei-precio" min="0" step="100" value="${btn.dataset.precio}">
        <div style="display:flex; gap:0.6rem; margin-top:0.8rem;">
          <button class="btn-primario ei-guardar" style="margin:0; flex:1;">Guardar</button>
          <button class="btn-secundario ei-cancelar">Cancelar</button>
        </div>
        <div class="ei-msg"></div>
      `;

      // Insertarlo debajo de la fila del servicio
      btn.closest(".servicio-fila").after(form);

      // Guardar
      form.querySelector(".ei-guardar").addEventListener("click", async () => {
        const nombre   = form.querySelector(".ei-nombre").value.trim();
        const duracion = parseInt(form.querySelector(".ei-duracion").value);
        const precio   = parseFloat(form.querySelector(".ei-precio").value);

        if (!nombre || !duracion || isNaN(precio)) {
          form.querySelector(".ei-msg").innerHTML = `<div class="mensaje error" style="margin-top:0.5rem;">Completá todos los campos.</div>`;
          return;
        }

        const respuesta = await fetch(`/api/servicios/${editandoId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nombre, duracion_minutos: duracion, precio })
        });
        const datos = await respuesta.json();

        if (!respuesta.ok) {
          form.querySelector(".ei-msg").innerHTML = `<div class="mensaje error" style="margin-top:0.5rem;">${datos.error}</div>`;
          return;
        }

        form.remove();
        editandoId = null;
        cargarServicios();
      });

      // Cancelar
      form.querySelector(".ei-cancelar").addEventListener("click", () => {
        form.remove();
        editandoId = null;
      });
    });
  });

  document.querySelectorAll(".btn-eliminar").forEach((btn) => {
    btn.addEventListener("click", () => eliminarServicio(parseInt(btn.dataset.id)));
  });
}

async function guardarServicio() {
  const nombre   = elNombre.value.trim();
  const duracion = parseInt(elDuracion.value);
  const precio   = parseFloat(elPrecio.value);

  if (!nombre || !duracion || isNaN(precio)) {
    mostrarMsgServicio("Completá todos los campos.", "error");
    return;
  }

  const url    = "/api/servicios";
  const metodo = "POST";

  const respuesta = await fetch(url, {
    method: metodo,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nombre, duracion_minutos: duracion, precio })
  });

  const datos = await respuesta.json();

  if (!respuesta.ok) {
    mostrarMsgServicio(datos.error || "Error al guardar.", "error");
    return;
  }

  mostrarMsgServicio(datos.mensaje, "exito");
  resetForm();
  cargarServicios();
}

async function eliminarServicio(id) {
  if (!confirm("¿Seguro que querés eliminar este servicio?")) return;

  const respuesta = await fetch(`/api/servicios/${id}`, { method: "DELETE" });
  const datos = await respuesta.json();

  if (!respuesta.ok) {
    mostrarMsgServicio(datos.error, "error");
    return;
  }

  mostrarMsgServicio(datos.mensaje, "exito");
  cargarServicios();
}

function resetForm() {
  editandoId = null;
  elNombre.value   = "";
  elDuracion.value = "";
  elPrecio.value   = "";
  elFormTitulo.textContent = "Nuevo servicio";
  elBtnCancelarForm.style.display = "none";
}

function mostrarMsgServicio(texto, tipo) {
  elMsgServicio.innerHTML = `<div class="mensaje ${tipo}" style="margin-top:0.8rem;">${texto}</div>`;
  setTimeout(() => { elMsgServicio.innerHTML = ""; }, 3500);
}

elBtnGuardar.addEventListener("click", guardarServicio);
elBtnCancelarForm.addEventListener("click", () => {
  resetForm();
  elMsgServicio.innerHTML = "";
});

cargarServicios();
