/* ============================================================
   A-Town Hoops — main.js
   ============================================================ */

/* ── SUPABASE ── */
const SUPABASE_URL = 'https://vyjzsexezrerwyilpefe.supabase.co';
const SUPABASE_KEY = 'sb_publishable_-nOqmPHrr0f4UQzwQ9xqGg_Hrqytm9g';
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const ADMIN_PASSWORD = 'Atownhoops';

/* ── EDIT STATE ── */
let _editing = { section: null, id: null };
const _store  = {}; // id → cached row for edit population

/* ── RICH TEXT EDITORS ── */
let quillTrophy, quillAnnouncements, quillEvent;
const QUILL_TOOLBAR = [
  ['bold', 'italic', 'underline'],
  [{ list: 'ordered' }, { list: 'bullet' }],
  ['link'],
  ['clean'],
];
function initEditors() {
  quillTrophy        = new Quill('#ap-desc-editor',  { theme: 'snow', modules: { toolbar: QUILL_TOOLBAR }, placeholder: 'A short note about the achievement…' });
  quillAnnouncements = new Quill('#an-body-editor',   { theme: 'snow', modules: { toolbar: QUILL_TOOLBAR }, placeholder: 'Write your announcement here…' });
  quillEvent         = new Quill('#ev-desc-editor',   { theme: 'snow', modules: { toolbar: QUILL_TOOLBAR }, placeholder: 'Any additional details…' });
}
function quillHTML(q) {
  const html = q.root.innerHTML;
  return (html === '<p><br></p>' || html === '') ? null : html;
}

const SUBMIT_LABELS = {
  trophy: 'Publish Entry →', announcements: 'Publish →', teams: 'Save Team →',
  events: 'Add Event →',    gallery: 'Add Photo →',      board: 'Add Member →',
};

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
    home:     loadHomePage,
    trophy:   loadTrophyPosts,
    teams:    () => loadTeams('boys'),
    schedule: loadSchedulePage,
    gallery:  loadGallery,
    about:    loadBoardMembers,
    admin:    showAdminPage,
  };
  if (loaders[id]) loaders[id]();
}

/* ── HOME PAGE ── */
async function loadHomePage() {
  await Promise.all([loadAnnouncements(), loadUpcomingEvents(), loadRegistrationStatus()]);
}

async function loadAnnouncements() {
  const section   = document.getElementById('home-announcements-section');
  const container = document.getElementById('home-announcements');
  const today = new Date().toISOString().split('T')[0];
  const { data }  = await db.from('announcements').select('*').eq('is_published', true)
    .or(`expires_at.is.null,expires_at.gte.${today}`)
    .order('published_at', { ascending: false }).limit(3);

  if (!data || !data.length) { section.classList.add('section-hidden'); return; }
  section.classList.remove('section-hidden');
  container.innerHTML = data.map(a => `
    <div class="announcement-card">
      <div class="announcement-date">${formatDate(a.published_at)}</div>
      <h3 class="announcement-title">${a.title}</h3>
      <div class="announcement-body">${a.body}</div>
    </div>`).join('');
}

async function loadUpcomingEvents() {
  const section   = document.getElementById('home-events-section');
  const container = document.getElementById('home-events');
  const today     = new Date().toISOString().split('T')[0];
  const { data }  = await db.from('events').select('*').gte('event_date', today)
    .order('event_date', { ascending: true }).limit(5);

  if (!data || !data.length) { section.classList.add('section-hidden'); return; }
  section.classList.remove('section-hidden');

  const typeIcon = { tryout: '📋', tournament: '🏆', game: '🏀', practice: '🎯', other: '📌' };
  container.innerHTML = data.map(e => {
    const d = new Date(e.event_date + 'T00:00:00');
    return `
      <div class="event-row">
        <div class="event-date-block">
          <div class="event-month">${d.toLocaleDateString('en-US', { month: 'short' })}</div>
          <div class="event-day">${d.getDate()}</div>
        </div>
        <div class="event-info">
          <div class="event-title">${typeIcon[e.event_type] || '📌'} ${e.title}</div>
          ${e.event_time ? `<div class="event-meta">${e.event_time}</div>` : ''}
          ${e.end_date && e.end_date !== e.event_date ? `<div class="event-meta">📅 Through ${formatDate(e.end_date)}</div>` : ''}
          ${e.location    ? `<div class="event-meta">📍 ${e.location}</div>` : ''}
          ${e.team        ? `<div class="event-meta">👥 ${e.team}</div>` : ''}
          ${e.description ? `<div class="event-desc">${e.description}</div>` : ''}
        </div>
      </div>`;
  }).join('');
}

