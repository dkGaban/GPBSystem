/** Add product-service, service-price, and customer-unit schema relations. */
exports.up = async function up(knex) {
  await knex.raw(`
    IF OBJECT_ID('tblProductService', 'U') IS NULL
    CREATE TABLE tblProductService (
      PServiceID INT IDENTITY(1,1) PRIMARY KEY,
      BrandID INT NOT NULL,
      ServiceName NVARCHAR(100) NOT NULL,
      ModelCode NVARCHAR(100) NULL,
      UnitType NVARCHAR(50) NULL,
      CreatedAt DATETIME DEFAULT GETDATE(),
      CONSTRAINT FK_tblProductService_tblBrand FOREIGN KEY (BrandID) REFERENCES tblBrand(BrandID)
    );

    IF OBJECT_ID('tblServicePrice', 'U') IS NULL
    CREATE TABLE tblServicePrice (
      SPriceID INT IDENTITY(1,1) PRIMARY KEY,
      ServiceID INT NOT NULL,
      HPower NVARCHAR(50) NOT NULL,
      UnitType NVARCHAR(50) NULL,
      Amount DECIMAL(10,2) NOT NULL,
      CreatedAt DATETIME DEFAULT GETDATE(),
      CONSTRAINT FK_tblServicePrice_tblService FOREIGN KEY (ServiceID) REFERENCES tblService(ServiceID)
    );

    IF OBJECT_ID('tblCustomerUnit', 'U') IS NULL
    CREATE TABLE tblCustomerUnit (
      CUnitID INT IDENTITY(1,1) PRIMARY KEY,
      CustomerID INT NOT NULL,
      SerialNumber NVARCHAR(100) NULL,
      InstallationDate DATE NULL,
      WarrantyExpire DATE NULL,
      CreatedAt DATETIME DEFAULT GETDATE(),
      CONSTRAINT FK_tblCustomerUnit_tblCustomer FOREIGN KEY (CustomerID) REFERENCES tblCustomer(CustomerID)
    );

    IF OBJECT_ID('tblProduct', 'U') IS NOT NULL AND COL_LENGTH('tblProduct', 'PServiceID') IS NULL
      ALTER TABLE tblProduct ADD PServiceID INT NULL;

    IF OBJECT_ID('tblProduct', 'U') IS NOT NULL
      AND COL_LENGTH('tblProduct', 'PServiceID') IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_tblProduct_tblProductService')
      ALTER TABLE tblProduct ADD CONSTRAINT FK_tblProduct_tblProductService FOREIGN KEY (PServiceID) REFERENCES tblProductService(PServiceID);
  `);
};

exports.down = async function down(knex) {
  await knex.raw(`
    IF OBJECT_ID('tblProduct', 'U') IS NOT NULL
      AND EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_tblProduct_tblProductService')
      ALTER TABLE tblProduct DROP CONSTRAINT FK_tblProduct_tblProductService;

    IF OBJECT_ID('tblProduct', 'U') IS NOT NULL AND COL_LENGTH('tblProduct', 'PServiceID') IS NOT NULL
      ALTER TABLE tblProduct DROP COLUMN PServiceID;

    DROP TABLE IF EXISTS tblCustomerUnit;
    DROP TABLE IF EXISTS tblServicePrice;
    DROP TABLE IF EXISTS tblProductService;
  `);
};
