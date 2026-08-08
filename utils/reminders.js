const crypto = require("crypto");
const cron = require("node-cron");
const nodemailer = require("nodemailer");

function createReminderTransport() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.EMAIL_USER, pass: String(process.env.EMAIL_APP_PASSWORD || "").replace(/\s+/g, "") }
  });
}

function makeReminderToken() {
  return crypto.randomBytes(32).toString("hex");
}

function appointmentExpiry(preferredDate, preferredTime) {
  const date = preferredDate instanceof Date
    ? preferredDate.toISOString().slice(0, 10)
    : String(preferredDate || "").slice(0, 10);
  const match = String(preferredTime || "").match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i);
  if (!date || !match) return new Date(`${date}T23:59:59`);
  let hour = Number(match[1]);
  if (match[3].toUpperCase() === "PM" && hour !== 12) hour += 12;
  if (match[3].toUpperCase() === "AM" && hour === 12) hour = 0;
  return new Date(`${date}T${String(hour).padStart(2, "0")}:${match[2] || "00"}:00`);
}

function displayDate(value) {
  return new Intl.DateTimeFormat("en-PH", { dateStyle: "long", timeZone: process.env.TZ || "Asia/Manila" }).format(new Date(value));
}

function reminderLinks(baseUrl, token) {
  const root = `${String(baseUrl || "").replace(/\/$/, "")}/reminder.html?token=${encodeURIComponent(token)}`;
  return { cancelUrl: `${root}&action=cancel`, rescheduleUrl: `${root}&action=reschedule` };
}

function reminderText(booking, links) {
  return `Hi ${booking.customer}, just a reminder that your ${booking.service} appointment is scheduled for tomorrow, ${displayDate(booking.preferredDate)} at ${booking.preferredTime}. If everything still works for you, no action is needed — we'll see you then!

Please confirm your booking details:
Service: ${booking.service}
Date: ${displayDate(booking.preferredDate)}
Time: ${booking.preferredTime}
Address: ${booking.address}

If your plans changed, cancelling now is completely free because it is still before your appointment day and the technician has not been dispatched. If you cancel, this time slot will be released for other customers. You're always welcome to submit a new booking anytime.

Cancel this booking: ${links.cancelUrl}
Reschedule this booking: ${links.rescheduleUrl}

Important policy reminder:
If you decide to cancel after our technician has already arrived on the day of service, a ₱450 fee applies for their time and travel.`;
}

async function sendBookingReminder(booking, { getPool, sql, logger, baseUrl }) {
  const token = makeReminderToken();
  const expiresAt = appointmentExpiry(booking.preferredDate, booking.preferredTime);
  const links = reminderLinks(baseUrl, token);
  const transport = createReminderTransport();
  await getPool().then((pool) => pool.request().input("Id", sql.Int, booking.id).input("Token", sql.NVarChar(128), token).input("ExpiresAt", sql.DateTime, expiresAt).query("UPDATE tblServiceRequest SET ReminderToken = @Token, ReminderTokenExpiresAt = @ExpiresAt WHERE RequestID = @Id"));
  await transport.sendMail({ from: process.env.EMAIL_USER, to: booking.email, subject: `Reminder: your ${booking.service} appointment is tomorrow`, text: reminderText(booking, links) });
  await getPool().then((pool) => pool.request().input("Id", sql.Int, booking.id).query("UPDATE tblServiceRequest SET ReminderSentAt = GETDATE() WHERE RequestID = @Id"));
  logger.info({ bookingId: booking.id }, "Booking reminder sent");
}

async function sendTomorrowReminders({ getPool, sql, logger, baseUrl }) {
  const result = await (await getPool()).request().query("SELECT RequestID AS id, CustomerName AS customer, Email AS email, ServiceName AS service, Address AS address, RequestDate AS preferredDate, RequestTime AS preferredTime FROM tblServiceRequest WHERE RequestDate = CONVERT(date, DATEADD(day, 1, GETDATE())) AND Status NOT IN ('Cancelled', 'Completed') AND ReminderSentAt IS NULL AND NULLIF(Email, '') IS NOT NULL");
  for (const booking of result.recordset) {
    try { await sendBookingReminder(booking, { getPool, sql, logger, baseUrl }); } catch (error) { logger.error({ err: error, bookingId: booking.id }, "Booking reminder failed"); }
  }
}

function startReminderCron(deps) {
  cron.schedule("0 9 * * *", () => sendTomorrowReminders(deps).catch((error) => deps.logger.error({ err: error }, "Reminder cron failed")), { timezone: process.env.TZ || "Asia/Manila" });
}

module.exports = { appointmentExpiry, makeReminderToken, sendTomorrowReminders, startReminderCron };
