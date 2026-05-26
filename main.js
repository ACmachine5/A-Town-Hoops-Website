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
const _store    = {}; // id → cached row for edit population
const _settings = {   // loaded from supabase settings table
  registrationUrl: 'https://forms.gle/YikHHK5KCYW21Gwn7',
  contactEndpoint: '',
  instagramUrl: '',
  facebookUrl:  '',
  socialEmbed:  '',
};
let _faqData     = [];
let _sponsorData = [];

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
  faq: 'Add Question →',    sponsors: 'Add Sponsor →',
};

/* ── SITE SETTINGS ── */
async function loadSiteSettings() {
  const { data } = await db.from('settings').select('*');
  if (!data) return;
  data.forEach(row => {
    if (row.key === 'registration_url' && row.value) _settings.registrationUrl = row.value;
    if (row.key === 'contact_endpoint') _settings.contactEndpoint = row.value || '';
    if (row.key === 'instagram_url')    _settings.instagramUrl    = row.value || '';
    if (row.key === 'facebook_url')     _settings.facebookUrl     = row.value || '';
    if (row.key === 'social_embed')     _settings.socialEmbed     = row.value || '';
  });
  applyRegistrationUrl(_settings.registrationUrl);
}

function applyRegistrationUrl(url) {
  if (!url) return;
  document.querySelectorAll('.reg-form-link').forEach(a => { a.href = url; });
}

async function saveSettings() {
  const regUrl  = get('st-reg-url');
  const contact = get('st-contact');
  const insta   = get('st-instagram');
  const fb      = get('st-facebook');
  const embed   = (document.getElementById('st-embed').value || '').trim();
  const btn     = document.getElementById('st-save-btn');
  btn.textContent = 'Saving…'; btn.disabled = true;
  const results = await Promise.all([
    db.from('settings').upsert({ key: 'registration_url', value: regUrl || _settings.registrationUrl }, { onConflict: 'key' }),
    db.from('settings').upsert({ key: 'contact_endpoint', value: contact }, { onConflict: 'key' }),
    db.from('settings').upsert({ key: 'instagram_url',    value: insta   }, { onConflict: 'key' }),
    db.from('settings').upsert({ key: 'facebook_url',     value: fb      }, { onConflict: 'key' }),
    db.from('settings').upsert({ key: 'social_embed',     value: embed   }, { onConflict: 'key' }),
  ]);
  btn.textContent = 'Save Settings →'; btn.disabled = false;
  const failed = results.find(r => r.error);
  if (failed) { alert('Error: ' + failed.error.message); return; }
  if (regUrl) { _settings.registrationUrl = regUrl; applyRegistrationUrl(regUrl); }
  _settings.contactEndpoint = contact;
  _settings.instagramUrl    = insta;
  _settings.facebookUrl     = fb;
  _settings.socialEmbed     = embed;
  showToast('✓ Settings saved.');
}

