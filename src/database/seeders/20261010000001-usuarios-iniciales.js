'use strict';
/**
 * Seeder: una cuenta por rol.
 * Las contraseñas NUNCA están en el código del repositorio para producción:
 *   SEED_ADMIN_PASSWORD, SEED_ANALISTA_PASSWORD, SEED_VISOR_PASSWORD (variables de entorno).
 * - NODE_ENV=production: son obligatorias (mínimo 10 caracteres); si faltan, el seeder falla.
 * - Otros entornos: si faltan, se usan claves de demostración locales (documentadas en el README).
 */
const bcrypt = require('bcryptjs');

const CUENTAS = [
  { usuario: 'admin', nombre: 'Administrador', rol: 'admin', variable: 'SEED_ADMIN_PASSWORD', demo: 'Admin-Demo-2026!' },
  { usuario: 'analista', nombre: 'Analista SOC', rol: 'analista', variable: 'SEED_ANALISTA_PASSWORD', demo: 'Analista-Demo-2026!' },
  { usuario: 'visor', nombre: 'Auditor (solo lectura)', rol: 'visor', variable: 'SEED_VISOR_PASSWORD', demo: 'Visor-Demo-2026!' }
];

function claveDe(cuenta) {
  const valor = process.env[cuenta.variable];
  if (process.env.NODE_ENV === 'production') {
    if (!valor || valor.length < 10) {
      throw new Error(`Falta ${cuenta.variable} (mínimo 10 caracteres) para crear las cuentas en producción`);
    }
    return valor;
  }
  return valor || cuenta.demo;
}

module.exports = {
  async up(queryInterface) {
    const ahora = new Date();
    const filas = CUENTAS.map(c => ({
      usuario: c.usuario,
      nombre: c.nombre,
      rol: c.rol,
      activo: true,
      password_hash: bcrypt.hashSync(claveDe(c), 10),
      fecha_creacion: ahora,
      fecha_actualizacion: ahora
    }));
    await queryInterface.bulkInsert('usuarios', filas);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('usuarios', { usuario: CUENTAS.map(c => c.usuario) });
  }
};
