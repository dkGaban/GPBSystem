/** Add technician-submitted job charge reports awaiting admin approval for service requests. */
exports.up = async function up(knex) {
  await knex.raw(`
    IF OBJECT_ID('tblJobCharge', 'U') IS NULL
    CREATE TABLE tblJobCharge (
      ChargeID INT IDENTITY(1,1) PRIMARY KEY,
      RequestID INT NOT NULL,
      ExcessPipeFeet INT NULL,
      ExcessPipeRate DECIMAL(10,2) NULL,
      ExcessPipeCost DECIMAL(10,2) NULL,
      AdditionalDescription NVARCHAR(500) NULL,
      AdditionalCost DECIMAL(10,2) NOT NULL DEFAULT 0,
      ProposedTotal DECIMAL(10,2) NOT NULL,
      Status NVARCHAR(20) NOT NULL DEFAULT 'Pending',
      SubmittedBy NVARCHAR(100) NULL,
      SubmittedAt DATETIME NOT NULL DEFAULT GETDATE(),
      ReviewedBy NVARCHAR(100) NULL,
      ReviewedAt DATETIME NULL,
      CreatedAt DATETIME DEFAULT GETDATE(),
      CONSTRAINT FK_tblJobCharge_tblServiceRequest FOREIGN KEY (RequestID) REFERENCES tblServiceRequest(RequestID)
    );
  `);
};

exports.down = async function down(knex) {
  await knex.raw(`IF OBJECT_ID('tblJobCharge', 'U') IS NOT NULL DROP TABLE tblJobCharge;`);
};