/* ── REGISTRATION GATING ── */
function applyRegistrationGating(isOpen) {
  document.body.classList.toggle('reg-closed', !isOpen);
}

/* ── REGISTRATION STATUS ── */
async function loadRegistrationStatus() {
  const { data } = await db.from('registration_status').select('*');
  if (!data) return;
  const anyOpen = data.some(r => r.is_open);
  applyRegistrationGating(anyOpen);
  const section = document.getElementById('home-reg-section');
  const cards   = document.getElementById('home-reg-cards');
  if (!anyOpen) { section.classList.add('section-hidden'); return; }
  section.classList.remove('section-hidden');
  const open = data.filter(r => r.is_open);
  cards.innerHTML = open.map(r => {
    const label = r.program === 'boys' ? 'Boys' : 'Girls';
    return `
      <div class="reg-program-card">
        <div class="reg-program-card-top">
          <div class="reg-program-name">${label} <span>Program</span></div>
          ${r.grades ? `<div class="reg-program-grades">${r.grades}</div>` : ''}
        </div>
        <div class="reg-program-body">
          ${r.tryout_date ? `<div class="reg-info-row"><span class="reg-info-icon">📅</span>${r.tryout_date}</div>` : ''}
          ${r.tryout_time ? `<div class="reg-info-row"><span class="reg-info-icon">🕐</span>${r.tryout_time}</div>` : ''}
          ${r.location    ? `<div class="reg-info-row"><span class="reg-info-icon">📍</span>${r.location}</div>` : ''}
          ${r.deadline    ? `<div class="reg-deadline">⚠ Registration Deadline: ${r.deadline}</div>` : ''}
          ${r.notes       ? `<div class="reg-notes">${r.notes}</div>` : ''}
          <a href="https://forms.gle/YikHHK5KCYW21Gwn7" target="_blank" rel="noopener" class="reg-program-btn">Register for Tryouts →</a>
        </div>
      </div>`;
  }).join('');
}

