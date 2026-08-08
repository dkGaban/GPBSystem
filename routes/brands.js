module.exports = function registerBrandRoutes(app, { getPool, sql, requireUser, requireAdmin, logAction, actorName, sendInternalError }) {
  function validName(value) {
    const name = String(value || "").trim();
    return name ? name : null;
  }

  app.get("/api/brands", async (req, res) => {
    try {
      const result = await (await getPool()).request().query("SELECT BrandID AS id, Name AS name FROM tblBrand ORDER BY Name");
      res.json(result.recordset);
    } catch (error) { sendInternalError(res, error, "Request failed"); }
  });

  app.post("/api/brands", requireUser, requireAdmin, async (req, res) => {
    const name = validName(req.body.name);
    if (!name) return res.status(400).json({ message: "Brand name is required." });
    try {
      const pool = await getPool();
      const duplicate = await pool.request().input("Name", sql.NVarChar(100), name).query("SELECT TOP 1 BrandID FROM tblBrand WHERE LOWER(Name) = LOWER(@Name)");
      if (duplicate.recordset.length) return res.status(409).json({ message: "That brand already exists." });
      const result = await pool.request().input("Name", sql.NVarChar(100), name).query("INSERT INTO tblBrand (Name) OUTPUT INSERTED.BrandID AS id, INSERTED.Name AS name VALUES (@Name)");
      await logAction(`Created brand ${name}`, actorName(req), "tblBrand", result.recordset[0].id);
      res.status(201).json(result.recordset[0]);
    } catch (error) { sendInternalError(res, error, "Brand creation failed"); }
  });

  app.put("/api/brands/:id", requireUser, requireAdmin, async (req, res) => {
    const brandId = Number(req.params.id);
    const name = validName(req.body.name);
    if (!Number.isInteger(brandId) || brandId <= 0) return res.status(404).json({ message: "Brand not found." });
    if (!name) return res.status(400).json({ message: "Brand name is required." });
    try {
      const pool = await getPool();
      const duplicate = await pool.request().input("BrandID", sql.Int, brandId).input("Name", sql.NVarChar(100), name).query("SELECT TOP 1 BrandID FROM tblBrand WHERE LOWER(Name) = LOWER(@Name) AND BrandID <> @BrandID");
      if (duplicate.recordset.length) return res.status(409).json({ message: "That brand already exists." });
      const result = await pool.request().input("BrandID", sql.Int, brandId).input("Name", sql.NVarChar(100), name).query("UPDATE tblBrand SET Name = @Name OUTPUT INSERTED.BrandID AS id, INSERTED.Name AS name WHERE BrandID = @BrandID");
      if (!result.recordset.length) return res.status(404).json({ message: "Brand not found." });
      await logAction(`Updated brand ${name}`, actorName(req), "tblBrand", brandId);
      res.json(result.recordset[0]);
    } catch (error) { sendInternalError(res, error, "Brand update failed"); }
  });

  app.delete("/api/brands/:id", requireUser, requireAdmin, async (req, res) => {
    const brandId = Number(req.params.id);
    if (!Number.isInteger(brandId) || brandId <= 0) return res.status(404).json({ message: "Brand not found." });
    try {
      const pool = await getPool();
      await pool.request().input("BrandID", sql.Int, brandId).query("DELETE FROM tblBrand WHERE BrandID = @BrandID");
      await logAction("Deleted a brand", actorName(req), "tblBrand", brandId);
      res.status(204).end();
    } catch (error) {
      if (error.number === 547 || /REFERENCE constraint|FOREIGN KEY constraint/i.test(error.message || "")) {
        return res.status(409).json({ message: "This brand cannot be deleted because it is referenced by a customer unit or product service." });
      }
      sendInternalError(res, error, "Brand deletion failed");
    }
  });
};
