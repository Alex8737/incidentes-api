/**
 * CONTROLADOR DE SALUD Y MONITOREO (Reto 4)
 *  - health:   ¿el proceso responde Y la base de datos contesta? (lo consulta el balanceador y el monitor externo)
 *  - logs:     últimas solicitudes registradas (solo administradores)
 *  - metricas: disponibilidad, errores 5xx y latencia p95 (solo administradores)
 * La ruta de salud NO reemplaza las pruebas funcionales: por eso existe además scripts/verificar-despliegue.js.
 */
const env = require('../config/env');
const { sequelize } = require('../models');
const logger = require('../middleware/logger');
const log = require('../utils/log');

const datosBase = () => ({
  servicio: 'API de Incidentes',
  version: env.APP_VERSION,
  ...(env.COMMIT ? { commit: env.COMMIT } : {}),
  entorno: env.NODE_ENV,
  fecha: new Date().toISOString(),
  uptimeSeg: Math.round(process.uptime())
});

async function health(req, res) {
  const motor = sequelize.getDialect();
  try {
    await sequelize.authenticate();
    res.json({ ok: true, ...datosBase(), baseDeDatos: { motor, conectada: true } });
  } catch (err) {
    // El detalle (host, usuario…) queda solo en el log del servidor; el cliente recibe 503 sin datos internos.
    log.error('health check: la base de datos no responde', { requestId: req.id, ...log.describirError(err) });
    res.status(503).json({ ok: false, ...datosBase(), baseDeDatos: { motor, conectada: false } });
  }
}

const logs = (req, res) => res.json({ ok: true, datos: logger.getRegistros() });

const metricas = (req, res) => res.json({ ok: true, datos: logger.getMetricas() });

module.exports = { health, logs, metricas };
