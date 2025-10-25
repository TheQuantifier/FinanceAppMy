document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = "http://localhost:4000/api/auth";
  const form = document.getElementById("registerForm");
  const msg = document.getElementById("registerMessage");

  if (!form) {
    console.error("❌ registerForm not found on page.");
    return;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    msg.textContent = "";
    msg.style.color = "";

    // --- Collect input values ---
    const name = document.getElementById("name")?.value.trim();
    const email = document.getElementById("email")?.value.trim();
    const password = document.getElementById("password")?.value;

    // --- Basic validation ---
    if (!name || !email || !password) {
      msg.textContent = "Please fill in all fields.";
      msg.style.color = "red";
      return;
    }

    if (!email.includes("@") || !email.includes(".")) {
      msg.textContent = "Please enter a valid email address.";
      msg.style.color = "red";
      return;
    }

    if (password.length < 8) {
      msg.textContent = "Password must be at least 6 characters long.";
      msg.style.color = "red";
      return;
    }

    // --- Prepare request body ---
    const payload = { name, email, password };

    msg.textContent = "Creating your account...";
    msg.style.color = "black";

    try {
      const res = await fetch(`${API_BASE}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        msg.textContent = data.error || "Registration failed. Please try again.";
        msg.style.color = "red";
        return;
      }

      // --- Success message and redirect ---
      msg.textContent = "✅ Account created successfully! Redirecting...";
      msg.style.color = "green";

      setTimeout(() => {
        window.location.href = "login.html";
      }, 1500);
    } catch (err) {
      console.error("Registration error:", err);
      msg.textContent = "⚠️ Something went wrong. Please try again later.";
      msg.style.color = "red";
    }
  });
});
