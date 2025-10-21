/* Minimal interactivity for Profile page */
(function () {
  const toggleBtn = document.getElementById('toggleEditBtn');
  const editBtn = document.getElementById('editProfileBtn');
  const cancelBtn = document.getElementById('cancelEditBtn');
  const form = document.getElementById('editForm');
  const view = document.getElementById('detailsView');

  function showForm() {
    form.hidden = false;
    view.hidden = true;
    toggleBtn.setAttribute('aria-expanded', 'true');
  }

  function hideForm() {
    form.hidden = true;
    view.hidden = false;
    toggleBtn.setAttribute('aria-expanded', 'false');
  }

  if (toggleBtn) toggleBtn.addEventListener('click', () => {
    if (form.hidden) showForm(); else hideForm();
  });

  if (editBtn) editBtn.addEventListener('click', showForm);
  if (cancelBtn) cancelBtn.addEventListener('click', hideForm);

  form?.addEventListener('submit', (e) => {
    e.preventDefault();

    // Example: write values back to the read-only view
    const v = (id) => document.getElementById(id).value.trim();
    document.getElementById('detailFullName').textContent = v('inputFullName') || '—';
    document.getElementById('detailPreferred').textContent = v('inputPreferred') || '—';
    document.getElementById('profileEmail').textContent = v('inputEmail') || '—';
    document.getElementById('profilePhone').textContent = v('inputPhone') || '—';
    document.getElementById('detailBio').textContent = v('inputBio') || '—';

    hideForm();
  });

  // Small niceties
  document.getElementById('copyProfileLinkBtn')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      alert('Profile link copied!');
    } catch {
      alert('Could not copy link.');
    }
  });
})();