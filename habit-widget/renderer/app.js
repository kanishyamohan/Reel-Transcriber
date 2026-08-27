'use strict';

/* ==========================================================================
   Reel Habit — calendar habit tracker
   Runs inside Electron (persisting to a JSON file via the preload bridge)
   or straight from a browser (persisting to localStorage).
   ========================================================================== */

const api = window.habitAPI || null;
const STORAGE_KEY = 'reel-habit-data-v1';

if (!api) document.body.classList.add('standalone');

/* ---------- statuses ------------------------------------------------------ */

// `counts` marks a status as "the habit happened", which is what streaks and
// the posted tally are built from. `neutral` neither counts nor breaks a streak.
const STATUSES = [
  { id: 'p1',     label: 'Done',        hint: 'posted once',  key: '1', counts: 1, badge: null },
  { id: 'p2',     label: 'Posted 2',    hint: 'twice',        key: '2', counts: 2, badge: '2' },
  { id: 'p3',     label: 'Posted 3+',   hint: 'three or more',key: '3', counts: 3, badge: '3' },
  { id: 'missed', label: 'Not done',    hint: '',             key: '4', counts: 0, badge: null },
  { id: 'rest',   label: 'Rest day',    hint: '',             key: '5', counts: 0, badge: null, neutral: true }
];

const STATUS_BY_ID = Object.fromEntries(STATUSES.map((s) => [s.id, s]));
const STATUS_BY_KEY = Object.fromEntries(STATUSES.map((s) => [s.key, s]));

const MONTHS = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY',
  'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/* ---------- date helpers -------------------------------------------------- */

const pad2 = (n) => String(n).padStart(2, '0');

/** Local-date key, `YYYY-MM-DD`. Deliberately not ISO/UTC: a habit day is
 *  whatever day it is where you are, not in Greenwich. */
function keyOf(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function addDays(date, n) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);
}

/* ---------- state --------------------------------------------------------- */

const state = {
  habitName: 'Post Reel',
  entries: {},           // { 'YYYY-MM-DD': statusId }
  theme: 'system',       // 'system' | 'light' | 'dark'
  pinned: false,
  view: startOfToday()   // any date inside the month being shown
};

const el = {
  html: document.documentElement,
  monthTitle: document.getElementById('month-title'),
  habitName: document.getElementById('habit-name'),
  weekdays: document.getElementById('weekdays'),
  grid: document.getElementById('grid'),
  stats: document.getElementById('stats'),
  statusMenu: document.getElementById('status-menu'),
  moreMenu: document.getElementById('more-menu'),
  themeBtn: document.getElementById('theme-btn'),
  pinBtn: document.getElementById('pin-btn'),
  moreBtn: document.getElementById('more-btn'),
  prevBtn: document.getElementById('prev-btn'),
  nextBtn: document.getElementById('next-btn'),
  todayBtn: document.getElementById('today-btn'),
  grip: document.getElementById('resize-grip')
};

/* ---------- persistence --------------------------------------------------- */

let saveTimer = null;

function snapshot() {
  return {
    habitName: state.habitName,
    entries: state.entries,
    theme: state.theme,
    pinned: state.pinned
  };
}

function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const data = snapshot();
    if (api) {
      api.save(data).catch((err) => console.error('save failed', err));
    } else {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch (err) {
        console.error('save failed', err);
      }
    }
  }, 200);
}

async function load() {
  let data = null;
  try {
    data = api
      ? await api.load()
      : JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
  } catch (err) {
    console.error('load failed, starting fresh', err);
  }
  if (!data || typeof data !== 'object') return;

  if (typeof data.habitName === 'string' && data.habitName.trim()) {
    state.habitName = data.habitName.trim();
  }
  if (data.entries && typeof data.entries === 'object') {
    // Drop anything that isn't a known status so a hand-edited or
    // older file can't poison the render.
    for (const [key, value] of Object.entries(data.entries)) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(key) && STATUS_BY_ID[value]) {
        state.entries[key] = value;
      }
    }
  }
  if (['system', 'light', 'dark'].includes(data.theme)) state.theme = data.theme;
  state.pinned = data.pinned === true;
}

/* ---------- theme --------------------------------------------------------- */

const systemDark = window.matchMedia('(prefers-color-scheme: dark)');

