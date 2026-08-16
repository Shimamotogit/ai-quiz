import { configureQuestionDifficulty } from "./difficulty-filter.js";
import { initializeQuestionSource } from "./question-source.js";
import {
  initializeLaunchFlow,
  installReturnToTitleHandler
} from "./launch-flow.js";
import {
  initializeAnswerTimerFeedback,
  installAnswerTimingGuard
} from "./answer-timer-feedback.js";
import {
  initializeQuestionSpeech,
  installQuestionSpeechClock
} from "./question-speech.js";
import { initializeSystemAudioFlow } from "./system-audio-flow.js";
import { installSystemAudioAlias } from "./system-audio-alias.js";
import { installVoicevoxCredit } from "./voicevox-credit.js";
import { initializeQuizShowUI } from "./quiz-show-ui.js";
import { initializeAnswerVisualState } from "./answer-visual-state.js?v=2";
import { initializeQuizDefaults } from "./quiz-defaults.js?v=1";
import { initializeQuizPresentation } from "./quiz-presentation.js?v=1";

async function loadChoiceDisplayFixStyles() {
  const existing = document.querySelector('link[data-choice-display-fixes="true"]');
  if (existing) return;

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = new URL("./choice-display-fixes.css", window.location.href).href;
  link.dataset.choiceDisplayFixes = "true";

  await new Promise((resolve) => {
    const finish = () => resolve();
    link.addEventListener("load", finish, { once: true });
    link.addEventListener("error", () => {
      console.warn("回答表示用の追加スタイルを読み込めませんでした。");
      finish();
    }, { once: true });
    document.head.append(link);
    window.setTimeout(finish, 2000);
  });
}

async function loadCountdownNeutralStyles() {
  const existing = document.querySelector('link[data-countdown-neutral="true"]');
  if (existing) return;

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = new URL("./countdown-neutral.css?v=1", window.location.href).href;
  link.dataset.countdownNeutral = "true";

  await new Promise((resolve) => {
    const finish = () => resolve();
    link.addEventListener("load", finish, { once: true });
    link.addEventListener("error", () => {
      console.warn("カウントダウン用スタイルを読み込めませんでした。");
      finish();
    }, { once: true });
    document.head.append(link);
    window.setTimeout(finish, 2000);
  });
}

installAnswerTimingGuard();
installQuestionSpeechClock();
installSystemAudioAlias();
installVoicevoxCredit();
await loadChoiceDisplayFixStyles();
await loadCountdownNeutralStyles();
await initializeQuestionSource();
const launchOptions = await initializeLaunchFlow();
configureQuestionDifficulty(launchOptions.difficulty);

// ユーザーの最初のスタート操作で全画面要求を出せるよう、音声ガードより先に登録する。
initializeQuizPresentation(launchOptions.difficulty);

await import("./detector-compat.js");
await import("./app.js");
initializeQuizDefaults();

const { initializeQuizMedia } = await import("./quiz-media.js");
await initializeQuizMedia();
await initializeAnswerTimerFeedback();

// 再スタート時は結果画面を先に消す必要があるため、音声ガードより先に登録する。
initializeQuizShowUI();
await initializeSystemAudioFlow();
await initializeQuestionSpeech();
// 採点後の見た目正規化は、正誤を読む音声監視より後に登録する。
initializeAnswerVisualState();
installReturnToTitleHandler();
