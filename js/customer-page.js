import { cancelBooking, changePassword, createBooking, getBookings, getBrands, getCustomers, getProducts, getServices, matchServicePrice, updateCustomer } from "./api.js";
import { bindTabs, escapeHtml, isValidPhilippineMobile, logout, peso, renderProducts, renderServiceCards, requireRole, showTab, statusBadge, toast } from "./portal-utils.js";

const session = requireRole("customer");
let services = [];
let products = [];
let bookings = [];
let profile = null;
let brands = [];
const priceTimers = new WeakMap();
const timeSlots = ["6:00 AM – 8:00 AM", "8:00 AM – 11:00 AM", "1:00 PM – 3:00 PM", "3:00 PM – 5:00 PM"];
const $ = (id) => document.getElementById(id);
const serviceAreaCities = new Set(["san fernando", "naga", "minglanilla", "talisay", "talisay city", "cebu", "cebu city", "mandaue", "mandaue city", "consolacion", "liloan", "compostela", "danao", "danao city"]);
let bookingMap;
let bookingMarker;
let lastMapLookup = 0;
let bookingStep = 1;
let bookingAddressAutoLocated = false;

if (session) init();

async function init() {
  const initialTab = new URLSearchParams(window.location.search).get("tab") || "home";
  bindTabs(initialTab);
  updateWebsiteNav(initialTab, initialHomeSection());
  document.getElementById("logoutButton").addEventListener("click", logout);
  document.getElementById("bookingForm").addEventListener("submit", saveBooking);
  $("bookingNextButton").addEventListener("click", () => setBookingStep(bookingStep + 1));
  $("bookingBackButton").addEventListener("click", () => setBookingStep(bookingStep - 1));
  document.querySelectorAll("[data-booking-step]").forEach((button) => button.addEventListener("click", () => {
    const target = Number(button.dataset.bookingStep);
    if (target <= bookingStep) setBookingStep(target);
  }));
  initBookingMap();
  $("bookingDate").min = todayDate();
  $("bookingDate").addEventListener("input", () => { validateBookingDate(); updateBookingReview(); });
  $("bookingDate").addEventListener("change", updateBookingReview);
  $("bookingTimeSlots").addEventListener("change", updateBookingReview);
  $("bookingAddress").addEventListener("input", updateBookingReview);
  $("locateBookingAddress").addEventListener("click", () => locateBookingAddress(true));
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
      const option = detailButton.closest(".booking-service-card");
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
    const addUnit = event.target.closest("[data-add-unit]");
    if (addUnit) { event.preventDefault(); addUnitBlock(addUnit.dataset.addUnit); return; }
    const removeUnit = event.target.closest("[data-remove-unit]");
    if (removeUnit) { event.preventDefault(); removeUnit.closest(".booking-unit-block")?.remove(); updateBookingTotal(); return; }
    const stepper = event.target.closest("[data-unit-step]");
    if (stepper) { event.preventDefault(); adjustUnitValue(stepper); return; }
  });
  $("bookingServices").addEventListener("change", handleBookingServiceChange);
  $("bookingServices").addEventListener("input", handleBookingServiceChange);
  $("profilePhone").addEventListener("input", () => validatePhoneField("profilePhone", "profilePhoneError"));
  await loadAll();
  fillCustomerDefaults();
  setBookingStep(1);
}

async function loadAll() {
  const data = await Promise.all([getServices(), getProducts(), getBookings(), getCustomers(), getBrands()]);
  [services, products, bookings, , brands] = data;
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
  updateBookingTotal();
}

function fillCustomerDefaults() {
  $("bookingAddress").value = profile?.address || "";
}

