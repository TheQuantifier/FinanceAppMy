/* ===============================================
   Finance App – default.js (ES module)
   Shared script for all pages.
   Loads header/footer, sets active nav link,
   manages account dropdown, and auth state.
   =============================================== */

import { api } from "./api.js";

document.addEventListener("DOMContentLoaded", () => {
  loadHeaderAndFooter();
});

/**
 * Fetch a fragment (no cache)
 */
async function loadFragment(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`${path} not found`);
  return res.text();
}

/**
 * Fetch and inject header & footer, then set active nav link + auth
 */
function loadHeaderAndFooter() {
  // --- Load Header ---
  loadFragment("components/header.html")
    .then((html) => {
      document.getElementById("header").innerHTML = html;
      setActiveNavLink();
      initAccountMenu();     // dropdown behavior
      initAuthState();       // login/logout + user info
    })
    .catch((err) => console.error("Header load failed:", err));

  // --- Load Footer ---
  loadFragment("components/footer.html")
    .then((html) => {
      document.getElementById("footer").innerHTML = html;
      const y = document.getElementById("year");
      if (y) y.textContent = new Date().getFullYear();
    })
    .catch((err) => console.error("Footer load failed:", err));
}

/**
 * Highlights the current page in the navigation menu
 */
function setActiveNavLink() {
  const currentPage = window.location.pathname.split("/").pop() || "index.html";
  const navLinks = document.querySelectorAll("#header nav a");

  navLinks.forEach((link) => {
    const linkPage = link.getAttribute("href");
    if (linkPage === currentPage) {
      link.classList.add("active");
    } else {
      link.classList.remove("active");
    }
  });
}

/**
 * Initializes account menu dropdown toggle behavior
 */
function initAccountMenu() {
  const icon = document.getElementById("account-icon");
  const menu = document.getElementById("account-menu");

  if (!icon || !menu) return;

  // Toggle dropdown visibility on icon click
  icon.addEventListener("click", () => {
    const isOpen = menu.classList.toggle("show");
    icon.setAttribute("aria-expanded", String(isOpen));
  });

  // Close menu when clicking outside
  document.addEventListener("click", (e) => {
    if (!icon.contains(e.target) && !menu.contains(e.target)) {
      menu.classList.remove("show");
      icon.setAttribute("aria-expanded", "false");
    }
  });

  // Allow ESC key to close
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      menu.classList.remove("show");
      icon.setAttribute("aria-expanded", "false");
      icon.blur();
    }
  });
}

/**
 * Initializes auth state:
 * - If logged in: show Logout, fill account info
 * - If guest: show Login
 * Also supports optional visibility toggles:
 *   elements with [data-auth="authed"] will show only when logged-in
 *   elements with [data-auth="guest"]  will show only when logged-out
 */
async function initAuthState() {
  const authLink = document.querySelector(".auth-link");
  const authedEls = document.querySelectorAll('[data-auth="authed"]');
  const guestEls  = document.querySelectorAll('[data-auth="guest"]');

  try {
    const me = await api.me(); // throws if not authenticated

    // Fill optional account UI bits if present
    const nameTargets  = document.querySelectorAll("[data-user-name], #account-name");
    const emailTargets = document.querySelectorAll("[data-user-email], #account-email");

    nameTargets.forEach((el) => (el.textContent = me.name || me.email || "Account"));
    emailTargets.forEach((el) => (el.textContent = me.email || ""));

    // Toggle visibility groups
    authedEls.forEach((el) => (el.style.display = ""));
    guestEls.forEach((el) => (el.style.display = "none"));

    // Auth link becomes Logout
    if (authLink) {
      authLink.textContent = "Logout";
      authLink.href = "#";
      authLink.addEventListener("click", async (e) => {
        e.preventDefault();
        try { await api.logout(); } catch {}
        // After logout, redirect to login page
        window.location.href = "./login.html";
      }, { once: true });
    }
  } catch {
    // Not logged in
    authedEls.forEach((el) => (el.style.display = "none"));
    guestEls.forEach((el) => (el.style.display = ""));

    if (authLink) {
      authLink.textContent = "Login";
      authLink.href = "./login.html";
    }
  }
}