function isPastOrInvalidCalendarDate(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return true;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (date.getFullYear() !== Number(match[1]) || date.getMonth() !== Number(match[2]) - 1 || date.getDate() !== Number(match[3])) return true;
  const today = new Date(); today.setHours(0, 0, 0, 0); return date < today;
}
function slotToMinuteRange(slot) {
  const parseTime = (value) => { const match = String(value || "").trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i); if (!match) return null; let hours = Number(match[1]); const minutes = Number(match[2] || 0); if (hours < 1 || hours > 12 || minutes > 59) return null; if (hours === 12) hours = 0; if (match[3].toUpperCase() === "PM") hours += 12; return hours * 60 + minutes; };
  const values = String(slot || "").split(/\s*(?:â€“|â€”|-)\s*/).map(parseTime); return values.length === 2 && values.every(Number.isFinite) ? values : null;
}
function timeSlotsOverlap(firstSlot, secondSlot) { const first = slotToMinuteRange(firstSlot); const second = slotToMinuteRange(secondSlot); return first && second ? first[0] < second[1] && second[0] < first[1] : String(firstSlot) === String(secondSlot); }
module.exports = { isPastOrInvalidCalendarDate, slotToMinuteRange, timeSlotsOverlap };
