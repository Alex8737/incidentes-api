'use strict';
/** Migración 2: columna prioridad (urgencia de atención) + índices simple y compuesto. */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('incidentes', 'prioridad', {
      type: Sequelize.STRING(10), allowNull: false, defaultValue: 'media'
    });
    await queryInterface.addIndex('incidentes', ['prioridad'], { name: 'idx_incidentes_prioridad' });
    await queryInterface.addIndex('incidentes', ['estado', 'prioridad'], { name: 'idx_incidentes_estado_prioridad' });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('incidentes', 'idx_incidentes_estado_prioridad');
    await queryInterface.removeIndex('incidentes', 'idx_incidentes_prioridad');
    await queryInterface.removeColumn('incidentes', 'prioridad');
  }
};
