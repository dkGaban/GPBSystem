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

module.exports = function registerExcessPipeRoutes(app, { getPool, sql, sendInternalError }) {
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
