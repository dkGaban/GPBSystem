const { validateServicePayload } = require("../utils/validation");

function parsePositiveAmount(value) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function validateTierPayload(body) {
  const hPower = String(body.hPower || "").trim();
  const amount = parsePositiveAmount(body.amount);
  if (!hPower) return { message: "Horsepower is required." };
  if (amount === null) return { message: "Amount must be a positive number." };
  return { hPower, unitType: String(body.unitType || "").trim(), amount };
}

function serviceWithTiers(rows) {
  const services = new Map();
  for (const row of rows) {
    if (!services.has(row.id)) {
      services.set(row.id, {
        id: row.id,
        name: row.name,
        type: row.type,
        price: row.price,
        inclusion: row.inclusion,
        exclusion: row.exclusion,
        image: row.image,
        priceTiers: []
      });
    }
    if (row.tierId !== null && row.tierId !== undefined) {
      services.get(row.id).priceTiers.push({
        id: row.tierId,
        hPower: row.tierHPower,
        unitType: row.tierUnitType,
        amount: row.tierAmount
      });
    }
  }
  return [...services.values()];
}

async function getPriceTiers(pool, sql, serviceId) {
  const result = await pool.request().input("ServiceID", sql.Int, serviceId).query("SELECT SPriceID AS id, HPower AS hPower, UnitType AS unitType, Amount AS amount FROM tblServicePrice WHERE ServiceID = @ServiceID ORDER BY SPriceID");
  return result.recordset;
}

