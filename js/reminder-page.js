import { escapeHtml } from "./portal-utils.js";

const token = new URLSearchParams(window.location.search).get("token");
const $ = (id) => document.getElementById(id);
let booking;

if (!token) showMessage("This reminder link is missing its booking token.", true);
else loadBooking();

async function loadBooking() {
  try {
    const response = await fetch(`/api/bookings/reminder/${encodeURIComponent(token)}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "This reminder link is invalid or has expired.");
    booking = data;
    $("reminderDetails").innerHTML = `<div><dt>Service</dt><dd>${escapeHtml(data.service)}</dd></div><div><dt>Date</dt><dd>${escapeHtml(formatDate(data.preferredDate))}</dd></div><div><dt>Time</dt><dd>${escapeHtml(data.preferredTime)}</dd></div><div><dt>Address</dt><dd>${escapeHtml(data.address)}</dd></div>`;
    $("reminderDetails").classList.remove("hidden");
    $("reminderActions").classList.remove("hidden");
    $("rescheduleDate").min = todayDate();
    showMessage("Please confirm your booking details before choosing an action.", false);
  } catch (error) { showMessage(error.message, true); }
}

$("cancelBookingButton").addEventListener("click", async () => {
  if (!confirm("Cancel this booking? Cancelling now is free, but the time slot will be released for other customers.")) return;
  await submitAction("cancel", {});
});

$("rescheduleForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  await submitAction("reschedule", { preferredDate: $("rescheduleDate").value, preferredTime: $("rescheduleTime").value });
});

async function submitAction(action, payload) {
  try {
    const response = await fetch(`/api/bookings/reminder/${encodeURIComponent(token)}/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "We couldn't update this booking.");
    $("reminderActions").classList.add("hidden");
    showMessage(action === "cancel" ? "Your booking has been cancelled." : "Your booking has been rescheduled and returned for approval.", false);
  } catch (error) { showMessage(error.message, true); }
}

function showMessage(message, isError) { $("reminderMessage").textContent = message; $("reminderMessage").classList.toggle("error-message", isError); }
function formatDate(value) { return new Intl.DateTimeFormat("en-PH", { dateStyle: "long" }).format(new Date(value)); }
function todayDate() { const now = new Date(); const offset = now.getTimezoneOffset() * 60000; return new Date(now.getTime() - offset).toISOString().slice(0, 10); }

