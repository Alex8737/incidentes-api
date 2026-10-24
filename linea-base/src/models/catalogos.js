/** Valores permitidos (catálogos). Única fuente de verdad para modelo, validaciones y front. */
const SEVERIDADES = ['baja', 'media', 'alta', 'critica'];
const PRIORIDADES = ['baja', 'media', 'alta', 'urgente'];
const ESTADOS = ['abierto', 'en_progreso', 'resuelto', 'cerrado'];
const CATEGORIAS = ['phishing', 'malware', 'acceso_no_autorizado', 'ddos', 'fuga_de_datos', 'otro'];

module.exports = { SEVERIDADES, PRIORIDADES, ESTADOS, CATEGORIAS };
