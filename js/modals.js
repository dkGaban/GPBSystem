import { els, getApprovedCustomers, state } from "./state.js";
import { escapeHtml, formatPesoPrice, refreshIcons, statusBadge } from "./utils.js";
import { renderUnitPhotosMarkup } from "./portal-utils.js";

export function openBookingModal(id) {
  const booking = state.bookings.find((item) => item.id === id);
  if (!booking) return;

  const units = Array.isArray(booking.units) && booking.units.length ? booking.units : [];
  const unitsSection = units.length
    ? `
      <div class="border-t border-slate-200 pt-4 mt-4">
        <h4 class="font-bold text-slate-500 mb-3">Units</h4>
        ${units.map((unit) => `
          <div class="mb-4">
            <p class="font-semibold text-slate-700">${escapeHtml(unit.description || "Unit")}</p>
            <dl class="grid grid-cols-[140px_1fr] gap-x-4 gap-y-1 text-sm mt-1">
              <dt class="font-bold text-slate-500">Quantity</dt><dd>${escapeHtml(unit.quantity)}</dd>
              ${unit.uPrice != null ? `<dt class="font-bold text-slate-500">Unit price</dt><dd>${formatPesoPrice(unit.uPrice)}</dd>` : ""}
              ${unit.subTotal != null ? `<dt class="font-bold text-slate-500">Subtotal</dt><dd>${formatPesoPrice(unit.subTotal)}</dd>` : ""}
            </dl>
            ${renderUnitPhotosMarkup([unit])}
          </div>
        `).join("")}
      </div>`
    : "";

  els.bookingModalContent.innerHTML = `
    <dl class="grid grid-cols-[140px_1fr] gap-x-4 gap-y-3">
      <dt class="font-bold text-slate-500">Booking ID</dt><dd>${escapeHtml(booking.id)}</dd>
      <dt class="font-bold text-slate-500">Customer</dt><dd>${escapeHtml(booking.customer)}</dd>
      <dt class="font-bold text-slate-500">Service</dt><dd>${escapeHtml(booking.service)}</dd>
      <dt class="font-bold text-slate-500">Schedule</dt><dd>${escapeHtml(booking.schedule)}</dd>
      <dt class="font-bold text-slate-500">Address</dt><dd>${escapeHtml(booking.address)}</dd>
      <dt class="font-bold text-slate-500">Technician</dt><dd>${escapeHtml(booking.technician || "Unassigned")}</dd>
      <dt class="font-bold text-slate-500">Status</dt><dd>${statusBadge(booking.status)}</dd>
    </dl>
    ${unitsSection}
  `;
  openModal("bookingModal");
}

export function openServiceModal(id = "") {
  const service = state.services.find((item) => String(item.id) === String(id));
  els.serviceModalTitle.textContent = service ? "Edit Service" : "Add Service";
  els.serviceId.value = service?.id || "";
  els.serviceName.value = service?.name || "";
  els.serviceType.value = service?.type || "";
  els.servicePrice.value = service?.price || "";
  els.serviceInclusion.value = service?.inclusion || service?.description || "";
  els.serviceExclusion.value = service?.exclusion || "";
  openModal("serviceModal");
}

export function openCustomerModal(id = "") {
  const customer = state.customers.find((item) => String(item.id) === String(id)) || getApprovedCustomers().find((item) => String(item.id) === String(id));
  els.customerModalTitle.textContent = customer ? "Edit Customer" : "Add Customer";
  els.customerId.value = customer?.id || "";
  els.customerName.value = customer?.name || "";
  els.customerPhone.value = customer?.phone || "";
  els.customerEmail.value = customer?.email || "";
  els.customerAddress.value = customer?.address || "";
  openModal("customerModal");
}

export function openTechnicianModal(id = "") {
  const technician = state.technicians.find((item) => String(item.id) === String(id));
  els.technicianModalTitle.textContent = technician ? "Edit Technician" : "Add Technician";
  els.technicianId.value = technician?.id || "";
  els.technicianName.value = technician?.name || "";
  els.technicianSpecialty.value = technician?.specialty || "";
  els.technicianStatus.value = technician?.status || "Active";
  openModal("technicianModal");
}

export function openProductModal(id = "") {
  const product = state.products.find((item) => String(item.id) === String(id));
  els.productModalTitle.textContent = product ? "Edit Product" : "Add Product";
  els.productId.value = product?.id || "";
  els.productName.value = product?.name || "";
  if (els.productType) els.productType.value = product?.type || "";
  els.productBrand.value = product?.brandId || product?.brand || "";
  if (els.productLine) els.productLine.value = product?.pServiceId || "";
  els.productPrice.value = product?.price || "";
  els.productStocks.value = product?.stocks || "";
  els.productHorsepower.value = product?.horsepower || "";
  els.productImage.value = "";
  els.productExistingImage.value = product?.image || "";
  openModal("productModal");
}

export function openModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
  refreshIcons();
}

export function closeModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");
}

export function closeOnBackdrop(event) {
  if (event.target.classList.contains("modal")) closeModal(event.target.id);
}
