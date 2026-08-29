# 🎬 Reel Transcriber & Translator

Paste an Instagram reel link, get its thumbnail, a written transcript, and an
optional translation — ready to **copy** or **share**. Hit **New transcript**
to run another one, or switch to the **Bulk** tab to transcribe a whole list of
reels in one go.

## Two flows

### One reel

1. Paste a reel URL and optionally pick a **Translate to** language.
2. You get the thumbnail, transcript, and translation, each with its own
   **Copy** and **Share** button.
3. **New transcript** clears everything and puts you back on the input.

### Bulk

1. Switch to the **Bulk** tab and paste your links — one per line (commas and
   spaces work too). Duplicates are dropped and the link count updates as you
   type. Up to `MAX_BULK_URLS` (25 by default) per batch.
2. Press **Transcribe all**. Reels are processed one at a time with a progress
   bar, and each card fills in as its transcript lands, so you can start
   reading before the batch finishes. **Stop** ends the run after the reel
   currently in flight; the rest are marked skipped.
3. A reel that fails (private, removed, bad link) is marked failed with the
   reason and the batch keeps going.
4. When it's done you get **Copy all**, **Download** (a `.txt` of every
   transcript), and **Share all**, plus per-reel **Copy** / **Share** buttons —
   and **New batch** to start over.

Share uses the browser's native share sheet where it exists (mobile, Safari);
elsewhere it falls back to copying the text to your clipboard and says so.

## How it works

1. The backend uses [`yt-dlp`](https://github.com/yt-dlp/yt-dlp) to grab the
   reel's thumbnail and download its audio.
2. The audio is transcribed with Whisper:
   - **OpenAI Whisper API** if `OPENAI_API_KEY` is set (fast, no local model), or
   - a **local `faster-whisper`** model as an offline fallback.
3. If a target language is chosen, the transcript is translated:
   - via the **OpenAI API** (any supported language) when `OPENAI_API_KEY` is
     set, or
   - via Whisper's built-in **English** translation offline (other languages
     require an API key).

## Requirements

- Python 3.9+
- [`ffmpeg`](https://ffmpeg.org/) installed and on your `PATH` (needed by
  `yt-dlp` to extract audio).

## Setup

```bash
pip install -r requirements.txt

# Optional: use the OpenAI Whisper API instead of the local model
export OPENAI_API_KEY=sk-...

# Optional: pick a local model size (tiny / base / small / medium / large)
export WHISPER_MODEL=base

# Optional: raise/lower the bulk batch limit (default 25)
export MAX_BULK_URLS=25

python app.py
```

Then open http://localhost:5000.

## API

Both flows are available directly if you'd rather script them.

```bash
# One reel
curl -X POST localhost:5000/api/transcribe \
  -H 'Content-Type: application/json' \
  -d '{"url": "https://www.instagram.com/reel/XXXX", "target_language": "Hindi"}'

# A batch — "urls" takes a list or a pasted blob of links
curl -X POST localhost:5000/api/transcribe/bulk \
  -H 'Content-Type: application/json' \
  -d '{"urls": ["https://www.instagram.com/reel/AAA", "https://www.instagram.com/reel/BBB"]}'
```

The bulk response reports each reel separately, so one bad link never fails the
whole batch:

```json
{
  "count": 2,
  "succeeded": 1,
  "failed": 1,
  "results": [
    { "url": "...AAA", "ok": true, "transcript": "...", "title": "...", "thumbnail": "..." },
    { "url": "...BBB", "ok": false, "error": "Video unavailable" }
  ]
}
```

The web UI's bulk tab calls `/api/transcribe` once per reel instead, which is
what lets it show live per-reel progress.

## Notes

- Only public reels can be fetched. Private/age-restricted content may fail.
- Instagram occasionally changes its layout; keep `yt-dlp` up to date
  (`pip install -U yt-dlp`) if downloads start failing.
- The downloaded audio is written to a temporary directory and deleted after
  each reel.
- Bulk runs are sequential on purpose: each reel means a download plus a
  transcription, and firing them all at once tends to get rate-limited.
