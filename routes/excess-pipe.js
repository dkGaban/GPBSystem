async function getExcessPipeRates(pool, sql) {
  const result = await pool.request().query("SELECT PipeRateID AS id, HPower AS hPower, RatePerFoot AS ratePerFoot FROM tblExcessPipe ORDER BY PipeRateID");
  return result.recordset;
}

function bandNumericValue(value) {
  const numericValue = Number(value);
  if (Number.isFinite(numericValue)) return numericValue;
  const firstNumber = String(value || "").match(/[0-9]+(?:\.[0-9]+)?/);
  return firstNumber ? Number(firstNumber[0]) : NaN;
}

async function matchExcessPipeRate(pool, sql, hPower) {
  const target = Number(hPower);
  if (!Number.isFinite(target) || target <= 0) return null;
  const rates = await getExcessPipeRates(pool, sql);
  if (!rates.length) return null;
  const closest = rates
    .filter((row) => Number.isFinite(bandNumericValue(row.hPower)))
    .sort((first, second) => Math.abs(bandNumericValue(first.hPower) - target) - Math.abs(bandNumericValue(second.hPower) - target))[0];
  return closest ? { ratePerFoot: Number(closest.ratePerFoot), matchedBand: closest.hPower } : null;
}

module.exports = function registerExcessPipeRoutes(app, { getPool, sql, requireUser, requireAdmin, logAction, actorName, sendInternalError }) {
  app.get("/api/excess-pipe", requireUser, requireAdmin, async (req, res) => {
    try {
      const pool = await getPool();
      const rates = await getExcessPipeRates(pool, sql);
      res.json(rates);
    } catch (error) { sendInternalError(res, error, "Request failed"); }
  });

  app.post("/api/excess-pipe", requireUser, requireAdmin, async (req, res) => {
    const hPower = String(req.body.hPower || "").trim();
    const ratePerFoot = Number(req.body.ratePerFoot);
    if (!hPower) return res.status(400).json({ message: "HPower is required." });
    if (!Number.isFinite(ratePerFoot) || ratePerFoot <= 0) return res.status(400).json({ message: "Rate per foot must be a positive number." });
    try {
      const pool = await getPool();
      const duplicate = await pool.request().input("HPower", sql.NVarChar(50), hPower).query("SELECT TOP 1 PipeRateID FROM tblExcessPipe WHERE LOWER(HPower) = LOWER(@HPower)");
      if (duplicate.recordset.length) return res.status(409).json({ message: "An excess pipe rate for this horsepower already exists." });
      const result = await pool.request().input("HPower", sql.NVarChar(50), hPower).input("RatePerFoot", sql.Decimal(10, 2), ratePerFoot).query("INSERT INTO tblExcessPipe (HPower, RatePerFoot) OUTPUT INSERTED.PipeRateID AS id, INSERTED.HPower AS hPower, INSERTED.RatePerFoot AS ratePerFoot VALUES (@HPower, @RatePerFoot)");
      await logAction(`Created excess pipe rate for ${hPower}`, actorName(req), "tblExcessPipe", result.recordset[0].id);
      res.status(201).json(result.recordset[0]);
    } catch (error) { sendInternalError(res, error, "Request failed"); }
  });

  app.put("/api/excess-pipe/:id", requireUser, requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const hPower = String(req.body.hPower || "").trim();
    const ratePerFoot = Number(req.body.ratePerFoot);
    if (!Number.isFinite(id) || id <= 0) return res.status(404).json({ message: "Excess pipe rate not found." });
    if (!hPower) return res.status(400).json({ message: "HPower is required." });
    if (!Number.isFinite(ratePerFoot) || ratePerFoot <= 0) return res.status(400).json({ message: "Rate per foot must be a positive number." });
    try {
      const pool = await getPool();
      const existing = await pool.request().input("Id", sql.Int, id).query("SELECT TOP 1 PipeRateID FROM tblExcessPipe WHERE PipeRateID = @Id");
      if (!existing.recordset.length) return res.status(404).json({ message: "Excess pipe rate not found." });
      const duplicate = await pool.request().input("Id", sql.Int, id).input("HPower", sql.NVarChar(50), hPower).query("SELECT TOP 1 PipeRateID FROM tblExcessPipe WHERE LOWER(HPower) = LOWER(@HPower) AND PipeRateID <> @Id");
      if (duplicate.recordset.length) return res.status(409).json({ message: "An excess pipe rate for this horsepower already exists." });
      const result = await pool.request().input("Id", sql.Int, id).input("HPower", sql.NVarChar(50), hPower).input("RatePerFoot", sql.Decimal(10, 2), ratePerFoot).query("UPDATE tblExcessPipe SET HPower = @HPower, RatePerFoot = @RatePerFoot OUTPUT INSERTED.PipeRateID AS id, INSERTED.HPower AS hPower, INSERTED.RatePerFoot AS ratePerFoot WHERE PipeRateID = @Id");
      if (!result.recordset.length) return res.status(404).json({ message: "Excess pipe rate not found." });
      await logAction(`Updated excess pipe rate ${id}`, actorName(req), "tblExcessPipe", id);
      res.json(result.recordset[0]);
    } catch (error) { sendInternalError(res, error, "Request failed"); }
  });

  app.delete("/api/excess-pipe/:id", requireUser, requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return res.status(404).json({ message: "Excess pipe rate not found." });
    try {
      const pool = await getPool();
      const existing = await pool.request().input("Id", sql.Int, id).query("SELECT TOP 1 PipeRateID FROM tblExcessPipe WHERE PipeRateID = @Id");
      if (!existing.recordset.length) return res.status(404).json({ message: "Excess pipe rate not found." });
      await pool.request().input("Id", sql.Int, id).query("DELETE FROM tblExcessPipe WHERE PipeRateID = @Id");
      await logAction(`Deleted excess pipe rate ${id}`, actorName(req), "tblExcessPipe", id);
      res.status(204).end();
    } catch (error) { sendInternalError(res, error, "Request failed"); }
  });

  app.get("/api/excess-pipe/match", async (req, res) => {
    const rawHPower = req.query.hPower;
    const hPower = Number(rawHPower);
    if (rawHPower === undefined || rawHPower === "" || !Number.isFinite(hPower) || hPower <= 0) {
      return res.status(404).json({ message: "Excess pipe rate not found for this horsepower." });
    }
    try {
      const pool = await getPool();
      const match = await matchExcessPipeRate(pool, sql, hPower);
      if (!match) return res.status(404).json({ message: "Excess pipe rate not found for this horsepower." });
      res.json(match);
    } catch (error) { sendInternalError(res, error, "Request failed"); }
  });
};

module.exports.matchExcessPipeRate = matchExcessPipeRate;
