const CHOICE_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

let questionData = [];
let lastQuestionKey = "";
let speechToken = 0;
let currentUtterance = null;
let repeatButton = null;
let statusTextNode = null;
let baseNowProvider = null;
let speechClockInstalled = false;
let pausedAt = null;
let accumulatedPauseMs = 0;
let speaking = false;

function definePerformanceNow(value) {
  try {
    Object.defineProperty(globalThis.performance, "now", {
      configurable: true,
      writable: true,
      value
    });
    return globalThis.performance.now === value;
  } catch {
    try {
      const prototype = Object.getPrototypeOf(globalThis.performance);
      Object.defineProperty(prototype, "now", {
        configurable: true,
        writable: true,
        value
      });
      return globalThis.performance.now === value;
    } catch (error) {
      console.warn("問題読み上げ用の時間制御を初期化できませんでした。", error);
      return false;
    }
  }
}

export function installQuestionSpeechClock() {
  if (speechClockInstalled) return true;
  baseNowProvider = globalThis.performance.now.bind(globalThis.performance);

  const virtualNow = () => {
    const realNow = baseNowProvider();
    const currentPauseMs = pausedAt === null ? 0 : Math.max(0, realNow - pausedAt);
    return realNow - accumulatedPauseMs - currentPauseMs;
  };

  speechClockInstalled = definePerformanceNow(virtualNow);
  return speechClockInstalled;
}

function pauseGameClock() {
  if (!speechClockInstalled || pausedAt !== null) return;
  pausedAt = baseNowProvider();
}

function resumeGameClock() {
  if (!speechClockInstalled || pausedAt === null) return;
  accumulatedPauseMs += Math.max(0, baseNowProvider() - pausedAt);
  pausedAt = null;
}

function normalizeChoiceText(value) {
  return String(value ?? "")
    .replace(/^[A-ZＡ-Ｚ][．.。]\s*/i, "")
    .trim();
}

