/** Add service-detail and payment tables, plus the optional customer-unit link. */
exports.up = async function up(knex) {
  await knex.raw(`
    IF OBJECT_ID('tblServiceDetails', 'U') IS NULL
    CREATE TABLE tblServiceDetails (
      SDetailID INT IDENTITY(1,1) PRIMARY KEY,
      RequestID INT NOT NULL,
      Quantity INT NOT NULL DEFAULT 1,
      Description NVARCHAR(500) NULL,
      UPrice DECIMAL(10,2) NOT NULL,
      SubTotal DECIMAL(10,2) NOT NULL,
      CreatedAt DATETIME DEFAULT GETDATE(),
      CONSTRAINT FK_tblServiceDetails_tblServiceRequest FOREIGN KEY (RequestID) REFERENCES tblServiceRequest(RequestID)
    );

    IF OBJECT_ID('tblPayment', 'U') IS NULL
    CREATE TABLE tblPayment (
      PaymentID INT IDENTITY(1,1) PRIMARY KEY,
      RequestID INT NOT NULL,
      [Date] DATETIME NOT NULL DEFAULT GETDATE(),
      ReferenceNo NVARCHAR(100) NULL,
      AmountPaid DECIMAL(10,2) NOT NULL,
      Discount DECIMAL(10,2) NOT NULL DEFAULT 0,
      Balance DECIMAL(10,2) NOT NULL DEFAULT 0,
      ReceivedBy NVARCHAR(100) NULL,
      CreatedAt DATETIME DEFAULT GETDATE(),
      CONSTRAINT FK_tblPayment_tblServiceRequest FOREIGN KEY (RequestID) REFERENCES tblServiceRequest(RequestID)
    );

    IF OBJECT_ID('tblServiceRequest', 'U') IS NOT NULL AND COL_LENGTH('tblServiceRequest', 'CUnitID') IS NULL
      ALTER TABLE tblServiceRequest ADD CUnitID INT NULL;

    IF OBJECT_ID('tblServiceRequest', 'U') IS NOT NULL
      AND COL_LENGTH('tblServiceRequest', 'CUnitID') IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_tblServiceRequest_tblCustomerUnit')
      ALTER TABLE tblServiceRequest ADD CONSTRAINT FK_tblServiceRequest_tblCustomerUnit FOREIGN KEY (CUnitID) REFERENCES tblCustomerUnit(CUnitID);
  `);
};

exports.down = async function down(knex) {
  await knex.raw(`
    IF OBJECT_ID('tblServiceRequest', 'U') IS NOT NULL
      AND EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_tblServiceRequest_tblCustomerUnit')
      ALTER TABLE tblServiceRequest DROP CONSTRAINT FK_tblServiceRequest_tblCustomerUnit;

    IF OBJECT_ID('tblServiceRequest', 'U') IS NOT NULL AND COL_LENGTH('tblServiceRequest', 'CUnitID') IS NOT NULL
      ALTER TABLE tblServiceRequest DROP COLUMN CUnitID;

    DROP TABLE IF EXISTS tblPayment;
    DROP TABLE IF EXISTS tblServiceDetails;
  `);
};
