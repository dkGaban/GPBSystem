import { getProducts, getServices } from "./api.js";
import { renderProducts, renderServiceCards } from "./portal-utils.js";

let services = [];
let products = [];

document.body.addEventListener("click", (event) => {
  if (event.target.closest("[data-login-required]")) window.location.href = "index.html?next=book";
});
load();

async function load() {
  [services, products] = await Promise.all([getServices(), getProducts()]);
  renderServiceCards(services);
  renderProducts(products);
}
