function isValidPhilippineMobile(phone) {
  return /^09\d{9}$/.test(String(phone || "").trim());
}

function isStrongPassword(password) {
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(String(password || ""));
}

function isPastOrInvalidCalendarDate(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return true;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (date.getFullYear() !== Number(match[1]) || date.getMonth() !== Number(match[2]) - 1 || date.getDate() !== Number(match[3])) return true;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
}

function slotToMinuteRange(slot) {
  const parseTime = (value) => {
    const match = String(value || "").trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
    if (!match) return null;
    let hours = Number(match[1]);
    const minutes = Number(match[2] || 0);
    if (hours < 1 || hours > 12 || minutes > 59) return null;
    if (hours === 12) hours = 0;
    if (match[3].toUpperCase() === "PM") hours += 12;
    return hours * 60 + minutes;
  };
  const values = String(slot || "").split(/\s*(?:–|—|-)\s*/).map(parseTime);
  return values.length === 2 && values.every(Number.isFinite) ? values : null;
}

function timeSlotsOverlap(firstSlot, secondSlot) {
  const first = slotToMinuteRange(firstSlot);
  const second = slotToMinuteRange(secondSlot);
  return first && second ? first[0] < second[1] && second[0] < first[1] : String(firstSlot) === String(secondSlot);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim().toLowerCase());
}

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

module.exports = {
  isValidPhilippineMobile, isStrongPassword, isPastOrInvalidCalendarDate,
  slotToMinuteRange, timeSlotsOverlap, validateTechnicianPayload, validateServicePayload,
  isValidEmail
};
