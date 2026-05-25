/* ============================================================
   A-Town Hoops — main.js
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

  const loaders = {
    home:    loadHomePage,
    trophy:  loadTrophyPosts,
    teams:   () => loadTeams('boys'),
    gallery: loadGallery,
    about:   loadBoardMembers,
    admin:   showAdminPage,
  };
  if (loaders[id]) loaders[id]();
}

/* ── HOME PAGE ── */
async function loadHomePage() {
  await Promise.all([loadAnnouncements(), loadUpcomingEvents()]);
}

async function loadAnnouncements() {
  const section = document.getElementById('home-announcements-section');
  const container = document.getElementById('home-announcements');

  const { data } = await db
    .from('announcements')
    .select('*')
    .eq('is_published', true)
    .order('published_at', { ascending: false })
    .limit(3);

  if (!data || !data.length) { section.classList.add('section-hidden'); return; }

  section.classList.remove('section-hidden');
  container.innerHTML = data.map(a => `
    <div class="announcement-card">
      <div class="announcement-date">${formatDate(a.published_at)}</div>
      <h3 class="announcement-title">${a.title}</h3>
      <p class="announcement-body">${a.body}</p>
    </div>
  `).join('');
}

async function loadUpcomingEvents() {
  const section = document.getElementById('home-events-section');
  const container = document.getElementById('home-events');
  const today = new Date().toISOString().split('T')[0];

  const { data } = await db
    .from('events')
    .select('*')
    .gte('event_date', today)
    .order('event_date', { ascending: true })
    .limit(5);

  if (!data || !data.length) { section.classList.add('section-hidden'); return; }

  section.classList.remove('section-hidden');
  const typeIcon = { tryout: '📋', tournament: '🏆', game: '🏀', practice: '🎯', other: '📌' };

  container.innerHTML = data.map(e => `
    <div class="event-row">
      <div class="event-date-block">
        <div class="event-month">${new Date(e.event_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' })}</div>
        <div class="event-day">${new Date(e.event_date + 'T00:00:00').getDate()}</div>
      </div>
      <div class="event-info">
        <div class="event-title">${typeIcon[e.event_type] || '📌'} ${e.title}</div>
        ${e.event_time   ? `<div class="event-meta">${e.event_time}</div>` : ''}
        ${e.location     ? `<div class="event-meta">📍 ${e.location}</div>` : ''}
        ${e.team         ? `<div class="event-meta">👥 ${e.team}</div>` : ''}
        ${e.description  ? `<div class="event-desc">${e.description}</div>` : ''}
      </div>
    </div>
  `).join('');
}

/* ── TROPHY CASE ── */
async function loadTrophyPosts() {
  const container = document.getElementById('trophy-list');
  container.innerHTML = '<p class="trophy-state">Loading…</p>';

  const { data, error } = await db
    .from('trophy_posts')
    .select('*')
    .order('date', { ascending: false });

  if (error) { container.innerHTML = '<p class="trophy-state">Could not load entries.</p>'; return; }
  if (!data.length) { container.innerHTML = '<p class="trophy-state">No entries yet — check back soon.</p>'; return; }

  container.innerHTML = data.map(renderTrophyPost).join('');
}

