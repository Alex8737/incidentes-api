/**
 * MEDICIÓN DE RENDIMIENTO (Reto 3 - Unidad 7)
 *
 *   node scripts/medir-rendimiento.js [etiqueta] [cantidad]
 *   npm run medir                      -> etiqueta "actual", 20 000 incidentes
 *   npm run medir -- despues 20000
 *   node scripts/medir-rendimiento.js antes 20000 ../docs/reportes   (4.º argumento: carpeta de salida)
 *
 * Mide, con el mismo procedimiento en la versión "antes" y "después":
 *   1. CONSULTAS: bandeja del SOC (estado=abierto, más recientes primero), estadísticas
 *      del tablero y búsqueda de texto. Tiempo mediano, nº de consultas SQL y plan de ejecución.
 *   2. RED: GET /api/incidentes (50 registros): bytes transferidos, compresión y tiempo.
 *   3. IMÁGENES: peso, dimensiones reales vs. mostradas y estado HTTP de cada imagen de index.html.
 *
 * Usa una base SQLite TEMPORAL (database/medicion.sqlite): la base real no se toca.
 * Resultado: docs/reportes/medicion-<etiqueta>.txt y .json
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const crypto = require('crypto');

const RAIZ = path.join(__dirname, '..');
const ETIQUETA = (process.argv[2] || 'actual').replace(/[^\w-]/g, '');
const CANTIDAD = Number(process.argv[3]) || 20000;
const REPETICIONES = 30;
const DB_MEDICION = 'database/medicion.sqlite';
const DIR_REPORTES = path.resolve(process.argv[4] ? path.resolve(process.cwd(), process.argv[4]) : path.join(RAIZ, 'docs', 'reportes'));

// La configuración se fija ANTES de cargar los modelos (dotenv no sobrescribe variables ya definidas)
process.env.NODE_ENV = 'test';
process.env.DB_DIALECT = 'sqlite';
process.env.DB_STORAGE = DB_MEDICION;
process.env.DB_LOGGING = 'false';
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex'); // solo para esta medición
}
fs.mkdirSync(path.join(RAIZ, 'database'), { recursive: true });
fs.rmSync(path.join(RAIZ, DB_MEDICION), { force: true });

const { Sequelize } = require('sequelize');
const { sequelize, Incidente, Usuario } = require('../src/models');
const repo = require('../src/repositories/incidente.repository');
const { firmar } = require('../src/middleware/auth');
const { crearIncidente } = require('./generar-incidentes');

// ------------------------------------------------------------------ utilidades
const mediana = xs => { const s = [...xs].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const ms = n => Number(n.toFixed(2));
const kb = n => `${(n / 1024).toFixed(1)} kB`;

async function cronometrar(fn, repeticiones = REPETICIONES) {
  for (let i = 0; i < 3; i++) await fn(); // calentamiento (caché de SQLite y del ORM)
  const tiempos = [];
  for (let i = 0; i < repeticiones; i++) {
    const t0 = process.hrtime.bigint();
    await fn();
    tiempos.push(Number(process.hrtime.bigint() - t0) / 1e6);
  }
  return { medianaMs: ms(mediana(tiempos)), minMs: ms(Math.min(...tiempos)), maxMs: ms(Math.max(...tiempos)) };
}

/** Ejecuta fn y devuelve las sentencias SQL que generó el ORM. */
async function capturarSQL(fn) {
  const sentencias = [];
  const anterior = sequelize.options.logging;
  sequelize.options.logging = sql => sentencias.push(sql.replace(/^Executing \([^)]*\): /, ''));
  try { await fn(); } finally { sequelize.options.logging = anterior; }
  return sentencias;
}

async function planDe(sql) {
  const [filas] = await sequelize.query(`EXPLAIN QUERY PLAN ${sql.replace(/;\s*$/, '')}`);
  return filas.map(f => f.detail);
}

// ------------------------------------------------------------------ preparación
async function preparar() {
  const qi = sequelize.getQueryInterface();
  const dir = path.join(RAIZ, 'src', 'database', 'migrations');
  const migraciones = fs.readdirSync(dir).filter(f => f.endsWith('.js')).sort();
  for (const f of migraciones) await require(path.join(dir, f)).up(qi, Sequelize);

  for (let i = 0; i < CANTIDAD; i += 1000) {
    const lote = Array.from({ length: Math.min(1000, CANTIDAD - i) }, (_, k) => crearIncidente(i + k));
    await Incidente.bulkCreate(lote, { validate: false, silent: true });
  }
  const indices = (await qi.showIndex('incidentes')).map(ix => ix.name);
  const admin = await Usuario.create({ usuario: 'medicion', nombre: 'Medición', rol: 'admin', passwordHash: 'x'.repeat(60) });
  return { migraciones, indices, token: firmar(admin) };
}

