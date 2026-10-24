/**
 * GENERADOR DE INCIDENTES DE PRUEBA (Reto 3 - Unidad 7)
 * Inserta incidentes realistas en la base configurada en .env para:
 *   - reproducir el defecto del contador/paginación (más de 50 registros),
 *   - medir consultas con un volumen representativo.
 *
 * Uso:
 *   node scripts/generar-incidentes.js            -> agrega 150 incidentes
 *   node scripts/generar-incidentes.js 5000       -> agrega 5000 incidentes
 *   node scripts/generar-incidentes.js --limpiar  -> borra solo los generados por este script
 *
 * Los registros generados se identifican por reportadoPor = "Generador de datos",
 * así se pueden borrar sin tocar los incidentes reales.
 */
const { sequelize, Incidente } = require('../src/models');
const { SEVERIDADES, PRIORIDADES, ESTADOS, CATEGORIAS } = require('../src/models/catalogos');

const MARCA = 'Generador de datos';

const PLANTILLAS = {
  phishing: ['Correo de phishing dirigido a {area}', 'Enlace malicioso reportado por {area}'],
  malware: ['Malware detectado en {host}', 'Proceso sospechoso bloqueado por el EDR en {host}'],
  acceso_no_autorizado: ['Intentos de acceso fallidos contra {host}', 'Inicio de sesión fuera de horario en {host}'],
  ddos: ['Tráfico anómalo hacia {host}', 'Saturación del enlace por peticiones masivas a {host}'],
  fuga_de_datos: ['Archivo confidencial compartido desde {area}', 'Credenciales expuestas por {area}'],
  otro: ['Uso de CPU al 100% en {host}', 'Alerta genérica del SIEM en {host}']
};
const HOSTS = ['SRV_WEB_01', 'SRV_DB_02', 'PC-VENTAS-07', 'PC-CONTA-03', 'FW_PERIMETRAL', 'VPN-GW-01'];
const AREAS = ['contabilidad', 'ventas', 'talento humano', 'gerencia', 'soporte técnico'];

// Generador pseudoaleatorio con semilla: siempre produce los mismos datos (mediciones repetibles)
let semilla = 20261015;
const azar = () => { semilla = (semilla * 1103515245 + 12345) % 2147483648; return semilla / 2147483648; };
const elegir = lista => lista[Math.floor(azar() * lista.length)];

function crearIncidente(i) {
  const categoria = elegir(CATEGORIAS);
  const titulo = elegir(PLANTILLAS[categoria]).replace('{host}', elegir(HOSTS)).replace('{area}', elegir(AREAS));
  const fecha = new Date(Date.UTC(2026, 0, 1) + Math.floor(azar() * 280 * 24 * 3600 * 1000));
  return {
    titulo: `${titulo} (#${i + 1})`,
    descripcion: `Registro generado para pruebas de carga. Evento ${i + 1} detectado por el monitoreo del SOC; requiere análisis y seguimiento según el procedimiento de respuesta a incidentes.`,
    categoria,
    severidad: elegir(SEVERIDADES),
    prioridad: elegir(PRIORIDADES),
    estado: elegir(ESTADOS),
    reportadoPor: MARCA,
    fechaCreacion: fecha,
    fechaActualizacion: fecha
  };
}

async function main() {
  const arg = process.argv[2];
  if (arg === '--limpiar') {
    const n = await Incidente.destroy({ where: { reportadoPor: MARCA } });
    console.log(`Se eliminaron ${n} incidentes generados.`);
    return;
  }
  const cantidad = Math.min(Number(arg) || 150, 200000);
  const lote = 1000;
  for (let i = 0; i < cantidad; i += lote) {
    const filas = Array.from({ length: Math.min(lote, cantidad - i) }, (_, k) => crearIncidente(i + k));
    await Incidente.bulkCreate(filas, { validate: true, silent: true });
  }
  console.log(`Se agregaron ${cantidad} incidentes. Total en la base: ${await Incidente.count()}`);
}

// Se ejecuta solo desde la línea de comandos; scripts/medir-rendimiento.js lo importa para reutilizar crearIncidente()
if (require.main === module) {
  main()
    .catch(err => { console.error('No se pudo generar:', err.message); process.exitCode = 1; })
    .finally(() => sequelize.close());
}

module.exports = { crearIncidente, MARCA };
