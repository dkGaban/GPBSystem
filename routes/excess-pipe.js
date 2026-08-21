function tierHorsePower(label) {
  const numericValue = Number(label);
  if (Number.isFinite(numericValue)) return numericValue;
  const firstNumber = String(label || "").match(/[0-9]+(?:\.[0-9]+)?/);
  return firstNumber ? Number(firstNumber[0]) : NaN;
}

async function getExcessPipeTiers(pool, sql) {
  const result = await pool.request().query("SELECT Id AS id, HPower AS hPower, RatePerFoot AS ratePerFoot FROM tblExcessPipeRate ORDER BY Id");
  return result.recordset;
}

async function getExcessPipeRate(pool, sql, hPower) {
  if (hPower === undefined || hPower === null || String(hPower).trim() === "") return null;
  const tiers = await getExcessPipeTiers(pool, sql);
  const labeled = tiers.filter((tier) => String(tier.hPower || "").trim() !== "");
  if (!labeled.length) return null;
  const target = Number(hPower);
  const exact = labeled.find((tier) => String(tier.hPower || "").trim() === String(hPower).trim() || tierHorsePower(tier.hPower) === target);
  const closest = labeled
    .filter((tier) => Number.isFinite(tierHorsePower(tier.hPower)) && Number.isFinite(target))
    .sort((first, second) => Math.abs(tierHorsePower(first.hPower) - target) - Math.abs(tierHorsePower(second.hPower) - target))[0];
  const match = exact || closest;
  return match ? { ratePerFoot: Number(match.ratePerFoot), hPowerLabel: match.hPower, tierId: match.id } : null;
}

function validateExcessTierPayload(body) {
  const hPower = String(body.hPower || "").trim();
  const ratePerFoot = Number(body.ratePerFoot);
  if (!hPower) return { message: "A horsepower band label is required." };
  if (!Number.isFinite(ratePerFoot) || ratePerFoot <= 0) return { message: "Rate per foot must be a positive number." };
  return { hPower, ratePerFoot };
}

module.exports = function registerExcessPipeRoutes(app, { getPool, sql, requireUser, requireAdmin, logAction, actorName, sendInternalError }) {
  app.get("/api/excess-pipe/rate", async (req, res) => {
    const hPower = req.query.hPower;
    if (hPower === undefined || hPower === "" || !Number.isFinite(Number(hPower))) {
      return res.status(400).json({ message: "A valid hPower number is required." });
    }
    try {
      const pool = await getPool();
      const rate = await getExcessPipeRate(pool, sql, hPower);
      if (!rate) return res.status(404).json({ message: "No excess pipe rate matches that horsepower band." });
      res.json({ ratePerFoot: rate.ratePerFoot, hPowerLabel: rate.hPowerLabel, matchedBand: rate.hPowerLabel, tierId: rate.tierId });
    } catch (error) { sendInternalError(res, error, "Request failed"); }
  });

  app.get("/api/excess-pipe/rates", requireUser, async (req, res) => {
    try {
      const pool = await getPool();
      res.json(await getExcessPipeTiers(pool, sql));
    } catch (error) { sendInternalError(res, error, "Request failed"); }
  });

  app.post("/api/excess-pipe/rates", requireUser, requireAdmin, async (req, res) => {
    const tier = validateExcessTierPayload(req.body);
    if (tier.message) return res.status(400).json({ message: tier.message });
    try {
      const pool = await getPool();
      const result = await pool.request()
        .input("HPower", sql.NVarChar(50), tier.hPower)
        .input("RatePerFoot", sql.Decimal(10, 2), tier.ratePerFoot)
        .query("INSERT INTO tblExcessPipeRate (HPower, RatePerFoot) OUTPUT INSERTED.Id AS id, INSERTED.HPower AS hPower, INSERTED.RatePerFoot AS ratePerFoot VALUES (@HPower, @RatePerFoot)");
      await logAction(`Added excess pipe rate band ${tier.hPower} at ₱${tier.ratePerFoot}/ft`, actorName(req), "tblExcessPipeRate", result.recordset[0].id);
      res.status(201).json(result.recordset[0]);
    } catch (error) { sendInternalError(res, error, "Request failed"); }
  });

  app.put("/api/excess-pipe/rates/:id", requireUser, requireAdmin, async (req, res) => {
    const tierId = Number(req.params.id);
    if (!Number.isInteger(tierId) || tierId <= 0) return res.status(404).json({ message: "Excess pipe rate band not found." });
    const tier = validateExcessTierPayload(req.body);
    if (tier.message) return res.status(400).json({ message: tier.message });
    try {
      const pool = await getPool();
      const result = await pool.request()
        .input("Id", sql.Int, tierId)
        .input("HPower", sql.NVarChar(50), tier.hPower)
        .input("RatePerFoot", sql.Decimal(10, 2), tier.ratePerFoot)
        .query("UPDATE tblExcessPipeRate SET HPower = @HPower, RatePerFoot = @RatePerFoot OUTPUT INSERTED.Id AS id, INSERTED.HPower AS hPower, INSERTED.RatePerFoot AS ratePerFoot WHERE Id = @Id");
      if (!result.recordset.length) return res.status(404).json({ message: "Excess pipe rate band not found." });
      await logAction(`Updated excess pipe rate band ${tier.hPower} to ₱${tier.ratePerFoot}/ft`, actorName(req), "tblExcessPipeRate", tierId);
      res.json(result.recordset[0]);
    } catch (error) { sendInternalError(res, error, "Request failed"); }
  });

  app.delete("/api/excess-pipe/rates/:id", requireUser, requireAdmin, async (req, res) => {
    const tierId = Number(req.params.id);
    if (!Number.isInteger(tierId) || tierId <= 0) return res.status(404).json({ message: "Excess pipe rate band not found." });
    try {
      const pool = await getPool();
      const result = await pool.request().input("Id", sql.Int, tierId).query("DELETE FROM tblExcessPipeRate WHERE Id = @Id");
      if (!result.rowsAffected[0]) return res.status(404).json({ message: "Excess pipe rate band not found." });
      await logAction(`Deleted excess pipe rate band #${tierId}`, actorName(req), "tblExcessPipeRate", tierId);
      res.status(204).end();
    } catch (error) { sendInternalError(res, error, "Request failed"); }
  });

  app.get("/api/excess-pipe/match", async (req, res) => {
    const hPower = req.query.hPower;
    if (hPower === undefined || hPower === "" || !Number.isFinite(Number(hPower))) {
      return res.status(400).json({ message: "A valid hPower number is required." });
    }
    try {
      const pool = await getPool();
      const rate = await getExcessPipeRate(pool, sql, hPower);
      if (!rate) return res.status(404).json({ message: "No excess pipe rate matches that horsepower band." });
      res.json({ ratePerFoot: rate.ratePerFoot, matchedBand: rate.hPowerLabel, tierId: rate.tierId });
    } catch (error) { sendInternalError(res, error, "Request failed"); }
  });
};

module.exports.getExcessPipeRate = getExcessPipeRate;
