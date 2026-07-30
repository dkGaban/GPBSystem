/** Store the service-area pin alongside the existing free-text addresses. */
exports.up = async function up(knex) {
  await knex.raw(`
    IF COL_LENGTH('Bookings', 'Latitude') IS NULL ALTER TABLE Bookings ADD Latitude DECIMAL(9, 6) NULL;
    IF COL_LENGTH('Bookings', 'Longitude') IS NULL ALTER TABLE Bookings ADD Longitude DECIMAL(9, 6) NULL;
    IF COL_LENGTH('Customers', 'Latitude') IS NULL ALTER TABLE Customers ADD Latitude DECIMAL(9, 6) NULL;
    IF COL_LENGTH('Customers', 'Longitude') IS NULL ALTER TABLE Customers ADD Longitude DECIMAL(9, 6) NULL;
    IF COL_LENGTH('Technicians', 'Latitude') IS NULL ALTER TABLE Technicians ADD Latitude DECIMAL(9, 6) NULL;
    IF COL_LENGTH('Technicians', 'Longitude') IS NULL ALTER TABLE Technicians ADD Longitude DECIMAL(9, 6) NULL;
  `);
};

exports.down = async function down(knex) {
  await knex.raw(`
    IF COL_LENGTH('Bookings', 'Latitude') IS NOT NULL ALTER TABLE Bookings DROP COLUMN Latitude;
    IF COL_LENGTH('Bookings', 'Longitude') IS NOT NULL ALTER TABLE Bookings DROP COLUMN Longitude;
    IF COL_LENGTH('Customers', 'Latitude') IS NOT NULL ALTER TABLE Customers DROP COLUMN Latitude;
    IF COL_LENGTH('Customers', 'Longitude') IS NOT NULL ALTER TABLE Customers DROP COLUMN Longitude;
    IF COL_LENGTH('Technicians', 'Latitude') IS NOT NULL ALTER TABLE Technicians DROP COLUMN Latitude;
    IF COL_LENGTH('Technicians', 'Longitude') IS NOT NULL ALTER TABLE Technicians DROP COLUMN Longitude;
  `);
};
