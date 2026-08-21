import {
  approveJobCharge,
  createCustomer,
  createProduct,
  createSchedule,
  createService,
  createServicePriceTier,
  createTechnician,
  createExcessPipeRateTier,
  getBookings,
  getBrands,
  getExcessPipeRates,
  getProductServices,
  getCustomers,
  getLogs,
  getProducts,
  getServicePayments,
  getServices,
  getTechnicians,
  rejectJobCharge,
  removeBooking,
  removeCustomer,
  removeProduct,
  removeService,
  removeServicePriceTier,
  removeTechnician,
  removeExcessPipeRateTier,
  updateBookingStatus,
  updateCustomer,
  updateProduct,
  updateService,
  updateServicePriceTier,
  updateTechnician,
  updateExcessPipeRateTier
} from "./api.js";
import { bindTabs, escapeHtml, fileToDataUrl, isValidPhilippineMobile, logout, peso, renderProducts, renderUnitDetailsMarkup, renderUnitPhotosMarkup, requireRole, statusBadge, toast } from "./portal-utils.js";

const session = requireRole("admin");
let services = [];
let products = [];
let technicians = [];
let customers = [];
let bookings = [];
let logs = [];
let brands = [];
let productLines = [];
let productServices = [];
let payments = [];

const $ = (id) => document.getElementById(id);

if (session) init();

async function init() {
  bindTabs("dashboard");
  document.getElementById("logoutButton").addEventListener("click", logout);
  document.body.addEventListener("click", handleClick);
  document.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", closeModals));
  document.getElementById("serviceForm").addEventListener("submit", saveService);
  document.getElementById("productForm").addEventListener("submit", saveProduct);
  $("productBrand").addEventListener("change", loadProductLines);
  document.getElementById("technicianForm").addEventListener("submit", saveTechnician);
  document.getElementById("customerForm").addEventListener("submit", saveCustomer);
  document.getElementById("customerSearch").addEventListener("input", renderCustomers);
  document.getElementById("scheduleForm").addEventListener("submit", saveSchedule);
  document.getElementById("scheduleBooking").addEventListener("change", updateScheduleSelection);
  ensureAdminCityFields();
  await loadAll();
}

async function loadAll() {
  const settle = async (label, fn) => {
    try { return await fn(); } catch (error) { console.error(`Failed to load ${label}:`, error); return null; }
  };
  const [s, p, t, c, b, l, br, pay] = await Promise.all([
    settle("services", getServices),
    settle("products", getProducts),
    settle("technicians", getTechnicians),
    settle("customers", getCustomers),
    settle("bookings", getBookings),
    settle("logs", getLogs),
    settle("brands", getBrands),
    settle("payments", getServicePayments)
  ]);
  if (s) services = s;
  if (p) products = p;
  if (t) technicians = t;
  if (c) customers = c;
  if (b) bookings = b;
  if (l) logs = l;
  if (br) brands = br;
  if (pay) payments = pay;
  render();
}

function render() {
  renderPendingCharges();
  renderStats();
  renderBookings();
  renderServices();
  renderProducts(products, { admin: true });
  renderTechnicians();
  renderCustomers();
  renderSchedules();
  renderLogs();
  renderPayments();
  renderAssignmentPreview();
  renderBookingMonitor();
}

function renderStats() {
  const stats = [
    ["Total Bookings", bookings.length, "stat-blue", "icon-bookings", "View all bookings"],
    ["Pending Requests", bookings.filter((item) => item.status === "Pending").length, "stat-orange", "icon-schedule", "Review requests"],
    ["Technicians", technicians.length, "stat-green", "icon-tech", "Manage technicians"],
    ["Services", services.length, "stat-blue", "icon-service", "Manage services"]
  ];
  document.getElementById("statsGrid").innerHTML = stats.map(([label, value, color, icon, link]) => `
    <article class="stat-card">
      <span class="stat-icon ${color}"><span class="nav-icon ${icon}"></span></span>
      <div>
        <p>${label}</p>
        <p>${value}</p>
        <span class="stat-link">${link}</span>
      </div>
    </article>
  `).join("");
}

function bookingRows(items) {
  return items.length
    ? items.map((booking) => { const canReviewBooking = booking.status === "Pending"; return `<tr><td>${booking.id}</td><td>${escapeHtml(booking.customer)}</td><td>${escapeHtml(booking.service)}${renderUnitDetailsMarkup(booking.units)}${renderUnitPhotosMarkup(booking.units)}</td><td class="pre-line">${escapeHtml(booking.address || "—")}</td><td>${escapeHtml([booking.preferredDate, booking.preferredTime].filter(Boolean).join(" "))}</td><td>${escapeHtml(booking.technician || "Unassigned")}</td><td>${statusBadge(booking.status)}${booking.status === "Unable to Complete" && booking.unableToCompleteReason ? `<small class="job-reason">Reason: ${escapeHtml(booking.unableToCompleteReason)}</small>` : ""}${booking.chargeStatus === "Pending" ? `<small class="job-reason">Charges pending approval — proposed total ${peso(booking.chargeProposedTotal)}</small>` : ""}${booking.status === "Completed" && booking.chargeStatus !== "Pending" ? `<small class="job-reason">Final amount: ${peso(booking.finalAmount ?? booking.totalAmount)}</small>` : ""}</td><td>${canReviewBooking ? `<button class="tiny-button success-button" data-approve="${booking.id}">Approve</button><button class="tiny-button warning-button" data-reject="${booking.id}">Reject</button>` : ""}<button class="tiny-button secondary-button" data-view-map="${booking.id}">View on map</button></td></tr>`; }).join("")
    : `<tr><td colspan="8" class="text-center text-slate-500">No bookings yet.</td></tr>`;
}

