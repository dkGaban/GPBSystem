/** Rename the core tables and columns to the current schema convention. */
exports.up = async function up(knex) {
  await knex.raw(`
    IF OBJECT_ID('Customers', 'U') IS NOT NULL AND OBJECT_ID('tblCustomer', 'U') IS NULL
      EXEC sp_rename 'Customers', 'tblCustomer';
    IF OBJECT_ID('Services', 'U') IS NOT NULL AND OBJECT_ID('tblService', 'U') IS NULL
      EXEC sp_rename 'Services', 'tblService';
    IF OBJECT_ID('Products', 'U') IS NOT NULL AND OBJECT_ID('tblProduct', 'U') IS NULL
      EXEC sp_rename 'Products', 'tblProduct';
    IF OBJECT_ID('Bookings', 'U') IS NOT NULL AND OBJECT_ID('tblServiceRequest', 'U') IS NULL
      EXEC sp_rename 'Bookings', 'tblServiceRequest';

    IF OBJECT_ID('tblCustomer', 'U') IS NOT NULL AND COL_LENGTH('tblCustomer', 'Id') IS NOT NULL AND COL_LENGTH('tblCustomer', 'CustomerID') IS NULL
      EXEC sp_rename 'tblCustomer.Id', 'CustomerID', 'COLUMN';
    IF OBJECT_ID('tblCustomer', 'U') IS NOT NULL AND COL_LENGTH('tblCustomer', 'Phone') IS NOT NULL AND COL_LENGTH('tblCustomer', 'CNumber') IS NULL
      EXEC sp_rename 'tblCustomer.Phone', 'CNumber', 'COLUMN';
    IF OBJECT_ID('tblCustomer', 'U') IS NOT NULL AND COL_LENGTH('tblCustomer', 'CreatedAt') IS NOT NULL AND COL_LENGTH('tblCustomer', 'DateRegistered') IS NULL
      EXEC sp_rename 'tblCustomer.CreatedAt', 'DateRegistered', 'COLUMN';

    IF OBJECT_ID('tblService', 'U') IS NOT NULL AND COL_LENGTH('tblService', 'Id') IS NOT NULL AND COL_LENGTH('tblService', 'ServiceID') IS NULL
      EXEC sp_rename 'tblService.Id', 'ServiceID', 'COLUMN';

    IF OBJECT_ID('tblProduct', 'U') IS NOT NULL AND COL_LENGTH('tblProduct', 'Id') IS NOT NULL AND COL_LENGTH('tblProduct', 'ProductID') IS NULL
      EXEC sp_rename 'tblProduct.Id', 'ProductID', 'COLUMN';
    IF OBJECT_ID('tblProduct', 'U') IS NOT NULL AND COL_LENGTH('tblProduct', 'Horsepower') IS NOT NULL AND COL_LENGTH('tblProduct', 'HorsePower') IS NULL
      EXEC sp_rename 'tblProduct.Horsepower', 'HorsePower', 'COLUMN';

    IF OBJECT_ID('tblServiceRequest', 'U') IS NOT NULL AND COL_LENGTH('tblServiceRequest', 'Id') IS NOT NULL AND COL_LENGTH('tblServiceRequest', 'RequestID') IS NULL
      EXEC sp_rename 'tblServiceRequest.Id', 'RequestID', 'COLUMN';
    IF OBJECT_ID('tblServiceRequest', 'U') IS NOT NULL AND COL_LENGTH('tblServiceRequest', 'CustomerId') IS NOT NULL AND COL_LENGTH('tblServiceRequest', 'CustomerID') IS NULL
      EXEC sp_rename 'tblServiceRequest.CustomerId', 'CustomerID', 'COLUMN';
    IF OBJECT_ID('tblServiceRequest', 'U') IS NOT NULL AND COL_LENGTH('tblServiceRequest', 'ServiceId') IS NOT NULL AND COL_LENGTH('tblServiceRequest', 'ServiceID') IS NULL
      EXEC sp_rename 'tblServiceRequest.ServiceId', 'ServiceID', 'COLUMN';
    IF OBJECT_ID('tblServiceRequest', 'U') IS NOT NULL AND COL_LENGTH('tblServiceRequest', 'PreferredDate') IS NOT NULL AND COL_LENGTH('tblServiceRequest', 'RequestDate') IS NULL
      EXEC sp_rename 'tblServiceRequest.PreferredDate', 'RequestDate', 'COLUMN';
    IF OBJECT_ID('tblServiceRequest', 'U') IS NOT NULL AND COL_LENGTH('tblServiceRequest', 'PreferredTime') IS NOT NULL AND COL_LENGTH('tblServiceRequest', 'RequestTime') IS NULL
      EXEC sp_rename 'tblServiceRequest.PreferredTime', 'RequestTime', 'COLUMN';

    IF OBJECT_ID('tblCustomer', 'U') IS NOT NULL AND COL_LENGTH('tblCustomer', 'Landmark') IS NULL
      ALTER TABLE tblCustomer ADD Landmark NVARCHAR(255) NULL;
    IF OBJECT_ID('tblProduct', 'U') IS NOT NULL AND COL_LENGTH('tblProduct', 'Installation') IS NULL
      ALTER TABLE tblProduct ADD Installation NVARCHAR(255) NULL;
  `);
};

