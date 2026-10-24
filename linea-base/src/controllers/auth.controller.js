/**
 * CONTROLADOR DE AUTENTICACIÓN
 * El login responde con el mismo mensaje si el usuario no existe o la clave es incorrecta,
 * para no revelar qué cuentas existen.
 */
const bcrypt = require('bcryptjs');
const { Usuario } = require('../models');
const { firmar } = require('../middleware/auth');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

// Hash de relleno: se compara aunque el usuario no exista (tiempo de respuesta parejo)
const HASH_RELLENO = bcrypt.hashSync('relleno-no-usable', 10);

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
    datos: cuenta
  });
});

const perfil = asyncHandler(async (req, res) => {
  res.json({ ok: true, datos: req.usuario });
});

module.exports = { login, perfil };
