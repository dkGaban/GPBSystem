/**
 * Initial schema migration.
 *
 * The guards intentionally allow existing installations to be adopted by the
 * migration system without dropping data. Future changes must be new migration
 * files; schema SQL does not belong in the application boot path.
 */
exports.up = async function up(knex) {
  await knex.raw(`
    IF OBJECT_ID('Customers', 'U') IS NULL
    CREATE TABLE Customers (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      Name NVARCHAR(100) NOT NULL,
      Phone NVARCHAR(50), Email NVARCHAR(100), Address NVARCHAR(255),
      CreatedAt DATETIME DEFAULT GETDATE()
    );
    IF OBJECT_ID('Technicians', 'U') IS NULL
    CREATE TABLE Technicians (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      Name NVARCHAR(100) NOT NULL, Specialty NVARCHAR(100),
      Status NVARCHAR(50) DEFAULT 'Active', PhoneNumber NVARCHAR(11) NULL,
      Email NVARCHAR(255) NULL, Address NVARCHAR(255) NULL,
      ProfilePhoto NVARCHAR(255) NULL, CreatedAt DATETIME DEFAULT GETDATE()
    );
    IF OBJECT_ID('Services', 'U') IS NULL
    CREATE TABLE Services (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      Name NVARCHAR(100) NOT NULL, Type NVARCHAR(100), Price DECIMAL(10,2),
      Inclusion NVARCHAR(MAX), Exclusion NVARCHAR(MAX), Image NVARCHAR(MAX),
      CreatedAt DATETIME DEFAULT GETDATE()
    );
    IF OBJECT_ID('Products', 'U') IS NULL
    CREATE TABLE Products (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      Name NVARCHAR(100) NOT NULL, Type NVARCHAR(100), Brand NVARCHAR(100),
      Price DECIMAL(10,2), Stocks INT, Horsepower NVARCHAR(50),
      Image NVARCHAR(MAX), CreatedAt DATETIME DEFAULT GETDATE()
    );
    IF OBJECT_ID('Bookings', 'U') IS NULL
    CREATE TABLE Bookings (
      Id INT IDENTITY(1,1) PRIMARY KEY, CustomerId INT NULL,
      CustomerName NVARCHAR(100) NOT NULL, Phone NVARCHAR(50), Email NVARCHAR(150),
      ServiceId INT NULL, ServiceName NVARCHAR(500), Address NVARCHAR(255),
      PreferredDate DATE, PreferredTime NVARCHAR(50), TotalAmount DECIMAL(10,2) NULL,
      Status NVARCHAR(50) DEFAULT 'Pending', CreatedAt DATETIME DEFAULT GETDATE(),
      FOREIGN KEY (CustomerId) REFERENCES Customers(Id),
      FOREIGN KEY (ServiceId) REFERENCES Services(Id)
    );
    IF OBJECT_ID('Schedules', 'U') IS NULL
    CREATE TABLE Schedules (
      Id INT IDENTITY(1,1) PRIMARY KEY, BookingId INT NOT NULL,
      TechnicianId INT NOT NULL, ScheduleDate DATE, ScheduleTime NVARCHAR(50),
      Status NVARCHAR(50) DEFAULT 'Scheduled', CreatedAt DATETIME DEFAULT GETDATE(),
      FOREIGN KEY (BookingId) REFERENCES Bookings(Id),
      FOREIGN KEY (TechnicianId) REFERENCES Technicians(Id)
    );
    IF OBJECT_ID('Activities', 'U') IS NULL
    CREATE TABLE Activities (
      Id INT IDENTITY(1,1) PRIMARY KEY, Icon NVARCHAR(50), Color NVARCHAR(50),
      Text NVARCHAR(255), CreatedAt DATETIME DEFAULT GETDATE()
    );
    IF OBJECT_ID('Users', 'U') IS NULL
    CREATE TABLE Users (
      Id INT IDENTITY(1,1) PRIMARY KEY, Username NVARCHAR(80) NULL UNIQUE,
      FullName NVARCHAR(100) NOT NULL, Email NVARCHAR(150) NOT NULL UNIQUE,
      PasswordHash NVARCHAR(255) NOT NULL, PasswordSalt NVARCHAR(80) NOT NULL,
      Role NVARCHAR(30) NOT NULL DEFAULT 'customer', CreatedAt DATETIME DEFAULT GETDATE()
    );
    IF OBJECT_ID('ActionLogs', 'U') IS NULL
    CREATE TABLE ActionLogs (
      Id INT IDENTITY(1,1) PRIMARY KEY, Actor NVARCHAR(100) NOT NULL,
      Action NVARCHAR(255) NOT NULL, TargetType NVARCHAR(50), TargetId NVARCHAR(50),
      CreatedAt DATETIME DEFAULT GETDATE()
    );
    IF COL_LENGTH('Users', 'Username') IS NULL ALTER TABLE Users ADD Username NVARCHAR(80) NULL;
    IF COL_LENGTH('Bookings', 'PreferredTime') IS NULL ALTER TABLE Bookings ADD PreferredTime NVARCHAR(50) NULL;
    IF COL_LENGTH('Bookings', 'Phone') IS NULL ALTER TABLE Bookings ADD Phone NVARCHAR(50) NULL;
    IF COL_LENGTH('Bookings', 'Email') IS NULL ALTER TABLE Bookings ADD Email NVARCHAR(150) NULL;
    IF COL_LENGTH('Bookings', 'TotalAmount') IS NULL ALTER TABLE Bookings ADD TotalAmount DECIMAL(10,2) NULL;
    IF COL_LENGTH('Bookings', 'ServiceName') IS NOT NULL ALTER TABLE Bookings ALTER COLUMN ServiceName NVARCHAR(500) NULL;
    IF COL_LENGTH('Services', 'Image') IS NULL ALTER TABLE Services ADD Image NVARCHAR(MAX) NULL;
    IF COL_LENGTH('Schedules', 'ScheduleTime') IS NULL ALTER TABLE Schedules ADD ScheduleTime NVARCHAR(50) NULL;
    IF COL_LENGTH('Customers', 'HouseNumber') IS NULL ALTER TABLE Customers ADD HouseNumber NVARCHAR(50) NULL;
    IF COL_LENGTH('Customers', 'Street') IS NULL ALTER TABLE Customers ADD Street NVARCHAR(150) NULL;
    IF COL_LENGTH('Customers', 'Barangay') IS NULL ALTER TABLE Customers ADD Barangay NVARCHAR(150) NULL;
    IF COL_LENGTH('Customers', 'City') IS NULL ALTER TABLE Customers ADD City NVARCHAR(150) NULL;
    IF COL_LENGTH('Customers', 'Province') IS NULL ALTER TABLE Customers ADD Province NVARCHAR(150) NULL;
    IF COL_LENGTH('Customers', 'ZipCode') IS NULL ALTER TABLE Customers ADD ZipCode NVARCHAR(20) NULL;
    IF COL_LENGTH('Technicians', 'PhoneNumber') IS NULL ALTER TABLE Technicians ADD PhoneNumber NVARCHAR(11) NULL;
    IF COL_LENGTH('Technicians', 'Email') IS NULL ALTER TABLE Technicians ADD Email NVARCHAR(255) NULL;
    IF COL_LENGTH('Technicians', 'Address') IS NULL ALTER TABLE Technicians ADD Address NVARCHAR(255) NULL;
    IF COL_LENGTH('Technicians', 'ProfilePhoto') IS NULL ALTER TABLE Technicians ADD ProfilePhoto NVARCHAR(255) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_Technicians_Email' AND object_id = OBJECT_ID('Technicians'))
      EXEC('CREATE UNIQUE INDEX UX_Technicians_Email ON Technicians(Email) WHERE Email IS NOT NULL');
  `);
};

exports.down = async function down(knex) {
  await knex.raw(`
    DROP TABLE IF EXISTS ActionLogs;
    DROP TABLE IF EXISTS Activities;
    DROP TABLE IF EXISTS Schedules;
    DROP TABLE IF EXISTS Bookings;
    DROP TABLE IF EXISTS Products;
    DROP TABLE IF EXISTS Services;
    DROP TABLE IF EXISTS Technicians;
    DROP TABLE IF EXISTS Customers;
    DROP TABLE IF EXISTS Users;
  `);
};
