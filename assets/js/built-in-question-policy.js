const LOCAL_QUESTION_SOURCE_FLAG = "__aiQuizLocalSource";
const PROMPT_QUESTION_ID = "Q027";
const PROMPT_QUESTION_TEXT = "生成AIに与える指示文や質問テキストのことを「プロンプト」と呼ぶ。";
const VISUAL_DEPENDENCY_PATTERN = /(?:この|次の|上の)(?:画像|写真)|(?:画像|写真)を見て/;

function toQuestionNumber(question) {
  if (Number.isInteger(question?.sourceLine) && question.sourceLine > 0) return question.sourceLine;
  const match = String(question?.id ?? "").match(/^Q0*([1-9][0-9]*)$/i);
  return match ? Number(match[1]) : null;
}

export function requiresVisualAsset(question) {
  if (!question || typeof question !== "object") return false;
  if (typeof question.image === "string" && question.image.trim()) return true;
  if (typeof question.imageAlt === "string" && question.imageAlt.trim()) return true;
  return VISUAL_DEPENDENCY_PATTERN.test(String(question.text ?? ""));
}

function normalizePromptQuestion(question) {
  if (String(question?.id ?? "").toUpperCase() !== PROMPT_QUESTION_ID) return question;
  if (String(question?.text ?? "").trim() !== PROMPT_QUESTION_TEXT) return question;

  return {
    ...question,
    choices: ["〇", "✕"],
    correctIndex: 0
  };
}

function normalizeSourceMeta(sourceMeta, questions, removedQuestions) {
  if (!sourceMeta || typeof sourceMeta !== "object" || Array.isArray(sourceMeta)) return sourceMeta;

  const removedNumbers = new Set(removedQuestions.map(toQuestionNumber).filter(Number.isInteger));
  const skippedQuestions = Array.isArray(sourceMeta.skippedQuestions)
    ? sourceMeta.skippedQuestions.map((item) => ({ ...item }))
    : [];

  for (const no of removedNumbers) {
    if (!skippedQuestions.some((item) => item?.no === no)) {
      skippedQuestions.push({ no, reason: "画像・写真の提示を前提とする問題のため除外" });
    }
  }
  skippedQuestions.sort((a, b) => Number(a?.no ?? 0) - Number(b?.no ?? 0));

  const warnings = Array.isArray(sourceMeta.warnings)
    ? sourceMeta.warnings.filter((item) => !removedNumbers.has(item?.no))
    : sourceMeta.warnings;

  return {
    ...sourceMeta,
    usableQuestions: questions.length,
    skippedQuestions,
    ...(Array.isArray(warnings) ? { warnings } : {})
  };
}

export function normalizeBuiltInQuestionData(data) {
  if (!data || typeof data !== "object" || !Array.isArray(data.questions)) return data;

  const removedQuestions = data.questions.filter(requiresVisualAsset);
  const questions = data.questions
    .filter((question) => !requiresVisualAsset(question))
    .map(normalizePromptQuestion);

  return {
    ...data,
    questions,
    sourceMeta: normalizeSourceMeta(data.sourceMeta, questions, removedQuestions)
  };
}

function isQuestionsRequest(input) {
  try {
    const raw = typeof input === "string" || input instanceof URL ? input : input?.url;
    if (!raw) return false;
    const url = new URL(raw, window.location.href);
    return url.origin === window.location.origin && url.pathname.endsWith("/questions.json");
  } catch {
    return false;
  }
}

let installed = false;

export function installBuiltInQuestionPolicy() {
  if (installed) return;
  installed = true;

  const downstreamFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const response = await downstreamFetch(input, init);
    if (!isQuestionsRequest(input) || !response.ok) return response;

    let data;
    try {
      data = await response.clone().json();
    } catch {
      return response;
    }

    // 利用者が読み込んだローカルJSONは内容を勝手に変更しない。
    if (data?.[LOCAL_QUESTION_SOURCE_FLAG]) return response;

    const normalized = normalizeBuiltInQuestionData(data);
    const headers = new Headers(response.headers);
    headers.set("Content-Type", "application/json; charset=utf-8");
    headers.set("Cache-Control", "no-store");
    headers.delete("Content-Length");

    return new Response(JSON.stringify(normalized), {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  };
}
