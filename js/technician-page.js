import { changePassword, createServicePayment, getBookings, getCustomers, getExcessPipeRates, getMyTechnicianProfile, getSession, setSession, updateMyTechnicianProfile, updateTechnicianJobStatus } from "./api.js";
import { bindTabs, escapeHtml, fileToDataUrl, isValidPhilippineMobile, logout, peso, renderUnitDetailsMarkup, renderUnitPhotosMarkup, requireRole, showTab, statusBadge, toast } from "./portal-utils.js";

const session = requireRole("technician");
const $ = (id) => document.getElementById(id);
let bookings = [];
let customers = [];
let profile = null;
let excessPipeBands = [];
const defaultAvatar = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'%3E%3Crect width='120' height='120' fill='%23e2e8f0'/%3E%3Ccircle cx='60' cy='45' r='23' fill='%2394a3b8'/%3E%3Cpath d='M18 116c4-27 20-41 42-41s38 14 42 41' fill='%2394a3b8'/%3E%3C/svg%3E";

if (session) init();

async function init() {
  bindTabs("dashboard");
  document.getElementById("logoutButton").addEventListener("click", logout);
  document.getElementById("profileForm").addEventListener("submit", saveProfile);
  document.getElementById("technicianPasswordForm").addEventListener("submit", savePassword);
  document.getElementById("profileCancel").addEventListener("click", () => renderProfile(profile));
  document.getElementById("profilePhoto").addEventListener("change", previewProfilePhoto);
  document.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", closeModals));
  document.getElementById("techPaymentForm").addEventListener("submit", saveTechPayment);
  document.getElementById("techCompleteForm").addEventListener("submit", submitTechCompletion);
  ensureProfileCityField();
  document.getElementById("profilePhone").addEventListener("input", () => validateProfilePhone());
  document.body.addEventListener("change", async (event) => {
    if (!event.target.matches("[data-job-status]")) return;
    if (event.target.value === "Unable to Complete") {
      showUnableReasonField(event.target);
      return;
    }
    if (event.target.value === "Completed") {
      openTechCompleteModal(event.target);
      return;
    }
    await saveJobStatus(event.target, event.target.value);
  });
  document.body.addEventListener("click", async (event) => {
    const recordButton = event.target.closest("[data-record-payment]");
    if (recordButton) return openTechPaymentModal(recordButton.dataset.recordPayment);
    const mapButton = event.target.closest("[data-view-map]");
    if (mapButton) return openTechBookingMap(mapButton.dataset.viewMap);
    const saveButton = event.target.closest("[data-save-unable]");
    if (saveButton) {
      const select = saveButton.closest("td").querySelector("[data-job-status]");
      const reason = saveButton.closest("td").querySelector("[data-unable-reason]").value.trim();
      if (!reason) {
        saveButton.closest("td").querySelector("[data-unable-reason]").focus();
        toast("Please provide a reason before saving.");
        return;
      }
      await saveJobStatus(select, "Unable to Complete", reason);
      return;
    }
  });
  await loadAll();
  if (session.user.mustChangePassword) {
    showTab("profile");
    toast("For security, please change your temporary password before continuing.");
  }
}

async function saveJobStatus(select, status, reason = "", charges = {}) {
  try {
    await updateTechnicianJobStatus(select.dataset.jobStatus, status, reason, charges);
    toast("Job status updated.");
    await loadAll();
  } catch (error) {
    toast(error.message);
  }
}

function jobForSelect(select) {
  return bookings.find((item) => String(item.id) === String(select.dataset.jobStatus));
}

function jobNeedsExcessPipe(booking) {
  const service = String(booking?.service || "").toLowerCase();
  return /install|relocat/.test(service);
}

let techCompleteBookingId = null;

function bandContainsHorsePower(label, horsePower) {
  const values = String(label || "").match(/[0-9]+(?:\.[0-9]+)?/g)?.map(Number) || [];
  if (values.length >= 2 && horsePower >= values[0] && horsePower <= values[1]) return true;
  return values.length === 1 && values[0] === horsePower;
}

function bandHorsePower(label) {
  const numericValue = Number(label);
  if (Number.isFinite(numericValue)) return numericValue;
  const firstNumber = String(label || "").match(/[0-9]+(?:\.[0-9]+)?/);
  return firstNumber ? Number(firstNumber[0]) : NaN;
}

