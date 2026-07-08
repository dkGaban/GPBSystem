import { getProducts, getServices } from "./api.js";
import { bindTabs, escapeHtml, peso, renderProducts, toast } from "./portal-utils.js";

let services = [];
let products = [];

bindTabs("services");
document.body.addEventListener("click", (event) => {
  if (event.target.closest("[data-login-required]")) toast("Please login or register before booking.");
});
load();

async function load() {
  [services, products] = await Promise.all([getServices(), getProducts()]);
  document.getElementById("servicesBody").innerHTML = services.length ? services.map((service) => `<tr><td>${escapeHtml(service.name)}</td><td>${escapeHtml(service.type)}</td><td>${peso(service.price)}</td><td>${escapeHtml(service.inclusion)}</td><td>${escapeHtml(service.exclusion)}</td><td><button class="tiny-button secondary-button" data-login-required>Login to Book</button></td></tr>`).join("") : `<tr><td colspan="6" class="text-center text-slate-500">No services available.</td></tr>`;
  renderProducts(products);
}
