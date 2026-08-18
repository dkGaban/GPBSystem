async function getExcessPipeRate(pool, sql) {
  const result = await pool.request().query("SELECT TOP 1 RatePerFoot AS ratePerFoot FROM tblExcessPipeRate ORDER BY Id");
  return result.recordset[0] || null;
}

module.exports = function registerExcessPipeRoutes(app, { getPool, sql, requireUser, requireAdmin, logAction, actorName, sendInternalError }) {
  app.get("/api/excess-pipe/rate", async (req, res) => {
    try {
      const pool = await getPool();
      const rate = await getExcessPipeRate(pool, sql);
      if (!rate) return res.status(404).json({ message: "Excess pipe rate not configured." });
      res.json({ ratePerFoot: Number(rate.ratePerFoot) });
    } catch (error) { sendInternalError(res, error, "Request failed"); }
  });

  app.put("/api/excess-pipe/rate", requireUser, requireAdmin, async (req, res) => {
    const ratePerFoot = Number(req.body.ratePerFoot);
    if (!Number.isFinite(ratePerFoot) || ratePerFoot <= 0) return res.status(400).json({ message: "Rate per foot must be a positive number." });
    try {
      const pool = await getPool();
      const existing = await pool.request().query("SELECT TOP 1 Id FROM tblExcessPipeRate ORDER BY Id");
      if (existing.recordset.length) {
        await pool.request().input("Id", sql.Int, existing.recordset[0].Id).input("RatePerFoot", sql.Decimal(10, 2), ratePerFoot).query("UPDATE tblExcessPipeRate SET RatePerFoot = @RatePerFoot WHERE Id = @Id");
      } else {
        await pool.request().input("RatePerFoot", sql.Decimal(10, 2), ratePerFoot).query("INSERT INTO tblExcessPipeRate (RatePerFoot) VALUES (@RatePerFoot)");
      }
      await logAction("Updated excess pipe rate", actorName(req), "tblExcessPipeRate", existing.recordset[0]?.Id || 1);
      res.json({ ratePerFoot });
    } catch (error) { sendInternalError(res, error, "Request failed"); }
  });

  app.get("/api/excess-pipe/match", async (req, res) => {
    try {
      const pool = await getPool();
      const rate = await getExcessPipeRate(pool, sql);
      if (!rate) return res.status(404).json({ message: "Excess pipe rate not configured." });
      res.json({ ratePerFoot: Number(rate.ratePerFoot), matchedBand: "flat" });
    } catch (error) { sendInternalError(res, error, "Request failed"); }
  });
};

module.exports.getExcessPipeRate = getExcessPipeRate;
