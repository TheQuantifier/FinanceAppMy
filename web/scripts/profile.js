/* Profile page logic — loads user from API, keeps extras in localStorage */
import { api } from "./api.js";

(function () {
  const toggleBtn = document.getElementById("toggleEditBtn");
  const editBtn = document.getElementById("editProfileBtn");
  const cancelBtn = document.getElementById("cancelEditBtn");
  const form = document.getElementById("editForm");
  const view = document.getElementById("detailsView");

  // Read-only view fields
  const vFullName = document.getElementById("detailFullName");
  const vPreferred = document.getElementById("detailPreferred");
  const vEmail = document.getElementById("profileEmail");
  const vPhone = document.getElementById("profilePhone");
  const vBio = document.getElementById("detailBio");

  // Form fields
  const fFullName = document.getElementById("inputFullName");
  const fPreferred = document.getElementById("inputPreferred");
  const fEmail = document.getElementById("inputEmail");
  const fPhone = document.getElementById("inputPhone");
  const fBio = document.getElementById("inputBio");

  // Helpers
  const get = (id) => document.getElementById(id);
  const val = (el) => (el?.value ?? "").trim();
  const text = (el, v) => { if (el) el.textContent = v ?? "—"; };

  // Store extra profile fields that aren't in the DB (phone, bio, preferred)
  function storageKey(userId) {
    return `profileExtras:${userId}`;
  }
  function readExtras(userId) {
    try {
      return JSON.parse(localStorage.getItem(storageKey(userId)) || "{}");
    } catch { return {}; }
  }
  function writeExtras(userId, extras) {
    localStorage.setItem(storageKey(userId), JSON.stringify(extras || {}));
  }

  function showForm() {
    if (!form || !view) return;
    form.hidden = false;
    view.hidden = true;
    toggleBtn?.setAttribute("aria-expanded", "true");
  }

  function hideForm() {
    if (!form || !view) return;
    form.hidden = true;
    view.hidden = false;
    toggleBtn?.setAttribute("aria-expanded", "false");
  }

  // Wire UI toggles
  toggleBtn?.addEventListener("click", () => {
    if (form?.hidden) showForm(); else hideForm();
  });
  editBtn?.addEventListener("click", showForm);
  cancelBtn?.addEventListener("click", hideForm);

  // Copy profile link
  get("copyProfileLinkBtn")?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      alert("Profile link copied!");
    } catch {
      alert("Could not copy link.");
    }
  });

  // Load current user and populate UI
  async function loadProfile() {
    try {
      const me = await api.me(); // { id, name, email, createdAt, ... }
      // expose if other scripts need it
      window.currentUser = me;

      const extras = readExtras(me.id || me._id || me.email || "self");

      // Fill read-only view
      text(vFullName, me.name || "—");
      text(vPreferred, extras.preferred || "—");
      text(vEmail, me.email || "—");
      text(vPhone, extras.phone || "—");
      text(vBio, extras.bio || "—");

      // Prefill form
      if (fFullName) fFullName.value = me.name || "";
      if (fPreferred) fPreferred.value = extras.preferred || "";
      if (fEmail) fEmail.value = me.email || "";
      if (fPhone) fPhone.value = extras.phone || "";
      if (fBio) fBio.value = extras.bio || "";

      // Optional: email is managed by backend → make it read-only here
      if (fEmail) fEmail.readOnly = true;
    } catch {
      // Not logged in → bounce to login (with redirect back)
      const url = new URL("./login.html", location.href);
      url.searchParams.set("redirect", "profile.html");
      location.href = url.toString();
    }
  }

  // Save handler (local-only for extras; name change reflected in view)
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();

    // We only persist extras locally; name/email are server-owned in this version.
    const current = window.currentUser || {};
    const uid = current.id || current._id || current.email || "self";

    const extras = {
      preferred: val(fPreferred),
      phone: val(fPhone),
      bio: val(fBio),
    };
    writeExtras(uid, extras);

    // Reflect to read-only view
    text(vFullName, val(fFullName) || current.name || "—"); // local display only
    text(vPreferred, extras.preferred || "—");
    text(vEmail, current.email || "—"); // unchanged
    text(vPhone, extras.phone || "—");
    text(vBio, extras.bio || "—");

    hideForm();
    alert("Profile updated locally.");
  });

  // Init
  document.addEventListener("DOMContentLoaded", loadProfile);
})();