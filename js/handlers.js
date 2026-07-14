import {
  createBooking,
  createCustomer,
  createProduct,
  createSchedule,
  createService,
  createTechnician,
  getLogs,
  removeBooking,
  removeCustomer,
  removeProduct,
  removeService,
  removeTechnician,
  updateBookingStatus as updateBookingStatusApi,
  updateCustomer,
  updateProduct,
  updateService,
  updateTechnician
} from "./api.js";
import { addActivity, els, saveState, state, syncCustomerFromBooking } from "./state.js";
import { render } from "./render.js";
import {
  openBookingModal,
  openCustomerModal,
  openProductModal,
  openServiceModal,
  openTechnicianModal,
  closeModal
} from "./modals.js";
import { formatDateTime, formatTime, refreshIcons, showToast, slugify } from "./utils.js";

export function handleAction(action, id) {
  const handlers = {
    "approve-booking": () => updateBookingStatus(id, "Approved"),
    "reject-booking": () => updateBookingStatus(id, "Rejected"),
    "view-booking": () => openBookingModal(id),
    "delete-booking": () => deleteBooking(id),
    "edit-service": () => openServiceModal(id),
    "delete-service": () => deleteService(id),
    "edit-customer": () => openCustomerModal(id),
    "delete-customer": () => deleteCustomer(id),
    "edit-technician": () => openTechnicianModal(id),
    "delete-technician": () => deleteTechnician(id),
    "edit-product": () => openProductModal(id),
    "delete-product": () => deleteProduct(id),
    "guest-booking": () => promptLoginForBooking()
  };

  handlers[action]?.();
}

export async function updateBookingStatus(id, status) {
  const booking = state.bookings.find((item) => item.id === id);
  if (!booking) return;

  try {
    await updateBookingStatusApi(id, status);
    booking.status = status;
    if (status === "Approved") syncCustomerFromBooking(booking);
    await refreshLogs();
    addActivity(status === "Approved" ? "check" : "x", status === "Approved" ? "bg-emerald-500" : "bg-rose-500", `Booking ${id} was ${status.toLowerCase()}.`);
    persistAndRender(`${booking.id} marked ${status}.`);
  } catch (error) {
    showToast(`Booking was not updated: ${error.message}`, els);
  }
}

export async function deleteBooking(id) {
  if (!confirm(`Delete booking ${id}?`)) return;
  try {
    await removeBooking(id);
    await refreshLogs();
  } catch (error) {
    showToast(`Booking was not deleted: ${error.message}`, els);
    return;
  }
  state.bookings = state.bookings.filter((booking) => booking.id !== id);
  state.schedules = state.schedules.filter((schedule) => schedule.bookingId !== id);
  addActivity("trash-2", "bg-rose-500", `Booking ${id} has been deleted.`);
  persistAndRender(`Booking ${id} deleted.`);
}

export async function handleAssignment(event) {
  event.preventDefault();
  const bookingId = els.assignBooking.value;
  const technicianId = els.assignTechnician.value;
  const scheduleValue = els.assignSchedule.value;
  const booking = state.bookings.find((item) => item.id === bookingId);
  const technician = state.technicians.find((item) => String(item.id) === String(technicianId));

  if (!booking || !technician || !scheduleValue) {
    showToast("Select a booking, technician, and schedule.", els);
    return;
  }

  const date = new Date(scheduleValue);
  try {
    await createSchedule({
      bookingId,
      technicianId,
      scheduleDate: scheduleValue.slice(0, 10),
      scheduleTime: formatTime(date)
    });
    await refreshLogs();
  } catch (error) {
    showToast(`Technician was not assigned: ${error.message}`, els);
    return;
  }

  booking.technician = technician.name;
  booking.status = "Approved";
  booking.schedule = formatDateTime(date);
  syncCustomerFromBooking(booking);

  state.schedules.unshift({
    technician: technician.name,
    bookingId: booking.id,
    service: booking.service,
    time: formatTime(date),
    address: booking.address,
    status: "Assigned"
  });

  els.assignSchedule.value = "";
  addActivity("user-check", "bg-blue-700", `Technician ${technician.name} was assigned to booking ${booking.id}.`);
  persistAndRender(`${technician.name} assigned to ${booking.id}.`);
}

