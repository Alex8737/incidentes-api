/**
 * MIDDLEWARE HTTP DE VALIDACIÓN (primera capa, antes de llegar al ORM)
 *
 * Solo traduce entre Express y las reglas: las reglas de negocio viven en
 * src/models/incidente.reglas.js (funciones puras, con pruebas unitarias).
 *   - validarIncidente: body de POST / PUT (completo) y PATCH (parcial)
 *   - validarId:        :id entero positivo
 *   - validarFiltros:   query string de GET /incidentes
 */
const AppError = require('../utils/AppError');
const reglas = require('../models/incidente.reglas');

function validarIncidente(completo = true) {
  return (req, res, next) => {
    const body = req.body;

    if (!reglas.esObjetoPlano(body)) {
      next(new AppError('El cuerpo debe ser un objeto JSON', 400));
    } else if (!completo && Object.keys(body).length === 0) {
      next(new AppError('Debe enviar al menos un campo para actualizar', 400));
    } else {
      const errores = reglas.validarIncidente(body, { completo });
      if (errores.length > 0) {
        next(new AppError('Datos de incidente inválidos', 400, errores));
      } else {
        // Sanitización: recortar espacios; reportadoPor vacío -> valor por defecto del modelo
        req.body = reglas.normalizarIncidente(body);
        next();
      }
    }
  };
}

/** Valida que :id sea un entero positivo */
function validarId(req, res, next) {
  const { id } = req.params;
  next(reglas.esIdValido(id) ? undefined : new AppError(`El id "${id}" no es válido`, 400));
}

/** Valida los filtros y la paginación de GET /incidentes */
function validarFiltros(req, res, next) {
  const errores = reglas.validarFiltros(req.query);
  next(errores.length ? new AppError('Parámetros de consulta inválidos', 400, errores) : undefined);
}

module.exports = { validarIncidente, validarId, validarFiltros, CAMPOS_PERMITIDOS: reglas.CAMPOS_EDITABLES };
