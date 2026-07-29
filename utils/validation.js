function isValidPhilippineMobile(phone) { return /^09\d{9}$/.test(String(phone || "").trim()); }
function isStrongPassword(password) { return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(String(password || "")); }
function normalizeEmail(email) { return String(email || "").trim().toLowerCase(); }
function isValidEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email)); }
function validateTechnicianPayload({ name, specialty, phoneNumber, email, address }) {
  if (!String(name || "").trim() || !String(specialty || "").trim()) return "Name and fields are required.";
  if (!isValidPhilippineMobile(phoneNumber)) return "Phone number must be an 11-digit Philippine mobile number starting with 09.";
  if (!isValidEmail(email)) return "Enter a valid email address.";
  if (!String(address || "").trim()) return "Address is required.";
  return "";
}
function validateServicePayload({ name, type, price }) {
  if (!String(name || "").trim()) return "Variant name is required.";
  if (!String(type || "").trim()) return "Category is required.";
  if (price === undefined || price === null || String(price).trim() === "") return "Price is required.";
  const amount = Number(price);
  if (!Number.isFinite(amount) || amount < 0) return "Price cannot be negative.";
  return "";
}
module.exports = { isValidPhilippineMobile, isStrongPassword, normalizeEmail, isValidEmail, validateTechnicianPayload, validateServicePayload };
