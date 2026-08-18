const STEP_IDS = [
  "titleStep",
  "difficultyStep",
  "gameStep",
  "cameraStep",
  "participantStep",
  "answerStep"
];

const PENDING_DIFFICULTY_KEY = "camera-ai-quiz-pending-difficulty";
const VALID_DIFFICULTIES = new Set(["kids", "adults", "all"]);

let appLoaded = false;
let navigationHandlersInstalled = false;
let pendingLaunchResolve = null;

function $(selector) {
  return document.querySelector(selector);
}

function showSetupStep(stepName) {
  const setupPanel = $("#setupPanel");
  if (setupPanel) {
    setupPanel.hidden = false;
    setupPanel.classList.remove("participant-mode");
  }

  $("#endScreen")?.setAttribute("hidden", "");
  $("#questionCard")?.setAttribute("hidden", "");
  $("#choiceLabels")?.setAttribute("hidden", "");
  $("#quizControls")?.setAttribute("hidden", "");
  $("#overlay")?.classList.remove("selecting");

  for (const id of STEP_IDS) {
    const element = document.getElementById(id);
    if (element) element.hidden = id !== `${stepName}Step`;
  }

  document.querySelectorAll("[data-step]").forEach((item) => {
    item.classList.toggle("active", item.dataset.step === stepName);
  });
}

function normalizeDifficulty(value) {
  return VALID_DIFFICULTIES.has(value) ? value : "all";
}

function setPendingDifficulty(difficulty) {
  sessionStorage.setItem(PENDING_DIFFICULTY_KEY, normalizeDifficulty(difficulty));
}

function consumePendingDifficulty() {
  const value = normalizeDifficulty(sessionStorage.getItem(PENDING_DIFFICULTY_KEY));
  sessionStorage.removeItem(PENDING_DIFFICULTY_KEY);
  return value;
}

function announceDifficulty(difficulty) {
  const names = {
    kids: "子ども向け",
    adults: "大人向け",
    all: "すべて"
  };
  const status = $("#gameSettingsStatus");
  if (status) {
    status.textContent = `${names[difficulty] ?? "すべて"}の問題を使用します。`;
  }
}

function selectDifficulty(difficulty) {
  const normalized = normalizeDifficulty(difficulty);
  if (appLoaded) {
    setPendingDifficulty(normalized);
    window.location.reload();
    return;
  }

  showSetupStep("game");
  announceDifficulty(normalized);
  pendingLaunchResolve?.({ difficulty: normalized });
  pendingLaunchResolve = null;
}

function installSetupNavigationHandlers() {
  if (navigationHandlersInstalled) return;
  navigationHandlersInstalled = true;

  $("#showDifficultyButton")?.addEventListener("click", () => showSetupStep("difficulty"));
  $("#backToTitleButton")?.addEventListener("click", () => showSetupStep("title"));
  $("#backToDifficultyButton")?.addEventListener("click", () => showSetupStep("difficulty"));

  document.querySelectorAll("[data-difficulty-choice]").forEach((button) => {
    button.addEventListener("click", () => selectDifficulty(button.dataset.difficultyChoice));
  });
}

export function initializeLaunchFlow() {
  // pendingDifficulty 経由の再読み込み時も、戻る／難易度選択のイベントを必ず登録する。
  installSetupNavigationHandlers();

  const pendingDifficulty = sessionStorage.getItem(PENDING_DIFFICULTY_KEY);
  if (pendingDifficulty) {
    const difficulty = consumePendingDifficulty();
    showSetupStep("game");
    announceDifficulty(difficulty);
    return Promise.resolve({ difficulty });
  }

  showSetupStep("title");

  return new Promise((resolve) => {
    pendingLaunchResolve = resolve;
  });
}

export function installReturnToTitleHandler() {
  appLoaded = true;

  $("#returnToStartButton")?.addEventListener("click", () => {
    window.setTimeout(() => showSetupStep("title"), 0);
  });
}
