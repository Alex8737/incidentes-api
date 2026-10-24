/**
 * AUTENTICACIÓN Y AUTORIZACIÓN
 * - autenticar:  exige "Authorization: Bearer <token>" válido (firma, expiración, usuario activo).
 * - autorizar:   exige que el rol del usuario esté en la lista permitida.
 * Respuestas: 401 = no autenticado / token inválido; 403 = autenticado pero sin permiso.
 */
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { Usuario } = require('../models');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

const ALGORITMO = 'HS256';

function firmar(usuario) {
  return jwt.sign(
    { sub: usuario.id, rol: usuario.rol },
    env.JWT_SECRET,
    { algorithm: ALGORITMO, expiresIn: env.JWT_EXPIRA, issuer: 'incidentes-api' }
  );
}

const autenticar = asyncHandler(async (req, res, next) => {
  const cabecera = req.headers.authorization || '';
  const [esquema, token] = cabecera.split(' ');
  if (esquema !== 'Bearer' || !token) {
    throw new AppError('Debe iniciar sesión para continuar', 401);
  }

  let payload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET, { algorithms: [ALGORITMO], issuer: 'incidentes-api' });
  } catch {
    // No se indica si expiró o si la firma no coincide
    throw new AppError('Sesión no válida o expirada. Inicie sesión de nuevo', 401);
  }

  // Se vuelve a consultar la base: si la cuenta fue desactivada, el token deja de servir
  const usuario = await Usuario.findByPk(payload.sub);
  if (!usuario || !usuario.activo) {
    throw new AppError('Sesión no válida o expirada. Inicie sesión de nuevo', 401);
  }

  req.usuario = usuario;
  next();
});

/** Uso: autorizar('admin', 'analista') */
const autorizar = (...rolesPermitidos) => (req, res, next) => {
  const permitido = req.usuario && rolesPermitidos.includes(req.usuario.rol);
  next(permitido ? undefined : new AppError('No tiene permisos para realizar esta acción', 403));
};

module.exports = { autenticar, autorizar, firmar };
