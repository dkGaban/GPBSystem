/** Mark technician accounts created with a phone-number password. */
exports.up = async function up(knex) {
  await knex.raw(`
    IF COL_LENGTH('Users', 'MustChangePassword') IS NULL
      ALTER TABLE Users ADD MustChangePassword BIT NOT NULL CONSTRAINT DF_Users_MustChangePassword DEFAULT 0;
  `);
};

exports.down = async function down(knex) {
  await knex.raw(`
    IF COL_LENGTH('Users', 'MustChangePassword') IS NOT NULL
    BEGIN
      IF EXISTS (SELECT 1 FROM sys.default_constraints WHERE name = 'DF_Users_MustChangePassword' AND parent_object_id = OBJECT_ID('Users'))
        ALTER TABLE Users DROP CONSTRAINT DF_Users_MustChangePassword;
      ALTER TABLE Users DROP COLUMN MustChangePassword;
    END;
  `);
};
