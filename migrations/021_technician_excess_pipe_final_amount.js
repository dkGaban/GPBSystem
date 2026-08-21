/** Track technician-reported excess pipe and the final amount on service requests. */
exports.up = async function up(knex) {
  await knex.raw(`
    IF OBJECT_ID('tblServiceRequest', 'U') IS NOT NULL AND COL_LENGTH('tblServiceRequest', 'ExcessPipeFeet') IS NULL
      ALTER TABLE tblServiceRequest ADD ExcessPipeFeet INT NULL;
    IF OBJECT_ID('tblServiceRequest', 'U') IS NOT NULL AND COL_LENGTH('tblServiceRequest', 'ExcessPipeRate') IS NULL
      ALTER TABLE tblServiceRequest ADD ExcessPipeRate DECIMAL(10,2) NULL;
    IF OBJECT_ID('tblServiceRequest', 'U') IS NOT NULL AND COL_LENGTH('tblServiceRequest', 'ExcessPipeCost') IS NULL
      ALTER TABLE tblServiceRequest ADD ExcessPipeCost DECIMAL(10,2) NULL;
    IF OBJECT_ID('tblServiceRequest', 'U') IS NOT NULL AND COL_LENGTH('tblServiceRequest', 'FinalAmount') IS NULL
      ALTER TABLE tblServiceRequest ADD FinalAmount DECIMAL(10,2) NULL;
  `);
};

exports.down = async function down(knex) {
  await knex.raw(`
    IF OBJECT_ID('tblServiceRequest', 'U') IS NOT NULL AND COL_LENGTH('tblServiceRequest', 'FinalAmount') IS NOT NULL
      ALTER TABLE tblServiceRequest DROP COLUMN FinalAmount;
    IF OBJECT_ID('tblServiceRequest', 'U') IS NOT NULL AND COL_LENGTH('tblServiceRequest', 'ExcessPipeCost') IS NOT NULL
      ALTER TABLE tblServiceRequest DROP COLUMN ExcessPipeCost;
    IF OBJECT_ID('tblServiceRequest', 'U') IS NOT NULL AND COL_LENGTH('tblServiceRequest', 'ExcessPipeRate') IS NOT NULL
      ALTER TABLE tblServiceRequest DROP COLUMN ExcessPipeRate;
    IF OBJECT_ID('tblServiceRequest', 'U') IS NOT NULL AND COL_LENGTH('tblServiceRequest', 'ExcessPipeFeet') IS NOT NULL
      ALTER TABLE tblServiceRequest DROP COLUMN ExcessPipeFeet;
  `);
};
