"""Reel Transcriber — Flask backend.

Flow:
  1. User pastes an Instagram reel link.
  2. We use yt-dlp to grab the reel's thumbnail and download its audio.
  3. We transcribe the audio to text (OpenAI Whisper API if OPENAI_API_KEY is
     set, otherwise a local faster-whisper model).
  4. The frontend shows the thumbnail + transcript, with copy / restart buttons.
"""

import os
import re
import tempfile

from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

# Whisper model size used for the local fallback. "base" is a good speed/quality
# tradeoff; override with WHISPER_MODEL if you want something bigger/smaller.
LOCAL_WHISPER_MODEL = os.environ.get("WHISPER_MODEL", "base")

# Lazily-initialised local model so startup stays fast and we only pay the load
# cost when we actually need the offline fallback.
_local_model = None

INSTAGRAM_URL_RE = re.compile(
    r"https?://(www\.)?instagram\.com/(reel|reels|p|tv)/[\w\-]+",
    re.IGNORECASE,
)

# Languages offered in the UI's "Translate to" dropdown. The empty value means
# "no translation — original transcript only".
SUPPORTED_LANGUAGES = {
    "": "Original (no translation)",
    "English": "English",
    "Spanish": "Spanish",
    "Hindi": "Hindi",
    "French": "French",
    "German": "German",
    "Portuguese": "Portuguese",
    "Italian": "Italian",
    "Arabic": "Arabic",
    "Russian": "Russian",
    "Japanese": "Japanese",
    "Chinese": "Chinese",
}


def is_valid_instagram_url(url: str) -> bool:
    return bool(url) and bool(INSTAGRAM_URL_RE.match(url.strip()))


def fetch_reel(url: str, workdir: str):
    """Download the reel's audio and return (audio_path, thumbnail_url, title)."""
    import yt_dlp

    ydl_opts = {
        "format": "bestaudio/best",
        "outtmpl": os.path.join(workdir, "reel.%(ext)s"),
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        # Extract audio to a wav file Whisper can read directly.
        "postprocessors": [
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": "wav",
            }
        ],
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=True)

    thumbnail_url = info.get("thumbnail")
    title = info.get("title") or info.get("description") or "Instagram Reel"

    audio_path = os.path.join(workdir, "reel.wav")
    if not os.path.exists(audio_path):
        # Fall back to whatever audio file yt-dlp produced.
        candidates = [
            os.path.join(workdir, f)
            for f in os.listdir(workdir)
            if f.startswith("reel.")
        ]
        audio_path = candidates[0] if candidates else None

    return audio_path, thumbnail_url, title


def transcribe_with_openai(audio_path: str) -> str:
    from openai import OpenAI

    client = OpenAI()
    with open(audio_path, "rb") as f:
        result = client.audio.transcriptions.create(
            model="whisper-1",
            file=f,
        )
    return result.text.strip()


def transcribe_locally(audio_path: str, task: str = "transcribe") -> str:
    global _local_model
    from faster_whisper import WhisperModel

    if _local_model is None:
        _local_model = WhisperModel(LOCAL_WHISPER_MODEL, compute_type="int8")

    segments, _ = _local_model.transcribe(audio_path, task=task)
    return " ".join(seg.text.strip() for seg in segments).strip()


def transcribe(audio_path: str) -> str:
    if os.environ.get("OPENAI_API_KEY"):
        return transcribe_with_openai(audio_path)
    return transcribe_locally(audio_path)


def translate_with_openai(text: str, target_language: str) -> str:
    from openai import OpenAI

    client = OpenAI()
    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a translator. Translate the user's text into "
                    f"{target_language}. Return only the translation, with no "
                    "preamble, notes, or quotation marks."
                ),
            },
            {"role": "user", "content": text},
        ],
        temperature=0,
    )
    return resp.choices[0].message.content.strip()


def translate_to_english_locally(audio_path: str) -> str:
    """Whisper's local 'translate' task only ever targets English."""
    return transcribe_locally(audio_path, task="translate")


def translate(text: str, target_language: str, audio_path: str):
    """Return (translation, note). note is set when we can't fully comply."""
    if not target_language:
        return None, None

    if os.environ.get("OPENAI_API_KEY"):
        return translate_with_openai(text, target_language), None

    # Local fallback: Whisper can only translate speech to English.
    if target_language.lower() == "english":
        return translate_to_english_locally(audio_path), None

    return (
        None,
        f"Translation to {target_language} needs OPENAI_API_KEY. "
        "Without it, only English translation is available offline.",
    )


@app.route("/")
def index():
    return render_template("index.html", languages=SUPPORTED_LANGUAGES)


@app.route("/api/transcribe", methods=["POST"])
def api_transcribe():
    data = request.get_json(silent=True) or {}
    url = (data.get("url") or "").strip()
    target_language = (data.get("target_language") or "").strip()

    if not is_valid_instagram_url(url):
        return jsonify({"error": "Please paste a valid Instagram reel link."}), 400

    if target_language and target_language not in SUPPORTED_LANGUAGES:
        return jsonify({"error": "Unsupported target language."}), 400

    try:
        with tempfile.TemporaryDirectory() as workdir:
            audio_path, thumbnail_url, title = fetch_reel(url, workdir)

            if not audio_path or not os.path.exists(audio_path):
                return (
                    jsonify({"error": "Couldn't download audio from that reel."}),
                    502,
                )

            transcript = transcribe(audio_path)
            translation, note = translate(transcript, target_language, audio_path)

        return jsonify(
            {
                "thumbnail": thumbnail_url,
                "title": title,
                "transcript": transcript or "(No speech detected in this reel.)",
                "translation": translation,
                "target_language": target_language,
                "note": note,
            }
        )
    except Exception as exc:  # noqa: BLE001 - surface a readable error to the UI
        return jsonify({"error": f"Failed to process reel: {exc}"}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
