import { clearSession, getSession } from "./api.js";

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

export function serviceList(label, value, marker) {
  const items = String(value || "")
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
  if (!items.length) return "";
  return `<div class="service-list"><strong>${escapeHtml(label)}:</strong>${items.map((item) => `<span>${marker} ${escapeHtml(item)}</span>`).join("")}</div>`;
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

export function renderProducts(products, options = {}) {
  const grid = document.getElementById("productsGrid");
  if (!grid) return;
  if (!products.length) {
    grid.innerHTML = `<p class="text-sm text-slate-500">No products yet.</p>`;
    return;
  }
  grid.innerHTML = products
    .map(
      (product) => `
        <article class="product-card">
          <div class="product-image">${product.image ? `<img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}">` : "No image yet"}</div>
          <div class="product-card-body">
            <div class="product-meta-row"><span>${escapeHtml(product.brand)}</span><span>${escapeHtml(product.type)}</span></div>
            <h3>${escapeHtml(product.name)}</h3>
            <p class="product-price">${peso(product.price)}</p>
            <dl class="product-specs"><div><dt>Stocks</dt><dd>${escapeHtml(product.stocks)}</dd></div><div><dt>Horsepower</dt><dd>${escapeHtml(product.horsepower)}</dd></div></dl>
          </div>
          <div class="card-actions">
            ${productActions(product, options)}
          </div>
        </article>
      `
    )
    .join("");
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
