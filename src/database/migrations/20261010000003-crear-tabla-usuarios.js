'use strict';
/** Migración 3: tabla usuarios (autenticación y roles). Solo se guarda el hash bcrypt. */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('usuarios', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      usuario: { type: Sequelize.STRING(40), allowNull: false, unique: true },
      nombre: { type: Sequelize.STRING(80), allowNull: false },
      password_hash: { type: Sequelize.STRING(120), allowNull: false },
      rol: { type: Sequelize.STRING(10), allowNull: false, defaultValue: 'visor' },
      activo: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      fecha_creacion: { type: Sequelize.DATE, allowNull: false },
      fecha_actualizacion: { type: Sequelize.DATE, allowNull: false }
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('usuarios');
  }
};