function renderTrophyPost(post) {
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
        <span class="trophy-post-date">${formatDate(post.date)}</span>
        <span class="trophy-post-badge trophy-post-badge--${post.achievement_type}">${type.icon} ${type.label}</span>
      </div>
      <h2 class="trophy-post-title">${post.title}</h2>
      <div class="trophy-post-team">${post.team}</div>
      ${post.description ? `<p class="trophy-post-desc">${post.description}</p>` : ''}
      ${post.photo_url   ? `<img class="trophy-post-photo" src="${post.photo_url}" alt="${post.title}" loading="lazy" />` : ''}
    </article>`;
}

/* ── TEAMS ── */
async function loadTeams(gender) {
  const id = gender.toLowerCase() === 'boys' ? 'boys-cards' : 'girls-cards';
  const container = document.getElementById(id);
  container.innerHTML = '<p class="trophy-state">Loading…</p>';

  const { data, error } = await db
    .from('teams')
    .select('*')
    .eq('gender', gender.charAt(0).toUpperCase() + gender.slice(1))
    .order('display_order', { ascending: true });

  if (error || !data.length) { container.innerHTML = '<p class="trophy-state">No teams found.</p>'; return; }

  container.innerHTML = data.map(t => `
    <div class="team-card">
      <div class="team-card-top">
        <div class="team-card-grade">${t.grade} <span>Grade</span></div>
        <div class="team-card-label">${t.gender} Basketball</div>
      </div>
      <div class="team-card-meta">
        ${t.age_range  ? `<div class="team-card-meta-row"><span class="meta-icon">📅</span> ${t.age_range}</div>` : ''}
        <div class="team-card-meta-row"><span class="meta-icon">👤</span> Coach: ${t.coach_name || 'TBD'}</div>
      </div>
      <div class="team-card-bottom">
        ${(t.league || 'AAU · Wesco').split('·').map(l => `<span class="chip">${l.trim()}</span>`).join('')}
      </div>
    </div>`).join('');
}

/* ── GALLERY ── */
async function loadGallery() {
  const container = document.getElementById('gallery-grid');
  const emptyNote = document.getElementById('gallery-empty-note');
  container.innerHTML = '<p class="trophy-state">Loading…</p>';

  const { data, error } = await db
    .from('gallery_items')
    .select('*')
    .order('created_at', { ascending: false });

  if (error || !data || !data.length) {
    container.innerHTML = '';
    emptyNote.style.display = 'block';
    return;
  }

  emptyNote.style.display = 'none';
  container.innerHTML = data.map((item, i) => `
    <div class="g-item ${i === 0 ? 'g-item--featured' : ''}">
      <img src="${item.photo_url}" alt="${item.caption || 'A-Town Hoops'}" loading="lazy" class="g-img" />
      ${item.caption ? `<div class="g-caption">${item.caption}${item.team ? ` · ${item.team}` : ''}</div>` : ''}
    </div>`).join('');
}

/* ── BOARD MEMBERS ── */
async function loadBoardMembers() {
  const container = document.getElementById('board-grid');
  container.innerHTML = '<p class="trophy-state">Loading…</p>';

  const { data, error } = await db
    .from('board_members')
    .select('*')
    .order('display_order', { ascending: true });

  if (error || !data.length) { container.innerHTML = '<p class="trophy-state">Could not load board.</p>'; return; }

  container.innerHTML = data.map(m => `
    <div class="board-cell">
      <div class="board-role">${m.role}</div>
      <div class="board-name">${m.name}</div>
    </div>`).join('');
}

/* ── ADMIN AUTH ── */
function isAdminAuthed() { return sessionStorage.getItem('atown_admin') === '1'; }

function showAdminPage() {
  const gate      = document.getElementById('admin-gate');
  const dashboard = document.getElementById('admin-dashboard');
  if (isAdminAuthed()) {
    gate.style.display = 'none';
    dashboard.classList.remove('admin-dashboard--hidden');
    loadAdminPosts();
  } else {
    gate.style.display = 'block';
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

/* ── ADMIN TAB SWITCHING ── */
function switchAdminTab(tab, btn) {
  document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('atab-' + tab).classList.add('active');
  btn.classList.add('active');

  const loaders = {
    trophy:        loadAdminPosts,
    announcements: loadAdminAnnouncements,
    teams:         loadAdminTeams,
    events:        loadAdminEvents,
    gallery:       loadAdminGallery,
    board:         loadAdminBoard,
  };
  if (loaders[tab]) loaders[tab]();
}

/* ── ADMIN: TROPHY CASE ── */
async function submitTrophyPost() {
  const date = document.getElementById('ap-date').value;
  const title = document.getElementById('ap-title').value.trim();
  const team  = document.getElementById('ap-team').value.trim();
  const type  = document.getElementById('ap-type').value;
  const desc  = document.getElementById('ap-desc').value.trim();
  const photo = document.getElementById('ap-photo').value.trim();

  if (!date || !title || !team || !type) { alert('Date, Title, Team, and Type are required.'); return; }

  await adminInsert('trophy_posts', { date, title, team, achievement_type: type, description: desc || null, photo_url: photo || null },
    ['ap-date','ap-title','ap-team','ap-desc','ap-photo'], 'ap-type', 'ap-submit', 'Publish Entry →', loadAdminPosts);
}

async function loadAdminPosts() {
  const { data } = await db.from('trophy_posts').select('*').order('date', { ascending: false });
  renderAdminList('admin-posts-list', data, p =>
    `<span class="admin-post-date">${p.date}</span><span class="admin-post-title-text">${p.title}</span><span class="admin-post-team">${p.team}</span>`,
    id => deleteTrophyPost(id));
}

async function deleteTrophyPost(id) {
  await adminDelete('trophy_posts', id, loadAdminPosts);
}

/* ── ADMIN: ANNOUNCEMENTS ── */
async function submitAnnouncement() {
  const title = document.getElementById('an-title').value.trim();
  const body  = document.getElementById('an-body').value.trim();
  const date  = document.getElementById('an-date').value || new Date().toISOString().split('T')[0];
  const pub   = document.getElementById('an-published').checked;

  if (!title || !body) { alert('Title and body are required.'); return; }

  await adminInsert('announcements', { title, body, published_at: date, is_published: pub },
    ['an-title','an-body','an-date'], null, 'an-submit', 'Publish →', loadAdminAnnouncements);
}

async function loadAdminAnnouncements() {
  const { data } = await db.from('announcements').select('*').order('published_at', { ascending: false });
  renderAdminList('admin-announcements-list', data, a =>
    `<span class="admin-post-date">${a.published_at}</span><span class="admin-post-title-text">${a.title}</span><span class="admin-post-team">${a.is_published ? 'Visible' : 'Hidden'}</span>`,
    id => adminDelete('announcements', id, loadAdminAnnouncements));
}

/* ── ADMIN: TEAMS ── */
async function submitTeam() {
  const grade  = document.getElementById('tm-grade').value;
  const gender = document.getElementById('tm-gender').value;
  const coach  = document.getElementById('tm-coach').value.trim();
  const age    = document.getElementById('tm-age').value.trim();
  const league = document.getElementById('tm-league').value.trim();
  const season = document.getElementById('tm-season').value.trim();

  if (!grade || !gender) { alert('Grade and Program are required.'); return; }

  await adminInsert('teams', { grade, gender, coach_name: coach || null, age_range: age || null, league: league || 'AAU · Wesco', season: season || '25–26' },
    ['tm-coach','tm-age','tm-league','tm-season'], 'tm-grade', 'tm-submit', 'Save Team →', loadAdminTeams);
  document.getElementById('tm-gender').value = '';
}

async function loadAdminTeams() {
  const { data } = await db.from('teams').select('*').order('display_order').order('gender').order('grade');
  renderAdminList('admin-teams-list', data, t =>
    `<span class="admin-post-date">${t.gender}</span><span class="admin-post-title-text">${t.grade} Grade</span><span class="admin-post-team">Coach: ${t.coach_name || 'TBD'}</span>`,
    id => adminDelete('teams', id, loadAdminTeams));
}

/* ── ADMIN: EVENTS ── */
async function submitEvent() {
  const title    = document.getElementById('ev-title').value.trim();
  const type     = document.getElementById('ev-type').value;
  const date     = document.getElementById('ev-date').value;
  const time     = document.getElementById('ev-time').value.trim();
  const location = document.getElementById('ev-location').value.trim();
  const team     = document.getElementById('ev-team').value.trim();
  const desc     = document.getElementById('ev-desc').value.trim();

  if (!title || !type || !date) { alert('Title, Type, and Date are required.'); return; }

  await adminInsert('events', { title, event_type: type, event_date: date, event_time: time || null, location: location || null, team: team || null, description: desc || null },
    ['ev-title','ev-date','ev-time','ev-location','ev-team','ev-desc'], 'ev-type', 'ev-submit', 'Add Event →', loadAdminEvents);
}

async function loadAdminEvents() {
  const { data } = await db.from('events').select('*').order('event_date', { ascending: true });
  renderAdminList('admin-events-list', data, e =>
    `<span class="admin-post-date">${e.event_date}</span><span class="admin-post-title-text">${e.title}</span><span class="admin-post-team">${e.event_type}${e.team ? ' · ' + e.team : ''}</span>`,
    id => adminDelete('events', id, loadAdminEvents));
}

/* ── ADMIN: GALLERY ── */
async function submitGalleryItem() {
  const url     = document.getElementById('gl-url').value.trim();
  const caption = document.getElementById('gl-caption').value.trim();
  const team    = document.getElementById('gl-team').value.trim();
  const date    = document.getElementById('gl-date').value;

  if (!url) { alert('Photo URL is required.'); return; }

  await adminInsert('gallery_items', { photo_url: url, caption: caption || null, team: team || null, event_date: date || null },
    ['gl-url','gl-caption','gl-team','gl-date'], null, 'gl-submit', 'Add Photo →', loadAdminGallery);
}

async function loadAdminGallery() {
  const { data } = await db.from('gallery_items').select('*').order('created_at', { ascending: false });
  renderAdminList('admin-gallery-list', data, g =>
    `<span class="admin-post-date">${g.event_date || '—'}</span><span class="admin-post-title-text">${g.caption || 'No caption'}</span><span class="admin-post-team">${g.team || ''}</span>`,
    id => adminDelete('gallery_items', id, loadAdminGallery));
}

/* ── ADMIN: BOARD MEMBERS ── */
async function submitBoardMember() {
  const role  = document.getElementById('bm-role').value.trim();
  const name  = document.getElementById('bm-name').value.trim();
  const order = parseInt(document.getElementById('bm-order').value) || 99;

  if (!role || !name) { alert('Role and Name are required.'); return; }

  await adminInsert('board_members', { role, name, display_order: order },
    ['bm-role','bm-name','bm-order'], null, 'bm-submit', 'Add Member →', loadAdminBoard);
}

async function loadAdminBoard() {
  const { data } = await db.from('board_members').select('*').order('display_order');
  renderAdminList('admin-board-list', data, m =>
    `<span class="admin-post-date">#${m.display_order}</span><span class="admin-post-title-text">${m.name}</span><span class="admin-post-team">${m.role}</span>`,
    id => adminDelete('board_members', id, loadAdminBoard));
}

