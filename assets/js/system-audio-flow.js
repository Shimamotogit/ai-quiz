const CHOICE_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const SYSTEM_AUDIO_DIRECTORY = "音声データ_MP3/01.システム/";
const EXPLANATION_AUDIO_DIRECTORY_MARKER = "/音声データ_MP3/03.問題_補足説明/";

let questionData = [];
let initialized = false;
let systemSequenceActive = false;
let feedbackPreludeActive = false;
let feedbackPreludePromise = Promise.resolve();
let feedbackPreludeResolve = null;
let lastFeedbackKey = "";
let lastEndKey = "";
let allowStartThrough = false;
let allowRestartThrough = false;
let systemPanel = null;
let systemStatus = null;
let systemAudioSlot = null;
let currentSystemAudio = null;
let systemTtsActive = false;
let nativeMediaPlay = null;
let nativeSpeechSpeak = null;
let nativeSpeechCancel = null;

function normalizeChoiceText(value) {
  return String(value ?? "")
    .replace(/^[A-ZＡ-Ｚ][．.。]\s*/i, "")
    .trim();
}

function isCircle(value) {
  return ["〇", "○", "◯"].includes(normalizeChoiceText(value));
}

function isCross(value) {
  return ["✕", "×", "✖", "x", "X"].includes(normalizeChoiceText(value));
}

function systemAudioPath(filename) {
  return `${SYSTEM_AUDIO_DIRECTORY}${filename}`;
}

export function getAnswerSystemCue(question, answeredCorrect) {
  if (answeredCorrect) {
    return {
      filename: "正解です。.mp3",
      text: "正解です。"
    };
  }

  const correctIndex = Number(question?.correctIndex);
  const choices = Array.isArray(question?.choices) ? question.choices : [];
  const rawChoice = Number.isInteger(correctIndex) && correctIndex >= 0 && correctIndex < choices.length
    ? choices[correctIndex]
    : "";
  const normalized = normalizeChoiceText(rawChoice);

  if (isCircle(normalized)) {
    return {
      filename: "答えは、〇です！.mp3",
      text: "答えは、まるです！"
    };
  }

  if (isCross(normalized)) {
    return {
      filename: "答えは、×です！.mp3",
      text: "答えは、ばつです！"
    };
  }

  const prefix = String(rawChoice ?? "").trim().match(/^([A-ZＡ-Ｚ])[．.。]\s*/i)?.[1];
  const label = (prefix || CHOICE_LETTERS[correctIndex] || String(correctIndex + 1))
    .normalize("NFKC")
    .toUpperCase();

  return {
    filename: `答えは、${label}です！.mp3`,
    text: `答えは、${label}です！`
  };
}

export function getQuestionCountCue(count, includeTotalSuffix = false) {
  const safeCount = Number.isInteger(count) && count >= 0 ? count : 0;
  if (includeTotalSuffix) {
    return {
      filename: `${safeCount}問中.mp3`,
      text: `${safeCount}問中`
    };
  }

  return {
    filename: safeCount === 9 ? "９問.mp3" : `${safeCount}問.mp3`,
    text: `${safeCount}問`
  };
}

export function getGradeSystemCue(correctCount, totalCount) {
  const safeCorrect = Number.isFinite(correctCount) ? Math.max(0, correctCount) : 0;
  const safeTotal = Number.isFinite(totalCount) ? Math.max(0, totalCount) : 0;
  const ratio = safeTotal > 0 ? safeCorrect / safeTotal : 0;

  if (ratio >= 0.6) {
    return {
      filename: "とても良い結果です！.mp3",
      text: "とても良い結果です！"
    };
  }

  return {
    filename: "いい成績です.mp3",
    text: "いい成績です！"
  };
}

export function buildResultSystemSequence(correctCount, totalCount) {
  return [
    { filename: "お疲れ様でした.mp3", text: "お疲れ様でした。" },
    getQuestionCountCue(totalCount, true),
    getQuestionCountCue(correctCount, false),
    { filename: "正解です。.mp3", text: "正解です！" },
    getGradeSystemCue(correctCount, totalCount)
  ];
}

function resolveSameOriginAudioUrl(path) {
  if (typeof path !== "string" || !path.trim()) return null;
  const value = path.trim();
  if (value.length > 300) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(value) || value.includes("\\") || value.split("/").includes("..")) return null;

  const url = new URL(value, window.location.href);
  if (url.origin !== window.location.origin) return null;
  if (!url.pathname.toLowerCase().endsWith(".mp3")) return null;
  return url.href;
}

