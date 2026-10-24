// Comodidad en desarrollo: instala dependencias la primera vez. En producción NO se hace
// (el proveedor ya ejecutó "npm install" en la fase de construcción).
if (process.env.NODE_ENV !== 'production') {
  try {
    ['express', 'sequelize', 'sqlite3', 'dotenv', 'helmet'].forEach(m => require.resolve(m));
  } catch {
    const path = require('path');
    const { execSync } = require('child_process');
    console.log('Instalando dependencias (npm install)... esto solo ocurre la primera vez.');
    execSync('npm install', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });
  }
}

// Si falta una variable obligatoria, esta línea lanza el error y el proceso termina ANTES de aceptar tráfico.
const env = require('./config/env');
const app = require('./app');
const { sequelize } = require('./models');
const log = require('./utils/log');

async function verificarBase() {
  await sequelize.authenticate();
  // Verifica que las migraciones se hayan ejecutado
  const tablas = (await sequelize.getQueryInterface().showAllTables())
    .map(t => (typeof t === 'string' ? t : t.tableName));
  const faltantes = ['incidentes', 'usuarios'].filter(t => !tablas.includes(t));
  if (faltantes.length) {
    throw new Error(`Faltan tablas (${faltantes.join(', ')}). Ejecute:  npm run db:migrate  y  npm run db:seed`);
  }
}

function escuchar() {
  return app.listen(env.PORT, () => {
    log.info('servicio iniciado', {
      puerto: env.PORT, entorno: env.NODE_ENV, version: env.APP_VERSION, commit: env.COMMIT || undefined,
      baseDeDatos: sequelize.getDialect(), httpsForzado: env.FORCE_HTTPS, corsOrigenes: env.CORS_ORIGIN.length
    });
    env.ADVERTENCIAS.forEach(aviso => log.warn(aviso));
    if (!env.ES_PRODUCCION) console.log(`  Front-end: http://localhost:${env.PORT}   ·   Salud: http://localhost:${env.PORT}/api/health`);
  });
}

/** Cierre ordenado: deja de aceptar peticiones y cierra el pool de conexiones. */
function cerrarAlRecibir(server) {
  const cerrar = señal => {
    log.info('señal recibida, cerrando servidor', { señal });
    server.close(async () => {
      await sequelize.close();
      process.exit(0);
    });
  };
  process.on('SIGINT', () => cerrar('SIGINT'));
  process.on('SIGTERM', () => cerrar('SIGTERM'));
}

async function iniciar() {
  try {
    await verificarBase();
  } catch (err) {
    // No se imprime la configuración (podría contener credenciales)
    log.error('no se pudo iniciar: base de datos', { baseDeDatos: env.DB_DIALECT, ...log.describirError(err) });
    process.exit(1);
  }
  cerrarAlRecibir(escuchar());
}

process.on('unhandledRejection', err => {
  log.error('promesa rechazada sin manejar', log.describirError(err instanceof Error ? err : new Error(String(err))));
});

iniciar();
