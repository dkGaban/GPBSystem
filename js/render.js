import { els, getApprovedCustomers, state } from "./state.js";
import { escapeHtml, formatPesoPrice, formatScheduleCell, refreshIcons, statusBadge } from "./utils.js";

export function render() {
  applyRoleVisibility();
  renderStats();
  renderBookingRequests();
  renderAllBookings();
  renderAssignmentOptions();
  renderSchedules();
  renderServices();
  if (els.productsGrid) renderProducts();
  renderCustomers();
  renderTechnicians();
  renderReports();
  renderLogs();
  renderActivities();
  refreshIcons();
}

function currentRole() {
  return state.session?.user?.role || "guest";
}

export function applyRoleVisibility() {
  const role = currentRole();
  const dashboardCopy = {
    admin: ["Administrator Dashboard", "Manage bookings, schedules, technicians, and service operations."],
    customer: ["Customer Dashboard", "Book services, review requests, and browse available products."],
    technician: ["Technician Dashboard", "Review assigned jobs, schedules, customers, and job progress."],
    guest: ["Services", "Browse services and products. Login or register to book a schedule."]
  }[role];
  if (els.dashboardTitle) els.dashboardTitle.textContent = dashboardCopy[0];
  if (els.dashboardSubtitle) els.dashboardSubtitle.textContent = dashboardCopy[1];
  els.activityFooter?.classList.add("hidden");
  document.querySelectorAll(".admin-only").forEach((item) => item.classList.toggle("hidden", role !== "admin"));
  document.getElementById("addServicePageButton")?.classList.toggle("hidden", role !== "admin");
  document.getElementById("addProductButton")?.classList.toggle("hidden", role !== "admin");
  document.getElementById("addCustomerButton")?.classList.toggle("hidden", role !== "admin");
  document.getElementById("addTechnicianButton")?.classList.toggle("hidden", role !== "admin");
  document.getElementById("assignmentForm")?.classList.toggle("hidden", role !== "admin");
  document.getElementById("bookingRequestPanel")?.classList.toggle("hidden", role === "admin" || role === "technician");
}

export function renderStats() {
  const pending = state.bookings.filter((booking) => booking.status === "Pending").length;
  const completed = state.bookings.filter((booking) => booking.status === "Completed").length;
  const stats = [
    { label: "Total Bookings", value: state.bookings.length, icon: "list", color: "bg-blue-800", link: "View all bookings", view: "bookings" },
    { label: "Pending Approvals", value: pending, icon: "clock", color: "bg-orange-400", link: "Review requests", view: "bookings" },
    { label: "Active Technicians", value: state.technicians.filter((tech) => tech.status === "Active").length, icon: "user-check", color: "bg-emerald-500", link: "Manage technicians", view: "technicians" },
    { label: "Completed Services", value: completed, icon: "clipboard-check", color: "bg-blue-800", link: "View reports", view: "reports" }
  ];

  els.statsGrid.innerHTML = stats
    .map(
      (stat) => `
        <article class="stat-card">
          <div class="stat-icon ${stat.color}"><span data-icon="${stat.icon}"></span></div>
          <div>
            <p class="text-xs font-semibold text-slate-500">${escapeHtml(stat.label)}</p>
            <p class="mt-1 text-3xl font-extrabold leading-none text-blue-950">${stat.value}</p>
            <button class="mt-2 inline-flex items-center gap-1 text-xs font-bold text-blue-900" data-nav-target="${stat.view}">
              ${escapeHtml(stat.link)} <span data-icon="arrow-right"></span>
            </button>
          </div>
        </article>
      `
    )
    .join("");
}

export function renderBookingRequests() {
  const pendingBookings = state.bookings.filter((booking) => booking.status === "Pending").slice(0, 5);
  const pendingCount = state.bookings.filter((booking) => booking.status === "Pending").length;
  els.bookingRequestsBody.innerHTML = pendingBookings.length
    ? pendingBookings.map(renderRequestRow).join("")
    : `<tr><td colspan="6" class="text-center text-slate-500">No pending booking requests.</td></tr>`;
  els.requestSummary.textContent = pendingCount
    ? `Showing 1 to ${pendingBookings.length} of ${pendingCount} requests`
    : "No pending requests";
}