function getCurrentChoiceTexts() {
  return [...document.querySelectorAll("#choiceLabels .choice-label")].map((label) => (
    label.dataset.rawChoiceText ?? label.textContent ?? ""
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

function isQuizVisible() {
  const questionCard = document.querySelector("#questionCard");
  const endScreen = document.querySelector("#endScreen");
  return Boolean(questionCard && !questionCard.hidden && endScreen?.hidden !== false);
}

function speakableChoice(choice, index) {
  const raw = String(choice ?? "").trim();
  if (["〇", "○", "◯"].includes(raw)) return "まる";
  if (["✕", "×", "✖"].includes(raw)) return "ばつ";

  const body = normalizeChoiceText(raw);
  const existingPrefix = raw.match(/^([A-ZＡ-Ｚ])[．.。]\s*/i)?.[1];
  const label = existingPrefix || CHOICE_LETTERS[index] || String(index + 1);
  return `${label}、${body}`;
}

function buildSpeechText(question) {
  const choices = Array.isArray(question?.choices) ? question.choices : [];
  const choiceText = choices.map(speakableChoice).join("。 ");
  return choiceText
    ? `${question.text}。選択肢です。${choiceText}。`
    : String(question?.text ?? "");
}

function ensureSpeechControls() {
  let container = document.querySelector("#questionSpeechControls");
  if (container) {
    statusTextNode = container.querySelector("#questionSpeechStatusText");
    repeatButton = container.querySelector("#repeatQuestionSpeechButton");
    return container;
  }

  container = document.createElement("div");
  container.id = "questionSpeechControls";
  container.setAttribute("role", "status");
  container.setAttribute("aria-live", "polite");
  container.style.display = "flex";
  container.style.alignItems = "center";
  container.style.justifyContent = "center";
  container.style.gap = "0.75rem";
  container.style.flexWrap = "wrap";
  container.style.marginTop = "0.65rem";
  container.style.padding = "0.55rem 0.8rem";
  container.style.borderRadius = "0.8rem";
  container.style.background = "rgba(15, 23, 42, 0.78)";
  container.style.color = "#f8fafc";

  statusTextNode = document.createElement("span");
  statusTextNode.id = "questionSpeechStatusText";
  statusTextNode.textContent = "🔊 問題を自動で読み上げます";

  repeatButton = document.createElement("button");
  repeatButton.id = "repeatQuestionSpeechButton";
  repeatButton.type = "button";
  repeatButton.textContent = "もう一度読み上げる";
  repeatButton.style.padding = "0.45rem 0.8rem";
  repeatButton.style.borderRadius = "0.65rem";
  repeatButton.style.border = "1px solid rgba(255,255,255,0.5)";
  repeatButton.style.background = "rgba(255,255,255,0.12)";
  repeatButton.style.color = "inherit";
  repeatButton.style.fontWeight = "700";
  repeatButton.addEventListener("click", () => {
    const question = getCurrentQuestion();
    if (question) startQuestionSpeech(question, true);
  });

  container.append(statusTextNode, repeatButton);
  document.querySelector("#questionCard")?.append(container);
  return container;
}

function setSpeechStatus(text, isActive) {
  ensureSpeechControls();
  if (statusTextNode) statusTextNode.textContent = text;
  if (repeatButton) repeatButton.disabled = Boolean(isActive);
}

function chooseJapaneseVoice() {
  const voices = globalThis.speechSynthesis?.getVoices?.() ?? [];
  return voices.find((voice) => /^ja(?:-|_)/i.test(voice.lang)) ?? null;
}

function finishSpeech(token, message) {
  if (token !== speechToken) return;
  speaking = false;
  currentUtterance = null;
  resumeGameClock();
  setSpeechStatus(message, false);
}

function cancelCurrentSpeech() {
  speechToken += 1;
  speaking = false;
  currentUtterance = null;
  try {
    globalThis.speechSynthesis?.cancel?.();
  } catch {
    // 読み上げ停止に失敗してもゲーム進行を継続します。
  }
  resumeGameClock();
}

function startQuestionSpeech(question, isRepeat = false) {
  cancelCurrentSpeech();
  const token = speechToken;

  if (!("speechSynthesis" in globalThis) || typeof SpeechSynthesisUtterance === "undefined") {
    setSpeechStatus("このブラウザは問題読み上げに対応していません。", false);
    return;
  }

  const text = buildSpeechText(question).trim();
  if (!text) return;

  pauseGameClock();
  speaking = true;
  setSpeechStatus(isRepeat ? "🔊 問題をもう一度読み上げています…" : "🔊 問題を読み上げています… 制限時間は停止中です", true);

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "ja-JP";
  utterance.rate = 0.95;
  utterance.pitch = 1;
  const voice = chooseJapaneseVoice();
  if (voice) utterance.voice = voice;

  utterance.onend = () => finishSpeech(token, "✅ 読み上げ終了。回答時間を開始しました");
  utterance.onerror = (event) => {
    console.warn("問題の読み上げに失敗しました。", event.error ?? event);
    finishSpeech(token, "読み上げできなかったため、回答時間を開始しました");
  };

  currentUtterance = utterance;
  try {
    globalThis.speechSynthesis.cancel();
    globalThis.speechSynthesis.speak(utterance);
  } catch (error) {
    console.warn("問題の読み上げを開始できませんでした。", error);
    finishSpeech(token, "読み上げできなかったため、回答時間を開始しました");
  }
}

function handleQuestionChange() {
  if (!isQuizVisible()) {
    lastQuestionKey = "";
    cancelCurrentSpeech();
    return;
  }

  const questionCounter = document.querySelector("#questionCounter")?.textContent ?? "";
  const questionText = document.querySelector("#questionText")?.textContent ?? "";
  const questionKey = `${questionCounter}\n${questionText}`;
  if (!questionText.trim() || questionKey === lastQuestionKey) return;

  lastQuestionKey = questionKey;
  const question = getCurrentQuestion();
  if (question) startQuestionSpeech(question, false);
}

async function loadQuestionData() {
  const response = await fetch("questions.json", { cache: "no-store" });
  if (!response.ok) throw new Error(`読み上げ用の問題データを読み込めませんでした (${response.status})`);
  const data = await response.json();
  questionData = Array.isArray(data.questions) ? data.questions : [];
}

export async function initializeQuestionSpeech() {
  ensureSpeechControls();

  if (!speechClockInstalled) {
    setSpeechStatus("問題読み上げ用の時間制御を初期化できませんでした。", false);
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

  window.addEventListener("keydown", (event) => {
    if (!speaking || event.code !== "Space") return;
    event.preventDefault();
    event.stopImmediatePropagation();
    setSpeechStatus("🔊 読み上げ終了後に回答できます", true);
  }, { capture: true });

  window.addEventListener("beforeunload", cancelCurrentSpeech, { once: true });
  handleQuestionChange();
}