export async function handleServiceSave(event) {
  event.preventDefault();
  const id = els.serviceId.value;
  const service = {
    name: els.serviceName.value.trim(),
    type: els.serviceType.value.trim(),
    price: els.servicePrice.value.trim(),
    inclusion: els.serviceInclusion.value.trim(),
    exclusion: els.serviceExclusion.value.trim()
  };

  if (!service.name) {
    showToast("Service name is required.", els);
    return;
  }
  if (!service.type) {
    showToast("Service type is required.", els);
    return;
  }
  if (service.price === "" || Number(service.price) < 0) {
    showToast("Price cannot be negative.", els);
    return;
  }

  try {
    const wasExisting = Boolean(id);
    const savedService = id ? await updateService(id, service) : await createService(service);
    const normalizedService = { ...savedService, id: String(savedService.id) };
    const existing = state.services.findIndex((item) => String(item.id) === String(normalizedService.id));

    if (existing >= 0) {
      state.services[existing] = normalizedService;
    } else {
      state.services.unshift(normalizedService);
    }

    addActivity(
      wasExisting ? "settings" : "plus",
      wasExisting ? "bg-slate-500" : "bg-emerald-500",
      `Service ${service.name} has been ${wasExisting ? "updated" : "added"}.`
    );
    await refreshLogs();
  } catch (error) {
    showToast(`Service was not saved: ${error.message}`, els);
    return;
  }

  closeModal("serviceModal");
  persistAndRender("Service saved.");
}

export async function deleteService(id) {
  const service = state.services.find((item) => String(item.id) === String(id));
  if (!service || !confirm(`Delete service ${service.name}?`)) return;

  try {
    await removeService(id);
  } catch (error) {
    showToast(`Service was not deleted: ${error.message}`, els);
    return;
  }

  state.services = state.services.filter((item) => String(item.id) !== String(id));
  await refreshLogs();
  addActivity("trash-2", "bg-rose-500", `Service ${service.name} has been deleted.`);
  persistAndRender("Service deleted.");
}

export async function handleCustomerSave(event) {
  event.preventDefault();
  const id = els.customerId.value;
  const customer = {
    name: els.customerName.value.trim(),
    phone: els.customerPhone.value.trim(),
    email: els.customerEmail.value.trim(),
    address: els.customerAddress.value.trim()
  };

  try {
    const savedCustomer = id ? await updateCustomer(id, customer) : await createCustomer(customer);
    const normalizedCustomer = { ...savedCustomer, id: String(savedCustomer.id) };
    const existing = state.customers.findIndex((item) => String(item.id) === String(normalizedCustomer.id));
    if (existing >= 0) state.customers[existing] = normalizedCustomer;
    else state.customers.unshift(normalizedCustomer);
    await refreshLogs();
  } catch (error) {
    showToast(`Customer was not saved: ${error.message}`, els);
    return;
  }

  closeModal("customerModal");
  persistAndRender("Customer saved.");
}

export async function deleteCustomer(id) {
  const customer = state.customers.find((item) => String(item.id) === String(id));
  if (!customer || !confirm(`Delete customer ${customer.name}?`)) return;
  try {
    await removeCustomer(id);
    await refreshLogs();
  } catch (error) {
    showToast(`Customer was not deleted: ${error.message}`, els);
    return;
  }
  state.customers = state.customers.filter((item) => String(item.id) !== String(id));
  addActivity("trash-2", "bg-rose-500", `Customer ${customer.name} has been deleted.`);
  persistAndRender("Customer deleted.");
}

export async function handleTechnicianSave(event) {
  event.preventDefault();
  const name = els.technicianName.value.trim();
  const specialty = els.technicianSpecialty.value.trim();
  if (!name || !specialty) return;

  const id = els.technicianId.value;
  const technician = {
    name,
    specialty,
    status: els.technicianStatus.value
  };

  try {
    const savedTechnician = id ? await updateTechnician(id, technician) : await createTechnician(technician);
    const normalizedTechnician = { ...savedTechnician, id: String(savedTechnician.id) };
    const existing = state.technicians.findIndex((item) => String(item.id) === String(normalizedTechnician.id));
    if (existing >= 0) state.technicians[existing] = normalizedTechnician;
    else state.technicians.unshift(normalizedTechnician);
    await refreshLogs();
  } catch (error) {
    showToast(`Technician was not saved: ${error.message}`, els);
    return;
  }

  closeModal("technicianModal");
  persistAndRender("Technician saved.");
}