function applyTheme() {
  const resolved = state.theme === 'system'
    ? (systemDark.matches ? 'dark' : 'light')
    : state.theme;

  el.html.setAttribute('data-theme', resolved);

  const glyph = { system: '◐', light: '☀', dark: '☾' }[state.theme];
  const title = {
    system: 'Following system appearance',
    light: 'Day mode',
    dark: 'Night mode'
  }[state.theme];
  el.themeBtn.textContent = glyph;
  el.themeBtn.title = `${title} — click to change`;
}

systemDark.addEventListener('change', () => {
  if (state.theme === 'system') applyTheme();
});

el.themeBtn.addEventListener('click', () => {
  const order = ['system', 'light', 'dark'];
  state.theme = order[(order.indexOf(state.theme) + 1) % order.length];
  applyTheme();
  save();
});

/* ---------- calendar render ---------------------------------------------- */

function renderWeekdays() {
  el.weekdays.innerHTML = '';
  for (const day of WEEKDAYS) {
    const span = document.createElement('span');
    span.textContent = day;
    el.weekdays.appendChild(span);
  }
}

function renderCalendar() {
  const year = state.view.getFullYear();
  const month = state.view.getMonth();
  const todayKey = keyOf(startOfToday());

  el.monthTitle.textContent =
    year === startOfToday().getFullYear()
      ? MONTHS[month]
      : `${MONTHS[month]} ${year}`;

  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // Always fill whole weeks so the grid never reflows between months.
  const cells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;

  const frag = document.createDocumentFragment();

  for (let i = 0; i < cells; i += 1) {
    const dayNum = i - firstWeekday + 1;
    const inMonth = dayNum >= 1 && dayNum <= daysInMonth;
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = 'tile';

    if (!inMonth) {
      tile.classList.add('pad');
      tile.disabled = true;
      tile.tabIndex = -1;
      tile.setAttribute('aria-hidden', 'true');
      frag.appendChild(tile);
      continue;
    }

    const date = new Date(year, month, dayNum);
    const key = keyOf(date);
    const status = state.entries[key];

    tile.dataset.date = key;
    tile.textContent = String(dayNum);
    tile.tabIndex = -1;

    if (status) {
      tile.dataset.status = status;
      const badge = STATUS_BY_ID[status].badge;
      if (badge) {
        const mark = document.createElement('span');
        mark.className = 'badge';
        mark.textContent = badge;
        tile.appendChild(mark);
      }
    }
    if (key === todayKey) tile.classList.add('today');
    if (key > todayKey) tile.classList.add('future');

    const label = date.toLocaleDateString(undefined, {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
    });
    tile.setAttribute(
      'aria-label',
      status ? `${label} — ${STATUS_BY_ID[status].label}` : `${label} — not set`
    );

    frag.appendChild(tile);
  }

  el.grid.innerHTML = '';
  el.grid.appendChild(frag);

  // Keep exactly one tile in the tab order: today if it's on screen,
  // otherwise the first day of the month.
  const firstDay = el.grid.querySelector('.tile:not(.pad)');
  const focusTarget = el.grid.querySelector('.tile.today') || firstDay;
  if (focusTarget) focusTarget.tabIndex = 0;

  renderStats();
}

/* ---------- stats --------------------------------------------------------- */

function didHabit(key) {
  const status = state.entries[key];
  return Boolean(status) && STATUS_BY_ID[status].counts > 0;
}

function isNeutral(key) {
  const status = state.entries[key];
  return Boolean(status) && STATUS_BY_ID[status].neutral === true;
}

/** Days in a row up to today. Today not being logged yet doesn't break the
 *  run — the day isn't over. Rest days carry the streak without adding to it. */
