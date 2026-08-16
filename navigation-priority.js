export const GUIDE_IMAGE_PATH = "images/quiz-guide.jpg";
const GUIDE_IMAGE_VERSION = "3";

const RULE_AUDIO_FILENAME = "ルールの説明です。.mp3";
let initialized = false;
let startTransitionOwned = false;
let drainingSystemAudio = false;
let drainSafetyTimer = null;

export function buildGuideImageUrl(retryToken = "") {
  const url = new URL(`./${GUIDE_IMAGE_PATH}`, import.meta.url);
  url.searchParams.set("v", GUIDE_IMAGE_VERSION);
  if (retryToken) url.searchParams.set("retry", String(retryToken));
  return url.href;
}

function loadNavigationStyles() {
  if (document.querySelector('link[data-navigation-priority="true"]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = new URL("./navigation-priority.css?v=2", import.meta.url).href;
  link.dataset.navigationPriority = "true";
  document.head.append(link);
}

function isRuleAudio(audio) {
  try {
    const url = new URL(audio.currentSrc || audio.src, window.location.href);
    const pathname = decodeURIComponent(url.pathname);
    return pathname.endsWith(`/${RULE_AUDIO_FILENAME}`);
  } catch {
    return false;
  }
}

function hideStartTransition() {
  if (!startTransitionOwned) return;
  const panel = document.querySelector("#roundTransition");
  if (panel) panel.hidden = true;
  startTransitionOwned = false;
}

function showStartTransition() {
  const stage = document.querySelector("#stage");
  if (!stage) return;

  let panel = document.querySelector("#roundTransition");
  if (!panel) {
    panel = document.createElement("section");
    panel.id = "roundTransition";
    panel.className = "round-transition";
    panel.setAttribute("role", "status");
    panel.setAttribute("aria-live", "polite");
    stage.append(panel);
  }

  panel.replaceChildren();
  const kicker = document.createElement("span");
  kicker.className = "round-transition-kicker";
  kicker.textContent = "QUIZ START";
  const title = document.createElement("strong");
  title.textContent = "まもなくスタート";
  const note = document.createElement("p");
  note.textContent = "まもなく1問目が始まります";
  panel.append(kicker, title, note);
  panel.hidden = false;
  startTransitionOwned = true;
}

function bindRuleAudio(audio) {
  if (!(audio instanceof HTMLMediaElement) || !isRuleAudio(audio)) return;
  if (audio.dataset.navigationRuleBound === "true") return;
  audio.dataset.navigationRuleBound = "true";

  audio.addEventListener("play", hideStartTransition);
  audio.addEventListener("playing", hideStartTransition);
  audio.addEventListener("ended", () => {
    if (audio.dataset.navigationAbort === "true") return;
    showStartTransition();
  });
}

function abortSystemAudio(audio) {
  if (!(audio instanceof HTMLMediaElement)) return;
  if (audio.dataset.navigationAbort === "true") return;
  audio.dataset.navigationAbort = "true";
  try {
    audio.pause();
  } catch {
    // 中断処理を継続します。
  }
  audio.dispatchEvent(new Event("ended"));
}

function drainSystemAudioNow() {
  if (!drainingSystemAudio) return;
  const panel = document.querySelector("#systemAudioPanel");
  panel?.querySelectorAll("audio").forEach(abortSystemAudio);

  try {
    globalThis.speechSynthesis?.cancel?.();
  } catch {
    // ナビゲーションを優先します。
  }

  if (!panel || panel.hidden) {
    drainingSystemAudio = false;
    if (drainSafetyTimer) window.clearTimeout(drainSafetyTimer);
    drainSafetyTimer = null;
  }
}

function beginSystemAudioDrain() {
  drainingSystemAudio = true;
  if (drainSafetyTimer) window.clearTimeout(drainSafetyTimer);
  drainSafetyTimer = window.setTimeout(() => {
    drainingSystemAudio = false;
    drainSafetyTimer = null;
  }, 5000);

  document.querySelectorAll("#stage audio").forEach((audio) => {
    if (audio.closest("#systemAudioPanel")) abortSystemAudio(audio);
    else {
      try {
        audio.pause();
      } catch {
        // ナビゲーションを優先します。
      }
    }
  });

  try {
    globalThis.speechSynthesis?.cancel?.();
  } catch {
    // ナビゲーションを優先します。
  }

  drainSystemAudioNow();
}

function hideQuizForIntro() {
  document.querySelector("#setupPanel")?.setAttribute("hidden", "");
  document.querySelector("#endScreen")?.setAttribute("hidden", "");
  document.querySelector("#questionCard")?.setAttribute("hidden", "");
  document.querySelector("#choiceLabels")?.setAttribute("hidden", "");
  document.querySelector("#quizControls")?.setAttribute("hidden", "");
  const transition = document.querySelector("#roundTransition");
  if (transition) transition.hidden = true;
  startTransitionOwned = false;
}

function handleStartClick(event) {
  if (!event.isTrusted) return;
  const setupPanel = document.querySelector("#setupPanel");
  const answerStep = document.querySelector("#answerStep");
  if (!setupPanel || setupPanel.hidden || !answerStep || answerStep.hidden) return;

  event.preventDefault();
  event.stopImmediatePropagation();
  hideQuizForIntro();

  const button = event.currentTarget;
  window.requestAnimationFrame(() => button.click());
}

function handleRestartClick(event) {
  if (!event.isTrusted) return;
  const endScreen = document.querySelector("#endScreen");
  if (!endScreen || endScreen.hidden) return;

  event.preventDefault();
  event.stopImmediatePropagation();
  hideStartTransition();
  beginSystemAudioDrain();

  // app.js の既存処理を利用して、必ず「新しい参加者の選択」から再開する。
  document.querySelector("#backToParticipantButton")?.click();
}

function handleReturnToTitleClick(event) {
  if (!event.isTrusted) return;
  const endScreen = document.querySelector("#endScreen");
  if (!endScreen || endScreen.hidden) return;

  event.preventDefault();
  event.stopImmediatePropagation();
  hideStartTransition();
  beginSystemAudioDrain();

  // 結果音声を含む進行中の処理より、利用者の「タイトルへ戻る」を優先する。
  window.location.reload();
}

function refreshGuideImage(forceRetry = false) {
  const overlay = document.querySelector("#guideImageOverlay");
  const image = overlay?.querySelector(".guide-image");
  const fallback = overlay?.querySelector(".guide-image-fallback");
  if (!(image instanceof HTMLImageElement)) return;

  const retry = forceRetry ? `${Date.now()}` : "";
  const nextUrl = buildGuideImageUrl(retry);
  image.dataset.failed = "false";
  image.hidden = false;
  if (fallback) fallback.hidden = true;

  if (image.src !== nextUrl || forceRetry) {
    image.src = nextUrl;
  }
}

function ensureGuideOverlay() {
  let overlay = document.querySelector("#guideImageOverlay");
  if (overlay) return overlay;

  const stage = document.querySelector("#stage");
  if (!stage) return null;

  overlay = document.createElement("section");
  overlay.id = "guideImageOverlay";
  overlay.className = "guide-image-overlay";
  overlay.hidden = true;
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-labelledby", "guideImageTitle");

  const card = document.createElement("div");
  card.className = "guide-image-card";
  const header = document.createElement("div");
  header.className = "guide-image-header";
  const title = document.createElement("h2");
  title.id = "guideImageTitle";
  title.textContent = "クイズの説明画像";
  const close = document.createElement("button");
  close.type = "button";
  close.className = "secondary-button";
  close.textContent = "閉じる";
  close.setAttribute("aria-label", "説明画像を閉じる");
  header.append(title, close);

  const image = document.createElement("img");
  image.alt = "立ち位置クイズの説明画像";
  image.className = "guide-image";
  image.decoding = "async";

  const fallback = document.createElement("p");
  fallback.className = "guide-image-fallback";
  fallback.hidden = true;
  fallback.textContent = `説明画像を読み込めませんでした。${GUIDE_IMAGE_PATH} を確認してください。もう一度ボタンを押すと再読み込みします。`;

  image.addEventListener("load", () => {
    image.dataset.failed = "false";
    image.hidden = false;
    fallback.hidden = true;
  });
  image.addEventListener("error", () => {
    image.dataset.failed = "true";
    image.hidden = true;
    fallback.hidden = false;
  });
  close.addEventListener("click", () => {
    overlay.hidden = true;
  });
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) overlay.hidden = true;
  });

  card.append(header, image, fallback);
  overlay.append(card);
  stage.append(overlay);
  refreshGuideImage(false);
  return overlay;
}

