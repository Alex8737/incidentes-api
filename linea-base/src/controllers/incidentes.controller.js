/**
 * CONTROLADOR: traduce HTTP <-> repositorio. No contiene SQL.
 * Ningún método tiene try/catch: los errores suben a errorHandler vía asyncHandler.
 */
const repo = require('../repositories/incidente.repository');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { SEVERIDADES, PRIORIDADES, ESTADOS, CATEGORIAS } = require('../models/catalogos');

const getId = req => Number(req.params.id);
const noEncontrado = req => new AppError(`Incidente ${req.params.id} no encontrado`, 404);

const listar = asyncHandler(async (req, res) => {
  const { total, pagina, limite, datos } = await repo.listar(req.query);
  res.json({ ok: true, total, pagina, limite, paginas: Math.ceil(total / limite), datos });
});

const obtener = asyncHandler(async (req, res) => {
  const incidente = await repo.buscarPorId(getId(req));
  if (!incidente) throw noEncontrado(req);
  res.json({ ok: true, datos: incidente });
});

const crear = asyncHandler(async (req, res) => {
  const nuevo = await repo.crear(req.body);
  res
    .status(201)
    .location(`/api/incidentes/${nuevo.id}`)
    .json({ ok: true, mensaje: 'Incidente creado', datos: nuevo });
});

const reemplazar = asyncHandler(async (req, res) => {
  const actualizado = await repo.reemplazar(getId(req), req.body);
  if (!actualizado) throw noEncontrado(req);
  res.json({ ok: true, mensaje: 'Incidente reemplazado', datos: actualizado });
});

const actualizar = asyncHandler(async (req, res) => {
  const actualizado = await repo.actualizar(getId(req), req.body);
  if (!actualizado) throw noEncontrado(req);
  res.json({ ok: true, mensaje: 'Incidente actualizado', datos: actualizado });
});

const eliminar = asyncHandler(async (req, res) => {
  const eliminado = await repo.eliminar(getId(req));
  if (!eliminado) throw noEncontrado(req);
  res.status(204).send();
});

const estadisticas = asyncHandler(async (req, res) => {
  res.json({ ok: true, datos: await repo.estadisticas() });
});

function catalogos(req, res) {
  res.json({
    ok: true,
    datos: { severidades: SEVERIDADES, prioridades: PRIORIDADES, estados: ESTADOS, categorias: CATEGORIAS }
  });
}

module.exports = { listar, obtener, crear, reemplazar, actualizar, eliminar, estadisticas, catalogos };
