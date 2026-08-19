const { timeSlotsOverlap } = require("../utils/scheduling");
const { createReminderTransport } = require("../utils/reminders");
module.exports = function registerScheduleRoutes(app, { getPool, sql, requireUser, requireAdmin, logAction, actorName, sendInternalError }) {
  app.post("/api/schedules", requireUser, requireAdmin, async (req, res) => {
    const { bookingId, technicianId } = req.body;
    if (!bookingId || !technicianId) return res.status(400).json({ message: "Select a booking and technician." });
    try {
      const pool = await getPool();
      const bookingResult = await pool.request().input("BookingId", sql.Int, Number(bookingId)).query("SELECT RequestDate AS scheduleDate, RequestTime AS scheduleTime, Status AS status, CustomerName AS customerName, Email AS email, ServiceName AS serviceName, Address AS address FROM tblServiceRequest WHERE RequestID = @BookingId");
      if (!bookingResult.recordset.length) return res.status(404).json({ message: "Booking not found." }); const requested = bookingResult.recordset[0];
      if (!requested.scheduleDate || !requested.scheduleTime) return res.status(400).json({ message: "This booking has no preferred date and time." });
      if (requested.status !== "Approved") return res.status(400).json({ message: "Only approved bookings can be assigned. Use a separate schedule-edit flow to change an existing assignment." });
      const technicianResult = await pool.request().input("TechnicianId", sql.Int, Number(technicianId)).query("SELECT Id, Name, PhoneNumber FROM Technicians WHERE Id = @TechnicianId AND Status = 'Active'");
      if (!technicianResult.recordset.length) return res.status(400).json({ message: "Select an active technician." }); const technician = technicianResult.recordset[0];
      const assignments = await pool.request().input("TechnicianId", sql.Int, Number(technicianId)).input("ScheduleDate", sql.Date, requested.scheduleDate).query("SELECT s.BookingId, s.ScheduleTime FROM Schedules s WHERE s.TechnicianId = @TechnicianId AND s.ScheduleDate = @ScheduleDate");
      if (assignments.recordset.some((assignment) => Number(assignment.BookingId) !== Number(bookingId) && timeSlotsOverlap(assignment.ScheduleTime, requested.scheduleTime))) return res.status(409).json({ message: "This technician is already assigned during the customer's requested time slot." });
      await pool.request().input("BookingId", sql.Int, Number(bookingId)).input("TechnicianId", sql.Int, Number(technicianId)).input("ScheduleDate", sql.Date, requested.scheduleDate).input("ScheduleTime", sql.NVarChar(50), requested.scheduleTime).query("DELETE FROM Schedules WHERE BookingId = @BookingId; INSERT INTO Schedules (BookingId, TechnicianId, ScheduleDate, ScheduleTime, Status) VALUES (@BookingId, @TechnicianId, @ScheduleDate, @ScheduleTime, 'Assigned'); UPDATE tblServiceRequest SET Status = 'Scheduled' WHERE RequestID = @BookingId;");
      await logAction(`Assigned technician ${technicianId} to booking ${bookingId}`, actorName(req), "Schedules", bookingId); res.status(201).json({ ok: true, scheduleDate: requested.scheduleDate, scheduleTime: requested.scheduleTime });
      const email = String(requested.email || "").trim();
      if (email) {
        const displayDate = new Intl.DateTimeFormat("en-PH", { dateStyle: "long", timeZone: process.env.TZ || "Asia/Manila" }).format(new Date(requested.scheduleDate));
        const text = `Hi ${requested.customerName},

A technician has been assigned to your service request (#${bookingId}).

Technician: ${technician.Name}
Phone: ${technician.PhoneNumber}

The technician will contact you by phone regarding your appointment.

Service: ${requested.serviceName}
Scheduled Date: ${displayDate}
Time: ${requested.scheduleTime}
Address: ${requested.address}

Thank you,
GBP Electro-Mechanical Services`;
        try {
          const transport = createReminderTransport();
          await transport.sendMail({ from: process.env.EMAIL_USER, to: email, subject: `Technician Assigned — Your ${requested.serviceName} Appointment`, text });
        } catch (emailError) { console.warn("Technician assignment email failed:", emailError); }
      }
    } catch (error) { sendInternalError(res, error, "Request failed"); }
  });
};