function ensureSystemPanel() {
  if (systemPanel) return systemPanel;

  systemPanel = document.createElement("section");
  systemPanel.id = "systemAudioPanel";
  systemPanel.hidden = true;
  systemPanel.setAttribute("role", "status");
  systemPanel.setAttribute("aria-live", "polite");
  systemPanel.style.position = "relative";
  systemPanel.style.zIndex = "30";
  systemPanel.style.margin = "0.75rem auto";
  systemPanel.style.padding = "0.75rem 1rem";
  systemPanel.style.maxWidth = "760px";
  systemPanel.style.borderRadius = "0.9rem";
  systemPanel.style.background = "rgba(15, 23, 42, 0.92)";
  systemPanel.style.color = "#f8fafc";
  systemPanel.style.textAlign = "center";

  systemStatus = document.createElement("p");
  systemStatus.id = "systemAudioStatusText";
  systemStatus.style.margin = "0 0 0.5rem";
  systemStatus.style.fontWeight = "800";

  systemAudioSlot = document.createElement("div");
  systemAudioSlot.id = "systemAudioSlot";

  systemPanel.append(systemStatus, systemAudioSlot);
  (document.querySelector("#stage") || document.body).append(systemPanel);
  return systemPanel;
}

function setSystemStatus(text, show = true) {
  ensureSystemPanel();
  systemPanel.hidden = !show;
  if (systemStatus) systemStatus.textContent = text;
}

function clearSystemAudio() {
  if (currentSystemAudio && !currentSystemAudio.paused) {
    try {
      currentSystemAudio.pause();
    } catch {
      // 終了処理は続行します。
    }
  }
  currentSystemAudio = null;
  if (systemAudioSlot) systemAudioSlot.replaceChildren();
}

function chooseJapaneseVoice() {
  const voices = globalThis.speechSynthesis?.getVoices?.() ?? [];
  return voices.find((voice) => /^ja(?:-|_)/i.test(voice.lang)) ?? null;
}

function speakSystemFallback(text, label) {
  return new Promise((resolve) => {
    const synth = globalThis.speechSynthesis;
    if (!synth || typeof SpeechSynthesisUtterance === "undefined" || !nativeSpeechSpeak) {
      setSystemStatus(`${label}の音声ファイルを再生できませんでした。`, true);
      resolve();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ja-JP";
    utterance.rate = 0.95;
    utterance.pitch = 1;
    const voice = chooseJapaneseVoice();
    if (voice) utterance.voice = voice;

    systemTtsActive = true;
    setSystemStatus(`🔊 ${label}をブラウザ音声で読み上げています…`, true);

    const finish = () => {
      systemTtsActive = false;
      resolve();
    };

    utterance.onend = finish;
    utterance.onerror = (event) => {
      console.warn(`${label}のブラウザ読み上げに失敗しました。`, event.error ?? event);
      finish();
    };

    try {
      nativeSpeechCancel?.();
      nativeSpeechSpeak(utterance);
    } catch (error) {
      console.warn(`${label}のブラウザ読み上げを開始できませんでした。`, error);
      finish();
    }
  });
}

async function playSystemCue(cue, label = cue.text) {
  const filename = cue?.filename;
  const text = String(cue?.text ?? "").trim();
  if (!filename) {
    if (text) await speakSystemFallback(text, label);
    return;
  }

  const url = resolveSameOriginAudioUrl(systemAudioPath(filename));
  if (!url) {
    if (text) await speakSystemFallback(text, label);
    return;
  }

  await new Promise((resolve) => {
    ensureSystemPanel();
    clearSystemAudio();

    const audio = document.createElement("audio");
    audio.controls = true;
    audio.preload = "auto";
    audio.src = url;
    audio.setAttribute("aria-label", label);
    systemAudioSlot.replaceChildren(audio);
    currentSystemAudio = audio;

    let settled = false;
    const cleanup = () => {
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      audio.removeEventListener("play", onPlay);
    };
    const finish = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    };
    const fallback = async (reason) => {
      if (settled) return;
      settled = true;
      cleanup();
      console.warn(`システム音声「${filename}」を再生できませんでした。`, reason);
      await speakSystemFallback(text || label, label);
      resolve();
    };
    const onEnded = () => finish();
    const onError = () => fallback(audio.error ?? new Error("音声ファイルを読み込めませんでした。"));
    const onPlay = () => setSystemStatus(`🔊 ${label}を再生中です…`, true);

    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    audio.addEventListener("play", onPlay);

    setSystemStatus(`🔊 ${label}を準備しています…`, true);

    try {
      audio.load();
    } catch (error) {
      fallback(error);
      return;
    }

    let playPromise;
    try {
      playPromise = nativeMediaPlay
        ? nativeMediaPlay.call(audio)
        : audio.play();
    } catch (error) {
      fallback(error);
      return;
    }

    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch((error) => {
        if (settled) return;
        if (error?.name === "NotAllowedError") {
          setSystemStatus(`▶ ${label}の再生ボタンを押してください`, true);
          return;
        }
        if (error?.name !== "AbortError") fallback(error);
      });
    }
  });
}

