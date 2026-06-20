const urlInput = document.getElementById("url-input");
const transcribeBtn = document.getElementById("transcribe-btn");
const errorMsg = document.getElementById("error-msg");

const inputStep = document.getElementById("input-step");
const loadingStep = document.getElementById("loading-step");
const resultStep = document.getElementById("result-step");

const thumbnail = document.getElementById("thumbnail");
const resultTitle = document.getElementById("result-title");
const transcript = document.getElementById("transcript");
const copyBtn = document.getElementById("copy-btn");
const restartBtn = document.getElementById("restart-btn");

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
      body: JSON.stringify({ url }),
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

    loadingStep.classList.add("hidden");
    resultStep.classList.remove("hidden");
  } catch (err) {
    loadingStep.classList.add("hidden");
    inputStep.classList.remove("hidden");
    showError(err.message);
  }
}

async function handleCopy() {
  try {
    await navigator.clipboard.writeText(transcript.value);
  } catch (_err) {
    // Fallback for browsers/contexts without the async clipboard API.
    transcript.select();
    document.execCommand("copy");
  }
  const original = copyBtn.textContent;
  copyBtn.textContent = "✅ Copied!";
  setTimeout(() => {
    copyBtn.textContent = original;
  }, 1600);
}

function handleRestart() {
  urlInput.value = "";
  transcript.value = "";
  thumbnail.src = "";
  resultTitle.textContent = "";
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
copyBtn.addEventListener("click", handleCopy);
restartBtn.addEventListener("click", handleRestart);
