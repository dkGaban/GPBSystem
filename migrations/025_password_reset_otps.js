/**
 * Create the PasswordResetOTPs table for storing one-time password codes
 * used by the forgot-password flow.
 */
exports.up = async function up(knex) {
  await knex.raw(`
    IF OBJECT_ID('PasswordResetOTPs', 'U') IS NULL
    CREATE TABLE PasswordResetOTPs (
      Id        INT IDENTITY(1,1) PRIMARY KEY,
      Email     NVARCHAR(150) NOT NULL,
      OTP       NVARCHAR(10)  NOT NULL,
      ExpiresAt DATETIME      NOT NULL,
      Used      BIT           NOT NULL DEFAULT 0,
      CreatedAt DATETIME      NOT NULL DEFAULT GETDATE()
    );
  `);
  await knex.raw(`
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PasswordResetOTPs_Email' AND object_id = OBJECT_ID('PasswordResetOTPs'))
      CREATE INDEX IX_PasswordResetOTPs_Email ON PasswordResetOTPs(Email);
  `);
};

exports.down = async function down(knex) {
  await knex.raw(`
    IF OBJECT_ID('PasswordResetOTPs', 'U') IS NOT NULL
      DROP TABLE PasswordResetOTPs;
  `);
};
