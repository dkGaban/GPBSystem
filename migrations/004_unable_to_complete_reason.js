/** Store the technician's explanation when a job cannot be completed. */
exports.up = async function up(knex) {
  await knex.raw(`
    IF COL_LENGTH('Bookings', 'UnableToCompleteReason') IS NULL
      ALTER TABLE Bookings ADD UnableToCompleteReason NVARCHAR(500) NULL;
  `);
};

exports.down = async function down(knex) {
  await knex.raw(`
    IF COL_LENGTH('Bookings', 'UnableToCompleteReason') IS NOT NULL
      ALTER TABLE Bookings DROP COLUMN UnableToCompleteReason;
  `);
};
