import { clearSession, getSession } from "./api.js";

const PRODUCTS_PER_PAGE = 6;
let productsPage = 1;
let _lastProductsArgs = null;

export function requireRole(role) {
  const session = getSession();
  if (!session?.token || session.user?.role !== role) {
    window.location.href = "index.html";
    return null;
  }
  return session;
}

export function logout() {
  clearSession();
  window.location.href = "index.html";
}

export function bindTabs(defaultTab = "") {
  document.querySelectorAll("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => showTab(button.dataset.tab));
  });
  if (defaultTab) showTab(defaultTab);
}

export function showTab(tab) {
  document.querySelectorAll("[data-tab]").forEach((button) => button.classList.toggle("active", button.dataset.tab === tab));
  document.querySelectorAll(".portal-tab").forEach((section) => section.classList.add("hidden"));
  document.getElementById(`${tab}Tab`)?.classList.remove("hidden");
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function peso(value) {
  const amount = Number(String(value ?? "").replace(/[^\d.]/g, ""));
  if (!Number.isFinite(amount)) return escapeHtml(value);
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(amount);
}

export function toast(message) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = message;
  el.classList.remove("hidden");
  window.clearTimeout(toast.timer);
  toast.timer = window.setTimeout(() => el.classList.add("hidden"), 2500);
}

export function statusBadge(status) {
  const key = String(status || "Pending").toLowerCase().replace(/\s+/g, "-");
  return `<span class="badge badge-${key}">${escapeHtml(status || "Pending")}</span>`;
}

export function isValidPhilippineMobile(phone) {
  return /^09\d{9}$/.test(String(phone || "").trim());
}

export function isStrongPassword(password) {
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(String(password || ""));
}

export function fileToDataUrl(input, existing = "") {
  const file = input.files?.[0];
  if (!file) return Promise.resolve(existing);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(file);
  });
}

export function renderUnitPhotosMarkup(units = []) {
  const entries = (Array.isArray(units) ? units : []).filter((unit) => Array.isArray(unit.photos) && unit.photos.length);
  if (!entries.length) return "";
  return `<div class="unit-photo-list">${entries.map((unit) => `<div class="unit-photo-list-item"><small>${escapeHtml(unit.description || "Unit")}</small><div class="unit-photo-thumbs">${unit.photos.map((photo) => `<a href="${escapeHtml(photo)}" target="_blank" rel="noopener" class="unit-photo-link" title="View photo"><img src="${escapeHtml(photo)}" alt="Unit photo" loading="lazy" /></a>`).join("")}</div></div>`).join("")}</div>`;
}

export function renderUnitDetailsMarkup(units = []) {
  const list = (Array.isArray(units) ? units : []).map((unit) => {
    const parts = [];
    if (unit.brandName) parts.push(`Brand: ${escapeHtml(unit.brandName)}`);
    if (unit.airconType) parts.push(`Type: ${escapeHtml(unit.airconType)}`);
    if (unit.technology) parts.push(`Technology: ${escapeHtml(unit.technology)}`);
    const horsePower = Number(unit.horsePower);
    if (Number.isFinite(horsePower) && horsePower > 0) parts.push(`Horsepower: ${escapeHtml(horsePower)} HP`);
    const description = String(unit.description || "").trim();
    const problem = /^repair/i.test(description) ? escapeHtml(description) : "";
    if (!parts.length && !problem) return "";
    return `<div class="unit-details-item">${parts.length ? `<small>${parts.join(" · ")}</small>` : ""}${problem ? `<small>${problem}</small>` : ""}</div>`;
  }).filter(Boolean);
  if (!list.length) return "";
  return `<div class="unit-details-list">${list.join("")}</div>`;
}

export function renderProducts(products, options = {}) {
  _lastProductsArgs = { products, options };
  const grid = document.getElementById("productsGrid");
  if (!grid) return;
  const visible = options.includeOutOfStock
    ? products
    : products.filter((p) => Number(p.stocks) > 0);
  if (!visible.length) {
    grid.innerHTML = `<p class="text-sm text-slate-500">${products.length ? "No in-stock products available." : "No products yet."}</p>`;
    grid.parentElement?.querySelector(".products-pager")?.remove();
    return;
  }
  const totalPages = Math.ceil(visible.length / PRODUCTS_PER_PAGE);
  if (options.admin || visible.length <= PRODUCTS_PER_PAGE) {
    grid.innerHTML = visible.map((product) => productCard(product, options)).join("");
    grid.parentElement?.querySelector(".products-pager")?.remove();
    return;
  }
  if (productsPage > totalPages) productsPage = totalPages;
  const start = (productsPage - 1) * PRODUCTS_PER_PAGE;
  const pageProducts = visible.slice(start, start + PRODUCTS_PER_PAGE);
  grid.innerHTML = pageProducts.map((product) => productCard(product, options)).join("");
  renderProductsPagination(totalPages, grid);
}

function renderProductsPagination(totalPages, grid) {
  const parent = grid?.parentElement;
  if (!parent) return;
  let container = parent.querySelector(".products-pager");
  if (!container) {
    container = document.createElement("div");
    container.className = "products-pager";
    parent.appendChild(container);
  }
  let buttons = "";
  if (productsPage > 1) buttons += `<button class="pager" data-page-product="${productsPage - 1}">Prev</button>`;
  for (let i = 1; i <= totalPages; i++) {
    buttons += `<button class="pager${i === productsPage ? " active" : ""}" data-page-product="${i}">${i}</button>`;
  }
  if (productsPage < totalPages) buttons += `<button class="pager" data-page-product="${productsPage + 1}">Next</button>`;
  container.innerHTML = `<span>Page ${productsPage} of ${totalPages}</span><div class="bookings-pager">${buttons}</div>`;
}

