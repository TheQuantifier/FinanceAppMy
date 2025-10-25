/* ===============================================
   Finance App – default.js
   Shared script for all pages.
   Loads header/footer, sets active nav link,
   and manages account dropdown interactions.
   =============================================== */

document.addEventListener("DOMContentLoaded", () => {
  loadHeaderAndFooter();
});

/**
 * Fetch and inject header & footer, then set active nav link
 */
function loadHeaderAndFooter() {
  // --- Load Header ---
  fetch("components/header.html")
    .then((res) => {
      if (!res.ok) throw new Error("Header not found");
      return res.text();
    })
    .then((html) => {
      document.getElementById("header").innerHTML = html;
      setActiveNavLink();
      initAccountMenu(); // initialize dropdown behavior after header loads
    })
    .catch((err) => console.error("Header load failed:", err));

  // --- Load Footer ---
  fetch("components/footer.html")
    .then((res) => {
      if (!res.ok) throw new Error("Footer not found");
      return res.text();
    })
    .then((html) => {
      document.getElementById("footer").innerHTML = html;
    })
    .catch((err) => console.error("Footer load failed:", err));
}

/**
 * Highlights the current page in the navigation menu
 */
function setActiveNavLink() {
  const currentPage = window.location.pathname.split("/").pop();
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
    icon.setAttribute("aria-expanded", isOpen);
  });

  // Close menu when clicking outside
  document.addEventListener("click", (e) => {
    if (!icon.contains(e.target) && !menu.contains(e.target)) {
      menu.classList.remove("show");
      icon.setAttribute("aria-expanded", "false");
    }
  });

  // Allow ESC key to close
  icon.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      menu.classList.remove("show");
      icon.setAttribute("aria-expanded", "false");
      icon.blur();
    }
  });
}