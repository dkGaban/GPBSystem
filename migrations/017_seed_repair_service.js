/** Seed the flat-rate Repair service (diagnosis-based booking flow). */
exports.up = async function up(knex) {
  await knex.raw(`
    IF OBJECT_ID('tblService', 'U') IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM tblService WHERE LOWER(Name) = LOWER('Repair'))
    BEGIN
      INSERT INTO tblService (Name, Type, Price, Inclusion, Exclusion)
      VALUES ('Repair', 'Repair', 450.00,
        'Full diagnosis of the unit problem, Full on-site repair quotation, No hidden fees',
        'Parts and permits are quoted separately');
    END;
  `);
};

exports.down = async function down(knex) {};
