# 🎬 Reel Transcriber & Translator

Paste an Instagram reel link, get its thumbnail, a written transcript, and an
optional translation — each copyable with one click. Hit **Start over** to do
another.

## How it works

1. You paste a reel URL and optionally pick a **Translate to** language.
2. The backend uses [`yt-dlp`](https://github.com/yt-dlp/yt-dlp) to grab the
   reel's thumbnail and download its audio.
3. The audio is transcribed with Whisper:
   - **OpenAI Whisper API** if `OPENAI_API_KEY` is set (fast, no local model), or
   - a **local `faster-whisper`** model as an offline fallback.
4. If a target language is chosen, the transcript is translated:
   - via the **OpenAI API** (any supported language) when `OPENAI_API_KEY` is
     set, or
   - via Whisper's built-in **English** translation offline (other languages
     require an API key).
5. The UI shows the thumbnail, transcript, and translation, each with its own
   **Copy** button, plus a **Start over** button.

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

python app.py
```

Then open http://localhost:5000.

## Notes

- Only public reels can be fetched. Private/age-restricted content may fail.
- Instagram occasionally changes its layout; keep `yt-dlp` up to date
  (`pip install -U yt-dlp`) if downloads start failing.
- The downloaded audio is written to a temporary directory and deleted after
  each request.