async function playSystemSequence(cues, statusLabel) {
  if (!Array.isArray(cues) || cues.length === 0) return;
  systemSequenceActive = true;
  setSystemStatus(statusLabel, true);
  try {
    for (const cue of cues) {
      await playSystemCue(cue, cue.text || statusLabel);
    }
  } finally {
    systemSequenceActive = false;
    clearSystemAudio();
    if (systemPanel) systemPanel.hidden = true;
  }
}

function isExplanationAudioElement(audio) {
  try {
    const url = new URL(audio.currentSrc || audio.src, window.location.href);
    const decodedPath = decodeURIComponent(url.pathname);
    return decodedPath.includes(EXPLANATION_AUDIO_DIRECTORY_MARKER);
  } catch {
    return false;
  }
}

function patchExplanationPlayback() {
  if (typeof HTMLMediaElement !== "undefined" && !nativeMediaPlay) {
    nativeMediaPlay = HTMLMediaElement.prototype.play;
    const original = nativeMediaPlay;
    HTMLMediaElement.prototype.play = function patchedPlay(...args) {
      if (feedbackPreludeActive && isExplanationAudioElement(this)) {
        return feedbackPreludePromise.then(() => original.apply(this, args));
      }
      return original.apply(this, args);
    };
  }

  const synth = globalThis.speechSynthesis;
  if (!synth || nativeSpeechSpeak) return;

  nativeSpeechSpeak = synth.speak.bind(synth);
  nativeSpeechCancel = synth.cancel.bind(synth);

  const wrappedSpeak = (utterance) => {
    const text = String(utterance?.text ?? "");
    if (feedbackPreludeActive && text.startsWith("回答の解説です。")) {
      feedbackPreludePromise.then(() => nativeSpeechSpeak(utterance));
      return;
    }
    nativeSpeechSpeak(utterance);
  };

  const wrappedCancel = () => {
    if (feedbackPreludeActive && systemTtsActive) return;
    nativeSpeechCancel();
  };

  try {
    synth.speak = wrappedSpeak;
    synth.cancel = wrappedCancel;
  } catch (error) {
    console.warn("回答後音声の順序制御を完全には初期化できませんでした。", error);
  }
}

function getCurrentQuestionKey() {
  const counter = document.querySelector("#questionCounter")?.textContent ?? "";
  const text = document.querySelector("#questionText")?.textContent ?? "";
  return `${counter}\n${text}`;
}

function getCurrentQuestion() {
  const text = document.querySelector("#questionText")?.textContent?.trim();
  if (!text) return null;
  return questionData.find((question) => question.text === text) ?? null;
}

function isCurrentQuestionAnswered() {
  return [...document.querySelectorAll("#choiceLabels .choice-label")]
    .some((label) => label.classList.contains("correct") || label.classList.contains("wrong"));
}

function wasCurrentAnswerCorrect() {
  return ![...document.querySelectorAll("#choiceLabels .choice-label")]
    .some((label) => label.classList.contains("wrong"));
}

function beginFeedbackPrelude(question, answeredCorrect) {
  feedbackPreludeActive = true;
  feedbackPreludePromise = new Promise((resolve) => {
    feedbackPreludeResolve = resolve;
  });

  const cue = getAnswerSystemCue(question, answeredCorrect);
  systemSequenceActive = true;

  playSystemCue(cue, cue.text)
    .catch((error) => console.warn("回答結果のシステム音声に失敗しました。", error))
    .finally(() => {
      systemSequenceActive = false;
      feedbackPreludeActive = false;
      feedbackPreludeResolve?.();
      feedbackPreludeResolve = null;
      if (systemPanel) systemPanel.hidden = true;
      clearSystemAudio();
    });
}

