/**
 * Calendar Palette
 *
 * Applies a fixed set of named calendars + colours to the signed-in user's
 * Google Calendar in one click.
 *
 * ---------------------------------------------------------------------------
 * EDIT YOUR COLOURS HERE
 * ---------------------------------------------------------------------------
 * Each entry needs two things:
 *   name -> the calendar name, exactly as it should appear in Google Calendar
 *   hex  -> the colour, as a 6-digit hex code starting with "#"
 *
 * You can add rows, delete rows, or change names and colours freely.
 * Keep the format the same: { name: "...", hex: "#RRGGBB" },
 * ---------------------------------------------------------------------------
 */
const PALETTE = [
  { name: 'Work',     hex: '#1E3A8A' },
  { name: 'Personal', hex: '#DB2777' },
  { name: 'Health',   hex: '#059669' },
  { name: 'Learning', hex: '#D97706' }
];

/** Text colour drawn on top of the palette colours. */
const FOREGROUND_COLOR = '#ffffff';

/**
 * Serves the web page when someone opens the web app URL.
 */
function doGet() {
  // createTemplateFromFile (not createHtmlOutputFromFile) so index.html can
  // read PALETTE and draw one swatch per entry.
  const template = HtmlService.createTemplateFromFile('index');
  template.PALETTE = PALETTE;
  return template.evaluate()
    .setTitle('Calendar Palette')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Called from the page when the user clicks "Apply palette".
 *
 * For each palette entry: find a calendar with that name, create it if it is
 * missing, then set its colour. Returns a summary object the page can render.
 */
function applyPalette() {
  try {
    const created = [];
    const recoloured = [];
    const failed = [];

    PALETTE.forEach(function (entry) {
      try {
        if (!entry || !entry.name || !entry.hex) {
          throw new Error('Palette entry is missing a name or hex value.');
        }
        if (!/^#[0-9a-fA-F]{6}$/.test(entry.hex)) {
          throw new Error('"' + entry.hex + '" is not a 6-digit hex colour like #1E3A8A.');
        }

        // Look for an existing calendar with this exact name.
        let calendar = CalendarApp.getCalendarsByName(entry.name)[0];
        let wasCreated = false;

        if (!calendar) {
          calendar = CalendarApp.createCalendar(entry.name);
          wasCreated = true;
        }

        setCalendarColor_(calendar.getId(), entry.hex);

        if (wasCreated) {
          created.push(entry.name);
        } else {
          recoloured.push(entry.name);
        }
      } catch (entryError) {
        failed.push({ name: entry && entry.name ? entry.name : '(unnamed)', error: String(entryError && entryError.message || entryError) });
      }
    });

    return {
      ok: failed.length === 0,
      created: created,
      recoloured: recoloured,
      failed: failed,
      message: buildSummary_(created, recoloured, failed)
    };
  } catch (err) {
    // Anything unexpected comes back as plain text rather than a silent failure.
    return {
      ok: false,
      created: [],
      recoloured: [],
      failed: [],
      message: 'Something went wrong: ' + String(err && err.message || err)
    };
  }
}

/**
 * Sets the background/foreground colour of one calendar.
 *
 * A calendar created a moment ago can take a second to show up in the
 * calendar list, so retry a couple of times before giving up.
 */
function setCalendarColor_(calendarId, hex) {
  const resource = { backgroundColor: hex, foregroundColor: FOREGROUND_COLOR };
  const options = { colorRgbFormat: true };
  let lastError;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      Calendar.CalendarList.patch(resource, calendarId, options);
      return;
    } catch (err) {
      lastError = err;
      Utilities.sleep(1000);
    }
  }
  throw lastError;
}

/** Turns the result lists into one readable sentence. */
function buildSummary_(created, recoloured, failed) {
  const parts = [];

  if (created.length) {
    parts.push('Created ' + created.length + ' new calendar' + (created.length === 1 ? '' : 's') + ': ' + created.join(', ') + '.');
  }
  if (recoloured.length) {
    parts.push('Recoloured ' + recoloured.length + ' existing calendar' + (recoloured.length === 1 ? '' : 's') + ': ' + recoloured.join(', ') + '.');
  }
  if (failed.length) {
    parts.push('Could not update ' + failed.length + ': ' + failed.map(function (f) {
      return f.name + ' (' + f.error + ')';
    }).join('; ') + '.');
  }
  if (!parts.length) {
    parts.push('Your palette is empty, so there was nothing to apply.');
  }

  return parts.join(' ');
}
