/**
 * MIDDLEWARE HTTP DE VALIDACIÓN DEL LOGIN
 * Las reglas (campos permitidos, longitudes, normalización del usuario) están en
 * src/models/usuario.reglas.js, que se prueba sin servidor.
 */
const AppError = require('../utils/AppError');
const { esObjetoPlano } = require('../models/incidente.reglas');
const { validarCredenciales, normalizarCredenciales } = require('../models/usuario.reglas');

function validarLogin(req, res, next) {
  if (!esObjetoPlano(req.body)) {
    next(new AppError('El cuerpo debe ser un objeto JSON', 400));
    return;
  }
  const errores = validarCredenciales(req.body);
  if (errores.length) {
    next(new AppError('Datos de acceso inválidos', 400, errores));
    return;
  }
  req.body = normalizarCredenciales(req.body);
  next();
}

module.exports = { validarLogin };
