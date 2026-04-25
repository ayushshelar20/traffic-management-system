// ===== SHARED UTILITIES =====

// Dark mode toggle
function initTheme() {
  const saved = localStorage.getItem('theme');
  if (saved) document.documentElement.setAttribute('data-theme', saved);
  else if (window.matchMedia('(prefers-color-scheme: dark)').matches)
    document.documentElement.setAttribute('data-theme', 'dark');
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  const btn = document.querySelector('.theme-toggle');
  if (btn) btn.textContent = next === 'dark' ? '☀️' : '🌙';
}

// Mobile nav
function initNav() {
  const hamburger = document.querySelector('.hamburger');
  const navLinks = document.querySelector('.nav-links');
  if (hamburger && navLinks) {
    hamburger.addEventListener('click', () => navLinks.classList.toggle('open'));
    navLinks.querySelectorAll('a').forEach(a =>
      a.addEventListener('click', () => navLinks.classList.remove('open'))
    );
  }
  // Active link
  const path = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a').forEach(a => {
    const href = a.getAttribute('href');
    if (href === path || (path === '' && href === 'index.html'))
      a.classList.add('active');
  });
  // Theme button text
  const btn = document.querySelector('.theme-toggle');
  if (btn) {
    btn.textContent = document.documentElement.getAttribute('data-theme') === 'dark' ? '☀️' : '🌙';
    btn.addEventListener('click', toggleTheme);
  }
}

// Intersection Observer for fade-in animations
function initAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
  }, { threshold: 0.15 });
  document.querySelectorAll('.fade-in, .flow-step').forEach(el => observer.observe(el));
}

// Navbar template
function getNavHTML() {
  return `
  <nav class="navbar">
    <a href="index.html" class="nav-brand">
      <svg viewBox="0 0 64 64" fill="none"><rect x="20" y="4" width="24" height="56" rx="6" fill="currentColor"/><circle cx="32" cy="18" r="5" fill="#ef4444"/><circle cx="32" cy="32" r="5" fill="#f59e0b"/><circle cx="32" cy="46" r="5" fill="#22c55e"/></svg>
      TrafficAI
    </a>
    <ul class="nav-links">
      <li><a href="index.html">Home</a></li>
      <li><a href="how-it-works.html">How It Works</a></li>
      <li><a href="simulation.html">Simulation</a></li>
      <li><a href="visualization.html">Analytics</a></li>
      <li><a href="about.html">About</a></li>
    </ul>
    <button class="theme-toggle" aria-label="Toggle theme">🌙</button>
    <button class="hamburger" aria-label="Menu">
      <span></span><span></span><span></span>
    </button>
  </nav>`;
}

function getFooterHTML() {
  return `
  <footer class="footer">
    <p>© 2026 TrafficAI — AI-Based Smart Traffic Control System | 
    <a href="simulation.html">Launch Simulation</a> | 
    <a href="about.html">About Project</a></p>
  </footer>`;
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  // Inject nav and footer if placeholders exist
  const navEl = document.getElementById('navbar-placeholder');
  if (navEl) navEl.outerHTML = getNavHTML();
  const footEl = document.getElementById('footer-placeholder');
  if (footEl) footEl.outerHTML = getFooterHTML();
  initNav();
  initAnimations();
});
