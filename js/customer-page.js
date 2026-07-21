import { cancelBooking, changePassword, createBooking, getBookings, getCustomers, getProducts, getServices, updateCustomer } from "./api.js";
import { bindTabs, escapeHtml, isValidPhilippineMobile, logout, peso, renderProducts, renderServiceCards, requireRole, showTab, statusBadge, toast } from "./portal-utils.js";

const session = requireRole("customer");
let services = [];
let products = [];
let bookings = [];
let profile = null;
const timeSlots = ["6:00 AM – 8:00 AM", "8:00 AM – 11:00 AM", "1:00 PM – 3:00 PM", "3:00 PM – 5:00 PM"];
const $ = (id) => document.getElementById(id);

if (session) init();

async function init() {
  const initialTab = new URLSearchParams(window.location.search).get("tab") || "home";
  bindTabs(initialTab);
  updateWebsiteNav(initialTab, initialHomeSection());
  document.getElementById("logoutButton").addEventListener("click", logout);
  document.getElementById("bookingForm").addEventListener("submit", saveBooking);
  $("bookingDate").min = todayDate();
  $("bookingDate").addEventListener("input", validateBookingDate);
  $("closeBookingConfirmation").addEventListener("click", closeBookingConfirmation);
  document.getElementById("profileForm").addEventListener("submit", saveProfile);
  document.getElementById("customerPasswordForm").addEventListener("submit", (event) => savePassword(event, "customer"));
  document.querySelectorAll("[data-home-section]").forEach((control) => control.addEventListener("click", (event) => {
    event.preventDefault();
    const sectionId = control.dataset.homeSection;
    showTab("home");
    updateWebsiteNav("home", sectionId);
    history.replaceState(null, "", `#${sectionId}`);
    requestAnimationFrame(() => document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }));
  document.querySelectorAll(".website-link[data-tab]").forEach((control) => control.addEventListener("click", () => updateWebsiteNav(control.dataset.tab)));
  window.addEventListener("hashchange", () => {
    showTab("home");
    updateWebsiteNav("home", initialHomeSection());
  });
  document.body.addEventListener("click", (event) => {
    const cancelButton = event.target.closest("[data-cancel-booking]");
    if (cancelButton) return cancelCustomerBooking(cancelButton.dataset.cancelBooking);
    const detailButton = event.target.closest("[data-service-details]");
    if (detailButton) {
      event.preventDefault();
      const option = detailButton.closest(".booking-variant");
      const expanded = option.classList.toggle("is-expanded");
      detailButton.setAttribute("aria-expanded", String(expanded));
      detailButton.textContent = expanded ? "Hide details" : "View details";
      return;
    }
    if (event.target.closest("[data-book-service]")) {
      const id = event.target.closest("[data-book-service]").dataset.bookService;
      document.querySelector(`[data-service-id="${CSS.escape(id)}"]`)?.click();
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
  const rows = bookings.length ? bookings.map((booking) => `<tr><td>${booking.id}</td><td>${escapeHtml(booking.service)}</td><td>${escapeHtml([booking.preferredDate, booking.preferredTime].filter(Boolean).join(" "))}</td><td>${escapeHtml(booking.technician || "Unassigned")}</td><td>${statusBadge(booking.status)}</td><td>${canCancel(booking) ? `<button class="tiny-button danger-button" data-cancel-booking="${booking.id}">Cancel</button>` : "—"}</td></tr>`).join("") : `<tr><td colspan="6" class="text-center text-slate-500">No bookings yet.</td></tr>`;
  document.getElementById("bookingsBody").innerHTML = rows;
  renderServiceCards(services, { customer: true });
  $("bookingServices").innerHTML = bookingServiceCategories(services);
  $("bookingTimeSlots").innerHTML = timeSlots.map((slot, index) => `<label class="time-slot"><input type="radio" name="bookingTime" value="${slot}" ${index === 0 ? "required" : ""}/><span>${slot}</span></label>`).join("");
  renderProducts(products, { customer: true });
  if (profile) { $("profileName").value = profile.name || ""; $("profileEmail").value = profile.email || ""; $("profilePhone").value = profile.phone || ""; $("profileAddress").value = profile.address || ""; }
}

function fillCustomerDefaults() {
  $("bookingAddress").value = profile?.address || "";
}

async function saveBooking(event) {
  event.preventDefault();
  if (!validateBookingDate()) return;
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
    await loadAll();
    $("bookingConfirmationModal").classList.remove("hidden");
  } catch (error) {
    if (error.message.startsWith("Preferred date cannot")) {
      $("bookingDateError").textContent = error.message;
      $("bookingDateError").classList.remove("hidden");
    }
    toast(error.message);
  }
}

function todayDate() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function validateBookingDate() {
  const input = $("bookingDate");
  const invalid = Boolean(input.value) && input.value < todayDate();
  input.setCustomValidity(invalid ? "Preferred date cannot be in the past." : "");
  $("bookingDateError").classList.toggle("hidden", !invalid);
  return !invalid;
}

function canCancel(booking) { return !["Completed", "Cancelled"].includes(booking.status); }

async function cancelCustomerBooking(id) {
  if (!confirm("Cancel this booking request?")) return;
  try {
    await cancelBooking(id);
    toast("Booking cancelled.");
    await loadAll();
  } catch (error) {
    toast(error.message);
  }
}

function closeBookingConfirmation() { $("bookingConfirmationModal").classList.add("hidden"); }

function updateWebsiteNav(tab, homeSection = "services") {
  document.querySelectorAll(".website-links .website-link").forEach((link) => {
    const active = tab === "home" ? link.dataset.homeSection === homeSection : link.dataset.tab === tab;
    link.classList.toggle("active", active);
  });
}

function initialHomeSection() {
  const section = window.location.hash.replace("#", "");
  return ["services", "products"].includes(section) ? section : "services";
}

async function saveProfile(event) { event.preventDefault(); if (!validatePhoneField("profilePhone", "profilePhoneError")) return; try { profile = await updateCustomer(profile.id, { name: $("profileName").value.trim(), email: $("profileEmail").value.trim(), phone: $("profilePhone").value.trim(), address: $("profileAddress").value.trim() }); fillCustomerDefaults(); toast("Profile updated."); } catch (error) { toast(error.message); } }
async function savePassword(event, role) { event.preventDefault(); const prefix = role === "customer" ? "customer" : "technician"; const message = $(prefix + "PasswordMessage"); const next = $(prefix + "NewPassword").value; if (next !== $(prefix + "ConfirmPassword").value) { message.textContent = "New passwords do not match."; return; } try { const result = await changePassword({ currentPassword: $(prefix + "CurrentPassword").value, newPassword: next, confirmPassword: $(prefix + "ConfirmPassword").value }); message.textContent = result.message; event.target.reset(); } catch (error) { message.textContent = error.message; } }

function selectedServices() { return [...document.querySelectorAll("#bookingServices input:checked")].map((input) => ({ id: Number(input.dataset.serviceId), name: input.dataset.serviceName, category: input.dataset.serviceCategory, price: Number(input.dataset.servicePrice) })); }
function updateBookingTotal() { $("bookingTotal").textContent = peso(selectedServices().reduce((sum, service) => sum + service.price, 0)); }
function validatePhoneField(inputId, errorId) { const input = $(inputId); input.value = input.value.replace(/\D/g, "").slice(0, 11); const valid = isValidPhilippineMobile(input.value); $(errorId).classList.toggle("hidden", valid || !input.value); input.setCustomValidity(valid ? "" : "Enter a valid 11-digit PH phone number starting with 09."); return valid; }
function bookingServiceCategories(items) {
  const categories = new Map();
  items.forEach((service) => {
    const category = String(service.type || "Uncategorized").trim() || "Uncategorized";
    if (!categories.has(category)) categories.set(category, []);
    categories.get(category).push(service);
  });
  return [...categories.entries()].map(([category, variants]) => `<section class="booking-category"><header><div><span>Service category</span><h3>${escapeHtml(category)}</h3></div><b>${variants.length} ${variants.length === 1 ? "option" : "options"}</b></header><div class="booking-variant-list">${variants.map(bookingServiceChoice).join("")}</div></section>`).join("");
}

function bookingServiceChoice(service) {
  const included = bookingInfo("Included", service.inclusion, "included");
  const excluded = bookingInfo("Not included", service.exclusion, "excluded");
  const details = included || excluded ? `<div class="booking-service-details">${included}${excluded}</div>` : "";
  return `<label class="booking-variant"><span class="service-choice-top"><input type="checkbox" data-service-id="${service.id}" data-service-name="${escapeHtml(service.name)}" data-service-category="${escapeHtml(service.type || "Uncategorized")}" data-service-price="${Number(service.price) || 0}" aria-label="Select ${escapeHtml(service.name)}" /><span class="service-choice-copy"><strong>${escapeHtml(service.name)}</strong><button type="button" class="variant-details-toggle" data-service-details aria-expanded="false">View details</button></span><b>${peso(service.price)}</b></span>${details}</label>`;
}

function bookingInfo(label, value, status) {
  const items = String(value || "").split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean);
  return items.length ? `<section class="booking-service-info booking-service-info--${status}"><h3>${label}</h3><ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></section>` : "";
}