/* ── PAGE NAVIGATION ── */
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));

  const page = document.getElementById('page-' + id);
  if (page) page.classList.add('active');

  const navLink = document.getElementById('nav-' + id);
  if (navLink) navLink.classList.add('active');

  window.scrollTo(0, 0);
  document.getElementById('nav-links').classList.remove('open');

  const resets = {
    home:     () => {
      ['home-announcements','home-events','home-reg-cards','home-faq-list','home-sponsors-grid'].forEach(i => {
        const el = document.getElementById(i); if (el) el.innerHTML = '';
      });
    },
    trophy:   () => { document.getElementById('trophy-list').innerHTML = '<p class="trophy-state">Loading…</p>'; },
    schedule: () => { document.getElementById('schedule-list').innerHTML = '<p class="trophy-state">Loading…</p>'; },
    gallery:  () => { document.getElementById('gallery-feed').innerHTML = ''; },
    about:    () => { document.getElementById('board-grid').innerHTML = '<p class="trophy-state">Loading…</p>'; },
  };
  if (resets[id]) resets[id]();

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
  await Promise.all([loadAnnouncements(), loadUpcomingEvents(), loadRegistrationStatus(), loadFAQs(), loadSponsors()]);
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
  // Deduplicate: one card per program (highest id wins if duplicates exist)
  const seen = new Set();
  const open = data
    .filter(r => r.is_open)
    .sort((a, b) => b.id - a.id)
    .filter(r => seen.has(r.program) ? false : (seen.add(r.program), true))
    .sort((a, b) => a.program.localeCompare(b.program)); // boys before girls
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
          <a href="${_settings.registrationUrl}" target="_blank" rel="noopener" class="reg-program-btn reg-form-link">Register for Tryouts →</a>
        </div>
      </div>`;
  }).join('');
}

/* ── FAQ (public) ── */
async function loadFAQs() {
  const section   = document.getElementById('home-faq-section');
  const container = document.getElementById('home-faq-list');
  const { data }  = await db.from('faqs').select('*').eq('is_published', true).order('display_order', { ascending: true });
  if (!data || !data.length) { section.classList.add('section-hidden'); return; }
  section.classList.remove('section-hidden');
  container.innerHTML = data.map(f => `
    <div class="faq-item" id="faq-item-${f.id}">
      <button type="button" class="faq-question" onclick="toggleFAQ('${f.id}')" aria-expanded="false">
        <span>${f.question}</span>
        <span class="faq-icon">+</span>
      </button>
      <div class="faq-answer-wrap">
        <div class="faq-answer">${f.answer}</div>
      </div>
    </div>`).join('');
}

function toggleFAQ(id) {
  const item = document.getElementById('faq-item-' + id);
  const btn  = item.querySelector('.faq-question');
  const wrap = item.querySelector('.faq-answer-wrap');
  const open = btn.getAttribute('aria-expanded') === 'true';
  btn.setAttribute('aria-expanded', open ? 'false' : 'true');
  item.classList.toggle('faq-open', !open);
  wrap.style.maxHeight = open ? '0' : wrap.scrollHeight + 'px';
  btn.querySelector('.faq-icon').textContent = open ? '+' : '×';
}

/* ── SPONSORS (public) ── */
async function loadSponsors() {
  const section   = document.getElementById('home-sponsors-section');
  const container = document.getElementById('home-sponsors-grid');
  const { data }  = await db.from('sponsors').select('*').order('tier').order('display_order', { ascending: true });
  if (!data || !data.length) { section.classList.add('section-hidden'); return; }
  section.classList.remove('section-hidden');
  const premier   = data.filter(s => s.tier === 'premier');
  const supporter = data.filter(s => s.tier === 'supporter');
  let html = '';
  if (premier.length) {
    html += `<div class="sponsor-tier-label">Premier Sponsors</div>
             <div class="sponsor-tier-grid sponsor-tier-grid--premier">${premier.map(renderSponsorCard).join('')}</div>`;
  }
  if (supporter.length) {
    html += `<div class="sponsor-tier-label sponsor-tier-label--supporter">Community Supporters</div>
             <div class="sponsor-tier-grid sponsor-tier-grid--supporter">${supporter.map(renderSponsorCard).join('')}</div>`;
  }
  container.innerHTML = html;
}

function renderSponsorCard(s) {
  const inner = s.logo_url
    ? `<img src="${s.logo_url}" alt="${s.name}" class="sponsor-logo" loading="lazy" />`
    : `<div class="sponsor-name-text">${s.name}</div>`;
  return s.website_url
    ? `<a href="${s.website_url}" target="_blank" rel="noopener" class="sponsor-card">${inner}</a>`
    : `<div class="sponsor-card">${inner}</div>`;
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
  const feed      = document.getElementById('gallery-feed');
  const emptyNote = document.getElementById('gallery-empty-note');

  const { data, error } = await db.from('gallery_items').select('*')
    .eq('is_approved', true).order('created_at', { ascending: false });

  if (error || !data || !data.length) {
    feed.innerHTML = '';
    emptyNote.style.display = 'block';
  } else {
    emptyNote.style.display = 'none';
    feed.innerHTML = data.map(item => `
      <div class="gallery-feed-card">
        <div class="gallery-feed-img-wrap">
          <img src="${item.photo_url}" alt="${item.caption || 'A-Town Hoops'}" loading="lazy" class="gallery-feed-img" />
        </div>
        ${item.caption || item.submitted_by ? `
        <div class="gallery-feed-body">
          ${item.caption ? `<div class="gallery-feed-caption">${item.caption}</div>` : ''}
          ${item.submitted_by ? `<div class="gallery-feed-meta">📸 ${item.submitted_by}</div>` : ''}
        </div>` : ''}
      </div>`).join('');
  }
  renderGallerySocial();
}

/* Parent upload form */
function previewUpload(input) {
  const file        = input.files[0];
  const area        = document.getElementById('gu-file-area');
  const preview     = document.getElementById('gu-preview');
  const placeholder = document.getElementById('gu-placeholder');
  if (file) {
    const reader = new FileReader();
    reader.onload = e => {
      preview.src = e.target.result;
      preview.style.display = 'block';
      placeholder.style.display = 'none';
      area.classList.add('has-file');
    };
    reader.readAsDataURL(file);
  } else {
    preview.style.display = 'none';
    placeholder.style.display = 'block';
    area.classList.remove('has-file');
  }
}

async function submitGalleryUpload() {
  const fileInput = document.getElementById('gu-file');
  const file      = fileInput.files[0];
  const name      = get('gu-name');
  const caption   = get('gu-caption');

  if (!file)  { alert('Please select a photo first.'); return; }
  if (!name)  { alert('Please enter your name.'); return; }
  if (!file.type.startsWith('image/')) { alert('Please select an image file (JPG, PNG, etc.).'); return; }
  if (file.size > 15 * 1024 * 1024)   { alert('Photo must be under 15 MB.'); return; }

  const btn = document.getElementById('gu-submit');
  btn.textContent = 'Uploading…'; btn.disabled = true;

  const ext      = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const filename = `${Date.now()}-${Math.random().toString(36).substr(2, 8)}.${ext}`;

  const { error: uploadError } = await db.storage.from('gallery').upload(filename, file, {
    cacheControl: '3600', contentType: file.type,
  });

  if (uploadError) {
    btn.textContent = 'Share Photo →'; btn.disabled = false;
    alert('Upload failed: ' + uploadError.message);
    return;
  }

  const { data: { publicUrl } } = db.storage.from('gallery').getPublicUrl(filename);

  const { error: insertError } = await db.from('gallery_items').insert({
    photo_url: publicUrl, caption: caption || null,
    submitted_by: name, is_approved: false, is_admin_upload: false,
  });

  btn.textContent = 'Share Photo →'; btn.disabled = false;

  if (insertError) {
    await db.storage.from('gallery').remove([filename]);
    alert('Error saving photo: ' + insertError.message); return;
  }

  fileInput.value = '';
  document.getElementById('gu-name').value    = '';
  document.getElementById('gu-caption').value = '';
  document.getElementById('gu-preview').style.display     = 'none';
  document.getElementById('gu-placeholder').style.display = 'block';
  document.getElementById('gu-file-area').classList.remove('has-file');

  showToast('✓ Photo submitted! It will appear after review — thank you!');
}

function renderGallerySocial() {
  const section  = document.getElementById('gallery-social-section');
  const embedEl  = document.getElementById('gallery-social-embed');
  const linksEl  = document.getElementById('gallery-social-links');
  const hasEmbed = !!_settings.socialEmbed;
  const hasLinks = _settings.instagramUrl || _settings.facebookUrl;
  if (!hasEmbed && !hasLinks) { section.classList.add('section-hidden'); return; }
  section.classList.remove('section-hidden');
  embedEl.innerHTML = _settings.socialEmbed || '';
  linksEl.innerHTML = [
    _settings.instagramUrl ? `<a href="${_settings.instagramUrl}" target="_blank" rel="noopener" class="social-follow-btn social-follow-btn--instagram">📸 Follow on Instagram</a>` : '',
    _settings.facebookUrl  ? `<a href="${_settings.facebookUrl}"  target="_blank" rel="noopener" class="social-follow-btn social-follow-btn--facebook">👍 Follow on Facebook</a>`  : '',
  ].join('');
}

/* ── BOARD MEMBERS (public) ── */
async function loadBoardMembers() {
  const container = document.getElementById('board-grid');
  container.innerHTML = '<p class="trophy-state">Loading…</p>';
  const { data, error } = await db.from('board_members').select('*').order('display_order', { ascending: true });
  if (error || !data.length) { container.innerHTML = '<p class="trophy-state">Could not load board.</p>'; return; }
  container.innerHTML = data.map(m => `
    <div class="board-cell">
      ${m.photo_url ? `<img src="${m.photo_url}" alt="${m.name}" class="board-photo" loading="lazy" />` : ''}
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
    faq: loadAdminFAQs, sponsors: loadAdminSponsors, settings: loadAdminSettings,
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
      set('tm-league', item.league || ''); set('tm-season', item.season || '');
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
      set('bm-role', item.role); set('bm-name', item.name); set('bm-photo', item.photo_url || '');
    },
    faq: () => {
      set('fq-question', item.question);
      document.getElementById('fq-answer').value = item.answer || '';
    },
    sponsors: () => {
      set('sp-name', item.name); set('sp-tier', item.tier || 'supporter');
      set('sp-logo', item.logo_url || ''); set('sp-url', item.website_url || '');
    },
  };

  if (populators[section]) populators[section]();

  const prefix = { trophy: 'ap', announcements: 'an', teams: 'tm', events: 'ev', gallery: 'gl', board: 'bm', faq: 'fq', sponsors: 'sp' };
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
    teams:         () => clearFields(['tm-coach','tm-league','tm-season'], ['tm-grade','tm-gender']),
    events:        () => { clearFields(['ev-title','ev-date','ev-end-date','ev-time','ev-location','ev-team'], ['ev-type']); quillEvent.setText(''); },
    gallery:       () => clearFields(['gl-url','gl-caption','gl-team','gl-date']),
    board:         () => clearFields(['bm-role','bm-name','bm-photo']),
    faq:           () => { clearFields(['fq-question']); document.getElementById('fq-answer').value = ''; },
    sponsors:      () => clearFields(['sp-name','sp-logo','sp-url'], ['sp-tier']),
  };
  if (clearers[section]) clearers[section]();

  const prefix = { trophy: 'ap', announcements: 'an', teams: 'tm', events: 'ev', gallery: 'gl', board: 'bm', faq: 'fq', sponsors: 'sp' };
  const p = prefix[section];
  document.getElementById(p + '-submit').textContent = SUBMIT_LABELS[section];
  document.getElementById(p + '-cancel').classList.add('admin-cancel--hidden');
}

