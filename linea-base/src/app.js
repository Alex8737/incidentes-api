const path = require('path');
const express = require('express');
const helmet = require('helmet');

const env = require('./config/env');
const { sequelize } = require('./models');
const logger = require('./middleware/logger');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');
const { autenticar, autorizar } = require('./middleware/auth');
const asyncHandler = require('./utils/asyncHandler');
const authRoutes = require('./routes/auth.routes');
const incidentesRoutes = require('./routes/incidentes.routes');

const app = express();

app.disable('x-powered-by');
// Cabeceras de seguridad (CSP, X-Content-Type-Options, X-Frame-Options, etc.)
app.use(helmet({
  contentSecurityPolicy: { directives: { upgradeInsecureRequests: null } } // permite http://localhost en desarrollo
}));
app.use(logger);

// CORS restringido a los orígenes definidos en CORS_ORIGIN (.env)
app.use((req, res, next) => {
  const origen = req.headers.origin;
  if (origen && env.CORS_ORIGIN.includes(origen)) {
    res.setHeader('Access-Control-Allow-Origin', origen);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }
  if (req.method === 'OPTIONS') return res.status(204).send();
  next();
});
app.use(express.json({ limit: '10kb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// Salud del servicio: comprueba también la conexión con la base
app.get('/api/health', asyncHandler(async (req, res) => {
  await sequelize.authenticate();
  res.json({
    ok: true,
    servicio: 'API de Incidentes',
    baseDeDatos: { motor: sequelize.getDialect(), conectada: true },
    uptimeSeg: Math.round(process.uptime())
  });
}));

// Registro de logs: solo administradores (puede contener datos sensibles)
app.get('/api/logs', autenticar, autorizar('admin'), (req, res) => {
  res.json({ ok: true, datos: logger.getRegistros() });
});

app.use('/api/auth', authRoutes);
app.use('/api/incidentes', incidentesRoutes);

app.use('/api', notFound);
app.use(errorHandler);

module.exports = app;
