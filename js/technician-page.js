import { getBookings, getCustomers, updateTechnicianJobStatus } from "./api.js";
import { bindTabs, escapeHtml, logout, requireRole, statusBadge, toast } from "./portal-utils.js";

const session = requireRole("technician");
let bookings = [];
let customers = [];

if (session) init();

async function init() {
  bindTabs("dashboard");
  document.getElementById("logoutButton").addEventListener("click", logout);
  document.body.addEventListener("change", async (event) => {
    if (!event.target.matches("[data-job-status]")) return;
    await updateTechnicianJobStatus(event.target.dataset.jobStatus, event.target.value);
    toast("Job status updated.");
    await loadAll();
  });
  await loadAll();
}

async function loadAll() {
  [bookings, customers] = await Promise.all([getBookings(), getCustomers()]);
  bookings = bookings.filter((booking) => booking.technician);
  render();
}

function render() {
  document.getElementById("statsGrid").innerHTML = [
    ["Assigned Jobs", bookings.length, "stat-blue", "icon-bookings"],
    ["Pending", bookings.filter((item) => item.status === "Pending").length, "stat-orange", "icon-schedule"],
    ["In Progress", bookings.filter((item) => item.status === "In Progress").length, "stat-purple", "icon-service"],
    ["Completed", bookings.filter((item) => item.status === "Completed").length, "stat-green", "icon-dashboard"]
  ].map(([label, value, color, icon]) => `<article class="stat-card"><span class="stat-icon ${color}"><span class="nav-icon ${icon}"></span></span><div><p>${label}</p><p>${value}</p></div></article>`).join("");
  const rows = bookings.length ? bookings.map(jobRow).join("") : `<tr><td colspan="6" class="text-center text-slate-500">No assigned jobs yet.</td></tr>`;
  document.getElementById("jobsBody").innerHTML = rows;
  document.getElementById("jobsPageBody").innerHTML = rows;
  document.getElementById("scheduleList").innerHTML = bookings.length ? bookings.map((booking) => `<div class="schedule-row"><strong>${escapeHtml(booking.customer)}</strong><span>${escapeHtml(booking.service)}</span><span>${escapeHtml([booking.scheduleDate, booking.scheduleTime].filter(Boolean).join(" ") || booking.preferredDate)}</span>${statusBadge(booking.status)}</div>`).join("") : `<p class="text-sm text-slate-500">No schedule yet.</p>`;
  document.getElementById("customersBody").innerHTML = customers.length ? customers.map((customer) => `<tr><td>${escapeHtml(customer.name)}</td><td>${escapeHtml(customer.phone)}</td><td>${escapeHtml(customer.email)}</td><td>${escapeHtml(customer.address)}</td></tr>`).join("") : `<tr><td colspan="4" class="text-center text-slate-500">No customers yet.</td></tr>`;
}

function jobRow(booking) {
  return `<tr><td>${booking.id}</td><td>${escapeHtml(booking.customer)}</td><td>${escapeHtml(booking.service)}</td><td>${escapeHtml(booking.address || [booking.scheduleDate, booking.scheduleTime].filter(Boolean).join(" "))}</td><td>${statusBadge(booking.status)}</td><td><select data-job-status="${booking.id}"><option ${booking.status === "Approved" ? "selected" : ""}>Approved</option><option ${booking.status === "In Progress" ? "selected" : ""}>In Progress</option><option ${booking.status === "Completed" ? "selected" : ""}>Completed</option><option ${booking.status === "Unable to Complete" ? "selected" : ""}>Unable to Complete</option></select></td></tr>`;
}
