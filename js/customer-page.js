import { cancelBooking, changePassword, createBooking, getBookings, getCustomers, getProducts, getServices, updateCustomer } from "./api.js";
import { bindTabs, escapeHtml, isValidPhilippineMobile, logout, peso, renderProducts, renderServiceCards, requireRole, showTab, statusBadge, toast } from "./portal-utils.js";

const session = requireRole("customer");
let services = [];
let products = [];
let bookings = [];
let profile = null;
const timeSlots = ["6:00 AM – 8:00 AM", "8:00 AM – 11:00 AM", "1:00 PM – 3:00 PM", "3:00 PM – 5:00 PM"];
const $ = (id) => document.getElementById(id);
const serviceAreaCities = new Set(["san fernando", "naga", "minglanilla", "talisay", "talisay city", "cebu", "cebu city", "mandaue", "mandaue city", "consolacion", "liloan", "compostela", "danao", "danao city"]);
let bookingMap;
let bookingMarker;
let lastMapLookup = 0;

if (session) init();

async function init() {
  const initialTab = new URLSearchParams(window.location.search).get("tab") || "home";
  bindTabs(initialTab);
  updateWebsiteNav(initialTab, initialHomeSection());
  document.getElementById("logoutButton").addEventListener("click", logout);
  document.getElementById("bookingForm").addEventListener("submit", saveBooking);
  initBookingMap();
  $("bookingDate").min = todayDate();
  $("bookingDate").addEventListener("input", validateBookingDate);
  $("closeBookingConfirmation").addEventListener("click", closeBookingConfirmation);
  document.getElementById("profileForm").addEventListener("submit", saveProfile);
  ensureProfileCityField();
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
  const rows = bookings.length ? bookings.map((booking) => `<tr><td>${booking.id}</td><td>${escapeHtml(booking.service)}</td><td>${escapeHtml([booking.preferredDate, booking.preferredTime].filter(Boolean).join(" "))}</td><td>${escapeHtml(booking.technician || "Unassigned")}</td><td>${statusBadge(booking.status)}${booking.status === "Unable to Complete" && booking.unableToCompleteReason ? `<small class="job-reason">Reason: ${escapeHtml(booking.unableToCompleteReason)}</small>` : ""}</td><td>${canCancel(booking) ? `<button class="tiny-button danger-button" data-cancel-booking="${booking.id}">Cancel</button>` : "—"}</td></tr>`).join("") : `<tr><td colspan="6" class="text-center text-slate-500">No bookings yet.</td></tr>`;
  document.getElementById("bookingsBody").innerHTML = rows;
  renderServiceCards(services, { customer: true });
  $("bookingServices").innerHTML = bookingServiceCategories(services);
  $("bookingTimeSlots").innerHTML = timeSlots.map((slot, index) => `<label class="time-slot"><input type="radio" name="bookingTime" value="${slot}" ${index === 0 ? "required" : ""}/><span>${slot}</span></label>`).join("");
  renderProducts(products, { customer: true });
  if (profile) { $("profileName").value = profile.name || ""; $("profileEmail").value = profile.email || ""; $("profilePhone").value = profile.phone || ""; $("profileAddress").value = profile.address || ""; $("profileCity").value = profile.city || ""; }
}

function fillCustomerDefaults() {
  $("bookingAddress").value = profile?.address || "";
}

