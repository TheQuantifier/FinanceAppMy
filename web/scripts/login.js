// scripts/login.js
document.addEventListener('DOMContentLoaded', () => {
    const year = document.getElementById('year');
    if (year) year.textContent = new Date().getFullYear();
  
    const API_BASE = 'http://localhost:4000/api/auth';
    const form = document.getElementById('loginForm');
    const errorEl = document.getElementById('loginError');
  
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorEl.textContent = '';
  
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value.trim();
  
      try {
        const res = await fetch(`${API_BASE}/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include', // Needed to store JWT cookie
          body: JSON.stringify({ email, password }),
        });
  
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Login failed');
  
        // Success → redirect to home
        window.location.href = 'home.html';
      } catch (err) {
        errorEl.textContent = err.message;
      }
    });
});
  