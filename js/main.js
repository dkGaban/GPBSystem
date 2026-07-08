import { clearSession, getBookings, getCustomers, getLogs, getProducts, getServices, getSession, getTechnicians, login, registerAccount, setSession } from "./api.js";
import { els, state } from "./state.js";
import { render } from "./render.js";
import {
  handleBookingSave,
  handleAction,
  handleAssignment,
  handleCustomerSave,
  handleProductSave,
  handleServiceSave,
  handleTechnicianSave,
  showView
} from "./handlers.js";
import { closeModal, closeOnBackdrop, openCustomerModal, openProductModal, openServiceModal, openTechnicianModal } from "./modals.js";

document.addEventListener("DOMContentLoaded", async () => {
  cacheElements();
  bindEvents();
  state.session = getSession();
  if (state.session) {
    await startApp(state.session);
  } else {
    showAuth();
  }
});

async function startApp(session) {
  state.session = session;
  els.authShell?.classList.add("hidden");
  els.appShell?.classList.remove("hidden");
  updateSessionHeader();
  await loadDatabaseState();
  configureRoleNavigation();
  render();
}

function showAuth() {
  els.appShell?.classList.add("hidden");
  els.authShell?.classList.remove("hidden");
  refreshAuthIcons();
}

async function loadDatabaseState() {
  await loadServices();
  await loadProducts();
  if (state.session?.user?.role !== "guest") {
    await Promise.all([loadTechnicians(), loadCustomers(), loadBookings()]);
  }
  if (state.session?.user?.role === "admin") await loadLogs();
}

async function loadServices() {
  try {
    const services = await getServices();
    state.services = services.map((service) => ({ ...service, id: String(service.id) }));
  } catch (error) {
    console.error(error);
  }
}

async function loadProducts() {
  try {
    const products = await getProducts();
    state.products = products.map((product) => ({ ...product, id: String(product.id) }));
  } catch (error) {
    console.error(error);
  }
}

async function loadTechnicians() {
  try {
    const technicians = await getTechnicians();
    state.technicians = technicians.map((technician) => ({ ...technician, id: String(technician.id) }));
  } catch (error) {
    console.error(error);
  }
}

async function loadCustomers() {
  try {
    const customers = await getCustomers();
    state.customers = customers.map((customer) => ({ ...customer, id: String(customer.id) }));
  } catch (error) {
    console.error(error);
  }
}

async function loadBookings() {
  try {
    const bookings = await getBookings();
    state.bookings = bookings.map((booking) => ({ ...booking, id: String(booking.id) }));
    state.schedules = state.bookings
      .filter((booking) => booking.technician)
      .map((booking) => ({
        technician: booking.technician,
        bookingId: booking.id,
        service: booking.service,
        time: [booking.scheduleDate, booking.scheduleTime].filter(Boolean).join(" "),
        address: booking.address,
        status: booking.status
      }));
  } catch (error) {
    console.error(error);
  }
}

async function loadLogs() {
  try {
    state.logs = await getLogs();
  } catch (error) {
    console.error(error);
  }
}

export function cacheElements() {
  [
    "authShell",
    "appShell",
    "loginForm",
    "loginEmail",
    "loginPassword",
    "registerForm",
    "registerName",
    "registerEmail",
    "registerPassword",
    "registerPhone",
    "registerAddress",
    "continueGuestButton",
    "logoutButton",
  "sessionUserName",
  "sessionUserRole",
    "dashboardTitle",
    "dashboardSubtitle",
    "statsGrid",
    "bookingRequestsBody",
    "allBookingsBody",
    "assignBooking",
    "assignTechnician",
    "assignSchedule",
    "assignmentForm",
    "scheduleList",
    "schedulesPageList",
    "servicesBody",
    "servicesPageBody",
    "productsGrid",
    "activityLog",
    "activityFooter",
    "requestSummary",
    "bookingModal",
    "bookingModalContent",
    "serviceModal",
    "serviceForm",
    "serviceModalTitle",
    "serviceId",
    "serviceName",
    "serviceType",
    "servicePrice",
    "serviceInclusion",
    "serviceExclusion",
    "customersBody",
    "customerModal",
    "customerForm",
    "customerModalTitle",
    "customerId",
    "customerName",
    "customerPhone",
    "customerEmail",
    "customerAddress",
    "technicianModal",
    "technicianForm",
    "technicianModalTitle",
    "technicianId",
    "technicianName",
    "technicianSpecialty",
    "technicianStatus",
    "techniciansBody",
    "productModal",
    "productForm",
    "productModalTitle",
    "productId",
    "productName",
    "productType",
    "productBrand",
    "productPrice",
    "productStocks",
    "productHorsepower",
    "productImage",
    "productExistingImage",
    "reportsGrid",
    "logsBody",
    "bookingForm",
    "bookingCustomer",
    "bookingPhone",
    "bookingEmail",
    "bookingService",
    "bookingDate",
    "bookingTime",
    "bookingAddress",
    "toast"
  ].forEach((id) => {
    els[id] = document.getElementById(id);
  });
}

