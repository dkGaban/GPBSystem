module.exports = function registerHealthRoutes(app, deps) {
  const { getPool, sendInternalError } = deps;

  app.get("/api/health", async (req, res) => {
    try {
      await getPool();
      res.json({ ok: true, database: "GBPServiceDB" });
    } catch (error) {
      sendInternalError(res, error, "Health check failed");
    }
  });
};
