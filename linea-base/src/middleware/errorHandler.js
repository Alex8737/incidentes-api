/**
 * MANEJO CENTRAL DE EXCEPCIONES
 * Todas las rutas terminan aquí cuando hay un error. Se traduce cada tipo de excepción
 * (de Express, de validación propia, del ORM o de la base) a un código HTTP coherente,
 * con un formato JSON único. Los errores 5xx NO exponen detalles internos al cliente:
 * se registran en consola con un id de referencia que sí se devuelve para soporte.
 */
const crypto = require('crypto');
const {
  ValidationError, UniqueConstraintError, ForeignKeyConstraintError,
  ConnectionError, TimeoutError, DatabaseError
} = require('sequelize');

function clasificar(err) {
  // 1) Errores propios (AppError) ya traen su código
  if (err.name === 'AppError') {
    return { estado: err.statusCode, mensaje: err.message, detalles: err.details };
  }
  // 2) Errores del parser JSON de Express
  if (err.type === 'entity.parse.failed') {
    return { estado: 400, mensaje: 'El cuerpo de la petición no es un JSON válido' };
  }
  if (err.type === 'entity.too.large') {
    return { estado: 413, mensaje: 'El cuerpo de la petición es demasiado grande' };
  }
  // 3) Errores del ORM (el orden importa: UniqueConstraintError hereda de ValidationError)
  if (err instanceof UniqueConstraintError) {
    return { estado: 409, mensaje: 'El registro ya existe', detalles: err.errors?.map(e => ({ campo: e.path, mensaje: 'Valor duplicado' })) };
  }
  if (err instanceof ValidationError) {
    return {
      estado: 400,
      mensaje: 'Datos de incidente inválidos',
      detalles: err.errors.map(e => ({ campo: e.path, mensaje: e.message }))
    };
  }
  if (err instanceof ForeignKeyConstraintError) {
    return { estado: 409, mensaje: 'Conflicto con datos relacionados' };
  }
  if (err instanceof ConnectionError || err instanceof TimeoutError) {
    return { estado: 503, mensaje: 'Servicio de base de datos no disponible. Intente más tarde.', interno: true };
  }
  if (err instanceof DatabaseError) {
    return { estado: 500, mensaje: 'Error interno del servidor', interno: true };
  }
  // 4) Cualquier otra excepción no controlada
  const estado = err.statusCode || err.status || 500;
  return { estado, mensaje: estado >= 500 ? 'Error interno del servidor' : err.message, interno: estado >= 500 };
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const { estado, mensaje, detalles, interno } = clasificar(err);
  const respuesta = { mensaje, estado };

  if (detalles && detalles.length) respuesta.detalles = detalles;

  if (interno || estado >= 500) {
    respuesta.referencia = crypto.randomUUID();
    // Solo el servidor ve el detalle técnico (nunca el cliente)
    if (process.env.NODE_ENV !== 'test') {
      console.error(`[${respuesta.referencia}] ${req.method} ${req.originalUrl} ->`, err);
    }
  }

  res.status(estado).json({ ok: false, error: respuesta });
}

module.exports = errorHandler;
module.exports.clasificar = clasificar;
