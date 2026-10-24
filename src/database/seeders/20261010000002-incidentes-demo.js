'use strict';
/** Seeder: incidentes ficticios para la demostración (sin datos reales). */
const DEMO = [
  ['Phishing dirigido a contabilidad', 'Correo falso del banco solicitando credenciales.', 'phishing', 'alta', 'alta', 'abierto', 'Mesa de ayuda'],
  ['Ransomware en PC-VENTAS-07', 'El EDR bloqueó el cifrado de archivos; equipo aislado.', 'malware', 'critica', 'urgente', 'en_progreso', 'SOC'],
  ['Fuerza bruta contra la VPN', '250 intentos fallidos desde una IP externa en 10 minutos.', 'acceso_no_autorizado', 'media', 'alta', 'resuelto', 'SIEM'],
  ['Contraseña compartida en un chat', 'Credencial de servicio expuesta en un canal general.', 'fuga_de_datos', 'baja', 'baja', 'abierto', 'Usuario'],
  ['Ataque DDoS al portal de clientes', 'Pico de tráfico anómalo; el WAF aplicó límites.', 'ddos', 'alta', 'urgente', 'en_progreso', 'NOC'],
  ['USB desconocido en recepción', 'Dispositivo hallado conectado a un equipo de uso común.', 'otro', 'baja', 'media', 'cerrado', 'Seguridad física']
];

module.exports = {
  async up(queryInterface) {
    const ahora = new Date();
    await queryInterface.bulkInsert('incidentes', DEMO.map(
      ([titulo, descripcion, categoria, severidad, prioridad, estado, reportado_por]) => ({
        titulo, descripcion, categoria, severidad, prioridad, estado, reportado_por,
        fecha_creacion: ahora, fecha_actualizacion: ahora
      })
    ));
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('incidentes', { reportado_por: ['Mesa de ayuda', 'SOC', 'SIEM', 'Usuario', 'NOC', 'Seguridad física'] });
  }
};
