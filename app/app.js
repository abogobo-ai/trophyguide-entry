// Leonida Platinum Atlas — offline trophy tracker for GTA VI on PlayStation 5.
// Plain ES module, no libraries, no network at run time: it fetches only data/trophies.json.
const STORE_KEY = 'leonida-platinum-atlas-v1';
const TOTAL_HOURS = 200;

const STAGES = [
  { n: 1, title: 'Welcome to Leonida', sub: 'Chapter 1 — learn the map, meet Lucia and Jason, and start the one missable trophy on day one.' },
  { n: 2, title: 'Vice City Rising', sub: 'Chapter 2 — heists, contacts and the first stranger strands. Bank the early activity trophies.' },
  { n: 3, title: 'Heat & Hustle', sub: 'Chapter 3 — partner robberies, races and the loudest missions. Keep your wanted level warm.' },
  { n: 4, title: 'The Long Game', sub: 'Chapter 4 — stranger finals, hunting, bowling and the activities that unlock late.' },
  { n: 5, title: 'Endgame', sub: 'The final mission, the road to 100% completion, and the last big-ticket activities.' },
  { n: 6, title: 'Cleanup', sub: 'Post-story mop-up: stunts, shooting ranges, collectibles and the platinum itself.' },
];

const SAVE_SLOTS = [
  'Chapter 1 — fresh start',
  'Chapter 2 — first morning in Vice City',
  'Chapter 3 — after the chapter opens',
  'Chapter 4 — before the long game',
  'Before the final mission — CLEAN SAVE',
  'Post-story — cleanup save',
];

const SOURCES = [
  { name: 'PowerPyx', blurb: 'Full trophy guides and roadmaps; the reference most of our step-by-step facts are checked against.' },
  { name: 'GTABase', blurb: 'Mission and activity database; used to place each trophy in its chapter and strand.' },
  { name: 'Exophase', blurb: 'The official trophy list and earn rates; the source of every name, description and grade here.' },
  { name: 'EGamers.io', blurb: 'Early community guides for activities, races and side content.' },
  { name: 'TechWiser', blurb: 'Mechanics explainers — Combat Focus, wanted levels and the shooting range.' },
  { name: 'KeenGamer', blurb: 'Collectible and exploration guides; stunt spots, areas and hidden encounters.' },
];

const params = new URLSearchParams(location.search);
const demoMode = params.get('demo') === 'tracker';

let doc = null;
let state = loadState();
let selectedId = null;

if (demoMode) {
  // Screenshot mode only: seed a half-finished tracker in memory, never persisted.
  state = {
    earned: ['Just Like Paradise', 'Paradise Lost', 'Trust', 'Break the Bank', 'Family Matters', 'Master of None', 'Stick Fiddler', 'Hot Together', 'In The Beginning…', 'Let’s Go Bowling', 'Bad Luck, I Guess', 'Ten Pin'],
    counters: { 15: 87, 28: 7, 35: 41 },
    saves: ['Chapter 1 — fresh start', 'Chapter 2 — first morning in Vice City'],
    spoiler: true,
  };
}

function loadState() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null');
    if (raw && Array.isArray(raw.earned)) {
      return { earned: raw.earned, counters: raw.counters ?? {}, saves: raw.saves ?? [], spoiler: !!raw.spoiler };
    }
  } catch { /* corrupted save: start fresh */ }
  return { earned: [], counters: {}, saves: [], spoiler: false };
}

function saveState() {
  if (demoMode) return; // demo state must never overwrite a real save
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}

function trophyById(id) { return doc.trophies.find((t) => t.id === id); }
function isEarned(t) { return state.earned.includes(t.name); }
function earnedCount() { return doc.trophies.filter(isEarned).length; }
function hoursLeft() {
  return doc.trophies.filter((t) => t.id !== 1 && !isEarned(t)).reduce((s, t) => s + (t.hours || 0), 0);
}
function nextUp() {
  const open = doc.trophies.filter((t) => t.id !== 1 && !isEarned(t)).sort((a, b) => a.stage - b.stage || a.id - b.id);
  return open[0] ?? trophyById(1);
}
function masked(t) { return state.spoiler && t.hidden && !isEarned(t); }

