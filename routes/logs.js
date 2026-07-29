module.exports = function registerLogRoutes(app, { getPool, requireUser, requireAdmin, sendInternalError }) {
  app.get("/api/logs", requireUser, requireAdmin, async (req, res) => {
    try { const result = await (await getPool()).request().query(`SELECT TOP 100 Id AS id, Actor AS actor, Action AS action, TargetType AS targetType, TargetId AS targetId, CreatedAt AS createdAt FROM ActionLogs ORDER BY Id DESC`); res.json(result.recordset); } catch (error) { sendInternalError(res, error, "Request failed"); }
  });
};
