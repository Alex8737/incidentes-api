/**
 * Exporta el esquema REAL de la base (después de las migraciones) a docs/esquema/schema-generado.sql
 * Sirve como evidencia de que la estructura la crearon las migraciones.
 */
const fs = require('fs');
const path = require('path');
const { sequelize } = require('../src/models');

(async () => {
  try {
    const dialecto = sequelize.getDialect();
    let sql = `-- Esquema exportado desde la base (${dialecto}) el ${new Date().toISOString()}\n\n`;

    if (dialecto === 'sqlite') {
      const [filas] = await sequelize.query(
        "SELECT type, name, sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY type DESC, name"
      );
      sql += filas.map(f => `${f.sql};`).join('\n\n');
    } else if (dialecto === 'mysql') {
      for (const t of ['incidentes', 'SequelizeMeta', 'SequelizeData']) {
        const [[fila]] = await sequelize.query(`SHOW CREATE TABLE \`${t}\``);
        sql += `${fila['Create Table']};\n\n`;
      }
    } else {
      sql += '-- Para PostgreSQL use: pg_dump --schema-only\n';
    }

    const [migraciones] = await sequelize.query('SELECT name FROM "SequelizeMeta" ORDER BY name'.replace(/"/g, dialecto === 'mysql' ? '`' : '"'));
    sql += `\n\n-- Migraciones aplicadas:\n${migraciones.map(m => `--   ${m.name}`).join('\n')}\n`;

    const destino = path.join(__dirname, '..', 'docs', 'esquema', 'schema-generado.sql');
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.writeFileSync(destino, sql);
    console.log(sql);
    console.log(`\nEsquema guardado en ${path.relative(process.cwd(), destino)}`);
  } catch (err) {
    console.error('No se pudo exportar el esquema:', err.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
})();
