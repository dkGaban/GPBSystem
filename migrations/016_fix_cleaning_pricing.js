/** Normalize Cleaning pricing to Aircon Type and clear stray tier data. */
exports.up = async function up(knex) {
  const rowsOf = (result) => Array.isArray(result) ? result : (result?.recordset || result?.recordsets?.[0] || []);
  const cleaningRows = rowsOf(await knex.raw(`
    SELECT ServiceID, Name, Type, Price
    FROM tblService
    WHERE Type = 'Cleaning' OR Name = 'Cleaning' OR Name IN ('Split type', 'Window Type')
    ORDER BY ServiceID;
  `));
  const cleaningIds = cleaningRows.map((row) => Number(row.ServiceID));
  const idList = cleaningIds.join(",");
  const existingTiers = idList ? rowsOf(await knex.raw(`SELECT ServiceID, SPriceID, HPower, UnitType, Amount FROM tblServicePrice WHERE ServiceID IN (${idList}) ORDER BY ServiceID, SPriceID;`)) : [];
  console.log(`[016] Cleaning services found: ${JSON.stringify(cleaningRows)}.`);
  console.log(`[016] Cleaning price rows before changes: ${JSON.stringify(existingTiers)}.`);

  if (!cleaningIds.length) {
    console.log("[016] Cleaning pricing case: no Cleaning service found; no data changed.");
    return;
  }

  if (idList) await knex.raw(`DELETE FROM tblServicePrice WHERE ServiceID IN (${idList});`);
  if (cleaningRows.length === 1) {
    const serviceId = cleaningIds[0];
    await knex.raw(`
      IF NOT EXISTS (SELECT 1 FROM tblServicePrice WHERE ServiceID=${serviceId} AND UnitType='Window')
        INSERT INTO tblServicePrice (ServiceID, HPower, UnitType, Amount) VALUES (${serviceId}, 'Any', 'Window', 650.00);
      IF NOT EXISTS (SELECT 1 FROM tblServicePrice WHERE ServiceID=${serviceId} AND UnitType='Split')
        INSERT INTO tblServicePrice (ServiceID, HPower, UnitType, Amount) VALUES (${serviceId}, 'Any', 'Split', 1150.00);
    `);
    console.log(`[016] Cleaning pricing case: single consolidated service ServiceID ${serviceId}; seeded Window=650 and Split=1150 tiers.`);
  } else {
    for (const row of cleaningRows) {
      const normalizedName = String(row.Name || "").trim().toLowerCase();
      const price = normalizedName === "window type" ? 650 : normalizedName === "split type" ? 1150 : null;
      if (price !== null) await knex.raw(`UPDATE tblService SET Price=${price} WHERE ServiceID=${Number(row.ServiceID)};`);
    }
    console.log(`[016] Cleaning pricing case: ${cleaningRows.length} separate flat services; preserved them without tiers and normalized recognized prices.`);
  }
};

exports.down = async function down(knex) {};
