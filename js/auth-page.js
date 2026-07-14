import { login, registerAccount, setSession } from "./api.js";
import { isStrongPassword, isValidPhilippineMobile, toast } from "./portal-utils.js";

const $ = (id) => document.getElementById(id);

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
    window.location.href = routes[session.user.role] || "customer.html";
  } catch (error) {
    toast(error.message);
  }
});

document.getElementById("registerForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const phone = $("registerPhone").value.trim();
  const password = $("registerPassword").value;

  if (!isValidPhilippineMobile(phone)) {
    toast("Please enter a valid Philippine mobile number.");
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
    window.location.href = "customer.html";
  } catch (error) {
    toast(error.message);
  }
});
