const crypto = require("crypto");
const { createReminderTransport } = require("../utils/reminders");

module.exports = function registerPasswordResetRoutes(app, { getPool, sql, authLimiter, sendInternalError, normalizeEmail, isStrongPassword, hashPassword }) {
  const GENERIC_SUCCESS = { message: "If an account exists with this email, a code has been sent." };

  function generateOTP() {
    return String(crypto.randomInt(100000, 999999));
  }

  app.post("/api/auth/forgot-password", authLimiter, async (req, res) => {
    const email = normalizeEmail(req.body.email);
    if (!email) return res.json(GENERIC_SUCCESS);
    try {
      const pool = await getPool();
      const existing = await pool.request().input("Email", sql.NVarChar(150), email).query("SELECT TOP 1 Id FROM Users WHERE Email = @Email");
      if (!existing.recordset.length) return res.json(GENERIC_SUCCESS);

      const recent = await pool.request().input("Email", sql.NVarChar(150), email).query("SELECT TOP 1 CreatedAt FROM PasswordResetOTPs WHERE Email = @Email AND Used = 0 ORDER BY CreatedAt DESC");
      if (recent.recordset.length) {
        const elapsed = (Date.now() - new Date(recent.recordset[0].CreatedAt).getTime()) / 1000;
        if (elapsed < 60) return res.json(GENERIC_SUCCESS);
      }

      const otp = generateOTP();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
      await pool.request()
        .input("Email", sql.NVarChar(150), email)
        .input("OTP", sql.NVarChar(10), otp)
        .input("ExpiresAt", sql.DateTime, expiresAt)
        .query("INSERT INTO PasswordResetOTPs (Email, OTP, ExpiresAt) VALUES (@Email, @OTP, @ExpiresAt)");

      const transport = createReminderTransport();
      await transport.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: "Your password reset code — GBP Electro-Mechanical Services",
        text: `Your password reset code is: ${otp}\n\nThis code expires in 5 minutes.\n\nIf you did not request a password reset, you can safely ignore this email.`
      });

      res.json(GENERIC_SUCCESS);
    } catch (error) { sendInternalError(res, error, "Password reset request failed"); }
  });

  app.post("/api/auth/verify-otp", authLimiter, async (req, res) => {
    const email = normalizeEmail(req.body.email);
    const otp = String(req.body.otp || "").trim();
    if (!email || !otp) return res.status(400).json({ message: "Enter your email and the 6-digit code." });
    try {
      const pool = await getPool();
      const result = await pool.request()
        .input("Email", sql.NVarChar(150), email)
        .input("OTP", sql.NVarChar(10), otp)
        .query("SELECT TOP 1 Id FROM PasswordResetOTPs WHERE Email = @Email AND OTP = @OTP AND Used = 0 AND ExpiresAt > GETDATE() ORDER BY CreatedAt DESC");
      if (!result.recordset.length) return res.status(400).json({ message: "Invalid or expired code." });
      res.json({ message: "Code verified." });
    } catch (error) { sendInternalError(res, error, "OTP verification failed"); }
  });

  app.post("/api/auth/reset-password", authLimiter, async (req, res) => {
    const email = normalizeEmail(req.body.email);
    const otp = String(req.body.otp || "").trim();
    const newPassword = req.body.newPassword || "";
    if (!email || !otp || !newPassword) return res.status(400).json({ message: "Enter your email, the 6-digit code, and a new password." });
    if (!isStrongPassword(newPassword)) return res.status(400).json({ message: "Password must be at least 8 characters and include uppercase, lowercase, and a number." });
    try {
      const pool = await getPool();
      const codeRow = await pool.request()
        .input("Email", sql.NVarChar(150), email)
        .input("OTP", sql.NVarChar(10), otp)
        .query("SELECT TOP 1 Id FROM PasswordResetOTPs WHERE Email = @Email AND OTP = @OTP AND Used = 0 AND ExpiresAt > GETDATE() ORDER BY CreatedAt DESC");
      if (!codeRow.recordset.length) return res.status(400).json({ message: "Invalid or expired code." });

      const next = hashPassword(newPassword);
      await pool.request()
        .input("Email", sql.NVarChar(150), email)
        .input("PasswordHash", sql.NVarChar(255), next.hash)
        .input("PasswordSalt", sql.NVarChar(80), next.salt)
        .query("UPDATE Users SET PasswordHash = @PasswordHash, PasswordSalt = @PasswordSalt, MustChangePassword = 0 WHERE Email = @Email");
      await pool.request()
        .input("Id", sql.Int, codeRow.recordset[0].Id)
        .query("UPDATE PasswordResetOTPs SET Used = 1 WHERE Id = @Id");

      res.json({ message: "Password reset successfully. You can now log in." });
    } catch (error) { sendInternalError(res, error, "Password reset failed"); }
  });
};