export async function deleteTechnician(id) {
  const technician = state.technicians.find((item) => String(item.id) === String(id));
  if (!technician || !confirm(`Delete technician ${technician.name}?`)) return;
  try {
    await removeTechnician(id);
    await refreshLogs();
  } catch (error) {
    showToast(`Technician was not deleted: ${error.message}`, els);
    return;
  }
  state.technicians = state.technicians.filter((item) => String(item.id) !== String(id));
  addActivity("trash-2", "bg-rose-500", `Technician ${technician.name} has been deleted.`);
  persistAndRender("Technician deleted.");
}

export async function handleProductSave(event) {
  event.preventDefault();
  const name = els.productName.value.trim();
  const type = els.productType.value.trim();
  const brand = els.productBrand.value.trim();
  const price = els.productPrice.value.trim();
  const stocks = els.productStocks.value.trim();
  const horsepower = els.productHorsepower.value.trim();
  if (!name || !type || !brand || !price || !stocks || !horsepower) return;

  const id = els.productId.value;
  const product = {
    name,
    type,
    brand,
    stocks,
    price,
    horsepower,
    image: await readProductImage()
  };

  try {
    const savedProduct = id ? await updateProduct(id, product) : await createProduct(product);
    const normalizedProduct = { ...savedProduct, id: String(savedProduct.id) };
    const existing = state.products.findIndex((item) => String(item.id) === String(normalizedProduct.id));

    if (existing >= 0) state.products[existing] = normalizedProduct;
    else state.products.unshift(normalizedProduct);
    await refreshLogs();
  } catch (error) {
    showToast(`Product was not saved: ${error.message}`, els);
    return;
  }

  closeModal("productModal");
  persistAndRender("Product saved.");
}

export async function handleBookingSave(event) {
  event.preventDefault();
  const booking = {
    customer: els.bookingCustomer.value.trim(),
    phone: els.bookingPhone.value.trim(),
    email: els.bookingEmail.value.trim(),
    service: els.bookingService.value,
    preferredDate: els.bookingDate.value,
    preferredTime: els.bookingTime.value,
    address: els.bookingAddress.value.trim()
  };

  if (!booking.customer || !booking.phone || !booking.email || !booking.service || !booking.preferredDate || !booking.address) return;

  try {
    const savedBooking = await createBooking(booking);
    state.bookings.unshift({ ...savedBooking, id: String(savedBooking.id) });
    event.target.reset();
    await refreshLogs();
    persistAndRender("Booking request submitted.");
  } catch (error) {
    showToast(`Booking was not submitted: ${error.message}`, els);
  }
}

export function readProductImage() {
  const file = els.productImage.files?.[0];
  if (!file) return Promise.resolve(els.productExistingImage.value);

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(file);
  });
}

export async function deleteProduct(id) {
  const product = state.products.find((item) => String(item.id) === String(id));
  if (!product || !confirm(`Delete product ${product.name}?`)) return;

  try {
    await removeProduct(id);
  } catch (error) {
    showToast(`Product was not deleted: ${error.message}`, els);
    return;
  }

  state.products = state.products.filter((item) => String(item.id) !== String(id));
  await refreshLogs();
  addActivity("trash-2", "bg-rose-500", `Product ${product.name} has been deleted.`);
  persistAndRender("Product deleted.");
}

export function showView(viewName) {
  document.querySelectorAll(".view").forEach((view) => view.classList.add("hidden"));
  document.getElementById(`${viewName}View`)?.classList.remove("hidden");

  document.querySelectorAll(".nav-link").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === viewName);
  });

  window.scrollTo({ top: 0, behavior: "smooth" });
  refreshIcons();
}

export async function refreshLogs() {
  if (state.session?.user?.role !== "admin") return;
  try {
    state.logs = await getLogs();
  } catch (error) {
    console.error(error);
  }
}

export function promptLoginForBooking() {
  if (state.session?.user?.role === "guest") {
    showToast("Please log in or register before booking a service.", els);
    return;
  }
  showView("bookings");
}

export function persistAndRender(message) {
  saveState();
  render();
  showToast(message, els);
}
