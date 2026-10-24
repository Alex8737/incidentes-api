/**
 * CONEXIÓN ORM
 * Crea la única instancia de Sequelize y registra los modelos.
 */
const { Sequelize } = require('sequelize');
const env = require('../config/env');
const config = require('../config/database')[env.NODE_ENV] || require('../config/database').development;

const sequelize = config.dialect === 'sqlite'
  ? new Sequelize({ ...config })
  : new Sequelize(config.database, config.username, config.password, config);

const Incidente = require('./incidente.model')(sequelize);
const Usuario = require('./usuario.model')(sequelize);

module.exports = { sequelize, Sequelize, Incidente, Usuario };
