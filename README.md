# Gestor de Turnos — Barbería

Aplicación web full stack para la gestión de turnos de una barbería. Permite a los clientes reservar un turno eligiendo servicio, fecha y horario disponible, y le da al barbero un panel para ver y cancelar los turnos del día.

Proyecto personal desarrollado para practicar desarrollo backend, frontend y diseño de bases de datos relacionales.

## Demo

| Vista del cliente | Panel del barbero |
|---|---|
| Selección de servicio, fecha y horario disponible | Listado de turnos por día con opción de cancelar |

## Funcionalidades

- **Catálogo de servicios**: corte, barba, combos, etc., con duración y precio.
- **Cálculo de horarios disponibles en tiempo real**: el sistema genera los horarios libres según la duración del servicio elegido y los turnos ya confirmados ese día.
- **Validación de superposición de turnos**: el backend rechaza cualquier reserva que se cruce con un turno existente, incluso si dos personas intentan reservar al mismo tiempo.
- **Panel de administración**: el barbero puede ver los turnos confirmados de cualquier fecha y cancelarlos.
- **Cancelación lógica**: los turnos cancelados no se borran de la base, se marcan como `cancelado` (mejor trazabilidad).

## Stack técnico

| Capa | Tecnología |
|---|---|
| Backend | Python + Flask |
| Base de datos | SQLite |
| Frontend | HTML, CSS y JavaScript (vanilla, sin frameworks) |
| API | REST, JSON |

## Arquitectura del proyecto

```
gestor-turnos/
├── app.py              # Backend Flask: rutas, API REST y lógica de negocio
├── database.py         # Conexión y creación del esquema de SQLite
├── requirements.txt    # Dependencias del proyecto
├── templates/
│   ├── index.html       # Vista de reserva (cliente)
│   └── panel.html        # Vista de administración (barbero)
└── static/
    ├── css/estilos.css
    └── js/
        ├── cliente.js     # Lógica de reserva (consumo de la API)
        └── panel.js        # Lógica del panel del barbero
```

## La parte técnica más interesante: evitar turnos superpuestos

El desafío principal del proyecto fue garantizar que nunca se pisen dos turnos, incluso con servicios de distinta duración. Cada vez que se pide un turno, el backend:

1. Convierte los horarios a minutos desde medianoche para poder compararlos numéricamente.
2. Recorre los turnos confirmados de ese día y chequea si el rango `[inicio, fin]` del nuevo turno se solapa con alguno existente.
3. Si hay superposición, rechaza la reserva con un error `409 Conflict` antes de tocar la base de datos.

Esta misma función se reutiliza para calcular en tiempo real qué horarios mostrarle al cliente como disponibles, así nunca ve un horario que después el servidor le rechazaría.

## Cómo correrlo localmente

```bash
# 1. Clonar el repositorio
git clone https://github.com/TU_USUARIO/gestor-turnos.git
cd gestor-turnos

# 2. Crear entorno virtual (opcional pero recomendado)
python -m venv venv
source venv/bin/activate      # En Windows: venv\Scripts\activate

# 3. Instalar dependencias
pip install -r requirements.txt

# 4. Ejecutar la aplicación
python app.py
```

La aplicación va a estar disponible en `http://127.0.0.1:5000`.
La base de datos SQLite (`turnos.db`) se crea automáticamente la primera vez que se ejecuta, con algunos servicios de ejemplo ya cargados.

- Vista del cliente: `http://127.0.0.1:5000/`
- Panel del barbero: `http://127.0.0.1:5000/panel`

## Posibles mejoras a futuro

- [ ] Autenticación para el panel del barbero (login)
- [ ] Notificación por WhatsApp/email al confirmar un turno
- [ ] Migración a SQL Server / PostgreSQL para un entorno de producción
- [ ] Vista de calendario semanal en el panel
- [ ] Tests automatizados (pytest)

## Autor

**Rafael Ruiz**
Estudiante de Ingeniería en Informática — Universidad Nacional de La Matanza
[LinkedIn](https://www.linkedin.com/in/rafael-ruiz-58a569309/)