function renderProgress() {
  const n = earnedCount();
  document.getElementById('earnedCount').textContent = n;
  document.getElementById('progressFill').style.width = `${(n / 55) * 100}%`;
  document.getElementById('progressPct').textContent = `${Math.round((n / 55) * 100)}% to platinum`;
  const byGrade = (g) => doc.trophies.filter((t) => t.grade === g && isEarned(t)).length;
  document.getElementById('countPlatinum').textContent = `${byGrade('platinum')} / 1`;
  document.getElementById('countGold').textContent = `${byGrade('gold')} / 2`;
  document.getElementById('countSilver').textContent = `${byGrade('silver')} / 6`;
  document.getElementById('countBronze').textContent = `${byGrade('bronze')} / 46`;
  document.getElementById('hoursLeft').textContent = n >= 55 ? 'Platinum earned — Leonida Legend.' : `≈ ${Math.round(hoursLeft())} h left to platinum`;
  const nu = nextUp();
  document.getElementById('nextUp').textContent = n >= 55
    ? 'Next up: enjoy Leonida.'
    : `Next up: ${nu.name} — Stage ${nu.stage} · ${nu.hours ? `≈${nu.hours} h` : 'passive'}`;
}

function kindLabel(t) {
  return t.missable ? 'missable' : t.kind;
}

function renderChecklist() {
  const q = (document.getElementById('search').value || '').toLowerCase();
  const kind = document.getElementById('kindFilter').value;
  const grade = document.getElementById('gradeFilter').value;
  const earnedOnly = document.getElementById('earnedOnly').checked;
  const unearnedOnly = document.getElementById('unearnedOnly').checked;
  const list = document.getElementById('trophyList');
  list.replaceChildren();
  let shown = 0;
  for (const t of doc.trophies) {
    const hide = masked(t);
    const name = hide ? 'Hidden Trophy' : t.name;
    const desc = hide ? 'Hidden on PSN — earn it to reveal its name and description.' : t.description;
    if (q && !(name.toLowerCase().includes(q) || desc.toLowerCase().includes(q))) continue;
    if (kind !== 'all' && kindLabel(t) !== kind && !(kind === 'story' && t.kind === 'story')) continue;
    if (kind === 'missable' && !t.missable) continue;
    if (grade !== 'all' && t.grade !== grade) continue;
    if (earnedOnly && !isEarned(t)) continue;
    if (unearnedOnly && isEarned(t)) continue;
    shown++;
    const li = document.createElement('li');
    li.className = `trophy-row${isEarned(t) ? ' earned' : ''}${selectedId === t.id ? ' selected' : ''}`;
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = isEarned(t);
    box.setAttribute('aria-label', `Mark ${name} earned`);
    box.addEventListener('change', () => { toggleEarned(t); });
    box.addEventListener('click', (e) => e.stopPropagation());
    const main = document.createElement('div');
    main.className = 'trophy-main';
    const nm = document.createElement('div');
    nm.className = 'trophy-name';
    nm.textContent = name;
    if (t.hidden && !hide) {
      const tag = document.createElement('span');
      tag.className = 'hidden-tag';
      tag.textContent = ' · Hidden on PSN';
      nm.append(tag);
    }
    const ds = document.createElement('div');
    ds.className = 'trophy-desc';
    ds.textContent = desc;
    const meta = document.createElement('div');
    meta.className = 'trophy-meta';
    meta.textContent = `${t.kind} · Stage ${t.stage} · ${t.hours ? `≈${t.hours} h` : 'passive'}${t.countTarget ? ` · ${state.counters[t.id] ?? 0} / ${t.countTarget} ${t.countUnit}` : ''}`;
    if (t.missable) {
      const flag = document.createElement('span');
      flag.className = 'missable-flag';
      flag.textContent = ' · ★ MISSABLE';
      meta.append(flag);
    }
    main.append(nm, ds, meta);
    const badge = document.createElement('span');
    badge.className = `grade-badge grade-${t.grade}`;
    badge.textContent = t.grade;
    li.append(box, main, badge);
    li.addEventListener('click', () => openDetail(t.id));
    list.append(li);
  }
  document.getElementById('showing').textContent = `Showing ${shown} of 55`;
}

function toggleEarned(t) {
  if (isEarned(t)) state.earned = state.earned.filter((n) => n !== t.name);
  else state.earned.push(t.name);
  saveState();
  renderAll();
}

