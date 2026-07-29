const path = require("path");
const sql = require("mssql");
const knexFactory = require("knex");

const parseBoolean = (value, fallback) => value === undefined ? fallback : String(value).toLowerCase() === "true";

const dbConfig = process.env.DB_SERVER
  ? {
      server: process.env.DB_SERVER,
      database: process.env.DB_DATABASE || "GBPServiceDB",
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      options: {
        encrypt: parseBoolean(process.env.DB_ENCRYPT, true),
        trustServerCertificate: parseBoolean(process.env.DB_TRUST_SERVER_CERTIFICATE, false)
      }
    }
  : process.env.DB_CONNECTION_STRING
    // Local-development fallback only. Prefer the DB_* variables in deployed environments.
    ? { connectionString: process.env.DB_CONNECTION_STRING }
    : (() => { throw new Error("Database configuration is missing. Set DB_SERVER, DB_DATABASE, DB_USER, and DB_PASSWORD."); })();

let poolPromise;
let migrationPromise;

function getPool() {
  if (!poolPromise) poolPromise = sql.connect(dbConfig);
  return poolPromise;
}

async function runMigrations() {
  if (!migrationPromise) {
    const knex = knexFactory({
      client: "mssql",
      connection: dbConfig,
      migrations: { directory: path.join(__dirname, "..", "migrations") }
    });
    migrationPromise = knex.migrate.latest().finally(() => knex.destroy());
  }
  return migrationPromise;
}

async function seedAdmin({ hashPassword, adminDefaultPassword, logger }) {
  const pool = await getPool();
  const adminPassword = hashPassword(adminDefaultPassword, "gbp-default-admin-salt");
  await pool
    .request()
    .input("Username", sql.NVarChar(80), "admin")
    .input("FullName", sql.NVarChar(100), "System Administrator")
    .input("Email", sql.NVarChar(150), "admin@gmail.com")
    .input("PasswordHash", sql.NVarChar(255), adminPassword.hash)
    .input("PasswordSalt", sql.NVarChar(80), adminPassword.salt)
    .input("Role", sql.NVarChar(30), "admin")
    .query(`
      IF EXISTS (SELECT 1 FROM Users WHERE Username = @Username)
      BEGIN
        UPDATE Users
        SET FullName = @FullName, Email = @Email, PasswordHash = @PasswordHash, PasswordSalt = @PasswordSalt, Role = @Role
        WHERE Username = @Username
      END
      ELSE
      BEGIN
        INSERT INTO Users (Username, FullName, Email, PasswordHash, PasswordSalt, Role)
        VALUES (@Username, @FullName, @Email, @PasswordHash, @PasswordSalt, @Role)
      END
    `);
  logger.info({ username: "admin" }, "Admin seed verified");
}

async function initializeDatabase(options) {
  await runMigrations();
  await seedAdmin(options);
}

module.exports = { dbConfig, getPool, initializeDatabase, runMigrations, sql };
