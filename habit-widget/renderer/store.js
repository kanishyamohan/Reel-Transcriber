'use strict';

/* ==========================================================================
   Reel Habit — data model, persistence and colour helpers.
   Loaded before app.js and settings.js; shares state through window.HABIT.
   Classic script, not a module: ES modules are blocked over file://, and
   index.html has to keep working when opened straight from Finder.
   ========================================================================== */

window.HABIT = window.HABIT || {};

(function (H) {
  const api = window.habitAPI || null;
  const STORAGE_KEY = 'reel-habit-data-v1';
  const SCHEMA_VERSION = 2;

  H.api = api;

  /* ---------- colour helpers --------------------------------------------- */

  /** Accepts `#abc`, `#aabbcc` (with or without the hash). Returns
   *  `#aabbcc` lowercase, or null if it isn't a colour we can use. */
  function normHex(value) {
    if (typeof value !== 'string') return null;
    let hex = value.trim().replace(/^#/, '');
    if (/^[0-9a-fA-F]{3}$/.test(hex)) {
      hex = hex.split('').map((c) => c + c).join('');
    }
    return /^[0-9a-fA-F]{6}$/.test(hex) ? `#${hex.toLowerCase()}` : null;
  }

  function toRgb(hex) {
    const clean = normHex(hex) || '#000000';
    return [
      parseInt(clean.slice(1, 3), 16),
      parseInt(clean.slice(3, 5), 16),
      parseInt(clean.slice(5, 7), 16)
    ];
  }

  /** WCAG relative luminance, 0 (black) to 1 (white). */
  function luminance(hex) {
    const [r, g, b] = toRgb(hex).map((channel) => {
      const c = channel / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  const INK_DARK = '#14200a';
  const INK_LIGHT = '#ffffff';

  function contrastRatio(a, b) {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  }

  /** Ink that stays readable on `hex`, whatever colour the user picked.
   *  Picks whichever of the two inks actually has the better contrast ratio
   *  rather than guessing from a luminance threshold — mid-tones like a
   *  mid-green sit right on the fence and a threshold gets them wrong.
   *  This is why a status needs only one colour instead of one per theme. */
  function contrastText(hex) {
    return contrastRatio(hex, INK_DARK) >= contrastRatio(hex, INK_LIGHT)
      ? INK_DARK
      : INK_LIGHT;
  }

  function rgba(hex, alpha) {
    const [r, g, b] = toRgb(hex);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  /** Nudge a colour toward white or black — used for hover states so we
   *  don't need a second colour from the user for every surface. */
  function shift(hex, amount) {
    const [r, g, b] = toRgb(hex);
    const target = luminance(hex) > 0.5 ? 0 : 255;
    const mix = (c) => Math.round(c + (target - c) * amount);
    return `#${[mix(r), mix(g), mix(b)]
      .map((c) => Math.max(0, Math.min(255, c)).toString(16).padStart(2, '0'))
      .join('')}`;
  }

  /** Blend `hex` toward `targetHex` by `amount` (0..1). */
  function mix(hex, targetHex, amount) {
    const a = toRgb(hex);
    const b = toRgb(targetHex);
    const t = Math.max(0, Math.min(1, amount));
    return `#${a
      .map((c, i) => Math.round(c + (b[i] - c) * t).toString(16).padStart(2, '0'))
      .join('')}`;
  }

  Object.assign(H, { normHex, luminance, contrastText, contrastRatio, rgba, shift, mix });

  /* ---------- defaults ---------------------------------------------------- */

  // `streak` is the only behavioural field on a status:
  //   counts  — the habit happened; extends the streak and the monthly tally
  //   breaks  — an explicit miss; ends the streak
  //   ignores — a day that neither counts nor breaks (a rest day)
  H.STREAK_MODES = [
    { id: 'counts', label: 'Counts toward streak' },
    { id: 'breaks', label: 'Breaks the streak' },
    { id: 'ignores', label: 'Skipped — keeps the streak' }
  ];

  const DEFAULT_STATUSES = [
    { id: 'p1', label: 'Done', color: '#c8f7a0', streak: 'counts', badge: '' },
    { id: 'p2', label: 'Posted 2', color: '#9be86f', streak: 'counts', badge: '2' },
    { id: 'p3', label: 'Posted 3+', color: '#5fc93a', streak: 'counts', badge: '3' },
    { id: 'missed', label: 'Not done', color: '#ef9a9a', streak: 'breaks', badge: '' },
    { id: 'rest', label: 'Rest day', color: '#a9c6ea', streak: 'ignores', badge: '' }
  ];

  const DEFAULT_LOOK = {
    dark: {
      bgMode: 'solid',
      bg1: '#1e1e1e',
      bg2: '#2b2b30',
      bgImage: null,
      bgAlpha: 1,
      bgDim: 0.35,
      tile: '#3a3a3c',
      text: '#d6d6d6',
      title: '#b8b8b8',
      radius: 14
    },
    light: {
      bgMode: 'solid',
      bg1: '#f4f4f6',
      bg2: '#e4e6ef',
      bgImage: null,
      bgAlpha: 1,
      bgDim: 0.35,
      tile: '#e3e3e8',
      text: '#1c1c1e',
      title: '#9a9aa2',
      radius: 14
    }
  };

  H.DEFAULT_STATUSES = DEFAULT_STATUSES;
  H.DEFAULT_LOOK = DEFAULT_LOOK;

  H.defaultStatuses = () => DEFAULT_STATUSES.map((s) => ({ ...s }));
  H.defaultLook = () => ({ dark: { ...DEFAULT_LOOK.dark }, light: { ...DEFAULT_LOOK.light } });

  // Ready-made pairs so someone can restyle the whole widget in one click
  // instead of picking six colours by hand.
  H.PRESETS = [
    {
      name: 'Midnight',
      dark: { bgMode: 'solid', bg1: '#1e1e1e', bg2: '#2b2b30', tile: '#3a3a3c', text: '#d6d6d6', title: '#b8b8b8' },
      light: { bgMode: 'solid', bg1: '#f4f4f6', bg2: '#e4e6ef', tile: '#e3e3e8', text: '#1c1c1e', title: '#9a9aa2' }
    },
    {
      name: 'Ink',
      dark: { bgMode: 'gradient', bg1: '#0d1117', bg2: '#161b22', tile: '#21262d', text: '#c9d1d9', title: '#8b949e' },
      light: { bgMode: 'gradient', bg1: '#ffffff', bg2: '#eef1f5', tile: '#e6eaf0', text: '#1f2328', title: '#8c959f' }
    },
    {
      name: 'Plum',
      dark: { bgMode: 'gradient', bg1: '#1a1024', bg2: '#2a1840', tile: '#3a2456', text: '#e4d4f4', title: '#a78bc4' },
      light: { bgMode: 'gradient', bg1: '#faf5ff', bg2: '#efe2fb', tile: '#e6d8f5', text: '#2a1840', title: '#9b7bb8' }
    },
    {
      name: 'Ocean',
      dark: { bgMode: 'gradient', bg1: '#0b1f2a', bg2: '#0f3040', tile: '#17414f', text: '#cfe8ef', title: '#7fb3c4' },
      light: { bgMode: 'gradient', bg1: '#f2fbff', bg2: '#dcf0f8', tile: '#cfe6f0', text: '#0b2b38', title: '#6f9db0' }
    },
    {
      name: 'Sand',
      dark: { bgMode: 'gradient', bg1: '#241f1a', bg2: '#332b22', tile: '#463a2d', text: '#ecdfcd', title: '#b39d81' },
      light: { bgMode: 'gradient', bg1: '#fdf8f0', bg2: '#f3e7d5', tile: '#ecdcc4', text: '#3a2f22', title: '#a8907a' }
    },
    {
      name: 'Mono',
      dark: { bgMode: 'solid', bg1: '#000000', bg2: '#111111', tile: '#1c1c1c', text: '#ffffff', title: '#666666' },
      light: { bgMode: 'solid', bg1: '#ffffff', bg2: '#f0f0f0', tile: '#ebebeb', text: '#000000', title: '#aaaaaa' }
    }
  ];

  /* ---------- state ------------------------------------------------------- */

  const state = {
    habitName: 'Post Reel',
    entries: {},
    statuses: H.defaultStatuses(),
    look: H.defaultLook(),
    theme: 'system',
    pinned: false,
    view: null
  };

  H.state = state;

  H.statusById = (id) => state.statuses.find((s) => s.id === id) || null;

  /** Hotkeys follow list order, so reordering statuses reassigns 1-9. */
  H.hotkeyFor = (index) => (index < 9 ? String(index + 1) : '');
  H.statusByHotkey = (key) => {
    const index = Number(key) - 1;
    return index >= 0 && index < 9 ? state.statuses[index] || null : null;
  };

  H.newStatusId = () =>
    `s${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;

  /* ---------- sanitising -------------------------------------------------- */

  const MAX_LABEL = 32;
  const MAX_BADGE = 3;

  /** Everything that reaches state goes through here. The data file is
   *  user-editable and may come from an older version, so nothing from it
   *  is trusted enough to render directly. */
  function cleanStatus(raw, seenIds) {
    if (!raw || typeof raw !== 'object') return null;
    const color = normHex(raw.color);
    if (!color) return null;

    let id = typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim().slice(0, 64) : null;
    if (!id || seenIds.has(id)) id = H.newStatusId();
    seenIds.add(id);

    const label = String(raw.label == null ? '' : raw.label)
      .replace(/\s+/g, ' ').trim().slice(0, MAX_LABEL) || 'Untitled';
    const badge = String(raw.badge == null ? '' : raw.badge)
      .replace(/\s+/g, '').slice(0, MAX_BADGE);
    const streak = H.STREAK_MODES.some((m) => m.id === raw.streak) ? raw.streak : 'counts';

    return { id, label, color, streak, badge };
  }

  H.cleanStatus = cleanStatus;

  function cleanLook(raw, fallback) {
    const base = { ...fallback };
    if (!raw || typeof raw !== 'object') return base;

    if (['solid', 'gradient', 'image'].includes(raw.bgMode)) base.bgMode = raw.bgMode;
    for (const field of ['bg1', 'bg2', 'tile', 'text', 'title']) {
      const hex = normHex(raw[field]);
      if (hex) base[field] = hex;
    }
    // Only data URLs — never a remote URL, which would make the widget
    // phone home every time it renders.
    if (typeof raw.bgImage === 'string' && raw.bgImage.startsWith('data:image/')) {
      base.bgImage = raw.bgImage;
    } else {
      base.bgImage = null;
    }
    if (Number.isFinite(raw.bgAlpha)) {
      base.bgAlpha = Math.min(1, Math.max(0.2, raw.bgAlpha));
    }
    if (Number.isFinite(raw.bgDim)) {
      base.bgDim = Math.min(0.9, Math.max(0, raw.bgDim));
    }
    if (Number.isFinite(raw.radius)) {
      base.radius = Math.round(Math.min(26, Math.max(0, raw.radius)));
    }
    return base;
  }

  /* ---------- persistence ------------------------------------------------- */

  let saveTimer = null;

  function snapshot() {
    return {
      version: SCHEMA_VERSION,
      habitName: state.habitName,
      entries: state.entries,
      statuses: state.statuses,
      look: state.look,
      theme: state.theme,
      pinned: state.pinned
    };
  }

  H.snapshot = snapshot;

  H.save = function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const data = snapshot();
      if (api) {
        api.save(data).catch((err) => console.error('save failed', err));
      } else {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (err) {
          // Quota is the realistic failure here: a large background image
          // in localStorage. Tell the user rather than failing silently.
          console.error('save failed', err);
          H.onSaveError && H.onSaveError(err);
        }
      }
    }, 200);
  };

  H.load = async function load() {
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
      state.habitName = data.habitName.replace(/\s+/g, ' ').trim().slice(0, 60);
    }

    // v1 files have no `statuses`; its five built-in ids match the defaults,
    // so old entries keep their colours with no conversion.
    if (Array.isArray(data.statuses) && data.statuses.length) {
      const seen = new Set();
      const cleaned = data.statuses
        .map((raw) => cleanStatus(raw, seen))
        .filter(Boolean)
        .slice(0, 24);
      if (cleaned.length) state.statuses = cleaned;
    }

    if (data.entries && typeof data.entries === 'object') {
      const valid = new Set(state.statuses.map((s) => s.id));
      for (const [key, value] of Object.entries(data.entries)) {
        // Drop days pointing at a status that no longer exists, so a
        // deleted status can never render as a blank coloured tile.
        if (/^\d{4}-\d{2}-\d{2}$/.test(key) && valid.has(value)) {
          state.entries[key] = value;
        }
      }
    }

    state.look = {
      dark: cleanLook(data.look && data.look.dark, DEFAULT_LOOK.dark),
      light: cleanLook(data.look && data.look.light, DEFAULT_LOOK.light)
    };

    if (['system', 'light', 'dark'].includes(data.theme)) state.theme = data.theme;
    state.pinned = data.pinned === true;
  };
})(window.HABIT);