function renderBookings() {
  document.getElementById("bookingsBody").innerHTML = bookingRows(bookings);
  document.getElementById("recentBookingsBody").innerHTML = bookingRows(bookings.slice(0, 5));
}

function renderServices() {
  document.getElementById("servicesBody").innerHTML = services.length
    ? services.map((service) => `<tr><td>${service.id}</td><td>${escapeHtml(service.type || "Uncategorized")}</td><td>${escapeHtml(service.name)}</td><td>${peso(service.price)}</td><td>${escapeHtml(service.inclusion)}</td><td>${escapeHtml(service.exclusion)}</td><td><button class="tiny-button secondary-button" data-edit-service="${service.id}">Edit</button><button class="tiny-button danger-button" data-delete-service="${service.id}">Delete</button></td></tr>`).join("")
    : `<tr><td colspan="7" class="text-center text-slate-500">No services yet.</td></tr>`;
  document.getElementById("dashboardServicesBody").innerHTML = services.length
    ? services.slice(0, 4).map((service) => `<tr><td>${escapeHtml(`${service.type || "Uncategorized"} — ${service.name}`)}</td><td>${escapeHtml(service.inclusion)}</td><td><button class="tiny-button secondary-button" data-edit-service="${service.id}">Edit</button></td></tr>`).join("")
    : `<tr><td colspan="3" class="text-center text-slate-500">No services yet.</td></tr>`;
}

function renderTechnicians() {
  document.getElementById("techniciansBody").innerHTML = technicians.length
    ? technicians.map((tech) => `<tr><td>${tech.id}</td><td>${escapeHtml(tech.name)}</td><td>${escapeHtml(tech.phoneNumber)}</td><td>${escapeHtml(tech.email)}</td><td>${escapeHtml(tech.specialty)}</td><td>${statusBadge(tech.status)}</td><td><button class="tiny-button secondary-button" data-edit-technician="${tech.id}">Edit</button><button class="tiny-button danger-button" data-delete-technician="${tech.id}">Delete</button></td></tr>`).join("")
    : `<tr><td colspan="7" class="text-center text-slate-500">No technicians yet.</td></tr>`;
}

function renderCustomers() {
  const query = $("customerSearch")?.value.trim().toLowerCase() || "";
  const filtered = customers.filter((customer) => [customer.name, customer.email, customer.phone].some((value) => String(value || "").toLowerCase().includes(query)));
  document.getElementById("customersBody").innerHTML = filtered.length
    ? filtered.map((customer) => `<tr><td>${customer.id}</td><td>${escapeHtml(customer.name)}</td><td>${escapeHtml(customer.phone)}</td><td>${escapeHtml(customer.email)}</td><td class="pre-line">${escapeHtml(customer.address)}</td><td><button class="tiny-button secondary-button" data-history-customer="${customer.id}">View History</button><button class="tiny-button secondary-button" data-edit-customer="${customer.id}">Edit</button><button class="tiny-button danger-button" data-delete-customer="${customer.id}">Delete</button></td></tr>`).join("")
    : `<tr><td colspan="6" class="text-center text-slate-500">No customers yet.</td></tr>`;
}

function renderSchedules() {
  const approvedBookings = bookings.filter((booking) => booking.status === "Approved");
  document.getElementById("scheduleBooking").innerHTML = approvedBookings.length
    ? approvedBookings.map((booking) => `<option value="${booking.id}">${booking.id} - ${escapeHtml(booking.customer)} - ${escapeHtml(booking.service)}</option>`).join("")
    : `<option value="">No approved bookings awaiting assignment</option>`;
  updateScheduleSelection();
}

function selectedScheduleBooking() {
  return bookings.find((booking) => String(booking.id) === String($("scheduleBooking").value));
}

function slotForBooking(booking) {
  return { date: booking?.preferredDate || booking?.scheduleDate || "", time: booking?.preferredTime || booking?.scheduleTime || "" };
}

function timeRange(time) {
  const parseTime = (value) => {
    const match = String(value || "").trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
    if (!match) return null;
    let hours = Number(match[1]);
    const minutes = Number(match[2] || 0);
    if (hours === 12) hours = 0;
    if (match[3].toUpperCase() === "PM") hours += 12;
    return hours * 60 + minutes;
  };
  const values = String(time || "").split(/\s*(?:–|—|-)\s*/).map(parseTime);
  return values.length === 2 && values.every(Number.isFinite) ? values : null;
}

function slotsOverlap(firstTime, secondTime) {
  const first = timeRange(firstTime);
  const second = timeRange(secondTime);
  return first && second ? first[0] < second[1] && second[0] < first[1] : firstTime === secondTime;
}

function technicianConflict(technician, booking) {
  const requested = slotForBooking(booking);
  return bookings.some((item) => String(item.id) !== String(booking?.id)
    && String(item.technician || "").trim().toLowerCase() === String(technician.name || "").trim().toLowerCase()
    && slotForBooking(item).date === requested.date
    && slotsOverlap(slotForBooking(item).time, requested.time));
}

