/**
 * VALIDACIÓN Y LIMPIEZA DEL LOGIN
 * Se rechazan campos extra (asignación masiva) y se limita el tamaño de cada dato.
 */
const AppError = require('../utils/AppError');

const CAMPOS = ['usuario', 'password'];

function validarLogin(req, res, next) {
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return next(new AppError('El cuerpo debe ser un objeto JSON', 400));
  }

  const errores = [];
  Object.keys(body)
    .filter(c => !CAMPOS.includes(c))
    .forEach(c => errores.push({ campo: c, mensaje: 'Campo no permitido' }));

  if (typeof body.usuario !== 'string' || body.usuario.trim().length < 3 || body.usuario.trim().length > 40) {
    errores.push({ campo: 'usuario', mensaje: 'Debe tener entre 3 y 40 caracteres' });
  }
  if (typeof body.password !== 'string' || body.password.length < 8 || body.password.length > 100) {
    errores.push({ campo: 'password', mensaje: 'Debe tener entre 8 y 100 caracteres' });
  }
  if (errores.length) return next(new AppError('Datos de acceso inválidos', 400, errores));

  // Sanitización: el nombre de usuario se normaliza; la contraseña se usa tal cual
  body.usuario = body.usuario.trim().toLowerCase();
  next();
}

module.exports = { validarLogin };
