/** Seed the real product-line and HP variant catalog. */
exports.up = async function up(knex) {
  await knex.raw(`
    IF OBJECT_ID('tblBrand', 'U') IS NOT NULL
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM tblBrand WHERE Name = 'Haier') INSERT INTO tblBrand (Name) VALUES ('Haier');
      IF NOT EXISTS (SELECT 1 FROM tblBrand WHERE Name = 'TCL') INSERT INTO tblBrand (Name) VALUES ('TCL');
      IF NOT EXISTS (SELECT 1 FROM tblBrand WHERE Name = 'Midea') INSERT INTO tblBrand (Name) VALUES ('Midea');
      IF NOT EXISTS (SELECT 1 FROM tblBrand WHERE Name = 'Gree') INSERT INTO tblBrand (Name) VALUES ('Gree');
      IF NOT EXISTS (SELECT 1 FROM tblBrand WHERE Name = 'AUX') INSERT INTO tblBrand (Name) VALUES ('AUX');
      IF NOT EXISTS (SELECT 1 FROM tblBrand WHERE Name = 'LG') INSERT INTO tblBrand (Name) VALUES ('LG');
      IF NOT EXISTS (SELECT 1 FROM tblBrand WHERE Name = 'Carrier') INSERT INTO tblBrand (Name) VALUES ('Carrier');
      IF NOT EXISTS (SELECT 1 FROM tblBrand WHERE Name = 'Daikin') INSERT INTO tblBrand (Name) VALUES ('Daikin');
      IF NOT EXISTS (SELECT 1 FROM tblBrand WHERE Name = 'Matrix') INSERT INTO tblBrand (Name) VALUES ('Matrix');
      IF NOT EXISTS (SELECT 1 FROM tblBrand WHERE Name = 'Koppel') INSERT INTO tblBrand (Name) VALUES ('Koppel');
    END;

    DECLARE @Haier INT = (SELECT TOP 1 BrandID FROM tblBrand WHERE Name = 'Haier');
    DECLARE @TCL INT = (SELECT TOP 1 BrandID FROM tblBrand WHERE Name = 'TCL');
    DECLARE @Midea INT = (SELECT TOP 1 BrandID FROM tblBrand WHERE Name = 'Midea');
    DECLARE @Gree INT = (SELECT TOP 1 BrandID FROM tblBrand WHERE Name = 'Gree');
    DECLARE @AUX INT = (SELECT TOP 1 BrandID FROM tblBrand WHERE Name = 'AUX');
    DECLARE @LG INT = (SELECT TOP 1 BrandID FROM tblBrand WHERE Name = 'LG');
    DECLARE @Carrier INT = (SELECT TOP 1 BrandID FROM tblBrand WHERE Name = 'Carrier');
    DECLARE @Daikin INT = (SELECT TOP 1 BrandID FROM tblBrand WHERE Name = 'Daikin');
    DECLARE @Matrix INT = (SELECT TOP 1 BrandID FROM tblBrand WHERE Name = 'Matrix');
    DECLARE @Koppel INT = (SELECT TOP 1 BrandID FROM tblBrand WHERE Name = 'Koppel');

    IF OBJECT_ID('tblProductService', 'U') IS NOT NULL
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM tblProductService WHERE BrandID=@Haier AND ServiceName='CleanCool Pro') INSERT INTO tblProductService (BrandID,ServiceName,ModelCode,UnitType) VALUES (@Haier,'CleanCool Pro',NULL,'Inverter Split Type');
      IF NOT EXISTS (SELECT 1 FROM tblProductService WHERE BrandID=@TCL AND ServiceName='2026 BreezeIn (Wifi)') INSERT INTO tblProductService (BrandID,ServiceName,ModelCode,UnitType) VALUES (@TCL,'2026 BreezeIn (Wifi)','TAC-BR_CSV/TA','Inverter Split Type');
      IF NOT EXISTS (SELECT 1 FROM tblProductService WHERE BrandID=@TCL AND ServiceName='Titan Gold Obsidian Black (IOT/UV, Wifi)') INSERT INTO tblProductService (BrandID,ServiceName,ModelCode,UnitType) VALUES (@TCL,'Titan Gold Obsidian Black (IOT/UV, Wifi)','TAC-CSA/BEI','Inverter Split Type');
      IF NOT EXISTS (SELECT 1 FROM tblProductService WHERE BrandID=@Midea AND ServiceName='Celest') INSERT INTO tblProductService (BrandID,ServiceName,ModelCode,UnitType) VALUES (@Midea,'Celest',NULL,'Inverter Split Type');
      IF NOT EXISTS (SELECT 1 FROM tblProductService WHERE BrandID=@Gree AND ServiceName='Crysta Series') INSERT INTO tblProductService (BrandID,ServiceName,ModelCode,UnitType) VALUES (@Gree,'Crysta Series',NULL,'Inverter Split Type');
      IF NOT EXISTS (SELECT 1 FROM tblProductService WHERE BrandID=@AUX AND ServiceName='F Series') INSERT INTO tblProductService (BrandID,ServiceName,ModelCode,UnitType) VALUES (@AUX,'F Series','ASW-/FLDI','Inverter Split Type');
      IF NOT EXISTS (SELECT 1 FROM tblProductService WHERE BrandID=@AUX AND ServiceName='Prima (QCDI-Series)') INSERT INTO tblProductService (BrandID,ServiceName,ModelCode,UnitType) VALUES (@AUX,'Prima (QCDI-Series)','ASW-A/QCDI','Inverter Split Type');
      IF NOT EXISTS (SELECT 1 FROM tblProductService WHERE BrandID=@LG AND ServiceName='Dual Inverter 70% Energy Savings Standard') INSERT INTO tblProductService (BrandID,ServiceName,ModelCode,UnitType) VALUES (@LG,'Dual Inverter 70% Energy Savings Standard','HSN-IBA','Inverter Split Type');
      IF NOT EXISTS (SELECT 1 FROM tblProductService WHERE BrandID=@Carrier AND ServiceName='Nexus Inverter New Model') INSERT INTO tblProductService (BrandID,ServiceName,ModelCode,UnitType) VALUES (@Carrier,'Nexus Inverter New Model','53CEA','Inverter Split Type');
      IF NOT EXISTS (SELECT 1 FROM tblProductService WHERE BrandID=@Daikin AND ServiceName='Amihan') INSERT INTO tblProductService (BrandID,ServiceName,ModelCode,UnitType) VALUES (@Daikin,'Amihan','FTKE-AVA','Inverter Split Type');
      IF NOT EXISTS (SELECT 1 FROM tblProductService WHERE BrandID=@Matrix AND ServiceName='C-Series') INSERT INTO tblProductService (BrandID,ServiceName,ModelCode,UnitType) VALUES (@Matrix,'C-Series','MX-CS-2A','Inverter Split Type');
      IF NOT EXISTS (SELECT 1 FROM tblProductService WHERE BrandID=@Koppel AND ServiceName='Lunaire Series') INSERT INTO tblProductService (BrandID,ServiceName,ModelCode,UnitType) VALUES (@Koppel,'Lunaire Series',NULL,'Inverter Split Type');
    END;

    DECLARE @P INT;
    DECLARE product_lines CURSOR LOCAL FAST_FORWARD FOR
      SELECT PServiceID FROM tblProductService WHERE (BrandID=@Haier AND ServiceName='CleanCool Pro') OR (BrandID=@TCL AND ServiceName IN ('2026 BreezeIn (Wifi)','Titan Gold Obsidian Black (IOT/UV, Wifi)')) OR (BrandID=@Midea AND ServiceName='Celest') OR (BrandID=@Gree AND ServiceName='Crysta Series') OR (BrandID=@AUX AND ServiceName IN ('F Series','Prima (QCDI-Series)')) OR (BrandID=@LG AND ServiceName='Dual Inverter 70% Energy Savings Standard') OR (BrandID=@Carrier AND ServiceName='Nexus Inverter New Model') OR (BrandID=@Daikin AND ServiceName='Amihan') OR (BrandID=@Matrix AND ServiceName='C-Series') OR (BrandID=@Koppel AND ServiceName='Lunaire Series');
    OPEN product_lines;
    FETCH NEXT FROM product_lines INTO @P;
    WHILE @@FETCH_STATUS = 0
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM tblProduct WHERE PServiceID=@P AND HorsePower='0.8HP') INSERT INTO tblProduct (Name,Type,Brand,Price,Stocks,HorsePower,Image,Installation,PServiceID) SELECT ServiceName+' 0.8HP',UnitType,b.Name,28800,0,'0.8HP',NULL,NULL,PServiceID FROM tblProductService ps JOIN tblBrand b ON b.BrandID=ps.BrandID WHERE ps.PServiceID=@P AND ServiceName='Amihan';
      IF NOT EXISTS (SELECT 1 FROM tblProduct WHERE PServiceID=@P AND HorsePower='1.0HP') INSERT INTO tblProduct (Name,Type,Brand,Price,Stocks,HorsePower,Image,Installation,PServiceID) SELECT ServiceName+' 1.0HP',UnitType,b.Name,CASE ServiceName WHEN 'CleanCool Pro' THEN 24998 WHEN '2026 BreezeIn (Wifi)' THEN 25146 WHEN 'Titan Gold Obsidian Black (IOT/UV, Wifi)' THEN 25546 WHEN 'Celest' THEN 22900 WHEN 'Crysta Series' THEN 26400 WHEN 'F Series' THEN 26620 WHEN 'Prima (QCDI-Series)' THEN 28259 WHEN 'Dual Inverter 70% Energy Savings Standard' THEN 31941 WHEN 'Nexus Inverter New Model' THEN 27375 WHEN 'Amihan' THEN 31500 WHEN 'C-Series' THEN 23760 WHEN 'Lunaire Series' THEN 28900 END,0,'1.0HP',NULL,NULL,PServiceID FROM tblProductService ps JOIN tblBrand b ON b.BrandID=ps.BrandID WHERE ps.PServiceID=@P;
      IF NOT EXISTS (SELECT 1 FROM tblProduct WHERE PServiceID=@P AND HorsePower='1.5HP') INSERT INTO tblProduct (Name,Type,Brand,Price,Stocks,HorsePower,Image,Installation,PServiceID) SELECT ServiceName+' 1.5HP',UnitType,b.Name,CASE ServiceName WHEN 'CleanCool Pro' THEN 27798 WHEN '2026 BreezeIn (Wifi)' THEN 26546 WHEN 'Titan Gold Obsidian Black (IOT/UV, Wifi)' THEN 27296 WHEN 'Celest' THEN 24900 WHEN 'Crysta Series' THEN 29600 WHEN 'F Series' THEN 30000 WHEN 'Prima (QCDI-Series)' THEN 32309 WHEN 'Dual Inverter 70% Energy Savings Standard' THEN 35916 WHEN 'Nexus Inverter New Model' THEN 30750 WHEN 'Amihan' THEN 33500 WHEN 'C-Series' THEN 26100 WHEN 'Lunaire Series' THEN 32555 END,0,'1.5HP',NULL,NULL,PServiceID FROM tblProductService ps JOIN tblBrand b ON b.BrandID=ps.BrandID WHERE ps.PServiceID=@P;
      IF NOT EXISTS (SELECT 1 FROM tblProduct WHERE PServiceID=@P AND HorsePower='2.0HP') INSERT INTO tblProduct (Name,Type,Brand,Price,Stocks,HorsePower,Image,Installation,PServiceID) SELECT ServiceName+' 2.0HP',UnitType,b.Name,CASE ServiceName WHEN 'CleanCool Pro' THEN 35498 WHEN '2026 BreezeIn (Wifi)' THEN 35996 WHEN 'Titan Gold Obsidian Black (IOT/UV, Wifi)' THEN 36046 WHEN 'Celest' THEN 31700 WHEN 'Crysta Series' THEN 36800 WHEN 'F Series' THEN 37500 WHEN 'Prima (QCDI-Series)' THEN 41309 WHEN 'Dual Inverter 70% Energy Savings Standard' THEN 45366 WHEN 'Nexus Inverter New Model' THEN 39150 WHEN 'C-Series' THEN 38250 WHEN 'Lunaire Series' THEN 41565 END,0,'2.0HP',NULL,NULL,PServiceID FROM tblProductService ps JOIN tblBrand b ON b.BrandID=ps.BrandID WHERE ps.PServiceID=@P AND ServiceName <> 'Amihan';
      IF NOT EXISTS (SELECT 1 FROM tblProduct WHERE PServiceID=@P AND HorsePower='2.5HP') INSERT INTO tblProduct (Name,Type,Brand,Price,Stocks,HorsePower,Image,Installation,PServiceID) SELECT ServiceName+' 2.5HP',UnitType,b.Name,CASE ServiceName WHEN 'CleanCool Pro' THEN 41098 WHEN '2026 BreezeIn (Wifi)' THEN 41596 WHEN 'Titan Gold Obsidian Black (IOT/UV, Wifi)' THEN 40946 WHEN 'Celest' THEN 37300 WHEN 'Crysta Series' THEN 50400 WHEN 'F Series' THEN 45000 WHEN 'Prima (QCDI-Series)' THEN 50309 WHEN 'Dual Inverter 70% Energy Savings Standard' THEN 53916 WHEN 'Nexus Inverter New Model' THEN 45375 WHEN 'C-Series' THEN 44820 WHEN 'Lunaire Series' THEN 48280 END,0,'2.5HP',NULL,NULL,PServiceID FROM tblProductService ps JOIN tblBrand b ON b.BrandID=ps.BrandID WHERE ps.PServiceID=@P AND ServiceName <> 'Amihan';
      IF NOT EXISTS (SELECT 1 FROM tblProduct WHERE PServiceID=@P AND HorsePower='3.0HP') INSERT INTO tblProduct (Name,Type,Brand,Price,Stocks,HorsePower,Image,Installation,PServiceID) SELECT ServiceName+' 3.0HP',UnitType,b.Name,CASE ServiceName WHEN 'CleanCool Pro' THEN 59998 WHEN '2026 BreezeIn (Wifi)' THEN 61596 WHEN 'Celest' THEN 57600 WHEN 'Crysta Series' THEN 72000 WHEN 'F Series' THEN 49500 WHEN 'Prima (QCDI-Series)' THEN 55709 WHEN 'C-Series' THEN 54900 WHEN 'Lunaire Series' THEN 65705 END,0,'3.0HP',NULL,NULL,PServiceID FROM tblProductService ps JOIN tblBrand b ON b.BrandID=ps.BrandID WHERE ps.PServiceID=@P AND ServiceName NOT IN ('Titan Gold Obsidian Black (IOT/UV, Wifi)','Dual Inverter 70% Energy Savings Standard','Nexus Inverter New Model','Amihan');
      FETCH NEXT FROM product_lines INTO @P;
    END;
    CLOSE product_lines; DEALLOCATE product_lines;
  `);
};

exports.down = async function down(knex) {};
