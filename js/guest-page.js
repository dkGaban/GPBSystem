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

const guestNavLinks = [
  ...document.querySelectorAll(".website-links .website-link[href^='#']"),
];

function setActiveGuestLink(active) {
  if (!active) return;
  guestNavLinks.forEach((link) =>
    link.classList.toggle("active", link === active)
  );
}

guestNavLinks.forEach((link) =>
  link.addEventListener("click", () => setActiveGuestLink(link))
);

if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        setActiveGuestLink(
          guestNavLinks.find(
            (link) => link.getAttribute("href") === `#${entry.target.id}`
          )
        );
      });
    },
    { rootMargin: "-88px 0px -55% 0px" }
  );

  guestNavLinks.forEach((link) => {
    const section = document.querySelector(link.getAttribute("href"));
    if (section) observer.observe(section);
  });
}