// ------------------------------------------------------------------ 1. consultas
async function medirConsultas() {
  const casos = {
    bandejaSOC: { descripcion: 'GET /incidentes?estado=abierto (50 más recientes)', fn: () => repo.listar({ estado: 'abierto' }) },
    estadisticas: { descripcion: 'GET /incidentes/stats (tablero)', fn: () => repo.estadisticas() },
    busqueda: { descripcion: 'GET /incidentes?q=SRV_WEB (búsqueda con guion bajo)', fn: () => repo.listar({ q: 'SRV_WEB' }) }
  };
  const resultado = {};
  for (const [clave, caso] of Object.entries(casos)) {
    const sql = await capturarSQL(caso.fn);
    const muestra = await caso.fn();
    resultado[clave] = {
      descripcion: caso.descripcion,
      ...(await cronometrar(caso.fn)),
      consultasSQL: sql.length,
      resultados: typeof muestra.total === 'number' ? muestra.total : undefined,
      plan: await planDe(sql[sql.length - 1]),
      sql: sql.map(s => (s.length > 400 ? `${s.slice(0, 400)}…` : s))
    };
  }
  return resultado;
}

// ------------------------------------------------------------------ 2. red
function pedir(puerto, ruta, cabeceras = {}) {
  return new Promise((resolve, reject) => {
    const t0 = process.hrtime.bigint();
    const req = http.get({ host: '127.0.0.1', port: puerto, path: ruta, headers: cabeceras }, res => {
      let bytes = 0;
      res.on('data', c => { bytes += c.length; }); // bytes tal como viajan (sin descomprimir)
      res.on('end', () => resolve({
        estado: res.statusCode, bytes, ms: Number(process.hrtime.bigint() - t0) / 1e6,
        encoding: res.headers['content-encoding'] || 'ninguna', cacheControl: res.headers['cache-control'] || '—'
      }));
    });
    req.on('error', reject);
  });
}

async function medirRed(puerto, token) {
  const ruta = '/api/incidentes';
  const cab = { Authorization: `Bearer ${token}`, 'Accept-Encoding': 'gzip, deflate, br' };
  const tiempos = [];
  let ultima;
  for (let i = 0; i < 3; i++) await pedir(puerto, ruta, cab);
  for (let i = 0; i < 20; i++) { ultima = await pedir(puerto, ruta, cab); tiempos.push(ultima.ms); }
  const sinComprimir = await pedir(puerto, ruta, { Authorization: cab.Authorization, 'Accept-Encoding': 'identity' });
  return {
    ruta, estado: ultima.estado, encoding: ultima.encoding,
    bytesTransferidos: ultima.bytes, bytesSinComprimir: sinComprimir.bytes,
    medianaMs: ms(mediana(tiempos))
  };
}

// ------------------------------------------------------------------ 3. imágenes
function dimensiones(buf) {
  if (buf.slice(1, 4).toString() === 'PNG') return { formato: 'PNG', ancho: buf.readUInt32BE(16), alto: buf.readUInt32BE(20) };
  if (buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP') {
    const tipo = buf.slice(12, 16).toString();
    if (tipo === 'VP8X') return { formato: 'WebP', ancho: 1 + buf.readUIntLE(24, 3), alto: 1 + buf.readUIntLE(27, 3) };
    if (tipo === 'VP8L') { const b = buf.readUInt32LE(21); return { formato: 'WebP', ancho: (b & 0x3fff) + 1, alto: ((b >> 14) & 0x3fff) + 1 }; }
    return { formato: 'WebP', ancho: buf.readUInt16LE(26) & 0x3fff, alto: buf.readUInt16LE(28) & 0x3fff };
  }
  return { formato: 'desconocido', ancho: null, alto: null };
}

function imagenesDeIndex() {
  const html = fs.readFileSync(path.join(RAIZ, 'public', 'index.html'), 'utf8');
  const imgs = [...html.matchAll(/<img\b[^>]*>/g)].map(([tag]) => ({
    tipo: 'img', src: (tag.match(/src="([^"]+)"/) || [])[1],
    declarado: (tag.match(/width="(\d+)"/) || [])[1] ? `${tag.match(/width="(\d+)"/)[1]}×${tag.match(/height="(\d+)"/)?.[1]}` : 'sin width/height'
  }));
  const icono = html.match(/<link[^>]*rel="icon"[^>]*href="([^"]+)"/);
  imgs.push({ tipo: 'favicon', src: icono ? icono[1] : '/favicon.ico', declarado: icono ? 'link rel=icon' : 'sin <link rel="icon">' });
  return imgs;
}

