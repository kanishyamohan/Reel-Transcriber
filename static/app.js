/* ------------------------------------------------------------------ shared */

const INSTAGRAM_URL_RE =
  /^https?:\/\/(www\.)?instagram\.com\/(reel|reels|p|tv)\/[\w-]+/i;

/** Split a pasted blob of links on newlines, commas, or spaces (deduped). */
function parseUrls(raw) {
  const parts = (raw || "").trim().split(/[\s,]+/).filter(Boolean);
  return [...new Set(parts)];
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

/** Flash a confirmation on a button, then restore its label. */
function flashButton(btn, label) {
  const original = btn.dataset.label || btn.textContent;
  btn.dataset.label = original;
  btn.textContent = label;
  clearTimeout(btn._flashTimer);
  btn._flashTimer = setTimeout(() => {
    btn.textContent = original;
  }, 1600);
}

function showStatus(el, message) {
  el.textContent = message;
  el.classList.remove("hidden");
  clearTimeout(el._statusTimer);
  el._statusTimer = setTimeout(() => el.classList.add("hidden"), 4000);
}

/**
 * Share via the native share sheet where it exists, otherwise copy to the
 * clipboard so the text is still one paste away.
 */
async function shareText({ title, text, statusEl }) {
  if (navigator.share) {
    try {
      await navigator.share({ title, text });
      return "shared";
    } catch (err) {
      if (err && err.name === "AbortError") return "cancelled";
      // Anything else (permissions, unsupported payload) falls through to copy.
    }
  }
  await copyText(text);
  if (statusEl) {
    showStatus(
      statusEl,
      "Sharing isn't available in this browser — copied to your clipboard instead."
    );
  }
  return "copied";
}

/** The plain-text block we copy, share, or download for one reel. */
function formatResult(result, index) {
  const lines = [];
  const heading = result.title ? result.title : "Instagram Reel";
  lines.push(index ? `${index}. ${heading}` : heading);
  lines.push(result.url);
  lines.push("");
  lines.push("Transcript:");
  lines.push(result.transcript || "");
  if (result.translation) {
    lines.push("");
    lines.push(
      result.target_language
        ? `Translation (${result.target_language}):`
        : "Translation:"
    );
    lines.push(result.translation);
  }
  return lines.join("\n");
}

function downloadTextFile(filename, text) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/* ---------------------------------------------------------------- tabbing */

const tabs = document.querySelectorAll(".tab");
const modes = {
  single: document.getElementById("single-mode"),
  bulk: document.getElementById("bulk-mode"),
};

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.toggle("active", t === tab));
    Object.entries(modes).forEach(([name, el]) => {
      el.classList.toggle("hidden", name !== tab.dataset.mode);
    });
  });
});

/* ------------------------------------------------------ single reel flow */

const urlInput = document.getElementById("url-input");
const langSelect = document.getElementById("lang-select");
const transcribeBtn = document.getElementById("transcribe-btn");
const errorMsg = document.getElementById("error-msg");
const noteMsg = document.getElementById("note-msg");
const shareStatus = document.getElementById("share-status");

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

let currentResult = null;

function showError(message) {
  errorMsg.textContent = message;
  errorMsg.classList.remove("hidden");
}

function clearError() {
  errorMsg.textContent = "";
  errorMsg.classList.add("hidden");
}

