/** Add optional customer-submitted unit photos (JSON array of data URLs) to customer units. */
exports.up = async function up(knex) {
  await knex.raw(`
    IF OBJECT_ID('tblCustomerUnit', 'U') IS NOT NULL
      AND COL_LENGTH('tblCustomerUnit', 'Photos') IS NULL
    BEGIN
      ALTER TABLE tblCustomerUnit ADD Photos NVARCHAR(MAX) NULL;
    END;
  `);
};

exports.down = async function down(knex) {
  await knex.raw(`
    IF OBJECT_ID('tblCustomerUnit', 'U') IS NOT NULL
      AND COL_LENGTH('tblCustomerUnit', 'Photos') IS NOT NULL
    BEGIN
      ALTER TABLE tblCustomerUnit DROP COLUMN Photos;
    END;
  `);
};
