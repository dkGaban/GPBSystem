/** Fix the missing Installation seed and safely remove an unreferenced legacy Re-location row. */
exports.up = async function up(knex) {
  const rowsOf = (result) => Array.isArray(result) ? result : (result?.recordset || result?.recordsets?.[0] || []);
  let installationResult = await knex.raw("SELECT TOP 1 ServiceID FROM tblService WHERE Type = 'Installation' ORDER BY ServiceID;");
  let installationId = rowsOf(installationResult)[0]?.ServiceID;
  let installationCreated = false;
  if (!installationId) {
    await knex.raw(`INSERT INTO tblService (Name, Type, Price, Inclusion, Exclusion)
      VALUES ('Installation', 'Installation', 8000.00, 'Free 10ft Drainage Hose, Free 10ft copper tube', 'Wire for supply, Electrical Breaker');`);
    installationResult = await knex.raw("SELECT TOP 1 ServiceID FROM tblService WHERE Type = 'Installation' ORDER BY ServiceID DESC;");
    installationId = rowsOf(installationResult)[0]?.ServiceID;
    installationCreated = true;
  }
  if (!installationId) throw new Error("Migration 014 could not create or find the Installation service.");
  await knex.raw(`
    UPDATE tblService SET Name='Installation', Type='Installation', Price=8000.00,
      Inclusion='Free 10ft Drainage Hose, Free 10ft copper tube', Exclusion='Wire for supply, Electrical Breaker'
    WHERE ServiceID=${Number(installationId)};
    IF NOT EXISTS (SELECT 1 FROM tblServicePrice WHERE ServiceID=${Number(installationId)} AND HPower='1hp to 1.5hp') INSERT INTO tblServicePrice (ServiceID,HPower,Amount) VALUES (${Number(installationId)},'1hp to 1.5hp',8000.00);
    IF NOT EXISTS (SELECT 1 FROM tblServicePrice WHERE ServiceID=${Number(installationId)} AND HPower='2hp to 2.5hp') INSERT INTO tblServicePrice (ServiceID,HPower,Amount) VALUES (${Number(installationId)},'2hp to 2.5hp',9000.00);
    IF NOT EXISTS (SELECT 1 FROM tblServicePrice WHERE ServiceID=${Number(installationId)} AND HPower='3hp') INSERT INTO tblServicePrice (ServiceID,HPower,Amount) VALUES (${Number(installationId)},'3hp',10000.00);
  `);
  const installationTierCount = await knex.raw(`SELECT COUNT(*) AS TierCount FROM tblServicePrice WHERE ServiceID=${Number(installationId)};`);
  console.log(`[014] Installation ServiceID ${installationId}: ${installationCreated ? "created" : "already existed"}; ${rowsOf(installationTierCount)[0].TierCount} price tiers present.`);

  const legacyRows = rowsOf(await knex.raw(`SELECT s.ServiceID FROM tblService s LEFT JOIN tblServicePrice sp ON sp.ServiceID=s.ServiceID WHERE s.Type='Re-location' GROUP BY s.ServiceID HAVING COUNT(sp.SPriceID)=0 ORDER BY s.ServiceID;`));
  if (!legacyRows.length) { console.log("[014] Re-location duplicate check: no tierless Re-location row found."); return; }
  for (const row of legacyRows) {
    const serviceId = Number(row.ServiceID);
    const referenceRow = rowsOf(await knex.raw(`SELECT (SELECT COUNT(*) FROM tblServiceRequest WHERE ServiceID=${serviceId}) AS RequestCount, (SELECT COUNT(*) FROM tblServiceDetails sd INNER JOIN tblServiceRequest sr ON sr.RequestID=sd.RequestID WHERE sr.ServiceID=${serviceId}) AS DetailCount;`))[0];
    const requestCount = Number(referenceRow.RequestCount || 0);
    const detailCount = Number(referenceRow.DetailCount || 0);
    if (requestCount || detailCount) { console.warn(`[014] Re-location ServiceID ${serviceId}: tierless duplicate retained for manual review; ${requestCount} booking(s) and ${detailCount} service-detail row(s) reference it.`); continue; }
    try { await knex.raw(`DELETE FROM tblService WHERE ServiceID=${serviceId};`); console.log(`[014] Re-location ServiceID ${serviceId}: tierless duplicate deleted; no booking or service-detail references found.`); }
    catch (error) { console.warn(`[014] Re-location ServiceID ${serviceId}: tierless duplicate could not be deleted and was left for manual review; no booking or service-detail references were found, but SQL Server returned: ${error.message}`); }
  }
};
exports.down = async function down(knex) {};
