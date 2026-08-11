const QUESTION_FONT_MAX = 32;
const QUESTION_FONT_MIN = 17;
const observedStatusNodes = new WeakSet();

let transitionPanel = null;
let transitionActive = false;
let transitionSafetyTimer = null;

function delay(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function ensureTransitionPanel() {
  if (transitionPanel?.isConnected) return transitionPanel;
  const stage = document.querySelector("#stage");
  if (!stage) return null;

  transitionPanel = document.createElement("section");
  transitionPanel.id = "roundTransition";
  transitionPanel.className = "round-transition";
  transitionPanel.setAttribute("role", "status");
  transitionPanel.setAttribute("aria-live", "polite");
  transitionPanel.hidden = true;
  stage.append(transitionPanel);
  return transitionPanel;
}

function showRoundTransition(kind) {
  const panel = ensureTransitionPanel();
  if (!panel) return;

  const setupPanel = document.querySelector("#setupPanel");
  const endScreen = document.querySelector("#endScreen");
  const questionCard = document.querySelector("#questionCard");
  const choiceLabels = document.querySelector("#choiceLabels");
  const quizControls = document.querySelector("#quizControls");
  const feedbackPanel = document.querySelector("#quizFeedbackPanel");

  if (setupPanel) setupPanel.hidden = true;
  if (endScreen) endScreen.hidden = true;
  if (questionCard) questionCard.hidden = true;
  if (choiceLabels) choiceLabels.hidden = true;
  if (quizControls) quizControls.hidden = true;
  if (feedbackPanel) feedbackPanel.hidden = true;

  const kicker = kind === "restart" ? "NEXT ROUND" : "QUIZ START";
  const title = kind === "restart" ? "次のゲームを準備中" : "まもなくスタート";
  const note = "音声案内のあと、1問目が始まります";

  panel.replaceChildren();
  const kickerNode = document.createElement("span");
  kickerNode.className = "round-transition-kicker";
  kickerNode.textContent = kicker;
  const titleNode = document.createElement("strong");
  titleNode.textContent = title;
  const noteNode = document.createElement("p");
  noteNode.textContent = note;
  panel.append(kickerNode, titleNode, noteNode);
  panel.hidden = false;
  transitionActive = true;

  if (transitionSafetyTimer) window.clearTimeout(transitionSafetyTimer);
  transitionSafetyTimer = window.setTimeout(() => {
    hideRoundTransition();
  }, 45000);
}

function hideRoundTransition() {
  if (!transitionPanel) return;
  transitionPanel.hidden = true;
  transitionActive = false;
  if (transitionSafetyTimer) window.clearTimeout(transitionSafetyTimer);
  transitionSafetyTimer = null;
}

function syncRoundTransition() {
  if (!transitionActive) return;

  const setupPanel = document.querySelector("#setupPanel");
  const participantStep = document.querySelector("#participantStep");
  if (setupPanel?.hidden === false && participantStep?.hidden === false) {
    hideRoundTransition();
    return;
  }

  const questionCard = document.querySelector("#questionCard");
  const choiceLabels = document.querySelector("#choiceLabels");
  const counter = document.querySelector("#questionCounter")?.textContent?.trim() ?? "";
  if (questionCard?.hidden === false && choiceLabels?.hidden === false && /^[1-9][0-9]*\s*\//.test(counter)) {
    hideRoundTransition();
  }
}

async function waitForSystemAudioIdle(timeoutMs = 35000) {
  await delay(80);
  const panel = document.querySelector("#systemAudioPanel");
  if (!panel || panel.hidden) return;

  await new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      observer.disconnect();
      window.clearTimeout(timeoutId);
      resolve();
    };

    const observer = new MutationObserver(() => {
      if (panel.hidden) finish();
    });
    observer.observe(panel, { attributes: true, attributeFilter: ["hidden"] });

    const timeoutId = window.setTimeout(finish, timeoutMs);
  });
}

function handleInitialStart(event) {
  const setupPanel = document.querySelector("#setupPanel");
  const answerStep = document.querySelector("#answerStep");
  if (!setupPanel || setupPanel.hidden || !answerStep || answerStep.hidden) return;

  event.preventDefault();
  event.stopImmediatePropagation();
  showRoundTransition("start");

  const button = event.currentTarget;
  window.requestAnimationFrame(() => button.click());
}

function handleRestart(event) {
  const endScreen = document.querySelector("#endScreen");
  if (!endScreen || endScreen.hidden) return;

  event.preventDefault();
  event.stopImmediatePropagation();

  // 前回の得点画面を最初に消す。音声開始より画面切替を必ず先にする。
  showRoundTransition("restart");

  const button = event.currentTarget;
  void waitForSystemAudioIdle().then(() => {
    // system-audio-flow の開始前音声ガードへ渡す。
    button.click();
  });
}

