const TRUE_MARKS = new Set(["〇", "○", "◯"]);
const FALSE_MARKS = new Set(["✕", "×", "✖", "x", "X"]);

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeMark(value) {
  const text = normalizeText(value).normalize("NFKC");
  if (TRUE_MARKS.has(text)) return "true";
  if (FALSE_MARKS.has(text)) return "false";
  return text;
}

function stripChoicePrefix(value) {
  return normalizeText(value)
    .replace(/^[A-ZＡ-Ｚ][．.。]\s*/i, "")
    .trim();
}

function resolveDifficulty(target) {
  if (!isPlainObject(target)) return ["all"];
  const difficulty = [];
  if (target.children === true) difficulty.push("kids");
  if (target.adults === true || target.employees === true) difficulty.push("adults");
  return difficulty.length > 0 ? [...new Set(difficulty)] : ["all"];
}

function resolveCorrectIndex(question) {
  const choices = Array.isArray(question.choices) ? question.choices : [];
  const answer = normalizeMark(question.answer);
  const choiceType = normalizeText(question.choice_type).toLowerCase();

  if (!answer) return -1;

  if (choiceType === "true_false") {
    if (answer !== "true" && answer !== "false") return -1;
    return choices.findIndex((choice) => normalizeMark(stripChoicePrefix(choice)) === answer);
  }

  const letterMatch = answer.match(/^[A-Z]$/i);
  if (letterMatch) {
    const index = answer.toUpperCase().charCodeAt(0) - 65;
    return index >= 0 && index < choices.length ? index : -1;
  }

  const exactIndex = choices.findIndex((choice) => normalizeText(choice) === normalizeText(question.answer));
  if (exactIndex >= 0) return exactIndex;

  const normalizedAnswer = stripChoicePrefix(question.answer);
  return choices.findIndex((choice) => stripChoicePrefix(choice) === normalizedAnswer);
}

function copyOptionalString(target, key, value) {
  const text = normalizeText(value);
  if (text) target[key] = text;
}

export function isQuestionMasterData(input) {
  if (!isPlainObject(input) || !Array.isArray(input.questions) || input.questions.length === 0) return false;
  return input.questions.some((question) => (
    isPlainObject(question) &&
    Object.prototype.hasOwnProperty.call(question, "question") &&
    Object.prototype.hasOwnProperty.call(question, "answer") &&
    Object.prototype.hasOwnProperty.call(question, "choice_type")
  ));
}

export function convertQuestionMasterData(input) {
  if (!isQuestionMasterData(input)) return input;

  const convertedQuestions = [];
  const skipped = [];
  const sourceWarnings = [];

  input.questions.forEach((question, index) => {
    if (!isPlainObject(question) || question.adopted === false) {
      skipped.push({ no: question?.no ?? index + 1, reason: "未採用または問題形式が不正" });
      return;
    }

    const text = normalizeText(question.question);
    const choices = Array.isArray(question.choices)
      ? question.choices.map(normalizeText).filter(Boolean)
      : [];
    const correctIndex = resolveCorrectIndex(question);

    if (!text || choices.length < 2 || correctIndex < 0 || correctIndex >= choices.length) {
      skipped.push({
        no: question.no ?? index + 1,
        reason: !normalizeText(question.answer)
          ? "回答が未設定"
          : "回答を選択肢へ対応付けできない"
      });
      return;
    }

    const converted = {
      id: normalizeText(question.id) || `Q${String(question.no ?? index + 1).padStart(3, "0")}`,
      text,
      choices,
      correctIndex,
      difficulty: resolveDifficulty(question.target)
    };

    copyOptionalString(converted, "explanation", question.supplemental_comment);
    copyOptionalString(converted, "image", question.image);
    if (converted.image) converted.imageAlt = text;
    if (Number.isInteger(question.no) && question.no > 0) converted.sourceLine = question.no;

    const warnings = Array.isArray(question.validation_warnings)
      ? question.validation_warnings.map(normalizeText).filter(Boolean)
      : [];
    if (warnings.length > 0) {
      sourceWarnings.push({ no: question.no ?? index + 1, warnings });
    }

    convertedQuestions.push(converted);
  });

  if (convertedQuestions.length === 0) {
    throw new Error("この問題マスタには出題可能な問題がありません。回答と選択肢を確認してください。");
  }

  return {
    settings: isPlainObject(input.settings) ? input.settings : {},
    questions: convertedQuestions,
    sourceMeta: {
      schemaVersion: normalizeText(input.schema_version),
      title: normalizeText(input.title),
      totalQuestions: input.questions.length,
      usableQuestions: convertedQuestions.length,
      skippedQuestions: skipped,
      warnings: sourceWarnings
    }
  };
}

export function adaptQuestionData(input) {
  return isQuestionMasterData(input) ? convertQuestionMasterData(input) : input;
}