/* ── ADMIN HELPERS ── */
async function adminInsert(table, payload, textFieldIds, selectId, btnId, btnLabel, reloadFn) {
  const btn = document.getElementById(btnId);
  btn.textContent = 'Saving…';
  btn.disabled = true;

  const { error } = await db.from(table).insert(payload);

  btn.textContent = btnLabel;
  btn.disabled = false;

  if (error) { alert('Error: ' + error.message); return; }

  textFieldIds.forEach(id => { document.getElementById(id).value = ''; });
  if (selectId) document.getElementById(selectId).value = '';

  showToast('✓ Saved.');
  reloadFn();
}

async function adminDelete(table, id, reloadFn) {
  if (!confirm('Delete this entry? This cannot be undone.')) return;
  const { error } = await db.from(table).delete().eq('id', id);
  if (error) { alert('Error: ' + error.message); return; }
  showToast('Deleted.');
  reloadFn();
}

function renderAdminList(containerId, data, rowContentFn, deleteFn) {
  const list = document.getElementById(containerId);
  if (!data || !data.length) { list.innerHTML = '<p class="admin-state">No entries yet.</p>'; return; }
  list.innerHTML = data.map(item => `
    <div class="admin-post-row">
      <div class="admin-post-info">${rowContentFn(item)}</div>
      <button type="button" class="admin-delete-btn" onclick="(${deleteFn.toString()})('${item.id}')">Delete</button>
    </div>`).join('');
}

/* ── TEAM TABS ── */
function switchTeam(gender, btn) {
  document.querySelectorAll('.team-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.team-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('panel-' + gender).classList.add('active');
  btn.classList.add('active');
  loadTeams(gender);
}

/* ── MOBILE MENU ── */
function toggleMenu() { document.getElementById('nav-links').classList.toggle('open'); }

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
  if (!name || !email || !msg) { alert('Please fill in your name, email, and message.'); return; }
  showToast('✓ Message sent — we\'ll be in touch soon.');
  document.getElementById('cf-name').value    = '';
  document.getElementById('cf-email').value   = '';
  document.getElementById('cf-message').value = '';
  document.getElementById('cf-topic').value   = '';
}

/* ── UTILS ── */
function formatDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

/* ── CLOSE MENU ON OUTSIDE CLICK ── */
document.addEventListener('click', e => {
  const nav    = document.getElementById('nav-links');
  const burger = document.getElementById('hamburger');
  if (nav && burger && !nav.contains(e.target) && !burger.contains(e.target)) {
    nav.classList.remove('open');
  }
});

/* ── INIT ── */
loadHomePage();
loadTeams('boys');
