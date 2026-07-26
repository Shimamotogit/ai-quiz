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

installAnswerTimingGuard();
await loadChoiceDisplayFixStyles();
await initializeQuestionSource();
const launchOptions = await initializeLaunchFlow();
configureQuestionDifficulty(launchOptions.difficulty);

await import("./detector-compat.js");
await import("./app.js");

const { initializeQuizMedia } = await import("./quiz-media.js");
await initializeQuizMedia();
await initializeAnswerTimerFeedback();
installReturnToTitleHandler();
