/**
 * Envuelve un controlador async para que cualquier excepción (p. ej. de la base de datos)
 * llegue al manejador central de errores con next(err). Express 4 no lo hace solo.
 */
module.exports = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
