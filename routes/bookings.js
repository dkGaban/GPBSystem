const { isValidPhilippineMobile } = require("../utils/validation");
const { isPastOrInvalidCalendarDate } = require("../utils/scheduling");
const { appointmentExpiry } = require("../utils/reminders");

module.exports = function registerBookingRoutes(app, { getPool, sql, requireUser, requireAdmin, logAction, actorName, sendInternalError, validateServiceArea }) {
  async function findReminderBooking(token) {
    return (await (await getPool()).request().input("Token", sql.NVarChar(128), String(token || "")).query("SELECT TOP 1 Id AS id, CustomerName AS customer, Email AS email, ServiceName AS service, Address AS address, PreferredDate AS preferredDate, PreferredTime AS preferredTime, Status AS status, RescheduleCount AS rescheduleCount, LastActionAt AS lastActionAt, CASE WHEN LastActionAt IS NOT NULL AND DATEDIFF(second, LastActionAt, GETDATE()) < 300 THEN 1 ELSE 0 END AS cooldownActive FROM Bookings WHERE ReminderToken = @Token AND ReminderTokenExpiresAt > GETDATE()")).recordset[0];
  }

  function cooldownActive(lastActionAt) {
    return lastActionAt && Date.now() - new Date(lastActionAt).getTime() < 5 * 60 * 1000;
  }

  app.get("/api/bookings", requireUser, async (req, res) => {
    try {
      const pool = await getPool();
      const request = pool.request();
      const customerFilter = req.user.role === "customer" ? "WHERE LOWER(b.Email) = LOWER(@Email)" : "";
      if (req.user.role === "customer") request.input("Email", sql.NVarChar(150), req.user.email);
      const result = await request.query(`SELECT b.Id AS id, b.CustomerName AS customer, b.Phone AS phone, b.Email AS email, b.ServiceName AS service, b.Address AS address, b.UnableToCompleteReason AS unableToCompleteReason, CONVERT(varchar(10), b.PreferredDate, 23) AS preferredDate, b.PreferredTime AS preferredTime, b.TotalAmount AS totalAmount, b.Status AS status, t.Name AS technician, CONVERT(varchar(10), s.ScheduleDate, 23) AS scheduleDate, s.ScheduleTime AS scheduleTime FROM Bookings b LEFT JOIN Schedules s ON s.BookingId = b.Id LEFT JOIN Technicians t ON t.Id = s.TechnicianId ${customerFilter} ORDER BY b.Id DESC`);
      res.json(result.recordset);
    } catch (error) { sendInternalError(res, error, "Request failed"); }
  });

  app.post("/api/bookings", requireUser, async (req, res) => {
    const { customer, phone, email, service, services = [], address, preferredDate, preferredTime, city, latitude, longitude } = req.body;
    const selectedServices = Array.isArray(services) && services.length ? services : String(service || "").split(",").map((item) => item.trim()).filter(Boolean);
    if (!customer || !selectedServices.length || !address || !preferredDate || !preferredTime) return res.status(400).json({ message: "Missing required booking fields." });
    if (phone && !isValidPhilippineMobile(phone)) return res.status(400).json({ message: "Please enter a valid Philippine mobile number." });
    if (isPastOrInvalidCalendarDate(preferredDate)) return res.status(400).json({ message: "Preferred date cannot be in the past. Please choose today or a future date." });
    const serviceAreaError = validateServiceArea({ city, latitude, longitude, requireCoordinates: true });
    if (serviceAreaError) return res.status(400).json({ message: serviceAreaError });
    try {
      const pool = await getPool();
      const pricedServices = await Promise.all(selectedServices.map(async (selected) => {
        const id = Number(selected?.id);
        const result = Number.isInteger(id) && id > 0
          ? await pool.request().input("Id", sql.Int, id).query("SELECT TOP 1 Id, Name, Type, Price FROM Services WHERE Id = @Id")
          : await pool.request().input("Name", sql.NVarChar(100), String(selected?.name || selected).trim()).query("SELECT TOP 1 Id, Name, Type, Price FROM Services WHERE Name = @Name");
        return result.recordset[0];
      }));
      if (pricedServices.some((item) => !item)) return res.status(400).json({ message: "One or more selected services are no longer available." });
      const serviceLabel = pricedServices.map((item) => `${item.Type || "Uncategorized"} - ${item.Name}`).join(", ");
      const serviceTotal = pricedServices.reduce((sum, item) => sum + Number(item.Price || 0), 0);
      const result = await pool.request()
        .input("CustomerName", sql.NVarChar(100), customer).input("Phone", sql.NVarChar(50), phone || "")
        .input("Email", sql.NVarChar(150), email || "").input("ServiceName", sql.NVarChar(500), serviceLabel)
        .input("TotalAmount", sql.Decimal(10, 2), serviceTotal).input("Address", sql.NVarChar(255), address)
        .input("PreferredDate", sql.Date, preferredDate).input("PreferredTime", sql.NVarChar(50), preferredTime || "")
        .input("Latitude", sql.Decimal(9, 6), Number(latitude)).input("Longitude", sql.Decimal(9, 6), Number(longitude))
        .query("INSERT INTO Bookings (CustomerName, Phone, Email, ServiceName, TotalAmount, Address, PreferredDate, PreferredTime, Latitude, Longitude, Status) OUTPUT INSERTED.Id AS id, INSERTED.CustomerName AS customer, INSERTED.Phone AS phone, INSERTED.Email AS email, INSERTED.ServiceName AS service, INSERTED.TotalAmount AS totalAmount, INSERTED.Address AS address, CONVERT(varchar(10), INSERTED.PreferredDate, 23) AS preferredDate, INSERTED.PreferredTime AS preferredTime, INSERTED.Status AS status VALUES (@CustomerName, @Phone, @Email, @ServiceName, @TotalAmount, @Address, @PreferredDate, @PreferredTime, @Latitude, @Longitude, 'Pending')");
      await logAction(`Created booking for ${customer}`, actorName(req), "Bookings", result.recordset[0].id);
      res.status(201).json(result.recordset[0]);
    } catch (error) { sendInternalError(res, error, "Request failed"); }
  });

  app.get("/api/bookings/reminder/:token", async (req, res) => {
    try {
      const booking = await findReminderBooking(req.params.token);
      if (!booking) return res.status(404).json({ message: "This reminder link is invalid or has expired." });
      res.json({ id: booking.id, service: booking.service, preferredDate: booking.preferredDate, preferredTime: booking.preferredTime, address: booking.address });
    } catch (error) { sendInternalError(res, error, "Reminder link validation failed"); }
  });

  app.post("/api/bookings/reminder/:token/cancel", async (req, res) => {
    try {
      const pool = await getPool();
      const booking = await findReminderBooking(req.params.token);
      if (!booking) return res.status(404).json({ message: "This reminder link is invalid or has expired." });
      if (booking.cooldownActive === 1 || (booking.cooldownActive == null && cooldownActive(booking.lastActionAt))) return res.status(429).json({ message: "Please wait five minutes between booking changes." });
      if (["Completed", "Cancelled"].includes(booking.status)) return res.status(400).json({ message: "This booking can no longer be cancelled." });
      const feeApplies = booking.status === "In Progress";
      await pool.request().input("Id", sql.Int, booking.id).input("CancellationFeeApplies", sql.Bit, feeApplies ? 1 : 0).query("DELETE FROM Schedules WHERE BookingId = @Id; UPDATE Bookings SET Status = 'Cancelled', CancellationFeeApplies = @CancellationFeeApplies, LastActionAt = GETDATE(), ReminderToken = NULL WHERE Id = @Id;");
      await logAction(feeApplies ? `Cancelled booking ${booking.id} through reminder link; ₱450 cancellation fee applies because the technician is already on site` : `Cancelled booking ${booking.id} through reminder link`, "Reminder link", "Bookings", booking.id);
      res.json({ id: booking.id, status: "Cancelled" });
    } catch (error) { sendInternalError(res, error, "Reminder cancellation failed"); }
  });

  app.post("/api/bookings/reminder/:token/reschedule", async (req, res) => {
    const { preferredDate, preferredTime } = req.body;
    if (!preferredDate || !preferredTime) return res.status(400).json({ message: "Choose a new date and time for your booking." });
    if (isPastOrInvalidCalendarDate(preferredDate)) return res.status(400).json({ message: "Preferred date cannot be in the past. Please choose today or a future date." });
    try {
      const pool = await getPool();
      const booking = await findReminderBooking(req.params.token);
      if (!booking) return res.status(404).json({ message: "This reminder link is invalid or has expired." });
      if (booking.cooldownActive === 1 || (booking.cooldownActive == null && cooldownActive(booking.lastActionAt))) return res.status(429).json({ message: "Please wait five minutes between booking changes." });
      if (Number(booking.rescheduleCount || 0) >= 2) return res.status(400).json({ message: "This booking has already been rescheduled the maximum number of times. Please cancel and submit a new booking if you need a different date." });
      if (["Completed", "Cancelled"].includes(booking.status)) return res.status(400).json({ message: "This booking can no longer be rescheduled." });
      await pool.request().input("Id", sql.Int, booking.id).input("PreferredDate", sql.Date, preferredDate).input("PreferredTime", sql.NVarChar(50), preferredTime).input("ReminderTokenExpiresAt", sql.DateTime, appointmentExpiry(preferredDate, preferredTime)).query("DELETE FROM Schedules WHERE BookingId = @Id; UPDATE Bookings SET PreferredDate = @PreferredDate, PreferredTime = @PreferredTime, Status = 'Pending', RescheduleCount = RescheduleCount + 1, LastActionAt = GETDATE(), ReminderTokenExpiresAt = @ReminderTokenExpiresAt, ReminderSentAt = NULL WHERE Id = @Id;");
      await logAction(`Rescheduled booking ${booking.id} through reminder link to ${preferredDate} ${preferredTime}`, "Reminder link", "Bookings", booking.id);
      res.json({ id: booking.id, status: "Pending", preferredDate, preferredTime });
    } catch (error) { sendInternalError(res, error, "Reminder reschedule failed"); }
  });

  app.put("/api/bookings/:id/status", requireUser, requireAdmin, async (req, res) => { const { status } = req.body; if (!status) return res.status(400).json({ message: "Status is required." }); try { const result = await (await getPool()).request().input("Id", sql.Int, Number(req.params.id)).input("Status", sql.NVarChar(50), status).query("UPDATE Bookings SET Status = @Status OUTPUT INSERTED.Id AS id, INSERTED.CustomerName AS customer, INSERTED.ServiceName AS service, INSERTED.Address AS address, INSERTED.Status AS status WHERE Id = @Id"); if (!result.recordset.length) return res.status(404).json({ message: "Booking not found." }); await logAction(`Marked booking ${req.params.id} as ${status}`, actorName(req), "Bookings", req.params.id); res.json(result.recordset[0]); } catch (error) { sendInternalError(res, error, "Request failed"); } });
  app.put("/api/bookings/:id/technician-status", requireUser, async (req, res) => { const { status, reason = "" } = req.body; if (req.user.role !== "technician" && req.user.role !== "admin") return res.status(403).json({ message: "Technician access required." }); if (!["Scheduled", "In Progress", "Completed", "Unable to Complete"].includes(status)) return res.status(400).json({ message: "Choose a valid job status." }); if (status === "Unable to Complete" && !String(reason).trim()) return res.status(400).json({ message: "Please provide a reason before marking this job unable to complete." }); try { const result = await (await getPool()).request().input("Id", sql.Int, Number(req.params.id)).input("Status", sql.NVarChar(50), status).input("Reason", sql.NVarChar(500), status === "Unable to Complete" ? String(reason).trim() : null).query("UPDATE Bookings SET Status = @Status, UnableToCompleteReason = @Reason OUTPUT INSERTED.Id AS id, INSERTED.CustomerName AS customer, INSERTED.ServiceName AS service, INSERTED.Address AS address, INSERTED.UnableToCompleteReason AS unableToCompleteReason, INSERTED.Status AS status WHERE Id = @Id"); if (!result.recordset.length) return res.status(404).json({ message: "Booking not found." }); await logAction(`Updated job ${req.params.id} to ${status}${status === "Unable to Complete" ? `: ${String(reason).trim()}` : ""}`, actorName(req), "Bookings", req.params.id); res.json(result.recordset[0]); } catch (error) { sendInternalError(res, error, "Request failed"); } });
  app.put("/api/bookings/:id/cancel", requireUser, async (req, res) => { if (req.user.role !== "customer") return res.status(403).json({ message: "Customer access required." }); try { const pool = await getPool(); const booking = await pool.request().input("Id", sql.Int, Number(req.params.id)).input("Email", sql.NVarChar(150), req.user.email).query("SELECT Id, Status FROM Bookings WHERE Id = @Id AND LOWER(Email) = LOWER(@Email)"); if (!booking.recordset.length) return res.status(404).json({ message: "Booking not found." }); const feeApplies = booking.recordset[0].Status === "In Progress"; if (["Completed", "Cancelled"].includes(booking.recordset[0].Status)) return res.status(400).json({ message: "This booking can no longer be cancelled." }); await pool.request().input("Id", sql.Int, Number(req.params.id)).input("CancellationFeeApplies", sql.Bit, feeApplies ? 1 : 0).query("DELETE FROM Schedules WHERE BookingId = @Id; UPDATE Bookings SET Status = 'Cancelled', CancellationFeeApplies = @CancellationFeeApplies WHERE Id = @Id;"); await logAction(feeApplies ? `Cancelled booking ${req.params.id}; ₱450 cancellation fee applies because the technician is already on site` : `Cancelled booking ${req.params.id}`, actorName(req), "Bookings", req.params.id); res.json({ id: Number(req.params.id), status: "Cancelled" }); } catch (error) { sendInternalError(res, error, "Request failed"); } });
  app.delete("/api/bookings/:id", requireUser, requireAdmin, async (req, res) => { try { const pool = await getPool(); await pool.request().input("Id", sql.Int, Number(req.params.id)).query("DELETE FROM Schedules WHERE BookingId = @Id; DELETE FROM Bookings WHERE Id = @Id;"); await logAction("Deleted a booking", actorName(req), "Bookings", req.params.id); res.status(204).end(); } catch (error) { sendInternalError(res, error, "Request failed"); } });
};
