/**
 * CONTROLADOR DE AUTENTICACIÓN
 * El login responde con el mismo mensaje si el usuario no existe o la clave es incorrecta,
 * para no revelar qué cuentas existen.
 * Las respuestas incluyen los PERMISOS del rol (src/models/permisos.js): así el front-end
 * no tiene que adivinar qué acciones mostrar; la seguridad real sigue estando en el servidor.
 */
const bcrypt = require('bcryptjs');
const { Usuario } = require('../models');
const { permisosDe } = require('../models/permisos');
const { firmar } = require('../middleware/auth');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

// Hash de relleno: se compara aunque el usuario no exista (tiempo de respuesta parejo)
const HASH_RELLENO = bcrypt.hashSync('relleno-no-usable', 10);

/** Datos públicos de la cuenta + permisos de su rol (toJSON ya quita el hash). */
const datosPublicos = cuenta => ({ ...cuenta.toJSON(), permisos: permisosDe(cuenta.rol) });

const login = asyncHandler(async (req, res) => {
  const { usuario, password } = req.body;
  const cuenta = await Usuario.scope('conPassword').findOne({ where: { usuario } });

  const hash = cuenta ? cuenta.passwordHash : HASH_RELLENO;
  const claveOk = await bcrypt.compare(password, hash);

  if (!cuenta || !claveOk || !cuenta.activo) {
    throw new AppError('Usuario o contraseña incorrectos', 401);
  }

  res.json({
    ok: true,
    mensaje: 'Sesión iniciada',
    token: firmar(cuenta),
    datos: datosPublicos(cuenta)
  });
});

const perfil = (req, res) => {
  res.json({ ok: true, datos: datosPublicos(req.usuario) });
};

module.exports = { login, perfil };
