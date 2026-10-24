'use strict';
/** Migración 1: tabla incidentes (sin prioridad) + índices por estado, severidad y fecha. */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('incidentes', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      titulo: { type: Sequelize.STRING(120), allowNull: false },
      descripcion: { type: Sequelize.TEXT, allowNull: false, defaultValue: '' },
      categoria: { type: Sequelize.STRING(30), allowNull: false, defaultValue: 'otro' },
      severidad: { type: Sequelize.STRING(10), allowNull: false },
      estado: { type: Sequelize.STRING(15), allowNull: false, defaultValue: 'abierto' },
      reportado_por: { type: Sequelize.STRING(80), allowNull: false, defaultValue: 'Anónimo' },
      fecha_creacion: { type: Sequelize.DATE, allowNull: false },
      fecha_actualizacion: { type: Sequelize.DATE, allowNull: false }
    });
    await queryInterface.addIndex('incidentes', ['estado'], { name: 'idx_incidentes_estado' });
    await queryInterface.addIndex('incidentes', ['severidad'], { name: 'idx_incidentes_severidad' });
    await queryInterface.addIndex('incidentes', ['fecha_creacion'], { name: 'idx_incidentes_fecha_creacion' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('incidentes');
  }
};
