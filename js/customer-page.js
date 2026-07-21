import { changePassword, createBooking, getBookings, getCustomers, getProducts, getServices, updateCustomer } from "./api.js";
import { bindTabs, escapeHtml, isValidPhilippineMobile, logout, peso, renderProducts, renderServiceCards, requireRole, statusBadge, toast } from "./portal-utils.js";

const session = requireRole("customer");
let services = [];
let products = [];
let bookings = [];
let profile = null;
const timeSlots = ["6:00 AM – 8:00 AM", "8:00 AM – 11:00 AM", "11:00 AM – 12:00 PM", "1:00 PM – 3:00 PM", "3:00 PM – 5:00 PM"];
const $ = (id) => document.getElementById(id);

if (session) init();

async function init() {
  bindTabs(new URLSearchParams(window.location.search).get("tab") || "home");
  document.getElementById("logoutButton").addEventListener("click", logout);
  document.getElementById("bookingForm").addEventListener("submit", saveBooking);
  document.getElementById("profileForm").addEventListener("submit", saveProfile);
  document.getElementById("customerPasswordForm").addEventListener("submit", (event) => savePassword(event, "customer"));
  document.body.addEventListener("click", (event) => {
    if (event.target.closest("[data-book-service]")) {
      const name = event.target.closest("[data-book-service]").dataset.bookService;
      document.querySelector(`[data-service-name="${CSS.escape(name)}"]`)?.click();
      document.querySelector("[data-tab='book']").click();
    }
    if (event.target.closest("[data-book-product]")) {
      document.querySelector("[data-tab='book']").click();
      toast("Select the service you want to book for this product.");
    }
  });
  $("bookingServices").addEventListener("change", updateBookingTotal);
  $("profilePhone").addEventListener("input", () => validatePhoneField("profilePhone", "profilePhoneError"));
  await loadAll();
  fillCustomerDefaults();
}

async function loadAll() {
  const data = await Promise.all([getServices(), getProducts(), getBookings(), getCustomers()]);
  [services, products, bookings] = data;
  profile = data[3].find((customer) => customer.email?.toLowerCase() === session.user.email?.toLowerCase()) || null;
  render();
}

function render() {
  const rows = bookings.length ? bookings.map((booking) => `<tr><td>${booking.id}</td><td>${escapeHtml(booking.service)}</td><td>${escapeHtml([booking.preferredDate, booking.preferredTime].filter(Boolean).join(" "))}</td><td>${escapeHtml(booking.technician || "Unassigned")}</td><td>${statusBadge(booking.status)}</td></tr>`).join("") : `<tr><td colspan="5" class="text-center text-slate-500">No bookings yet.</td></tr>`;
  document.getElementById("bookingsBody").innerHTML = rows;
  renderServiceCards(services, { customer: true });
  $("bookingServices").innerHTML = services.map((service) => bookingServiceChoice(service)).join("");
  $("bookingTimeSlots").innerHTML = timeSlots.map((slot, index) => `<label class="time-slot"><input type="radio" name="bookingTime" value="${slot}" ${index === 0 ? "required" : ""}/><span>${slot}</span></label>`).join("");
  renderProducts(products, { customer: true });
  if (profile) { $("profileName").value = profile.name || ""; $("profileEmail").value = profile.email || ""; $("profilePhone").value = profile.phone || ""; $("profileAddress").value = profile.address || ""; }
}

function fillCustomerDefaults() {
  $("bookingAddress").value = profile?.address || "";
}

async function saveBooking(event) {
  event.preventDefault();
  if (!selectedServices().length) {
    toast("Select at least one service to continue.");
    return;
  }
  try {
    await createBooking({
      customer: profile?.name || session.user.fullName,
      phone: profile?.phone || "",
      email: profile?.email || session.user.email,
      services: selectedServices(),
      preferredDate: $("bookingDate").value,
      preferredTime: document.querySelector('input[name="bookingTime"]:checked')?.value || "",
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

async function saveProfile(event) { event.preventDefault(); if (!validatePhoneField("profilePhone", "profilePhoneError")) return; try { profile = await updateCustomer(profile.id, { name: $("profileName").value.trim(), email: $("profileEmail").value.trim(), phone: $("profilePhone").value.trim(), address: $("profileAddress").value.trim() }); fillCustomerDefaults(); toast("Profile updated."); } catch (error) { toast(error.message); } }
async function savePassword(event, role) { event.preventDefault(); const prefix = role === "customer" ? "customer" : "technician"; const message = $(prefix + "PasswordMessage"); const next = $(prefix + "NewPassword").value; if (next !== $(prefix + "ConfirmPassword").value) { message.textContent = "New passwords do not match."; return; } try { const result = await changePassword({ currentPassword: $(prefix + "CurrentPassword").value, newPassword: next, confirmPassword: $(prefix + "ConfirmPassword").value }); message.textContent = result.message; event.target.reset(); } catch (error) { message.textContent = error.message; } }

function selectedServices() { return [...document.querySelectorAll("#bookingServices input:checked")].map((input) => ({ name: input.dataset.serviceName, price: Number(input.dataset.servicePrice) })); }
function updateBookingTotal() { $("bookingTotal").textContent = peso(selectedServices().reduce((sum, service) => sum + service.price, 0)); }
function validatePhoneField(inputId, errorId) { const input = $(inputId); input.value = input.value.replace(/\D/g, "").slice(0, 11); const valid = isValidPhilippineMobile(input.value); $(errorId).classList.toggle("hidden", valid || !input.value); input.setCustomValidity(valid ? "" : "Enter a valid 11-digit PH phone number starting with 09."); return valid; }
function bookingServiceChoice(service) { const type = String(service.type || "").trim(); const subtitle = type && type.toLowerCase() !== String(service.name).trim().toLowerCase() ? `<small>${escapeHtml(type)}</small>` : ""; const details = [bookingInfo("Included", service.inclusion, "✓"), bookingInfo("Not included", service.exclusion, "×")].filter(Boolean).join(""); return `<label class="service-choice"><div class="service-choice-top"><input type="checkbox" data-service-name="${escapeHtml(service.name)}" data-service-price="${Number(service.price) || 0}" /><span class="service-choice-copy"><strong>${escapeHtml(service.name)}</strong>${subtitle}</span><b>${peso(service.price)}</b></div>${details}</label>`; }
function bookingInfo(label, value, icon) { const items = String(value || "").split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean); return items.length ? `<span class="booking-service-info"><em>${label}:</em>${items.map((item) => `<i>${icon} ${escapeHtml(item)}</i>`).join("")}</span>` : ""; }
