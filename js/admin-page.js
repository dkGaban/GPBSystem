import {
  createCustomer,
  createProduct,
  createSchedule,
  createService,
  createTechnician,
  getBookings,
  getCustomers,
  getLogs,
  getProducts,
  getServices,
  getTechnicians,
  removeBooking,
  removeCustomer,
  removeProduct,
  removeService,
  removeTechnician,
  updateBookingStatus,
  updateCustomer,
  updateProduct,
  updateService,
  updateTechnician
} from "./api.js";
import { bindTabs, escapeHtml, fileToDataUrl, isValidPhilippineMobile, logout, peso, renderProducts, requireRole, statusBadge, toast } from "./portal-utils.js";

const session = requireRole("admin");
let services = [];
let products = [];
let technicians = [];
let customers = [];
let bookings = [];
let logs = [];

const $ = (id) => document.getElementById(id);

if (session) init();

async function init() {
  bindTabs("dashboard");
  document.getElementById("logoutButton").addEventListener("click", logout);
  document.body.addEventListener("click", handleClick);
  document.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", closeModals));
  document.getElementById("serviceForm").addEventListener("submit", saveService);
  document.getElementById("productForm").addEventListener("submit", saveProduct);
  document.getElementById("technicianForm").addEventListener("submit", saveTechnician);
  document.getElementById("customerForm").addEventListener("submit", saveCustomer);
  document.getElementById("customerSearch").addEventListener("input", renderCustomers);
  document.getElementById("scheduleForm").addEventListener("submit", saveSchedule);
  await loadAll();
}

async function loadAll() {
  [services, products, technicians, customers, bookings, logs] = await Promise.all([
    getServices(),
    getProducts(),
    getTechnicians(),
    getCustomers(),
    getBookings(),
    getLogs()
  ]);
  render();
}

function render() {
  renderStats();
  renderBookings();
  renderServices();
  renderProducts(products, { admin: true });
  renderTechnicians();
  renderCustomers();
  renderSchedules();
  renderLogs();
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
    ? items.map((booking) => `<tr><td>${booking.id}</td><td>${escapeHtml(booking.customer)}</td><td>${escapeHtml(booking.service)}</td><td>${escapeHtml([booking.preferredDate, booking.preferredTime].filter(Boolean).join(" "))}</td><td>${escapeHtml(booking.technician || "Unassigned")}</td><td>${statusBadge(booking.status)}</td><td><button class="tiny-button success-button" data-approve="${booking.id}">Approve</button><button class="tiny-button warning-button" data-reject="${booking.id}">Reject</button><button class="tiny-button danger-button" data-delete-booking="${booking.id}">Delete</button></td></tr>`).join("")
    : `<tr><td colspan="7" class="text-center text-slate-500">No bookings yet.</td></tr>`;
}

function renderBookings() {
  document.getElementById("bookingsBody").innerHTML = bookingRows(bookings);
  document.getElementById("recentBookingsBody").innerHTML = bookingRows(bookings.slice(0, 5));
}

function renderServices() {
  document.getElementById("servicesBody").innerHTML = services.length
    ? services.map((service) => `<tr><td>${service.id}</td><td>${escapeHtml(service.name)}</td><td>${escapeHtml(service.type)}</td><td>${peso(service.price)}</td><td>${escapeHtml(service.inclusion)}</td><td>${escapeHtml(service.exclusion)}</td><td><button class="tiny-button secondary-button" data-edit-service="${service.id}">Edit</button><button class="tiny-button danger-button" data-delete-service="${service.id}">Delete</button></td></tr>`).join("")
    : `<tr><td colspan="7" class="text-center text-slate-500">No services yet.</td></tr>`;
  document.getElementById("dashboardServicesBody").innerHTML = services.length
    ? services.slice(0, 4).map((service) => `<tr><td>${escapeHtml(service.name)}</td><td>${escapeHtml(service.inclusion || service.type)}</td><td><button class="tiny-button secondary-button" data-edit-service="${service.id}">Edit</button></td></tr>`).join("")
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
  document.getElementById("scheduleBooking").innerHTML = bookings.map((booking) => `<option value="${booking.id}">${booking.id} - ${escapeHtml(booking.customer)} - ${escapeHtml(booking.service)}</option>`).join("");
  document.getElementById("scheduleTechnician").innerHTML = technicians.filter((tech) => tech.status === "Active").map((tech) => `<option value="${tech.id}">${escapeHtml(tech.name)} - ${escapeHtml(tech.specialty)}</option>`).join("");
}

function renderLogs() {
  document.getElementById("logsBody").innerHTML = logs.length
    ? logs.map((log) => `<tr><td>${new Date(log.createdAt).toLocaleString()}</td><td>${escapeHtml(log.actor)}</td><td>${escapeHtml(log.action)}</td><td>${escapeHtml([log.targetType, log.targetId].filter(Boolean).join(" #"))}</td></tr>`).join("")
    : `<tr><td colspan="4" class="text-center text-slate-500">No logs yet.</td></tr>`;
}