/* ── ADMIN: TROPHY CASE ── */
async function submitTrophyPost() {
  const payload = {
    date: get('ap-date'), title: get('ap-title'), team: get('ap-team'),
    achievement_type: get('ap-type'), description: quillHTML(quillTrophy), photo_url: convertDriveUrl(get('ap-photo')) || null,
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
    league: get('tm-league') || 'AAU · Wesco', season: get('tm-season') || '25–26',
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
let _boardData    = [];

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
    photo_url: convertDriveUrl(get('gl-url')), caption: get('gl-caption') || null,
    team: get('gl-team') || null, event_date: get('gl-date') || null,
    is_approved: true, is_admin_upload: true,
  };
  if (!payload.photo_url) { alert('Photo URL is required.'); return; }
  await adminSave('gallery', 'gallery_items', payload, 'gl-submit', 'Add Photo →', loadAdminGallery);
}

async function loadAdminGallery() {
  const { data } = await db.from('gallery_items').select('*').order('created_at', { ascending: false });
  const all      = data || [];
  const pending  = all.filter(g => !g.is_approved);
  const approved = all.filter(g =>  g.is_approved);

  const pendingWrap  = document.getElementById('admin-gallery-pending-wrap');
  const pendingList  = document.getElementById('admin-gallery-pending-list');
  const pendingCount = document.getElementById('admin-pending-count');

  if (pending.length) {
    pendingWrap.style.display = 'block';
    pendingCount.textContent  = pending.length;
    pending.forEach(item => { _store[item.id] = item; });
    pendingList.innerHTML = pending.map(g => `
      <div class="admin-post-row">
        <div class="admin-post-info">
          <span class="admin-post-title-text">${g.caption || 'No caption'}</span>
          <span class="admin-pending-submitter">Submitted by ${g.submitted_by || 'Unknown'}</span>
        </div>
        <div class="admin-row-actions">
          <a href="${g.photo_url}" target="_blank" rel="noopener" class="admin-edit-btn">View</a>
          <button type="button" class="admin-approve-btn" onclick="approveGalleryItem('${g.id}')">✓ Approve</button>
          <button type="button" class="admin-delete-btn" onclick="deleteGalleryItem('${g.id}')">Delete</button>
        </div>
      </div>`).join('');
  } else {
    pendingWrap.style.display = 'none';
  }

  const list = document.getElementById('admin-gallery-list');
  if (!approved.length) { list.innerHTML = '<p class="admin-state">No photos yet.</p>'; return; }
  approved.forEach(item => { _store[item.id] = item; });
  list.innerHTML = approved.map(g => `
    <div class="admin-post-row">
      <div class="admin-post-info">
        <span class="admin-post-date">${g.event_date || '—'}</span>
        <span class="admin-post-title-text">${g.caption || 'No caption'}</span>
        <span class="admin-post-team">${g.submitted_by ? '👤 ' + g.submitted_by : (g.team || '')}</span>
      </div>
      <div class="admin-row-actions">
        <a href="${g.photo_url}" target="_blank" rel="noopener" class="admin-edit-btn">View</a>
        <button type="button" class="admin-edit-btn" onclick="startEdit('gallery', '${g.id}')">Edit</button>
        <button type="button" class="admin-delete-btn" onclick="deleteGalleryItem('${g.id}')">Delete</button>
      </div>
    </div>`).join('');
}