/** POST one reel to the backend; throws with the server's message on failure. */
async function requestTranscript(url, targetLanguage) {
  const res = await fetch("/api/transcribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, target_language: targetLanguage }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Something went wrong.");
  }
  return data;
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
    const data = await requestTranscript(url, langSelect.value);
    currentResult = { ...data, url: data.url || url };

    if (data.thumbnail) {
      thumbnail.src = data.thumbnail;
      thumbnail.classList.remove("hidden");
      thumbnail.onerror = () => thumbnail.classList.add("hidden");
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

function handleCopy(event) {
  const btn = event.currentTarget;
  const target = document.getElementById(btn.dataset.target);
  copyText(target.value);
  flashButton(btn, "✅ Copied!");
}

async function handleShare(event) {
  const btn = event.currentTarget;
  const target = document.getElementById(btn.dataset.target);
  const heading = currentResult && currentResult.title ? currentResult.title : "Reel transcript";
  const source = currentResult && currentResult.url ? `\n\n${currentResult.url}` : "";

  const outcome = await shareText({
    title: heading,
    text: `${heading}\n\n${target.value}${source}`,
    statusEl: shareStatus,
  });

  if (outcome === "shared") flashButton(btn, "✅ Shared!");
  if (outcome === "copied") flashButton(btn, "📋 Copied!");
}

function handleRestart() {
  urlInput.value = "";
  transcript.value = "";
  translation.value = "";
  thumbnail.src = "";
  resultTitle.textContent = "";
  currentResult = null;
  translationBlock.classList.add("hidden");
  noteMsg.classList.add("hidden");
  shareStatus.classList.add("hidden");
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
document
  .querySelectorAll("#single-mode .copy-btn")
  .forEach((btn) => btn.addEventListener("click", handleCopy));
document
  .querySelectorAll("#single-mode .share-btn")
  .forEach((btn) => btn.addEventListener("click", handleShare));
restartBtn.addEventListener("click", handleRestart);

/* ------------------------------------------------------------- bulk flow */

const bulkInput = document.getElementById("bulk-input");
const bulkCount = document.getElementById("bulk-count");
const bulkLangSelect = document.getElementById("bulk-lang-select");
const bulkStartBtn = document.getElementById("bulk-start-btn");
const bulkError = document.getElementById("bulk-error");

const bulkInputStep = document.getElementById("bulk-input-step");
const bulkRunStep = document.getElementById("bulk-run-step");
const bulkProgressLabel = document.getElementById("bulk-progress-label");
const bulkProgressBar = document.getElementById("bulk-progress-bar");
const bulkCancelBtn = document.getElementById("bulk-cancel-btn");
const bulkResultsEl = document.getElementById("bulk-results");
const bulkSummary = document.getElementById("bulk-summary");
const bulkShareStatus = document.getElementById("bulk-share-status");
const bulkActions = document.getElementById("bulk-actions");
const bulkRestartActions = document.getElementById("bulk-restart-actions");
const bulkCopyAllBtn = document.getElementById("bulk-copy-all-btn");
const bulkDownloadBtn = document.getElementById("bulk-download-btn");
const bulkShareAllBtn = document.getElementById("bulk-share-all-btn");

// Populated as the batch runs; only successful reels land here.
let bulkResults = [];
let bulkCancelled = false;

const MAX_BULK_URLS = Number(bulkInput.dataset.max || 25);

function updateBulkCount() {
  const urls = parseUrls(bulkInput.value);
  const noun = urls.length === 1 ? "link" : "links";
  bulkCount.textContent = `${urls.length} ${noun} detected`;
}

function showBulkError(message) {
  bulkError.textContent = message;
  bulkError.classList.remove("hidden");
}

function clearBulkError() {
  bulkError.textContent = "";
  bulkError.classList.add("hidden");
}

function setBulkProgress(done, total, label) {
  bulkProgressBar.style.width = total ? `${(done / total) * 100}%` : "0%";
  bulkProgressLabel.textContent = label;
}

/** One card per reel — a pending placeholder, then filled in on completion. */
function createBulkCard(url, index) {
  const card = document.createElement("article");
  card.className = "bulk-card pending";

  const head = document.createElement("div");
  head.className = "bulk-card-head";

  const badge = document.createElement("span");
  badge.className = "badge";
  badge.textContent = index;
  head.appendChild(badge);

  const heading = document.createElement("div");
  heading.className = "bulk-card-title";
  heading.textContent = url;
  head.appendChild(heading);

  const status = document.createElement("span");
  status.className = "bulk-card-status";
  status.textContent = "Queued";
  head.appendChild(status);

  card.appendChild(head);

  const body = document.createElement("div");
  body.className = "bulk-card-body hidden";
  card.appendChild(body);

  bulkResultsEl.appendChild(card);
  return { card, heading, status, body };
}

function fillBulkCard(refs, result) {
  const { card, heading, status, body } = refs;
  card.classList.remove("pending");
  card.classList.add("done");
  status.textContent = "Done";
  heading.textContent = result.title || result.url;

  body.classList.remove("hidden");
  body.replaceChildren();

  const link = document.createElement("a");
  link.className = "bulk-card-link";
  link.href = result.url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = result.url;
  body.appendChild(link);

  const text = document.createElement("textarea");
  text.className = "bulk-card-text";
  text.readOnly = true;
  text.value = result.translation
    ? `${result.transcript}\n\n— ${result.target_language || "Translation"} —\n${result.translation}`
    : result.transcript;
  body.appendChild(text);

  if (result.note) {
    const note = document.createElement("p");
    note.className = "note";
    note.textContent = result.note;
    body.appendChild(note);
  }

  const actions = document.createElement("div");
  actions.className = "actions";

  const copyBtn = document.createElement("button");
  copyBtn.className = "secondary small";
  copyBtn.textContent = "📋 Copy";
  copyBtn.addEventListener("click", () => {
    copyText(formatResult(result));
    flashButton(copyBtn, "✅ Copied!");
  });
  actions.appendChild(copyBtn);

  const shareBtn = document.createElement("button");
  shareBtn.className = "secondary small";
  shareBtn.textContent = "🔗 Share";
  shareBtn.addEventListener("click", async () => {
    const outcome = await shareText({
      title: result.title || "Reel transcript",
      text: formatResult(result),
      statusEl: bulkShareStatus,
    });
    if (outcome === "shared") flashButton(shareBtn, "✅ Shared!");
    if (outcome === "copied") flashButton(shareBtn, "📋 Copied!");
  });
  actions.appendChild(shareBtn);

  body.appendChild(actions);
}

function failBulkCard(refs, url, message) {
  const { card, heading, status, body } = refs;
  card.classList.remove("pending");
  card.classList.add("failed");
  status.textContent = "Failed";
  heading.textContent = url;

  body.classList.remove("hidden");
  body.replaceChildren();
  const err = document.createElement("p");
  err.className = "error";
  err.textContent = message;
  body.appendChild(err);
}

/** Everything that succeeded, as one copyable/downloadable document. */
function bulkTranscriptDocument() {
  return bulkResults
    .map((result, i) => formatResult(result, i + 1))
    .join("\n\n----------------------------------------\n\n");
}

async function handleBulkStart() {
  clearBulkError();
  const urls = parseUrls(bulkInput.value);

  if (!urls.length) {
    showBulkError("Paste at least one Instagram reel link.");
    return;
  }
  if (urls.length > MAX_BULK_URLS) {
    showBulkError(
      `That's ${urls.length} links — ${MAX_BULK_URLS} is the maximum per batch.`
    );
    return;
  }

  const targetLanguage = bulkLangSelect.value;
  bulkResults = [];
  bulkCancelled = false;
  bulkResultsEl.replaceChildren();
  bulkSummary.classList.add("hidden");
  bulkShareStatus.classList.add("hidden");
  bulkActions.classList.add("hidden");
  bulkRestartActions.classList.add("hidden");
  bulkCancelBtn.classList.remove("hidden");
  bulkCancelBtn.disabled = false;

  bulkInputStep.classList.add("hidden");
  bulkRunStep.classList.remove("hidden");
  setBulkProgress(0, urls.length, `Starting ${urls.length} reels…`);

  // One card up front for every link, so progress is visible from the start.
  const cards = urls.map((url, i) => createBulkCard(url, i + 1));

  let failed = 0;
  let processed = 0;

  // Sequential on purpose: each reel is a download plus a transcription, and
  // firing them all at once gets rate-limited and hides per-reel progress.
  for (let i = 0; i < urls.length; i += 1) {
    if (bulkCancelled) {
      cards[i].status.textContent = "Skipped";
      continue;
    }

    const url = urls[i];
    cards[i].card.classList.add("active");
    cards[i].status.textContent = "Transcribing…";
    setBulkProgress(processed, urls.length, `Transcribing ${i + 1} of ${urls.length}…`);

    if (!INSTAGRAM_URL_RE.test(url)) {
      failBulkCard(cards[i], url, "Not a valid Instagram reel link.");
      failed += 1;
    } else {
      try {
        const data = await requestTranscript(url, targetLanguage);
        const result = { ...data, url: data.url || url };
        bulkResults.push(result);
        fillBulkCard(cards[i], result);
      } catch (err) {
        failBulkCard(cards[i], url, err.message);
        failed += 1;
      }
    }

    cards[i].card.classList.remove("active");
    processed += 1;
    setBulkProgress(processed, urls.length, `${processed} of ${urls.length} done`);
  }

  const skipped = urls.length - processed;
  bulkCancelBtn.classList.add("hidden");
  setBulkProgress(processed, urls.length, bulkCancelled ? "Stopped" : "All done");

  const parts = [`${bulkResults.length} transcribed`];
  if (failed) parts.push(`${failed} failed`);
  if (skipped) parts.push(`${skipped} skipped`);
  bulkSummary.textContent = parts.join(" · ");
  bulkSummary.classList.remove("hidden");

  if (bulkResults.length) bulkActions.classList.remove("hidden");
  bulkRestartActions.classList.remove("hidden");
}

function handleBulkRestart() {
  bulkInput.value = "";
  bulkResults = [];
  bulkCancelled = false;
  bulkResultsEl.replaceChildren();
  bulkSummary.classList.add("hidden");
  bulkShareStatus.classList.add("hidden");
  bulkActions.classList.add("hidden");
  bulkRestartActions.classList.add("hidden");
  clearBulkError();
  updateBulkCount();

  bulkRunStep.classList.add("hidden");
  bulkInputStep.classList.remove("hidden");
  bulkInput.focus();
}

bulkInput.addEventListener("input", updateBulkCount);
bulkStartBtn.addEventListener("click", handleBulkStart);
bulkCancelBtn.addEventListener("click", () => {
  bulkCancelled = true;
  bulkCancelBtn.disabled = true;
  bulkProgressLabel.textContent = "Stopping after this reel…";
});
bulkCopyAllBtn.addEventListener("click", () => {
  copyText(bulkTranscriptDocument());
  flashButton(bulkCopyAllBtn, "✅ Copied!");
});
bulkDownloadBtn.addEventListener("click", () => {
  const stamp = new Date().toISOString().slice(0, 10);
  downloadTextFile(`reel-transcripts-${stamp}.txt`, bulkTranscriptDocument());
});
bulkShareAllBtn.addEventListener("click", async () => {
  const outcome = await shareText({
    title: `${bulkResults.length} reel transcripts`,
    text: bulkTranscriptDocument(),
    statusEl: bulkShareStatus,
  });
  if (outcome === "shared") flashButton(bulkShareAllBtn, "✅ Shared!");
  if (outcome === "copied") flashButton(bulkShareAllBtn, "📋 Copied!");
});
document.getElementById("bulk-restart-btn").addEventListener("click", handleBulkRestart);

updateBulkCount();
