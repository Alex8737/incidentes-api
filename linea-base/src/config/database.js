/**
 * CONFIGURACIÓN DE CONEXIÓN (usada por la app y por sequelize-cli)
 * Todos los datos sensibles vienen de variables de entorno; aquí no hay
 * ninguna credencial escrita en el código.
 */
const path = require('path');
const env = require('./env');

function construirConfig() {
  const base = {
    dialect: env.DB_DIALECT,
    logging: env.DB_LOGGING ? console.log : false,
    define: {
      underscored: true,          // columnas en snake_case (reportado_por, fecha_creacion)
      freezeTableName: true
    },
    // SequelizeMeta guarda qué migraciones ya se aplicaron; SequelizeData, qué seeders.
    migrationStorageTableName: 'SequelizeMeta',
    seederStorage: 'sequelize',
    seederStorageTableName: 'SequelizeData'
  };

  if (env.DB_DIALECT === 'sqlite') {
    return {
      ...base,
      storage: env.DB_STORAGE === ':memory:'
        ? ':memory:'
        : path.resolve(__dirname, '..', '..', env.DB_STORAGE)
    };
  }

  return {
    ...base,
    host: env.DB_HOST,
    port: env.DB_PORT,
    database: env.DB_NAME,
    username: env.DB_USER,
    password: env.DB_PASSWORD,
    pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
    dialectOptions: env.DB_SSL
      ? (env.DB_DIALECT === 'mysql'
          ? { ssl: { rejectUnauthorized: true } }
          : { ssl: { require: true, rejectUnauthorized: true } })
      : {}
  };
}

const config = construirConfig();

// sequelize-cli espera un objeto por entorno
module.exports = {
  development: config,
  test: config,
  production: config
};
