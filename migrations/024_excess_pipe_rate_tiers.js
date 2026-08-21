/**
 * Restore HP-banded excess pipe rates (₱400/ft 1-1.5hp, ₱450/ft 2-2.5hp, ₱500/ft 3hp).
 * Adds an HPower label column and ensures the three business bands exist; the
 * pre-existing flat-rate row is preserved; the three labeled bands are added
 * alongside it when they do not already exist.
 */
exports.up = async function up(knex) {
  await knex.raw(`
    IF OBJECT_ID('tblExcessPipeRate', 'U') IS NOT NULL AND COL_LENGTH('tblExcessPipeRate', 'HPower') IS NULL
      ALTER TABLE tblExcessPipeRate ADD HPower NVARCHAR(50) NULL;
  `);

  await knex.raw(`
    IF OBJECT_ID('tblExcessPipeRate', 'U') IS NOT NULL
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM tblExcessPipeRate WHERE HPower = N'1hp - 1.5hp')
        INSERT INTO tblExcessPipeRate (HPower, RatePerFoot) VALUES (N'1hp - 1.5hp', 400.00);
      ELSE
        UPDATE tblExcessPipeRate SET RatePerFoot = 400.00 WHERE HPower = N'1hp - 1.5hp';

      IF NOT EXISTS (SELECT 1 FROM tblExcessPipeRate WHERE HPower = N'2hp - 2.5hp')
        INSERT INTO tblExcessPipeRate (HPower, RatePerFoot) VALUES (N'2hp - 2.5hp', 450.00);
      ELSE
        UPDATE tblExcessPipeRate SET RatePerFoot = 450.00 WHERE HPower = N'2hp - 2.5hp';

      IF NOT EXISTS (SELECT 1 FROM tblExcessPipeRate WHERE HPower = N'3hp')
        INSERT INTO tblExcessPipeRate (HPower, RatePerFoot) VALUES (N'3hp', 500.00);
      ELSE
        UPDATE tblExcessPipeRate SET RatePerFoot = 500.00 WHERE HPower = N'3hp';
    END
  `);
};

exports.down = async function down(knex) {
  await knex.raw(`
    IF OBJECT_ID('tblExcessPipeRate', 'U') IS NOT NULL AND COL_LENGTH('tblExcessPipeRate', 'HPower') IS NOT NULL
      ALTER TABLE tblExcessPipeRate DROP COLUMN HPower;
  `);
};
