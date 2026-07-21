import { login, registerAccount, setSession } from "./api.js";
import { isStrongPassword, isValidPhilippineMobile, toast } from "./portal-utils.js";

const $ = (id) => document.getElementById(id);
const next = new URLSearchParams(window.location.search).get("next");

$("togglePassword").addEventListener("click", () => {
  const password = $("loginPassword");
  password.type = password.type === "password" ? "text" : "password";
  $("togglePassword").textContent = password.type === "password" ? "Show" : "Hide";
});
$("registerPhone").addEventListener("input", () => validatePhone());

document.querySelectorAll("[data-auth-tab]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-auth-tab]").forEach((item) => item.classList.toggle("active", item === button));
    document.getElementById("loginForm").classList.toggle("hidden", button.dataset.authTab !== "login");
    document.getElementById("registerForm").classList.toggle("hidden", button.dataset.authTab !== "register");
  });
});

document.getElementById("loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const session = await login({
      email: document.getElementById("loginEmail").value.trim(),
      password: document.getElementById("loginPassword").value
    });
    setSession(session);
    const routes = { admin: "admin.html", customer: "customer.html", technician: "technician.html" };
    window.location.href = session.user.role === "customer" && next === "book" ? "customer.html?tab=book" : (routes[session.user.role] || "customer.html");
  } catch (error) {
    toast(error.message);
  }
});

document.getElementById("registerForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const phone = $("registerPhone").value.trim();
  const password = $("registerPassword").value;

  if (!validatePhone()) {
    return;
  }

  if (!isStrongPassword(password)) {
    toast("Password must be at least 8 characters and include uppercase, lowercase, and a number.");
    return;
  }

  try {
    const session = await registerAccount({
      role: "customer",
      fullName: $("registerName").value.trim(),
      email: $("registerEmail").value.trim(),
      password,
      phone,
      houseNumber: $("registerHouseNumber").value.trim(),
      street: $("registerStreet").value.trim(),
      barangay: $("registerBarangay").value.trim(),
      city: $("registerCity").value.trim(),
      province: $("registerProvince").value.trim(),
      zipCode: $("registerZipCode").value.trim()
    });
    setSession(session);
    window.location.replace(next === "book" ? "customer.html?tab=book" : "customer.html");
  } catch (error) {
    toast(error.message);
  }
});

if (new URLSearchParams(window.location.search).get("tab") === "register") {
  document.querySelector('[data-auth-tab="register"]').click();
}

function validatePhone() { const input = $("registerPhone"); input.value = input.value.replace(/\D/g, "").slice(0, 11); const valid = isValidPhilippineMobile(input.value); $("registerPhoneError").classList.toggle("hidden", valid || !input.value); input.setCustomValidity(valid ? "" : "Enter a valid 11-digit PH phone number starting with 09."); return valid; }
