/** Add standalone lookup tables for brands, inclusions, exclusions, and excess-pipe rates. */
exports.up = async function up(knex) {
  await knex.raw(`
    IF OBJECT_ID('tblBrand', 'U') IS NULL
    CREATE TABLE tblBrand (
      BrandID INT IDENTITY(1,1) PRIMARY KEY,
      Name NVARCHAR(100) NOT NULL,
      CreatedAt DATETIME DEFAULT GETDATE()
    );

    IF OBJECT_ID('tblInclusions', 'U') IS NULL
    CREATE TABLE tblInclusions (
      InclusionID INT IDENTITY(1,1) PRIMARY KEY,
      Description NVARCHAR(500) NOT NULL,
      CreatedAt DATETIME DEFAULT GETDATE()
    );

    IF OBJECT_ID('tblExclusions', 'U') IS NULL
    CREATE TABLE tblExclusions (
      ExclusionID INT IDENTITY(1,1) PRIMARY KEY,
      Description NVARCHAR(500) NOT NULL,
      CreatedAt DATETIME DEFAULT GETDATE()
    );

    IF OBJECT_ID('tblExcessPipe', 'U') IS NULL
    CREATE TABLE tblExcessPipe (
      PipeRateID INT IDENTITY(1,1) PRIMARY KEY,
      HPower NVARCHAR(50) NOT NULL,
      RatePerFoot DECIMAL(10,2) NOT NULL,
      CreatedAt DATETIME DEFAULT GETDATE()
    );
  `);
};

exports.down = async function down(knex) {
  await knex.raw(`
    DROP TABLE IF EXISTS tblExcessPipe;
    DROP TABLE IF EXISTS tblExclusions;
    DROP TABLE IF EXISTS tblInclusions;
    DROP TABLE IF EXISTS tblBrand;
  `);
};
