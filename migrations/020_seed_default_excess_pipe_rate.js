/**
 * Seed a default excess pipe rate when tblExcessPipeRate is empty.
 *
 * Migration 019 created the table but only seeded a row when the legacy
 * tblExcessPipe table had a positive rate — which it did not.  This
 * migration inserts a sensible placeholder (₱450.00 / ft) so the admin
 * Pricing Settings panel and the customer booking flow work out of the
 * box.  The admin should review and update this value via the admin
 * portal after deployment.
 */
exports.up = async function up(knex) {
  await knex.raw(`
    IF NOT EXISTS (SELECT 1 FROM tblExcessPipeRate)
      INSERT INTO tblExcessPipeRate (RatePerFoot) VALUES (450.00);
  `);
};

exports.down = async function down(knex) {
  await knex.raw(`
    IF EXISTS (SELECT 1 FROM tblExcessPipeRate WHERE RatePerFoot = 450.00)
      DELETE FROM tblExcessPipeRate WHERE RatePerFoot = 450.00;
  `);
};