export function bindEvents() {
  document.getElementById("sidebarNav").addEventListener("click", (event) => {
    const button = event.target.closest("[data-view]");
    if (!button) return;
    showView(button.dataset.view);
  });

  document.body.addEventListener("click", (event) => {
    const actionButton = event.target.closest("[data-action]");
    const navButton = event.target.closest("[data-nav-target]");
    const closeButton = event.target.closest("[data-close-modal]");

    if (actionButton) handleAction(actionButton.dataset.action, actionButton.dataset.id);
    if (navButton) showView(navButton.dataset.navTarget);
    if (closeButton) closeModal(closeButton.dataset.closeModal);
  });

  els.bookingModal?.addEventListener("click", closeOnBackdrop);
  els.serviceModal?.addEventListener("click", closeOnBackdrop);
  els.customerModal?.addEventListener("click", closeOnBackdrop);
  els.technicianModal?.addEventListener("click", closeOnBackdrop);
  els.productModal?.addEventListener("click", closeOnBackdrop);

  els.assignmentForm?.addEventListener("submit", handleAssignment);
  els.bookingForm?.addEventListener("submit", handleBookingSave);
  els.serviceForm?.addEventListener("submit", handleServiceSave);
  els.customerForm?.addEventListener("submit", handleCustomerSave);
  els.technicianForm?.addEventListener("submit", handleTechnicianSave);
  els.productForm?.addEventListener("submit", handleProductSave);

  document.getElementById("manageServicesButton")?.addEventListener("click", () => showView("services"));
  document.getElementById("addServicePageButton")?.addEventListener("click", () => openServiceModal());
  document.getElementById("addCustomerButton")?.addEventListener("click", () => openCustomerModal());
  document.getElementById("addTechnicianButton")?.addEventListener("click", () => openTechnicianModal());
  document.getElementById("addProductButton")?.addEventListener("click", () => openProductModal());

  document.querySelectorAll("[data-auth-tab]").forEach((button) => {
    button.addEventListener("click", () => switchAuthTab(button.dataset.authTab));
  });
  els.loginForm?.addEventListener("submit", handleLogin);
  els.registerForm?.addEventListener("submit", handleRegister);
  els.continueGuestButton?.addEventListener("click", () => startApp({ user: { fullName: "Guest", role: "guest", email: "" }, token: "" }));
  els.logoutButton?.addEventListener("click", handleLogout);
}

async function handleLogin(event) {
  event.preventDefault();
  try {
    const session = await login({
      email: els.loginEmail.value.trim(),
      password: els.loginPassword.value
    });
    if (!sessionMatchesPortal(session)) return;
    setSession(session);
    await startApp(session);
  } catch (error) {
    alert(error.message);
  }
}

async function handleRegister(event) {
  event.preventDefault();
  try {
    const session = await registerAccount({
      fullName: els.registerName.value.trim(),
      email: els.registerEmail.value.trim(),
      password: els.registerPassword.value,
      phone: els.registerPhone.value.trim(),
      address: els.registerAddress.value.trim(),
      role: "customer"
    });
    if (!sessionMatchesPortal(session)) return;
    setSession(session);
    await startApp(session);
  } catch (error) {
    alert(error.message);
  }
}

function handleLogout() {
  clearSession();
  window.location.reload();
}

function switchAuthTab(tab) {
  document.querySelectorAll("[data-auth-tab]").forEach((button) => button.classList.toggle("active", button.dataset.authTab === tab));
  els.loginForm.classList.toggle("hidden", tab !== "login");
  els.registerForm.classList.toggle("hidden", tab !== "register");
}

function updateSessionHeader() {
  const user = state.session?.user;
  if (!user) return;
  els.sessionUserName.textContent = user.fullName || "Guest";
  els.sessionUserRole.textContent = user.role === "admin" ? "Administrator" : user.role.charAt(0).toUpperCase() + user.role.slice(1);
}

function configureRoleNavigation() {
  const role = state.session?.user?.role || "guest";
  const allowed = {
    admin: ["dashboard", "customers", "bookings", "schedules", "technicians", "services", "products", "reports", "logs", "profile"],
    customer: ["dashboard", "bookings", "services", "products", "profile"],
    technician: ["dashboard", "bookings", "schedules", "customers", "profile"],
    guest: ["services", "products"]
  }[role];

  document.querySelectorAll("[data-view]").forEach((button) => {
    button.classList.toggle("hidden", !allowed.includes(button.dataset.view));
  });

  const firstView = allowed[0];
  showView(firstView);
}

function sessionMatchesPortal(session) {
  const portal = sessionStorage.getItem("gbpPortal");
  if (!portal || portal === "guest" || session.user.role === portal) return true;
  alert(`This is the ${portal} portal. Please use a ${portal} account.`);
  return false;
}

function refreshAuthIcons() {
  if (window.lucide) window.lucide.createIcons({ attrs: { "stroke-width": 2 } });
}
