/**
 * REPOSITORIO: todas las CONSULTAS a la base de datos pasan por aquí.
 * El controlador no conoce SQL ni Sequelize; si mañana se cambia de ORM,
 * solo se reescribe este archivo. Las reglas (paginación, patrón de búsqueda,
 * resumen de estadísticas) están en src/models/incidente.reglas.js.
 */
const { Op, fn, col, literal } = require('sequelize');
const { sequelize, Incidente } = require('../models');
const { SEVERIDADES, PRIORIDADES } = require('../models/catalogos');
const reglas = require('../models/incidente.reglas');

// Orden lógico (no alfabético) para prioridad y severidad.
// Se construye solo con valores del catálogo (constantes) -> sin riesgo de inyección SQL.
const rango = (columna, valores) =>
  literal(`CASE ${columna} ${valores.map((v, i) => `WHEN '${v}' THEN ${i + 1}`).join(' ')} ELSE 0 END`);

const ORDEN_ESPECIAL = {
  prioridad: rango('prioridad', PRIORIDADES),
  severidad: rango('severidad', SEVERIDADES)
};

/**
 * Condición de búsqueda de texto (parámetro q).
 * Defecto corregido: antes se escapaba con "\" pero SQLite NO usa "\" como escape en LIKE
 * (hace falta la cláusula ESCAPE), así que "SRV_WEB" coincidía también con "SRVXWEB" y "100%" con "1000".
 * Ahora el patrón se escapa con "!" y la consulta declara ESCAPE '!'. El valor pasa por
 * sequelize.escape(): se entrecomilla y se duplican las comillas simples (sin concatenar texto crudo).
 */
function condicionTexto(texto) {
  const patron = sequelize.escape(reglas.patronBusqueda(texto));
  // LOWER(...) en ambos lados: en PostgreSQL LIKE distingue mayúsculas (SQLite y MySQL no); así se comporta igual en los tres.
  const como = columna => literal(`LOWER(${columna}) LIKE LOWER(${patron}) ESCAPE '${reglas.ESCAPE_LIKE}'`);
  return [como('titulo'), como('descripcion')];
}

/** Construye el WHERE a partir de los filtros validados. */
function construirWhere({ estado, prioridad, severidad, categoria, q }) {
  const where = {};
  if (estado) where.estado = estado;
  if (prioridad) where.prioridad = prioridad;
  if (severidad) where.severidad = severidad;
  if (categoria) where.categoria = categoria;
  if (q) where[Op.or] = condicionTexto(q);
  return where;
}

/** Lista con filtros, paginación y orden. Devuelve { total, pagina, limite, datos }. */
async function listar(filtros = {}) {
  const { pagina, limite, offset } = reglas.calcularPaginacion(filtros);
  const campoOrden = filtros.orden || 'fechaCreacion';
  const dir = (filtros.dir || 'desc').toUpperCase();

  const orden = ORDEN_ESPECIAL[campoOrden]
    ? [[ORDEN_ESPECIAL[campoOrden], dir], ['fechaCreacion', 'DESC']]
    : [[campoOrden, dir], ['id', 'DESC']];

  const { count, rows } = await Incidente.findAndCountAll({
    where: construirWhere(filtros),
    order: orden,
    limit: limite,
    offset
  });
  return { total: count, pagina, limite, datos: rows };
}

const buscarPorId = id => Incidente.findByPk(id);

const crear = datos => Incidente.create(datos, { fields: reglas.CAMPOS_EDITABLES });

/** Busca, aplica los cambios y guarda dentro de una transacción. Devuelve null si no existe. */
function modificar(id, cambios) {
  return sequelize.transaction(async transaction => {
    const incidente = await Incidente.findByPk(id, { transaction });
    if (!incidente) return null;
    incidente.set(cambios);
    incidente.changed('fechaActualizacion', true);
    return incidente.save({ fields: reglas.CAMPOS_EDITABLES, transaction });
  });
}

/** PUT: reemplazo total. Los campos opcionales no enviados vuelven a su valor por defecto. */
const reemplazar = (id, datos) => modificar(id, reglas.prepararReemplazo(datos));

/** PATCH: solo los campos enviados. */
const actualizar = (id, cambios) => modificar(id, cambios);

/** Devuelve true si eliminó, false si no existía. */
async function eliminar(id) {
  const filas = await Incidente.destroy({ where: { id } });
  return filas > 0;
}

/**
 * Totales del tablero con UNA sola consulta (GROUP BY estado, severidad, prioridad).
 * Antes eran 4 consultas (COUNT + 3 GROUP BY); ahora la base devuelve las combinaciones
 * (como máximo 4×4×4 = 64 filas) y las reglas las suman por cada dimensión.
 */
async function estadisticas() {
  const filas = await Incidente.findAll({
    attributes: ['estado', 'severidad', 'prioridad', [fn('COUNT', col('id')), 'cantidad']],
    group: ['estado', 'severidad', 'prioridad'],
    raw: true
  });
  return reglas.resumirConteos(filas);
}

module.exports = { listar, buscarPorId, crear, reemplazar, actualizar, eliminar, estadisticas };
