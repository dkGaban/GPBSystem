import { login, registerAccount, setSession } from "./api.js";
import { toast } from "./portal-utils.js";

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
  try {
    const session = await registerAccount({
      role: "customer",
      fullName: document.getElementById("registerName").value.trim(),
      email: document.getElementById("registerEmail").value.trim(),
      password: document.getElementById("registerPassword").value,
      phone: document.getElementById("registerPhone").value.trim(),
      address: document.getElementById("registerAddress").value.trim()
    });
    setSession(session);
    window.location.href = "customer.html";
  } catch (error) {
    toast(error.message);
  }
});
