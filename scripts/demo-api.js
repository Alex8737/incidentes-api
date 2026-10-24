/**
 * DEMOSTRACIÓN DE LA API CONTRA LA BASE REAL (evidencia para el informe)
 * Levanta la app en un puerto libre, ejecuta casos correctos y de error,
 * imprime cada petición/respuesta y la guarda en docs/evidencias/demo-api.txt.
 * El incidente de prueba que crea se elimina al final (la base queda como estaba).
 */
const fs = require('fs');
const path = require('path');
const app = require('../src/app');
const { sequelize } = require('../src/models');

const salida = [];
const log = (t = '') => { console.log(t); salida.push(t); };

async function main() {
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  let n = 0;

  async function caso(titulo, metodo, ruta, cuerpo, crudo) {
    n += 1;
    const opciones = { method: metodo, headers: { 'Content-Type': 'application/json' } };
    if (crudo !== undefined) opciones.body = crudo;
    else if (cuerpo !== undefined) opciones.body = JSON.stringify(cuerpo);
    const res = await fetch(base + ruta, opciones);
    const texto = await res.text();
    let json = null;
    try { json = texto ? JSON.parse(texto) : null; } catch { /* sin cuerpo JSON */ }

    log('------------------------------------------------------------');
    log(`CASO ${n}: ${titulo}`);
    log(`> ${metodo} ${ruta}`);
    if (crudo !== undefined) log(`> Body: ${crudo}`);
    else if (cuerpo !== undefined) log(`> Body: ${JSON.stringify(cuerpo)}`);
    log(`< HTTP ${res.status}`);
    if (json) {
      // En listados se muestra un resumen para no llenar la evidencia
      if (Array.isArray(json.datos)) {
        const { datos, ...resto } = json;
        log(`< ${JSON.stringify(resto)}`);
        datos.forEach(d => log(`    #${d.id} [${d.estado} | prioridad ${d.prioridad} | severidad ${d.severidad}] ${d.titulo}`));
      } else {
        log(`< ${JSON.stringify(json, null, 2).split('\n').join('\n  ')}`);
      }
    }
    return { status: res.status, json };
  }

  try {
    log(`DEMOSTRACIÓN API DE INCIDENTES — ${new Date().toLocaleString('es-EC')}`);
    log(`Motor de base de datos: ${sequelize.getDialect()}`);

    log('\n================ CASOS CORRECTOS ================');
    await caso('Salud del servicio y conexión a la base', 'GET', '/api/health');
    await caso('Listar incidentes persistidos', 'GET', '/api/incidentes');
    await caso('Filtrar por estado = abierto', 'GET', '/api/incidentes?estado=abierto');
    await caso('Filtrar por prioridad = alta', 'GET', '/api/incidentes?prioridad=alta');
    await caso('Filtro combinado + orden por prioridad', 'GET', '/api/incidentes?estado=abierto&prioridad=alta&orden=prioridad&dir=desc');
    await caso('Búsqueda de texto (q=ransomware)', 'GET', '/api/incidentes?q=ransomware');
    const creado = await caso('Crear incidente (POST)', 'POST', '/api/incidentes', {
      titulo: 'Escaneo de puertos desde IP externa',
      descripcion: 'El IDS detectó un escaneo Nmap sobre la DMZ.',
      categoria: 'acceso_no_autorizado', severidad: 'media', prioridad: 'alta', reportadoPor: 'IDS'
    });
    const id = creado.json?.datos?.id;
    await caso('Consultar el incidente creado (GET por id)', 'GET', `/api/incidentes/${id}`);
    await caso('Actualizar estado (PATCH)', 'PATCH', `/api/incidentes/${id}`, { estado: 'en_progreso', prioridad: 'urgente' });
    await caso('Reemplazar incidente (PUT)', 'PUT', `/api/incidentes/${id}`, {
      titulo: 'Escaneo de puertos bloqueado en firewall', severidad: 'baja', estado: 'resuelto'
    });
    await caso('Estadísticas agrupadas (GROUP BY en la base)', 'GET', '/api/incidentes/stats');
    await caso('Eliminar incidente (DELETE)', 'DELETE', `/api/incidentes/${id}`);

    log('\n================ CASOS DE ERROR ================');
    await caso('Consultar el incidente eliminado -> 404', 'GET', `/api/incidentes/${id}`);
    await caso('Crear sin título ni severidad -> 400', 'POST', '/api/incidentes', { descripcion: 'sin datos' });
    await caso('Severidad fuera de catálogo -> 400', 'POST', '/api/incidentes', { titulo: 'Prueba de validación', severidad: 'extrema' });
    await caso('Asignación masiva (id y fechas) -> 400', 'POST', '/api/incidentes', { titulo: 'Intento de forzar id', severidad: 'alta', id: 1, fechaCreacion: '2000-01-01' });
    await caso('JSON mal formado -> 400', 'POST', '/api/incidentes', undefined, '{"titulo": "roto",');
    await caso('Id no numérico -> 400', 'GET', '/api/incidentes/abc');
    await caso('Filtro con valor inválido -> 400', 'GET', '/api/incidentes?estado=pendiente');
    await caso('Filtro no soportado (intento de inyección) -> 400', 'GET', "/api/incidentes?titulo=' OR 1=1 --");
    await caso('PATCH vacío -> 400', 'PATCH', '/api/incidentes/1', {});
    await caso('Ruta inexistente -> 404', 'GET', '/api/no-existe');
  } finally {
    server.close();
    await sequelize.close();
  }

  const destino = path.join(__dirname, '..', 'docs', 'evidencias', 'demo-api.txt');
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.writeFileSync(destino, salida.join('\n') + '\n');
  console.log(`\nEvidencia guardada en ${path.relative(process.cwd(), destino)}`);
}

main().catch(err => {
  console.error('Error en la demostración:', err.message);
  process.exitCode = 1;
});