function technicianSkillMatch(technician, booking) {
  const service = String(booking?.service || "").toLowerCase();
  const specialty = String(technician?.specialty || "").toLowerCase();
  if (!specialty) return false;
  if (service.includes("install")) return specialty.includes("install");
  if (service.includes("repair") || service.includes("clean")) return specialty.includes("repair");
  if (service.includes("relocat")) return specialty.includes("relocat");
  return true;
}

function updateScheduleSelection() {
  const booking = selectedScheduleBooking();
  const requested = slotForBooking(booking);
  $("scheduleRequestedDate").textContent = requested.date || "No date submitted";
  $("scheduleRequestedTime").textContent = requested.time || "No time slot submitted";
  $("scheduleServiceHint").textContent = booking ? `${booking.service} · Date and time are taken from the customer's request.` : "The customer's preferred date and time are read-only.";
  const activeTechs = technicians.filter((tech) => tech.status === "Active");
  if (!booking) {
    $("scheduleTechnician").innerHTML = `<option value="">Select an approved booking first</option>`;
    $("scheduleTechnician").disabled = true;
    $("scheduleTechnicianHint").textContent = "Approve a booking before assigning a technician.";
    return;
  }
  $("scheduleTechnician").disabled = false;
  $("scheduleTechnician").innerHTML = activeTechs.map((tech) => {
    const conflict = technicianConflict(tech, booking);
    const skillMatch = technicianSkillMatch(tech, booking);
    const note = conflict ? " — Unavailable (already assigned)" : (!skillMatch ? " — Skill mismatch" : "");
    return `<option value="${tech.id}" ${conflict ? "disabled" : ""}>${escapeHtml(tech.name)} · ${escapeHtml(tech.specialty || "No fields")}${note}</option>`;
  }).join("");
  const available = activeTechs.find((tech) => !technicianConflict(tech, booking));
  if (available) $("scheduleTechnician").value = String(available.id);
  $("scheduleTechnicianHint").textContent = activeTechs.some((tech) => !technicianConflict(tech, booking)) ? "Unavailable technicians are disabled. Skill mismatches remain selectable for admin review." : "No active technician is available for this requested slot.";
}

function renderLogs() {
  document.getElementById("logsBody").innerHTML = logs.length
    ? logs.map((log) => `<tr><td>${new Date(log.createdAt).toLocaleString()}</td><td>${escapeHtml(log.actor)}</td><td>${escapeHtml(log.action)}</td><td>${escapeHtml([log.targetType, log.targetId].filter(Boolean).join(" #"))}</td></tr>`).join("")
    : `<tr><td colspan="4" class="text-center text-slate-500">No logs yet.</td></tr>`;
}

function renderPendingCharges() {
  const pending = bookings.filter((booking) => booking.chargeStatus === "Pending");
  $("pendingChargesBody").innerHTML = pending.length
    ? pending.map((booking) => `<tr><td>#${booking.id}</td><td>${escapeHtml(booking.customer)}</td><td>${escapeHtml(booking.service)}</td><td>${peso(booking.chargeProposedTotal)}</td><td>${escapeHtml(booking.technician || "Unassigned")}</td><td><button class="tiny-button secondary-button" data-review-charges="${booking.chargeId}">Review Charges</button></td></tr>`).join("")
    : `<tr><td colspan="6" class="text-center text-slate-500">No pending technician charges.</td></tr>`;
}

function renderPayments() {
  document.getElementById("paymentsBody").innerHTML = payments.length
    ? payments.map((payment) => `<tr><td>#${payment.requestId}</td><td>${escapeHtml(payment.customer)}</td><td>${escapeHtml(payment.service)}</td><td>${peso(payment.amountPaid)}</td><td>${peso(payment.discount)}</td><td>${escapeHtml(payment.receivedBy)}</td><td>${escapeHtml(payment.assignedTechnician || "Unassigned")}</td><td>${new Date(payment.date).toLocaleString()}</td><td>${escapeHtml(payment.referenceNo)}</td></tr>`).join("")
    : `<tr><td colspan="9" class="text-center text-slate-500">No payments recorded yet.</td></tr>`;
}

function renderAssignmentPreview() {
  const pending = bookings.filter((booking) => !booking.technician).slice(0, 3);
  document.getElementById("assignmentPreview").innerHTML = pending.length
    ? pending.map((booking) => `<div class="preview-item"><strong>${escapeHtml(booking.id)} - ${escapeHtml(booking.customer)}</strong><span>${escapeHtml(booking.service)}</span></div>`).join("")
    : `<p class="empty-note">No unassigned bookings.</p>`;
}

function renderBookingMonitor() {
  const statuses = ["Pending", "Approved", "Scheduled", "In Progress", "Completed"];
  const total = Math.max(bookings.length, 1);
  document.getElementById("bookingMonitor").innerHTML = statuses
    .map((status) => {
      const count = bookings.filter((booking) => booking.status === status).length;
      const percent = Math.round((count / total) * 1000) / 10;
      return `<div class="monitor-row">${statusBadge(status)}<strong>${count}</strong><span>${percent}%</span></div>`;
    })
    .join("") + `<div class="monitor-total"><span>Total Bookings</span><strong>${bookings.length}</strong></div>`;
}

