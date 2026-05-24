/* ============================================================
   A-Town Hoops — main.js
   Navigation, page switching, team tabs, form, mobile menu
   ============================================================ */

/**
 * Show a page by id and update nav active state.
 * @param {string} id - one of: home | about | teams | gallery | contact
 */
function showPage(id) {
  // Hide all pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  // Deactivate all nav links
  document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));

  const page = document.getElementById('page-' + id);
  if (page) page.classList.add('active');

  const navLink = document.getElementById('nav-' + id);
  if (navLink) navLink.classList.add('active');

  window.scrollTo({ top: 0, behavior: 'smooth' });
  document.getElementById('nav-links').classList.remove('open');
}

/**
 * Switch between Boys / Girls team panels.
 * @param {string} team - 'boys' or 'girls'
 * @param {HTMLElement} btn - the clicked tab button
 */
function switchTeam(team, btn) {
  document.querySelectorAll('.team-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.team-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('panel-' + team).classList.add('active');
  btn.classList.add('active');
}

/** Toggle the mobile hamburger menu */
function toggleMenu() {
  document.getElementById('nav-links').classList.toggle('open');
}

/** Show a toast notification */
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 4000);
}

/** Handle contact form submission */
function submitForm() {
  const name  = document.getElementById('cf-name').value.trim();
  const email = document.getElementById('cf-email').value.trim();
  const msg   = document.getElementById('cf-message').value.trim();

  if (!name || !email || !msg) {
    alert('Please fill in your name, email, and message.');
    return;
  }

  // TODO: wire up to a real form backend (e.g. Formspree, EmailJS)
  showToast('✓ Message sent — we\'ll be in touch soon.');

  document.getElementById('cf-name').value    = '';
  document.getElementById('cf-email').value   = '';
  document.getElementById('cf-message').value = '';
  document.getElementById('cf-topic').value   = '';
}

/* Close mobile menu when clicking outside */
document.addEventListener('click', e => {
  const nav    = document.getElementById('nav-links');
  const burger = document.getElementById('hamburger');
  if (nav && burger && !nav.contains(e.target) && !burger.contains(e.target)) {
    nav.classList.remove('open');
  }
});
