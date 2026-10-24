const { Router } = require('express');
const { login, perfil } = require('../controllers/auth.controller');
const { validarLogin } = require('../middleware/validarLogin');
const { autenticar } = require('../middleware/auth');
const crearLimiteLogin = require('../middleware/limiteLogin');
const env = require('../config/env');

const router = Router();

const limiteLogin = crearLimiteLogin({ max: env.LOGIN_MAX_INTENTOS, ventanaMs: env.LOGIN_VENTANA_MIN * 60 * 1000 });

router.post('/login', limiteLogin, validarLogin, login);
router.get('/me', autenticar, perfil);

module.exports = router;