let excessPipeTiersLoaded = false;
let excessPipeTiers = [];

function getPricingStatus() {
  return $("pricingSettingsStatus");
}

function setPricingStatus(html, type) {
  const el = getPricingStatus();
  if (!el) return;
  el.innerHTML = html;
  el.className = "pricing-settings-status" + (type ? ` pricing-settings-status--${type}` : "");
}

function clearPricingStatus() {
  const el = getPricingStatus();
  if (el) { el.innerHTML = ""; el.className = "pricing-settings-status"; }
}

async function loadExcessPipeRate() {
  clearPricingStatus();
  try {
    excessPipeTiers = await getExcessPipeRates();
    excessPipeTiersLoaded = true;
    renderExcessPipeTiers();
    clearPricingStatus();
  } catch (error) {
    console.error("loadExcessPipeRate failed:", error);
    const detail = error.status ? `${error.message} (HTTP ${error.status})` : error.message;
    renderExcessPipeTiers();
    setPricingStatus(`Could not load excess pipe bands: ${detail} <button type="button" class="tiny-button secondary-button" data-reload-excess-pipe-rate="true">Retry</button>`, "error");
  }
}

function renderExcessPipeTiers() {
  const list = $("excessPipeTiersList");
  if (!list) return;
  list.innerHTML = excessPipeTiers.length
    ? excessPipeTiers.map((tier) => `<div class="grid grid-cols-1 items-center gap-2 rounded-lg border border-slate-200 p-2 md:grid-cols-[1fr_1fr_auto_auto]"><input id="excessTierHPower-${tier.id}" value="${escapeHtml(tier.hPower || "")}" placeholder="HPower band" /><input id="excessTierAmount-${tier.id}" type="number" min="0.01" step="0.01" value="${escapeHtml(tier.ratePerFoot ?? "")}" placeholder="Rate per foot" /><button type="button" class="tiny-button secondary-button" data-save-excess-pipe-tier="${tier.id}">Save</button><button type="button" class="tiny-button danger-button" data-delete-excess-pipe-tier="${tier.id}">Delete</button></div>`).join("")
    : `<p class="empty-note">No excess pipe bands yet.</p>`;
  $("newExcessTierHPower").value = "";
  $("newExcessTierAmount").value = "";
}

function readExcessTierPayload(hPower, ratePerFoot) {
  const payload = { hPower: hPower.trim(), ratePerFoot: ratePerFoot.trim() };
  if (!payload.hPower) { toast("Horsepower band label is required."); return null; }
  if (!payload.ratePerFoot || !Number.isFinite(Number(payload.ratePerFoot)) || Number(payload.ratePerFoot) <= 0) { toast("Rate per foot must be a positive number."); return null; }
  return payload;
}

async function addExcessPipeTier() {
  const payload = readExcessTierPayload($("newExcessTierHPower").value, $("newExcessTierAmount").value);
  if (!payload) return;
  try {
    const tier = await createExcessPipeRateTier(payload);
    excessPipeTiers = [...excessPipeTiers, tier];
    renderExcessPipeTiers();
    toast("Excess pipe band added.");
  } catch (error) { toast(error.message); }
}

async function saveExcessPipeTier(tierId) {
  const payload = readExcessTierPayload($(`excessTierHPower-${tierId}`).value, $(`excessTierAmount-${tierId}`).value);
  if (!payload) return;
  try {
    const tier = await updateExcessPipeRateTier(tierId, payload);
    excessPipeTiers = excessPipeTiers.map((item) => String(item.id) === String(tierId) ? tier : item);
    renderExcessPipeTiers();
    toast("Excess pipe band updated.");
  } catch (error) { toast(error.message); }
}

async function deleteExcessPipeTier(tierId) {
  if (!confirm("Delete this excess pipe band?")) return;
  try {
    await removeExcessPipeRateTier(tierId);
    excessPipeTiers = excessPipeTiers.filter((item) => String(item.id) !== String(tierId));
    renderExcessPipeTiers();
    toast("Excess pipe band deleted.");
  } catch (error) { toast(error.message); }
}

function togglePricingSettings() {
  const body = $("pricingSettingsBody");
  const card = $("pricingSettingsCard");
  if (!body || !card) return;
  const isHidden = body.classList.contains("hidden");
  body.classList.toggle("hidden");
  card.classList.toggle("open");
  if (isHidden && !excessPipeTiersLoaded) loadExcessPipeRate();
}

