// web/scripts/login.js
import { api } from "./api.js";

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("loginForm");
  const errorEl = document.getElementById("loginError");
  const emailEl = document.getElementById("email");
  const passEl = document.getElementById("password");
  const submitBtn = form?.querySelector('button[type="submit"]');

  // Optional: show current year if footer injected later
  const y = document.getElementById("year");
  if (y) y.textContent = new Date().getFullYear();

  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl && (errorEl.textContent = "");

    const email = emailEl?.value.trim();
    const password = passEl?.value;

    if (!email || !password) {
      if (errorEl) errorEl.textContent = "Please enter email and password.";
      return;
    }

    // Disable while submitting
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.dataset.loading = "true";
    }

    try {
      await api.login({ email, password });

      // Optional: support ?redirect=/somepage
      const params = new URLSearchParams(location.search);
      const redirect = params.get("redirect") || "home.html";
      window.location.href = redirect;
    } catch (err) {
      if (errorEl) errorEl.textContent = err.message || "Login failed";
      // Focus password for quick retry
      passEl?.focus();
      passEl?.select?.();
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        delete submitBtn.dataset.loading;
      }
    }
  });
});