async function approveGalleryItem(id) {
  const { error } = await db.from('gallery_items').update({ is_approved: true }).eq('id', id);
  if (error) { alert('Error: ' + error.message); return; }
  showToast('✓ Photo approved and published.');
  loadAdminGallery();
}

async function deleteGalleryItem(id) {
  if (!confirm('Delete this photo? This cannot be undone.')) return;
  const item = _store[id];
  if (item && !item.is_admin_upload && item.photo_url) {
    const parts = item.photo_url.split('/gallery/');
    if (parts.length > 1) await db.storage.from('gallery').remove([parts[1]]);
  }
  const { error } = await db.from('gallery_items').delete().eq('id', id);
  if (error) { alert('Error: ' + error.message); return; }
  showToast('Deleted.');
  loadAdminGallery();
}

/* ── ADMIN: BOARD MEMBERS ── */
async function submitBoardMember() {
  const isEditing = _editing.section === 'board' && _editing.id;
  const payload = {
    role: get('bm-role'), name: get('bm-name'),
    photo_url: convertDriveUrl(get('bm-photo')) || null,
    display_order: isEditing
      ? (_store[_editing.id]?.display_order ?? 99)
      : (_boardData.length + 1),
  };
  if (!payload.role || !payload.name) { alert('Role and Name are required.'); return; }
  await adminSave('board', 'board_members', payload, 'bm-submit', 'Add Member →', loadAdminBoard);
}

