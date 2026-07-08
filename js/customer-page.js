import { createBooking, getBookings, getProducts, getServices } from "./api.js";
import { bindTabs, escapeHtml, logout, peso, renderProducts, requireRole, statusBadge, toast } from "./portal-utils.js";

const session = requireRole("customer");
let services = [];
let products = [];
let bookings = [];
const $ = (id) => document.getElementById(id);

if (session) init();

async function init() {
  bindTabs("dashboard");
  document.getElementById("logoutButton").addEventListener("click", logout);
  document.getElementById("bookingForm").addEventListener("submit", saveBooking);
  document.body.addEventListener("click", (event) => {
    if (event.target.closest("[data-book-service]")) {
      document.getElementById("bookingService").value = event.target.closest("[data-book-service]").dataset.bookService;
      document.querySelector("[data-tab='book']").click();
    }
  });
  await loadAll();
  fillCustomerDefaults();
}

async function loadAll() {
  [services, products, bookings] = await Promise.all([getServices(), getProducts(), getBookings()]);
  render();
}

function render() {
  document.getElementById("statsGrid").innerHTML = [
    ["My Bookings", bookings.length, "stat-blue", "icon-bookings"],
    ["Pending", bookings.filter((item) => item.status === "Pending").length, "stat-orange", "icon-schedule"],
    ["Approved", bookings.filter((item) => item.status === "Approved").length, "stat-green", "icon-dashboard"],
    ["Completed", bookings.filter((item) => item.status === "Completed").length, "stat-blue", "icon-logs"]
  ].map(([label, value, color, icon]) => `<article class="stat-card"><span class="stat-icon ${color}"><span class="nav-icon ${icon}"></span></span><div><p>${label}</p><p>${value}</p></div></article>`).join("");
  const rows = bookings.length ? bookings.map((booking) => `<tr><td>${booking.id}</td><td>${escapeHtml(booking.service)}</td><td>${escapeHtml([booking.preferredDate, booking.preferredTime].filter(Boolean).join(" "))}</td><td>${escapeHtml(booking.technician || "Unassigned")}</td><td>${statusBadge(booking.status)}</td></tr>`).join("") : `<tr><td colspan="5" class="text-center text-slate-500">No bookings yet.</td></tr>`;
  document.getElementById("bookingsBody").innerHTML = rows;
  document.getElementById("recentBookingsBody").innerHTML = rows;
  document.getElementById("servicesBody").innerHTML = services.length ? services.map((service) => `<tr><td>${escapeHtml(service.name)}</td><td>${escapeHtml(service.type)}</td><td>${peso(service.price)}</td><td>${escapeHtml(service.inclusion)}</td><td>${escapeHtml(service.exclusion)}</td><td><button class="tiny-button secondary-button" data-book-service="${escapeHtml(service.name)}">Book</button></td></tr>`).join("") : `<tr><td colspan="6" class="text-center text-slate-500">No services available.</td></tr>`;
  document.getElementById("bookingService").innerHTML = services.map((service) => `<option value="${escapeHtml(service.name)}">${escapeHtml(service.name)}</option>`).join("");
  renderProducts(products);
}

function fillCustomerDefaults() {
  document.getElementById("bookingCustomer").value = session.user.fullName || "";
  document.getElementById("bookingEmail").value = session.user.email || "";
}

async function saveBooking(event) {
  event.preventDefault();
  try {
    await createBooking({
      customer: $("bookingCustomer").value.trim(),
      phone: $("bookingPhone").value.trim(),
      email: $("bookingEmail").value.trim(),
      service: $("bookingService").value,
      preferredDate: $("bookingDate").value,
      preferredTime: $("bookingTime").value,
      address: $("bookingAddress").value.trim()
    });
    event.target.reset();
    fillCustomerDefaults();
    toast("Booking request submitted.");
    await loadAll();
  } catch (error) {
    toast(error.message);
  }
}