function openTechCompleteModal(select) {
  const booking = jobForSelect(select);
  if (!booking) {
    saveJobStatus(select, "Completed");
    return;
  }
  techCompleteBookingId = booking.id;
  $("techCompleteSummary").textContent = `Booking #${booking.id} — ${booking.customer} — ${booking.service}`;
  const showExcessPipe = jobNeedsExcessPipe(booking);
  $("techCompleteExcessField").hidden = !showExcessPipe;
  $("techCompleteExcessField").classList.toggle("hidden", !showExcessPipe);
  const bandSelect = $("techCompleteExcessHPower");
  const labeledBands = excessPipeBands.filter((band) => String(band.hPower || "").trim());
  const units = Array.isArray(booking.units) ? booking.units : [];
  const knownHorsePowers = units.map((unit) => Number(unit?.horsePower)).filter((value) => Number.isFinite(value) && value > 0);
  const visibleBands = knownHorsePowers.length
    ? labeledBands.filter((band) => knownHorsePowers.some((horsePower) => bandContainsHorsePower(band.hPower, horsePower)))
    : labeledBands;
  bandSelect.innerHTML = `<option value="">Select horsepower band</option>${visibleBands.map((band) => `<option value="${escapeHtml(band.hPower)}">${escapeHtml(band.hPower)} — ${peso(band.ratePerFoot)}/ft</option>`).join("")}`;
  bandSelect.value = "";
  // Excess pipe is optional; leave the band unselected until the technician reports feet.
  $("techCompleteExcessFeet").value = "";
  $("techCompleteExtraDesc").value = "";
  $("techCompleteExtraCost").value = "";
  const suggested = Number(booking.finalAmount ?? booking.totalAmount);
  $("techCompleteAmountPaid").value = Number.isFinite(suggested) && suggested > 0 ? suggested.toFixed(2) : "";
  $("techCompleteDiscount").value = "0";
  openModal("techCompleteModal");
}

async function submitTechCompletion(event) {
  event.preventDefault();
  const booking = bookings.find((item) => String(item.id) === String(techCompleteBookingId));
  if (!booking) {
    closeModals();
    return;
  }
  const charges = {};
  const excessFieldVisible = !$("techCompleteExcessField").classList.contains("hidden");
  if (excessFieldVisible && $("techCompleteExcessFeet").value.trim() !== "") {
    const feet = Number($("techCompleteExcessFeet").value.trim());
    if (!Number.isInteger(feet) || feet <= 0) {
      $("techCompleteExcessFeet").focus();
      toast("Excess pipe length must be a positive whole number, or leave it blank.");
      return;
    }
    const selectedBand = $("techCompleteExcessHPower").value.trim();
    if (!selectedBand) {
      $("techCompleteExcessHPower").focus();
      toast("Select the horsepower band for the excess pipe.");
      return;
    }
    charges.excessPipeFeet = feet;
    charges.excessPipeHPower = selectedBand;
  }
  const description = $("techCompleteExtraDesc").value.trim();
  const rawCost = $("techCompleteExtraCost").value.trim();
  let additionalCost = 0;
  if (rawCost !== "") {
    additionalCost = Number(rawCost);
    if (!Number.isFinite(additionalCost) || additionalCost < 0) {
      $("techCompleteExtraCost").focus();
      toast("Additional cost must be zero or a positive number.");
      return;
    }
  }
  if (description && additionalCost <= 0 && !charges.excessPipeFeet) {
    $("techCompleteExtraDesc").focus();
    toast("Enter the additional cost for the described work, or leave both blank.");
    return;
  }
  if (description) charges.additionalDescription = description;
  if (additionalCost > 0) charges.additionalCost = additionalCost;
  const rawAmount = $("techCompleteAmountPaid").value.trim();
  let amountPaid = 0;
  if (rawAmount !== "") {
    amountPaid = Number(rawAmount);
    if (!Number.isFinite(amountPaid) || amountPaid < 0) {
      $("techCompleteAmountPaid").focus();
      toast("Amount paid must be zero or a positive number.");
      return;
    }
  }
  const discount = Number($("techCompleteDiscount").value || 0);
  if (!Number.isFinite(discount) || discount < 0) {
    $("techCompleteDiscount").focus();
    toast("Discount must be zero or a positive number.");
    return;
  }
  if (amountPaid > 0) {
    charges.amountPaid = amountPaid;
    charges.discount = discount;
  }
  try {
    await updateTechnicianJobStatus(booking.id, "Completed", "", charges);
  } catch (error) {
    toast(error.message);
    return;
  }
  if (charges.excessPipeFeet > 0 || charges.additionalCost > 0 || amountPaid > 0) {
    closeModals();
    toast("Job completed. The technician payment or extra charges are pending admin approval.");
    await loadAll();
    return;
  }
  closeModals();
  toast("Job completed.");
  await loadAll();
}

