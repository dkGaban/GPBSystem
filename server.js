require("dotenv").config();
const express = require("express");
const { rateLimit } = require("express-rate-limit");
const cors = require("cors");
const crypto = require("crypto");
const path = require("path");
const { getPool, initializeDatabase, sql } = require("./db");
const logger = require("./utils/logger");
const { createToken, readToken } = require("./utils/token");
const { addressFromBody, saveProfilePhoto } = require("./utils/address");
const { isValidPhilippineMobile, isStrongPassword, normalizeEmail, isValidEmail, validateTechnicianPayload, validateServicePayload } = require("./utils/validation");
const { actorName, createLogAction, sendInternalError: sendInternalErrorResponse } = require("./utils/audit");
const { validateServiceArea } = require("./utils/service-area");
const { startReminderCron } = require("./utils/reminders");

const app = express();
const port = process.env.PORT || 3000;
if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET must be set before starting the application.");
if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) throw new Error("EMAIL_USER and EMAIL_APP_PASSWORD must be set before starting the application. Use a Gmail App Password, not the account password.");
if (process.env.NODE_ENV === "production" && !process.env.ADMIN_DEFAULT_PASSWORD) throw new Error("ADMIN_DEFAULT_PASSWORD must be set in production before starting the application.");
const adminDefaultPassword = process.env.ADMIN_DEFAULT_PASSWORD || "admin123";
if (adminDefaultPassword === "admin123") logger.warn("WARNING: The default admin credentials are still active. Set ADMIN_DEFAULT_PASSWORD to a strong unique password.");

app.use(cors());
app.use(express.json({ limit: "10mb" }));
const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: "draft-7", legacyHeaders: false, handler: (req, res) => res.status(429).json({ message: "Too many requests. Please try again later." }) });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: "draft-7", legacyHeaders: false, handler: (req, res) => res.status(429).json({ message: "Too many authentication attempts. Please try again later." }) });
app.use("/api", apiLimiter);
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "guest.html")));
app.use(express.static(__dirname));

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.pbkdf2Sync(password, salt, 120000, 64, "sha512").toString("hex");
  return { salt, hash };
}

function verifyPassword(password, salt, hash) {
  return hashPassword(password, salt).hash === hash;
}

function requireUser(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  try { const user = readToken(token); if (!user) return res.status(401).json({ message: "Please log in first." }); req.user = user; next(); }
  catch (error) { if (error.name === "TokenExpiredError") return res.status(401).json({ message: "Your token expired. Please log in again." }); return res.status(401).json({ message: "Please log in first." }); }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") return res.status(403).json({ message: "Admin access required." });
  next();
}

const sendInternalError = (res, error, context, extra = {}) => sendInternalErrorResponse(res, logger, error, context, extra);
const logAction = createLogAction({ getPool, sql, logger });

const routeDependencies = { getPool, sql, authLimiter, requireUser, requireAdmin, logAction, actorName, sendInternalError, normalizeEmail, addressFromBody, isValidPhilippineMobile, isStrongPassword, isValidEmail, validateServiceArea, verifyPassword, hashPassword };
require("./routes/auth")(app, routeDependencies);
require("./routes/customers")(app, routeDependencies);
require("./routes/logs")(app, routeDependencies);
require("./routes/schedules")(app, routeDependencies);
require("./routes/technicians")(app, routeDependencies);
require("./routes/bookings")(app, routeDependencies);
require("./routes/products")(app, routeDependencies);
require("./routes/services")(app, routeDependencies);
require("./routes/brands")(app, routeDependencies);
require("./routes/excess-pipe")(app, routeDependencies);

app.get("/api/health", async (req, res) => {
  try {
    await getPool();
    res.json({ ok: true, database: "GBPServiceDB" });
  } catch (error) {
    sendInternalError(res, error, "Health check failed", { ok: false });
  }
});

app.put("/api/auth/change-password", requireUser, async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;
  if (!currentPassword || !newPassword || newPassword !== confirmPassword) return res.status(400).json({ message: "Enter the current password and matching new passwords." });
  if (!isStrongPassword(newPassword)) return res.status(400).json({ message: "New password must be at least 8 characters with uppercase, lowercase, and a number." });
  try {
    const pool = await getPool();
    const existing = await pool.request().input("Id", sql.Int, req.user.id).query("SELECT PasswordHash, PasswordSalt FROM Users WHERE Id = @Id");
    if (!existing.recordset.length || !verifyPassword(currentPassword, existing.recordset[0].PasswordSalt, existing.recordset[0].PasswordHash)) return res.status(400).json({ message: "Current password is incorrect." });
    const next = hashPassword(newPassword);
    await pool.request().input("Id", sql.Int, req.user.id).input("PasswordHash", sql.NVarChar(255), next.hash).input("PasswordSalt", sql.NVarChar(80), next.salt).query("UPDATE Users SET PasswordHash = @PasswordHash, PasswordSalt = @PasswordSalt, MustChangePassword = 0 WHERE Id = @Id");
    res.json({ message: "Password changed successfully." });
  } catch (error) { sendInternalError(res, error, "Request failed"); }
});

initializeDatabase({ hashPassword, adminDefaultPassword, logger })
  .then(() => {
    startReminderCron({ getPool, sql, logger, baseUrl: process.env.APP_BASE_URL || `http://localhost:${port}` });
    app.listen(port, () => {
      logger.info({ port }, "Server started");
      console.log(`Server running at http://localhost:${port}`);
    });
  })
  .catch((error) => {
    logger.fatal({ err: error }, "Failed to initialize database and migrations");
    process.exit(1);
  });
