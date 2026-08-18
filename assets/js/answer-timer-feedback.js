const MAX_AUDIO_ATTACH_WAIT_MS = 3500;
const AUDIO_EXTENSIONS = [".mp3"];

const nativePerformanceNow = globalThis.performance.now.bind(globalThis.performance);

export function createPausableClock(nowProvider = nativePerformanceNow) {
  let pausedAt = null;
  let accumulatedPauseMs = 0;

  return {
    now() {
      const realNow = nowProvider();
      const currentPauseMs = pausedAt === null ? 0 : realNow - pausedAt;
      return realNow - accumulatedPauseMs - currentPauseMs;
    },
    pause() {
      if (pausedAt === null) pausedAt = nowProvider();
    },
    resume() {
      if (pausedAt === null) return;
      accumulatedPauseMs += Math.max(0, nowProvider() - pausedAt);
      pausedAt = null;
    },
    isPaused() {
      return pausedAt !== null;
    }
  };
}

export function parseRemainingSeconds(text) {
  const match = String(text ?? "").match(/あと\s*([0-9]+(?:\.[0-9]+)?)\s*秒/);
  return match ? Number(match[1]) : null;
}

const appClock = createPausableClock();
let timingGuardInstalled = false;
let questionData = [];
let currentQuestionToken = 0;
let currentAudio = null;
let audioCleanup = null;
let lastQuestionKey = "";
let feedbackFrameId = null;
let temporaryNoticeUntil = 0;
let temporaryNoticeText = "";

export function installAnswerTimingGuard() {
  if (timingGuardInstalled) return true;

  const virtualNow = () => appClock.now();

  try {
    Object.defineProperty(globalThis.performance, "now", {
      configurable: true,
      writable: true,
      value: virtualNow
    });
    timingGuardInstalled = globalThis.performance.now === virtualNow;
  } catch (instanceError) {
    try {
      const prototype = Object.getPrototypeOf(globalThis.performance);
      Object.defineProperty(prototype, "now", {
        configurable: true,
        writable: true,
        value: virtualNow
      });
      timingGuardInstalled = globalThis.performance.now === virtualNow;
    } catch (prototypeError) {
      console.error("回答タイマー用の時間制御を初期化できませんでした。", instanceError, prototypeError);
      timingGuardInstalled = false;
    }
  }

  return timingGuardInstalled;
}

function normalizeChoiceText(value) {
  return String(value ?? "")
    .replace(/^[A-ZＡ-Ｚ][．.。]\s*/i, "")
    .trim();
}

function getCurrentChoiceTexts() {
  return [...document.querySelectorAll("#choiceLabels .choice-label")].map((label) => (
    label.dataset.rawChoiceText ?? label.textContent
  ));
}

function sameChoices(left, right) {
  if (!Array.isArray(left) || left.length !== right.length) return false;
  return left.every((choice, index) => normalizeChoiceText(choice) === normalizeChoiceText(right[index]));
}

function getCurrentQuestion() {
  const text = document.querySelector("#questionText")?.textContent?.trim();
  if (!text) return null;
  const choices = getCurrentChoiceTexts();

  return questionData.find((question) => (
    question.text === text && sameChoices(question.choices, choices)
  )) ?? questionData.find((question) => question.text === text) ?? null;
}

function resolveLocalAudioPath(path) {
  if (typeof path !== "string" || !path.trim()) return null;
  const value = path.trim();
  if (value.length > 240) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return null;
  if (value.includes("\\") || value.split("/").includes("..")) return null;

  const url = new URL(value, window.location.href);
  if (url.origin !== window.location.origin) return null;
  const pathname = url.pathname.toLowerCase();
  if (!AUDIO_EXTENSIONS.some((extension) => pathname.endsWith(extension))) return null;
  return url.href;
}

function isTimerMode() {
  return document.querySelector('input[name="answerMode"]:checked')?.value !== "space";
}

function isQuizVisible() {
  const questionCard = document.querySelector("#questionCard");
  const choiceLabels = document.querySelector("#choiceLabels");
  const endScreen = document.querySelector("#endScreen");
  return Boolean(
    questionCard && !questionCard.hidden &&
    choiceLabels && !choiceLabels.hidden &&
    endScreen?.hidden !== false
  );
}

function createTimerPanel() {
  let panel = document.querySelector("#answerTimerPanel");
  if (panel) return panel;

  panel = document.createElement("section");
  panel.id = "answerTimerPanel";
  panel.className = "answer-timer-panel";
  panel.hidden = true;
  panel.setAttribute("role", "status");
  panel.setAttribute("aria-live", "polite");
  panel.innerHTML = `
    <p id="answerTimerLabel" class="answer-timer-label">回答確定まで</p>
    <div class="answer-timer-value-row">
      <strong id="answerTimerValue" class="answer-timer-value">—</strong>
      <span id="answerTimerUnit" class="answer-timer-unit">秒</span>
    </div>
    <div class="answer-timer-progress" aria-hidden="true">
      <span id="answerTimerProgressBar"></span>
    </div>
    <p id="answerTimerHelp" class="answer-timer-help">回答エリアへ移動してください</p>
  `;

  document.querySelector("#stage")?.append(panel);
  return panel;
}