function currentStreak() {
  const today = startOfToday();
  let cursor = didHabit(keyOf(today)) || isNeutral(keyOf(today))
    ? today
    : addDays(today, -1);
  let streak = 0;

  for (let i = 0; i < 3650; i += 1) {
    const key = keyOf(cursor);
    if (didHabit(key)) streak += 1;
    else if (!isNeutral(key)) break;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

function bestStreak() {
  const days = Object.keys(state.entries)
    .filter((key) => didHabit(key) || isNeutral(key))
    .sort();
  if (!days.length) return 0;

  let best = 0;
  let run = 0;
  let prevKey = null;

  for (const key of days) {
    const [y, m, d] = key.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const consecutive = prevKey !== null && keyOf(addDays(date, -1)) === prevKey;
    if (!consecutive) run = 0;
    if (didHabit(key)) run += 1;
    best = Math.max(best, run);
    prevKey = key;
  }
  return best;
}

function renderStats() {
  const year = state.view.getFullYear();
  const month = state.view.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  let posted = 0;
  let missed = 0;
  for (let d = 1; d <= daysInMonth; d += 1) {
    const status = state.entries[keyOf(new Date(year, month, d))];
    if (!status) continue;
    if (STATUS_BY_ID[status].counts > 0) posted += 1;
    else if (status === 'missed') missed += 1;
  }

  const streak = currentStreak();
  const best = bestStreak();

  const parts = [`${posted} posted`];
  if (missed) parts.push(`${missed} missed`);
  parts.push(streak > 0 ? `🔥 ${streak} day streak` : 'no streak yet');
  if (best > streak) parts.push(`best ${best}`);

  el.stats.innerHTML = '';
  parts.forEach((text, i) => {
    if (i > 0) {
      const sep = document.createElement('span');
      sep.className = 'sep';
      sep.textContent = '·';
      el.stats.appendChild(sep);
    }
    const span = document.createElement('span');
    if (text.startsWith('🔥')) span.className = 'hot';
    span.textContent = text;
    el.stats.appendChild(span);
  });
}

/* ---------- setting a status ---------------------------------------------- */

function setStatus(dateKey, statusId) {
  if (statusId) state.entries[dateKey] = statusId;
  else delete state.entries[dateKey];
  save();
  renderCalendar();

  const tile = el.grid.querySelector(`.tile[data-date="${dateKey}"]`);
  if (tile) {
    tile.tabIndex = 0;
    tile.focus({ preventScroll: true });
  }
}

/* ---------- menus --------------------------------------------------------- */

let openMenu = null;
let openAtLogin = false;

function buildItem({ swatchVar, label, hint, key, checked, onSelect }) {
  const item = document.createElement('button');
  item.type = 'button';
  item.className = 'menu-item';
  item.setAttribute('role', 'menuitem');

  if (swatchVar !== undefined) {
    const swatch = document.createElement('span');
    swatch.className = 'swatch';
    if (swatchVar) swatch.style.background = `var(${swatchVar})`;
    item.appendChild(swatch);
  }

  const text = document.createElement('span');
  text.className = 'label';
  text.textContent = label;
  item.appendChild(text);

  if (checked) {
    const check = document.createElement('span');
    check.className = 'check';
    check.textContent = '✓';
    item.appendChild(check);
  }
  if (key) {
    const hotkey = document.createElement('span');
    hotkey.className = 'key';
    hotkey.textContent = key;
    item.appendChild(hotkey);
  }
  if (hint) item.title = hint;

  item.addEventListener('click', (event) => {
    event.stopPropagation();
    closeMenus();
    onSelect();
  });
  return item;
}

function placeMenu(menu, anchorRect) {
  menu.hidden = false;
  // Measure after unhiding so the flip maths uses the real size.
  const rect = menu.getBoundingClientRect();
  const margin = 8;

  let left = anchorRect.left;
  if (left + rect.width > window.innerWidth - margin) {
    left = anchorRect.right - rect.width;
  }
  left = Math.max(margin, Math.min(left, window.innerWidth - rect.width - margin));

  let top = anchorRect.bottom + 6;
  if (top + rect.height > window.innerHeight - margin) {
    top = anchorRect.top - rect.height - 6;
  }
  top = Math.max(margin, Math.min(top, window.innerHeight - rect.height - margin));

  menu.style.left = `${Math.round(left)}px`;
  menu.style.top = `${Math.round(top)}px`;
}

function closeMenus() {
  for (const menu of [el.statusMenu, el.moreMenu]) {
    menu.hidden = true;
    menu.innerHTML = '';
  }
  el.moreBtn.setAttribute('aria-expanded', 'false');
  openMenu = null;
}

function openStatusMenu(tile) {
  closeMenus();
  const dateKey = tile.dataset.date;
  const current = state.entries[dateKey];
  const [y, m, d] = dateKey.split('-').map(Number);

  const head = document.createElement('div');
  head.className = 'menu-head';
  head.textContent = new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric'
  });
  el.statusMenu.appendChild(head);

  for (const status of STATUSES) {
    el.statusMenu.appendChild(buildItem({
      swatchVar: `--${status.id}`,
      label: status.label,
      hint: status.hint,
      key: status.key,
      checked: current === status.id,
      onSelect: () => setStatus(dateKey, status.id)
    }));
  }

  const sep = document.createElement('div');
  sep.className = 'menu-sep';
  el.statusMenu.appendChild(sep);

  el.statusMenu.appendChild(buildItem({
    swatchVar: '',
    label: 'Clear',
    key: '⌫',
    onSelect: () => setStatus(dateKey, null)
  }));

  placeMenu(el.statusMenu, tile.getBoundingClientRect());
  openMenu = { type: 'status', dateKey };
  const first = el.statusMenu.querySelector('.menu-item');
  if (first) first.focus({ preventScroll: true });
}

