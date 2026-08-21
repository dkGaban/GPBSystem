const { insertServicePayment } = require("./paymentsServices");

module.exports = function registerJobChargeRoutes(app, { getPool, sql, requireUser, requireAdmin, logAction, actorName, sendInternalError }) {

  app.put("/api/job-charges/:id/approve", requireUser, requireAdmin, async (req, res) => {
    const chargeId = Number(req.params.id);
    if (!Number.isInteger(chargeId) || chargeId <= 0) return res.status(400).json({ message: "Invalid charge report ID." });
    try {
      const pool = await getPool();
      const chargeResult = await pool.request().input("ChargeID", sql.Int, chargeId)
        .query("SELECT TOP 1 ChargeID, RequestID, ExcessPipeFeet, ExcessPipeRate, ExcessPipeCost, ProposedTotal, ProposedAmountPaid, ProposedDiscount, Status FROM tblJobCharge WHERE ChargeID = @ChargeID");
      if (!chargeResult.recordset.length) return res.status(404).json({ message: "Charge report not found." });
      const charge = chargeResult.recordset[0];
      if (charge.Status !== "Pending") return res.status(409).json({ message: "This charge report has already been reviewed." });
      await pool.request()
        .input("ChargeID", sql.Int, chargeId)
        .input("ReviewedBy", sql.NVarChar(100), actorName(req))
        .query("UPDATE tblJobCharge SET Status = 'Approved', ReviewedBy = @ReviewedBy, ReviewedAt = GETDATE() WHERE ChargeID = @ChargeID");
      await pool.request()
        .input("RequestID", sql.Int, charge.RequestID)
        .input("FinalAmount", sql.Decimal(10, 2), Number(charge.ProposedTotal))
        .input("ExcessPipeFeet", sql.Int, charge.ExcessPipeFeet ?? null)
        .input("ExcessPipeRate", sql.Decimal(10, 2), charge.ExcessPipeRate ?? null)
        .input("ExcessPipeCost", sql.Decimal(10, 2), charge.ExcessPipeCost ?? null)
        .query("UPDATE tblServiceRequest SET FinalAmount = @FinalAmount, ExcessPipeFeet = @ExcessPipeFeet, ExcessPipeRate = @ExcessPipeRate, ExcessPipeCost = @ExcessPipeCost WHERE RequestID = @RequestID");
      let paymentRecorded = false;
      if (charge.ProposedAmountPaid !== null && charge.ProposedAmountPaid !== undefined) {
        const existingPayment = await pool.request()
          .input("RequestID", sql.Int, charge.RequestID)
          .query("SELECT TOP 1 PaymentID FROM tblPayment WHERE RequestID = @RequestID");
        if (!existingPayment.recordset.length) {
          const { payment, referenceNo } = await insertServicePayment(pool, sql, {
            requestId: charge.RequestID,
            amountPaid: Number(charge.ProposedAmountPaid),
            discount: Number(charge.ProposedDiscount || 0),
            receivedBy: actorName(req)
          });
          paymentRecorded = true;
          await logAction(`Recorded service payment ${referenceNo} (₱${Number(charge.ProposedAmountPaid).toFixed(2)}) for request #${charge.RequestID} via charge approval`, actorName(req), "tblPayment", payment.PaymentID);
        }
      }
      await logAction(`Approved job charges #${chargeId} for request #${charge.RequestID} (final amount ₱${Number(charge.ProposedTotal).toFixed(2)})${paymentRecorded ? "; recorded the technician's proposed payment" : ""}`, actorName(req), "tblJobCharge", chargeId);
      res.json({ id: chargeId, requestId: charge.RequestID, status: "Approved", finalAmount: Number(charge.ProposedTotal), paymentRecorded });
    } catch (error) { sendInternalError(res, error, "Charge approval failed"); }
  });

  app.put("/api/job-charges/:id/reject", requireUser, requireAdmin, async (req, res) => {
    const chargeId = Number(req.params.id);
    if (!Number.isInteger(chargeId) || chargeId <= 0) return res.status(400).json({ message: "Invalid charge report ID." });
    try {
      const pool = await getPool();
      const chargeResult = await pool.request().input("ChargeID", sql.Int, chargeId)
        .query("SELECT TOP 1 c.ChargeID, c.RequestID, c.Status, b.TotalAmount FROM tblJobCharge c INNER JOIN tblServiceRequest b ON b.RequestID = c.RequestID WHERE c.ChargeID = @ChargeID");
      if (!chargeResult.recordset.length) return res.status(404).json({ message: "Charge report not found." });
      const charge = chargeResult.recordset[0];
      if (charge.Status !== "Pending") return res.status(409).json({ message: "This charge report has already been reviewed." });
      await pool.request()
        .input("ChargeID", sql.Int, chargeId)
        .input("ReviewedBy", sql.NVarChar(100), actorName(req))
        .query("UPDATE tblJobCharge SET Status = 'Rejected', ReviewedBy = @ReviewedBy, ReviewedAt = GETDATE() WHERE ChargeID = @ChargeID");
      await pool.request()
        .input("RequestID", sql.Int, charge.RequestID)
        .input("FinalAmount", sql.Decimal(10, 2), Number(charge.TotalAmount))
        .query("UPDATE tblServiceRequest SET FinalAmount = @FinalAmount WHERE RequestID = @RequestID");
      await logAction(`Rejected job charges #${chargeId} for request #${charge.RequestID} (final amount falls back to the booked estimate ₱${Number(charge.TotalAmount).toFixed(2)})`, actorName(req), "tblJobCharge", chargeId);
      res.json({ id: chargeId, requestId: charge.RequestID, status: "Rejected", finalAmount: Number(charge.TotalAmount) });
    } catch (error) { sendInternalError(res, error, "Charge rejection failed"); }
  });
};