/* ── SCHEDULE PAGE ── */
async function loadSchedulePage() {
  const container = document.getElementById('schedule-list');
  container.innerHTML = '<p class="trophy-state">Loading…</p>';
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await db.from('events').select('*')
    .gte('event_date', today).order('event_date', { ascending: true });
  if (error || !data || !data.length) {
    container.innerHTML = '<p class="trophy-state">No upcoming events scheduled.</p>';
    return;
  }
  const groups = {};
  data.forEach(e => {
    const key = new Date(e.event_date + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
    if (!groups[key]) groups[key] = [];
    groups[key].push(e);
  });
  const typeIcon = { tryout: '📋', tournament: '🏆', game: '🏀', practice: '🎯', other: '📌' };
  container.innerHTML = Object.entries(groups).map(([month, events]) => `
    <div class="schedule-month-group">
      <div class="schedule-month-label">${month}</div>
      ${events.map(e => {
        const d = new Date(e.event_date + 'T00:00:00');
        return `
          <div class="schedule-row">
            <div class="schedule-date-col">
              <div class="schedule-day">${d.getDate()}</div>
              <div class="schedule-weekday">${d.toLocaleDateString('en-US', { weekday: 'short' })}</div>
            </div>
            <div class="schedule-event-col">
              <div class="schedule-event-title">${typeIcon[e.event_type] || '📌'} ${e.title}</div>
              <div class="schedule-event-meta">
                ${e.end_date && e.end_date !== e.event_date ? `<span>📅 ${formatDateRange(e.event_date, e.end_date)}</span>` : ''}
                ${e.event_time ? `<span>🕐 ${e.event_time}</span>` : ''}
                ${e.location   ? `<span>📍 ${e.location}</span>` : ''}
                ${e.team       ? `<span>👥 ${e.team}</span>` : ''}
              </div>
              ${e.description ? `<div class="schedule-event-desc">${e.description}</div>` : ''}
            </div>
          </div>`;
      }).join('')}
    </div>`).join('');
}

/* ── TROPHY CASE ── */
async function loadTrophyPosts() {
  const container = document.getElementById('trophy-list');
  container.innerHTML = '<p class="trophy-state">Loading…</p>';
  const { data, error } = await db.from('trophy_posts').select('*').order('date', { ascending: false });
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
      ${post.description ? `<div class="trophy-post-desc">${post.description}</div>` : ''}
      ${post.photo_url   ? `<img class="trophy-post-photo" src="${post.photo_url}" alt="${post.title}" loading="lazy" />` : ''}
    </article>`;
}

/* ── TEAMS (public) ── */
async function loadTeams(gender) {
  const id        = gender.toLowerCase() === 'boys' ? 'boys-cards' : 'girls-cards';
  const container = document.getElementById(id);
  container.innerHTML = '<p class="trophy-state">Loading…</p>';

  const genderFormatted = gender.charAt(0).toUpperCase() + gender.slice(1).toLowerCase();
  const { data: teams, error } = await db.from('teams').select('*').eq('gender', genderFormatted)
    .order('display_order', { ascending: true });

  if (error || !teams || !teams.length) { container.innerHTML = '<p class="trophy-state">No teams found.</p>'; return; }

  const teamIds = teams.map(t => t.id);
  const { data: rosters } = await db.from('rosters').select('*').in('team_id', teamIds).order('player_name', { ascending: true });
  const rosterMap = {};
  (rosters || []).forEach(p => {
    if (!rosterMap[p.team_id]) rosterMap[p.team_id] = [];
    rosterMap[p.team_id].push(p);
  });

  container.innerHTML = teams.map(t => {
    const players = rosterMap[t.id] || [];
    const rosterHtml = players.length ? `
      <div class="team-card-roster">
        <div class="team-roster-label">Roster</div>
        <div class="team-roster-grid">
          ${players.map(p => `<span class="team-roster-pill">${p.jersey_number ? `<span class="roster-num">#${p.jersey_number}</span>` : ''}${p.player_name}</span>`).join('')}
        </div>
      </div>` : '';
    return `
      <div class="team-card">
        <div class="team-card-top">
          <div class="team-card-grade">${t.grade} <span>Grade</span></div>
          <div class="team-card-label">${t.gender} Basketball</div>
        </div>
        <div class="team-card-right">
          <div class="team-card-meta">
            ${t.age_range ? `<div class="team-card-meta-row"><span class="meta-icon">📅</span> ${t.age_range}</div>` : ''}
            <div class="team-card-meta-row"><span class="meta-icon">👤</span> Coach: ${t.coach_name || 'TBD'}</div>
            <div class="team-card-chips">
              ${(t.league || 'AAU · Wesco').split('·').map(l => `<span class="chip">${l.trim()}</span>`).join('')}
            </div>
          </div>
          ${rosterHtml}
        </div>
      </div>`;
  }).join('');
}

/* ── GALLERY (public) ── */
async function loadGallery() {
  const container = document.getElementById('gallery-grid');
  const emptyNote = document.getElementById('gallery-empty-note');
  container.innerHTML = '<p class="trophy-state">Loading…</p>';

  const { data, error } = await db.from('gallery_items').select('*').order('created_at', { ascending: false });
  if (error || !data || !data.length) {
    container.innerHTML = '';
    emptyNote.style.display = 'block';
    return;
  }
  emptyNote.style.display = 'none';
  container.innerHTML = data.map((item, i) => `
    <div class="g-item ${i === 0 ? 'g-item--featured' : ''}">
      <img src="${item.photo_url}" alt="${item.caption || 'A-Town Hoops'}" loading="lazy" class="g-img" />
      ${item.caption ? `<div class="g-caption">${item.caption}${item.team ? ' · ' + item.team : ''}</div>` : ''}
    </div>`).join('');
}

/* ── BOARD MEMBERS (public) ── */
async function loadBoardMembers() {
  const container = document.getElementById('board-grid');
  container.innerHTML = '<p class="trophy-state">Loading…</p>';
  const { data, error } = await db.from('board_members').select('*').order('display_order', { ascending: true });
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
    loadAdminAnnouncements();
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

/* ── ADMIN TAB SWITCHING ── */
function switchAdminTab(tab, btn) {
  document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('atab-' + tab).classList.add('active');
  btn.classList.add('active');
  const loaders = {
    trophy: loadAdminPosts, announcements: loadAdminAnnouncements, teams: loadAdminTeams,
    events: loadAdminEvents, gallery: loadAdminGallery, board: loadAdminBoard,
    settings: loadAdminSettings,
  };
  if (loaders[tab]) loaders[tab]();
}

/* ── EDIT MODE ── */
function startEdit(section, id) {
  const item = _store[id];
  if (!item) return;
  _editing = { section, id };

  const populators = {
    trophy: () => {
      set('ap-date', item.date); set('ap-title', item.title); set('ap-team', item.team);
      set('ap-type', item.achievement_type); set('ap-photo', item.photo_url || '');
      quillTrophy.clipboard.dangerouslyPasteHTML(item.description || '');
    },
    announcements: () => {
      set('an-title', item.title); set('an-date', item.published_at);
      set('an-expires', item.expires_at || '');
      document.getElementById('an-published').checked = item.is_published;
      quillAnnouncements.clipboard.dangerouslyPasteHTML(item.body || '');
    },
    teams: () => {
      set('tm-grade', item.grade); set('tm-gender', item.gender); set('tm-coach', item.coach_name || '');
      set('tm-age', item.age_range || ''); set('tm-league', item.league || ''); set('tm-season', item.season || '');
    },
    events: () => {
      set('ev-title', item.title); set('ev-type', item.event_type);
      set('ev-date', item.event_date); set('ev-end-date', item.end_date || '');
      set('ev-time', item.event_time || '');
      set('ev-location', item.location || ''); set('ev-team', item.team || '');
      quillEvent.clipboard.dangerouslyPasteHTML(item.description || '');
    },
    gallery: () => {
      set('gl-url', item.photo_url); set('gl-caption', item.caption || '');
      set('gl-team', item.team || ''); set('gl-date', item.event_date || '');
    },
    board: () => {
      set('bm-role', item.role); set('bm-name', item.name); set('bm-order', item.display_order || '');
    },
  };

  if (populators[section]) populators[section]();

  const prefix = { trophy: 'ap', announcements: 'an', teams: 'tm', events: 'ev', gallery: 'gl', board: 'bm' };
  const p = prefix[section];
  document.getElementById(p + '-submit').textContent = 'Update →';
  document.getElementById(p + '-cancel').classList.remove('admin-cancel--hidden');
  document.getElementById('atab-' + section).scrollIntoView({ behavior: 'smooth' });
}

function cancelEdit(section) {
  _editing = { section: null, id: null };

  const clearers = {
    trophy:        () => { clearFields(['ap-date','ap-title','ap-team','ap-photo'], ['ap-type']); quillTrophy.setText(''); },
    announcements: () => { clearFields(['an-title','an-date','an-expires']); document.getElementById('an-published').checked = true; quillAnnouncements.setText(''); },
    teams:         () => clearFields(['tm-coach','tm-age','tm-league','tm-season'], ['tm-grade','tm-gender']),
    events:        () => { clearFields(['ev-title','ev-date','ev-end-date','ev-time','ev-location','ev-team'], ['ev-type']); quillEvent.setText(''); },
    gallery:       () => clearFields(['gl-url','gl-caption','gl-team','gl-date']),
    board:         () => clearFields(['bm-role','bm-name','bm-order']),
  };
  if (clearers[section]) clearers[section]();

  const prefix = { trophy: 'ap', announcements: 'an', teams: 'tm', events: 'ev', gallery: 'gl', board: 'bm' };
  const p = prefix[section];
  document.getElementById(p + '-submit').textContent = SUBMIT_LABELS[section];
  document.getElementById(p + '-cancel').classList.add('admin-cancel--hidden');
}

/* ── ADMIN: TROPHY CASE ── */
async function submitTrophyPost() {
  const payload = {
    date: get('ap-date'), title: get('ap-title'), team: get('ap-team'),
    achievement_type: get('ap-type'), description: quillHTML(quillTrophy), photo_url: get('ap-photo') || null,
  };
  if (!payload.date || !payload.title || !payload.team || !payload.achievement_type) {
    alert('Date, Title, Team, and Type are required.'); return;
  }
  await adminSave('trophy', 'trophy_posts', payload, 'ap-submit', 'Publish Entry →', loadAdminPosts);
}

async function loadAdminPosts() {
  const { data } = await db.from('trophy_posts').select('*').order('date', { ascending: false });
  renderAdminList('admin-posts-list', 'trophy', data,
    p => `<span class="admin-post-date">${p.date}</span><span class="admin-post-title-text">${p.title}</span><span class="admin-post-team">${p.team}</span>`,
    'trophy_posts', loadAdminPosts);
}

/* ── ADMIN: ANNOUNCEMENTS ── */
async function submitAnnouncement() {
  const payload = {
    title: get('an-title'), body: quillHTML(quillAnnouncements) || '',
    published_at: get('an-date') || new Date().toISOString().split('T')[0],
    expires_at:   get('an-expires') || null,
    is_published: document.getElementById('an-published').checked,
  };
  if (!payload.title || !payload.body) { alert('Title and body are required.'); return; }
  await adminSave('announcements', 'announcements', payload, 'an-submit', 'Publish →', loadAdminAnnouncements);
}

async function loadAdminAnnouncements() {
  const { data } = await db.from('announcements').select('*').order('published_at', { ascending: false });
  renderAdminList('admin-announcements-list', 'announcements', data,
    a => `<span class="admin-post-date">${a.published_at}</span><span class="admin-post-title-text">${a.title}</span><span class="admin-post-team">${a.is_published ? 'Visible' : 'Hidden'}</span>`,
    'announcements', loadAdminAnnouncements);
}

/* ── ADMIN: TEAMS ── */
async function submitTeam() {
  const payload = {
    grade: get('tm-grade'), gender: get('tm-gender'), coach_name: get('tm-coach') || null,
    age_range: get('tm-age') || null, league: get('tm-league') || 'AAU · Wesco', season: get('tm-season') || '25–26',
  };
  if (!payload.grade || !payload.gender) { alert('Grade and Program are required.'); return; }
  await adminSave('teams', 'teams', payload, 'tm-submit', 'Save Team →', loadAdminTeams);
}

async function loadAdminTeams() {
  const { data } = await db.from('teams').select('*').order('gender').order('display_order');
  const list = document.getElementById('admin-teams-list');
  if (!data || !data.length) { list.innerHTML = '<p class="admin-state">No teams yet.</p>'; return; }
  data.forEach(item => { _store[item.id] = item; });
  list.innerHTML = data.map(t => `
    <div class="admin-post-row">
      <div class="admin-post-info">
        <span class="admin-post-date">${t.gender}</span>
        <span class="admin-post-title-text">${t.grade} Grade</span>
        <span class="admin-post-team">Coach: ${t.coach_name || 'TBD'}</span>
      </div>
      <div class="admin-row-actions">
        <button type="button" class="admin-edit-btn" onclick="openRosterManager('${t.id}', '${t.grade} ${t.gender}')">Roster</button>
        <button type="button" class="admin-edit-btn" onclick="startEdit('teams', '${t.id}')">Edit</button>
        <button type="button" class="admin-delete-btn" onclick="adminDelete('teams', '${t.id}', loadAdminTeams)">Delete</button>
      </div>
    </div>`).join('');
}

/* ── ROSTER MANAGEMENT ── */
let _rosterTeamId = null;

function openRosterManager(teamId, teamName) {
  _rosterTeamId = teamId;
  document.getElementById('admin-roster-heading').textContent = teamName + ' — Roster.';
  const wrap = document.getElementById('admin-roster-wrap');
  wrap.classList.remove('admin-roster-wrap--hidden');
  wrap.scrollIntoView({ behavior: 'smooth' });
  loadAdminRoster();
}

async function loadAdminRoster() {
  if (!_rosterTeamId) return;
  const { data } = await db.from('rosters').select('*').eq('team_id', _rosterTeamId).order('player_name', { ascending: true });
  const list = document.getElementById('admin-roster-list');
  if (!data || !data.length) { list.innerHTML = '<p class="admin-state">No players yet — add one above.</p>'; return; }
  list.innerHTML = data.map(p => `
    <div class="admin-post-row">
      <div class="admin-post-info">
        ${p.jersey_number ? `<span class="admin-post-date">#${p.jersey_number}</span>` : ''}
        <span class="admin-post-title-text">${p.player_name}</span>
      </div>
      <div class="admin-row-actions">
        <button type="button" class="admin-delete-btn" onclick="adminDelete('rosters', '${p.id}', loadAdminRoster)">Remove</button>
      </div>
    </div>`).join('');
}

async function submitRosterPlayer() {
  if (!_rosterTeamId) return;
  const name = get('rp-name');
  if (!name) { alert('Player name is required.'); return; }
  const btn = document.getElementById('rp-submit');
  btn.textContent = 'Saving…'; btn.disabled = true;
  const { error } = await db.from('rosters').insert({
    team_id: _rosterTeamId, player_name: name, jersey_number: get('rp-number') || null,
  });
  btn.textContent = 'Add Player →'; btn.disabled = false;
  if (error) { alert('Error: ' + error.message); return; }
  document.getElementById('rp-name').value = '';
  document.getElementById('rp-number').value = '';
  showToast('✓ Player added.');
  loadAdminRoster();
}

/* ── ADMIN: EVENTS ── */
async function submitEvent() {
  const payload = {
    title: get('ev-title'), event_type: get('ev-type'), event_date: get('ev-date'),
    end_date: get('ev-end-date') || null,
    event_time: get('ev-time') || null,
    location: get('ev-location') || null,
    team: get('ev-team') || null, description: quillHTML(quillEvent),
  };
  if (!payload.title || !payload.event_type || !payload.event_date) { alert('Title, Type, and Date are required.'); return; }
  await adminSave('events', 'events', payload, 'ev-submit', 'Add Event →', loadAdminEvents);
}

async function loadAdminEvents() {
  const { data } = await db.from('events').select('*').order('event_date', { ascending: true });
  renderAdminList('admin-events-list', 'events', data,
    e => `<span class="admin-post-date">${e.event_date}</span><span class="admin-post-title-text">${e.title}</span><span class="admin-post-team">${e.event_type}${e.team ? ' · ' + e.team : ''}</span>`,
    'events', loadAdminEvents);
}

/* ── ADMIN: GALLERY ── */
async function submitGalleryItem() {
  const payload = {
    photo_url: get('gl-url'), caption: get('gl-caption') || null,
    team: get('gl-team') || null, event_date: get('gl-date') || null,
  };
  if (!payload.photo_url) { alert('Photo URL is required.'); return; }
  await adminSave('gallery', 'gallery_items', payload, 'gl-submit', 'Add Photo →', loadAdminGallery);
}

async function loadAdminGallery() {
  const { data } = await db.from('gallery_items').select('*').order('created_at', { ascending: false });
  renderAdminList('admin-gallery-list', 'gallery', data,
    g => `<span class="admin-post-date">${g.event_date || '—'}</span><span class="admin-post-title-text">${g.caption || 'No caption'}</span><span class="admin-post-team">${g.team || ''}</span>`,
    'gallery_items', loadAdminGallery);
}

/* ── ADMIN: BOARD MEMBERS ── */
async function submitBoardMember() {
  const payload = {
    role: get('bm-role'), name: get('bm-name'),
    display_order: parseInt(get('bm-order')) || 99,
  };
  if (!payload.role || !payload.name) { alert('Role and Name are required.'); return; }
  await adminSave('board', 'board_members', payload, 'bm-submit', 'Add Member →', loadAdminBoard);
}

async function loadAdminBoard() {
  const { data } = await db.from('board_members').select('*').order('display_order');
  renderAdminList('admin-board-list', 'board', data,
    m => `<span class="admin-post-date">#${m.display_order}</span><span class="admin-post-title-text">${m.name}</span><span class="admin-post-team">${m.role}</span>`,
    'board_members', loadAdminBoard);
}

/* ── ADMIN CORE HELPERS ── */
async function adminSave(section, table, payload, btnId, defaultLabel, reloadFn) {
  const btn       = document.getElementById(btnId);
  const isEditing = _editing.section === section && _editing.id;

  btn.textContent = 'Saving…';
  btn.disabled    = true;

  const { error } = isEditing
    ? await db.from(table).update(payload).eq('id', _editing.id)
    : await db.from(table).insert(payload);

  btn.disabled    = false;

  if (error) { btn.textContent = isEditing ? 'Update →' : defaultLabel; alert('Error: ' + error.message); return; }

  cancelEdit(section);
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

function renderAdminList(containerId, section, data, rowContentFn, table, reloadFn) {
  const list = document.getElementById(containerId);
  if (!data || !data.length) { list.innerHTML = '<p class="admin-state">No entries yet.</p>'; return; }
  data.forEach(item => { _store[item.id] = item; });
  list.innerHTML = data.map(item => `
    <div class="admin-post-row">
      <div class="admin-post-info">${rowContentFn(item)}</div>
      <div class="admin-row-actions">
        <button type="button" class="admin-edit-btn" onclick="startEdit('${section}', '${item.id}')">Edit</button>
        <button type="button" class="admin-delete-btn" onclick="adminDelete('${table}', '${item.id}', ${reloadFn.name})">Delete</button>
      </div>
    </div>`).join('');
}

/* ── ADMIN SETTINGS ── */
async function loadAdminSettings() {
  const { data } = await db.from('registration_status').select('*');
  if (!data) return;
  const anyOpen = data.some(r => r.is_open);
  document.getElementById('reg-master-open').checked = anyOpen;
  ['boys', 'girls'].forEach(p => {
    const row = data.find(r => r.program === p);
    if (!row) return;
    document.getElementById(`reg-${p}-grades`).value   = row.grades       || '';
    document.getElementById(`reg-${p}-date`).value     = row.tryout_date  || '';
    document.getElementById(`reg-${p}-time`).value     = row.tryout_time  || '';
    document.getElementById(`reg-${p}-location`).value = row.location     || '';
    document.getElementById(`reg-${p}-deadline`).value = row.deadline     || '';
    document.getElementById(`reg-${p}-notes`).value    = row.notes        || '';
  });
}

async function saveMasterToggle() {
  const isOpen = document.getElementById('reg-master-open').checked;
  const { error } = await db.from('registration_status').update({ is_open: isOpen }).in('program', ['boys', 'girls']);
  if (error) { alert('Error: ' + error.message); return; }
  applyRegistrationGating(isOpen);
  showToast(isOpen ? '✓ Registration is now open.' : '✓ Registration is now closed.');
}

async function saveRegistrationStatus(program) {
  const p   = program;
  const btn = document.getElementById(`reg-${p}-btn`);
  btn.textContent = 'Saving…'; btn.disabled = true;
  const payload = {
    grades:      get(`reg-${p}-grades`)   || null,
    tryout_date: get(`reg-${p}-date`)     || null,
    tryout_time: get(`reg-${p}-time`)     || null,
    location:    get(`reg-${p}-location`) || null,
    deadline:    get(`reg-${p}-deadline`) || null,
    notes:       get(`reg-${p}-notes`)    || null,
    updated_at:  new Date().toISOString(),
  };
  const { error } = await db.from('registration_status').update(payload).eq('program', p);
  btn.textContent = `Save ${p === 'boys' ? 'Boys' : 'Girls'} Status →`;
  btn.disabled = false;
  if (error) { alert('Error: ' + error.message); return; }
  showToast('✓ Status updated.');
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
  ['cf-name','cf-email','cf-message','cf-topic'].forEach(id => { document.getElementById(id).value = ''; });
}

/* ── UTILS ── */
function formatDate(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}
function formatDateRange(start, end) {
  const s = new Date(start + 'T00:00:00');
  const e = end ? new Date(end + 'T00:00:00') : null;
  if (!e || start === end) return formatDate(start);
  const sameMonth = s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear();
  if (sameMonth) {
    return s.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) + '–' + e.getDate() + ', ' + e.getFullYear();
  }
  return s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' – ' + e.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function get(id) { return (document.getElementById(id).value || '').trim(); }
function set(id, val) { document.getElementById(id).value = val ?? ''; }
function clearFields(textIds, selectIds = []) {
  textIds.forEach(id => { document.getElementById(id).value = ''; });
  selectIds.forEach(id => { document.getElementById(id).value = ''; });
}

/* ── CLOSE MENU ON OUTSIDE CLICK ── */
document.addEventListener('click', e => {
  const nav    = document.getElementById('nav-links');
  const burger = document.getElementById('hamburger');
  if (nav && burger && !nav.contains(e.target) && !burger.contains(e.target)) nav.classList.remove('open');
});

/* ── INIT ── */
initEditors();
loadHomePage();
loadTeams('boys');
