/**
 * GUARDA LA EVIDENCIA DE PRUEBAS Y DE ESLINT EN docs/reportes/
 *
 *   npm run test:evidencia            -> pruebas con cobertura  -> docs/reportes/pruebas-actual.txt
 *   npm run lint:reporte              -> informe de ESLint      -> docs/reportes/eslint-actual.txt
 *   node scripts/guardar-evidencia.js todo antes                -> ambos, con la etiqueta "antes"
 *
 * El archivo queda sin códigos de color, listo para adjuntar al informe.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const RAIZ = path.join(__dirname, '..');
const DIR = path.join(RAIZ, 'docs', 'reportes');
// Códigos de color ANSI (se construye con fromCharCode para no poner un carácter de control en la expresión)
const SIN_COLOR = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g');

const [tareaArg, etiquetaArg] = process.argv.slice(2);
const tarea = ['test', 'lint', 'todo'].includes(tareaArg) ? tareaArg : 'test';
const etiqueta = (etiquetaArg || 'actual').replace(/[^\w-]/g, '');

const TAREAS = {
  test: { titulo: 'PRUEBAS AUTOMATIZADAS (Jest)', archivo: 'pruebas', args: ['jest', '--coverage', '--colors=false'] },
  lint: { titulo: 'ANÁLISIS ESTÁTICO (ESLint)', archivo: 'eslint', args: ['eslint', '.', '--format', 'stylish'] }
};

function ejecutar({ titulo, archivo, args }) {
  console.log(`\n=============== ${titulo} ===============`);
  const r = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', args, {
    cwd: RAIZ, encoding: 'utf8', shell: true, env: { ...process.env, FORCE_COLOR: '0', CI: 'true' }
  });
  const salida = `${r.stdout || ''}${r.stderr || ''}`.replace(SIN_COLOR, '');
  console.log(salida);

  fs.mkdirSync(DIR, { recursive: true });
  const destino = path.join(DIR, `${archivo}-${etiqueta}.txt`);
  const cabecera = [
    titulo,
    `Comando: npx ${args.join(' ')}`,
    `Fecha: ${new Date().toLocaleString('es-EC')} · Node ${process.version}`,
    `Resultado: ${r.status === 0 ? 'SIN ERRORES' : `con hallazgos (código de salida ${r.status})`}`,
    '='.repeat(70), ''
  ].join('\n');
  fs.writeFileSync(destino, cabecera + salida);
  console.log(`Guardado en docs/reportes/${path.basename(destino)}`);
  return r.status;
}

const tareas = tarea === 'todo' ? ['test', 'lint'] : [tarea];
const codigos = tareas.map(t => ejecutar(TAREAS[t]));
// ESLint con avisos (warnings) devuelve 0; solo un error real marca fallo.
process.exitCode = codigos.some(c => c !== 0) ? 1 : 0;