async function loadAdminBoard() {
  const { data } = await db.from('board_members').select('*').order('display_order');
  _boardData = data || [];
  renderBoardAdminList();
}

function renderBoardAdminList() {
  const list = document.getElementById('admin-board-list');
  if (!_boardData.length) { list.innerHTML = '<p class="admin-state">No entries yet.</p>'; return; }
  _boardData.forEach(item => { _store[item.id] = item; });
  const last = _boardData.length - 1;
  list.innerHTML = _boardData.map((m, i) => `
    <div class="admin-post-row">
      <div class="admin-post-info">
        <span class="admin-post-title-text">${m.name}</span>
        <span class="admin-post-team">${m.role}</span>
      </div>
      <div class="admin-row-actions">
        <button type="button" class="admin-order-btn" onclick="moveBoardMember(${i}, -1)" ${i === 0 ? 'disabled' : ''} title="Move up">▲</button>
        <button type="button" class="admin-order-btn" onclick="moveBoardMember(${i},  1)" ${i === last ? 'disabled' : ''} title="Move down">▼</button>
        <button type="button" class="admin-edit-btn" onclick="startEdit('board', '${m.id}')">Edit</button>
        <button type="button" class="admin-delete-btn" onclick="adminDelete('board_members', '${m.id}', loadAdminBoard)">Delete</button>
      </div>
    </div>`).join('');
}

async function moveBoardMember(index, direction) {
  const newIndex = index + direction;
  if (newIndex < 0 || newIndex >= _boardData.length) return;
  [_boardData[index], _boardData[newIndex]] = [_boardData[newIndex], _boardData[index]];
  const results = await Promise.all(
    _boardData.map((m, i) => db.from('board_members').update({ display_order: i + 1 }).eq('id', m.id))
  );
  const failed = results.find(r => r.error);
  if (failed) { alert('Error saving order: ' + failed.error.message); return; }
  _boardData.forEach((m, i) => { m.display_order = i + 1; _store[m.id] = m; });
  renderBoardAdminList();
  showToast('✓ Order saved.');
}

