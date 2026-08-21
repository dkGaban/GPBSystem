/** Add technician-proposed payment fields to job charge reports so admin approval can record the payment in one step. */
exports.up = async function up(knex) {
  await knex.raw(`
    IF OBJECT_ID('tblJobCharge', 'U') IS NOT NULL AND COL_LENGTH('tblJobCharge', 'ProposedAmountPaid') IS NULL
      ALTER TABLE tblJobCharge ADD ProposedAmountPaid DECIMAL(10,2) NULL;
    IF OBJECT_ID('tblJobCharge', 'U') IS NOT NULL AND COL_LENGTH('tblJobCharge', 'ProposedDiscount') IS NULL
      ALTER TABLE tblJobCharge ADD ProposedDiscount DECIMAL(10,2) NULL;
  `);
};

exports.down = async function down(knex) {
  await knex.raw(`
    IF OBJECT_ID('tblJobCharge', 'U') IS NOT NULL AND COL_LENGTH('tblJobCharge', 'ProposedDiscount') IS NOT NULL
      ALTER TABLE tblJobCharge DROP COLUMN ProposedDiscount;
    IF OBJECT_ID('tblJobCharge', 'U') IS NOT NULL AND COL_LENGTH('tblJobCharge', 'ProposedAmountPaid') IS NOT NULL
      ALTER TABLE tblJobCharge DROP COLUMN ProposedAmountPaid;
  `);
};