async function handleClick(event) {
  const button = event.target.closest("button");
  if (!button) return;
  if (button.dataset.open) { if (button.dataset.open === "productModal") prepareProductForm(); return openModal(button.dataset.open); }
  if (button.dataset.approve) return changeBooking(button.dataset.approve, "Approved");
  if (button.dataset.reject) return changeBooking(button.dataset.reject, "Rejected");
  if (button.dataset.viewMap) return openBookingMap(button.dataset.viewMap);
  if (button.dataset.reviewCharges) return openChargeModal(button.dataset.reviewCharges);
  if (button.dataset.approveCharge) return reviewCharge(button.dataset.approveCharge, "approve");
  if (button.dataset.rejectCharge) return reviewCharge(button.dataset.rejectCharge, "reject");
  if (button.dataset.deleteService) return deleteRecord("service", button.dataset.deleteService);
  if (button.dataset.deleteProduct) return deleteRecord("product", button.dataset.deleteProduct);
  if (button.dataset.deleteTechnician) return deleteRecord("technician", button.dataset.deleteTechnician);
  if (button.dataset.deleteCustomer) return deleteRecord("customer", button.dataset.deleteCustomer);
  if (button.dataset.addPriceTier) return addPriceTier();
  if (button.dataset.savePriceTier) return savePriceTier(button.dataset.savePriceTier);
  if (button.dataset.deletePriceTier) return deletePriceTier(button.dataset.deletePriceTier);
  if (button.dataset.editService) return fillService(button.dataset.editService);
  if (button.dataset.editProduct) return fillProduct(button.dataset.editProduct);
  if (button.dataset.editTechnician) return fillTechnician(button.dataset.editTechnician);
  if (button.dataset.editCustomer) return fillCustomer(button.dataset.editCustomer);
  if (button.dataset.historyCustomer) return showHistory(button.dataset.historyCustomer);
  if (button.dataset.addExcessPipeTier) return addExcessPipeTier();
  if (button.dataset.saveExcessPipeTier) return saveExcessPipeTier(button.dataset.saveExcessPipeTier);
  if (button.dataset.deleteExcessPipeTier) return deleteExcessPipeTier(button.dataset.deleteExcessPipeTier);
  if (button.dataset.reloadExcessPipeRate) { excessPipeTiersLoaded = false; return loadExcessPipeRate(); }
  if (button.dataset.togglePricingSettings) return togglePricingSettings();
}

function showHistory(id) { const customer = customers.find((item) => String(item.id) === String(id)); const items = bookings.filter((booking) => booking.status === "Completed" && String(booking.customer).trim().toLowerCase() === String(customer?.name || "").trim().toLowerCase()); $("historyTitle").textContent = `${customer?.name || "Customer"} — Service History`; $("historyBody").innerHTML = items.length ? items.map((booking) => { const total = booking.finalAmount ?? booking.totalAmount; const paymentRecord = payments.find((payment) => String(payment.requestId) === String(booking.id)); const paidNote = booking.paymentId ? `<span>Paid ${peso(booking.amountPaid)}${booking.referenceNo ? ` · Ref ${escapeHtml(booking.referenceNo)}` : ""}${paymentRecord?.receivedBy ? ` · by ${escapeHtml(paymentRecord.receivedBy)}` : ""}</span>` : ""; const pendingNote = booking.chargeStatus === "Pending" ? `<span>Charges under review</span>` : ""; return `<article class="history-entry"><strong>${escapeHtml(booking.service)}</strong><span>${escapeHtml(booking.preferredDate || booking.scheduleDate || "Date not set")} · ${escapeHtml(booking.preferredTime || booking.scheduleTime || "Time not set")}</span>${pendingNote}${paidNote}<b>${peso(total)}</b></article>`; }).join("") : `<p class="empty-note">No completed services found.</p>`; $("historyModal").classList.remove("hidden"); }

async function changeBooking(id, status) {
  await updateBookingStatus(id, status);
  toast(`Booking ${id} marked ${status}.`);
  await loadAll();
}

let adminBookingMap = null;

function openBookingMap(id) {
  const booking = bookings.find((item) => String(item.id) === String(id));
  if (!booking) return;
  const container = $("adminBookingMap");
  const addressText = $("mapModalAddress");
  if (adminBookingMap) { adminBookingMap.remove(); adminBookingMap = null; }
  if (booking.latitude == null || booking.longitude == null) {
    container.classList.add("hidden");
    addressText.textContent = "Location not available";
    openModal("mapModal");
    return;
  }
  addressText.textContent = booking.address || "No address text provided.";
  openModal("mapModal");
  requestAnimationFrame(() => {
    adminBookingMap = L.map("adminBookingMap").setView([Number(booking.latitude), Number(booking.longitude)], 16);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "&copy; OpenStreetMap contributors" }).addTo(adminBookingMap);
    L.marker([Number(booking.latitude), Number(booking.longitude)], { draggable: false }).addTo(adminBookingMap);
    setTimeout(() => adminBookingMap?.invalidateSize(), 150);
  });
}

