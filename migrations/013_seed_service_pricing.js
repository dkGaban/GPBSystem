/** Seed installation, re-location, and excess-pipe reference pricing. */
exports.up = async function up(knex) {
  await knex.raw(`
    DECLARE @InstallationServiceID INT;
    DECLARE @RelocationServiceID INT;

    -- If multiple Installation rows exist, only the first ServiceID is normalized.
    -- Review any additional rows manually; this migration intentionally does not delete them.
    IF OBJECT_ID('tblService', 'U') IS NOT NULL
      SELECT TOP 1 @InstallationServiceID = ServiceID
      FROM tblService
      WHERE Type = 'Installation'
      ORDER BY ServiceID;

    IF @InstallationServiceID IS NOT NULL
    BEGIN
      UPDATE tblService
      SET Name = 'Installation',
          Inclusion = 'Free 10ft Drainage Hose, Free 10ft copper tube',
          Exclusion = 'Wire for supply, Electrical Breaker'
      WHERE ServiceID = @InstallationServiceID;

      IF OBJECT_ID('tblServicePrice', 'U') IS NOT NULL
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM tblServicePrice WHERE ServiceID = @InstallationServiceID AND HPower = '1hp to 1.5hp')
          INSERT INTO tblServicePrice (ServiceID, HPower, Amount) VALUES (@InstallationServiceID, '1hp to 1.5hp', 8000.00);
        IF NOT EXISTS (SELECT 1 FROM tblServicePrice WHERE ServiceID = @InstallationServiceID AND HPower = '2hp to 2.5hp')
          INSERT INTO tblServicePrice (ServiceID, HPower, Amount) VALUES (@InstallationServiceID, '2hp to 2.5hp', 9000.00);
        IF NOT EXISTS (SELECT 1 FROM tblServicePrice WHERE ServiceID = @InstallationServiceID AND HPower = '3hp')
          INSERT INTO tblServicePrice (ServiceID, HPower, Amount) VALUES (@InstallationServiceID, '3hp', 10000.00);
      END;
    END;

    IF OBJECT_ID('tblService', 'U') IS NOT NULL
    BEGIN
      SELECT TOP 1 @RelocationServiceID = ServiceID
      FROM tblService
      WHERE Type = 'Re-location'
      ORDER BY ServiceID;

      -- If multiple Re-location rows exist, normalize the first and leave others for manual review.
      IF @RelocationServiceID IS NULL
      BEGIN
        INSERT INTO tblService (Name, Type, Price, Inclusion, Exclusion)
        VALUES ('Re-location', 'Re-location', 9500.00,
          'Free Delivery within Cebu City, Mandaue, Talisay, Free 10ft copper tube',
          'Wire for supply, Electrical Breaker');
        SET @RelocationServiceID = CONVERT(INT, SCOPE_IDENTITY());
      END
      ELSE
      BEGIN
        UPDATE tblService
        SET Name = 'Re-location',
            Inclusion = 'Free Delivery within Cebu City, Mandaue, Talisay, Free 10ft copper tube',
            Exclusion = 'Wire for supply, Electrical Breaker'
        WHERE ServiceID = @RelocationServiceID;
      END;

      IF OBJECT_ID('tblServicePrice', 'U') IS NOT NULL
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM tblServicePrice WHERE ServiceID = @RelocationServiceID AND HPower = '1hp to 1.5hp')
          INSERT INTO tblServicePrice (ServiceID, HPower, Amount) VALUES (@RelocationServiceID, '1hp to 1.5hp', 9500.00);
        IF NOT EXISTS (SELECT 1 FROM tblServicePrice WHERE ServiceID = @RelocationServiceID AND HPower = '2hp to 2.5hp')
          INSERT INTO tblServicePrice (ServiceID, HPower, Amount) VALUES (@RelocationServiceID, '2hp to 2.5hp', 10000.00);
        IF NOT EXISTS (SELECT 1 FROM tblServicePrice WHERE ServiceID = @RelocationServiceID AND HPower = '3hp')
          INSERT INTO tblServicePrice (ServiceID, HPower, Amount) VALUES (@RelocationServiceID, '3hp', 10500.00);
      END;
    END;

    IF OBJECT_ID('tblExcessPipe', 'U') IS NOT NULL
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM tblExcessPipe WHERE HPower = '1hp to 1.5hp')
        INSERT INTO tblExcessPipe (HPower, RatePerFoot) VALUES ('1hp to 1.5hp', 400.00);
      IF NOT EXISTS (SELECT 1 FROM tblExcessPipe WHERE HPower = '2hp to 2.5hp')
        INSERT INTO tblExcessPipe (HPower, RatePerFoot) VALUES ('2hp to 2.5hp', 450.00);
      IF NOT EXISTS (SELECT 1 FROM tblExcessPipe WHERE HPower = '3hp')
        INSERT INTO tblExcessPipe (HPower, RatePerFoot) VALUES ('3hp', 500.00);
    END;
  `);
};

exports.down = async function down(knex) {};