/* ── ADMIN: FAQ ── */
async function submitFAQ() {
  const isEditing = _editing.section === 'faq' && _editing.id;
  const payload = {
    question:      get('fq-question'),
    answer:        (document.getElementById('fq-answer').value || '').trim(),
    is_published:  true,
    display_order: isEditing ? (_store[_editing.id]?.display_order ?? 99) : (_faqData.length + 1),
  };
  if (!payload.question || !payload.answer) { alert('Question and Answer are required.'); return; }
  await adminSave('faq', 'faqs', payload, 'fq-submit', 'Add Question →', loadAdminFAQs);
}

async function loadAdminFAQs() {
  const { data } = await db.from('faqs').select('*').order('display_order');
  _faqData = data || [];
  renderFAQAdminList();
}

function renderFAQAdminList() {
  const list = document.getElementById('admin-faq-list');
  if (!_faqData.length) { list.innerHTML = '<p class="admin-state">No questions yet.</p>'; return; }
  _faqData.forEach(item => { _store[item.id] = item; });
  const last = _faqData.length - 1;
  list.innerHTML = _faqData.map((f, i) => `
    <div class="admin-post-row">
      <div class="admin-post-info">
        <span class="admin-post-title-text">${f.question}</span>
      </div>
      <div class="admin-row-actions">
        <button type="button" class="admin-order-btn" onclick="moveFAQItem(${i}, -1)" ${i === 0 ? 'disabled' : ''} title="Move up">▲</button>
        <button type="button" class="admin-order-btn" onclick="moveFAQItem(${i},  1)" ${i === last ? 'disabled' : ''} title="Move down">▼</button>
        <button type="button" class="admin-edit-btn" onclick="startEdit('faq', '${f.id}')">Edit</button>
        <button type="button" class="admin-delete-btn" onclick="adminDelete('faqs', '${f.id}', loadAdminFAQs)">Delete</button>
      </div>
    </div>`).join('');
}

async function moveFAQItem(index, direction) {
  const newIndex = index + direction;
  if (newIndex < 0 || newIndex >= _faqData.length) return;
  [_faqData[index], _faqData[newIndex]] = [_faqData[newIndex], _faqData[index]];
  const results = await Promise.all(
    _faqData.map((f, i) => db.from('faqs').update({ display_order: i + 1 }).eq('id', f.id))
  );
  const failed = results.find(r => r.error);
  if (failed) { alert('Error saving order: ' + failed.error.message); return; }
  _faqData.forEach((f, i) => { f.display_order = i + 1; _store[f.id] = f; });
  renderFAQAdminList();
  showToast('✓ Order saved.');
}

/* ── ADMIN: SPONSORS ── */
async function submitSponsor() {
  const isEditing = _editing.section === 'sponsors' && _editing.id;
  const payload = {
    name:          get('sp-name'),
    tier:          get('sp-tier') || 'supporter',
    logo_url:      convertDriveUrl(get('sp-logo')) || null,
    website_url:   get('sp-url')  || null,
    display_order: isEditing ? (_store[_editing.id]?.display_order ?? 99) : (_sponsorData.length + 1),
  };
  if (!payload.name) { alert('Business name is required.'); return; }
  await adminSave('sponsors', 'sponsors', payload, 'sp-submit', 'Add Sponsor →', loadAdminSponsors);
}

async function loadAdminSponsors() {
  const { data } = await db.from('sponsors').select('*').order('tier').order('display_order');
  _sponsorData = data || [];
  renderSponsorAdminList();
}

function renderSponsorAdminList() {
  const list = document.getElementById('admin-sponsors-list');
  if (!_sponsorData.length) { list.innerHTML = '<p class="admin-state">No sponsors yet.</p>'; return; }
  _sponsorData.forEach(item => { _store[item.id] = item; });
  const last = _sponsorData.length - 1;
  list.innerHTML = _sponsorData.map((s, i) => `
    <div class="admin-post-row">
      <div class="admin-post-info">
        <span class="admin-post-date">${s.tier}</span>
        <span class="admin-post-title-text">${s.name}</span>
      </div>
      <div class="admin-row-actions">
        <button type="button" class="admin-order-btn" onclick="moveSponsorItem(${i}, -1)" ${i === 0 ? 'disabled' : ''} title="Move up">▲</button>
        <button type="button" class="admin-order-btn" onclick="moveSponsorItem(${i},  1)" ${i === last ? 'disabled' : ''} title="Move down">▼</button>
        <button type="button" class="admin-edit-btn" onclick="startEdit('sponsors', '${s.id}')">Edit</button>
        <button type="button" class="admin-delete-btn" onclick="adminDelete('sponsors', '${s.id}', loadAdminSponsors)">Delete</button>
      </div>
    </div>`).join('');
}