function openChargeModal(chargeId) {
  const booking = bookings.find((item) => String(item.chargeId) === String(chargeId));
  if (!booking) return;
  const items = [];
  if (Number(booking.chargeExcessFeet) > 0) items.push(`<li>Excess pipe: ${booking.chargeExcessFeet} ft — <b>${peso(booking.chargeExcessCost)}</b></li>`);
  if (booking.chargeAdditionalDescription || Number(booking.chargeAdditionalCost) > 0) items.push(`<li>Additional work: ${escapeHtml(booking.chargeAdditionalDescription || "—")}${Number(booking.chargeAdditionalCost) > 0 ? ` — <b>${peso(booking.chargeAdditionalCost)}</b>` : ""}</li>`);
  $("chargeBookingLabel").textContent = `Booking #${booking.id} — ${booking.customer} — ${booking.service}`;
  $("chargeDetails").innerHTML = `${items.length ? `<ul>${items.join("")}</ul>` : `<p class="empty-note">No itemized charges were submitted.</p>`}<p><strong>Booked estimate:</strong> ${peso(booking.totalAmount)}</p><p><strong>Proposed total:</strong> ${peso(booking.chargeProposedTotal)}</p>${booking.chargeProposedAmountPaid != null ? `<p><strong>Technician's proposed payment:</strong> ${peso(booking.chargeProposedAmountPaid)}${Number(booking.chargeProposedDiscount) > 0 ? ` · discount ${peso(booking.chargeProposedDiscount)}` : ""}</p><p class="form-note">Approving will record the payment amount entered below.</p>` : `<p class="form-note">The technician did not propose a payment amount. Enter a payment amount below if the technician collected one.</p>`}<p class="form-note">Approving sets this booking's final amount to the proposed total. Rejecting keeps the original booked estimate as the final amount.</p>`;
  $("chargeDetails").insertAdjacentHTML("beforeend", `<div class="form-grid"><label class="form-field"><span>Payment amount to record (optional)</span><input id="chargePaymentAmount" type="number" min="0.01" step="0.01" value="${booking.chargeProposedAmountPaid != null ? Number(booking.chargeProposedAmountPaid).toFixed(2) : ""}" placeholder="Leave blank if no payment was collected" /></label><label class="form-field"><span>Discount</span><input id="chargePaymentDiscount" type="number" min="0" step="0.01" value="${Number(booking.chargeProposedDiscount || 0).toFixed(2)}" /></label></div>`);
  $("approveChargeButton").dataset.approveCharge = chargeId;
  $("rejectChargeButton").dataset.rejectCharge = chargeId;
  openModal("chargeModal");
}

async function reviewCharge(id, action) {
  try {
    const payment = action === "approve" ? { amountPaid: $("chargePaymentAmount").value.trim(), discount: $("chargePaymentDiscount").value.trim() } : {};
    const result = await (action === "approve" ? approveJobCharge(id, payment) : rejectJobCharge(id));
    closeModals();
    if (action === "approve") {
      toast(result?.paymentRecorded ? "Charges approved and payment recorded." : "Submission approved.");
    } else {
      toast("Charges rejected.");
    }
    await loadAll();
  } catch (error) {
    toast(error.message);
  }
}

async function deleteRecord(type, id) {
  if (!confirm(`Delete this ${type}?`)) return;
  const actions = { booking: removeBooking, service: removeService, product: removeProduct, technician: removeTechnician, customer: removeCustomer };
  await actions[type](id);
  toast(`${type} deleted.`);
  await loadAll();
}

function openModal(id) {
  if (id === "serviceModal" && !$("serviceId").value) {
    $("servicePriceTiersPanel")?.classList.add("hidden");
    if ($("servicePriceTiersList")) $("servicePriceTiersList").innerHTML = "";
  }
  document.getElementById(id).classList.remove("hidden");
}

function closeModals() {
  document.querySelectorAll(".modal").forEach((modal) => modal.classList.add("hidden"));
  document.querySelectorAll(".modal form").forEach((form) => form.reset());
}

function fillService(id) {
  const item = services.find((service) => String(service.id) === String(id));
  document.getElementById("serviceId").value = item.id;
  document.getElementById("serviceName").value = item.name || "";
  document.getElementById("serviceType").value = item.type || "";
  document.getElementById("servicePrice").value = item.price || "";
  document.getElementById("serviceInclusion").value = item.inclusion || "";
  document.getElementById("serviceExclusion").value = item.exclusion || "";
  $("serviceExistingImage").value = item.image || "";
  renderPriceTierEditor(item);
  openModal("serviceModal");
}

function renderPriceTierEditor(service) {
  const panel = $("servicePriceTiersPanel");
  if (!panel) return;
  panel.classList.toggle("hidden", !service?.id);
  if (!service?.id) return;
  const tiers = Array.isArray(service.priceTiers) ? service.priceTiers : [];
  $("servicePriceTiersList").innerHTML = tiers.length
    ? tiers.map((tier) => `<div class="grid grid-cols-1 items-center gap-2 rounded-lg border border-slate-200 p-2 md:grid-cols-[1fr_1fr_1fr_auto_auto]"><input id="tierHPower-${tier.id}" value="${escapeHtml(tier.hPower || "")}" placeholder="HPower" /><input id="tierUnitType-${tier.id}" value="${escapeHtml(tier.unitType || "")}" placeholder="Unit type" /><input id="tierAmount-${tier.id}" type="number" min="0.01" step="0.01" value="${escapeHtml(tier.amount ?? "")}" placeholder="Amount" /><button type="button" class="tiny-button secondary-button" data-save-price-tier="${tier.id}">Save</button><button type="button" class="tiny-button danger-button" data-delete-price-tier="${tier.id}">Delete</button></div>`).join("")
    : `<p class="empty-note">No optional price tiers yet.</p>`;
  $("newTierHPower").value = "";
  $("newTierUnitType").value = "";
  $("newTierAmount").value = "";
}

function readTierPayload(hPower, unitType, amount) {
  const payload = { hPower: hPower.trim(), unitType: unitType.trim(), amount: amount.trim() };
  if (!payload.hPower) { toast("Horsepower is required."); return null; }
  if (!payload.amount || !Number.isFinite(Number(payload.amount)) || Number(payload.amount) <= 0) { toast("Amount must be a positive number."); return null; }
  return payload;
}

async function addPriceTier() {
  const serviceId = $("serviceId").value;
  if (!serviceId) return toast("Save the service before adding price tiers.");
  const payload = readTierPayload($("newTierHPower").value, $("newTierUnitType").value, $("newTierAmount").value);
  if (!payload) return;
  try {
    const tier = await createServicePriceTier(serviceId, payload);
    const service = services.find((item) => String(item.id) === String(serviceId));
    service.priceTiers = [...(service.priceTiers || []), tier];
    renderPriceTierEditor(service);
    toast("Price tier added.");
  } catch (error) { toast(error.message); }
}

async function savePriceTier(tierId) {
  const serviceId = $("serviceId").value;
  const payload = readTierPayload($(`tierHPower-${tierId}`).value, $(`tierUnitType-${tierId}`).value, $(`tierAmount-${tierId}`).value);
  if (!payload) return;
  try {
    const tier = await updateServicePriceTier(serviceId, tierId, payload);
    const service = services.find((item) => String(item.id) === String(serviceId));
    service.priceTiers = (service.priceTiers || []).map((item) => String(item.id) === String(tierId) ? tier : item);
    renderPriceTierEditor(service);
    toast("Price tier updated.");
  } catch (error) { toast(error.message); }
}

async function deletePriceTier(tierId) {
  const serviceId = $("serviceId").value;
  if (!confirm("Delete this price tier?")) return;
  try {
    await removeServicePriceTier(serviceId, tierId);
    const service = services.find((item) => String(item.id) === String(serviceId));
    service.priceTiers = (service.priceTiers || []).filter((item) => String(item.id) !== String(tierId));
    renderPriceTierEditor(service);
    toast("Price tier deleted.");
  } catch (error) { toast(error.message); }
}

async function saveService(event) {
  event.preventDefault();
  const id = $("serviceId").value;
  const payload = { name: $("serviceName").value.trim(), type: $("serviceType").value.trim(), price: $("servicePrice").value.trim(), inclusion: $("serviceInclusion").value.trim(), exclusion: $("serviceExclusion").value.trim(), image: await fileToDataUrl($("serviceImage"), $("serviceExistingImage").value) };
  if (!payload.name) return toast("Variant name is required.");
  if (!payload.type) return toast("Category is required.");
  if (payload.price === "" || Number(payload.price) < 0) return toast("Price cannot be negative.");
  try {
    id ? await updateService(id, payload) : await createService(payload);
    closeModals();
    await loadAll();
  } catch (error) {
    toast(error.message);
  }
}

function fillProductLegacy(id) {
  const item = products.find((product) => String(product.id) === String(id));
  $("productId").value = item.id;
  $("productName").value = item.name || "";
  $("productType").value = item.type || "";
  $("productBrand").value = item.brand || "";
  $("productPrice").value = item.price || "";
  $("productStocks").value = item.stocks || "";
  $("productHorsepower").value = item.horsepower || "";
  $("productExistingImage").value = item.image || "";
  openModal("productModal");
}

async function saveProductLegacy(event) {
  event.preventDefault();
  const id = $("productId").value;
  const payload = { name: $("productName").value.trim(), type: $("productType").value.trim(), brand: $("productBrand").value.trim(), price: $("productPrice").value.trim(), stocks: $("productStocks").value.trim(), horsepower: $("productHorsepower").value.trim(), image: await fileToDataUrl($("productImage"), $("productExistingImage").value) };
  id ? await updateProduct(id, payload) : await createProduct(payload);
  closeModals();
  await loadAll();
}

function fillTechnician(id) {
  const item = technicians.find((tech) => String(tech.id) === String(id));
  $("technicianId").value = item.id;
  $("technicianName").value = item.name || "";
  $("technicianFields").querySelectorAll("input").forEach((input) => { input.checked = (item.specialty || "").split(",").map((value) => value.trim()).includes(input.value); });
  $("technicianStatus").value = item.status || "Active";
  $("technicianPhone").value = item.phoneNumber || "";
  $("technicianEmail").value = item.email || "";
  $("technicianAddress").value = item.address || "";
  openModal("technicianModal");
}

async function saveTechnician(event) {
  event.preventDefault();
  const id = $("technicianId").value;
  const photoInput = $("technicianPhoto");
  const photo = photoInput.files?.[0];
  if (photo && !/\.(jpe?g|png)$/i.test(photo.name)) {
    toast("Profile photo must be a JPG, JPEG, or PNG file.");
    return;
  }
  const phoneNumber = $("technicianPhone").value.replace(/\D/g, "").slice(0, 11);
  $("technicianPhone").value = phoneNumber;
  if (!isValidPhilippineMobile(phoneNumber)) {
    $("technicianPhoneError").classList.remove("hidden");
    return;
  }
  const payload = {
    name: $("technicianName").value.trim(),
    specialty: [...$("technicianFields").querySelectorAll("input:checked")].map((input) => input.value).join(", "),
    status: $("technicianStatus").value,
    phoneNumber,
    email: $("technicianEmail").value.trim(),
    address: $("technicianAddress").value.trim(),
    ...(photo ? { profilePhoto: { name: photo.name, data: await fileToDataUrl(photoInput) } } : {})
  };
  try {
    id ? await updateTechnician(id, payload) : await createTechnician(payload);
    closeModals();
    await loadAll();
    toast("Technician saved.");
  } catch (error) {
    toast(error.message);
  }
}

function fillCustomer(id) {
  const item = customers.find((customer) => String(customer.id) === String(id));
  $("customerId").value = item.id;
  $("customerName").value = item.name || "";
  $("customerPhone").value = item.phone || "";
  $("customerEmail").value = item.email || "";
  $("customerCity").value = item.city || "";
  $("customerAddress").value = item.address || "";
  openModal("customerModal");
}

async function saveCustomer(event) {
  event.preventDefault();
  const id = $("customerId").value;
  const phoneInput = $("customerPhone");
  phoneInput.value = phoneInput.value.replace(/\D/g, "").slice(0, 11);
  const payload = { name: $("customerName").value.trim(), phone: phoneInput.value, email: $("customerEmail").value.trim(), address: $("customerAddress").value.trim(), city: $("customerCity").value };
  if (!isValidPhilippineMobile(payload.phone)) {
    $("customerPhoneError").classList.remove("hidden");
    return;
  }
  try {
    id ? await updateCustomer(id, payload) : await createCustomer(payload);
    closeModals();
    await loadAll();
  } catch (error) {
    toast(error.message);
  }
}

async function saveSchedule(event) {
  event.preventDefault();
  const booking = selectedScheduleBooking();
  const technicianId = $("scheduleTechnician").value;
  if (!booking || !technicianId) return toast("Select an available technician.");
  if (technicianConflict(technicians.find((tech) => String(tech.id) === String(technicianId)), booking)) return toast("That technician is already assigned during this time slot.");
  try {
    await createSchedule({ bookingId: booking.id, technicianId });
    toast("Technician assigned. Booking marked Scheduled.");
    await loadAll();
  } catch (error) {
    toast(error.message);
  }
}

function ensureAdminCityFields() {
  const cities = ["San Fernando", "Naga", "Minglanilla", "Talisay City", "Cebu City", "Mandaue City", "Consolacion", "Liloan", "Compostela", "Danao City"];
  [["customerAddress", "customerCity"]].forEach(([addressId, cityId]) => {
    if ($(cityId)) return;
    const field = document.createElement("label");
    field.className = "form-field";
    field.innerHTML = `<span>Service area city</span><select id="${cityId}" required><option value="">Select city/municipality</option>${cities.map((city) => `<option>${city}</option>`).join("")}</select>`;
    $(addressId).closest("label").after(field);
  });
}

function inferServiceAreaCity(address) { const value = String(address || "").toLowerCase(); return ["San Fernando", "Naga", "Minglanilla", "Talisay City", "Cebu City", "Mandaue City", "Consolacion", "Liloan", "Compostela", "Danao City"].find((city) => value.includes(city.toLowerCase())) || ""; }

async function prepareProductForm() {
  const brandSelect = $("productBrand");
  brandSelect.innerHTML = '<option value="">Select brand</option>' + brands.map((brand) => `<option value="${brand.id}">${escapeHtml(brand.name)}</option>`).join("");
  $("productLine").innerHTML = '<option value="">Select a brand first</option>';
  $("productLine").disabled = true;
}

async function loadProductLines() {
  const brandId = $("productBrand").value;
  const select = $("productLine");
  select.innerHTML = '<option value="">Loading product lines...</option>';
  select.disabled = true;
  if (!brandId) { select.innerHTML = '<option value="">Select a brand first</option>'; return; }
  try {
    productLines = await getProductServices(brandId);
    select.innerHTML = '<option value="">Select product line</option>' + productLines.map((line) => `<option value="${line.id}">${escapeHtml(line.serviceName)}${line.modelCode ? ` — ${escapeHtml(line.modelCode)}` : ""}</option>`).join("");
    select.disabled = false;
  } catch (error) { select.innerHTML = '<option value="">Unable to load product lines</option>'; toast(error.message); }
}

async function fillProduct(id) {
  const item = products.find((product) => String(product.id) === String(id));
  if (!item) return;
  await prepareProductForm();
  $("productId").value = item.id;
  $("productName").value = item.name || "";
  $("productBrand").value = item.brandId || "";
  await loadProductLines();
  $("productLine").value = item.pServiceId || "";
  $("productPrice").value = item.price || "";
  $("productStocks").value = item.stocks || "";
  $("productHorsepower").value = item.horsepower || "";
  $("productInstallation").value = item.installation || "";
  $("productImage").value = "";
  $("productExistingImage").value = item.image || "";
  openModal("productModal");
}

async function saveProduct(event) {
  event.preventDefault();
  const id = $("productId").value;
  const payload = { name: $("productName").value.trim(), brandId: Number($("productBrand").value), pServiceId: Number($("productLine").value), price: $("productPrice").value.trim(), stocks: $("productStocks").value.trim(), horsepower: $("productHorsepower").value.trim(), installation: $("productInstallation").value.trim(), image: await fileToDataUrl($("productImage"), $("productExistingImage").value) };
  if (!payload.brandId || !payload.pServiceId) return toast("Choose a brand and product line.");
  if (!payload.name || !payload.horsepower) return toast("Name and horsepower are required.");
  try { id ? await updateProduct(id, payload) : await createProduct(payload); closeModals(); await loadAll(); } catch (error) { toast(error.message); }
}