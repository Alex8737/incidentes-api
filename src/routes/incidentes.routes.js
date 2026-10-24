const { Router } = require('express');
const ctrl = require('../controllers/incidentes.controller');
const { validarIncidente, validarId, validarFiltros } = require('../middleware/validarIncidente');
const { autenticar, autorizar } = require('../middleware/auth');
const { rolesPara } = require('../models/permisos');

const router = Router();

// Todas las rutas de incidentes exigen sesión iniciada
router.use(autenticar);

// Permisos por rol (única fuente de verdad: src/models/permisos.js):
//   visor     -> solo lectura (GET)
//   analista  -> lectura + crear y modificar
//   admin     -> todo, incluido eliminar
const puedeEscribir = autorizar(...rolesPara('escribir'));
const puedeEliminar = autorizar(...rolesPara('eliminar'));

// Rutas fijas ANTES de /:id para que no se confundan con un id
router.get('/stats', ctrl.estadisticas);
router.get('/catalogos', ctrl.catalogos);

router.route('/')
  .get(validarFiltros, ctrl.listar)
  .post(puedeEscribir, validarIncidente(true), ctrl.crear);

router.route('/:id')
  .all(validarId)
  .get(ctrl.obtener)
  .put(puedeEscribir, validarIncidente(true), ctrl.reemplazar)
  .patch(puedeEscribir, validarIncidente(false), ctrl.actualizar)
  .delete(puedeEliminar, ctrl.eliminar);

module.exports = router;