export function renderRequestRow(booking) {
  return `
    <tr>
      <td>${escapeHtml(booking.id)}</td>
      <td>${escapeHtml(booking.customer)}</td>
      <td>${escapeHtml(booking.service)}</td>
      <td>${formatScheduleCell(displaySchedule(booking))}</td>
      <td>${statusBadge(booking.status)}</td>
      <td>
        <div class="flex flex-wrap gap-2">
          <button class="tiny-button success-button" data-action="approve-booking" data-id="${booking.id}">Approve</button>
          <button class="tiny-button secondary-button" data-action="view-booking" data-id="${booking.id}">View</button>
        </div>
      </td>
    </tr>
  `;
}

export function renderAllBookings() {
  if (!state.bookings.length) {
    els.allBookingsBody.innerHTML = `<tr><td colspan="7" class="text-center text-slate-500">No bookings yet.</td></tr>`;
    return;
  }

  els.allBookingsBody.innerHTML = state.bookings
    .map(
      (booking) => `
        <tr>
          <td>${escapeHtml(booking.id)}</td>
          <td>${escapeHtml(booking.customer)}</td>
          <td>${escapeHtml(booking.service)}</td>
          <td>${escapeHtml(displaySchedule(booking))}</td>
          <td>${escapeHtml(booking.technician || "Unassigned")}</td>
          <td>${statusBadge(booking.status)}</td>
          <td>
            <div class="flex flex-wrap gap-2">
              ${currentRole() === "admin" ? `<button class="tiny-button success-button" data-action="approve-booking" data-id="${booking.id}">Approve</button>
              <button class="tiny-button warning-button" data-action="reject-booking" data-id="${booking.id}">Reject</button>` : ""}
              <button class="tiny-button secondary-button" data-action="view-booking" data-id="${booking.id}">View</button>
              ${currentRole() === "admin" ? `<button class="tiny-button danger-button" data-action="delete-booking" data-id="${booking.id}">Delete</button>` : ""}
            </div>
          </td>
        </tr>
      `
    )
    .join("");
}

export function renderAssignmentOptions() {
  const assignableBookings = state.bookings.filter((booking) => booking.status !== "Completed");
  els.assignBooking.innerHTML = assignableBookings.length
    ? assignableBookings
      .map((booking) => `<option value="${booking.id}">${escapeHtml(`${booking.id} - ${booking.customer} - ${booking.service}`)}</option>`)
      .join("")
    : `<option value="">No bookings available</option>`;

  els.assignTechnician.innerHTML = `<option value="">Select technician</option>${state.technicians
    .filter((tech) => tech.status === "Active")
    .map((tech) => `<option value="${escapeHtml(tech.id)}">${escapeHtml(tech.name)} - ${escapeHtml(tech.specialty)}</option>`)
    .join("")}`;

  const bookingService = document.getElementById("bookingService");
  if (bookingService) {
    bookingService.innerHTML = state.services.length
      ? state.services.map((service) => `<option value="${escapeHtml(service.name)}">${escapeHtml(service.name)}</option>`).join("")
      : `<option value="">No services available</option>`;
  }
}

export function renderSchedules() {
  const rows = state.schedules.map(renderScheduleRow).join("");
  els.scheduleList.innerHTML = rows;
  els.schedulesPageList.innerHTML = rows || `<p class="text-sm text-slate-500">No schedules yet.</p>`;
}

export function renderScheduleRow(item) {
  return `
    <div class="schedule-row">
      <div>
        <strong>${escapeHtml(item.technician || "Unassigned")}</strong>
        <p class="text-xs text-slate-500">${escapeHtml(item.bookingId)} - ${escapeHtml(item.service)}</p>
      </div>
      <div class="font-semibold text-slate-700">${escapeHtml(item.time)}</div>
      <div class="text-xs font-semibold text-slate-600">${escapeHtml(item.address)}</div>
      <div>${statusBadge(item.status)}</div>
    </div>
  `;
}

