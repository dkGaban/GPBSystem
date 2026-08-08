/** Add optional declared-unit details and link service details to a customer unit. */
exports.up = async function up(knex) {
  await knex.raw(`
    IF OBJECT_ID('tblCustomerUnit', 'U') IS NOT NULL AND COL_LENGTH('tblCustomerUnit', 'BrandID') IS NULL
      ALTER TABLE tblCustomerUnit ADD BrandID INT NULL;
    IF OBJECT_ID('tblCustomerUnit', 'U') IS NOT NULL AND COL_LENGTH('tblCustomerUnit', 'AirconType') IS NULL
      ALTER TABLE tblCustomerUnit ADD AirconType NVARCHAR(50) NULL;
    IF OBJECT_ID('tblCustomerUnit', 'U') IS NOT NULL AND COL_LENGTH('tblCustomerUnit', 'Technology') IS NULL
      ALTER TABLE tblCustomerUnit ADD Technology NVARCHAR(50) NULL;
    IF OBJECT_ID('tblCustomerUnit', 'U') IS NOT NULL AND COL_LENGTH('tblCustomerUnit', 'HorsePower') IS NULL
      ALTER TABLE tblCustomerUnit ADD HorsePower DECIMAL(4,2) NULL;

    IF OBJECT_ID('tblCustomerUnit', 'U') IS NOT NULL
      AND COL_LENGTH('tblCustomerUnit', 'BrandID') IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_tblCustomerUnit_tblBrand')
      ALTER TABLE tblCustomerUnit ADD CONSTRAINT FK_tblCustomerUnit_tblBrand FOREIGN KEY (BrandID) REFERENCES tblBrand(BrandID);

    IF OBJECT_ID('tblServiceDetails', 'U') IS NOT NULL AND COL_LENGTH('tblServiceDetails', 'CUnitID') IS NULL
      ALTER TABLE tblServiceDetails ADD CUnitID INT NULL;

    IF OBJECT_ID('tblServiceDetails', 'U') IS NOT NULL
      AND COL_LENGTH('tblServiceDetails', 'CUnitID') IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_tblServiceDetails_tblCustomerUnit')
      ALTER TABLE tblServiceDetails ADD CONSTRAINT FK_tblServiceDetails_tblCustomerUnit FOREIGN KEY (CUnitID) REFERENCES tblCustomerUnit(CUnitID);
  `);
};

exports.down = async function down(knex) {
  await knex.raw(`
    IF OBJECT_ID('tblServiceDetails', 'U') IS NOT NULL
      AND EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_tblServiceDetails_tblCustomerUnit')
      ALTER TABLE tblServiceDetails DROP CONSTRAINT FK_tblServiceDetails_tblCustomerUnit;
    IF OBJECT_ID('tblServiceDetails', 'U') IS NOT NULL AND COL_LENGTH('tblServiceDetails', 'CUnitID') IS NOT NULL
      ALTER TABLE tblServiceDetails DROP COLUMN CUnitID;

    IF OBJECT_ID('tblCustomerUnit', 'U') IS NOT NULL
      AND EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_tblCustomerUnit_tblBrand')
      ALTER TABLE tblCustomerUnit DROP CONSTRAINT FK_tblCustomerUnit_tblBrand;
    IF OBJECT_ID('tblCustomerUnit', 'U') IS NOT NULL AND COL_LENGTH('tblCustomerUnit', 'HorsePower') IS NOT NULL
      ALTER TABLE tblCustomerUnit DROP COLUMN HorsePower;
    IF OBJECT_ID('tblCustomerUnit', 'U') IS NOT NULL AND COL_LENGTH('tblCustomerUnit', 'Technology') IS NOT NULL
      ALTER TABLE tblCustomerUnit DROP COLUMN Technology;
    IF OBJECT_ID('tblCustomerUnit', 'U') IS NOT NULL AND COL_LENGTH('tblCustomerUnit', 'AirconType') IS NOT NULL
      ALTER TABLE tblCustomerUnit DROP COLUMN AirconType;
    IF OBJECT_ID('tblCustomerUnit', 'U') IS NOT NULL AND COL_LENGTH('tblCustomerUnit', 'BrandID') IS NOT NULL
      ALTER TABLE tblCustomerUnit DROP COLUMN BrandID;
  `);
};