function updatePanel({ mode, label, value, unit = "秒", progress = 0, help }) {
  const panel = createTimerPanel();
  panel.hidden = false;
  panel.dataset.mode = mode;

  const labelNode = panel.querySelector("#answerTimerLabel");
  const valueNode = panel.querySelector("#answerTimerValue");
  const unitNode = panel.querySelector("#answerTimerUnit");
  const helpNode = panel.querySelector("#answerTimerHelp");
  const progressNode = panel.querySelector("#answerTimerProgressBar");

  if (labelNode.textContent !== label) labelNode.textContent = label;
  if (valueNode.textContent !== value) valueNode.textContent = value;
  if (unitNode.textContent !== unit) unitNode.textContent = unit;
  if (helpNode.textContent !== help) helpNode.textContent = help;
  progressNode.style.transform = `scaleX(${Math.max(0, Math.min(1, progress))})`;
}

function hidePanel() {
  const panel = document.querySelector("#answerTimerPanel");
  if (panel) panel.hidden = true;
}

function clearAudioBinding() {
  audioCleanup?.();
  audioCleanup = null;
  if (currentAudio && !currentAudio.paused) currentAudio.pause();
  currentAudio = null;
}

function resumeAnswerClock(notice = "") {
  appClock.resume();
  if (notice) {
    temporaryNoticeText = notice;
    temporaryNoticeUntil = nativePerformanceNow() + 1800;
  }
}

function pauseAnswerClock() {
  appClock.pause();
}

function bindAudio(audio, token) {
  if (token !== currentQuestionToken) return;

  clearAudioBinding();
  currentAudio = audio;
  audio.preload = "metadata";

  const onPlay = () => {
    if (token !== currentQuestionToken) return;
    pauseAnswerClock();
    updatePanel({
      mode: "audio-playing",
      label: "問題音声を再生中",
      value: "♪",
      unit: "",
      progress: 0,
      help: "音声を最後まで聞くと、回答受付を開始します"
    });
  };

  const onPause = () => {
    if (token !== currentQuestionToken || audio.ended || audio.error) return;
    pauseAnswerClock();
    updatePanel({
      mode: "audio-waiting",
      label: "音声が一時停止中",
      value: "▶",
      unit: "",
      progress: 0,
      help: "再生を続けて、問題を最後まで聞いてください"
    });
  };

  const onEnded = () => {
    if (token !== currentQuestionToken) return;
    resumeAnswerClock("音声が終わりました。回答受付を開始します");
  };

  const onError = () => {
    if (token !== currentQuestionToken) return;
    resumeAnswerClock("音声を読み込めないため、音声なしで回答受付を開始します");
  };

  audio.addEventListener("play", onPlay);
  audio.addEventListener("pause", onPause);
  audio.addEventListener("ended", onEnded);
  audio.addEventListener("error", onError);

  audioCleanup = () => {
    audio.removeEventListener("play", onPlay);
    audio.removeEventListener("pause", onPause);
    audio.removeEventListener("ended", onEnded);
    audio.removeEventListener("error", onError);
  };

  try {
    audio.load();
  } catch (error) {
    console.warn("問題音声の事前確認に失敗しました。", error);
  }

  updatePanel({
    mode: "audio-waiting",
    label: "問題音声を再生してください",
    value: "▶",
    unit: "",
    progress: 0,
    help: "音声プレイヤーの再生ボタンを押してください"
  });
}

function waitForAudioElement(token, expectedUrl) {
  const startedAt = nativePerformanceNow();

  const findAudio = () => {
    if (token !== currentQuestionToken) return;
    const audio = document.querySelector("#questionMedia audio");
    if (audio) {
      const actualUrl = audio.currentSrc || audio.src;
      if (!expectedUrl || !actualUrl || actualUrl === expectedUrl) {
        bindAudio(audio, token);
        return;
      }
    }

    if (nativePerformanceNow() - startedAt >= MAX_AUDIO_ATTACH_WAIT_MS) {
      resumeAnswerClock("音声プレイヤーを準備できないため、音声なしで回答受付を開始します");
      return;
    }
    window.setTimeout(findAudio, 80);
  };

  findAudio();
}

function handleQuestionChange() {
  const questionCounter = document.querySelector("#questionCounter")?.textContent ?? "";
  const questionText = document.querySelector("#questionText")?.textContent ?? "";
  const questionKey = `${questionCounter}\n${questionText}`;

  if (!isQuizVisible() || !isTimerMode()) {
    lastQuestionKey = questionKey;
    currentQuestionToken += 1;
    clearAudioBinding();
    resumeAnswerClock();
    hidePanel();
    return;
  }

  if (questionKey === lastQuestionKey) return;
  lastQuestionKey = questionKey;
  currentQuestionToken += 1;
  const token = currentQuestionToken;
  clearAudioBinding();
  temporaryNoticeUntil = 0;
  temporaryNoticeText = "";

  const question = getCurrentQuestion();
  const audioUrl = resolveLocalAudioPath(question?.audio);

  if (audioUrl) {
    pauseAnswerClock();
    updatePanel({
      mode: "audio-loading",
      label: "問題音声を準備中",
      value: "…",
      unit: "",
      progress: 0,
      help: "音声終了後に回答時間が始まります"
    });
    waitForAudioElement(token, audioUrl);
  } else {
    resumeAnswerClock();
    updatePanel({
      mode: "waiting-zone",
      label: "回答エリアを選択",
      value: "—",
      progress: 0,
      help: "エリアに入ると回答確定までのカウントが始まります"
    });
  }
}