function ensureTitleGuideButton() {
  let button = document.querySelector("#showGuideImageButton");
  if (button) return button;

  const actions = document.querySelector("#titleStep .title-actions");
  if (!actions) return null;
  button = document.createElement("button");
  button.id = "showGuideImageButton";
  button.className = "secondary-button large-button";
  button.type = "button";
  button.textContent = "説明画像を表示";
  actions.append(button);
  return button;
}

function ensureParticipantGuideButton() {
  let button = document.querySelector("#showParticipantGuideImageButton");
  if (button) return button;

  const actions = document.querySelector("#participantStep .form-row");
  if (!actions) return null;
  button = document.createElement("button");
  button.id = "showParticipantGuideImageButton";
  button.className = "secondary-button";
  button.type = "button";
  button.textContent = "説明画像を表示";
  actions.append(button);
  return button;
}

function bindGuideButton(button) {
  if (!button || button.dataset.guideImageBound === "true") return;
  button.dataset.guideImageBound = "true";
  button.disabled = false;
  button.addEventListener("click", () => {
    const overlay = ensureGuideOverlay();
    if (!overlay) return;
    const image = overlay.querySelector(".guide-image");
    const shouldRetry = image?.dataset.failed === "true";
    if (shouldRetry) refreshGuideImage(true);
    overlay.hidden = false;
    overlay.querySelector("button")?.focus();
  });
}

