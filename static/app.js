const urlInput = document.getElementById("url-input");
const langSelect = document.getElementById("lang-select");
const transcribeBtn = document.getElementById("transcribe-btn");
const errorMsg = document.getElementById("error-msg");
const noteMsg = document.getElementById("note-msg");

const inputStep = document.getElementById("input-step");
const loadingStep = document.getElementById("loading-step");
const resultStep = document.getElementById("result-step");

const thumbnail = document.getElementById("thumbnail");
const resultTitle = document.getElementById("result-title");
const transcript = document.getElementById("transcript");
const translation = document.getElementById("translation");
const translationBlock = document.getElementById("translation-block");
const translationHeading = document.getElementById("translation-heading");
const restartBtn = document.getElementById("restart-btn");
const copyButtons = document.querySelectorAll(".copy-btn");

function showError(message) {
  errorMsg.textContent = message;
  errorMsg.classList.remove("hidden");
}

function clearError() {
  errorMsg.textContent = "";
  errorMsg.classList.add("hidden");
}

async function handleTranscribe() {
  const url = urlInput.value.trim();
  clearError();

  if (!url) {
    showError("Please paste an Instagram reel link first.");
    return;
  }

  inputStep.classList.add("hidden");
  loadingStep.classList.remove("hidden");

  try {
    const res = await fetch("/api/transcribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, target_language: langSelect.value }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Something went wrong.");
    }

    if (data.thumbnail) {
      thumbnail.src = data.thumbnail;
      thumbnail.classList.remove("hidden");
    } else {
      thumbnail.classList.add("hidden");
    }
    resultTitle.textContent = data.title || "";
    transcript.value = data.transcript || "";

    if (data.translation) {
      translation.value = data.translation;
      translationHeading.textContent = data.target_language
        ? `Translation (${data.target_language})`
        : "Translation";
      translationBlock.classList.remove("hidden");
    } else {
      translationBlock.classList.add("hidden");
    }

    if (data.note) {
      noteMsg.textContent = data.note;
      noteMsg.classList.remove("hidden");
    } else {
      noteMsg.classList.add("hidden");
    }

    loadingStep.classList.add("hidden");
    resultStep.classList.remove("hidden");
  } catch (err) {
    loadingStep.classList.add("hidden");
    inputStep.classList.remove("hidden");
    showError(err.message);
  }
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch (_err) {
    // Fallback for browsers/contexts without the async clipboard API.
    const tmp = document.createElement("textarea");
    tmp.value = text;
    document.body.appendChild(tmp);
    tmp.select();
    document.execCommand("copy");
    document.body.removeChild(tmp);
  }
}

function handleCopy(event) {
  const btn = event.currentTarget;
  const target = document.getElementById(btn.dataset.target);
  copyText(target.value);
  const original = btn.textContent;
  btn.textContent = "✅ Copied!";
  setTimeout(() => {
    btn.textContent = original;
  }, 1600);
}

function handleRestart() {
  urlInput.value = "";
  transcript.value = "";
  translation.value = "";
  thumbnail.src = "";
  resultTitle.textContent = "";
  translationBlock.classList.add("hidden");
  noteMsg.classList.add("hidden");
  clearError();

  resultStep.classList.add("hidden");
  loadingStep.classList.add("hidden");
  inputStep.classList.remove("hidden");
  urlInput.focus();
}

transcribeBtn.addEventListener("click", handleTranscribe);
urlInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") handleTranscribe();
});
copyButtons.forEach((btn) => btn.addEventListener("click", handleCopy));
restartBtn.addEventListener("click", handleRestart);