function openDetail(id) {
  selectedId = id;
  const t = trophyById(id);
  const panel = document.getElementById('detailPanel');
  panel.replaceChildren();
  const h = document.createElement('h3');
  h.textContent = masked(t) ? 'Hidden Trophy' : t.name;
  const d = document.createElement('p');
  d.className = 'desc';
  d.textContent = masked(t) ? 'Hidden on PSN — earn it to reveal its name and description.' : t.description;
  const badges = document.createElement('div');
  badges.className = 'badges';
  for (const [label, cls] of [[t.grade, ''], [t.hidden ? 'Hidden on PSN' : '', ''], [t.missable ? '★ Time-limited — start early' : '', 'danger'], [`Roadmap Stage ${t.stage}`, '']]) {
    if (!label) continue;
    const b = document.createElement('span');
    b.className = `badge ${cls}`;
    b.textContent = label;
    badges.append(b);
  }
  panel.append(h, d, badges);
  if (masked(t)) {
    const p = document.createElement('p');
    p.className = 'guide';
    p.textContent = 'Guide hidden until earned — turn the spoiler setting off to read it anyway.';
    panel.append(p);
  } else {
    const sh = document.createElement('h4');
    sh.textContent = 'Sources';
    const sl = document.createElement('ul');
    sl.className = 'sources';
    for (const s of t.sources) {
      const li = document.createElement('li');
      li.textContent = s;
      sl.append(li);
    }
    const gh = document.createElement('h4');
    gh.textContent = 'How to get it';
    const g = document.createElement('p');
    g.className = 'guide';
    g.textContent = t.guide;
    const hh = document.createElement('p');
    hh.className = 'hours';
    hh.textContent = `Estimated time: ${t.hours ? `≈${t.hours} h` : 'passive — accumulates as you play'} · ${t.kind} · Stage ${t.stage}`;
    panel.append(sh, sl, gh, g, hh);
  }
  if (t.countTarget) renderCounter(panel, t);
  const line = document.createElement('label');
  line.className = 'earned-line';
  const box = document.createElement('input');
  box.type = 'checkbox';
  box.checked = isEarned(t);
  box.addEventListener('change', () => toggleEarned(t));
  line.append(box, document.createTextNode(isEarned(t) ? 'Earned ✓' : 'Mark as earned'));
  panel.append(line);
  renderChecklist();
}

function renderCounter(panel, t) {
  const box = document.createElement('div');
  box.className = 'counter-box';
  const val = document.createElement('div');
  val.className = 'counter-value';
  const cur = state.counters[t.id] ?? 0;
  val.textContent = `${cur} / ${t.countTarget} ${t.countUnit}`;
  const controls = document.createElement('div');
  controls.className = 'counter-controls';
  const minus = document.createElement('button');
  minus.type = 'button';
  minus.textContent = '−';
  minus.setAttribute('aria-label', 'Decrease count');
  const input = document.createElement('input');
  input.type = 'number';
  input.min = '0';
  input.max = String(t.countTarget);
  input.value = String(cur);
  input.setAttribute('aria-label', `Progress toward ${t.countTarget} ${t.countUnit}`);
  const plus = document.createElement('button');
  plus.type = 'button';
  plus.textContent = '+';
  plus.setAttribute('aria-label', 'Increase count');
  const set = (v) => {
    const n = Math.max(0, Math.min(t.countTarget, Math.round(v) || 0));
    state.counters[t.id] = n;
    if (n >= t.countTarget && !isEarned(t)) state.earned.push(t.name);
    saveState();
    renderAll();
    openDetail(t.id);
  };
  minus.addEventListener('click', () => set(cur - 1));
  plus.addEventListener('click', () => set(cur + 1));
  input.addEventListener('change', () => set(Number(input.value)));
  controls.append(minus, input, plus);
  const note = document.createElement('p');
  note.style.cssText = 'margin:6px 0 0;font-size:13px;color:#6b6350';
  note.textContent = cur >= t.countTarget ? 'Target reached — trophy marked earned.' : 'Reaching the target marks the trophy earned.';
  box.append(val, controls, note);
  panel.append(box);
}

function renderRoadmap() {
  const ol = document.getElementById('stages');
  ol.replaceChildren();
  for (const s of STAGES) {
    const li = document.createElement('li');
    li.className = 'stage';
    const h = document.createElement('h3');
    h.textContent = `Stage ${s.n} — ${s.title}`;
    const sub = document.createElement('p');
    sub.className = 'stage-sub';
    sub.textContent = s.sub;
    const ul = document.createElement('ul');
    ul.className = 'stage-trophies';
    for (const t of doc.trophies.filter((x) => x.stage === s.n)) {
      const item = document.createElement('li');
      if (isEarned(t)) item.className = 'done';
      item.textContent = `${t.name} — ${t.grade} · ≈${t.hours} h${t.missable ? ' · ★ MISSABLE' : ''}`;
      ul.append(item);
    }
    li.append(h, sub, ul);
    ol.append(li);
  }
  const slots = document.getElementById('saveSlots');
  slots.replaceChildren();
  for (const label of SAVE_SLOTS) {
    const li = document.createElement('li');
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = state.saves.includes(label);
    box.addEventListener('change', () => {
      if (box.checked) state.saves.push(label);
      else state.saves = state.saves.filter((s) => s !== label);
      saveState();
    });
    li.append(box, document.createTextNode(label));
    slots.append(li);
  }
}

