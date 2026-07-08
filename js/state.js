import { formatActivityDate, slugify } from "./utils.js";

export const storageKey = "gbpServiceAdminDashboardV2";

export const initialState = {
  bookings: [],
  schedules: [],
  services: [],
  products: [],
  technicians: [],
  customers: [],
  activities: [],
  logs: [],
  session: null
};

export const els = {};

export const state = normalizeState(loadState());

export function loadState() {
  const stored = localStorage.getItem(storageKey);
  if (!stored) return structuredClone(initialState);

  try {
    return { ...structuredClone(initialState), ...JSON.parse(stored) };
  } catch {
    return structuredClone(initialState);
  }
}

export function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

export function normalizeState(nextState) {
  const normalized = { ...structuredClone(initialState), ...nextState };
  normalized.products = Array.isArray(normalized.products)
    ? normalized.products.map((product) => ({ ...product, id: String(product.id) }))
    : [];
  normalized.services = Array.isArray(normalized.services)
    ? normalized.services.map((service) => ({ ...service, id: String(service.id) }))
    : [];
  normalized.customers = Array.isArray(normalized.customers)
    ? normalized.customers.map((customer) => ({ ...customer, id: String(customer.id) }))
    : [];
  normalized.bookings = Array.isArray(normalized.bookings)
    ? normalized.bookings.map((booking) => ({ ...booking, id: String(booking.id) }))
    : [];
  normalized.logs = Array.isArray(normalized.logs) ? normalized.logs : [];
  normalized.technicians = normalized.technicians.map((tech) => ({
    id: String(tech.id || `tech-${slugify(tech.name || Date.now())}`),
    name: tech.name || "",
    specialty: tech.specialty || "General Service",
    status: tech.status || "Active"
  }));
  return normalized;
}

export function getApprovedCustomers() {
  const approvedStatuses = new Set(["Approved", "Assigned", "Completed", "In Progress"]);
  const approvedBookings = state.bookings.filter((booking) => approvedStatuses.has(booking.status));
  const customersById = new Map(state.customers.map((customer) => [customer.id, customer]));

  return approvedBookings.reduce((customers, booking) => {
    const id = customerIdFromBooking(booking);
    if (customers.some((customer) => customer.id === id)) return customers;
    const saved = customersById.get(id);
    customers.push({
      id,
      name: saved?.name || booking.customer,
      phone: saved?.phone || "",
      email: saved?.email || "",
      address: saved?.address || booking.address
    });
    return customers;
  }, []);
}

export function syncCustomerFromBooking(booking) {
  const id = customerIdFromBooking(booking);
  const existing = state.customers.find((customer) => customer.id === id);
  if (existing) {
    existing.name = existing.name || booking.customer;
    existing.address = existing.address || booking.address;
    return;
  }

  state.customers.push({
    id,
    name: booking.customer,
    phone: "",
    email: "",
    address: booking.address
  });
}

export function customerIdFromBooking(booking) {
  return `cust-${slugify(booking.customer)}`;
}

export function addActivity(icon, color, text) {
  state.activities.unshift({
    icon,
    color,
    text,
    time: `${formatActivityDate(new Date())} - Maria Santos`
  });
}
