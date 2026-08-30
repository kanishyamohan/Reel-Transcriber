'use strict';

/* ==========================================================================
   Reel Habit — turns the user's `look` settings into CSS custom properties.
   Every colour in the stylesheet resolves through here, so a change is one
   call to applyAppearance() rather than a re-render.
   ========================================================================== */

(function (H) {
  const root = document.documentElement;
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)');

  H.systemDark = systemDark;

  /** Which palette is actually on screen: 'system' resolves to the OS setting. */
  H.resolvedTheme = function resolvedTheme() {
    if (H.state.theme === 'system') return systemDark.matches ? 'dark' : 'light';
    return H.state.theme;
  };

  H.currentLook = function currentLook() {
    return H.state.look[H.resolvedTheme()];
  };

  /** CSS background shorthand for the chosen mode. Image mode keeps the
   *  solid colour as a bottom layer so a transparent PNG still has ground
   *  under it, and so the widget isn't blank while a huge data URL decodes. */
  function backgroundValue(look) {
    if (look.bgMode === 'image' && look.bgImage) {
      // A wash of the base colour over the photo. Without it, text and
      // empty tiles disappear into any busy image.
      const dim = H.rgba(look.bg1, look.bgDim);
      return `linear-gradient(${dim}, ${dim}), `
        + `url("${look.bgImage}") center / cover no-repeat, ${look.bg1}`;
    }
    if (look.bgMode === 'gradient') {
      return `linear-gradient(160deg, ${look.bg1} 0%, ${look.bg2} 100%)`;
    }
    return look.bg1;
  }

  H.backgroundValue = backgroundValue;

  /** Keep `color` usable as text on `bg`: if it's too close, walk it toward
   *  the opposite end until it clears a readable ratio. Stops the streak
   *  text from vanishing when someone picks a pale green on a pale page. */
  function readableOn(color, bg) {
    // Darken the accent on a light background, lighten it on a dark one.
    const target = H.luminance(bg) > 0.5 ? '#000000' : '#ffffff';
    let out = color;
    for (let step = 1; step <= 6 && H.contrastRatio(out, bg) < 3.2; step += 1) {
      out = H.mix(color, target, step * 0.14);
    }
    return out;
  }

  H.applyAppearance = function applyAppearance() {
    const theme = H.resolvedTheme();
    const look = H.state.look[theme];
    const style = root.style;

    root.setAttribute('data-theme', theme);

    style.setProperty('--bg', look.bg1);
    style.setProperty('--surface', look.tile);
    style.setProperty('--surface-hover', H.shift(look.tile, 0.14));
    style.setProperty('--outline', H.shift(look.bg1, 0.1));
    style.setProperty('--sheet', H.shift(look.bg1, 0.07));
    style.setProperty('--text', look.text);
    style.setProperty('--muted', H.rgba(look.text, 0.55));
    style.setProperty('--faint', H.rgba(look.text, 0.12));
    style.setProperty('--title', look.title);
    style.setProperty('--ring', look.text);
    style.setProperty('--tile-radius', `${look.radius}px`);
    style.setProperty('--bg-alpha', String(look.bgAlpha));

    // The streak accent borrows the first streak-counting status colour, so
    // recolouring "Done" recolours the footer with it.
    const lead = H.state.statuses.find((s) => s.streak === 'counts') || H.state.statuses[0];
    style.setProperty('--streak', lead ? readableOn(lead.color, look.bg1) : look.text);

    const layer = document.getElementById('widget-bg');
    if (layer) layer.style.background = backgroundValue(look);
  };

  systemDark.addEventListener('change', () => {
    if (H.state.theme === 'system') {
      H.applyAppearance();
      H.onThemeChange && H.onThemeChange();
    }
  });
})(window.HABIT);
