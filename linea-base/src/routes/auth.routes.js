const { Router } = require('express');
const { login, perfil } = require('../controllers/auth.controller');
const { validarLogin } = require('../middleware/validarLogin');
const { autenticar } = require('../middleware/auth');

const router = Router();

router.post('/login', validarLogin, login);
router.get('/me', autenticar, perfil);

module.exports = router;
