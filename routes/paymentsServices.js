function generateReceiptRef() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let i = 0; i < 5; i++) suffix += chars[Math.floor(Math.random() * chars.length)];
  return `RCPT-${y}${m}${d}-${suffix}`;
}

async function insertServicePayment(pool, sql, { requestId, amountPaid, discount, receivedBy }) {
  const referenceNo = generateReceiptRef();
  const result = await pool.request()
    .input("RequestID", sql.Int, Number(requestId))
    .input("ReferenceNo", sql.NVarChar(100), referenceNo)
    .input("AmountPaid", sql.Decimal(10, 2), amountPaid)
    .input("Discount", sql.Decimal(10, 2), discount)
    .input("ReceivedBy", sql.NVarChar(100), receivedBy)
    .query(`
      INSERT INTO tblPayment (RequestID, [Date], ReferenceNo, AmountPaid, Discount, Balance, ReceivedBy)
      OUTPUT INSERTED.PaymentID, INSERTED.RequestID, INSERTED.[Date], INSERTED.ReferenceNo,
        INSERTED.AmountPaid, INSERTED.Discount, INSERTED.Balance, INSERTED.ReceivedBy
      VALUES (@RequestID, GETDATE(), @ReferenceNo, @AmountPaid, @Discount, 0, @ReceivedBy)
    `);
  return { payment: result.recordset[0], referenceNo };
}

module.exports = function registerServicePayments(app, { getPool, sql, requireUser, requireAdmin, logAction, actorName, sendInternalError }) {

  app.post("/api/payments/services", requireUser, async (req, res) => {
    if (req.user.role !== "admin" && req.user.role !== "technician") {
      return res.status(403).json({ message: "Only admins and technicians can record service payments." });
    }
    const { requestId, amountPaid, discount } = req.body;
    const numericAmount = Number(amountPaid);
    const numericDiscount = discount === undefined || discount === null || discount === "" ? 0 : Number(discount);

    if (!requestId) return res.status(400).json({ message: "requestId is required." });
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) return res.status(400).json({ message: "amountPaid must be a positive number." });
    if (!Number.isFinite(numericDiscount) || numericDiscount < 0) return res.status(400).json({ message: "discount must be zero or a positive number." });

    try {
      const pool = await getPool();

      const booking = await pool.request()
        .input("RequestID", sql.Int, Number(requestId))
        .query("SELECT TOP 1 RequestID, Status FROM tblServiceRequest WHERE RequestID = @RequestID");
      if (!booking.recordset.length) {
        return res.status(404).json({ message: "Service booking not found." });
      }
      if (booking.recordset[0].Status !== "Completed") {
        return res.status(400).json({ message: "Payment can only be recorded for completed service bookings." });
      }

      const pendingCharge = await pool.request()
        .input("RequestID", sql.Int, Number(requestId))
        .query("SELECT TOP 1 ChargeID FROM tblJobCharge WHERE RequestID = @RequestID AND Status = 'Pending'");
      if (pendingCharge.recordset.length) {
        return res.status(409).json({ message: "This booking has technician charges awaiting approval. Approve or reject them before recording payment." });
      }

      const existing = await pool.request()
        .input("RequestID", sql.Int, Number(requestId))
        .query("SELECT TOP 1 PaymentID FROM tblPayment WHERE RequestID = @RequestID");
      if (existing.recordset.length) {
        return res.status(409).json({ message: "A payment has already been recorded for this request." });
      }

      const { payment, referenceNo } = await insertServicePayment(pool, sql, {
        requestId,
        amountPaid: numericAmount,
        discount: numericDiscount,
        receivedBy: actorName(req)
      });

      await logAction(`Recorded service payment ${referenceNo} (₱${numericAmount}) for request #${requestId}`, actorName(req), "tblPayment", payment.PaymentID);
      res.status(201).json(payment);
    } catch (error) {
      sendInternalError(res, error, "Service payment recording failed");
    }
  });

  app.get("/api/payments/services", requireUser, requireAdmin, async (req, res) => {
    try {
      const pool = await getPool();
      const result = await pool.request().query(`
        SELECT p.PaymentID AS id, p.RequestID AS requestId, p.[Date] AS date, p.ReferenceNo AS referenceNo,
          p.AmountPaid AS amountPaid, p.Discount AS discount, p.Balance AS balance, p.ReceivedBy AS receivedBy,
          sr.CustomerName AS customer, sr.ServiceName AS service, at.AssignedTechnician AS assignedTechnician
        FROM tblPayment p
        INNER JOIN tblServiceRequest sr ON sr.RequestID = p.RequestID
        OUTER APPLY (SELECT TOP 1 t.Name AS AssignedTechnician FROM Schedules s INNER JOIN Technicians t ON t.Id = s.TechnicianId WHERE s.BookingId = sr.RequestID ORDER BY s.Id DESC) at
        ORDER BY p.PaymentID DESC
      `);
      res.json(result.recordset);
    } catch (error) {
      sendInternalError(res, error, "Failed to fetch service payments");
    }
  });

  app.get("/api/payments/services/:paymentId", requireUser, async (req, res) => {
    const paymentId = Number(req.params.paymentId);
    if (!Number.isInteger(paymentId) || paymentId <= 0) {
      return res.status(400).json({ message: "Invalid payment ID." });
    }

    try {
      const pool = await getPool();
      const result = await pool.request()
        .input("PaymentID", sql.Int, paymentId)
        .query(`
          SELECT p.PaymentID, p.RequestID, p.[Date], p.ReferenceNo,
            p.AmountPaid, p.Discount, p.Balance, p.ReceivedBy,
            sr.Email AS CustomerEmail
          FROM tblPayment p
          INNER JOIN tblServiceRequest sr ON sr.RequestID = p.RequestID
          WHERE p.PaymentID = @PaymentID
        `);

      if (!result.recordset.length) {
        return res.status(404).json({ message: "Payment not found." });
      }

      if (req.user.role !== "admin") {
        const row = result.recordset[0];
        if (String(row.CustomerEmail || "").toLowerCase() !== String(req.user.email || "").toLowerCase()) {
          return res.status(403).json({ message: "You do not have access to this payment record." });
        }
      }

      const { CustomerEmail, ...payment } = result.recordset[0];
      res.json(payment);
    } catch (error) {
      sendInternalError(res, error, "Failed to fetch payment record");
    }
  });
};

module.exports.insertServicePayment = insertServicePayment;