function updateCountdownFeedback() {
  if (!isQuizVisible() || !isTimerMode()) {
    resumeAnswerClock();
    hidePanel();
    feedbackFrameId = requestAnimationFrame(updateCountdownFeedback);
    return;
  }

  if (appClock.isPaused()) {
    feedbackFrameId = requestAnimationFrame(updateCountdownFeedback);
    return;
  }

  const now = nativePerformanceNow();
  if (temporaryNoticeUntil > now) {
    updatePanel({
      mode: "ready",
      label: "回答受付を開始",
      value: "GO",
      unit: "",
      progress: 0,
      help: temporaryNoticeText
    });
    feedbackFrameId = requestAnimationFrame(updateCountdownFeedback);
    return;
  }

  const labels = [...document.querySelectorAll("#choiceLabels .choice-label")];
  const answered = labels.some((label) => label.classList.contains("correct") || label.classList.contains("wrong"));
  if (answered) {
    hidePanel();
    feedbackFrameId = requestAnimationFrame(updateCountdownFeedback);
    return;
  }

  const activeLabel = labels.find((label) => label.classList.contains("active"));
  const statusText = document.querySelector("#statusText")?.textContent ?? "";
  const remainingSeconds = parseRemainingSeconds(statusText);
  const configuredSeconds = Math.max(
    0.5,
    Math.min(10, Number(document.querySelector("#holdDurationInput")?.value) || 1.2)
  );

  if (remainingSeconds !== null) {
    const progress = 1 - remainingSeconds / configuredSeconds;
    const activeChoice = activeLabel?.dataset.rawChoiceText ?? activeLabel?.textContent?.trim() ?? "選択中";
    updatePanel({
      mode: "counting",
      label: "回答確定まで",
      value: remainingSeconds.toFixed(1),
      progress,
      help: `${normalizeChoiceText(activeChoice)} のエリアでカウント中`
    });
  } else if (statusText.includes("回答を確定します")) {
    updatePanel({
      mode: "confirming",
      label: "回答を確定します",
      value: "0.0",
      progress: 1,
      help: "その場所で少しお待ちください"
    });
  } else {
    updatePanel({
      mode: "waiting-zone",
      label: "回答エリアを選択",
      value: "—",
      progress: 0,
      help: "エリアに入ると回答確定までのカウントが始まります"
    });
  }

  feedbackFrameId = requestAnimationFrame(updateCountdownFeedback);
}

async function loadQuestionData() {
  const response = await fetch("questions.json", { cache: "no-store" });
  if (!response.ok) throw new Error(`回答タイマー用の問題データを読み込めませんでした (${response.status})`);
  const data = await response.json();
  questionData = Array.isArray(data.questions) ? data.questions : [];
}

export async function initializeAnswerTimerFeedback() {
  createTimerPanel();

  if (!timingGuardInstalled) {
    const startButton = document.querySelector("#startQuizButton");
    if (startButton) startButton.disabled = true;
    const answerStep = document.querySelector("#answerStep");
    const error = document.createElement("p");
    error.className = "setup-status timer-initialization-error";
    error.textContent = "このブラウザでは時間確定モードを安全に初期化できません。ブラウザを更新して再度お試しください。";
    answerStep?.append(error);
    return;
  }

  try {
    await loadQuestionData();
  } catch (error) {
    console.error(error);
    questionData = [];
  }

  const observer = new MutationObserver(() => queueMicrotask(handleQuestionChange));
  const questionText = document.querySelector("#questionText");
  const questionCounter = document.querySelector("#questionCounter");
  const questionCard = document.querySelector("#questionCard");
  const endScreen = document.querySelector("#endScreen");

  if (questionText) observer.observe(questionText, { childList: true, characterData: true, subtree: true });
  if (questionCounter) observer.observe(questionCounter, { childList: true, characterData: true, subtree: true });
  if (questionCard) observer.observe(questionCard, { attributes: true, attributeFilter: ["hidden"] });
  if (endScreen) observer.observe(endScreen, { attributes: true, attributeFilter: ["hidden"] });

  window.addEventListener("beforeunload", () => {
    currentQuestionToken += 1;
    clearAudioBinding();
    resumeAnswerClock();
    if (feedbackFrameId) cancelAnimationFrame(feedbackFrameId);
  }, { once: true });

  handleQuestionChange();
  feedbackFrameId = requestAnimationFrame(updateCountdownFeedback);
}