function openMoreMenu() {
  const wasOpen = openMenu && openMenu.type === 'more';
  closeMenus();
  if (wasOpen) return;

  el.moreMenu.appendChild(buildItem({
    label: `Clear ${MONTHS[state.view.getMonth()].toLowerCase()}`,
    onSelect: clearMonth
  }));
  el.moreMenu.appendChild(buildItem({
    label: 'Reset everything',
    onSelect: resetAll
  }));

  if (api) {
    let sep = document.createElement('div');
    sep.className = 'menu-sep';
    el.moreMenu.appendChild(sep);
    el.moreMenu.appendChild(buildItem({
      label: 'Open at login',
      checked: openAtLogin,
      onSelect: async () => { openAtLogin = await api.setLoginItem(!openAtLogin); }
    }));

    sep = document.createElement('div');
    sep.className = 'menu-sep';
    el.moreMenu.appendChild(sep);
    el.moreMenu.appendChild(buildItem({ label: 'Hide widget', key: '⌘H', onSelect: () => api.hide() }));
    el.moreMenu.appendChild(buildItem({ label: 'Quit', key: '⌘Q', onSelect: () => api.quit() }));
  }

  placeMenu(el.moreMenu, el.moreBtn.getBoundingClientRect());
  el.moreBtn.setAttribute('aria-expanded', 'true');
  openMenu = { type: 'more' };
  const first = el.moreMenu.querySelector('.menu-item');
  if (first) first.focus({ preventScroll: true });
}

function clearMonth() {
  const year = state.view.getFullYear();
  const month = state.view.getMonth();
  const label = `${MONTHS[month][0]}${MONTHS[month].slice(1).toLowerCase()} ${year}`;
  if (!window.confirm(`Clear every mark in ${label}?`)) return;

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= daysInMonth; d += 1) {
    delete state.entries[keyOf(new Date(year, month, d))];
  }
  save();
  renderCalendar();
}

function resetAll() {
  if (!window.confirm('Delete all history for every month? This cannot be undone.')) return;
  state.entries = {};
  save();
  renderCalendar();
}

/* ---------- interaction --------------------------------------------------- */

el.grid.addEventListener('click', (event) => {
  const tile = event.target.closest('.tile:not(.pad)');
  if (!tile) return;
  if (openMenu && openMenu.type === 'status' && openMenu.dateKey === tile.dataset.date) {
    closeMenus();
    return;
  }
  openStatusMenu(tile);
});

// Right-click marks the day done (or clears it) without opening the menu.
el.grid.addEventListener('contextmenu', (event) => {
  const tile = event.target.closest('.tile:not(.pad)');
  if (!tile) return;
  event.preventDefault();
  const key = tile.dataset.date;
  setStatus(key, state.entries[key] === 'p1' ? null : 'p1');
});

el.grid.addEventListener('keydown', (event) => {
  const tile = event.target.closest('.tile:not(.pad)');
  if (!tile) return;

  const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[event.key];
  if (step) {
    event.preventDefault();
    const days = [...el.grid.querySelectorAll('.tile:not(.pad)')];
    const next = days[days.indexOf(tile) + step];
    if (next) {
      tile.tabIndex = -1;
      next.tabIndex = 0;
      next.focus({ preventScroll: true });
    }
    return;
  }

  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    openStatusMenu(tile);
    return;
  }

  if (STATUS_BY_KEY[event.key]) {
    event.preventDefault();
    setStatus(tile.dataset.date, STATUS_BY_KEY[event.key].id);
    return;
  }

  if (event.key === 'Backspace' || event.key === 'Delete') {
    event.preventDefault();
    setStatus(tile.dataset.date, null);
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (openMenu) {
    const { type, dateKey } = openMenu;
    closeMenus();
    if (type === 'status') {
      const tile = el.grid.querySelector(`.tile[data-date="${dateKey}"]`);
      if (tile) tile.focus({ preventScroll: true });
    }
  } else if (el.habitName.matches(':focus')) {
    el.habitName.blur();
  }
});

