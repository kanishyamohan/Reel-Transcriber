# 🟩 Reel Habit — macOS desktop habit tracker widget

A calendar habit tracker that lives on your desktop. Click any day, pick
**Done / Posted 2 / Posted 3+ / Not done / Rest day** from the dropdown, and
watch the month fill in. Day and night mode included.

<!-- Screenshots: run it and grab your own — the look matches the reference
     design: giant month name, rounded date tiles, lime green for done days. -->

## What it does

- **A real calendar** — correct weekday alignment, leap years, and every month
  navigable with `‹` / `›`. **Today** is a page click away.
- **Click a day → dropdown.** Five statuses, each its own colour. `Posted 2`
  and `Posted 3+` get a small corner badge.
- **Streaks.** Current streak, best streak, and this month's posted/missed
  tally along the bottom. Rest days keep a streak alive without adding to it;
  today not being logged yet never breaks it.
- **Day / night mode.** The ☾ button cycles **Auto → Day → Night**. Auto
  follows your macOS appearance and switches live.
- **Make it yours.** The ⚙ button opens Customise: background colour,
  gradient or your own image, tile colours, corner radius, opacity — set
  separately for day and night. Six presets if you'd rather not fiddle.
- **Your own dropdown options.** Add, rename, recolour, reorder and delete
  the choices you get when you click a day. Nothing is hardcoded.
- **Rename the habit.** Click "Post Reel" and type over it.
- **Frameless and transparent**, visible on every Space, draggable from the
  month title, resizable from the bottom-right grip.

## Run it

```bash
cd habit-widget
npm install
npm start
```

That's it — a rounded, chrome-less widget appears. Drag it wherever you want
it on your desktop; it remembers the position.

### Make it permanent

Hover the widget, click **⋯ → Open at login**. It'll come back every time you
log in, on whichever Space you're on.

To get a real double-clickable `.app` in `/Applications` instead of running
`npm start`:

```bash
npm run build          # writes dist/Reel Habit-1.0.0.dmg
```

The build is unsigned, so the first launch needs **right-click → Open** (or
System Settings → Privacy & Security → *Open Anyway*).

## Using it

| Action | How |
| --- | --- |
| Set a day's status | Click the tile, pick from the dropdown |
| Mark done fast | **Right-click** a tile (right-click again to clear) |
| Keyboard | Arrow keys move, `Enter` opens the menu, `1`–`5` set a status directly, `⌫` clears |
| Change month | `‹` `›`, or **Today** to jump back |
| Day / night | ☾ button — cycles Auto → Day → Night |
| Customise colours & options | ⚙ button (or **⋯ → Customise**) |
| Keep above other windows | 📌 button |
| Move / resize | Drag the month title; drag the corner grip |
| Clear a month, reset, quit | **⋯** menu |

Close the Customise panel with **✕** or `Esc`.

The buttons only fade in when your pointer is over the widget, so it sits
quietly on the desktop the rest of the time.

## Customising

### Look

Everything here is **per theme** — day and night keep separate palettes, since
a background that works on one rarely works on the other. The panel switches
the widget to whichever one you're editing so you can see what you're doing.

| Setting | Notes |
| --- | --- |
| Background | Solid, two-colour gradient, or an image from your Mac |
| Dim image | Only for image backgrounds — darkens the photo until the dates read clearly |
| Opacity | Drops the background alone, so your wallpaper shows through. Text stays fully opaque |
| Empty day colour | The tile for a day you haven't marked |
| Corner radius | 0px for squares, 26px for pills |
| Body text / Month name | Text colours |
| Presets | Midnight, Ink, Plum, Ocean, Sand, Mono — each sets both day and night at once |

Background images are downscaled to 1600px and re-encoded before being saved,
so a phone screenshot doesn't bloat your data file.

**Reset _night_/_day_ appearance** restores that one theme's defaults and
leaves the other alone.

### Options

The dropdown options are yours to define — the five below are just what ships:

| Option | Colour | Streak behaviour |
| --- | --- | --- |
| Done | light lime | Counts |
| Posted 2 | mid green | Counts |
| Posted 3+ | deep green | Counts |
| Not done | soft red | Breaks the streak |
| Rest day | pale blue | Skipped — keeps the streak |

For each option you control:

- **Colour** — fills the tile. The date's text colour is picked automatically
  for contrast, so you can't land on an unreadable combination.
- **Name** — what shows in the dropdown.
- **Tag** — up to 3 characters in the tile's corner (that's the small `2` and
  `3` on the defaults). Leave it blank for none.
- **Streak behaviour** — *Counts* / *Breaks the streak* / *Skipped*.
- **Order** — the ↑ ↓ buttons. Number keys `1`–`9` follow this order, so the
  option at the top is always key `1`.

Deleting an option that days are marked with tells you how many and clears
them. Up to 24 options.

## Where your data lives

`~/Library/Application Support/Reel Habit/habit-data.json` — plain JSON holding
your days, your options, and your palettes. Safe to back up, copy between
machines, or edit by hand.

Writes go to a temp file and are renamed into place, so a crash mid-save can't
truncate your history. Everything read back out is validated — a malformed
colour, an unknown option, or a day pointing at an option you deleted is
dropped rather than rendered, so a hand-edited file can't break the widget.

## Use it without Electron

`renderer/index.html` is a standalone app with no dependencies. Double-click it
and it runs in any browser, saving to `localStorage` instead of the JSON file.
Handy for a quick look, or if you'd rather pin it as a Safari/Chrome tab than
install anything. The window-specific controls (pin, resize, quit) hide
themselves in that mode.

## Files

```
habit-widget/
├── main.js            Electron main process — window, JSON storage, IPC
├── preload.js         The narrow bridge exposed to the page
├── package.json
└── renderer/
    ├── index.html     Widget markup
    ├── style.css      Every colour is a custom property, written at runtime
    ├── store.js       Data model, validation, persistence, colour maths
    ├── appearance.js  Turns saved settings into CSS custom properties
    ├── app.js         Calendar, streaks, menus, keyboard
    └── settings.js    The Customise panel
```

The renderer files are classic scripts sharing a `window.HABIT` namespace
rather than ES modules, because modules are blocked over `file://` and
`index.html` has to keep working when opened straight from Finder.

## Requirements

macOS with Node 18+. Everything else comes from `npm install`.