export function renderServices() {
  const dashboardRows = state.services.slice(0, 4).map(renderServiceRow).join("");
  const pageRows = state.services.map(renderServiceRow).join("");
  els.servicesBody.innerHTML = dashboardRows || `<tr><td colspan="7" class="text-center text-slate-500">No services yet.</td></tr>`;
  els.servicesPageBody.innerHTML = pageRows || `<tr><td colspan="7" class="text-center text-slate-500">No services yet. Use Add Service to create one.</td></tr>`;
}

export function renderServiceRow(service) {
  return `
    <tr>
      <td>${escapeHtml(service.id)}</td>
      <td>
        <div class="flex items-center gap-3">
          <span class="placeholder-icon"></span>
          <span class="font-semibold">${escapeHtml(service.name)}</span>
        </div>
      </td>
      <td>${escapeHtml(service.type || "")}</td>
      <td>${escapeHtml(formatPesoPrice(service.price))}</td>
      <td>${escapeHtml(service.inclusion || service.description || "")}</td>
      <td>${escapeHtml(service.exclusion || "")}</td>
      <td>
        <div class="flex flex-wrap gap-2">
          ${currentRole() === "admin" ? `<button class="tiny-button secondary-button" data-action="edit-service" data-id="${service.id}">Edit</button>
          <button class="icon-button !h-8 !min-w-8" title="Delete service" data-action="delete-service" data-id="${service.id}">
            <span data-icon="trash-2"></span>
          </button>` : `<button class="tiny-button secondary-button" data-action="guest-booking">Book</button>`}
        </div>
      </td>
    </tr>
  `;
}

export function renderServiceCard(service) {
  const hasDetails = String(service.inclusion || service.description || "").trim() || String(service.exclusion || "").trim();
  return `
    <article class="service-card">
      <div class="service-card-header">
        <span class="service-icon" data-icon="wrench"></span>
        <span class="service-type">${escapeHtml(service.type || "Service")}</span>
      </div>
      <h3>${escapeHtml(service.name)}</h3>
      <p class="service-price">${escapeHtml(formatPesoPrice(service.price))}</p>
      ${hasDetails ? `<div class="service-details">
        <div>
          ${String(service.inclusion || service.description || "").trim() ? `<span>Included</span><p>${escapeHtml(service.inclusion || service.description)}</p>` : ""}
          ${String(service.exclusion || "").trim() ? `<span>Not Included</span><p>${escapeHtml(service.exclusion)}</p>` : ""}
        </div>
      </div>` : ""}
      <div class="card-actions">
        <button class="tiny-button secondary-button" data-action="edit-service" data-id="${service.id}">Edit</button>
        <button class="tiny-button danger-button" data-action="delete-service" data-id="${service.id}">Delete</button>
      </div>
    </article>
  `;
}

export function renderCustomers() {
  const customers = state.customers.length ? state.customers : getApprovedCustomers();
  if (!customers.length) {
    els.customersBody.innerHTML = `<tr><td colspan="5" class="text-center text-slate-500">No approved booking customers yet.</td></tr>`;
    return;
  }

  els.customersBody.innerHTML = customers
    .map(
      (customer) => `
        <tr>
          <td>${escapeHtml(customer.name)}</td>
          <td>${escapeHtml(customer.phone)}</td>
          <td>${escapeHtml(customer.email)}</td>
          <td class="pre-line">${escapeHtml(customer.address)}</td>
          <td>
            <div class="flex flex-wrap gap-2">
              ${currentRole() === "admin" ? `<button class="tiny-button secondary-button" data-action="edit-customer" data-id="${customer.id}">Edit</button>
              <button class="tiny-button danger-button" data-action="delete-customer" data-id="${customer.id}">Delete</button>` : ""}
            </div>
          </td>
        </tr>
      `
    )
    .join("");
}

export function renderTechnicians() {
  if (!state.technicians.length) {
    els.techniciansBody.innerHTML = `<tr><td colspan="4" class="text-center text-slate-500">No technicians yet.</td></tr>`;
    return;
  }

  els.techniciansBody.innerHTML = state.technicians
    .map(
      (tech) => `
        <tr>
          <td>${escapeHtml(tech.name)}</td>
          <td>${escapeHtml(tech.specialty)}</td>
          <td>${statusBadge(tech.status)}</td>
          <td>
            <div class="flex flex-wrap gap-2">
              <button class="tiny-button secondary-button" data-action="edit-technician" data-id="${tech.id}">Edit</button>
              <button class="tiny-button danger-button" data-action="delete-technician" data-id="${tech.id}">Delete</button>
            </div>
          </td>
        </tr>
      `
    )
    .join("");
}

