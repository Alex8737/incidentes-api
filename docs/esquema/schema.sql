-- =====================================================================
--  ESQUEMA DE LA BASE DE DATOS - Plataforma de Incidentes (Reto 2 ampliado)
--  Equivale al resultado de aplicar, en orden, las migraciones:
--    1) 20260925000001-crear-tabla-incidentes.js
--    2) 20261001000002-agregar-prioridad-incidentes.js
--  Sintaxis compatible con SQLite (motor por defecto) y MySQL 8.
--  NOTA: la fuente de verdad son las MIGRACIONES; este archivo es documentación.
--        El esquema real exportado de la base está en schema-generado.sql (npm run db:esquema).
-- =====================================================================

CREATE TABLE incidentes (
  id                  INTEGER       PRIMARY KEY AUTOINCREMENT,   -- MySQL: INT AUTO_INCREMENT
  titulo              VARCHAR(120)  NOT NULL,
  descripcion         TEXT          NOT NULL DEFAULT '',
  categoria           VARCHAR(30)   NOT NULL DEFAULT 'otro',
  severidad           VARCHAR(10)   NOT NULL,
  estado              VARCHAR(15)   NOT NULL DEFAULT 'abierto',
  reportado_por       VARCHAR(80)   NOT NULL DEFAULT 'Anónimo',
  fecha_creacion      DATETIME      NOT NULL,
  fecha_actualizacion DATETIME      NOT NULL,
  prioridad           VARCHAR(10)   NOT NULL DEFAULT 'media'      -- agregada por la migración 2
);

-- Índices (migración 1)
CREATE INDEX idx_incidentes_estado         ON incidentes (estado);
CREATE INDEX idx_incidentes_severidad      ON incidentes (severidad);
CREATE INDEX idx_incidentes_fecha_creacion ON incidentes (fecha_creacion);

-- Índices (migración 2)
CREATE INDEX idx_incidentes_prioridad        ON incidentes (prioridad);
CREATE INDEX idx_incidentes_estado_prioridad ON incidentes (estado, prioridad);

-- Tablas de control creadas por sequelize-cli
CREATE TABLE SequelizeMeta (name VARCHAR(255) NOT NULL PRIMARY KEY);   -- migraciones aplicadas
CREATE TABLE SequelizeData (name VARCHAR(255) NOT NULL PRIMARY KEY);   -- seeders aplicados

-- ---------------------------------------------------------------------
-- Dominios válidos (validados en el modelo Sequelize y en el middleware):
--   categoria : phishing | malware | acceso_no_autorizado | ddos | fuga_de_datos | otro
--   severidad : baja | media | alta | critica          (impacto técnico)
--   prioridad : baja | media | alta | urgente          (urgencia de atención)
--   estado    : abierto | en_progreso | resuelto | cerrado
-- ---------------------------------------------------------------------

-- Usuario de mínimo privilegio recomendado para MySQL (la app no necesita ser root):
-- CREATE DATABASE incidentes_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- CREATE USER 'incidentes_app'@'localhost' IDENTIFIED BY '<clave_en_.env>';
-- GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, DROP, REFERENCES
--   ON incidentes_db.* TO 'incidentes_app'@'localhost';