async function medirImagenes(puerto) {
  const lista = [];
  for (const img of imagenesDeIndex()) {
    const ruta = img.src.startsWith('/') ? img.src : `/${img.src}`;
    const r = await pedir(puerto, ruta);
    const archivo = path.join(RAIZ, 'public', ruta);
    const existe = fs.existsSync(archivo);
    lista.push({
      ...img, estadoHTTP: r.estado, cacheControl: r.cacheControl,
      bytes: existe ? fs.statSync(archivo).size : 0,
      ...(existe ? dimensiones(fs.readFileSync(archivo)) : { formato: '—', ancho: null, alto: null })
    });
  }
  return lista;
}

// ------------------------------------------------------------------ informe
function informeTexto(r) {
  const l = [];
  l.push(`MEDICIÓN DE RENDIMIENTO — versión "${r.etiqueta}"`);
  l.push(`Fecha: ${r.fecha} · Node ${r.entorno.node} · ${r.entorno.so} · ${r.entorno.cpu}`);
  l.push(`Base de medición: SQLite temporal con ${r.cantidad} incidentes · ${REPETICIONES} repeticiones por consulta (mediana)`);
  l.push(`Migraciones: ${r.migraciones.length} · Índices en incidentes: ${r.indices.join(', ')}`, '');
  l.push('1. CONSULTAS');
  for (const [k, c] of Object.entries(r.consultas)) {
    l.push(`  [${k}] ${c.descripcion}`);
    l.push(`     mediana ${c.medianaMs} ms (mín ${c.minMs} / máx ${c.maxMs}) · ${c.consultasSQL} consulta(s) SQL${c.resultados !== undefined ? ` · total encontrado: ${c.resultados}` : ''}`);
    l.push(`     plan: ${c.plan.join(' | ')}`);
  }
  l.push('', '2. RED  (GET /api/incidentes, primera página de 50)');
  l.push(`     ${r.red.estado} · Content-Encoding: ${r.red.encoding} · transferido ${kb(r.red.bytesTransferidos)} (sin comprimir ${kb(r.red.bytesSinComprimir)}) · mediana ${r.red.medianaMs} ms`);
  l.push('', '3. IMÁGENES  (referenciadas en public/index.html)');
  for (const i of r.imagenes) {
    l.push(`     ${i.tipo.padEnd(7)} ${i.src} -> HTTP ${i.estadoHTTP} · ${i.formato} ${i.ancho ?? '—'}×${i.alto ?? '—'} px · ${kb(i.bytes)} · mostrado: ${i.declarado} · Cache-Control: ${i.cacheControl}`);
  }
  return `${l.join('\n')}\n`;
}

async function main() {
  console.log(`Preparando base de medición con ${CANTIDAD} incidentes...`);
  const { migraciones, indices, token } = await preparar();
  const app = require('../src/app');
  const servidor = app.listen(0);
  const puerto = servidor.address().port;
  try {
    const resultado = {
      etiqueta: ETIQUETA, fecha: new Date().toISOString(), cantidad: CANTIDAD,
      entorno: { node: process.version, so: `${os.type()} ${os.release()}`, cpu: os.cpus()[0]?.model || 'desconocida' },
      migraciones, indices,
      consultas: await medirConsultas(),
      red: await medirRed(puerto, token),
      imagenes: await medirImagenes(puerto)
    };
    const dir = DIR_REPORTES;
    fs.mkdirSync(dir, { recursive: true });
    const texto = informeTexto(resultado);
    fs.writeFileSync(path.join(dir, `medicion-${ETIQUETA}.txt`), texto);
    fs.writeFileSync(path.join(dir, `medicion-${ETIQUETA}.json`), JSON.stringify(resultado, null, 2));
    console.log(`\n${texto}\nGuardado en ${path.relative(process.cwd(), path.join(dir, `medicion-${ETIQUETA}.txt`))}`);
  } finally {
    servidor.close();
    await sequelize.close();
    fs.rmSync(path.join(RAIZ, DB_MEDICION), { force: true });
  }
}

main().catch(err => { console.error('Error en la medición:', err); process.exitCode = 1; });
