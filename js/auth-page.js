import { login, registerAccount, setSession, forgotPassword, verifyOTP, resetPassword } from "./api.js";
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
    const isLogin = button.dataset.authTab === "login";
    document.getElementById("authHeading").textContent = isLogin ? "Sign in" : "Create account";
    document.getElementById("authSubtext").textContent = isLogin ? "Welcome back. Enter your details to continue." : "Sign up to get started.";
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

/* ── Forgot password modal ──────────────────────────────────────── */
let forgotEmail = "";
let forgotOTP = "";
let resendTimer = null;

function showForgotStep(step) {
  ["forgotStep1", "forgotStep2", "forgotStep3", "forgotStep4"].forEach((id, i) => {
    $(id).classList.toggle("hidden", i !== step - 1);
  });
}

function openForgotModal() {
  forgotEmail = "";
  forgotOTP = "";
  $("forgotEmail").value = "";
  $("forgotOTP").value = "";
  $("forgotNewPassword").value = "";
  $("forgotConfirmPassword").value = "";
  $("forgotStep1Error").classList.add("hidden");
  $("forgotStep2Error").classList.add("hidden");
  $("forgotStep3Error").classList.add("hidden");
  showForgotStep(1);
  $("forgotPasswordModal").classList.remove("hidden");
}

function closeForgotModal() {
  $("forgotPasswordModal").classList.add("hidden");
  if (resendTimer) { clearInterval(resendTimer); resendTimer = null; }
}

function startResendCooldown() {
  let seconds = 60;
  $("forgotResend").disabled = true;
  $("forgotResendCountdown").textContent = `(${seconds}s)`;
  if (resendTimer) clearInterval(resendTimer);
  resendTimer = setInterval(() => {
    seconds--;
    $("forgotResendCountdown").textContent = seconds > 0 ? `(${seconds}s)` : "";
    if (seconds <= 0) { clearInterval(resendTimer); resendTimer = null; $("forgotResend").disabled = false; }
  }, 1000);
}

$("forgotPasswordLink").addEventListener("click", (e) => { e.preventDefault(); openForgotModal(); });

document.querySelectorAll("#forgotPasswordModal [data-close]").forEach((btn) => {
  btn.addEventListener("click", closeForgotModal);
});

$("forgotSendCode").addEventListener("click", async () => {
  const email = $("forgotEmail").value.trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    $("forgotStep1Error").textContent = "Enter a valid email address.";
    $("forgotStep1Error").classList.remove("hidden");
    return;
  }
  $("forgotStep1Error").classList.add("hidden");
  $("forgotSendCode").disabled = true;
  try {
    await forgotPassword(email);
    forgotEmail = email;
    showForgotStep(2);
    $("forgotOTP").value = "";
    startResendCooldown();
  } catch (error) {
    $("forgotStep1Error").textContent = error.message;
    $("forgotStep1Error").classList.remove("hidden");
  }
  $("forgotSendCode").disabled = false;
});

$("forgotResend").addEventListener("click", async () => {
  try {
    await forgotPassword(forgotEmail);
    startResendCooldown();
    toast("A new code has been sent.");
  } catch (error) {
    toast(error.message);
  }
});

$("forgotVerifyOTP").addEventListener("click", async () => {
  const otp = $("forgotOTP").value.trim();
  if (!otp || otp.length !== 6 || !/^\d{6}$/.test(otp)) {
    $("forgotStep2Error").textContent = "Enter the 6-digit code.";
    $("forgotStep2Error").classList.remove("hidden");
    return;
  }
  $("forgotStep2Error").classList.add("hidden");
  $("forgotVerifyOTP").disabled = true;
  try {
    await verifyOTP(forgotEmail, otp);
    forgotOTP = otp;
    showForgotStep(3);
    $("forgotNewPassword").value = "";
    $("forgotConfirmPassword").value = "";
  } catch (error) {
    $("forgotStep2Error").textContent = error.message;
    $("forgotStep2Error").classList.remove("hidden");
  }
  $("forgotVerifyOTP").disabled = false;
});

$("forgotResetPassword").addEventListener("click", async () => {
  const newPw = $("forgotNewPassword").value;
  const confirmPw = $("forgotConfirmPassword").value;
  $("forgotStep3Error").classList.add("hidden");
  if (!isStrongPassword(newPw)) {
    $("forgotStep3Error").textContent = "Password must be at least 8 characters and include uppercase, lowercase, and a number.";
    $("forgotStep3Error").classList.remove("hidden");
    return;
  }
  if (newPw !== confirmPw) {
    $("forgotStep3Error").textContent = "Passwords do not match.";
    $("forgotStep3Error").classList.remove("hidden");
    return;
  }
  $("forgotResetPassword").disabled = true;
  try {
    await resetPassword(forgotEmail, forgotOTP, newPw);
    showForgotStep(4);
  } catch (error) {
    $("forgotStep3Error").textContent = error.message;
    $("forgotStep3Error").classList.remove("hidden");
  }
  $("forgotResetPassword").disabled = false;
});
