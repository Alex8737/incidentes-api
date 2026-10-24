// Instala dependencias automáticamente la primera vez (comodidad para la revisión)
try {
  ['express', 'sequelize', 'sqlite3', 'dotenv', 'helmet'].forEach(m => require.resolve(m));
} catch {
  const path = require('path');
  const { execSync } = require('child_process');
  console.log('Instalando dependencias (npm install)... esto solo ocurre la primera vez.');
  execSync('npm install', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });
}

const env = require('./config/env');
const app = require('./app');
const { sequelize } = require('./models');

async function iniciar() {
  try {
    await sequelize.authenticate();
    // Verifica que las migraciones se hayan ejecutado
    const tablas = (await sequelize.getQueryInterface().showAllTables())
      .map(t => (typeof t === 'string' ? t : t.tableName));
    if (!tablas.includes('incidentes')) {
      console.error('La tabla "incidentes" no existe. Ejecute primero:  npm run db:migrate  y  npm run db:seed');
      process.exit(1);
    }
  } catch (err) {
    // No se imprime la configuración (podría contener credenciales)
    console.error(`No se pudo conectar con la base de datos (${env.DB_DIALECT}): ${err.message}`);
    process.exit(1);
  }

  const server = app.listen(env.PORT, () => {
    console.log('==============================================');
    console.log(`  API de Incidentes escuchando en el puerto ${env.PORT}`);
    console.log(`  Base de datos: ${sequelize.getDialect()} (conectada)`);
    console.log(`  Front-end:  http://localhost:${env.PORT}`);
    console.log(`  API:        http://localhost:${env.PORT}/api/incidentes`);
    console.log('==============================================');
  });

  // Cierre ordenado: deja de aceptar peticiones y cierra el pool de conexiones
  const cerrar = señal => {
    console.log(`\n${señal} recibido. Cerrando servidor...`);
    server.close(async () => {
      await sequelize.close();
      process.exit(0);
    });
  };
  process.on('SIGINT', () => cerrar('SIGINT'));
  process.on('SIGTERM', () => cerrar('SIGTERM'));
}

process.on('unhandledRejection', err => {
  console.error('Promesa rechazada sin manejar:', err);
});

iniciar();
