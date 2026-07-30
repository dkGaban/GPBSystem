/** Track cancellations made after the technician has arrived. */
exports.up = async function up(knex) {
  await knex.raw(`
    IF COL_LENGTH('Bookings', 'CancellationFeeApplies') IS NULL
      ALTER TABLE Bookings ADD CancellationFeeApplies BIT NOT NULL CONSTRAINT DF_Bookings_CancellationFeeApplies DEFAULT 0;
  `);
};

exports.down = async function down(knex) {
  await knex.raw(`
    IF COL_LENGTH('Bookings', 'CancellationFeeApplies') IS NOT NULL
    BEGIN
      IF EXISTS (SELECT 1 FROM sys.default_constraints WHERE name = 'DF_Bookings_CancellationFeeApplies' AND parent_object_id = OBJECT_ID('Bookings'))
        ALTER TABLE Bookings DROP CONSTRAINT DF_Bookings_CancellationFeeApplies;
      ALTER TABLE Bookings DROP COLUMN CancellationFeeApplies;
    END;
  `);
};
