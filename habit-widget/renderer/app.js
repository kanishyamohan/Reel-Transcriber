'use strict';

/* ==========================================================================
   Reel Habit — calendar, status menu, streaks and keyboard handling.
   Statuses and colours all come from window.HABIT.state, so anything the
   user changes in the Customise panel shows up on the next render.
   ========================================================================== */

(function (H) {
  const api = H.api;
  const state = H.state;

  if (!api) document.body.classList.add('standalone');

  const MONTHS = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY',
    'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
  const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  H.MONTHS = MONTHS;

  /* ---------- date helpers ------------------------------------------------ */

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

  H.keyOf = keyOf;
  H.startOfToday = startOfToday;

  /* ---------- elements ---------------------------------------------------- */

  const el = {
    monthTitle: document.getElementById('month-title'),
    habitName: document.getElementById('habit-name'),
    habitDot: document.getElementById('habit-dot'),
    weekdays: document.getElementById('weekdays'),
    grid: document.getElementById('grid'),
    stats: document.getElementById('stats'),
    statusMenu: document.getElementById('status-menu'),
    moreMenu: document.getElementById('more-menu'),
    themeBtn: document.getElementById('theme-btn'),
    settingsBtn: document.getElementById('settings-btn'),
    pinBtn: document.getElementById('pin-btn'),
    moreBtn: document.getElementById('more-btn'),
    prevBtn: document.getElementById('prev-btn'),
    nextBtn: document.getElementById('next-btn'),
    todayBtn: document.getElementById('today-btn'),
    grip: document.getElementById('resize-grip'),
    toast: document.getElementById('toast')
  };

  H.el = el;

  /* ---------- toast ------------------------------------------------------- */

  let toastTimer = null;

  H.toast = function toast(message) {
    el.toast.textContent = message;
    el.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.toast.hidden = true; }, 3200);
  };

  H.onSaveError = () => H.toast('Couldn’t save — the background image may be too large.');

  /* ---------- theme button ------------------------------------------------ */

  function refreshThemeButton() {
    const glyph = { system: '◐', light: '☀', dark: '☾' }[state.theme];
    const title = {
      system: 'Following system appearance',
      light: 'Day mode',
      dark: 'Night mode'
    }[state.theme];
    el.themeBtn.textContent = glyph;
    el.themeBtn.title = `${title} — click to change`;
  }

  H.refreshThemeButton = refreshThemeButton;

  // appearance.js calls this when macOS flips between light and dark.
  H.onThemeChange = () => {
    renderCalendar();
    H.onAppearanceChanged && H.onAppearanceChanged();
  };

  el.themeBtn.addEventListener('click', () => {
    const order = ['system', 'light', 'dark'];
    state.theme = order[(order.indexOf(state.theme) + 1) % order.length];
    H.applyAppearance();
    refreshThemeButton();
    renderCalendar();
    H.save();
    H.onAppearanceChanged && H.onAppearanceChanged();
  });

  /* ---------- calendar ---------------------------------------------------- */

  function renderWeekdays() {
    el.weekdays.innerHTML = '';
    for (const day of WEEKDAYS) {
      const span = document.createElement('span');
      span.textContent = day;
      el.weekdays.appendChild(span);
    }
  }

  /** Paint a tile from its status. Colours go on the element rather than
   *  into CSS because the status list is user-defined and unbounded — there
   *  is no fixed set of classes to write a rule for. */
  function paintTile(tile, status) {
    if (!status) {
      tile.style.background = '';
      tile.style.color = '';
      return;
    }
    tile.style.background = status.color;
    tile.style.color = H.contrastText(status.color);
  }

  function renderCalendar() {
    const year = state.view.getFullYear();
    const month = state.view.getMonth();
    const today = startOfToday();
    const todayKey = keyOf(today);

    el.monthTitle.textContent = year === today.getFullYear()
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
      const status = H.statusById(state.entries[key]);

      tile.dataset.date = key;
      tile.textContent = String(dayNum);
      tile.tabIndex = -1;

      if (status) {
        tile.dataset.status = status.id;
        paintTile(tile, status);
        if (status.badge) {
          const mark = document.createElement('span');
          mark.className = 'badge';
          mark.textContent = status.badge;
          tile.appendChild(mark);
        }
      }
      if (key === todayKey) tile.classList.add('today');
      if (key > todayKey) tile.classList.add('future');

      const label = date.toLocaleDateString(undefined, {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
      });
      tile.setAttribute('aria-label', status ? `${label} — ${status.label}` : `${label} — not set`);

      frag.appendChild(tile);
    }

    el.grid.innerHTML = '';
    el.grid.appendChild(frag);

    // Keep exactly one tile in the tab order: today if it's on screen,
    // otherwise the first day of the month.
    const focusTarget = el.grid.querySelector('.tile.today')
      || el.grid.querySelector('.tile:not(.pad)');
    if (focusTarget) focusTarget.tabIndex = 0;

    const lead = state.statuses.find((s) => s.streak === 'counts') || state.statuses[0];
    el.habitDot.style.background = lead ? lead.color : 'transparent';

    renderStats();
  }

  H.renderCalendar = renderCalendar;

  /* ---------- streaks and stats ------------------------------------------- */

  function modeOf(key) {
    const status = H.statusById(state.entries[key]);
    return status ? status.streak : null;
  }

  const didHabit = (key) => modeOf(key) === 'counts';
  const isSkipped = (key) => modeOf(key) === 'ignores';

  /** Days in a row up to today. Today not being logged yet doesn't break the
   *  run — the day isn't over. Skipped days carry it without adding to it. */
  function currentStreak() {
    const today = startOfToday();
    const todayKey = keyOf(today);
    let cursor = (didHabit(todayKey) || isSkipped(todayKey)) ? today : addDays(today, -1);
    let streak = 0;

    for (let i = 0; i < 3650; i += 1) {
      const key = keyOf(cursor);
      if (didHabit(key)) streak += 1;
      else if (!isSkipped(key)) break;
      cursor = addDays(cursor, -1);
    }
    return streak;
  }

  function bestStreak() {
    const days = Object.keys(state.entries)
      .filter((key) => didHabit(key) || isSkipped(key))
      .sort();
    if (!days.length) return 0;

    let best = 0;
    let run = 0;
    let prevKey = null;

    for (const key of days) {
      const [y, m, d] = key.split('-').map(Number);
      const date = new Date(y, m - 1, d);
      // Calendar-based adjacency: across a DST change a local day is 23 or
      // 25 hours, so millisecond arithmetic would drop a streak.
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

    let done = 0;
    let missed = 0;
    for (let d = 1; d <= daysInMonth; d += 1) {
      const mode = modeOf(keyOf(new Date(year, month, d)));
      if (mode === 'counts') done += 1;
      else if (mode === 'breaks') missed += 1;
    }

    const streak = currentStreak();
    const best = bestStreak();

    const parts = [`${done} done`];
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

  /* ---------- setting a status -------------------------------------------- */

  function setStatus(dateKey, statusId) {
    if (statusId) state.entries[dateKey] = statusId;
    else delete state.entries[dateKey];
    H.save();
    renderCalendar();

    const tile = el.grid.querySelector(`.tile[data-date="${dateKey}"]`);
    if (tile) {
      tile.tabIndex = 0;
      tile.focus({ preventScroll: true });
    }
  }

  /* ---------- menus -------------------------------------------------------- */

  let openMenu = null;
  let openAtLogin = false;

  function buildItem({ swatch, label, key, checked, danger, onSelect }) {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'menu-item' + (danger ? ' danger' : '');
    item.setAttribute('role', 'menuitem');

    if (swatch !== undefined) {
      const dot = document.createElement('span');
      dot.className = 'swatch';
      if (swatch) dot.style.background = swatch;
      item.appendChild(dot);
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
    if (left + rect.width > window.innerWidth - margin) left = anchorRect.right - rect.width;
    left = Math.max(margin, Math.min(left, window.innerWidth - rect.width - margin));

    let top = anchorRect.bottom + 6;
    if (top + rect.height > window.innerHeight - margin) top = anchorRect.top - rect.height - 6;
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

  H.closeMenus = closeMenus;

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

    if (!state.statuses.length) {
      const empty = document.createElement('div');
      empty.className = 'menu-empty';
      empty.textContent = 'No options yet — add some in Customise.';
      el.statusMenu.appendChild(empty);
    }

    state.statuses.forEach((status, index) => {
      el.statusMenu.appendChild(buildItem({
        swatch: status.color,
        label: status.label,
        key: H.hotkeyFor(index),
        checked: current === status.id,
        onSelect: () => setStatus(dateKey, status.id)
      }));
    });

    const sep = document.createElement('div');
    sep.className = 'menu-sep';
    el.statusMenu.appendChild(sep);

    el.statusMenu.appendChild(buildItem({
      swatch: '',
      label: 'Clear',
      key: '⌫',
      onSelect: () => setStatus(dateKey, null)
    }));

    el.statusMenu.appendChild(buildItem({
      swatch: '',
      label: 'Edit options…',
      onSelect: () => H.openSettings('statuses')
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
      label: 'Customise…',
      onSelect: () => H.openSettings('look')
    }));

    let sep = document.createElement('div');
    sep.className = 'menu-sep';
    el.moreMenu.appendChild(sep);

    el.moreMenu.appendChild(buildItem({
      label: `Clear ${MONTHS[state.view.getMonth()].toLowerCase()}`,
      danger: true,
      onSelect: clearMonth
    }));
    el.moreMenu.appendChild(buildItem({
      label: 'Reset all history',
      danger: true,
      onSelect: resetHistory
    }));

    if (api) {
      sep = document.createElement('div');
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
    const name = MONTHS[month];
    const label = `${name[0]}${name.slice(1).toLowerCase()} ${year}`;
    if (!window.confirm(`Clear every mark in ${label}?`)) return;

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let d = 1; d <= daysInMonth; d += 1) {
      delete state.entries[keyOf(new Date(year, month, d))];
    }
    H.save();
    renderCalendar();
  }

  function resetHistory() {
    if (!window.confirm('Delete all history for every month? This cannot be undone.')) return;
    state.entries = {};
    H.save();
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

  // Right-click applies the first status without opening the menu.
  el.grid.addEventListener('contextmenu', (event) => {
    const tile = event.target.closest('.tile:not(.pad)');
    if (!tile) return;
    event.preventDefault();
    const first = state.statuses[0];
    if (!first) return;
    const key = tile.dataset.date;
    setStatus(key, state.entries[key] === first.id ? null : first.id);
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

    const hit = H.statusByHotkey(event.key);
    if (hit) {
      event.preventDefault();
      setStatus(tile.dataset.date, hit.id);
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
      return;
    }
    if (H.settingsOpen && H.settingsOpen()) {
      H.closeSettings();
      return;
    }
    if (el.habitName.matches(':focus')) el.habitName.blur();
  });

  for (const menu of [el.statusMenu, el.moreMenu]) {
    menu.addEventListener('keydown', (event) => {
      if (menu === el.statusMenu && openMenu) {
        const hit = H.statusByHotkey(event.key);
        if (hit) {
          event.preventDefault();
          const dateKey = openMenu.dateKey;
          closeMenus();
          setStatus(dateKey, hit.id);
          return;
        }
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

  /* ---------- habit name ------------------------------------------------------ */

  el.habitName.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      el.habitName.blur();
    }
  });

  el.habitName.addEventListener('blur', () => {
    const name = el.habitName.textContent.replace(/\s+/g, ' ').trim().slice(0, 60);
    state.habitName = name || 'Post Reel';
    el.habitName.textContent = state.habitName;
    H.save();
  });

  // Paste as plain text so styled clipboard content can't leak into the widget.
  el.habitName.addEventListener('paste', (event) => {
    event.preventDefault();
    const text = (event.clipboardData || window.clipboardData).getData('text');
    document.execCommand('insertText', false, text.replace(/\s+/g, ' '));
  });

  /* ---------- window controls (Electron only) --------------------------------- */

  el.moreBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    openMoreMenu();
  });

  el.settingsBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    closeMenus();
    H.toggleSettings();
  });

  if (api) {
    el.pinBtn.addEventListener('click', async () => {
      state.pinned = !state.pinned;
      await api.setPinned(state.pinned);
      el.pinBtn.setAttribute('aria-pressed', String(state.pinned));
      el.pinBtn.title = state.pinned ? 'Unpin from top' : 'Keep on top';
      H.save();
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
  }

  /* ---------- midnight rollover ------------------------------------------------ */

  let lastSeenDay = keyOf(startOfToday());
  setInterval(() => {
    const today = keyOf(startOfToday());
    if (today !== lastSeenDay) {
      lastSeenDay = today;
      renderCalendar();
    }
  }, 30000);

  /* ---------- boot -------------------------------------------------------------- */

  H.boot = async function boot() {
    await H.load();
    state.view = startOfToday();
    H.applyAppearance();
    refreshThemeButton();
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
    document.body.classList.add('ready');
  };
})(window.HABIT);
