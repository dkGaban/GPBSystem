/** Repair legacy address strings that were saved without separators. */
exports.up = async function up(knex) {
  await knex.raw(`
    UPDATE Customers
    SET Address = CONCAT_WS(', ', NULLIF(LTRIM(RTRIM(HouseNumber)), ''), NULLIF(LTRIM(RTRIM(Street)), ''),
      CASE WHEN NULLIF(LTRIM(RTRIM(Barangay)), '') IS NOT NULL THEN CONCAT('Barangay ', REPLACE(LTRIM(RTRIM(Barangay)), 'Barangay ', '')) END,
      NULLIF(LTRIM(RTRIM(City)), ''), NULLIF(LTRIM(RTRIM(Province)), ''), NULLIF(LTRIM(RTRIM(ZipCode)), ''))
    WHERE NULLIF(LTRIM(RTRIM(HouseNumber)), '') IS NOT NULL
       OR NULLIF(LTRIM(RTRIM(Street)), '') IS NOT NULL
       OR NULLIF(LTRIM(RTRIM(Barangay)), '') IS NOT NULL
       OR NULLIF(LTRIM(RTRIM(City)), '') IS NOT NULL
       OR NULLIF(LTRIM(RTRIM(Province)), '') IS NOT NULL
       OR NULLIF(LTRIM(RTRIM(ZipCode)), '') IS NOT NULL;

    UPDATE Bookings
    SET Address = '35EJ.M BASA STREET, Barangay San Nicolas Central, Cebu City, Cebu, 7000'
    WHERE Address = '35EJ.M BASA STREETBarangay San Nicolas CentralCebu CityCebu7000';
  `);
};

exports.down = async function down() {};
