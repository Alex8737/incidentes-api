const { sequelize, migrar, revertirTodo } = require('../helpers');

describe('Migraciones y esquema', () => {
  const qi = sequelize.getQueryInterface();

  beforeAll(migrar);
  afterAll(() => sequelize.close());

  it('crea la tabla incidentes con todas las columnas', async () => {
    const cols = await qi.describeTable('incidentes');
    for (const c of ['id', 'titulo', 'descripcion', 'categoria', 'severidad', 'prioridad', 'estado',
      'reportado_por', 'fecha_creacion', 'fecha_actualizacion']) {
      expect(cols[c]).toBeTruthy(); // falta la columna ${c}
    }
    expect(cols.id.primaryKey).toBe(true);
    expect(cols.titulo.allowNull).toBe(false);
    expect(cols.prioridad.allowNull).toBe(false);
  });

  it('crea los índices para filtros por estado y prioridad', async () => {
    const nombres = (await qi.showIndex('incidentes')).map(i => i.name);
    for (const n of ['idx_incidentes_estado', 'idx_incidentes_prioridad', 'idx_incidentes_estado_prioridad']) {
      expect(nombres).toContain(n);
    }
  });

  it('las migraciones son reversibles (down) y se pueden volver a aplicar (up)', async () => {
    await revertirTodo();
    const tablas = (await qi.showAllTables()).map(t => (typeof t === 'string' ? t : t.tableName));
    expect(tablas).not.toContain('incidentes'); // la tabla debería haberse eliminado
    await migrar();
    const cols = await qi.describeTable('incidentes');
    expect(cols.prioridad).toBeTruthy();
  });
});
