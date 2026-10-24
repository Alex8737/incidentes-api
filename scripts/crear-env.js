/** Crea .env a partir de .env.example si todavía no existe (no sobrescribe uno existente). */
const fs = require('fs');
const path = require('path');

const raiz = path.join(__dirname, '..');
const destino = path.join(raiz, '.env');
if (fs.existsSync(destino)) {
  console.log('.env ya existe: se conserva.');
} else {
  fs.copyFileSync(path.join(raiz, '.env.example'), destino);
  console.log('.env creado desde .env.example (SQLite por defecto).');
}
fs.mkdirSync(path.join(raiz, 'database'), { recursive: true });