// Number keys work straight from the open status menu too.
for (const menu of [el.statusMenu, el.moreMenu]) {
  menu.addEventListener('keydown', (event) => {
    if (menu === el.statusMenu && openMenu && STATUS_BY_KEY[event.key]) {
      event.preventDefault();
      const dateKey = openMenu.dateKey;
      closeMenus();
      setStatus(dateKey, STATUS_BY_KEY[event.key].id);
      return;
    }
    const items = [...menu.querySelectorAll('.menu-item')];
    const dir = { ArrowDown: 1, ArrowUp: -1 }[event.key];
    if (!dir) return;
    event.preventDefault();
    const index = items.indexOf(document.activeElement);
    const next = items[(index + dir + items.length) % items.length];
    if (next) next.focus({ preventScroll: true });
  });
}

document.addEventListener('mousedown', (event) => {
  if (!openMenu) return;
  if (event.target.closest('.menu') || event.target.closest('.tile')) return;
  if (event.target.closest('#more-btn')) return;
  closeMenus();
});

window.addEventListener('blur', closeMenus);
window.addEventListener('resize', closeMenus);

/* ---------- month navigation ---------------------------------------------- */

function goMonth(delta) {
  closeMenus();
  state.view = new Date(state.view.getFullYear(), state.view.getMonth() + delta, 1);
  renderCalendar();
}

el.prevBtn.addEventListener('click', () => goMonth(-1));
el.nextBtn.addEventListener('click', () => goMonth(1));
el.todayBtn.addEventListener('click', () => {
  closeMenus();
  state.view = startOfToday();
  renderCalendar();
});

/* ---------- habit name ----------------------------------------------------- */

el.habitName.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    el.habitName.blur();
  }
});

el.habitName.addEventListener('blur', () => {
  const name = el.habitName.textContent.replace(/\s+/g, ' ').trim();
  state.habitName = name || 'Post Reel';
  el.habitName.textContent = state.habitName;
  save();
});

// Paste as plain text so styled clipboard content can't leak into the widget.
el.habitName.addEventListener('paste', (event) => {
  event.preventDefault();
  const text = (event.clipboardData || window.clipboardData).getData('text');
  document.execCommand('insertText', false, text.replace(/\s+/g, ' '));
});

/* ---------- window controls (Electron only) -------------------------------- */

if (api) {
  el.pinBtn.addEventListener('click', async () => {
    state.pinned = !state.pinned;
    await api.setPinned(state.pinned);
    el.pinBtn.setAttribute('aria-pressed', String(state.pinned));
    el.pinBtn.title = state.pinned ? 'Unpin from top' : 'Keep on top';
    save();
  });

  el.moreBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    openMoreMenu();
  });

  // Custom resize grip: transparent windows don't get native resize edges
  // on macOS, so drive the size through the main process instead.
  el.grip.addEventListener('mousedown', (event) => {
    event.preventDefault();
    closeMenus();
    let lastX = event.screenX;
    let lastY = event.screenY;

    const onMove = (moveEvent) => {
      const dx = moveEvent.screenX - lastX;
      const dy = moveEvent.screenY - lastY;
      if (dx === 0 && dy === 0) return;
      lastX = moveEvent.screenX;
      lastY = moveEvent.screenY;
      api.resizeBy(dx, dy);
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  });
} else {
  el.pinBtn.hidden = true;
  el.moreBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    openMoreMenu();
  });
}

/* ---------- midnight rollover ---------------------------------------------- */

// Re-render when the date changes so "today" moves without a restart.
let lastSeenDay = keyOf(startOfToday());
setInterval(() => {
  const today = keyOf(startOfToday());
  if (today !== lastSeenDay) {
    lastSeenDay = today;
    renderCalendar();
  }
}, 30000);

/* ---------- boot ------------------------------------------------------------ */

(async function init() {
  await load();
  applyTheme();
  el.habitName.textContent = state.habitName;
  el.pinBtn.setAttribute('aria-pressed', String(state.pinned));
  el.pinBtn.title = state.pinned ? 'Unpin from top' : 'Keep on top';
  if (api) {
    // Owned by macOS, not by our data file — read the real setting back.
    openAtLogin = await api.getLoginItem().catch(() => false);
    api.setPinned(state.pinned);
  }
  renderWeekdays();
  renderCalendar();
})();
