const { isValidPhilippineMobile } = require("../utils/validation");
const { isPastOrInvalidCalendarDate } = require("../utils/scheduling");
const { appointmentExpiry, sendBookingConfirmationEmail } = require("../utils/reminders");
const { matchServicePrice } = require("./services");
const { getExcessPipeRate } = require("./excess-pipe");

module.exports = function registerBookingRoutes(app, { getPool, sql, requireUser, requireAdmin, logAction, actorName, sendInternalError, validateServiceArea }) {
  async function findReminderBooking(token) {
    return (await (await getPool()).request().input("Token", sql.NVarChar(128), String(token || "")).query("SELECT TOP 1 RequestID AS id, CustomerName AS customer, Email AS email, ServiceName AS service, Address AS address, RequestDate AS preferredDate, RequestTime AS preferredTime, Status AS status, RescheduleCount AS rescheduleCount, LastActionAt AS lastActionAt, CASE WHEN LastActionAt IS NOT NULL AND DATEDIFF(second, LastActionAt, GETDATE()) < 300 THEN 1 ELSE 0 END AS cooldownActive FROM tblServiceRequest WHERE ReminderToken = @Token AND ReminderTokenExpiresAt > GETDATE()")).recordset[0];
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
      const result = await request.query(`SELECT b.RequestID AS id, b.CustomerName AS customer, b.Phone AS phone, b.Email AS email, b.ServiceName AS service, b.Address AS address, b.UnableToCompleteReason AS unableToCompleteReason, CONVERT(varchar(10), b.RequestDate, 23) AS preferredDate, b.RequestTime AS preferredTime, b.TotalAmount AS totalAmount, b.Status AS status, t.Name AS technician, CONVERT(varchar(10), s.ScheduleDate, 23) AS scheduleDate, s.ScheduleTime AS scheduleTime FROM tblServiceRequest b LEFT JOIN Schedules s ON s.BookingId = b.RequestID LEFT JOIN Technicians t ON t.Id = s.TechnicianId ${customerFilter} ORDER BY b.RequestID DESC`);
      const bookings = result.recordset;
      if (bookings.length) {
        const ids = bookings.map((booking) => Number(booking.id)).filter((id) => Number.isInteger(id) && id > 0);
        if (ids.length) {
          const detailsResult = await pool.request().query(`SELECT sd.RequestID AS requestId, sd.Quantity AS quantity, sd.Description AS description, sd.UPrice AS uPrice, sd.SubTotal AS subTotal, cu.Photos AS photos FROM tblServiceDetails sd LEFT JOIN tblCustomerUnit cu ON cu.CUnitID = sd.CUnitID WHERE sd.RequestID IN (${ids.join(",")})`);
          const unitsByRequest = new Map();
          detailsResult.recordset.forEach((row) => {
            if (!unitsByRequest.has(row.requestId)) unitsByRequest.set(row.requestId, []);
            let photos = [];
            try {
              const parsed = JSON.parse(row.photos || "[]");
              if (Array.isArray(parsed)) photos = parsed.filter((photo) => typeof photo === "string");
            } catch { photos = []; }
            unitsByRequest.get(row.requestId).push({ quantity: row.quantity, description: row.description, uPrice: row.uPrice, subTotal: row.subTotal, photos });
          });
          bookings.forEach((booking) => { booking.units = unitsByRequest.get(booking.id) || []; });
        }
      }
      res.json(bookings);
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
          ? await pool.request().input("Id", sql.Int, id).query("SELECT TOP 1 ServiceID AS Id, Name, Type, Price FROM tblService WHERE ServiceID = @Id")
          : await pool.request().input("Name", sql.NVarChar(100), String(selected?.name || selected).trim()).query("SELECT TOP 1 ServiceID AS Id, Name, Type, Price FROM tblService WHERE Name = @Name");
        const service = result.recordset[0];
        if (!service) return null;
        if (selected && typeof selected === "object" && selected.units !== undefined && !Array.isArray(selected.units)) {
          const error = new Error("Service units must be an array."); error.statusCode = 400; throw error;
        }
        const isRepair = String(service.Type || "").trim().toLowerCase() === "repair";
        const units = Array.isArray(selected?.units) ? selected.units.filter(Boolean) : [];
        const preparedUnits = [];
        for (const unit of units) {
          const quantity = Number(unit.quantity ?? 1);
          if (!Number.isInteger(quantity) || quantity <= 0) { const error = new Error("Unit quantity must be a positive whole number."); error.statusCode = 400; throw error; }
          if (isRepair) {
            const problem = String(unit.problem || "").trim();
            if (!problem) { const error = new Error("Please select the problem for each unit."); error.statusCode = 400; throw error; }
            const airconType = String(unit.airconType || "").trim() || null;
            const technology = String(unit.technology || "").trim() || null;
            const rawBrandId = String(unit.brandId ?? "").trim();
            const brandId = rawBrandId ? Number(unit.brandId) : null;
            let brandName = null;
            if (rawBrandId) {
              if (!Number.isInteger(brandId) || brandId <= 0) { const error = new Error("A valid brand is required when a Repair brand is selected."); error.statusCode = 400; throw error; }
              const brandResult = await pool.request().input("BrandID", sql.Int, brandId).query("SELECT TOP 1 Name FROM tblBrand WHERE BrandID = @BrandID");
              brandName = brandResult.recordset[0]?.Name || null;
              if (!brandName) { const error = new Error("The selected Repair brand is no longer available."); error.statusCode = 400; throw error; }
            }
            preparedUnits.push({ problem, airconType, technology, horsePower: null, brandId, brandName, quantity, amount: Number(service.Price || 0), photos: Array.isArray(unit.photos) ? unit.photos : [] });
            continue;
          }
          const airconType = String(unit.airconType || "").trim();
          const technology = String(unit.technology || "").trim();
          const horsePower = Number(unit.horsePower);
          const brandId = Number(unit.brandId);
          if (!airconType || !technology) { const error = new Error("Aircon type and technology are required for each unit."); error.statusCode = 400; throw error; }
          if (!Number.isFinite(horsePower) || horsePower <= 0) { const error = new Error("Horsepower must be a positive number for each unit."); error.statusCode = 400; throw error; }
          if (!Number.isInteger(brandId) || brandId <= 0) { const error = new Error("A valid brand is required for each unit."); error.statusCode = 400; throw error; }
          const match = await matchServicePrice(pool, sql, service.Id, horsePower, technology, airconType);
          if (!match) { const error = new Error("Unable to match a price for one of the selected units."); error.statusCode = 400; throw error; }
          let amount = Number(match.amount);
          let excessNote = "";
          const serviceType = String(service.Type || "").trim().toLowerCase();
          if (serviceType === "installation" || serviceType === "re-location") {
            const rawExcessFeet = unit.excessPipeFeet;
            if (rawExcessFeet !== undefined && rawExcessFeet !== null && String(rawExcessFeet).trim() !== "") {
              const excessFeet = Number(rawExcessFeet);
              if (!Number.isInteger(excessFeet) || excessFeet <= 0) { const error = new Error("Excess pipe length must be a positive whole number."); error.statusCode = 400; throw error; }
              const rateMatch = await getExcessPipeRate(pool, sql);
              if (!rateMatch) { const error = new Error("Unable to verify the excess pipe rate for this unit."); error.statusCode = 400; throw error; }
              const rate = Number(rateMatch.ratePerFoot);
              amount = Number((amount + excessFeet * rate).toFixed(2));
              excessNote = ` + ${excessFeet}ft excess pipe (₱${rate.toFixed(2)}/ft)`;
            }
          }
          preparedUnits.push({ airconType, technology, horsePower, brandId, quantity, amount, excessNote, photos: Array.isArray(unit.photos) ? unit.photos : [] });
        }
        return { ...service, units: preparedUnits, total: preparedUnits.length ? preparedUnits.reduce((sum, unit) => sum + unit.amount * unit.quantity, 0) : Number(service.Price || 0) };
      }));
      if (pricedServices.some((item) => !item)) return res.status(400).json({ message: "One or more selected services are no longer available." });
      const serviceLabel = pricedServices.map((item) => `${item.Type || "Uncategorized"} - ${item.Name}`).join(", ");
      const serviceTotal = pricedServices.reduce((sum, item) => sum + item.total, 0);
      const transaction = new sql.Transaction(pool);
      await transaction.begin();
      try {
        let customerId = null;
        if (pricedServices.some((item) => item.units.length)) {
          const customerResult = await transaction.request().input("Email", sql.NVarChar(150), String(email || req.user.email || "").trim()).query("SELECT TOP 1 CustomerID FROM tblCustomer WHERE LOWER(Email) = LOWER(@Email)");
          customerId = customerResult.recordset[0]?.CustomerID;
          if (!customerId) { const error = new Error("Customer profile could not be found for the submitted unit details."); error.statusCode = 400; throw error; }
          const duplicateCheck = await transaction.request()
            .input("CustomerID", sql.Int, customerId)
            .input("ServiceName", sql.NVarChar(500), serviceLabel)
            .input("Address", sql.NVarChar(255), address)
            .query("SELECT TOP 1 RequestID AS id, CustomerName AS customer, Phone AS phone, Email AS email, ServiceName AS service, TotalAmount AS totalAmount, Address AS address, CONVERT(varchar(10), RequestDate, 23) AS preferredDate, RequestTime AS preferredTime, Status AS status FROM tblServiceRequest WHERE CustomerID = @CustomerID AND ServiceName = @ServiceName AND LOWER(Address) = LOWER(@Address) AND CreatedAt >= DATEADD(second, -60, GETDATE()) ORDER BY CreatedAt DESC");
          const existingBooking = duplicateCheck.recordset[0];
          if (existingBooking) {
            try { await transaction.rollback(); } catch (_) { /* transaction may already be closed */ }
            return res.status(200).json(existingBooking);
          }
        }
        const result = await transaction.request()
        .input("CustomerName", sql.NVarChar(100), customer).input("Phone", sql.NVarChar(50), phone || "")
        .input("Email", sql.NVarChar(150), email || "").input("ServiceName", sql.NVarChar(500), serviceLabel)
        .input("TotalAmount", sql.Decimal(10, 2), serviceTotal).input("Address", sql.NVarChar(255), address)
        .input("RequestDate", sql.Date, preferredDate).input("RequestTime", sql.NVarChar(50), preferredTime || "")
        .input("Latitude", sql.Decimal(9, 6), Number(latitude)).input("Longitude", sql.Decimal(9, 6), Number(longitude))
        .input("CustomerID", sql.Int, customerId)
        .query("INSERT INTO tblServiceRequest (CustomerName, Phone, Email, CustomerID, ServiceName, TotalAmount, Address, RequestDate, RequestTime, Latitude, Longitude, Status) OUTPUT INSERTED.RequestID AS id, INSERTED.CustomerName AS customer, INSERTED.Phone AS phone, INSERTED.Email AS email, INSERTED.ServiceName AS service, INSERTED.TotalAmount AS totalAmount, INSERTED.Address AS address, CONVERT(varchar(10), INSERTED.RequestDate, 23) AS preferredDate, INSERTED.RequestTime AS preferredTime, INSERTED.Status AS status VALUES (@CustomerName, @Phone, @Email, @CustomerID, @ServiceName, @TotalAmount, @Address, @RequestDate, @RequestTime, @Latitude, @Longitude, 'Pending')");
        const requestId = result.recordset[0].id;
        for (const serviceItem of pricedServices) {
          for (const unit of serviceItem.units) {
            let photosJson = null;
            try {
              const photos = Array.isArray(unit.photos) ? unit.photos.filter((photo) => typeof photo === "string" && photo.trim()).slice(0, 3) : [];
              photosJson = photos.length ? JSON.stringify(photos) : null;
            } catch { photosJson = null; }
            const customerUnit = await transaction.request()
              .input("CustomerID", sql.Int, customerId).input("BrandID", sql.Int, unit.brandId)
              .input("AirconType", sql.NVarChar(50), unit.airconType).input("Technology", sql.NVarChar(50), unit.technology)
              .input("HorsePower", sql.Decimal(4, 2), unit.horsePower)
              .input("Photos", sql.NVarChar(sql.MAX), photosJson)
              .query("INSERT INTO tblCustomerUnit (CustomerID, BrandID, AirconType, Technology, HorsePower, Photos) OUTPUT INSERTED.CUnitID AS id VALUES (@CustomerID, @BrandID, @AirconType, @Technology, @HorsePower, @Photos)");
            const cUnitId = customerUnit.recordset[0].id;
            const repairContext = [unit.airconType, unit.brandName, unit.technology].filter(Boolean).join(", ");
            const description = unit.problem ? ["Repair", repairContext, unit.problem].filter(Boolean).join(" \\u2014 ") : `${unit.airconType} ${unit.technology} ${unit.horsePower}HP${unit.excessNote || ""}`;
            await transaction.request().input("RequestID", sql.Int, requestId).input("CUnitID", sql.Int, cUnitId)
              .input("Quantity", sql.Int, unit.quantity).input("Description", sql.NVarChar(500), description)
              .input("UPrice", sql.Decimal(10, 2), unit.amount).input("SubTotal", sql.Decimal(10, 2), unit.amount * unit.quantity)
              .query("INSERT INTO tblServiceDetails (RequestID, CUnitID, Quantity, Description, UPrice, SubTotal) VALUES (@RequestID, @CUnitID, @Quantity, @Description, @UPrice, @SubTotal)");
          }
        }
        await transaction.commit();
        await logAction(`Created booking for ${customer}`, actorName(req), "tblServiceRequest", requestId);
        try {
          await sendBookingConfirmationEmail({ name: customer, email: String(email || "").trim(), services: pricedServices, preferredDate, preferredTime, address, totalAmount: serviceTotal, requestId });
        } catch (emailError) {
          console.warn("Booking confirmation email failed:", emailError);
        }
        res.status(201).json(result.recordset[0]);
      } catch (error) {
        try { await transaction.rollback(); } catch (_) { /* transaction may already be closed */ }
        throw error;
      }
    } catch (error) {
      if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
      sendInternalError(res, error, "Request failed");
    }
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
      await pool.request().input("Id", sql.Int, booking.id).input("CancellationFeeApplies", sql.Bit, feeApplies ? 1 : 0).query("DELETE FROM Schedules WHERE BookingId = @Id; UPDATE tblServiceRequest SET Status = 'Cancelled', CancellationFeeApplies = @CancellationFeeApplies, LastActionAt = GETDATE(), ReminderToken = NULL WHERE RequestID = @Id;");
      await logAction(feeApplies ? `Cancelled booking ${booking.id} through reminder link; ₱450 cancellation fee applies because the technician is already on site` : `Cancelled booking ${booking.id} through reminder link`, "Reminder link", "tblServiceRequest", booking.id);
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
      await pool.request().input("RequestDate", sql.Date, preferredDate).input("RequestTime", sql.NVarChar(50), preferredTime).input("ReminderTokenExpiresAt", sql.DateTime, appointmentExpiry(preferredDate, preferredTime)).input("Id", sql.Int, booking.id).query("DELETE FROM Schedules WHERE BookingId = @Id; UPDATE tblServiceRequest SET RequestDate = @RequestDate, RequestTime = @RequestTime, Status = 'Pending', RescheduleCount = RescheduleCount + 1, LastActionAt = GETDATE(), ReminderTokenExpiresAt = @ReminderTokenExpiresAt, ReminderSentAt = NULL WHERE RequestID = @Id;");
      await logAction(`Rescheduled booking ${booking.id} through reminder link to ${preferredDate} ${preferredTime}`, "Reminder link", "tblServiceRequest", booking.id);
      res.json({ id: booking.id, status: "Pending", preferredDate, preferredTime });
    } catch (error) { sendInternalError(res, error, "Reminder reschedule failed"); }
  });

  app.put("/api/bookings/:id/status", requireUser, requireAdmin, async (req, res) => { const { status } = req.body; if (!status) return res.status(400).json({ message: "Status is required." }); try { const result = await (await getPool()).request().input("Id", sql.Int, Number(req.params.id)).input("Status", sql.NVarChar(50), status).query("UPDATE tblServiceRequest SET Status = @Status OUTPUT INSERTED.RequestID AS id, INSERTED.CustomerName AS customer, INSERTED.ServiceName AS service, INSERTED.Address AS address, INSERTED.Status AS status WHERE RequestID = @Id"); if (!result.recordset.length) return res.status(404).json({ message: "Booking not found." }); await logAction(`Marked booking ${req.params.id} as ${status}`, actorName(req), "tblServiceRequest", req.params.id); res.json(result.recordset[0]); } catch (error) { sendInternalError(res, error, "Request failed"); } });
  app.put("/api/bookings/:id/technician-status", requireUser, async (req, res) => { const { status, reason = "" } = req.body; if (req.user.role !== "technician" && req.user.role !== "admin") return res.status(403).json({ message: "Technician access required." }); if (!["Scheduled", "In Progress", "Completed", "Unable to Complete"].includes(status)) return res.status(400).json({ message: "Choose a valid job status." }); if (status === "Unable to Complete" && !String(reason).trim()) return res.status(400).json({ message: "Please provide a reason before marking this job unable to complete." }); try { const result = await (await getPool()).request().input("Id", sql.Int, Number(req.params.id)).input("Status", sql.NVarChar(50), status).input("Reason", sql.NVarChar(500), status === "Unable to Complete" ? String(reason).trim() : null).query("UPDATE tblServiceRequest SET Status = @Status, UnableToCompleteReason = @Reason OUTPUT INSERTED.RequestID AS id, INSERTED.CustomerName AS customer, INSERTED.ServiceName AS service, INSERTED.Address AS address, INSERTED.UnableToCompleteReason AS unableToCompleteReason, INSERTED.Status AS status WHERE RequestID = @Id"); if (!result.recordset.length) return res.status(404).json({ message: "Booking not found." }); await logAction(`Updated job ${req.params.id} to ${status}${status === "Unable to Complete" ? `: ${String(reason).trim()}` : ""}`, actorName(req), "tblServiceRequest", req.params.id); res.json(result.recordset[0]); } catch (error) { sendInternalError(res, error, "Request failed"); } });
  app.put("/api/bookings/:id/cancel", requireUser, async (req, res) => { if (req.user.role !== "customer") return res.status(403).json({ message: "Customer access required." }); try { const pool = await getPool(); const booking = await pool.request().input("Id", sql.Int, Number(req.params.id)).input("Email", sql.NVarChar(150), req.user.email).query("SELECT RequestID AS Id, Status FROM tblServiceRequest WHERE RequestID = @Id AND LOWER(Email) = LOWER(@Email)"); if (!booking.recordset.length) return res.status(404).json({ message: "Booking not found." }); const feeApplies = booking.recordset[0].Status === "In Progress"; if (["Completed", "Cancelled"].includes(booking.recordset[0].Status)) return res.status(400).json({ message: "This booking can no longer be cancelled." }); await pool.request().input("Id", sql.Int, Number(req.params.id)).input("CancellationFeeApplies", sql.Bit, feeApplies ? 1 : 0).query("DELETE FROM Schedules WHERE BookingId = @Id; UPDATE tblServiceRequest SET Status = 'Cancelled', CancellationFeeApplies = @CancellationFeeApplies WHERE RequestID = @Id;"); await logAction(feeApplies ? `Cancelled booking ${req.params.id}; ₱450 cancellation fee applies because the technician is already on site` : `Cancelled booking ${req.params.id}`, actorName(req), "tblServiceRequest", req.params.id); res.json({ id: Number(req.params.id), status: "Cancelled" }); } catch (error) { sendInternalError(res, error, "Request failed"); } });
  app.delete("/api/bookings/:id", requireUser, requireAdmin, async (req, res) => { try { const pool = await getPool(); await pool.request().input("Id", sql.Int, Number(req.params.id)).query("DELETE FROM Schedules WHERE BookingId = @Id; DELETE FROM tblServiceRequest WHERE RequestID = @Id;"); await logAction("Deleted a booking", actorName(req), "tblServiceRequest", req.params.id); res.status(204).end(); } catch (error) { sendInternalError(res, error, "Request failed"); } });
};