function renderMissables() {
  const t = trophyById(28);
  const banner = document.getElementById('missableBanner');
  banner.replaceChildren();
  const h = document.createElement('h3');
  h.textContent = '★ Positive Mental Attitude — the only missable trophy';
  const p1 = document.createElement('p');
  p1.innerHTML = '<span class="banner-count">Meditate at all 18 spots across Leonida.</span> The first spot is Lucia on Jason’s balcony, the morning after the Down to Earth mission — it is gone after Chapter 1 ends.';
  const p2 = document.createElement('p');
  p2.textContent = 'The other 17 spots stay open all game. Do the balcony meditation the moment it appears, then work through the rest at your leisure.';
  banner.append(h, p1, p2);
  document.getElementById('medCount').textContent = `${state.counters[28] ?? 0} / 18`;
  const box = document.getElementById('medCounter');
  box.replaceChildren();
  renderCounter(box, t);
}

function renderSources() {
  const grid = document.getElementById('sourceGrid');
  grid.replaceChildren();
  for (const s of SOURCES) {
    const card = document.createElement('div');
    card.className = 'source-card';
    const h = document.createElement('h4');
    h.textContent = s.name;
    const p = document.createElement('p');
    p.textContent = s.blurb;
    card.append(h, p);
    grid.append(card);
  }
}

function renderAll() {
  renderProgress();
  renderChecklist();
  renderRoadmap();
  renderMissables();
  renderSources();
}

function switchTab(name) {
  for (const btn of document.querySelectorAll('.tab')) {
    const on = btn.dataset.tab === name;
    btn.classList.toggle('active', on);
    btn.setAttribute('aria-selected', String(on));
  }
  for (const panel of document.querySelectorAll('.tab-panel')) {
    panel.classList.toggle('active', panel.id === `tab-${name}`);
  }
}

async function init() {
  doc = await (await fetch('data/trophies.json')).json();
  document.getElementById('spoilerToggle').checked = state.spoiler;
  for (const btn of document.querySelectorAll('.tab')) {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  }
  for (const id of ['search', 'kindFilter', 'gradeFilter', 'earnedOnly', 'unearnedOnly']) {
    document.getElementById(id).addEventListener('input', renderChecklist);
    document.getElementById(id).addEventListener('change', renderChecklist);
  }
  document.getElementById('spoilerToggle').addEventListener('change', (e) => {
    state.spoiler = e.target.checked;
    saveState();
    renderAll();
  });
  document.getElementById('exportBtn').addEventListener('click', () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' }));
    a.download = 'leonida-platinum-atlas-progress.json';
    a.click();
  });
  document.getElementById('importFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const raw = JSON.parse(await file.text());
      if (!Array.isArray(raw.earned)) throw new Error('bad file');
      state = { earned: raw.earned, counters: raw.counters ?? {}, saves: raw.saves ?? [], spoiler: !!raw.spoiler };
      document.getElementById('spoilerToggle').checked = state.spoiler;
      saveState();
      renderAll();
    } catch {
      alert('That file is not a Leonida Platinum Atlas progress export.');
    }
    e.target.value = '';
  });
  document.getElementById('resetBtn').addEventListener('click', () => {
    if (!confirm('Reset all progress, counters and save slots?')) return;
    state = { earned: [], counters: {}, saves: [], spoiler: false };
    document.getElementById('spoilerToggle').checked = false;
    saveState();
    renderAll();
  });
  renderAll();
  const tab = params.get('tab');
  if (tab && ['checklist', 'roadmap', 'missables', 'sources'].includes(tab)) switchTab(tab);
  const open = Number(params.get('open'));
  if (open && trophyById(open)) openDetail(open); // detail panel is sticky: no scroll, the cover keeps its masthead
  requestAnimationFrame(() => { window.__shotReady = true; });
}

init();
