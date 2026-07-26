const SAMPLE_QUESTIONS_URL = new URL("./questions.json", window.location.href).href;
const VALID_DIFFICULTIES = new Set(["kids", "adults", "all"]);

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

function normalizeSettings(settings, questionCount) {
  const output = { ...(settings ?? {}) };
  const requestedCount = Number(output.defaultQuestionCount);
  output.defaultQuestionCount = Number.isInteger(requestedCount)
    ? Math.min(questionCount, Math.max(1, requestedCount))
    : Math.min(5, questionCount);

  const requestedMaxScore = Number(output.defaultMaxScore);
  output.defaultMaxScore = Number.isInteger(requestedMaxScore)
    ? Math.max(output.defaultQuestionCount, Math.min(100000, requestedMaxScore))
    : output.defaultQuestionCount * 100;

  return output;
}

function filterQuestionData(data) {
  if (!Array.isArray(data?.questions)) return data;
  const questions = data.questions.filter(questionMatchesDifficulty);
  if (questions.length === 0) {
    throw new Error("選択した難易度で出題できる問題がありません。JSONのdifficultyを確認してください。");
  }

  return {
    ...data,
    settings: normalizeSettings(data.settings, questions.length),
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
