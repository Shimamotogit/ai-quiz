const CHOICE_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const MASTER_QUESTION_AUDIO_DIRECTORY = "音声データ_MP3/02.問題/";
const MASTER_EXPLANATION_AUDIO_DIRECTORY = "音声データ_MP3/03.問題_補足説明/";
const AUDIO_EXTENSIONS = [".mp3"];

let questionData = [];
let lastQuestionKey = "";
let lastAnsweredQuestionKey = "";
let speechToken = 0;
let currentUtterance = null;
let currentAudio = null;
let currentAudioCleanup = null;
let repeatButton = null;
let statusTextNode = null;
let audioSlot = null;
let baseNowProvider = null;
let speechClockInstalled = false;
let autoAdvanceGuardInstalled = false;
let pausedAt = null;
let accumulatedPauseMs = 0;
let speaking = false;
let feedbackReading = false;
let playbackPhase = "question";

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

function looksLikeQuizAutoAdvance(handler) {
  if (typeof handler !== "function") return false;
  const source = Function.prototype.toString.call(handler);
  return source.includes("showQuestion()") && source.includes("state.answerLocked") && source.includes("state.phase");
}

function installAutoAdvanceGuard() {
  if (autoAdvanceGuardInstalled || typeof globalThis.setTimeout !== "function") return;
  autoAdvanceGuardInstalled = true;
  const nativeSetTimeout = globalThis.setTimeout.bind(globalThis);

  globalThis.setTimeout = (handler, delay = 0, ...args) => {
    if (!looksLikeQuizAutoAdvance(handler)) {
      return nativeSetTimeout(handler, delay, ...args);
    }

    const guardedHandler = () => {
      if (feedbackReading) {
        nativeSetTimeout(guardedHandler, 80);
        return;
      }
      handler(...args);
    };

    return nativeSetTimeout(guardedHandler, delay);
  };
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
  if (speechClockInstalled) installAutoAdvanceGuard();
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

function getCurrentQuestionKey() {
  const questionCounter = document.querySelector("#questionCounter")?.textContent ?? "";
  const questionText = document.querySelector("#questionText")?.textContent ?? "";
  return `${questionCounter}\n${questionText}`;
}

function isQuizVisible() {
  const questionCard = document.querySelector("#questionCard");
  const endScreen = document.querySelector("#endScreen");
  return Boolean(questionCard && !questionCard.hidden && endScreen?.hidden !== false);
}

function isCurrentQuestionAnswered() {
  return [...document.querySelectorAll("#choiceLabels .choice-label")]
    .some((label) => label.classList.contains("correct") || label.classList.contains("wrong"));
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

function buildQuestionSpeechText(question) {
  const choices = Array.isArray(question?.choices) ? question.choices : [];
  const choiceText = choices.map(speakableChoice).join("。 ");
  return choiceText
    ? `${question.text}。選択肢です。${choiceText}。`
    : String(question?.text ?? "");
}

function buildExplanationSpeechText(question) {
  const explanation = String(question?.explanation ?? "").trim();
  return explanation ? `回答の解説です。${explanation}` : "";
}

function getMasterQuestionNumber(question) {
  const idMatch = String(question?.id ?? "").trim().match(/^Q([0-9]+)$/i);
  if (!idMatch) return null;
  const idNumber = Number(idMatch[1]);
  const sourceNumber = Number.isInteger(question?.sourceLine) && question.sourceLine > 0
    ? question.sourceLine
    : idNumber;
  return Number.isInteger(sourceNumber) && sourceNumber > 0 ? sourceNumber : null;
}

export function getPreparedAudioPath(question, phase = "question") {
  const explicit = phase === "explanation" ? question?.explanationAudio : question?.audio;
  if (typeof explicit === "string" && explicit.trim()) return explicit.trim();

  const number = getMasterQuestionNumber(question);
  if (number === null) return null;
  const filename = `${String(number).padStart(3, "0")}.mp3`;
  return phase === "explanation"
    ? `${MASTER_EXPLANATION_AUDIO_DIRECTORY}${filename}`
    : `${MASTER_QUESTION_AUDIO_DIRECTORY}${filename}`;
}

function resolveLocalAudioUrl(path) {
  if (typeof path !== "string" || !path.trim()) return null;
  const value = path.trim();
  if (value.length > 300) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(value) || value.includes("\\") || value.split("/").includes("..")) return null;

  const url = new URL(value, window.location.href);
  if (url.origin !== window.location.origin) return null;
  const pathname = url.pathname.toLowerCase();
  if (!AUDIO_EXTENSIONS.some((extension) => pathname.endsWith(extension))) return null;
  return url.href;
}

function ensureSpeechControls() {
  let container = document.querySelector("#questionSpeechControls");
  if (container) {
    statusTextNode = container.querySelector("#questionSpeechStatusText");
    repeatButton = container.querySelector("#repeatQuestionSpeechButton");
    audioSlot = container.querySelector("#questionSpeechAudioSlot");
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
  statusTextNode.textContent = "🔊 用意された音声を優先して読み上げます";

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
    if (!question) return;
    const phase = isCurrentQuestionAnswered() ? "explanation" : "question";
    startPlayback(question, phase, true);
  });

  audioSlot = document.createElement("span");
  audioSlot.id = "questionSpeechAudioSlot";
  audioSlot.hidden = true;

  container.append(statusTextNode, repeatButton, audioSlot);
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

function clearAudioBinding({ hide = false } = {}) {
  currentAudioCleanup?.();
  currentAudioCleanup = null;
  if (currentAudio && !currentAudio.paused) currentAudio.pause();
  currentAudio = null;
  if (hide && audioSlot) {
    audioSlot.replaceChildren();
    audioSlot.hidden = true;
  }
}

function finishPlayback(token, message) {
  if (token !== speechToken) return;
  speaking = false;
  if (playbackPhase === "explanation") feedbackReading = false;
  currentUtterance = null;
  clearAudioBinding();
  resumeGameClock();
  setSpeechStatus(message, false);
}

function cancelCurrentPlayback() {
  speechToken += 1;
  speaking = false;
  feedbackReading = false;
  currentUtterance = null;
  try {
    globalThis.speechSynthesis?.cancel?.();
  } catch {
    // 読み上げ停止に失敗してもゲーム進行を継続します。
  }
  clearAudioBinding({ hide: true });
  resumeGameClock();
}

function startBrowserSpeech(question, phase, token, isRepeat, fallbackNotice = "") {
  if (token !== speechToken) return;
  clearAudioBinding({ hide: true });

  if (!("speechSynthesis" in globalThis) || typeof SpeechSynthesisUtterance === "undefined") {
    finishPlayback(token, fallbackNotice
      ? `${fallbackNotice} ブラウザ読み上げにも対応していません。`
      : "このブラウザは問題読み上げに対応していません。");
    return;
  }

  const text = phase === "explanation"
    ? buildExplanationSpeechText(question)
    : buildQuestionSpeechText(question);
  if (!text.trim()) {
    finishPlayback(token, phase === "explanation" ? "補足説明はありません。次へ進めます" : "読み上げる問題文がありません。");
    return;
  }

  const label = phase === "explanation" ? "回答後の解説" : "問題";
  setSpeechStatus(
    fallbackNotice
      ? `${fallbackNotice} 🔊 ブラウザ音声で${label}を読み上げています…`
      : isRepeat
        ? `🔊 ${label}をもう一度読み上げています…`
        : `🔊 ${label}を読み上げています…`,
    true
  );

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "ja-JP";
  utterance.rate = 0.95;
  utterance.pitch = 1;
  const voice = chooseJapaneseVoice();
  if (voice) utterance.voice = voice;

  utterance.onend = () => finishPlayback(
    token,
    phase === "explanation"
      ? "✅ 回答後の読み上げ終了。次へ進めます"
      : "✅ 問題の読み上げ終了。回答時間を開始しました"
  );
  utterance.onerror = (event) => {
    console.warn(`${label}のブラウザ読み上げに失敗しました。`, event.error ?? event);
    finishPlayback(
      token,
      phase === "explanation"
        ? "解説を読み上げできませんでした。次へ進めます"
        : "問題を読み上げできなかったため、回答時間を開始しました"
    );
  };

  currentUtterance = utterance;
  try {
    globalThis.speechSynthesis.cancel();
    globalThis.speechSynthesis.speak(utterance);
  } catch (error) {
    console.warn(`${label}のブラウザ読み上げを開始できませんでした。`, error);
    finishPlayback(
      token,
      phase === "explanation"
        ? "解説を読み上げできませんでした。次へ進めます"
        : "問題を読み上げできなかったため、回答時間を開始しました"
    );
  }
}

function findMatchingMediaAudio(url) {
  return [...document.querySelectorAll("#questionMedia audio")].find((audio) => {
    try {
      const actual = new URL(audio.currentSrc || audio.src, window.location.href).href;
      return actual === url;
    } catch {
      return false;
    }
  }) ?? null;
}

function createPreparedAudio(url, phase) {
  const existing = findMatchingMediaAudio(url);
  if (existing) return { audio: existing, owned: false };

  ensureSpeechControls();
  const audio = document.createElement("audio");
  audio.controls = true;
  audio.preload = "auto";
  audio.src = url;
  audio.setAttribute("aria-label", phase === "explanation" ? "回答後の解説音声" : "問題音声");
  audioSlot.replaceChildren(audio);
  audioSlot.hidden = false;
  return { audio, owned: true };
}

function startPreparedAudio(question, phase, token, isRepeat, path) {
  const url = resolveLocalAudioUrl(path);
  if (!url) {
    startBrowserSpeech(question, phase, token, isRepeat, "用意された音声パスを使用できないため、");
    return;
  }

  const { audio, owned } = createPreparedAudio(url, phase);
  currentAudio = audio;
  let fallbackStarted = false;

  const startFallback = (reason) => {
    if (fallbackStarted || token !== speechToken) return;
    fallbackStarted = true;
    console.warn(`用意された${phase === "explanation" ? "解説" : "問題"}音声を使用できませんでした。`, reason);
    startBrowserSpeech(
      question,
      phase,
      token,
      isRepeat,
      `用意された${phase === "explanation" ? "解説" : "問題"}音声を再生できないため、`
    );
  };

  const onPlay = () => {
    if (token !== speechToken) return;
    setSpeechStatus(
      phase === "explanation"
        ? "🔊 用意された回答後の解説音声を再生中です…"
        : "🔊 用意された問題音声を再生中です… 制限時間は停止中です",
      true
    );
  };

  const onPause = () => {
    if (token !== speechToken || audio.ended || audio.error || fallbackStarted) return;
    setSpeechStatus(
      phase === "explanation"
        ? "▶ 解説音声が一時停止中です。再生を続けてください"
        : "▶ 問題音声が一時停止中です。再生終了後に回答時間が始まります",
      true
    );
  };

  const onEnded = () => finishPlayback(
    token,
    phase === "explanation"
      ? "✅ 用意された解説音声の再生終了。次へ進めます"
      : "✅ 用意された問題音声の再生終了。回答時間を開始しました"
  );

  const onError = () => startFallback(audio.error ?? new Error("音声ファイルを読み込めませんでした。"));

  audio.addEventListener("play", onPlay);
  audio.addEventListener("pause", onPause);
  audio.addEventListener("ended", onEnded);
  audio.addEventListener("error", onError);
  currentAudioCleanup = () => {
    audio.removeEventListener("play", onPlay);
    audio.removeEventListener("pause", onPause);
    audio.removeEventListener("ended", onEnded);
    audio.removeEventListener("error", onError);
    if (owned && audioSlot?.contains(audio)) {
      // 再生後も「もう一度」用にプレイヤーは残します。
    }
  };

  setSpeechStatus(
    phase === "explanation"
      ? "🔊 用意された回答後の解説音声を準備しています…"
      : "🔊 用意された問題音声を準備しています… 制限時間は停止中です",
    true
  );

  if (owned) {
    try {
      audio.load();
    } catch (error) {
      startFallback(error);
      return;
    }
  }

  const playPromise = audio.play();
  if (playPromise && typeof playPromise.catch === "function") {
    playPromise.catch((error) => {
      if (token !== speechToken || fallbackStarted) return;
      if (error?.name === "NotAllowedError") {
        setSpeechStatus(
          phase === "explanation"
            ? "▶ 用意された解説音声の再生ボタンを押してください。再生終了まで次へ進みません"
            : "▶ 用意された問題音声の再生ボタンを押してください。再生終了後に回答時間が始まります",
          true
        );
        return;
      }
      if (error?.name !== "AbortError") startFallback(error);
    });
  }
}

function startPlayback(question, phase = "question", isRepeat = false) {
  cancelCurrentPlayback();
  const token = speechToken;
  playbackPhase = phase;
  speaking = true;
  feedbackReading = phase === "explanation";
  pauseGameClock();

  const preparedPath = getPreparedAudioPath(question, phase);
  if (preparedPath) {
    startPreparedAudio(question, phase, token, isRepeat, preparedPath);
    return;
  }

  startBrowserSpeech(question, phase, token, isRepeat);
}

function handleQuizStateChange() {
  if (!isQuizVisible()) {
    lastQuestionKey = "";
    lastAnsweredQuestionKey = "";
    cancelCurrentPlayback();
    return;
  }

  const questionKey = getCurrentQuestionKey();
  const questionText = document.querySelector("#questionText")?.textContent ?? "";
  if (!questionText.trim()) return;

  const question = getCurrentQuestion();
  if (!question) return;

  if (questionKey !== lastQuestionKey) {
    lastQuestionKey = questionKey;
    lastAnsweredQuestionKey = "";
    startPlayback(question, "question", false);
    return;
  }

  if (isCurrentQuestionAnswered() && questionKey !== lastAnsweredQuestionKey) {
    lastAnsweredQuestionKey = questionKey;
    startPlayback(question, "explanation", false);
  }
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

  const observer = new MutationObserver(() => queueMicrotask(handleQuizStateChange));
  const questionText = document.querySelector("#questionText");
  const questionCounter = document.querySelector("#questionCounter");
  const questionCard = document.querySelector("#questionCard");
  const choiceLabels = document.querySelector("#choiceLabels");
  const endScreen = document.querySelector("#endScreen");

  if (questionText) observer.observe(questionText, { childList: true, characterData: true, subtree: true });
  if (questionCounter) observer.observe(questionCounter, { childList: true, characterData: true, subtree: true });
  if (questionCard) observer.observe(questionCard, { attributes: true, attributeFilter: ["hidden"] });
  if (choiceLabels) {
    observer.observe(choiceLabels, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class"]
    });
  }
  if (endScreen) observer.observe(endScreen, { attributes: true, attributeFilter: ["hidden"] });

  window.addEventListener("keydown", (event) => {
    if (!speaking || event.code !== "Space") return;
    event.preventDefault();
    event.stopImmediatePropagation();
    setSpeechStatus(
      feedbackReading
        ? "🔊 回答後の読み上げ終了後に次へ進めます"
        : "🔊 問題の読み上げ終了後に回答できます",
      true
    );
  }, { capture: true });

  document.querySelector("#nextButton")?.addEventListener("click", (event) => {
    if (!speaking) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    setSpeechStatus(
      feedbackReading
        ? "🔊 回答後の読み上げ終了後に次へ進めます"
        : "🔊 問題の読み上げ終了後に回答できます",
      true
    );
  }, { capture: true });

  window.addEventListener("beforeunload", cancelCurrentPlayback, { once: true });
  handleQuizStateChange();
}
