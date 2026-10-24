/**
 * Muestra el contenido REAL de la base de datos (estructura, migraciones aplicadas y registros).
 *   node scripts/ver-base.js
 * Sirve para tomar capturas de evidencia sin instalar un cliente de BD.
 */
const { sequelize } = require('../src/models');

(async () => {
  try {
    const qi = sequelize.getQueryInterface();
    console.log(`\nBASE DE DATOS: ${sequelize.getDialect()}  |  ${sequelize.options.storage || sequelize.config.database}\n`);

    console.log('=== Tablas ===');
    const tablas = (await qi.showAllTables()).map(t => (typeof t === 'string' ? t : t.tableName));
    console.log(tablas.join(', '));

    console.log('\n=== Estructura de la tabla "incidentes" ===');
    const cols = await qi.describeTable('incidentes');
    console.table(Object.entries(cols).map(([nombre, c]) => ({
      columna: nombre, tipo: c.type, nulo: c.allowNull ? 'SI' : 'NO',
      defecto: c.defaultValue ?? '', pk: c.primaryKey ? 'PK' : ''
    })));

    console.log('=== Índices ===');
    console.table((await qi.showIndex('incidentes')).map(i => ({
      indice: i.name, columnas: i.fields.map(f => f.attribute).join(', ')
    })));

    console.log('=== Migraciones aplicadas (SequelizeMeta) ===');
    const [meta] = await sequelize.query('SELECT name FROM SequelizeMeta ORDER BY name');
    console.table(meta);

    console.log('=== Registros de "incidentes" ===');
    const [filas] = await sequelize.query(
      'SELECT id, titulo, categoria, severidad, prioridad, estado, reportado_por, fecha_creacion FROM incidentes ORDER BY id'
    );
    console.table(filas.map(f => ({ ...f, titulo: f.titulo.slice(0, 40) })));
  } catch (err) {
    console.error('No se pudo leer la base:', err.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
})();
