/** Add reminder-link and rescheduling state to bookings. */
exports.up = async function up(knex) {
  await knex.raw(`
    IF COL_LENGTH('Bookings', 'ReminderToken') IS NULL ALTER TABLE Bookings ADD ReminderToken NVARCHAR(128) NULL;
    IF COL_LENGTH('Bookings', 'ReminderTokenExpiresAt') IS NULL ALTER TABLE Bookings ADD ReminderTokenExpiresAt DATETIME NULL;
    IF COL_LENGTH('Bookings', 'ReminderSentAt') IS NULL ALTER TABLE Bookings ADD ReminderSentAt DATETIME NULL;
    IF COL_LENGTH('Bookings', 'RescheduleCount') IS NULL ALTER TABLE Bookings ADD RescheduleCount INT NOT NULL CONSTRAINT DF_Bookings_RescheduleCount DEFAULT 0;
    IF COL_LENGTH('Bookings', 'LastActionAt') IS NULL ALTER TABLE Bookings ADD LastActionAt DATETIME NULL;
  `);
};

exports.down = async function down(knex) {
  await knex.raw(`
    IF COL_LENGTH('Bookings', 'ReminderToken') IS NOT NULL ALTER TABLE Bookings DROP COLUMN ReminderToken;
    IF COL_LENGTH('Bookings', 'ReminderTokenExpiresAt') IS NOT NULL ALTER TABLE Bookings DROP COLUMN ReminderTokenExpiresAt;
    IF COL_LENGTH('Bookings', 'ReminderSentAt') IS NOT NULL ALTER TABLE Bookings DROP COLUMN ReminderSentAt;
    IF COL_LENGTH('Bookings', 'RescheduleCount') IS NOT NULL
    BEGIN
      IF EXISTS (SELECT 1 FROM sys.default_constraints WHERE name = 'DF_Bookings_RescheduleCount' AND parent_object_id = OBJECT_ID('Bookings')) ALTER TABLE Bookings DROP CONSTRAINT DF_Bookings_RescheduleCount;
      ALTER TABLE Bookings DROP COLUMN RescheduleCount;
    END;
    IF COL_LENGTH('Bookings', 'LastActionAt') IS NOT NULL ALTER TABLE Bookings DROP COLUMN LastActionAt;
  `);
};