function changeProductsPage(page) {
  productsPage = page;
  if (_lastProductsArgs) {
    renderProducts(_lastProductsArgs.products, _lastProductsArgs.options);
  }
}

document.body.addEventListener("click", (event) => {
  const pageButton = event.target.closest("[data-page-product]");
  if (pageButton) {
    event.stopPropagation();
    changeProductsPage(Number(pageButton.dataset.pageProduct));
  }
});

function productCard(product, options) {
  const specs = [];
  if (product.horsepower) specs.push(`${escapeHtml(product.horsepower)}HP`);
  if (product.stocks !== undefined && product.stocks !== null && product.stocks !== "") specs.push(`${escapeHtml(product.stocks)} in stock`);
  const specLine = specs.length ? `<p class="product-spec-line">${specs.join(" &middot; ")}</p>` : "";
  return `
    <article class="product-card">
      <div class="product-image">${product.image ? `<img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}">` : `<span class="product-image-placeholder">Image coming soon</span>`}</div>
      <div class="product-card-body">
        <span>${escapeHtml(product.productLine || product.type)}</span>
        <h3>${escapeHtml(product.name)}</h3>
        <p class="product-price">${peso(product.price)}</p>
        ${specLine}
      </div>
      <div class="card-actions">
        ${productActions(product, options)}
      </div>
    </article>
  `;
}

export function renderServiceCards(services, options = {}) {
  const target = document.getElementById(options.targetId || "servicesGrid");
  if (!target) return;
  if (!services.length) {
    target.innerHTML = `<p class="empty-note">No services available.</p>`;
    return;
  }

  const categories = new Map();
  services.forEach((service) => {
    const category = String(service.type || "Uncategorized").trim() || "Uncategorized";
    if (!categories.has(category)) categories.set(category, []);
    categories.get(category).push(service);
  });
  target.innerHTML = [...categories.entries()].map(([category, variants]) => `
    <article class="service-category-card">
      <div class="service-category-heading"><i class="fa-solid fa-screwdriver-wrench"></i><div><p>Service category</p><h3>${escapeHtml(category)}</h3></div><span>${variants.length} ${variants.length === 1 ? "variant" : "variants"}</span></div>
      <div class="service-variant-list">
        ${variants.map((service) => `<article class="service-variant-row">
          <div class="service-variant-copy">${service.image ? `<img src="${escapeHtml(service.image)}" alt="${escapeHtml(service.name)}">` : ""}<div><h4>${escapeHtml(service.name)}</h4><p>${escapeHtml(service.inclusion || "Professional service tailored to your requirements.")}</p></div></div>
          <div class="service-variant-action"><strong>${peso(service.price)}</strong><button class="tiny-button secondary-button" ${options.customer ? `data-book-service="${service.id}"` : "data-login-required"}>${options.customer ? "Book" : "Login to Book"}</button></div>
        </article>`).join("")}
      </div>
    </article>`).join("");
}

function productActions(product, options) {
  if (options.admin) {
    return `<button class="tiny-button secondary-button" data-edit-product="${product.id}">Edit</button><button class="tiny-button danger-button" data-delete-product="${product.id}">Delete</button>`;
  }

  if (options.customer) {
    return `<button class="tiny-button secondary-button" data-book-product="${escapeHtml(product.name)}">Book</button>`;
  }

  return `<a class="tiny-button secondary-button" href="index.html">Login to Book</a>`;
}

export function showConfirmModal({ message, confirmLabel = "Yes, continue", cancelLabel = "Cancel", danger = true, onConfirm }) {
  const modal = document.getElementById("genericConfirmModal");
  if (!modal) return Promise.resolve(false);
  const msgEl = modal.querySelector(".confirm-modal-message");
  const confirmBtn = modal.querySelector(".confirm-modal-confirm");
  const cancelBtn = modal.querySelector(".confirm-modal-cancel");
  if (msgEl) msgEl.textContent = message;
  if (confirmBtn) {
    confirmBtn.textContent = confirmLabel;
    confirmBtn.className = danger ? "danger-button" : "primary-button";
  }
  if (cancelBtn) cancelBtn.textContent = cancelLabel;
  modal.classList.remove("hidden");
  return new Promise((resolve) => {
    function cleanup() {
      confirmBtn?.removeEventListener("click", handleConfirm);
      cancelBtn?.removeEventListener("click", handleCancel);
      modal.removeEventListener("click", handleBackdrop);
    }
    function handleConfirm() { cleanup(); modal.classList.add("hidden"); if (onConfirm) onConfirm(); resolve(true); }
    function handleCancel() { cleanup(); modal.classList.add("hidden"); resolve(false); }
    function handleBackdrop(e) { if (e.target === modal) handleCancel(); }
    confirmBtn?.addEventListener("click", handleConfirm);
    cancelBtn?.addEventListener("click", handleCancel);
    modal.addEventListener("click", handleBackdrop);
  });
}

export function genericConfirmModalHtml() {
  return `<div id="genericConfirmModal" class="modal hidden" role="dialog" aria-modal="true" aria-labelledby="genericConfirmTitle"><section class="confirmation-card"><div class="confirmation-icon" aria-hidden="true">!</div><h2 id="genericConfirmTitle">Are you sure?</h2><p class="confirm-modal-message"></p><div class="modal-actions"><button type="button" class="confirm-modal-cancel secondary-button">Cancel</button><button type="button" class="confirm-modal-confirm danger-button">Yes, continue</button></div></section></div>`;
}
