import { configureQuestionDifficulty } from "./difficulty-filter.js";
import { initializeQuestionSource } from "./question-source.js";
import {
  initializeLaunchFlow,
  installReturnToTitleHandler
} from "./launch-flow.js";

await initializeQuestionSource();
const launchOptions = await initializeLaunchFlow();
configureQuestionDifficulty(launchOptions.difficulty);

await import("./detector-compat.js");
await import("./app.js");

const { initializeQuizMedia } = await import("./quiz-media.js");
await initializeQuizMedia();
installReturnToTitleHandler();
