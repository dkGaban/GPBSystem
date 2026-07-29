function actorName(req) { return req.user?.email || "Guest"; }

function createLogAction({ getPool, sql, logger }) {
  return async function logAction(action, actor, targetType = null, targetId = null) {
    try {
      const pool = await getPool();
      await pool.request().input("Actor", sql.NVarChar(100), actor || "System").input("Action", sql.NVarChar(255), action).input("TargetType", sql.NVarChar(50), targetType).input("TargetId", sql.NVarChar(50), targetId ? String(targetId) : null).query(`
        INSERT INTO ActionLogs (Actor, Action, TargetType, TargetId)
        VALUES (@Actor, @Action, @TargetType, @TargetId)
      `);
    } catch (error) { logger.error({ err: error }, "Action log failed"); }
  };
}

function sendInternalError(res, logger, error, context, extra = {}) {
  logger.error({ err: error, context }, "Internal request error");
  return res.status(500).json({ ...extra, message: "Something went wrong, please try again." });
}

module.exports = { actorName, createLogAction, sendInternalError };