function handleAnswerStateChange() {
  if (!isCurrentQuestionAnswered()) return;

  const key = getCurrentQuestionKey();
  if (!key.trim() || key === lastFeedbackKey) return;

  const question = getCurrentQuestion();
  if (!question) return;

  lastFeedbackKey = key;
  beginFeedbackPrelude(question, wasCurrentAnswerCorrect());
}

function parseFinalResult() {
  const text = document.querySelector("#finalCorrectCount")?.textContent ?? "";
  const match = text.match(/([0-9]+)\s*問中\s*([0-9]+)\s*問正解/);
  if (!match) return null;
  return {
    totalCount: Number(match[1]),
    correctCount: Number(match[2])
  };
}

function isEndScreenVisible() {
  const endScreen = document.querySelector("#endScreen");
  return Boolean(endScreen && endScreen.hidden === false);
}

async function handleEndScreenChange() {
  if (!isEndScreenVisible()) {
    lastEndKey = "";
    return;
  }

  const result = parseFinalResult();
  if (!result) return;

  const endKey = `${result.totalCount}:${result.correctCount}`;
  if (endKey === lastEndKey) return;
  lastEndKey = endKey;

  await playSystemSequence(
    buildResultSystemSequence(result.correctCount, result.totalCount),
    "結果を読み上げています"
  );
}

function introSequence() {
  return [
    { filename: "ルールの説明です。.mp3", text: "ルールの説明です。" },
    { filename: "それでは、スタートです.mp3", text: "それでは、スタートです。" }
  ];
}

function installStartButtonGuard(button, restart = false) {
  if (!button) return;

  button.addEventListener("click", async (event) => {
    const allow = restart ? allowRestartThrough : allowStartThrough;
    if (allow) {
      if (restart) allowRestartThrough = false;
      else allowStartThrough = false;
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();

    if (systemSequenceActive || feedbackPreludeActive) {
      setSystemStatus("🔊 音声の再生終了後に開始できます", true);
      return;
    }

    await playSystemSequence(introSequence(), "開始前の案内を読み上げています");

    if (restart) allowRestartThrough = true;
    else allowStartThrough = true;
    button.click();
  }, { capture: true });
}

function installNavigationGuards() {
  const returnButton = document.querySelector("#returnToStartButton");
  returnButton?.addEventListener("click", (event) => {
    if (!systemSequenceActive) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    setSystemStatus("🔊 結果の読み上げ終了後に戻れます", true);
  }, { capture: true });
}

async function loadQuestionData() {
  const response = await fetch("questions.json", { cache: "no-store" });
  if (!response.ok) throw new Error(`システム音声用の問題データを読み込めませんでした (${response.status})`);
  const data = await response.json();
  questionData = Array.isArray(data.questions) ? data.questions : [];
}

export async function initializeSystemAudioFlow() {
  if (initialized) return;
  initialized = true;

  patchExplanationPlayback();
  ensureSystemPanel();

  try {
    await loadQuestionData();
  } catch (error) {
    console.error(error);
    questionData = [];
  }

  installStartButtonGuard(document.querySelector("#startQuizButton"), false);
  installStartButtonGuard(document.querySelector("#restartButton"), true);
  installNavigationGuards();

  const choiceLabels = document.querySelector("#choiceLabels");
  const endScreen = document.querySelector("#endScreen");

  const answerObserver = new MutationObserver(() => handleAnswerStateChange());
  if (choiceLabels) {
    answerObserver.observe(choiceLabels, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class"]
    });
  }

  const endObserver = new MutationObserver(() => {
    queueMicrotask(handleEndScreenChange);
  });
  if (endScreen) {
    endObserver.observe(endScreen, {
      attributes: true,
      attributeFilter: ["hidden"]
    });
  }

  window.addEventListener("beforeunload", () => {
    feedbackPreludeResolve?.();
    feedbackPreludeResolve = null;
    feedbackPreludeActive = false;
    systemSequenceActive = false;
    clearSystemAudio();
    nativeSpeechCancel?.();
  }, { once: true });

  handleAnswerStateChange();
  await handleEndScreenChange();
}
