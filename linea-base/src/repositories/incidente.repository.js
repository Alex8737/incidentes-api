/**
 * REPOSITORIO: todas las CONSULTAS a la base de datos pasan por aquí.
 * El controlador no conoce SQL ni Sequelize; si mañana se cambia de ORM,
 * solo se reescribe este archivo.
 */
const { Op, fn, col, literal } = require('sequelize');
const { sequelize, Incidente } = require('../models');
const { SEVERIDADES, PRIORIDADES, ESTADOS } = require('../models/catalogos');

// Orden lógico (no alfabético) para prioridad y severidad.
// Se construye solo con valores del catálogo (constantes) -> sin riesgo de inyección SQL.
const rango = (columna, valores) =>
  literal(`CASE ${columna} ${valores.map((v, i) => `WHEN '${v}' THEN ${i + 1}`).join(' ')} ELSE 0 END`);

const ORDEN_ESPECIAL = {
  prioridad: rango('prioridad', PRIORIDADES),
  severidad: rango('severidad', SEVERIDADES)
};

/** Construye el WHERE a partir de los filtros validados. */
function construirWhere({ estado, prioridad, severidad, categoria, q }) {
  const where = {};
  if (estado) where.estado = estado;
  if (prioridad) where.prioridad = prioridad;
  if (severidad) where.severidad = severidad;
  if (categoria) where.categoria = categoria;
  if (q) {
    // Consulta parametrizada: Sequelize escapa el valor (no hay concatenación de SQL)
    const patron = `%${q.replace(/[%_\\]/g, '\\$&')}%`;
    where[Op.or] = [
      { titulo: { [Op.like]: patron } },
      { descripcion: { [Op.like]: patron } }
    ];
  }
  return where;
}

/** Lista con filtros, paginación y orden. Devuelve { total, datos }. */
async function listar(filtros = {}) {
  const pagina = Number(filtros.pagina) || 1;
  const limite = Number(filtros.limite) || 50;
  const campoOrden = filtros.orden || 'fechaCreacion';
  const dir = (filtros.dir || 'desc').toUpperCase();

  const orden = ORDEN_ESPECIAL[campoOrden]
    ? [[ORDEN_ESPECIAL[campoOrden], dir], ['fechaCreacion', 'DESC']]
    : [[campoOrden, dir], ['id', 'DESC']];

  const { count, rows } = await Incidente.findAndCountAll({
    where: construirWhere(filtros),
    order: orden,
    limit: limite,
    offset: (pagina - 1) * limite
  });
  return { total: count, pagina, limite, datos: rows };
}

const buscarPorId = id => Incidente.findByPk(id);

const crear = datos => Incidente.create(datos, { fields: Incidente.CAMPOS_EDITABLES });

/** PUT: reemplazo total. Los campos opcionales no enviados vuelven a su valor por defecto. */
async function reemplazar(id, datos) {
  return sequelize.transaction(async transaction => {
    const incidente = await Incidente.findByPk(id, { transaction });
    if (!incidente) return null;
    const porDefecto = { descripcion: '', categoria: 'otro', prioridad: 'media', estado: 'abierto', reportadoPor: 'Anónimo' };
    incidente.set({ ...porDefecto, ...datos });
    incidente.changed('fechaActualizacion', true);
    return incidente.save({ fields: Incidente.CAMPOS_EDITABLES, transaction });
  });
}

/** PATCH: solo los campos enviados. */
async function actualizar(id, cambios) {
  return sequelize.transaction(async transaction => {
    const incidente = await Incidente.findByPk(id, { transaction });
    if (!incidente) return null;
    incidente.set(cambios);
    incidente.changed('fechaActualizacion', true);
    return incidente.save({ fields: Incidente.CAMPOS_EDITABLES, transaction });
  });
}

/** Devuelve true si eliminó, false si no existía. */
async function eliminar(id) {
  const filas = await Incidente.destroy({ where: { id } });
  return filas > 0;
}

/** Totales agrupados con GROUP BY (los cálculos los hace la base, no JavaScript). */
async function estadisticas() {
  const agrupar = async campo => {
    const filas = await Incidente.findAll({
      attributes: [campo, [fn('COUNT', col('id')), 'cantidad']],
      group: [campo],
      raw: true
    });
    return Object.fromEntries(filas.map(f => [f[campo], Number(f.cantidad)]));
  };
  const completar = (conteo, valores) => Object.fromEntries(valores.map(v => [v, conteo[v] || 0]));

  const [total, porEstado, porSeveridad, porPrioridad] = await Promise.all([
    Incidente.count(), agrupar('estado'), agrupar('severidad'), agrupar('prioridad')
  ]);
  return {
    total,
    porEstado: completar(porEstado, ESTADOS),
    porSeveridad: completar(porSeveridad, SEVERIDADES),
    porPrioridad: completar(porPrioridad, PRIORIDADES)
  };
}

module.exports = { listar, buscarPorId, crear, reemplazar, actualizar, eliminar, estadisticas };
