import { changePassword, getBookings, getCustomers, getMyTechnicianProfile, updateMyTechnicianProfile, updateTechnicianJobStatus } from "./api.js";
import { bindTabs, escapeHtml, fileToDataUrl, isValidPhilippineMobile, logout, requireRole, statusBadge, toast } from "./portal-utils.js";

const session = requireRole("technician");
let bookings = [];
let customers = [];
let profile = null;
const defaultAvatar = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'%3E%3Crect width='120' height='120' fill='%23e2e8f0'/%3E%3Ccircle cx='60' cy='45' r='23' fill='%2394a3b8'/%3E%3Cpath d='M18 116c4-27 20-41 42-41s38 14 42 41' fill='%2394a3b8'/%3E%3C/svg%3E";

if (session) init();

async function init() {
  bindTabs("dashboard");
  document.getElementById("logoutButton").addEventListener("click", logout);
  document.getElementById("profileForm").addEventListener("submit", saveProfile);
  document.getElementById("technicianPasswordForm").addEventListener("submit", savePassword);
  document.getElementById("profileCancel").addEventListener("click", () => renderProfile(profile));
  document.getElementById("profilePhoto").addEventListener("change", previewProfilePhoto);
  document.getElementById("profilePhone").addEventListener("input", () => validateProfilePhone());
  document.body.addEventListener("change", async (event) => {
    if (!event.target.matches("[data-job-status]")) return;
    await updateTechnicianJobStatus(event.target.dataset.jobStatus, event.target.value);
    toast("Job status updated.");
    await loadAll();
  });
  await loadAll();
}

async function loadAll() {
  [bookings, customers, profile] = await Promise.all([getBookings(), getCustomers(), getMyTechnicianProfile()]);
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
  renderProfile(profile);
}

function renderProfile(item) {
  if (!item) return;
  document.getElementById("profileId").value = item.id || "";
  document.getElementById("profileSpecialty").value = item.specialty || "";
  document.getElementById("profileStatus").value = item.status || "";
  document.getElementById("profileName").value = item.name || "";
  document.getElementById("profilePhone").value = item.phoneNumber || "";
  document.getElementById("profileEmail").value = item.email || "";
  document.getElementById("profileAddress").value = item.address || "";
  document.getElementById("profilePhotoPreview").src = item.profilePhoto || defaultAvatar;
  document.getElementById("profilePhoto").value = "";
}

async function previewProfilePhoto(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (!/\.(jpe?g|png)$/i.test(file.name) || file.size > 5 * 1024 * 1024) {
    toast("Choose a JPG, JPEG, or PNG image smaller than 5 MB.");
    event.target.value = "";
    return;
  }
  document.getElementById("profilePhotoPreview").src = await fileToDataUrl(event.target);
}

async function saveProfile(event) {
  event.preventDefault();
  const phoneNumber = document.getElementById("profilePhone").value.trim();
  if (!validateProfilePhone()) return;
  const photoInput = document.getElementById("profilePhoto");
  const payload = {
    name: document.getElementById("profileName").value.trim(),
    phoneNumber,
    email: document.getElementById("profileEmail").value.trim(),
    address: document.getElementById("profileAddress").value.trim(),
    ...(photoInput.files?.[0] ? { profilePhoto: { name: photoInput.files[0].name, data: await fileToDataUrl(photoInput) } } : {})
  };
  try {
    profile = await updateMyTechnicianProfile(payload);
    renderProfile(profile);
    toast("Profile updated successfully.");
  } catch (error) {
    toast(error.message);
  }
}

function validateProfilePhone() { const input = document.getElementById("profilePhone"); input.value = input.value.replace(/\D/g, "").slice(0, 11); const valid = isValidPhilippineMobile(input.value); document.getElementById("profilePhoneError").classList.toggle("hidden", valid || !input.value); input.setCustomValidity(valid ? "" : "Enter a valid 11-digit PH phone number starting with 09."); return valid; }

function jobRow(booking) {
  return `<tr><td>${booking.id}</td><td>${escapeHtml(booking.customer)}</td><td>${escapeHtml(booking.service)}</td><td>${escapeHtml(booking.address || [booking.scheduleDate, booking.scheduleTime].filter(Boolean).join(" "))}</td><td>${statusBadge(booking.status)}</td><td><select data-job-status="${booking.id}"><option ${booking.status === "Approved" ? "selected" : ""}>Approved</option><option ${booking.status === "In Progress" ? "selected" : ""}>In Progress</option><option ${booking.status === "Completed" ? "selected" : ""}>Completed</option><option ${booking.status === "Unable to Complete" ? "selected" : ""}>Unable to Complete</option></select></td></tr>`;
}

async function savePassword(event) { event.preventDefault(); const message = document.getElementById("technicianPasswordMessage"); const next = document.getElementById("technicianNewPassword").value; if (next !== document.getElementById("technicianConfirmPassword").value) { message.textContent = "New passwords do not match."; return; } try { const result = await changePassword({ currentPassword: document.getElementById("technicianCurrentPassword").value, newPassword: next, confirmPassword: document.getElementById("technicianConfirmPassword").value }); message.textContent = result.message; event.target.reset(); } catch (error) { message.textContent = error.message; } }