async function saveBooking(event) {
  event.preventDefault();
  if (!validateBookingDate()) return;
  if (!$("bookingCity").value || !$("bookingLatitude").value || !$("bookingLongitude").value) {
    setMapMessage("Please drop a pin within our Metro Cebu service area before submitting.", true);
    toast("Please choose a valid service location on the map.");
    return;
  }
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
      address: $("bookingAddress").value.trim(),
      city: $("bookingCity").value,
      latitude: $("bookingLatitude").value,
      longitude: $("bookingLongitude").value
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

function ensureProfileCityField() {
  if ($("profileCity")) return;
  const field = document.createElement("label");
  field.className = "form-field";
  field.innerHTML = `<span>Service area city</span><select id="profileCity" required><option value="">Select city/municipality</option>${["San Fernando", "Naga", "Minglanilla", "Talisay City", "Cebu City", "Mandaue City", "Consolacion", "Liloan", "Compostela", "Danao City"].map((city) => `<option>${city}</option>`).join("")}</select>`;
  $("profilePhone").closest("label").after(field);
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
  const booking = bookings.find((item) => String(item.id) === String(id));
  const message = booking?.status === "In Progress"
    ? "Your technician is already on site. Cancelling now will incur a ₱450 fee for their time and travel, payable on-site. Do you want to continue?"
    : "Cancel this booking request?";
  if (!confirm(message)) return;
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

async function saveProfile(event) { event.preventDefault(); if (!validatePhoneField("profilePhone", "profilePhoneError")) return; try { profile = await updateCustomer(profile.id, { name: $("profileName").value.trim(), email: $("profileEmail").value.trim(), phone: $("profilePhone").value.trim(), address: $("profileAddress").value.trim(), city: $("profileCity").value }); fillCustomerDefaults(); toast("Profile updated."); } catch (error) { toast(error.message); } }
async function savePassword(event, role) { event.preventDefault(); const prefix = role === "customer" ? "customer" : "technician"; const message = $(prefix + "PasswordMessage"); const next = $(prefix + "NewPassword").value; if (next !== $(prefix + "ConfirmPassword").value) { message.textContent = "New passwords do not match."; return; } try { const result = await changePassword({ currentPassword: $(prefix + "CurrentPassword").value, newPassword: next, confirmPassword: $(prefix + "ConfirmPassword").value }); message.textContent = result.message; event.target.reset(); } catch (error) { message.textContent = error.message; } }

function initBookingMap() {
  if (!window.L || !$("bookingMap")) return;
  bookingMap = L.map("bookingMap").setView([10.3157, 123.8854], 10);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "&copy; OpenStreetMap contributors" }).addTo(bookingMap);
  bookingMap.on("click", chooseBookingLocation);
  const refreshMapSize = () => bookingMap.invalidateSize();
  requestAnimationFrame(refreshMapSize);
  setTimeout(refreshMapSize, 150);
  setTimeout(refreshMapSize, 500);
  window.addEventListener("resize", refreshMapSize);
  if (window.ResizeObserver) new ResizeObserver(refreshMapSize).observe($("bookingMap"));
}

async function chooseBookingLocation(event) {
  if (Date.now() - lastMapLookup < 1000) return;
  lastMapLookup = Date.now();
  if (bookingMarker) bookingMap.removeLayer(bookingMarker);
  bookingMarker = L.marker(event.latlng, { draggable: true }).addTo(bookingMap);
  bookingMarker.on("dragend", () => reverseGeocodeLocation(bookingMarker.getLatLng(), true));
  await reverseGeocodeLocation(event.latlng, false);
}

async function reverseGeocodeLocation(latlng, enforceRateLimit) {
  $("bookingLatitude").value = latlng.lat.toFixed(6);
  $("bookingLongitude").value = latlng.lng.toFixed(6);
  $("bookingCity").value = "";
  if (enforceRateLimit) {
    if (Date.now() - lastMapLookup < 1000) return;
    lastMapLookup = Date.now();
  }
  setMapMessage("Checking this location…", false);
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latlng.lat}&lon=${latlng.lng}&format=json&zoom=18&addressdetails=1`, { headers: { "Accept-Language": "en", "User-Agent": "GBP-Electro-Mechanical-Services/1.0" } });
    if (!response.ok) throw new Error("Location lookup failed.");
    const result = await response.json();
    $("bookingAddress").value = detailedAddressFromGeocode(result);
    const rawCity = result.address?.city || result.address?.municipality || result.address?.town || result.address?.village || "";
    if (!serviceAreaCities.has(rawCity.trim().toLowerCase())) {
      setMapMessage("We currently only operate within the Metro Cebu area (San Fernando to Danao City). This location is outside our service area.", true);
      return;
    }
    $("bookingCity").value = rawCity;
    setMapMessage(`Location confirmed: ${rawCity}.`, false);
  } catch (error) {
    setMapMessage("We couldn't confirm this location. Please choose another point on the map.", true);
  }
}

function detailedAddressFromGeocode(result = {}) {
  const displayName = String(result.display_name || "").trim();
  const address = result.address || {};
  const displayParts = displayName.split(",").map((part) => part.trim()).filter(Boolean);
  if (displayName && (address.house_number || address.road || displayParts.length >= 4)) return displayName;
  return [address.road, address.suburb || address.neighbourhood, address.city || address.town || address.municipality, address.state, address.country]
    .map((part) => String(part || "").trim()).filter(Boolean).join(", ") || displayName;
}

function setMapMessage(message, isError) { const element = $("bookingMapMessage"); element.textContent = message; element.classList.toggle("field-error", isError); element.classList.toggle("form-note", !isError); }

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