function installGuideButtons() {
  bindGuideButton(ensureTitleGuideButton());
  bindGuideButton(ensureParticipantGuideButton());
}

function installStageObserver() {
  const stage = document.querySelector("#stage");
  if (!stage) return;

  const observer = new MutationObserver(() => {
    document.querySelectorAll("#systemAudioPanel audio").forEach(bindRuleAudio);
    drainSystemAudioNow();

    if (startTransitionOwned) {
      const questionCard = document.querySelector("#questionCard");
      const choiceLabels = document.querySelector("#choiceLabels");
      const counter = document.querySelector("#questionCounter")?.textContent?.trim() ?? "";
      if (questionCard?.hidden === false && choiceLabels?.hidden === false && /^[1-9][0-9]*\s*\//.test(counter)) {
        hideStartTransition();
      }
    }
  });

  observer.observe(stage, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["hidden", "src"]
  });
}

function installGuideKeyboardClose() {
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    const overlay = document.querySelector("#guideImageOverlay");
    if (overlay && !overlay.hidden) overlay.hidden = true;
  });
}

export function initializeNavigationPriority() {
  if (initialized) return;
  initialized = true;
  loadNavigationStyles();
  ensureGuideOverlay();
  installGuideButtons();
  installGuideKeyboardClose();
  installStageObserver();

  document.querySelector("#startQuizButton")?.addEventListener("click", handleStartClick, { capture: true });
  document.querySelector("#restartButton")?.addEventListener("click", handleRestartClick, { capture: true });
  document.querySelector("#returnToStartButton")?.addEventListener("click", handleReturnToTitleClick, { capture: true });
}
