/**
 * MANEJO CENTRAL DE EXCEPCIONES
 * Todas las rutas terminan aquí cuando hay un error. Se traduce cada tipo de excepción
 * (de Express, de validación propia, del ORM o de la base) a un código HTTP coherente,
 * con un formato JSON único. Los errores 5xx NO exponen detalles internos al cliente:
 * se registran en consola con un id de referencia que sí se devuelve para soporte.
 */
const crypto = require('crypto');
const log = require('../utils/log');
const {
  ValidationError, UniqueConstraintError, ForeignKeyConstraintError,
  ConnectionError, TimeoutError, DatabaseError
} = require('sequelize');

/**
 * Clasificadores en ORDEN: el primero cuya condición se cumpla decide la respuesta.
 * El orden importa: UniqueConstraintError hereda de ValidationError, así que va antes.
 * Cada entrada es [¿aplica a este error?, cómo se traduce].
 */
const CLASIFICADORES = [
  // 1) Errores propios (AppError) ya traen su código
  [err => err.name === 'AppError', err => ({ estado: err.statusCode, mensaje: err.message, detalles: err.details })],
  // 2) Errores del parser JSON de Express
  [err => err.type === 'entity.parse.failed', () => ({ estado: 400, mensaje: 'El cuerpo de la petición no es un JSON válido' })],
  [err => err.type === 'entity.too.large', () => ({ estado: 413, mensaje: 'El cuerpo de la petición es demasiado grande' })],
  // 3) Errores del ORM
  [err => err instanceof UniqueConstraintError, err => ({
    estado: 409, mensaje: 'El registro ya existe', detalles: err.errors?.map(e => ({ campo: e.path, mensaje: 'Valor duplicado' }))
  })],
  [err => err instanceof ValidationError, err => ({
    estado: 400, mensaje: 'Datos de incidente inválidos', detalles: err.errors.map(e => ({ campo: e.path, mensaje: e.message }))
  })],
  [err => err instanceof ForeignKeyConstraintError, () => ({ estado: 409, mensaje: 'Conflicto con datos relacionados' })],
  [err => err instanceof ConnectionError || err instanceof TimeoutError, () => ({
    estado: 503, mensaje: 'Servicio de base de datos no disponible. Intente más tarde.', interno: true
  })],
  [err => err instanceof DatabaseError, () => ({ estado: 500, mensaje: 'Error interno del servidor', interno: true })]
];

/** 4) Cualquier otra excepción no controlada: el mensaje original solo se muestra si NO es un error 5xx. */
function clasificarDesconocido(err) {
  const estado = err.statusCode || err.status || 500;
  return { estado, mensaje: estado >= 500 ? 'Error interno del servidor' : err.message, interno: estado >= 500 };
}

function clasificar(err) {
  const encontrado = CLASIFICADORES.find(([aplica]) => aplica(err));
  return encontrado ? encontrado[1](err) : clasificarDesconocido(err);
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const { estado, mensaje, detalles, interno } = clasificar(err);
  const respuesta = { mensaje, estado };

  if (detalles && detalles.length) respuesta.detalles = detalles;

  if (interno || estado >= 500) {
    // La referencia es el id de la solicitud (cabecera X-Request-Id): une lo que ve la persona con el log.
    respuesta.referencia = req.id || crypto.randomUUID();
    // Solo el servidor ve el detalle técnico (nunca el cliente)
    if (process.env.NODE_ENV !== 'test') {
      log.error('error no controlado', {
        referencia: respuesta.referencia, metodo: req.method, url: req.originalUrl.split('?')[0], ...log.describirError(err)
      });
    }
  }

  res.status(estado).json({ ok: false, error: respuesta });
}

module.exports = errorHandler;
module.exports.clasificar = clasificar;
