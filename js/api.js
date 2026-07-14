const apiBaseUrl = "";
const sessionKey = "gbpServiceSession";

export function getSession() {
  const stored = localStorage.getItem(sessionKey);
  if (!stored) return null;

  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

export function setSession(session) {
  localStorage.setItem(sessionKey, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(sessionKey);
}

async function requestJson(url, options = {}) {
  const session = getSession();
  const response = await fetch(`${apiBaseUrl}${url}`, {
    headers: {
      "Content-Type": "application/json",
      ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
      ...options.headers
    },
    ...options
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Request failed." }));
    throw new Error(error.message || "Request failed.");
  }

  if (response.status === 204) return null;
  return response.json();
}

export function login(credentials) {
  return requestJson("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(credentials)
  });
}

export function registerAccount(account) {
  return requestJson("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(account)
  });
}

export function getProducts() {
  return requestJson("/api/products");
}

export function createProduct(product) {
  return requestJson("/api/products", {
    method: "POST",
    body: JSON.stringify(product)
  });
}

export function updateProduct(id, product) {
  return requestJson(`/api/products/${id}`, {
    method: "PUT",
    body: JSON.stringify(product)
  });
}

export async function removeProduct(id) {
  await requestJson(`/api/products/${id}`, { method: "DELETE" });
}

export function getServices() {
  return requestJson("/api/services");
}

export function createService(service) {
  return requestJson("/api/services", {
    method: "POST",
    body: JSON.stringify(service)
  });
}

export function updateService(id, service) {
  return requestJson(`/api/services/${id}`, {
    method: "PUT",
    body: JSON.stringify(service)
  });
}

export async function removeService(id) {
  await requestJson(`/api/services/${id}`, { method: "DELETE" });
}

export function getTechnicians() {
  return requestJson("/api/technicians");
}

export function createTechnician(technician) {
  return requestJson("/api/technicians", {
    method: "POST",
    body: JSON.stringify(technician)
  });
}

export function updateTechnician(id, technician) {
  return requestJson(`/api/technicians/${id}`, {
    method: "PUT",
    body: JSON.stringify(technician)
  });
}

export function getMyTechnicianProfile() {
  return requestJson("/api/technicians/me");
}

export function updateMyTechnicianProfile(profile) {
  return requestJson("/api/technicians/me", {
    method: "PUT",
    body: JSON.stringify(profile)
  });
}

export async function removeTechnician(id) {
  await requestJson(`/api/technicians/${id}`, { method: "DELETE" });
}

export function getCustomers() {
  return requestJson("/api/customers");
}

export function createCustomer(customer) {
  return requestJson("/api/customers", {
    method: "POST",
    body: JSON.stringify(customer)
  });
}

export function updateCustomer(id, customer) {
  return requestJson(`/api/customers/${id}`, {
    method: "PUT",
    body: JSON.stringify(customer)
  });
}

export async function removeCustomer(id) {
  await requestJson(`/api/customers/${id}`, { method: "DELETE" });
}

export function getBookings() {
  return requestJson("/api/bookings");
}

export function createBooking(booking) {
  return requestJson("/api/bookings", {
    method: "POST",
    body: JSON.stringify(booking)
  });
}

export function updateBookingStatus(id, status) {
  return requestJson(`/api/bookings/${id}/status`, {
    method: "PUT",
    body: JSON.stringify({ status })
  });
}

export function updateTechnicianJobStatus(id, status) {
  return requestJson(`/api/bookings/${id}/technician-status`, {
    method: "PUT",
    body: JSON.stringify({ status })
  });
}

export async function removeBooking(id) {
  await requestJson(`/api/bookings/${id}`, { method: "DELETE" });
}

export function createSchedule(schedule) {
  return requestJson("/api/schedules", {
    method: "POST",
    body: JSON.stringify(schedule)
  });
}

export function getLogs() {
  return requestJson("/api/logs");
}