function showUnableReasonField(select) {
  const cell = select.closest("td");
  if (cell.querySelector("[data-unable-reason]")) return;
  const wrapper = document.createElement("div");
  wrapper.className = "job-reason-editor";
  wrapper.innerHTML = `<input data-unable-reason type="text" maxlength="500" placeholder="Reason required" aria-label="Reason this job cannot be completed" /><button type="button" class="tiny-button warning-button" data-save-unable>Save</button>`;
  cell.append(wrapper);
  wrapper.querySelector("[data-unable-reason]").focus();
}

async function loadAll() {
  [bookings, customers, profile] = await Promise.all([getBookings(), getCustomers(), getMyTechnicianProfile()]);
  bookings = bookings.filter((booking) => booking.technician);
  try {
    excessPipeBands = await getExcessPipeRates();
  } catch {
    excessPipeBands = [];
  }
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
  document.getElementById("scheduleList").innerHTML = bookings.length ? bookings.map((booking) => `<div class="schedule-row"><strong>${escapeHtml(booking.customer)}</strong><span>${escapeHtml(booking.service)}</span><span>${escapeHtml([booking.scheduleDate, booking.scheduleTime].filter(Boolean).join(" ") || booking.preferredDate)}</span><span>${escapeHtml(booking.address || "Address not provided")} <button type="button" class="tiny-button secondary-button" data-view-map="${booking.id}">Map</button></span><span class="schedule-status">${statusBadge(booking.status)}${booking.status === "Unable to Complete" && booking.unableToCompleteReason ? `<small class="job-reason">Reason: ${escapeHtml(booking.unableToCompleteReason)}</small>` : ""}</span></div>`).join("") : `<p class="text-sm text-slate-500">No schedule yet.</p>`;
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
  document.getElementById("profileCity").value = item.city || inferServiceAreaCity(item.address);
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
    city: document.getElementById("profileCity").value,
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

function ensureProfileCityField() { const field = document.createElement("label"); field.className = "form-field"; field.innerHTML = `<span>Service area city</span><select id="profileCity" required><option value="">Select city/municipality</option>${["San Fernando", "Naga", "Minglanilla", "Talisay City", "Cebu City", "Mandaue City", "Consolacion", "Liloan", "Compostela", "Danao City"].map((city) => `<option>${city}</option>`).join("")}</select>`; document.getElementById("profileAddress").closest("label").before(field); }
function inferServiceAreaCity(address) { const value = String(address || "").toLowerCase(); return ["San Fernando", "Naga", "Minglanilla", "Talisay City", "Cebu City", "Mandaue City", "Consolacion", "Liloan", "Compostela", "Danao City"].find((city) => value.includes(city.toLowerCase())) || ""; }

function jobRow(booking) {
  const canRecordPayment = booking.status === "Completed" && !booking.paymentId && booking.chargeStatus !== "Pending";
  return `<tr><td>${booking.id}</td><td>${escapeHtml(booking.customer)}</td><td>${escapeHtml(booking.service)}${renderUnitDetailsMarkup(booking.units)}${renderUnitPhotosMarkup(booking.units)}</td><td>${escapeHtml(booking.address || [booking.scheduleDate, booking.scheduleTime].filter(Boolean).join(" "))}<br /><button type="button" class="tiny-button secondary-button" data-view-map="${booking.id}">View on map</button></td><td>${statusBadge(booking.status)}${booking.status === "Unable to Complete" && booking.unableToCompleteReason ? `<small class="job-reason">Reason: ${escapeHtml(booking.unableToCompleteReason)}</small>` : ""}${booking.chargeStatus === "Pending" ? `<small class="job-reason">Charges submitted — awaiting admin approval (${peso(booking.chargeProposedTotal)})</small><small class="job-reason">Payment can't be recorded until charges are approved.</small>` : ""}${booking.chargeStatus === "Approved" ? `<small class="job-reason">Charges approved</small>` : ""}${booking.chargeStatus === "Rejected" ? `<small class="job-reason">Extra charges rejected — final amount is the booked estimate</small>` : ""}${canRecordPayment ? `<button type="button" class="tiny-button secondary-button" data-record-payment="${booking.id}">Record Payment</button>` : ""}${booking.paymentId ? `<small class="job-reason">Payment recorded</small>` : ""}</td><td><select data-job-status="${booking.id}"><option ${booking.status === "Scheduled" ? "selected" : ""}>Scheduled</option><option ${booking.status === "In Progress" ? "selected" : ""}>In Progress</option><option ${booking.status === "Completed" ? "selected" : ""}>Completed</option><option ${booking.status === "Unable to Complete" ? "selected" : ""}>Unable to Complete</option></select></td></tr>`;
}

let techPaymentBookingId = null;
let techBookingMap = null;

function openTechPaymentModal(id) {
  const booking = bookings.find((item) => String(item.id) === String(id));
  if (!booking) return;
  techPaymentBookingId = booking.id;
  $("techPaymentBookingLabel").textContent = `Booking #${booking.id} — ${booking.customer} — ${booking.service}`;
  const suggested = Number(booking.finalAmount ?? booking.totalAmount);
  $("techPaymentAmount").value = Number.isFinite(suggested) && suggested > 0 ? suggested.toFixed(2) : "";
  $("techPaymentDiscount").value = "0";
  openModal("techPaymentModal");
}

async function saveTechPayment(event) {
  event.preventDefault();
  if (techPaymentBookingId == null) return;
  const amountPaid = Number($("techPaymentAmount").value);
  const discount = Number($("techPaymentDiscount").value || 0);
  if (!Number.isFinite(amountPaid) || amountPaid <= 0) return toast("Amount paid must be a positive number.");
  if (!Number.isFinite(discount) || discount < 0) return toast("Discount must be zero or a positive number.");
  try {
    await createServicePayment({ requestId: techPaymentBookingId, amountPaid, discount });
    closeModals();
    toast("Payment recorded.");
    await loadAll();
  } catch (error) {
    toast(error.message);
  }
}

function openTechBookingMap(id) {
  const booking = bookings.find((item) => String(item.id) === String(id));
  if (!booking) return;
  const container = $("techBookingMap");
  const addressText = $("techMapModalAddress");
  if (techBookingMap) { techBookingMap.remove(); techBookingMap = null; }
  if (booking.latitude == null || booking.longitude == null) {
    container.classList.add("hidden");
    addressText.textContent = "Location not available";
    openModal("techMapModal");
    return;
  }
  addressText.textContent = booking.address || "No address text provided.";
  openModal("techMapModal");
  requestAnimationFrame(() => {
    techBookingMap = L.map("techBookingMap").setView([Number(booking.latitude), Number(booking.longitude)], 16);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "&copy; OpenStreetMap contributors" }).addTo(techBookingMap);
    L.marker([Number(booking.latitude), Number(booking.longitude)], { draggable: false }).addTo(techBookingMap);
    setTimeout(() => techBookingMap?.invalidateSize(), 150);
  });
}

function openModal(id) {
  document.getElementById(id).classList.remove("hidden");
}

function closeModals() {
  document.querySelectorAll(".modal").forEach((modal) => modal.classList.add("hidden"));
  document.querySelectorAll(".modal form").forEach((form) => form.reset());
}

async function savePassword(event) { event.preventDefault(); const message = document.getElementById("technicianPasswordMessage"); const next = document.getElementById("technicianNewPassword").value; if (next !== document.getElementById("technicianConfirmPassword").value) { message.textContent = "New passwords do not match."; return; } try { const result = await changePassword({ currentPassword: document.getElementById("technicianCurrentPassword").value, newPassword: next, confirmPassword: document.getElementById("technicianConfirmPassword").value }); const current = getSession(); if (current?.user) { current.user.mustChangePassword = false; setSession(current); } message.textContent = result.message; event.target.reset(); } catch (error) { message.textContent = error.message; } }