export function renderProducts() {
  if (!state.products.length) {
    els.productsGrid.innerHTML = `<p class="text-sm text-slate-500">No products yet. Use Add Product to create one.</p>`;
    return;
  }

  els.productsGrid.innerHTML = state.products
    .map(
      (product) => `
        <article class="product-card">
          <div class="product-image">
            ${product.image ? `<img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}">` : `<span data-icon="image"></span><p>No image yet</p>`}
          </div>
          <div class="product-card-body">
            <div class="product-meta-row">
              <span>${escapeHtml(product.brand || "Product")}</span>
              <span>${escapeHtml(product.type || "General")}</span>
            </div>
            <h3>${escapeHtml(product.name)}</h3>
            <p class="product-price">${escapeHtml(formatPesoPrice(product.price))}</p>
            <dl class="product-specs">
              <div><dt>Stocks</dt><dd>${escapeHtml(product.stocks || "0")}</dd></div>
              <div><dt>Horsepower</dt><dd>${escapeHtml(product.horsepower || "-")} MV</dd></div>
            </dl>
          </div>
          <div class="card-actions">
          ${currentRole() === "admin" ? `<button class="tiny-button secondary-button" data-action="edit-product" data-id="${product.id}">Edit</button>
          <button class="tiny-button danger-button" data-action="delete-product" data-id="${product.id}">Delete</button>` : `<button class="tiny-button secondary-button" data-action="guest-booking">Book</button>`}
          </div>
        </article>
      `
    )
    .join("");
}

export function renderLogs() {
  if (!els.logsBody) return;
  if (!state.logs.length) {
    els.logsBody.innerHTML = `<tr><td colspan="4" class="text-center text-slate-500">No action logs yet.</td></tr>`;
    return;
  }

  els.logsBody.innerHTML = state.logs
    .map(
      (log) => `
        <tr>
          <td>${escapeHtml(new Date(log.createdAt).toLocaleString())}</td>
          <td>${escapeHtml(log.actor)}</td>
          <td>${escapeHtml(log.action)}</td>
          <td>${escapeHtml([log.targetType, log.targetId].filter(Boolean).join(" #"))}</td>
        </tr>
      `
    )
    .join("");
}

function displaySchedule(booking) {
  if (booking.scheduleDate) return `${booking.scheduleDate} ${booking.scheduleTime || ""}`.trim();
  if (booking.preferredDate) return `${booking.preferredDate} ${booking.preferredTime || ""}`.trim();
  return booking.schedule || "";
}

export function renderReports() {
  const data = [
    ["Approved Bookings", state.bookings.filter((booking) => booking.status === "Approved").length],
    ["Rejected Bookings", state.bookings.filter((booking) => booking.status === "Rejected").length],
    ["Scheduled Jobs", state.schedules.length],
    ["Service Types", state.services.length]
  ];

  els.reportsGrid.innerHTML = data
    .map(
      ([label, value]) => `
        <article class="stat-card">
          <div class="stat-icon bg-blue-800"><span data-icon="bar-chart-3"></span></div>
          <div>
            <p class="text-xs font-semibold text-slate-500">${label}</p>
            <p class="mt-1 text-3xl font-extrabold leading-none text-blue-950">${value}</p>
          </div>
        </article>
      `
    )
    .join("");
}

export function renderActivities() {
  if (!state.activities.length) {
    els.activityLog.innerHTML = `<p class="text-sm text-slate-500">No recent activity yet.</p>`;
    return;
  }

  els.activityLog.innerHTML = state.activities
    .slice(0, 4)
    .map(
      (activity) => `
        <article class="activity-card">
          <div class="activity-icon ${activity.color}"><span data-icon="${activity.icon}"></span></div>
          <div>
            <p class="text-xs font-extrabold text-blue-950">${escapeHtml(activity.text)}</p>
            <p class="mt-1 text-xs text-slate-500">${escapeHtml(activity.time)}</p>
          </div>
        </article>
      `
    )
    .join("");
}
