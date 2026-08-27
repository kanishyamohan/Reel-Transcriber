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
| Keep above other windows | 📌 button |
| Move / resize | Drag the month title; drag the corner grip |
| Clear a month, reset, quit | **⋯** menu |

The buttons only fade in when your pointer is over the widget, so it sits
quietly on the desktop the rest of the time.

## Statuses

| Status | Colour | Counts toward streak |
| --- | --- | --- |
| Done | light lime | yes |
| Posted 2 | mid green | yes |
| Posted 3+ | deep green | yes |
| Not done | muted red | no — breaks the streak |
| Rest day | slate blue | no — but doesn't break it |

## Where your data lives

`~/Library/Application Support/Reel Habit/habit-data.json` — plain JSON, one
key per day, safe to back up, copy between machines, or edit by hand.

Writes go to a temp file and are renamed into place, so a crash mid-save can't
truncate your history.

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
    ├── style.css      Design tokens; day/night is one attribute swap
    └── app.js         Calendar, statuses, streaks, menus, keyboard
```

## Requirements

macOS with Node 18+. Everything else comes from `npm install`.