module.exports = function registerServiceRoutes(app, { getPool, sql, requireUser, requireAdmin, logAction, actorName, sendInternalError }) {
  app.get("/api/services", async (req, res) => {
    try {
      const result = await (await getPool()).request().query(`
        SELECT s.ServiceID AS id, s.Name AS name, s.Type AS type, s.Price AS price,
          s.Inclusion AS inclusion, s.Exclusion AS exclusion, s.Image AS image,
          p.SPriceID AS tierId, p.HPower AS tierHPower, p.UnitType AS tierUnitType, p.Amount AS tierAmount
        FROM tblService s
        LEFT JOIN tblServicePrice p ON p.ServiceID = s.ServiceID
        ORDER BY s.Type, s.Name, p.SPriceID
      `);
      res.json(serviceWithTiers(result.recordset));
    } catch (error) { sendInternalError(res, error, "Request failed"); }
  });

  app.post("/api/services", requireUser, requireAdmin, async (req, res) => { const { name, type, price, inclusion = "", exclusion = "", image = "" } = req.body; const validationMessage = validateServicePayload({ name, type, price }); if (validationMessage) return res.status(400).json({ message: validationMessage }); try { const pool = await getPool(); const existing = await pool.request().input("Name", sql.NVarChar(100), name.trim()).input("Type", sql.NVarChar(100), type.trim()).query("SELECT TOP 1 ServiceID FROM tblService WHERE LOWER(Name) = LOWER(@Name) AND LOWER(Type) = LOWER(@Type)"); if (existing.recordset.length) return res.status(409).json({ message: "This category already has a variant with that name." }); const result = await pool.request().input("Name", sql.NVarChar(100), name.trim()).input("Type", sql.NVarChar(100), type.trim()).input("Price", sql.Decimal(10, 2), Number(price)).input("Inclusion", sql.NVarChar(sql.MAX), String(inclusion || "").trim()).input("Exclusion", sql.NVarChar(sql.MAX), String(exclusion || "").trim()).input("Image", sql.NVarChar(sql.MAX), String(image || "")).query("INSERT INTO tblService (Name, Type, Price, Inclusion, Exclusion, Image) OUTPUT INSERTED.ServiceID AS id, INSERTED.Name AS name, INSERTED.Type AS type, INSERTED.Price AS price, INSERTED.Inclusion AS inclusion, INSERTED.Exclusion AS exclusion, INSERTED.Image AS image VALUES (@Name, @Type, @Price, @Inclusion, @Exclusion, @Image)"); await logAction(`Created service ${name}`, actorName(req), "tblService", result.recordset[0].id); res.status(201).json({ ...result.recordset[0], priceTiers: [] }); } catch (error) { sendInternalError(res, error, "Request failed"); } });

  app.put("/api/services/:id", requireUser, requireAdmin, async (req, res) => { const { name, type, price, inclusion = "", exclusion = "", image = "" } = req.body; const validationMessage = validateServicePayload({ name, type, price }); if (validationMessage) return res.status(400).json({ message: validationMessage }); try { const pool = await getPool(); const duplicate = await pool.request().input("Id", sql.Int, Number(req.params.id)).input("Name", sql.NVarChar(100), name.trim()).input("Type", sql.NVarChar(100), type.trim()).query("SELECT TOP 1 ServiceID FROM tblService WHERE LOWER(Name) = LOWER(@Name) AND LOWER(Type) = LOWER(@Type) AND ServiceID <> @Id"); if (duplicate.recordset.length) return res.status(409).json({ message: "This category already has a variant with that name." }); const result = await pool.request().input("Id", sql.Int, Number(req.params.id)).input("Name", sql.NVarChar(100), name.trim()).input("Type", sql.NVarChar(100), type.trim()).input("Price", sql.Decimal(10, 2), Number(price)).input("Inclusion", sql.NVarChar(sql.MAX), String(inclusion || "").trim()).input("Exclusion", sql.NVarChar(sql.MAX), String(exclusion || "").trim()).input("Image", sql.NVarChar(sql.MAX), String(image || "")).query("UPDATE tblService SET Name=@Name, Type=@Type, Price=@Price, Inclusion=@Inclusion, Exclusion=@Exclusion, Image=@Image OUTPUT INSERTED.ServiceID AS id, INSERTED.Name AS name, INSERTED.Type AS type, INSERTED.Price AS price, INSERTED.Inclusion AS inclusion, INSERTED.Exclusion AS exclusion, INSERTED.Image AS image WHERE ServiceID=@Id"); if (!result.recordset.length) return res.status(404).json({ message: "Service not found." }); await logAction(`Updated service ${name}`, actorName(req), "tblService", req.params.id); res.json({ ...result.recordset[0], priceTiers: await getPriceTiers(pool, sql, Number(req.params.id)) }); } catch (error) { sendInternalError(res, error, "Request failed"); } });

  app.delete("/api/services/:id", requireUser, requireAdmin, async (req, res) => { try { await (await getPool()).request().input("Id", sql.Int, Number(req.params.id)).query("DELETE FROM tblService WHERE ServiceID = @Id"); await logAction("Deleted a service", actorName(req), "tblService", req.params.id); res.status(204).end(); } catch (error) { sendInternalError(res, error, "Request failed"); } });

  app.post("/api/services/:serviceId/price-tiers", requireUser, requireAdmin, async (req, res) => {
    const serviceId = Number(req.params.serviceId);
    const tier = validateTierPayload(req.body);
    if (!Number.isInteger(serviceId) || serviceId <= 0) return res.status(404).json({ message: "Service not found." });
    if (tier.message) return res.status(400).json({ message: tier.message });
    try {
      const pool = await getPool();
      const service = await pool.request().input("ServiceID", sql.Int, serviceId).query("SELECT TOP 1 ServiceID FROM tblService WHERE ServiceID = @ServiceID");
      if (!service.recordset.length) return res.status(404).json({ message: "Service not found." });
      const result = await pool.request().input("ServiceID", sql.Int, serviceId).input("HPower", sql.NVarChar(50), tier.hPower).input("UnitType", sql.NVarChar(50), tier.unitType || null).input("Amount", sql.Decimal(10, 2), tier.amount).query("INSERT INTO tblServicePrice (ServiceID, HPower, UnitType, Amount) OUTPUT INSERTED.SPriceID AS id, INSERTED.HPower AS hPower, INSERTED.UnitType AS unitType, INSERTED.Amount AS amount VALUES (@ServiceID, @HPower, @UnitType, @Amount)");
      await logAction(`Added price tier to service ${serviceId}`, actorName(req), "tblServicePrice", result.recordset[0].id);
      res.status(201).json(result.recordset[0]);
    } catch (error) { sendInternalError(res, error, "Price tier creation failed"); }
  });

  app.put("/api/services/:serviceId/price-tiers/:tierId", requireUser, requireAdmin, async (req, res) => {
    const serviceId = Number(req.params.serviceId);
    const tierId = Number(req.params.tierId);
    const tier = validateTierPayload(req.body);
    if (!Number.isInteger(serviceId) || serviceId <= 0 || !Number.isInteger(tierId) || tierId <= 0) return res.status(404).json({ message: "Service or price tier not found." });
    if (tier.message) return res.status(400).json({ message: tier.message });
    try {
      const pool = await getPool();
      const existing = await pool.request().input("ServiceID", sql.Int, serviceId).input("SPriceID", sql.Int, tierId).query("SELECT TOP 1 SPriceID FROM tblServicePrice WHERE SPriceID = @SPriceID AND ServiceID = @ServiceID");
      if (!existing.recordset.length) return res.status(404).json({ message: "Service or price tier not found." });
      const result = await pool.request().input("ServiceID", sql.Int, serviceId).input("SPriceID", sql.Int, tierId).input("HPower", sql.NVarChar(50), tier.hPower).input("UnitType", sql.NVarChar(50), tier.unitType || null).input("Amount", sql.Decimal(10, 2), tier.amount).query("UPDATE tblServicePrice SET HPower = @HPower, UnitType = @UnitType, Amount = @Amount OUTPUT INSERTED.SPriceID AS id, INSERTED.HPower AS hPower, INSERTED.UnitType AS unitType, INSERTED.Amount AS amount WHERE SPriceID = @SPriceID AND ServiceID = @ServiceID");
      await logAction(`Updated price tier ${tierId} for service ${serviceId}`, actorName(req), "tblServicePrice", tierId);
      res.json(result.recordset[0]);
    } catch (error) { sendInternalError(res, error, "Price tier update failed"); }
  });

  app.delete("/api/services/:serviceId/price-tiers/:tierId", requireUser, requireAdmin, async (req, res) => {
    const serviceId = Number(req.params.serviceId);
    const tierId = Number(req.params.tierId);
    if (!Number.isInteger(serviceId) || serviceId <= 0 || !Number.isInteger(tierId) || tierId <= 0) return res.status(404).json({ message: "Service or price tier not found." });
    try {
      const pool = await getPool();
      const existing = await pool.request().input("ServiceID", sql.Int, serviceId).input("SPriceID", sql.Int, tierId).query("SELECT TOP 1 SPriceID FROM tblServicePrice WHERE SPriceID = @SPriceID AND ServiceID = @ServiceID");
      if (!existing.recordset.length) return res.status(404).json({ message: "Service or price tier not found." });
      await pool.request().input("SPriceID", sql.Int, tierId).query("DELETE FROM tblServicePrice WHERE SPriceID = @SPriceID");
      await logAction(`Deleted price tier ${tierId} from service ${serviceId}`, actorName(req), "tblServicePrice", tierId);
      res.status(204).end();
    } catch (error) { sendInternalError(res, error, "Price tier deletion failed"); }
  });
};