async function saveBooking(event) {
  event.preventDefault();
  if (!validateBookingStep(1) || !validateBookingStep(2) || !validateBookingStep(3)) return;
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
    bookingStep = 1;
    await loadAll();
    setBookingStep(1);
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

function setBookingStep(nextStep) {
  const target = Math.max(1, Math.min(4, Number(nextStep) || 1));
  if (target > bookingStep) {
    for (let step = bookingStep; step < target; step += 1) {
      if (!validateBookingStep(step)) return;
    }
  }
  bookingStep = target;
  document.querySelectorAll("[data-booking-step-panel]").forEach((panel) => panel.classList.toggle("hidden", Number(panel.dataset.bookingStepPanel) !== bookingStep));
  document.querySelectorAll("[data-booking-step]").forEach((button) => {
    const step = Number(button.dataset.bookingStep);
    button.classList.toggle("is-current", step === bookingStep);
    button.classList.toggle("is-complete", step < bookingStep);
    button.setAttribute("aria-current", step === bookingStep ? "step" : "false");
  });
  $("bookingBackButton").classList.toggle("hidden", bookingStep === 1);
  $("bookingNextButton").classList.toggle("hidden", bookingStep === 4);
  $("bookingSubmitButton").classList.toggle("hidden", bookingStep !== 4);
  $("bookingSummaryStep").textContent = bookingStep;
  updateBookingReview();
  if (bookingStep === 3 && bookingMap) requestAnimationFrame(() => bookingMap.invalidateSize());
  if (bookingStep === 3 && !$('bookingLatitude').value && $('bookingAddress').value.trim() && !bookingAddressAutoLocated) {
    bookingAddressAutoLocated = true;
    locateBookingAddress(true);
  }
}

function validateBookingStep(step) {
  if (step === 1 && !selectedServices().length) {
    toast("Select at least one service to continue.");
    return false;
  }
  if (step === 2) {
    const validDate = validateBookingDate();
    const hasTime = Boolean(document.querySelector('input[name="bookingTime"]:checked'));
    if (!validDate) return false;
    if (!hasTime) { toast("Choose a preferred time slot to continue."); return false; }
  }
  if (step === 3) {
    if (!$('bookingAddress').value.trim()) { toast("Enter your service address to continue."); return false; }
    if (!$('bookingCity').value || !$('bookingLatitude').value || !$('bookingLongitude').value) {
      setMapMessage("Please drop a pin within our Metro Cebu service area before continuing.", true);
      toast("Please choose a valid service location on the map.");
      return false;
    }
  }
  return true;
}

async function chooseBookingLocation(event) {
  if (Date.now() - lastMapLookup < 1000) return;
  lastMapLookup = Date.now();
  if (bookingMarker) bookingMap.removeLayer(bookingMarker);
  bookingMarker = L.marker(event.latlng, { draggable: true }).addTo(bookingMap);
  bookingMarker.on("dragend", () => reverseGeocodeLocation(bookingMarker.getLatLng(), true));
  await reverseGeocodeLocation(event.latlng, false);
}

function applyGeocodedLocation(result) {
  const rawCity = result.address?.city || result.address?.municipality || result.address?.town || result.address?.village || "";
  if (!serviceAreaCities.has(rawCity.trim().toLowerCase())) {
    $("bookingCity").value = "";
    setMapMessage("We currently only operate within the Metro Cebu area (San Fernando to Danao City). This location is outside our service area.", true);
    return false;
  }
  $("bookingCity").value = rawCity;
  updateBookingReview();
  setMapMessage(`Location confirmed: ${rawCity}.`, false);
  return true;
}

async function locateBookingAddress(respectRateLimit = true) {
  const address = $("bookingAddress").value.trim();
  if (!address) { setMapMessage("Enter an address before locating it on the map.", true); return; }
  if (!bookingMap) { setMapMessage("The map is unavailable. Please drop a pin manually when it loads.", true); return; }
  if (respectRateLimit && Date.now() - lastMapLookup < 1000) return;
  lastMapLookup = Date.now();
  setMapMessage("Checking this address...", false);
  try {
    const segments = address.split(",").map((segment) => segment.trim()).filter(Boolean);
    const lastAttempt = Math.max(0, segments.length - 2);
    let result;
    let droppedSegments = 0;
    for (let attempt = 0; attempt <= lastAttempt; attempt += 1) {
      if (attempt > 0) {
        await new Promise((resolve) => setTimeout(resolve, Math.max(0, 1000 - (Date.now() - lastMapLookup))));
        lastMapLookup = Date.now();
      }
      const query = segments.slice(attempt).join(", ") || address;
      const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=1&countrycodes=ph`, { headers: { "Accept-Language": "en", "User-Agent": "GBP-Electro-Mechanical-Services/1.0" } });
      if (!response.ok) throw new Error("Location lookup failed.");
      const results = await response.json();
      if (results[0]) { result = results[0]; droppedSegments = attempt; break; }
    }
    if (!result) throw new Error("No location found.");
    const latlng = { lat: Number(result.lat), lng: Number(result.lon) };
    if (!Number.isFinite(latlng.lat) || !Number.isFinite(latlng.lng)) throw new Error("Invalid location returned.");
    if (bookingMarker) bookingMap.removeLayer(bookingMarker);
    bookingMarker = L.marker(latlng, { draggable: true }).addTo(bookingMap);
    bookingMarker.on("dragend", () => reverseGeocodeLocation(bookingMarker.getLatLng(), true));
    bookingMap.setView(latlng, Math.max(bookingMap.getZoom(), 14));
    $("bookingLatitude").value = latlng.lat.toFixed(6);
    $("bookingLongitude").value = latlng.lng.toFixed(6);
    updateBookingReview();
    if (applyGeocodedLocation(result) && droppedSegments > 0) {
      const rawCity = result.address?.city || result.address?.municipality || result.address?.town || result.address?.village || "the selected area";
      setMapMessage(`We found an approximate location near ${rawCity}. Please drag the pin to your exact address.`, false);
    }
  } catch (error) {
    $("bookingLatitude").value = "";
    $("bookingLongitude").value = "";
    $("bookingCity").value = "";
    if (bookingMarker) { bookingMap.removeLayer(bookingMarker); bookingMarker = null; }
    setMapMessage("We couldn't confirm this location. Please drop a pin manually instead.", true);
  }
}

async function reverseGeocodeLocation(latlng, enforceRateLimit) {
  $("bookingLatitude").value = latlng.lat.toFixed(6);
  $("bookingLongitude").value = latlng.lng.toFixed(6);
  $("bookingCity").value = "";
  updateBookingReview();
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
    applyGeocodedLocation(result);
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

function updateBookingTotalLegacy() {
  const selected = selectedServices();
  $("bookingTotal").textContent = peso(selected.reduce((sum, service) => sum + service.price, 0));
  $("bookingSummaryServices").innerHTML = selected.length
    ? selected.map((service) => `<div class="booking-summary-item"><span>${escapeHtml(service.name)}${service.hPower ? `<small>${escapeHtml([service.hPower, service.unitType].filter(Boolean).join(" · "))}</small>` : ""}</span><strong>${peso(service.price)}</strong></div>`).join("")
    : `<p class="booking-summary-empty">No services selected yet.</p>`;
  updateBookingReview();
}
function updateBookingReviewLegacy() {
  if (!$('bookingReviewServices')) return;
  const selected = selectedServices();
  $('bookingReviewServices').innerHTML = selected.length ? selected.map((service) => `<div class="booking-review-service"><span>${escapeHtml(service.name)}${service.hPower ? ` <small>${escapeHtml([service.hPower, service.unitType].filter(Boolean).join(" · "))}</small>` : ""}</span><strong>${peso(service.price)}</strong></div>`).join("") : `<span class="booking-review-muted">No services selected.</span>`;
  $('bookingReviewSchedule').textContent = [$("bookingDate").value, document.querySelector('input[name="bookingTime"]:checked')?.value].filter(Boolean).join(" · ") || "Not selected";
  $('bookingReviewAddress').textContent = $("bookingAddress").value.trim() || "Not selected";
  $('bookingReviewLocation').textContent = $("bookingCity").value ? `${$("bookingCity").value} · ${$("bookingLatitude").value}, ${$("bookingLongitude").value}` : "Not selected";
}
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

function bookingServiceChoiceLegacy(service) {
  const included = bookingInfo("Included", service.inclusion, "included");
  const excluded = bookingInfo("Not included", service.exclusion, "excluded");
  const details = included || excluded ? `<div class="booking-service-details">${included}${excluded}</div>` : "";
  const tiers = Array.isArray(service.priceTiers) ? service.priceTiers : [];
  const tierMarkup = tiers.length ? `<div class="booking-tier-pills">${tiers.map((tier) => `<label class="booking-tier-pill"><input type="radio" name="serviceTier-${service.id}" data-service-id="${service.id}" data-service-name="${escapeHtml(service.name)}" data-service-category="${escapeHtml(service.type || "Uncategorized")}" data-service-price="${Number(tier.amount) || 0}" data-tier-id="${tier.id}" data-h-power="${escapeHtml(tier.hPower || "")}" data-unit-type="${escapeHtml(tier.unitType || "")}" aria-label="Select ${escapeHtml(service.name)} ${escapeHtml(tier.hPower || "")}" /><span><strong>${escapeHtml([tier.hPower, tier.unitType].filter(Boolean).join(" · ") || "Price tier")}</strong><b>${peso(tier.amount)}</b></span></label>`).join("")}</div>` : `<label class="booking-base-choice"><input type="checkbox" data-service-id="${service.id}" data-service-name="${escapeHtml(service.name)}" data-service-category="${escapeHtml(service.type || "Uncategorized")}" data-service-price="${Number(service.price) || 0}" aria-label="Select ${escapeHtml(service.name)}" /><span><strong>Standard service</strong><b>${peso(service.price)}</b></span></label>`;
  return `<article class="booking-service-card"><div class="booking-service-card-header"><div><strong>${escapeHtml(service.name)}</strong><button type="button" class="variant-details-toggle" data-service-details aria-expanded="false">View details</button></div>${tiers.length ? `<span class="booking-tier-count">${tiers.length} price ${tiers.length === 1 ? "tier" : "tiers"}</span>` : ""}</div>${tierMarkup}${details}</article>`;
}

function bookingInfo(label, value, status) {
  const items = String(value || "").split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean);
  return items.length ? `<section class="booking-service-info booking-service-info--${status}"><h3>${label}</h3><ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></section>` : "";
}

// Per-unit pricing controls for tiered services.
function selectedServices() {
  return [...document.querySelectorAll("#bookingServices .booking-service-card")].flatMap((card) => {
    const toggle = card.querySelector("[data-service-unit-toggle]");
    const base = card.querySelector("[data-service-base-toggle]");
    const service = services.find((item) => String(item.id) === String(card.dataset.serviceId));
    if (!service) return [];
    if (toggle) {
      if (!toggle.checked) return [];
      const units = [...card.querySelectorAll(".booking-unit-block")].map((block) => {
        const value = (field) => block.querySelector(`[data-unit-field="${field}"]`)?.value || "";
        return { airconType: value("airconType"), brandId: Number(value("brandId")), technology: value("technology"), horsePower: Number(value("horsePower")), quantity: Number(value("quantity") || 1), price: Number(block.dataset.matchedPrice || 0), priceReady: block.dataset.priceReady === "true" };
      });
      return [{ id: Number(service.id), name: service.name, category: service.type, units, price: units.reduce((sum, unit) => sum + unit.price * unit.quantity, 0) }];
    }
    return base?.checked ? [{ id: Number(service.id), name: service.name, category: service.type, price: Number(base.dataset.servicePrice) || 0 }] : [];
  });
}

function updateBookingTotal() {
  const selected = selectedServices();
  $("bookingTotal").textContent = peso(selected.reduce((sum, service) => sum + service.price, 0));
  $("bookingSummaryServices").innerHTML = selected.length ? selected.map((service) => `<div class="booking-summary-item"><span>${escapeHtml(service.name)}${service.units ? service.units.map((unit) => `<small>${escapeHtml(`${unit.airconType || "Unit"} ${unit.technology || ""} ${unit.horsePower || ""}HP x ${unit.quantity || 1}`)}</small>`).join("") : ""}</span><strong>${peso(service.price)}</strong></div>`).join("") : `<p class="booking-summary-empty">No services selected yet.</p>`;
  updateBookingReview();
}

function updateBookingReview() {
  if (!$('bookingReviewServices')) return;
  const selected = selectedServices();
  $('bookingReviewServices').innerHTML = selected.length ? selected.map((service) => `<div class="booking-review-service"><span>${escapeHtml(service.name)}${service.units ? service.units.map((unit) => `<small>${escapeHtml(`${unit.airconType || "Unit"} ${unit.technology || ""} ${unit.horsePower || ""}HP x ${unit.quantity || 1}`)}</small>`).join("") : ""}</span><strong>${peso(service.price)}</strong></div>`).join("") : `<span class="booking-review-muted">No services selected.</span>`;
  $('bookingReviewSchedule').textContent = [$('bookingDate').value, document.querySelector('input[name="bookingTime"]:checked')?.value].filter(Boolean).join(" Â· ") || "Not selected";
  $('bookingReviewAddress').textContent = $('bookingAddress').value.trim() || "Not selected";
  $('bookingReviewLocation').textContent = $('bookingCity').value ? `${$('bookingCity').value} Â· ${$('bookingLatitude').value}, ${$('bookingLongitude').value}` : "Not selected";
}

function bookingServiceChoice(service) {
  const included = bookingInfo("Included", service.inclusion, "included");
  const excluded = bookingInfo("Not included", service.exclusion, "excluded");
  const details = included || excluded ? `<div class="booking-service-details">${included}${excluded}</div>` : "";
  const tiers = Array.isArray(service.priceTiers) ? service.priceTiers : [];
  const markup = tiers.length ? `<label class="booking-tier-service-toggle"><input type="checkbox" data-service-unit-toggle aria-label="Select ${escapeHtml(service.name)}" /><span>Select this service</span><b>Configure units</b></label><div class="booking-unit-blocks hidden" data-unit-blocks data-service-id="${service.id}">${unitBlockMarkup(service, 0)}<button type="button" class="booking-add-unit" data-add-unit="${service.id}">+ Add More Unit</button></div>` : `<label class="booking-base-choice"><input type="checkbox" data-service-base-toggle data-service-price="${Number(service.price) || 0}" aria-label="Select ${escapeHtml(service.name)}" /><span><strong>Standard service</strong><b>${peso(service.price)}</b></span></label>`;
  return `<article class="booking-service-card" data-service-id="${service.id}"><div class="booking-service-card-header"><div><strong>${escapeHtml(service.name)}</strong><button type="button" class="variant-details-toggle" data-service-details aria-expanded="false">View details</button></div>${tiers.length ? `<span class="booking-tier-count">${tiers.length} price tiers</span>` : ""}</div>${markup}${details}</article>`;
}

function unitBlockMarkup(service, index) {
  const options = brands.map((brand) => `<option value="${brand.id}">${escapeHtml(brand.name)}</option>`).join("");
  return `<div class="booking-unit-block"><div class="booking-unit-block-header"><strong>Aircon unit ${index + 1}</strong>${index ? `<button type="button" class="booking-remove-unit" data-remove-unit>Remove</button>` : ""}</div><div class="booking-unit-grid"><label class="booking-unit-field"><span>Aircon type</span><select data-unit-field="airconType"><option value="">Select type</option><option>Window</option><option>Split</option><option>Tower</option><option>U-shaped Window</option></select></label><label class="booking-unit-field"><span>Brand</span><select data-unit-field="brandId"><option value="">Select brand</option>${options}</select></label><label class="booking-unit-field"><span>Technology</span><select data-unit-field="technology"><option value="">Select technology</option><option value="Inverter">Inverter</option><option value="Non-Inverter">Non-Inverter</option><option value="Unknown">I don't know</option></select></label><label class="booking-unit-field"><span>No. of units</span><span class="booking-stepper"><button type="button" data-unit-step="minus" data-unit-field="quantity">-</button><input type="number" min="1" step="1" value="1" data-unit-field="quantity"><button type="button" data-unit-step="plus" data-unit-field="quantity">+</button></span></label><label class="booking-unit-field"><span>Cooling size (HP)</span><span class="booking-stepper"><button type="button" data-unit-step="minus" data-unit-field="horsePower">-</button><input type="number" min="0.5" step="0.5" value="0.5" data-unit-field="horsePower"><button type="button" data-unit-step="plus" data-unit-field="horsePower">+</button></span></label></div><div class="booking-unit-price" data-unit-price>Complete details to see matched price</div></div>`;
}

function addUnitBlock(serviceId) { const container = document.querySelector(`[data-unit-blocks][data-service-id="${CSS.escape(String(serviceId))}"]`); if (!container) return; const index = container.querySelectorAll(".booking-unit-block").length; container.querySelector("[data-add-unit]")?.insertAdjacentHTML("beforebegin", unitBlockMarkup(services.find((item) => String(item.id) === String(serviceId)), index)); updateBookingTotal(); }
function adjustUnitValue(button) { const input = button.closest(".booking-stepper")?.querySelector(`input[data-unit-field="${button.dataset.unitField}"]`); if (!input) return; const step = Number(input.step) || 1; const minimum = Number(input.min) || 0; input.value = String(Math.max(minimum, Number((Number(input.value || minimum) + (button.dataset.unitStep === "plus" ? step : -step)).toFixed(2)))); input.dispatchEvent(new Event("input", { bubbles: true })); }
function handleBookingServiceChange(event) { if (event.target.matches("[data-service-unit-toggle]")) event.target.closest(".booking-service-card").querySelector("[data-unit-blocks]")?.classList.toggle("hidden", !event.target.checked); if (event.target.matches("[data-unit-field]")) updateUnitPriceDebounced(event.target.closest(".booking-unit-block")); updateBookingTotal(); }
function updateUnitPriceDebounced(block) { if (!block) return; clearTimeout(priceTimers.get(block)); block.dataset.priceReady = "false"; const timer = setTimeout(async () => { const card = block.closest(".booking-service-card"); const hp = Number(block.querySelector('[data-unit-field="horsePower"]')?.value); const technology = block.querySelector('[data-unit-field="technology"]')?.value; const output = block.querySelector("[data-unit-price]"); if (!Number.isFinite(hp) || hp <= 0 || !technology) { output.textContent = "Complete details to see matched price"; updateBookingTotal(); return; } output.textContent = "Checking matched price..."; try { const result = await matchServicePrice(Number(card.dataset.serviceId), hp, technology); block.dataset.matchedPrice = String(result.amount); block.dataset.priceReady = "true"; output.textContent = `Matched price: ${peso(result.amount)} per unit`; } catch (error) { output.textContent = error.message; } updateBookingTotal(); }, 300); priceTimers.set(block, timer); }

function validateBookingStepLegacy(step) {
  const selected = selectedServices();
  if (step === 1 && !selected.length) { toast("Select at least one service to continue."); return false; }
  if (step === 1 && selected.some((service) => service.units?.some((unit) => !unit.airconType || !unit.technology || !Number.isInteger(unit.brandId) || unit.horsePower <= 0 || unit.quantity <= 0 || unit.priceReady !== true))) { toast("Complete the aircon details and wait for each unit price to load."); return false; }
  if (step === 2) { const validDate = validateBookingDate(); if (!validDate) return false; if (!document.querySelector('input[name="bookingTime"]:checked')) { toast("Choose a preferred time slot to continue."); return false; } }
  if (step === 3) { if (!$('bookingAddress').value.trim()) { toast("Enter your service address to continue."); return false; } if (!$('bookingCity').value || !$('bookingLatitude').value || !$('bookingLongitude').value) { setMapMessage("Please drop a pin within our Metro Cebu service area before continuing.", true); toast("Please choose a valid service location on the map."); return false; } }
  return true;
}
