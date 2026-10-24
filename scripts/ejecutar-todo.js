/**
 * EJECUTA TODO EL FLUJO Y GUARDA LA EVIDENCIA EN docs/evidencias/
 *   node scripts/ejecutar-todo.js
 * Útil en Windows cuando PowerShell bloquea npm.ps1: aquí npm se invoca vía cmd.
 *
 * Pasos: npm install -> crear .env -> migraciones -> estado de migraciones -> seed
 *        -> pruebas automatizadas -> demo de la API -> exportar esquema
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const raiz = path.join(__dirname, '..');
const dirEvid = path.join(raiz, 'docs', 'evidencias');
fs.mkdirSync(dirEvid, { recursive: true });

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function paso(titulo, args, archivo) {
  console.log(`\n=============== ${titulo} ===============`);
  console.log(`> npm ${args.join(' ')}`);
  const r = spawnSync(npm, args, { cwd: raiz, encoding: 'utf8', shell: true, env: { ...process.env, FORCE_COLOR: '0' } });
  const salida = `${r.stdout || ''}${r.stderr || ''}`;
  console.log(salida);
  if (archivo) {
    fs.writeFileSync(path.join(dirEvid, archivo),
      `> npm ${args.join(' ')}   (${new Date().toLocaleString('es-EC')})\n\n${salida}`);
  }
  const ok = r.status === 0;
  console.log(ok ? `[OK] ${titulo}` : `[FALLÓ] ${titulo} (código ${r.status})`);
  return ok;
}

const resultados = [];
const correr = (...a) => resultados.push([a[0], paso(...a)]);

correr('Instalar dependencias', ['install', '--no-audit', '--no-fund']);
console.log('\n=============== Crear .env desde .env.example ===============');
require('./crear-env');
correr('Aplicar migraciones', ['run', 'db:migrate'], 'migraciones.txt');
correr('Estado de migraciones', ['run', 'db:migrate:status'], 'estado-migraciones.txt');
// El seed solo se carga si la tabla está vacía (evita duplicar datos al re-ejecutar)
{
  const { Incidente, sequelize } = require('../src/models');
  const seguir = Incidente.count()
    .then(n => { sequelize.close(); return n; })
    .catch(() => { sequelize.close(); return 0; });
  seguir.then(n => {
    if (n === 0) correr('Cargar datos iniciales (seed)', ['run', 'db:seed'], 'seed.txt');
    else console.log(`\nLa tabla ya tiene ${n} incidentes: se omite el seed.`);
    correr('Pruebas automatizadas', ['run', 'test:evidencia']);
    correr('Demostración de la API (casos correctos y errores)', ['run', 'demo']);
    correr('Exportar esquema de la base', ['run', 'db:esquema']);

    console.log('\n=============== RESUMEN ===============');
    resultados.forEach(([t, ok]) => console.log(`${ok ? '[OK]    ' : '[FALLÓ] '} ${t}`));
    console.log(`\nEvidencias en: ${dirEvid}`);
    if (resultados.some(([, ok]) => !ok)) process.exitCode = 1;
  });
}
