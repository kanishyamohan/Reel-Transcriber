'use strict';

/* ==========================================================================
   Reel Habit — the Customise panel.
   Two tabs: "Look" edits the palette for one theme at a time, "Options"
   is full CRUD over the dropdown statuses.
   ========================================================================== */

(function (H) {
  const state = H.state;
  const sheet = document.getElementById('sheet');
  const body = document.getElementById('sheet-body');
  const tabLook = document.getElementById('tab-look');
  const tabStatuses = document.getElementById('tab-statuses');
  const closeBtn = document.getElementById('sheet-close');

  let activeTab = 'look';
  // Which theme's palette the Look tab is editing. Kept in sync with what's
  // on screen — you can't judge a colour you can't see.
  let editingTheme = 'dark';

  const MAX_STATUSES = 24;
  const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
  const IMAGE_MAX_EDGE = 1600;

  /* ---------- small builders ---------------------------------------------- */

  function elem(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function field(labelText, control) {
    const row = elem('div', 'field');
    const label = elem('label', 'field-label', labelText);
    if (control.id) label.htmlFor = control.id;
    row.append(label, control);
    return row;
  }

  function section(title) {
    const wrap = elem('div', 'section');
    if (title) wrap.appendChild(elem('div', 'section-title', title));
    return wrap;
  }

  let uid = 0;
  const nextId = () => `f${(uid += 1)}`;

  function colorInput(value, onChange) {
    const input = document.createElement('input');
    input.type = 'color';
    input.className = 'color-input';
    input.id = nextId();
    input.value = H.normHex(value) || '#000000';
    input.addEventListener('input', () => onChange(input.value));
    return input;
  }

  function slider(value, min, max, step, onChange) {
    const input = document.createElement('input');
    input.type = 'range';
    input.className = 'slider';
    input.id = nextId();
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(value);
    input.addEventListener('input', () => onChange(Number(input.value)));
    return input;
  }

  function segmented(options, current, onChange) {
    const group = elem('div', 'segmented');
    group.setAttribute('role', 'radiogroup');
    for (const option of options) {
      const btn = elem('button', 'seg', option.label);
      btn.type = 'button';
      btn.setAttribute('role', 'radio');
      btn.setAttribute('aria-checked', String(option.id === current));
      btn.addEventListener('click', () => onChange(option.id));
      group.appendChild(btn);
    }
    return group;
  }

  /* ---------- live updates -------------------------------------------------- */

  /** Repaint everything the user could have just changed, then save.
   *  `rebuild` is opt-in because rebuilding while typing in a text field
   *  would steal focus mid-word. */
  function touch(rebuild) {
    H.applyAppearance();
    H.renderCalendar();
    H.save();
    if (rebuild) render();
  }

  /* ---------- Look tab ------------------------------------------------------- */

  function look() {
    return state.look[editingTheme];
  }

  /** Show the theme being edited, so every change is visible immediately. */
  function setEditingTheme(theme) {
    editingTheme = theme;
    state.theme = theme;
    H.applyAppearance();
    H.refreshThemeButton();
    H.renderCalendar();
    H.save();
    render();
  }

  function renderLookTab() {
    body.append(renderPresets(), renderThemePicker(), renderBackground(),
      renderTiles(), renderText(), renderLookReset());
  }

  function renderPresets() {
    const wrap = section('Presets');
    const row = elem('div', 'preset-row');

    for (const preset of H.PRESETS) {
      const btn = elem('button', 'preset');
      btn.type = 'button';
      btn.title = `Apply the ${preset.name} palette to both day and night`;

      const chip = elem('span', 'preset-chip');
      chip.style.background = H.backgroundValue({
        bgMode: preset[editingTheme].bgMode,
        bg1: preset[editingTheme].bg1,
        bg2: preset[editingTheme].bg2
      });
      const dot = elem('span', 'preset-dot');
      dot.style.background = preset[editingTheme].tile;
      chip.appendChild(dot);

      btn.append(chip, elem('span', 'preset-name', preset.name));
      btn.addEventListener('click', () => {
        // A preset sets both themes; image and opacity are the user's own
        // choices and deliberately survive.
        for (const theme of ['dark', 'light']) {
          Object.assign(state.look[theme], preset[theme]);
        }
        touch(true);
      });
      row.appendChild(btn);
    }

    wrap.appendChild(row);
    return wrap;
  }

  function renderThemePicker() {
    const wrap = section('Editing');
    wrap.appendChild(segmented(
      [{ id: 'light', label: '☀ Day' }, { id: 'dark', label: '☾ Night' }],
      editingTheme,
      setEditingTheme
    ));
    wrap.appendChild(elem('p', 'hint',
      'Day and night keep separate colours. Pick which one you are editing — the widget switches to it so you can see the change.'));
    return wrap;
  }

  function renderBackground() {
    const current = look();
    const wrap = section('Background');

    wrap.appendChild(segmented(
      [{ id: 'solid', label: 'Solid' }, { id: 'gradient', label: 'Gradient' }, { id: 'image', label: 'Image' }],
      current.bgMode,
      (mode) => { current.bgMode = mode; touch(true); }
    ));

    if (current.bgMode === 'image') {
      wrap.appendChild(renderImagePicker(current));
      wrap.appendChild(field('Wash colour',
        colorInput(current.bg1, (v) => { current.bg1 = v; touch(false); })));

      const dimValue = elem('span', 'slider-value', `${Math.round(current.bgDim * 100)}%`);
      const dimRow = elem('div', 'slider-row');
      dimRow.append(
        slider(current.bgDim, 0, 0.9, 0.01, (v) => {
          current.bgDim = v;
          dimValue.textContent = `${Math.round(v * 100)}%`;
          touch(false);
        }),
        dimValue
      );
      wrap.appendChild(field('Dim image', dimRow));
    } else {
      wrap.appendChild(field(current.bgMode === 'gradient' ? 'Top colour' : 'Colour',
        colorInput(current.bg1, (v) => { current.bg1 = v; touch(false); })));
      if (current.bgMode === 'gradient') {
        wrap.appendChild(field('Bottom colour',
          colorInput(current.bg2, (v) => { current.bg2 = v; touch(false); })));
      }
    }

    const value = elem('span', 'slider-value', `${Math.round(current.bgAlpha * 100)}%`);
    const control = elem('div', 'slider-row');
    control.append(
      slider(current.bgAlpha, 0.2, 1, 0.01, (v) => {
        current.bgAlpha = v;
        value.textContent = `${Math.round(v * 100)}%`;
        touch(false);
      }),
      value
    );
    wrap.appendChild(field('Opacity', control));
    wrap.appendChild(elem('p', 'hint', current.bgMode === 'image'
      ? 'Dim the image until the dates read clearly. Opacity lets your wallpaper show through; text always stays fully opaque.'
      : 'Lower the opacity to let your wallpaper show through. Text stays fully opaque.'));

    return wrap;
  }

  function renderImagePicker(current) {
    const row = elem('div', 'image-row');

    const picker = document.createElement('input');
    picker.type = 'file';
    picker.accept = 'image/*';
    picker.hidden = true;
    picker.addEventListener('change', () => {
      const file = picker.files && picker.files[0];
      picker.value = '';
      if (file) loadImage(file, current);
    });

    const choose = elem('button', 'btn', current.bgImage ? 'Replace image…' : 'Choose image…');
    choose.type = 'button';
    choose.addEventListener('click', () => picker.click());
    row.append(choose, picker);

    if (current.bgImage) {
      const preview = elem('span', 'image-preview');
      preview.style.backgroundImage = `url("${current.bgImage}")`;
      row.appendChild(preview);

      const remove = elem('button', 'btn subtle', 'Remove');
      remove.type = 'button';
      remove.addEventListener('click', () => {
        current.bgImage = null;
        touch(true);
      });
      row.appendChild(remove);
    }
    return row;
  }

  /** Downscale and re-encode before storing. A phone screenshot is several
   *  megabytes of base64 otherwise, which is slow to save and can blow the
   *  localStorage quota in standalone mode. */
  function loadImage(file, current) {
    const reader = new FileReader();
    reader.onerror = () => H.toast('Couldn’t read that image.');
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => H.toast('That file isn’t an image the widget can read.');
      img.onload = () => {
        const scale = Math.min(1, IMAGE_MAX_EDGE / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));

        const ctx = canvas.getContext('2d');
        // Flatten onto the base colour: JPEG has no alpha, so a transparent
        // PNG would otherwise come back with a black background.
        ctx.fillStyle = current.bg1;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        if (dataUrl.length > MAX_IMAGE_BYTES) {
          H.toast('That image is too large even after resizing — try a smaller one.');
          return;
        }
        current.bgImage = dataUrl;
        current.bgMode = 'image';
        touch(true);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  function renderTiles() {
    const current = look();
    const wrap = section('Tiles');

    wrap.appendChild(field('Empty day colour',
      colorInput(current.tile, (v) => { current.tile = v; touch(false); })));

    const value = elem('span', 'slider-value', `${current.radius}px`);
    const control = elem('div', 'slider-row');
    control.append(
      slider(current.radius, 0, 26, 1, (v) => {
        current.radius = v;
        value.textContent = `${v}px`;
        touch(false);
      }),
      value
    );
    wrap.appendChild(field('Corner radius', control));
    wrap.appendChild(elem('p', 'hint',
      'Colours for marked days live on each option in the Options tab.'));
    return wrap;
  }

  function renderText() {
    const current = look();
    const wrap = section('Text');
    wrap.appendChild(field('Body text',
      colorInput(current.text, (v) => { current.text = v; touch(false); })));
    wrap.appendChild(field('Month name',
      colorInput(current.title, (v) => { current.title = v; touch(false); })));
    return wrap;
  }

  function renderLookReset() {
    const wrap = section('');
    // Resets the whole look block for this theme — opacity and radius
    // included — so it is deliberately not called "colours".
    const btn = elem('button', 'btn subtle wide',
      `Reset ${editingTheme === 'dark' ? 'night' : 'day'} appearance`);
    btn.type = 'button';
    btn.addEventListener('click', () => {
      state.look[editingTheme] = { ...H.DEFAULT_LOOK[editingTheme] };
      touch(true);
    });
    wrap.appendChild(btn);
    return wrap;
  }

  /* ---------- Options tab (status CRUD) --------------------------------------- */

  function renderStatusesTab() {
    const wrap = section('Dropdown options');
    wrap.appendChild(elem('p', 'hint',
      'These are the choices you get when you click a day. Number keys 1-9 apply them in this order.'));

    const list = elem('div', 'status-list');
    if (!state.statuses.length) {
      list.appendChild(elem('p', 'empty', 'No options yet. Add one below.'));
    }
    state.statuses.forEach((status, index) => list.appendChild(statusRow(status, index)));
    wrap.appendChild(list);

    const add = elem('button', 'btn wide', '+  Add option');
    add.type = 'button';
    add.disabled = state.statuses.length >= MAX_STATUSES;
    if (add.disabled) add.title = `${MAX_STATUSES} options is the maximum`;
    add.addEventListener('click', addStatus);
    wrap.appendChild(add);

    const reset = elem('button', 'btn subtle wide', 'Reset options to defaults');
    reset.type = 'button';
    reset.addEventListener('click', resetStatuses);
    wrap.appendChild(reset);

    body.appendChild(wrap);
  }

  function statusRow(status, index) {
    const row = elem('div', 'status-row');

    const top = elem('div', 'status-top');
    top.appendChild(colorInput(status.color, (v) => {
      status.color = v;
      touch(false);
    }));

    const label = document.createElement('input');
    label.type = 'text';
    label.className = 'text-input';
    label.value = status.label;
    label.maxLength = 32;
    label.setAttribute('aria-label', 'Option name');
    label.placeholder = 'Name';
    label.addEventListener('input', () => {
      // Keep the stored label sane, but don't rewrite the field while the
      // user is mid-word — the blur handler tidies it up.
      status.label = label.value.slice(0, 32);
      touch(false);
    });
    label.addEventListener('blur', () => {
      status.label = label.value.replace(/\s+/g, ' ').trim().slice(0, 32) || 'Untitled';
      label.value = status.label;
      touch(false);
    });
    top.appendChild(label);

    const tools = elem('div', 'row-tools');
    tools.append(
      moveButton('up', 'Move up', index > 0, () => moveStatus(index, -1)),
      moveButton('down', 'Move down', index < state.statuses.length - 1, () => moveStatus(index, 1))
    );

    const del = elem('button', 'row-btn danger');
    del.innerHTML = '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M4 4l6 6M10 4l-6 6" '
      + 'fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
    del.type = 'button';
    del.title = 'Delete option';
    del.setAttribute('aria-label', `Delete ${status.label}`);
    del.addEventListener('click', () => deleteStatus(index));
    tools.appendChild(del);
    top.appendChild(tools);
    row.appendChild(top);

    const bottom = elem('div', 'status-bottom');

    const badge = document.createElement('input');
    badge.type = 'text';
    badge.className = 'text-input badge-input';
    badge.value = status.badge;
    badge.maxLength = 3;
    badge.placeholder = 'Tag';
    badge.title = 'Up to 3 characters shown in the tile corner';
    badge.setAttribute('aria-label', 'Corner tag');
    badge.addEventListener('input', () => {
      status.badge = badge.value.replace(/\s+/g, '').slice(0, 3);
      touch(false);
    });
    bottom.appendChild(badge);

    const select = document.createElement('select');
    select.className = 'select';
    select.setAttribute('aria-label', 'Streak behaviour');
    for (const mode of H.STREAK_MODES) {
      const option = document.createElement('option');
      option.value = mode.id;
      option.textContent = mode.label;
      if (mode.id === status.streak) option.selected = true;
      select.appendChild(option);
    }
    select.addEventListener('change', () => {
      status.streak = select.value;
      touch(false);
    });
    bottom.appendChild(select);

    const hotkey = H.hotkeyFor(index);
    bottom.appendChild(elem('span', 'row-key', hotkey ? `key ${hotkey}` : ''));

    row.appendChild(bottom);
    return row;
  }

  const ARROWS = {
    up: 'M3 8.5 7 4.5l4 4',
    down: 'M3 5.5 7 9.5l4-4'
  };

  function moveButton(direction, title, enabled, onClick) {
    // Drawn rather than typed: the ↑ / ↓ characters get picked up by the
    // emoji font on macOS and come out orange.
    const btn = elem('button', 'row-btn');
    btn.innerHTML = `<svg viewBox="0 0 14 14" aria-hidden="true"><path d="${ARROWS[direction]}" `
      + 'fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    btn.type = 'button';
    btn.title = title;
    btn.setAttribute('aria-label', title);
    btn.disabled = !enabled;
    btn.addEventListener('click', onClick);
    return btn;
  }

  function moveStatus(index, delta) {
    const target = index + delta;
    if (target < 0 || target >= state.statuses.length) return;
    const [moved] = state.statuses.splice(index, 1);
    state.statuses.splice(target, 0, moved);
    touch(true);
  }

  function addStatus() {
    if (state.statuses.length >= MAX_STATUSES) return;
    state.statuses.push({
      id: H.newStatusId(),
      label: 'New option',
      color: suggestColor(),
      streak: 'counts',
      badge: ''
    });
    touch(true);

    // Drop the caret straight into the new name so it can be typed over.
    const inputs = body.querySelectorAll('.status-row .text-input');
    const last = inputs[Math.max(0, (state.statuses.length - 1) * 2)];
    if (last) {
      last.focus();
      last.select();
    }
  }

  /** A colour that isn't already in the list, so a new option is visibly
   *  distinct without the user having to open the picker first. */
  function suggestColor() {
    const palette = ['#c8f7a0', '#9be86f', '#5fc93a', '#ef9a9a', '#a9c6ea',
      '#f6c667', '#d7a8f0', '#7ad9c8', '#f09a5c', '#b0b6bd'];
    const used = new Set(state.statuses.map((s) => s.color));
    return palette.find((c) => !used.has(c)) || palette[state.statuses.length % palette.length];
  }

  function deleteStatus(index) {
    const status = state.statuses[index];
    if (!status) return;

    const used = Object.values(state.entries).filter((id) => id === status.id).length;
    const warning = used
      ? `Delete "${status.label}"?\n\n${used} ${used === 1 ? 'day is' : 'days are'} marked with it — ${used === 1 ? 'it' : 'they'} will be cleared.`
      : `Delete "${status.label}"?`;
    if (!window.confirm(warning)) return;

    state.statuses.splice(index, 1);
    if (used) {
      for (const [key, id] of Object.entries(state.entries)) {
        if (id === status.id) delete state.entries[key];
      }
    }
    touch(true);
  }

  function resetStatuses() {
    const custom = state.statuses.some((s) => !H.DEFAULT_STATUSES.some((d) => d.id === s.id));
    const message = custom
      ? 'Reset to the five default options? Days marked with an option you added will be cleared.'
      : 'Reset the five default options to their original names and colours?';
    if (!window.confirm(message)) return;

    state.statuses = H.defaultStatuses();
    const valid = new Set(state.statuses.map((s) => s.id));
    for (const [key, id] of Object.entries(state.entries)) {
      if (!valid.has(id)) delete state.entries[key];
    }
    touch(true);
  }

  /* ---------- panel shell ------------------------------------------------------ */

  function render() {
    body.innerHTML = '';
    tabLook.setAttribute('aria-selected', String(activeTab === 'look'));
    tabStatuses.setAttribute('aria-selected', String(activeTab === 'statuses'));
    if (activeTab === 'look') renderLookTab();
    else renderStatusesTab();
  }

  H.settingsOpen = () => !sheet.hidden;

  H.openSettings = function openSettings(tab) {
    activeTab = tab === 'statuses' ? 'statuses' : 'look';
    // Always start on the palette that's actually showing.
    editingTheme = H.resolvedTheme();
    sheet.hidden = false;
    render();
    body.scrollTop = 0;
    closeBtn.focus({ preventScroll: true });
  };

  H.closeSettings = function closeSettings() {
    sheet.hidden = true;
    H.el.settingsBtn.focus({ preventScroll: true });
  };

  H.toggleSettings = function toggleSettings() {
    if (H.settingsOpen()) H.closeSettings();
    else H.openSettings(activeTab);
  };

  // Keep the panel honest if the palette changes underneath it (system
  // appearance flip, or the ☾ button).
  H.onAppearanceChanged = () => {
    if (!H.settingsOpen() || activeTab !== 'look') return;
    editingTheme = H.resolvedTheme();
    render();
  };

  tabLook.addEventListener('click', () => { activeTab = 'look'; render(); });
  tabStatuses.addEventListener('click', () => { activeTab = 'statuses'; render(); });
  closeBtn.addEventListener('click', () => H.closeSettings());

  /* ---------- go ---------------------------------------------------------------- */

  H.boot();
})(window.HABIT);