function renderAssignmentPreview() {
  const pending = bookings.filter((booking) => !booking.technician).slice(0, 3);
  document.getElementById("assignmentPreview").innerHTML = pending.length
    ? pending.map((booking) => `<div class="preview-item"><strong>${escapeHtml(booking.id)} - ${escapeHtml(booking.customer)}</strong><span>${escapeHtml(booking.service)}</span></div>`).join("")
    : `<p class="empty-note">No unassigned bookings.</p>`;
}

function renderBookingMonitor() {
  const statuses = ["Pending", "Approved", "Assigned", "In Progress", "Completed"];
  const total = Math.max(bookings.length, 1);
  document.getElementById("bookingMonitor").innerHTML = statuses
    .map((status) => {
      const count = bookings.filter((booking) => booking.status === status).length;
      const percent = Math.round((count / total) * 1000) / 10;
      return `<div class="monitor-row">${statusBadge(status)}<strong>${count}</strong><span>${percent}%</span></div>`;
    })
    .join("") + `<div class="monitor-total"><span>Total Bookings</span><strong>${bookings.length}</strong></div>`;
}

async function handleClick(event) {
  const button = event.target.closest("button");
  if (!button) return;
  if (button.dataset.open) return openModal(button.dataset.open);
  if (button.dataset.approve) return changeBooking(button.dataset.approve, "Approved");
  if (button.dataset.reject) return changeBooking(button.dataset.reject, "Rejected");
  if (button.dataset.deleteBooking) return deleteRecord("booking", button.dataset.deleteBooking);
  if (button.dataset.deleteService) return deleteRecord("service", button.dataset.deleteService);
  if (button.dataset.deleteProduct) return deleteRecord("product", button.dataset.deleteProduct);
  if (button.dataset.deleteTechnician) return deleteRecord("technician", button.dataset.deleteTechnician);
  if (button.dataset.deleteCustomer) return deleteRecord("customer", button.dataset.deleteCustomer);
  if (button.dataset.editService) return fillService(button.dataset.editService);
  if (button.dataset.editProduct) return fillProduct(button.dataset.editProduct);
  if (button.dataset.editTechnician) return fillTechnician(button.dataset.editTechnician);
  if (button.dataset.editCustomer) return fillCustomer(button.dataset.editCustomer);
  if (button.dataset.historyCustomer) return showHistory(button.dataset.historyCustomer);
}

function showHistory(id) { const customer = customers.find((item) => String(item.id) === String(id)); const items = bookings.filter((booking) => booking.status === "Completed" && String(booking.customer).trim().toLowerCase() === String(customer?.name || "").trim().toLowerCase()); $("historyTitle").textContent = `${customer?.name || "Customer"} — Service History`; $("historyBody").innerHTML = items.length ? items.map((booking) => `<article class="history-entry"><strong>${escapeHtml(booking.service)}</strong><span>${escapeHtml(booking.preferredDate || booking.scheduleDate || "Date not set")} · ${escapeHtml(booking.preferredTime || booking.scheduleTime || "Time not set")}</span><b>${peso(booking.totalAmount)}</b></article>`).join("") : `<p class="empty-note">No completed services found.</p>`; $("historyModal").classList.remove("hidden"); }

async function changeBooking(id, status) {
  await updateBookingStatus(id, status);
  toast(`Booking ${id} marked ${status}.`);
  await loadAll();
}

async function deleteRecord(type, id) {
  if (!confirm(`Delete this ${type}?`)) return;
  const actions = { booking: removeBooking, service: removeService, product: removeProduct, technician: removeTechnician, customer: removeCustomer };
  await actions[type](id);
  toast(`${type} deleted.`);
  await loadAll();
}

function openModal(id) {
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
  openModal("serviceModal");
}

async function saveService(event) {
  event.preventDefault();
  const id = $("serviceId").value;
  const payload = { name: $("serviceName").value.trim(), type: $("serviceType").value.trim(), price: $("servicePrice").value.trim(), inclusion: $("serviceInclusion").value.trim(), exclusion: $("serviceExclusion").value.trim(), image: await fileToDataUrl($("serviceImage"), $("serviceExistingImage").value) };
  if (!payload.name) return toast("Service name is required.");
  if (!payload.type) return toast("Service type is required.");
  if (payload.price === "" || Number(payload.price) < 0) return toast("Price cannot be negative.");
  try {
    id ? await updateService(id, payload) : await createService(payload);
    closeModals();
    await loadAll();
  } catch (error) {
    toast(error.message);
  }
}

function fillProduct(id) {
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

async function saveProduct(event) {
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
  $("technicianPassword").value = "";
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
    password: $("technicianPassword").value,
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
  $("customerAddress").value = item.address || "";
  openModal("customerModal");
}

async function saveCustomer(event) {
  event.preventDefault();
  const id = $("customerId").value;
  const phoneInput = $("customerPhone");
  phoneInput.value = phoneInput.value.replace(/\D/g, "").slice(0, 11);
  const payload = { name: $("customerName").value.trim(), phone: phoneInput.value, email: $("customerEmail").value.trim(), address: $("customerAddress").value.trim() };
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
  await createSchedule({ bookingId: $("scheduleBooking").value, technicianId: $("scheduleTechnician").value, scheduleDate: $("scheduleDate").value, scheduleTime: $("scheduleTime").value });
  toast("Technician assigned.");
  await loadAll();
}
