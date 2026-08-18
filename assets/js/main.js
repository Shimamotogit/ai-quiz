import { configureQuestionDifficulty } from "./difficulty-filter.js?v=2";
import { initializeQuestionSource } from "./question-source.js?v=2";
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
import { installVoicevoxCredit } from "./voicevox-credit.js?v=2";
import { initializeQuizShowUI } from "./quiz-show-ui.js?v=2";
import { initializeAnswerVisualState } from "./answer-visual-state.js?v=2";
import { initializeQuizDefaults } from "./quiz-defaults.js?v=2";
import { initializeQuizPresentation } from "./quiz-presentation.js?v=2";
import {
  initializeGuideImageSupport,
  initializeNavigationPriority
} from "./navigation-priority.js?v=6";

async function loadChoiceDisplayFixStyles() {
  const existing = document.querySelector('link[data-choice-display-fixes="true"]');
  if (existing) return;

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = new URL("../css/choice-display-fixes.css?v=1", import.meta.url).href;
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
  link.href = new URL("../css/countdown-neutral.css?v=2", import.meta.url).href;
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

// 説明画像だけは、難易度選択を待たずタイトル表示直後から利用可能にする。
initializeGuideImageSupport();

await loadChoiceDisplayFixStyles();
await loadCountdownNeutralStyles();
await initializeQuestionSource();
const launchOptions = await initializeLaunchFlow();
configureQuestionDifficulty(launchOptions.difficulty);

// 全画面要求は実ユーザー操作が必要なので、stopImmediatePropagationするナビゲーション制御より先に登録する。
initializeQuizPresentation(launchOptions.difficulty);
initializeNavigationPriority();

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
