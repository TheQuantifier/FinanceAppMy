// web/scripts/register.js
import { api } from "./api.js";

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("registerForm");
  const msg = document.getElementById("registerMessage");
  const nameEl = document.getElementById("name");
  const emailEl = document.getElementById("email");
  const passEl = document.getElementById("password");
  const submitBtn = form?.querySelector('button[type="submit"]');

  if (!form) {
    console.error("❌ registerForm not found on page.");
    return;
  }

  function setMsg(text, color) {
    if (!msg) return;
    msg.textContent = text;
    msg.style.color = color || "";
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    setMsg("", "");

    const name = nameEl?.value.trim();
    const email = emailEl?.value.trim();
    const password = passEl?.value || "";

    // --- Basic validation ---
    if (!name || !email || !password) {
      return setMsg("Please fill in all fields.", "red");
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return setMsg("Please enter a valid email address.", "red");
    }
    if (password.length < 8) {
      return setMsg("Password must be at least 8 characters long.", "red");
    }

    // Disable while submitting
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.dataset.loading = "true";
    }
    setMsg("Creating your account...", "black");

    try {
      await api.register({ name, email, password });

      setMsg("✅ Account created successfully! Redirecting...", "green");

      // Optional: support ?redirect=/somepage (defaults to login.html)
      const params = new URLSearchParams(location.search);
      const redirect = params.get("redirect") || "login.html";

      setTimeout(() => (window.location.href = redirect), 900);
    } catch (err) {
      // Common backend errors: "Email already registered", etc.
      setMsg(err.message || "Registration failed. Please try again.", "red");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        delete submitBtn.dataset.loading;
      }
    }
  });
});