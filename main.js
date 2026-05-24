/* ============================================================
   A-Town Hoops — main.js
   Navigation, Supabase (Trophy Case + Admin), team tabs,
   contact form, mobile menu
   ============================================================ */

/* ── SUPABASE ── */
const SUPABASE_URL = 'https://vyjzsexezrerwyilpefe.supabase.co';
const SUPABASE_KEY = 'sb_publishable_-nOqmPHrr0f4UQzwQ9xqGg_Hrqytm9g';
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const ADMIN_PASSWORD = 'Atownhoops';

/* ── PAGE NAVIGATION ── */
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));

  const page = document.getElementById('page-' + id);
  if (page) page.classList.add('active');

  const navLink = document.getElementById('nav-' + id);
  if (navLink) navLink.classList.add('active');

  window.scrollTo({ top: 0, behavior: 'smooth' });
  document.getElementById('nav-links').classList.remove('open');

  if (id === 'trophy') loadTrophyPosts();
  if (id === 'admin')  showAdminPage();
}

/* ── TROPHY CASE ── */
async function loadTrophyPosts() {
  const container = document.getElementById('trophy-list');
  container.innerHTML = '<p class="trophy-state">Loading…</p>';

  const { data, error } = await db
    .from('trophy_posts')
    .select('*')
    .order('date', { ascending: false });

  if (error) {
    container.innerHTML = '<p class="trophy-state">Could not load entries. Please try again.</p>';
    return;
  }

  if (!data.length) {
    container.innerHTML = '<p class="trophy-state">No entries yet — check back soon.</p>';
    return;
  }

  container.innerHTML = data.map(renderTrophyPost).join('');
}

function renderTrophyPost(post) {
  const date = new Date(post.date + 'T00:00:00').toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  const typeMap = {
    championship:    { label: 'Championship',    icon: '🏆' },
    tournament_win:  { label: 'Tournament Win',  icon: '🥇' },
    state_qualifier: { label: 'State Qualifier', icon: '🎫' },
    milestone:       { label: 'Milestone',       icon: '⭐' },
  };
  const type = typeMap[post.achievement_type] || { label: post.achievement_type, icon: '📌' };

  return `
    <article class="trophy-post">
      <div class="trophy-post-meta">
        <span class="trophy-post-date">${date}</span>
        <span class="trophy-post-badge trophy-post-badge--${post.achievement_type}">${type.icon} ${type.label}</span>
      </div>
      <h2 class="trophy-post-title">${post.title}</h2>
      <div class="trophy-post-team">${post.team}</div>
      ${post.description ? `<p class="trophy-post-desc">${post.description}</p>` : ''}
      ${post.photo_url   ? `<img class="trophy-post-photo" src="${post.photo_url}" alt="${post.title}" loading="lazy" />` : ''}
    </article>
  `;
}

/* ── ADMIN AUTH ── */
function isAdminAuthed() {
  return sessionStorage.getItem('atown_admin') === '1';
}

function showAdminPage() {
  const gate      = document.getElementById('admin-gate');
  const dashboard = document.getElementById('admin-dashboard');

  if (isAdminAuthed()) {
    gate.style.display      = 'none';
    dashboard.classList.remove('admin-dashboard--hidden');
    loadAdminPosts();
  } else {
    gate.style.display      = 'block';
    dashboard.classList.add('admin-dashboard--hidden');
  }
}

function adminLogin() {
  const pw  = document.getElementById('admin-pw').value;
  const err = document.getElementById('admin-pw-error');

  if (pw === ADMIN_PASSWORD) {
    sessionStorage.setItem('atown_admin', '1');
    err.classList.add('admin-pw-error--hidden');
    document.getElementById('admin-pw').value = '';
    showAdminPage();
  } else {
    err.classList.remove('admin-pw-error--hidden');
  }
}

/* ── ADMIN CRUD ── */
async function submitTrophyPost() {
  const date        = document.getElementById('ap-date').value;
  const title       = document.getElementById('ap-title').value.trim();
  const team        = document.getElementById('ap-team').value.trim();
  const type        = document.getElementById('ap-type').value;
  const description = document.getElementById('ap-desc').value.trim();
  const photo_url   = document.getElementById('ap-photo').value.trim();

  if (!date || !title || !team || !type) {
    alert('Date, Title, Team, and Achievement Type are required.');
    return;
  }

  const btn = document.getElementById('ap-submit');
  btn.textContent = 'Publishing…';
  btn.disabled    = true;

  const { error } = await db.from('trophy_posts').insert({
    date, title, team,
    achievement_type: type,
    description: description || null,
    photo_url:   photo_url   || null,
  });

  btn.textContent = 'Publish Entry →';
  btn.disabled    = false;

  if (error) { alert('Error: ' + error.message); return; }

  ['ap-date', 'ap-title', 'ap-team', 'ap-desc', 'ap-photo'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('ap-type').value = '';

  showToast('✓ Entry published.');
  loadAdminPosts();
}

async function loadAdminPosts() {
  const list = document.getElementById('admin-posts-list');
  list.innerHTML = '<p class="admin-state">Loading…</p>';

  const { data, error } = await db
    .from('trophy_posts')
    .select('*')
    .order('date', { ascending: false });

  if (error || !data || !data.length) {
    list.innerHTML = '<p class="admin-state">No entries yet.</p>';
    return;
  }

  list.innerHTML = data.map(p => `
    <div class="admin-post-row">
      <div class="admin-post-info">
        <span class="admin-post-date">${p.date}</span>
        <span class="admin-post-title-text">${p.title}</span>
        <span class="admin-post-team">${p.team}</span>
      </div>
      <button class="admin-delete-btn" onclick="deleteTrophyPost('${p.id}')">Delete</button>
    </div>
  `).join('');
}

async function deleteTrophyPost(id) {
  if (!confirm('Delete this entry? This cannot be undone.')) return;

  const { error } = await db.from('trophy_posts').delete().eq('id', id);
  if (error) { alert('Error: ' + error.message); return; }

  showToast('Entry deleted.');
  loadAdminPosts();
}

/* ── TEAM TABS ── */
function switchTeam(team, btn) {
  document.querySelectorAll('.team-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.team-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('panel-' + team).classList.add('active');
  btn.classList.add('active');
}

/* ── MOBILE MENU ── */
function toggleMenu() {
  document.getElementById('nav-links').classList.toggle('open');
}

/* ── TOAST ── */
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 4000);
}

/* ── CONTACT FORM ── */
function submitForm() {
  const name  = document.getElementById('cf-name').value.trim();
  const email = document.getElementById('cf-email').value.trim();
  const msg   = document.getElementById('cf-message').value.trim();

  if (!name || !email || !msg) {
    alert('Please fill in your name, email, and message.');
    return;
  }

  showToast('✓ Message sent — we\'ll be in touch soon.');

  document.getElementById('cf-name').value    = '';
  document.getElementById('cf-email').value   = '';
  document.getElementById('cf-message').value = '';
  document.getElementById('cf-topic').value   = '';
}

/* ── CLICK OUTSIDE CLOSES MENU ── */
document.addEventListener('click', e => {
  const nav    = document.getElementById('nav-links');
  const burger = document.getElementById('hamburger');
  if (nav && burger && !nav.contains(e.target) && !burger.contains(e.target)) {
    nav.classList.remove('open');
  }
});