async function moveSponsorItem(index, direction) {
  const newIndex = index + direction;
  if (newIndex < 0 || newIndex >= _sponsorData.length) return;
  [_sponsorData[index], _sponsorData[newIndex]] = [_sponsorData[newIndex], _sponsorData[index]];
  const results = await Promise.all(
    _sponsorData.map((s, i) => db.from('sponsors').update({ display_order: i + 1 }).eq('id', s.id))
  );
  const failed = results.find(r => r.error);
  if (failed) { alert('Error saving order: ' + failed.error.message); return; }
  _sponsorData.forEach((s, i) => { s.display_order = i + 1; _store[s.id] = s; });
  renderSponsorAdminList();
  showToast('✓ Order saved.');
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
  const [{ data: regData }, { data: siteData }] = await Promise.all([
    db.from('registration_status').select('*'),
    db.from('settings').select('*'),
  ]);
  if (regData) {
    const anyOpen = regData.some(r => r.is_open);
    document.getElementById('reg-master-open').checked = anyOpen;
    ['boys', 'girls'].forEach(p => {
      const row = regData.find(r => r.program === p);
      if (!row) return;
      document.getElementById(`reg-${p}-grades`).value   = row.grades       || '';
      document.getElementById(`reg-${p}-date`).value     = row.tryout_date  || '';
      document.getElementById(`reg-${p}-time`).value     = row.tryout_time  || '';
      document.getElementById(`reg-${p}-location`).value = row.location     || '';
      document.getElementById(`reg-${p}-deadline`).value = row.deadline     || '';
      document.getElementById(`reg-${p}-notes`).value    = row.notes        || '';
    });
  }
  if (siteData) {
    siteData.forEach(row => {
      if (row.key === 'registration_url') document.getElementById('st-reg-url').value   = row.value || '';
      if (row.key === 'contact_endpoint') document.getElementById('st-contact').value   = row.value || '';
      if (row.key === 'instagram_url')    document.getElementById('st-instagram').value = row.value || '';
      if (row.key === 'facebook_url')     document.getElementById('st-facebook').value  = row.value || '';
      if (row.key === 'social_embed')     document.getElementById('st-embed').value     = row.value || '';
    });
  }
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
async function submitForm() {
  const name  = document.getElementById('cf-name').value.trim();
  const email = document.getElementById('cf-email').value.trim();
  const topic = document.getElementById('cf-topic').value;
  const msg   = document.getElementById('cf-message').value.trim();
  if (!name || !email || !msg) { alert('Please fill in your name, email, and message.'); return; }

  const ep  = _settings.contactEndpoint;
  const btn = document.querySelector('#page-contact .f-submit');
  const clearForm = () => ['cf-name','cf-email','cf-message','cf-topic'].forEach(id => { document.getElementById(id).value = ''; });

  if (ep && ep.startsWith('http')) {
    btn.textContent = 'Sending…'; btn.disabled = true;
    try {
      const res = await fetch(ep, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ name, email, topic, message: msg }),
      });
      btn.textContent = 'Send Message →'; btn.disabled = false;
      if (res.ok) { showToast('✓ Message sent — we\'ll be in touch soon.'); clearForm(); }
      else { alert('Your message could not be sent. Please try again or reach out directly.'); }
    } catch {
      btn.textContent = 'Send Message →'; btn.disabled = false;
      alert('Could not connect. Please check your internet and try again.');
    }
  } else if (ep && ep.includes('@')) {
    const sub  = encodeURIComponent(`[A-Town Hoops] ${topic || 'Website Inquiry'} — ${name}`);
    const body = encodeURIComponent(`Name: ${name}\nEmail: ${email}\nTopic: ${topic}\n\nMessage:\n${msg}`);
    window.open(`mailto:${ep}?subject=${sub}&body=${body}`);
    showToast('Opening your email client…');
  } else {
    showToast('✓ Message received — we\'ll be in touch soon.');
    clearForm();
  }
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

function convertDriveUrl(url) {
  if (!url || !url.includes('drive.google.com')) return url;
  const m = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  return m ? `https://lh3.googleusercontent.com/d/${m[1]}` : url;
}

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
loadSiteSettings();
loadHomePage();
loadTeams('boys');
