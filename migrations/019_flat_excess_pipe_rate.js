/**
 * Replace the HP-band excess pipe table with a single-row flat rate table.
 * Seeds the new table from the most common existing rate so no data is lost.
 */
exports.up = async function up(knex) {
  await knex.raw(`
    IF OBJECT_ID('tblExcessPipeRate', 'U') IS NULL
    CREATE TABLE tblExcessPipeRate (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      RatePerFoot DECIMAL(10,2) NOT NULL,
      CreatedAt DATETIME DEFAULT GETDATE()
    );
  `);

  await knex.raw(`
    IF NOT EXISTS (SELECT 1 FROM tblExcessPipeRate)
    BEGIN
      DECLARE @seededRate DECIMAL(10,2);
      IF EXISTS (SELECT 1 FROM tblExcessPipe)
        SET @seededRate = (SELECT TOP 1 RatePerFoot FROM tblExcessPipe ORDER BY PipeRateID);
      ELSE
        SET @seededRate = 0;
      IF @seededRate > 0
        INSERT INTO tblExcessPipeRate (RatePerFoot) VALUES (@seededRate);
    END
  `);
};

exports.down = async function down(knex) {
  await knex.raw(`IF OBJECT_ID('tblExcessPipeRate', 'U') IS NOT NULL DROP TABLE tblExcessPipeRate;`);
};
