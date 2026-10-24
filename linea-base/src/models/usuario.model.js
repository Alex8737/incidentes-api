/**
 * MODELO: Usuario (Sequelize)
 * La contraseña nunca se guarda en texto plano: solo su hash bcrypt (columna passwordHash).
 * El método toJSON() elimina el hash para que nunca salga en una respuesta HTTP.
 */
const { DataTypes } = require('sequelize');

const ROLES = ['admin', 'analista', 'visor'];

module.exports = sequelize => {
  const Usuario = sequelize.define('Usuario', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    usuario: {
      type: DataTypes.STRING(40),
      allowNull: false,
      unique: true,
      validate: { len: { args: [3, 40], msg: 'El usuario debe tener entre 3 y 40 caracteres' } }
    },
    nombre: { type: DataTypes.STRING(80), allowNull: false },
    passwordHash: { type: DataTypes.STRING(120), allowNull: false },
    rol: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: 'visor',
      validate: { isIn: { args: [ROLES], msg: `Rol inválido (${ROLES.join(', ')})` } }
    },
    activo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }
  }, {
    tableName: 'usuarios',
    underscored: true,
    timestamps: true,
    createdAt: 'fechaCreacion',
    updatedAt: 'fechaActualizacion',
    defaultScope: { attributes: { exclude: ['passwordHash'] } },
    scopes: { conPassword: { attributes: {} } }
  });

  Usuario.ROLES = ROLES;

  Usuario.prototype.toJSON = function () {
    const datos = { ...this.get() };
    delete datos.passwordHash;
    return datos;
  };

  return Usuario;
};
