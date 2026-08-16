const SAMPLE_QUESTIONS_URL = new URL("./questions.json", window.location.href).href;
const VALID_DIFFICULTIES = new Set(["kids", "adults", "all"]);
const LOCAL_QUESTION_SOURCE_FLAG = "__aiQuizLocalSource";
const DEFAULT_HOLD_DURATION_MS = 10000;
const DEFAULT_MAX_SCORE = 100;

let activeDifficulty = "all";
let installed = false;

function normalizeDifficulty(value) {
  return VALID_DIFFICULTIES.has(value) ? value : "all";
}

function questionMatchesDifficulty(question) {
  if (activeDifficulty === "all") return true;
  const difficulties = Array.isArray(question?.difficulty) ? question.difficulty : ["all"];
  return difficulties.includes("all") || difficulties.includes(activeDifficulty);
}

export function normalizeQuestionSettings(settings, questionCount, isLocalSource = false) {
  const output = { ...(settings ?? {}) };
  const requestedCount = Number(output.defaultQuestionCount);
  output.defaultQuestionCount = Number.isInteger(requestedCount)
    ? Math.min(questionCount, Math.max(1, requestedCount))
    : Math.min(5, questionCount);

  const requestedHoldDuration = Number(output.holdDurationMs);
  const validHoldDuration = Number.isInteger(requestedHoldDuration) &&
    requestedHoldDuration >= 500 && requestedHoldDuration <= 10000;
  output.holdDurationMs = validHoldDuration
    ? (!isLocalSource && requestedHoldDuration === 1200 ? DEFAULT_HOLD_DURATION_MS : requestedHoldDuration)
    : DEFAULT_HOLD_DURATION_MS;

  const requestedMaxScore = Number(output.defaultMaxScore);
  const minimumMaxScore = output.defaultQuestionCount;
  const fallbackMaxScore = Math.max(DEFAULT_MAX_SCORE, minimumMaxScore);
  const isLegacyBundledMaxScore = !isLocalSource && [500, 1000].includes(requestedMaxScore);
  output.defaultMaxScore = Number.isInteger(requestedMaxScore) && !isLegacyBundledMaxScore
    ? Math.max(minimumMaxScore, Math.min(100000, requestedMaxScore))
    : fallbackMaxScore;

  return output;
}

function filterQuestionData(data) {
  if (!Array.isArray(data?.questions)) return data;
  const questions = data.questions.filter(questionMatchesDifficulty);
  if (questions.length === 0) {
    throw new Error("選択した難易度で出題できる問題がありません。JSONのdifficultyを確認してください。");
  }

  const isLocalSource = data?.[LOCAL_QUESTION_SOURCE_FLAG] === true;
  return {
    ...data,
    settings: normalizeQuestionSettings(data.settings, questions.length, isLocalSource),
    questions
  };
}

function buildJsonResponse(data) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

export function configureQuestionDifficulty(difficulty) {
  activeDifficulty = normalizeDifficulty(difficulty);

  if (installed) return;
  installed = true;

  const previousFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const requestUrl = typeof input === "string" || input instanceof URL
      ? new URL(input, window.location.href).href
      : new URL(input.url, window.location.href).href;

    const response = await previousFetch(input, init);
    if (requestUrl !== SAMPLE_QUESTIONS_URL || !response.ok) return response;

    try {
      return buildJsonResponse(filterQuestionData(await response.clone().json()));
    } catch (error) {
      console.error(error);
      throw error;
    }
  };
}