exports.down = async function down(knex) {
  await knex.raw(`
    IF OBJECT_ID('tblCustomer', 'U') IS NOT NULL AND COL_LENGTH('tblCustomer', 'Landmark') IS NOT NULL
      ALTER TABLE tblCustomer DROP COLUMN Landmark;
    IF OBJECT_ID('tblProduct', 'U') IS NOT NULL AND COL_LENGTH('tblProduct', 'Installation') IS NOT NULL
      ALTER TABLE tblProduct DROP COLUMN Installation;

    IF OBJECT_ID('tblServiceRequest', 'U') IS NOT NULL AND COL_LENGTH('tblServiceRequest', 'RequestTime') IS NOT NULL AND COL_LENGTH('tblServiceRequest', 'PreferredTime') IS NULL
      EXEC sp_rename 'tblServiceRequest.RequestTime', 'PreferredTime', 'COLUMN';
    IF OBJECT_ID('tblServiceRequest', 'U') IS NOT NULL AND COL_LENGTH('tblServiceRequest', 'RequestDate') IS NOT NULL AND COL_LENGTH('tblServiceRequest', 'PreferredDate') IS NULL
      EXEC sp_rename 'tblServiceRequest.RequestDate', 'PreferredDate', 'COLUMN';
    IF OBJECT_ID('tblServiceRequest', 'U') IS NOT NULL AND COL_LENGTH('tblServiceRequest', 'ServiceID') IS NOT NULL AND COL_LENGTH('tblServiceRequest', 'ServiceId') IS NULL
      EXEC sp_rename 'tblServiceRequest.ServiceID', 'ServiceId', 'COLUMN';
    IF OBJECT_ID('tblServiceRequest', 'U') IS NOT NULL AND COL_LENGTH('tblServiceRequest', 'CustomerID') IS NOT NULL AND COL_LENGTH('tblServiceRequest', 'CustomerId') IS NULL
      EXEC sp_rename 'tblServiceRequest.CustomerID', 'CustomerId', 'COLUMN';
    IF OBJECT_ID('tblServiceRequest', 'U') IS NOT NULL AND COL_LENGTH('tblServiceRequest', 'RequestID') IS NOT NULL AND COL_LENGTH('tblServiceRequest', 'Id') IS NULL
      EXEC sp_rename 'tblServiceRequest.RequestID', 'Id', 'COLUMN';

    IF OBJECT_ID('tblProduct', 'U') IS NOT NULL AND COL_LENGTH('tblProduct', 'HorsePower') IS NOT NULL AND COL_LENGTH('tblProduct', 'Horsepower') IS NULL
      EXEC sp_rename 'tblProduct.HorsePower', 'Horsepower', 'COLUMN';
    IF OBJECT_ID('tblProduct', 'U') IS NOT NULL AND COL_LENGTH('tblProduct', 'ProductID') IS NOT NULL AND COL_LENGTH('tblProduct', 'Id') IS NULL
      EXEC sp_rename 'tblProduct.ProductID', 'Id', 'COLUMN';
    IF OBJECT_ID('tblService', 'U') IS NOT NULL AND COL_LENGTH('tblService', 'ServiceID') IS NOT NULL AND COL_LENGTH('tblService', 'Id') IS NULL
      EXEC sp_rename 'tblService.ServiceID', 'Id', 'COLUMN';
    IF OBJECT_ID('tblCustomer', 'U') IS NOT NULL AND COL_LENGTH('tblCustomer', 'DateRegistered') IS NOT NULL AND COL_LENGTH('tblCustomer', 'CreatedAt') IS NULL
      EXEC sp_rename 'tblCustomer.DateRegistered', 'CreatedAt', 'COLUMN';
    IF OBJECT_ID('tblCustomer', 'U') IS NOT NULL AND COL_LENGTH('tblCustomer', 'CNumber') IS NOT NULL AND COL_LENGTH('tblCustomer', 'Phone') IS NULL
      EXEC sp_rename 'tblCustomer.CNumber', 'Phone', 'COLUMN';
    IF OBJECT_ID('tblCustomer', 'U') IS NOT NULL AND COL_LENGTH('tblCustomer', 'CustomerID') IS NOT NULL AND COL_LENGTH('tblCustomer', 'Id') IS NULL
      EXEC sp_rename 'tblCustomer.CustomerID', 'Id', 'COLUMN';

    IF OBJECT_ID('tblServiceRequest', 'U') IS NOT NULL AND OBJECT_ID('Bookings', 'U') IS NULL
      EXEC sp_rename 'tblServiceRequest', 'Bookings';
    IF OBJECT_ID('tblProduct', 'U') IS NOT NULL AND OBJECT_ID('Products', 'U') IS NULL
      EXEC sp_rename 'tblProduct', 'Products';
    IF OBJECT_ID('tblService', 'U') IS NOT NULL AND OBJECT_ID('Services', 'U') IS NULL
      EXEC sp_rename 'tblService', 'Services';
    IF OBJECT_ID('tblCustomer', 'U') IS NOT NULL AND OBJECT_ID('Customers', 'U') IS NULL
      EXEC sp_rename 'tblCustomer', 'Customers';
  `);
};
