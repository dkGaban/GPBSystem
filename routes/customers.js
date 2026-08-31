const { addressFromBody } = require("../utils/address");
const { isValidPhilippineMobile, normalizeEmail } = require("../utils/validation");

module.exports = function registerCustomerRoutes(app, { getPool, sql, requireUser, requireAdmin, logAction, actorName, sendInternalError, validateServiceArea }) {
  app.get("/api/customers", requireUser, async (req, res) => {
    try {
      const pool = await getPool();
      const request = pool.request();
      let technicianFilter = "";
      if (req.user.role === "technician") {
        const technicianResult = await pool.request().input("UserId", sql.Int, req.user.id).query("SELECT TOP 1 t.Id FROM Technicians t INNER JOIN Users u ON u.Email = t.Email WHERE u.Id = @UserId AND u.Role = 'technician'");
        if (!technicianResult.recordset.length) return res.json([]);
        request.input("TechnicianId", sql.Int, technicianResult.recordset[0].Id);
        technicianFilter = `
          INNER JOIN (SELECT DISTINCT b.CustomerID FROM tblServiceRequest b INNER JOIN Schedules s ON s.BookingId = b.RequestID WHERE s.TechnicianId = @TechnicianId AND b.CustomerID IS NOT NULL) assigned ON assigned.CustomerID = c.CustomerID`;
      }
      const result = await request.query(`
        SELECT c.CustomerID AS id, c.Name AS name, c.CNumber AS phone, c.Email AS email,
          COALESCE(NULLIF(CONCAT(NULLIF(c.HouseNumber, ''), CASE WHEN NULLIF(c.HouseNumber, '') IS NOT NULL THEN ', ' ELSE '' END,
          NULLIF(c.Street, ''), CASE WHEN NULLIF(c.Street, '') IS NOT NULL THEN ', ' ELSE '' END,
          CASE WHEN NULLIF(c.Barangay, '') IS NOT NULL THEN CONCAT('Barangay ', REPLACE(c.Barangay, 'Barangay ', '')) ELSE NULL END,
          CASE WHEN NULLIF(c.Barangay, '') IS NOT NULL THEN ', ' ELSE '' END, NULLIF(c.City, ''), CASE WHEN NULLIF(c.City, '') IS NOT NULL THEN ', ' ELSE '' END,
          NULLIF(c.Province, ''), CASE WHEN NULLIF(c.Province, '') IS NOT NULL THEN ', ' ELSE '' END, NULLIF(c.ZipCode, '')), ''), c.Address) AS address,
          c.HouseNumber AS houseNumber, c.Street AS street, c.Barangay AS barangay, c.City AS city, c.Province AS province, c.ZipCode AS zipCode
        FROM tblCustomer c${technicianFilter} ORDER BY c.CustomerID DESC
      `);
      res.json(result.recordset);
    } catch (error) { sendInternalError(res, error, "Request failed"); }
  });

  app.post("/api/customers", requireUser, async (req, res) => {
    const { name, phone, city, latitude, longitude } = req.body; const email = normalizeEmail(req.body.email); const address = addressFromBody(req.body);
    if (!name || !phone || !email || !address.address) return res.status(400).json({ message: "Missing required customer fields." });
    if (!isValidPhilippineMobile(phone)) return res.status(400).json({ message: "Contact number must contain exactly 11 digits." });
    const serviceAreaError = validateServiceArea({ city, latitude, longitude });
    if (serviceAreaError) return res.status(400).json({ message: serviceAreaError });
    try {
      const pool = await getPool();
      const result = await pool.request().input("Name", sql.NVarChar(100), name).input("Phone", sql.NVarChar(50), phone).input("Email", sql.NVarChar(100), email).input("Address", sql.NVarChar(255), address.address).input("Latitude", sql.Decimal(9, 6), latitude === undefined ? null : Number(latitude)).input("Longitude", sql.Decimal(9, 6), longitude === undefined ? null : Number(longitude)).query(`
        INSERT INTO tblCustomer (Name, CNumber, Email, Address, Latitude, Longitude)
        OUTPUT INSERTED.CustomerID AS id, INSERTED.Name AS name, INSERTED.CNumber AS phone, INSERTED.Email AS email, INSERTED.Address AS address
        VALUES (@Name, @Phone, @Email, @Address, @Latitude, @Longitude)
      `);
      await logAction(`Created customer ${name}`, actorName(req), "tblCustomer", result.recordset[0].id); res.status(201).json(result.recordset[0]);
    } catch (error) { sendInternalError(res, error, "Request failed"); }
  });

  app.put("/api/customers/:id", requireUser, async (req, res) => {
    const { name, phone, city, latitude, longitude } = req.body; const email = normalizeEmail(req.body.email); const address = addressFromBody(req.body);
    if (!name || !phone || !email || !address.address) return res.status(400).json({ message: "Missing required customer fields." });
    if (!isValidPhilippineMobile(phone)) return res.status(400).json({ message: "Contact number must contain exactly 11 digits." });
    const serviceAreaError = validateServiceArea({ city, latitude, longitude });
    if (serviceAreaError) return res.status(400).json({ message: serviceAreaError });
    try {
      const pool = await getPool();
      const result = await pool.request().input("Id", sql.Int, Number(req.params.id)).input("Name", sql.NVarChar(100), name).input("Phone", sql.NVarChar(50), phone).input("Email", sql.NVarChar(100), email).input("Address", sql.NVarChar(255), address.address).input("Latitude", sql.Decimal(9, 6), latitude === undefined ? null : Number(latitude)).input("Longitude", sql.Decimal(9, 6), longitude === undefined ? null : Number(longitude)).query(`
        UPDATE tblCustomer SET Name = @Name, CNumber = @Phone, Email = @Email, Address = @Address, Latitude = @Latitude, Longitude = @Longitude
        OUTPUT INSERTED.CustomerID AS id, INSERTED.Name AS name, INSERTED.CNumber AS phone, INSERTED.Email AS email, INSERTED.Address AS address WHERE CustomerID = @Id
      `);
      if (!result.recordset.length) return res.status(404).json({ message: "Customer not found." });
      await logAction(`Updated customer ${name}`, actorName(req), "tblCustomer", req.params.id); res.json(result.recordset[0]);
    } catch (error) { sendInternalError(res, error, "Request failed"); }
  });

  app.delete("/api/customers/:id", requireUser, requireAdmin, async (req, res) => {
    try { const pool = await getPool(); await pool.request().input("Id", sql.Int, Number(req.params.id)).query("DELETE FROM tblCustomer WHERE CustomerID = @Id"); await logAction("Deleted a customer", actorName(req), "tblCustomer", req.params.id); res.status(204).end(); }
    catch (error) { sendInternalError(res, error, "Request failed"); }
  });
};
