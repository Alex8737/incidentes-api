/**
 * MODELO: Incidente (Sequelize)
 * Define atributos, tipos, valores por defecto y VALIDACIONES a nivel de modelo.
 * Es la segunda capa de validación: aunque alguien llame al modelo sin pasar
 * por el middleware HTTP, la base nunca recibirá datos fuera de catálogo.
 */
const { DataTypes } = require('sequelize');
const { SEVERIDADES, PRIORIDADES, ESTADOS, CATEGORIAS } = require('./catalogos');

/** Atributos del modelo (columnas, tipos, valores por defecto y validaciones). */
const ATRIBUTOS = {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  titulo: {
    type: DataTypes.STRING(120),
    allowNull: false,
    validate: {
      notEmpty: { msg: 'El título es obligatorio' },
      len: { args: [5, 120], msg: 'El título debe tener entre 5 y 120 caracteres' }
    }
  },
  descripcion: {
    type: DataTypes.TEXT,
    allowNull: false,
    defaultValue: '',
    validate: { len: { args: [0, 2000], msg: 'La descripción no puede superar 2000 caracteres' } }
  },
  categoria: {
    type: DataTypes.STRING(30),
    allowNull: false,
    defaultValue: 'otro',
    validate: { isIn: { args: [CATEGORIAS], msg: `Categoría inválida (${CATEGORIAS.join(', ')})` } }
  },
  severidad: {
    type: DataTypes.STRING(10),
    allowNull: false,
    validate: { isIn: { args: [SEVERIDADES], msg: `Severidad inválida (${SEVERIDADES.join(', ')})` } }
  },
  prioridad: {
    type: DataTypes.STRING(10),
    allowNull: false,
    defaultValue: 'media',
    validate: { isIn: { args: [PRIORIDADES], msg: `Prioridad inválida (${PRIORIDADES.join(', ')})` } }
  },
  estado: {
    type: DataTypes.STRING(15),
    allowNull: false,
    defaultValue: 'abierto',
    validate: { isIn: { args: [ESTADOS], msg: `Estado inválido (${ESTADOS.join(', ')})` } }
  },
  reportadoPor: {
    type: DataTypes.STRING(80),
    allowNull: false,
    defaultValue: 'Anónimo',
    validate: { len: { args: [1, 80], msg: 'reportadoPor debe tener entre 1 y 80 caracteres' } }
  }
};

module.exports = sequelize => {
  const Incidente = sequelize.define('Incidente', ATRIBUTOS, {
    tableName: 'incidentes',
    underscored: true,
    timestamps: true,
    createdAt: 'fechaCreacion',       // columna fecha_creacion
    updatedAt: 'fechaActualizacion'   // columna fecha_actualizacion
  });

  /** Campos que el cliente puede escribir (whitelist contra asignación masiva). */
  Incidente.CAMPOS_EDITABLES = ['titulo', 'descripcion', 'categoria', 'severidad', 'prioridad', 'estado', 'reportadoPor'];

  return Incidente;
};
