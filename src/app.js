const path = require('path');
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');

const env = require('./config/env');
const logger = require('./middleware/logger');
const forzarHttps = require('./middleware/forzarHttps');
const salud = require('./controllers/salud.controller');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');
const { autenticar, autorizar } = require('./middleware/auth');
const { rolesPara } = require('./models/permisos');
const authRoutes = require('./routes/auth.routes');
const incidentesRoutes = require('./routes/incidentes.routes');

const app = express();

app.disable('x-powered-by');
// Detrás del proxy de Render/Vercel: confiar en X-Forwarded-* para saber si la conexión original era HTTPS
app.set('trust proxy', env.TRUST_PROXY);
// El logger va primero: registra también las redirecciones y los rechazos posteriores
app.use(logger);
// HTTPS obligatorio en producción (el health check del balanceador se consulta por HTTP interno)
app.use(forzarHttps({ activo: env.FORCE_HTTPS, excepto: ['/api/health'] }));
// Cabeceras de seguridad (CSP, HSTS, X-Content-Type-Options, X-Frame-Options, etc.).
// En producción se mantiene upgrade-insecure-requests; en local se desactiva para permitir http://localhost.
app.use(helmet(env.FORCE_HTTPS ? {} : {
  contentSecurityPolicy: { directives: { upgradeInsecureRequests: null } }
}));
// Compresión gzip/brotli de las respuestas (JSON y archivos de texto) a partir de 1 kB
app.use(compression());

// CORS restringido a los orígenes definidos en CORS_ORIGIN (.env)
app.use((req, res, next) => {
  const origen = req.headers.origin;
  if (origen && env.CORS_ORIGIN.includes(origen)) {
    res.setHeader('Access-Control-Allow-Origin', origen);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }
  if (req.method === 'OPTIONS') {
    res.status(204).send();
    return;
  }
  next();
});
app.use(express.json({ limit: '10kb' }));

const PUBLIC = path.join(__dirname, '..', 'public');
// Imágenes: no cambian, el navegador puede guardarlas 7 días (Cache-Control: public, max-age=604800)
app.use('/img', express.static(path.join(PUBLIC, 'img'), { maxAge: '7d' }));
// HTML, CSS y JS: se revalidan con ETag (si no cambiaron, el servidor responde 304 sin cuerpo)
app.use(express.static(PUBLIC));

// Salud del servicio: comprueba también la conexión con la base (200 = listo, 503 = base caída)
app.get('/api/health', salud.health);

// Logs y métricas: solo administradores (pueden contener datos operativos sensibles)
app.get('/api/logs', autenticar, autorizar(...rolesPara('verLogs')), salud.logs);
app.get('/api/metricas', autenticar, autorizar(...rolesPara('verLogs')), salud.metricas);

app.use('/api/auth', authRoutes);
app.use('/api/incidentes', incidentesRoutes);

app.use('/api', notFound);
app.use(errorHandler);

module.exports = app;