function fitQuestionText() {
  const questionText = document.querySelector("#questionText");
  const questionCard = document.querySelector("#questionCard");
  if (!questionText || !questionCard || questionCard.hidden) return;

  questionText.classList.remove("question-wrap-fallback");
  questionText.style.whiteSpace = "nowrap";

  const viewportMax = window.innerWidth <= 760 ? 23 : QUESTION_FONT_MAX;
  let size = viewportMax;
  questionText.style.fontSize = `${size}px`;

  const available = questionText.clientWidth;
  if (available <= 0) return;

  while (questionText.scrollWidth > available && size > QUESTION_FONT_MIN) {
    size -= 1;
    questionText.style.fontSize = `${size}px`;
  }

  if (questionText.scrollWidth > available) {
    questionText.classList.add("question-wrap-fallback");
  }
}

function compactQuestionSpeechStatus(text) {
  const value = String(text ?? "");
  if (!value) return value;
  if (value.includes("再生ボタンを押してください")) return "▶ 再生ボタンを押してください";
  if (value.includes("解説") && (value.includes("読み上げ") || value.includes("再生"))) return "解説音声を再生中";
  if (value.includes("問題") && (value.includes("読み上げ") || value.includes("再生"))) return "問題音声を再生中";
  if (value.includes("準備")) return "音声を準備中";
  if (value.includes("終了")) return "音声終了";
  if (value.includes("対応していません") || value.includes("失敗")) return value.replace(/🔊|✅/g, "").trim();
  return "音声案内";
}

function compactSystemAudioStatus(text) {
  const value = String(text ?? "");
  if (!value) return value;
  if (value.includes("再生ボタンを押してください")) return "▶ 再生ボタンを押してください";
  if (value.includes("結果")) return "結果音声を再生中";
  if (value.includes("開始前") || value.includes("ルール") || value.includes("スタート")) return "開始案内を再生中";
  if (value.includes("準備")) return "音声を準備中";
  if (value.includes("再生中") || value.includes("読み上げ")) return "音声案内を再生中";
  return value.replace(/🔊|✅/g, "").trim();
}

function compactSetupStatus(text) {
  return String(text ?? "")
    .replace("選択したカメラと高精度人物検出モデルを準備しています…", "カメラを準備しています…")
    .replace("人物を検出しています。表示された丸い番号をクリックしてください。", "参加者を探しています。番号が表示された人を選んでください。")
    .replace("人物が見つかりません。上半身だけでも画面に入る位置へ移動してください。", "参加者が見つかりません。上半身が画面に入る位置へ移動してください。")
    .replace(/([0-9]+)人を検出しました。/, "$1人見つかりました。")
    .replace("参加者を再取得しています…", "参加者の位置を確認しています…");
}

function observeTextNode(node, transform) {
  if (!node || observedStatusNodes.has(node)) return;
  observedStatusNodes.add(node);

  let updating = false;
  const update = () => {
    if (updating) return;
    const current = node.textContent ?? "";
    const next = transform(current);
    if (next === current) return;
    updating = true;
    node.textContent = next;
    updating = false;
  };

  const observer = new MutationObserver(update);
  observer.observe(node, { childList: true, characterData: true, subtree: true });
  update();
}

function installStatusCompaction() {
  observeTextNode(document.querySelector("#cameraStatus"), compactSetupStatus);
  observeTextNode(document.querySelector("#participantStatus"), compactSetupStatus);
  observeTextNode(document.querySelector("#statusText"), compactSetupStatus);

  const attachDynamicNodes = () => {
    observeTextNode(document.querySelector("#questionSpeechStatusText"), compactQuestionSpeechStatus);
    observeTextNode(document.querySelector("#systemAudioStatusText"), compactSystemAudioStatus);
  };

  const stage = document.querySelector("#stage");
  if (stage) {
    const observer = new MutationObserver(attachDynamicNodes);
    observer.observe(stage, { childList: true, subtree: true });
  }
  attachDynamicNodes();
}

function installQuestionFit() {
  const questionText = document.querySelector("#questionText");
  const questionCard = document.querySelector("#questionCard");
  if (!questionText || !questionCard) return;

  const requestFit = () => window.requestAnimationFrame(fitQuestionText);
  const observer = new MutationObserver(requestFit);
  observer.observe(questionText, { childList: true, characterData: true, subtree: true });
  observer.observe(questionCard, { attributes: true, attributeFilter: ["hidden"] });

  if (typeof ResizeObserver !== "undefined") {
    const resizeObserver = new ResizeObserver(requestFit);
    resizeObserver.observe(questionCard);
  }
  window.addEventListener("resize", requestFit);
  requestFit();
}

function installTransitionObservers() {
  const stage = document.querySelector("#stage");
  if (!stage) return;
  const observer = new MutationObserver(syncRoundTransition);
  observer.observe(stage, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["hidden"]
  });
}

export function initializeQuizShowUI() {
  ensureTransitionPanel();
  installStatusCompaction();
  installQuestionFit();
  installTransitionObservers();

  document.querySelector("#startQuizButton")?.addEventListener("click", handleInitialStart, { capture: true });
  document.querySelector("#restartButton")?.addEventListener("click", handleRestart, { capture: true });
}
