import { adaptQuestionData } from "./question-master-adapter.js";

const DATABASE_NAME = "camera-ai-quiz-local-data";
const DATABASE_VERSION = 1;
const STORE_NAME = "questionSources";
const ACTIVE_SOURCE_KEY = "active";
const SAMPLE_QUESTIONS_URL = new URL("./questions.json", window.location.href).href;

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_QUESTIONS = 10000;
const MAX_QUESTION_TEXT_LENGTH = 1000;
const MAX_CHOICES_PER_QUESTION = 20;
const MAX_CHOICE_TEXT_LENGTH = 500;
const MAX_ID_LENGTH = 120;
const MAX_EXTRA_TEXT_LENGTH = 2000;
const MAX_MEDIA_PATH_LENGTH = 240;

let activeQuestionSource = null;
const nativeFetch = window.fetch.bind(window);

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("ブラウザ内保存領域を開けませんでした。"));
    request.onblocked = () => reject(new Error("別のタブが保存領域を使用中です。ほかのタブを閉じて再試行してください。"));
  });
}

async function runStoreRequest(mode, operation) {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode);
      const store = transaction.objectStore(STORE_NAME);
      const request = operation(store);
      let result;

      request.onsuccess = () => {
        result = request.result;
      };
      request.onerror = () => reject(request.error ?? new Error("ブラウザ内保存処理に失敗しました。"));
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => reject(transaction.error ?? new Error("ブラウザ内保存処理に失敗しました。"));
      transaction.onabort = () => reject(transaction.error ?? new Error("ブラウザ内保存処理が中断されました。"));
    });
  } finally {
    database.close();
  }
}

function readStoredSource() {
  return runStoreRequest("readonly", (store) => store.get(ACTIVE_SOURCE_KEY));
}

function saveStoredSource(source) {
  return runStoreRequest("readwrite", (store) => store.put(source, ACTIVE_SOURCE_KEY));
}

function clearStoredSource() {
  return runStoreRequest("readwrite", (store) => store.delete(ACTIVE_SOURCE_KEY));
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function requireTrimmedString(value, label, maxLength) {
  if (typeof value !== "string") {
    throw new Error(`${label}は文字列で指定してください。`);
  }

  const text = value.trim();
  if (!text) throw new Error(`${label}が空です。`);
  if (text.length > maxLength) {
    throw new Error(`${label}は${maxLength}文字以内にしてください。`);
  }
  return text;
}

function optionalTrimmedString(value, label, maxLength) {
  if (value === undefined || value === null || value === "") return undefined;
  return requireTrimmedString(value, label, maxLength);
}

function optionalBoundedInteger(value, fallback, min, max, label) {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${label}は${min}〜${max}の整数で指定してください。`);
  }
  return value;
}

function optionalLocalMediaPath(value, label, extensions) {
  const path = optionalTrimmedString(value, label, MAX_MEDIA_PATH_LENGTH);
  if (path === undefined) return undefined;
  if (/^[a-z][a-z0-9+.-]*:/i.test(path) || path.includes("\\") || path.split("/").includes("..")) {
    throw new Error(`${label}は同一サイト内の相対パスで指定してください。`);
  }
  const lowerPath = path.toLowerCase().split("?")[0].split("#")[0];
  if (!extensions.some((extension) => lowerPath.endsWith(extension))) {
    throw new Error(`${label}の拡張子が許可されていません。`);
  }
  return path;
}

function normalizeDifficulty(value) {
  const normalized = String(value ?? "").normalize("NFKC").trim().toLowerCase();
  if (["kids", "kid", "children", "child", "子供", "子ども", "子供向け", "子ども向け"].includes(normalized)) return "kids";
  if (["adults", "adult", "大人", "大人向け"].includes(normalized)) return "adults";
  if (["all", "すべて", "全部"].includes(normalized)) return "all";
  return null;
}

function sanitizeDifficulties(value, questionNumber) {
  if (value === undefined || value === null || value === "") return ["all"];
  const values = Array.isArray(value) ? value : [value];
  const difficulties = [...new Set(values.map(normalizeDifficulty).filter(Boolean))];
  if (difficulties.length === 0) {
    throw new Error(`問題${questionNumber}のdifficultyはkids/adults/allで指定してください。`);
  }
  return difficulties.includes("all") ? ["all"] : difficulties;
}

function sanitizeSourceMeta(value) {
  if (!isPlainObject(value)) return undefined;
  const totalQuestions = Number.isInteger(value.totalQuestions) && value.totalQuestions >= 0
    ? value.totalQuestions
    : undefined;
  const usableQuestions = Number.isInteger(value.usableQuestions) && value.usableQuestions >= 0
    ? value.usableQuestions
    : undefined;
  const skippedCount = Array.isArray(value.skippedQuestions) ? value.skippedQuestions.length : 0;
  const warningCount = Array.isArray(value.warnings) ? value.warnings.length : 0;
  return {
    title: typeof value.title === "string" ? value.title.slice(0, 200) : "",
    schemaVersion: typeof value.schemaVersion === "string" ? value.schemaVersion.slice(0, 40) : "",
    totalQuestions,
    usableQuestions,
    skippedCount,
    warningCount
  };
}

export function validateAndSanitizeQuestionData(rawInput) {
  const input = adaptQuestionData(rawInput);
  if (!isPlainObject(input)) {
    throw new Error("JSONの最上位はオブジェクトにしてください。");
  }

  if (!Array.isArray(input.questions) || input.questions.length === 0) {
    throw new Error("questionsには1問以上の問題を設定してください。");
  }

  if (input.questions.length > MAX_QUESTIONS) {
    throw new Error(`問題数は安全上${MAX_QUESTIONS}問以下にしてください。`);
  }

  const usedIds = new Set();
  const questions = input.questions.map((question, index) => {
    const questionNumber = index + 1;
    if (!isPlainObject(question)) {
      throw new Error(`問題${questionNumber}はオブジェクトで指定してください。`);
    }

    const id = question.id === undefined
      ? `q${questionNumber}`
      : requireTrimmedString(question.id, `問題${questionNumber}のid`, MAX_ID_LENGTH);

    if (usedIds.has(id)) {
      throw new Error(`問題ID「${id}」が重複しています。`);
    }
    usedIds.add(id);

    const text = requireTrimmedString(
      question.text,
      `問題${questionNumber}のtext`,
      MAX_QUESTION_TEXT_LENGTH
    );

    if (!Array.isArray(question.choices)) {
      throw new Error(`問題${questionNumber}のchoicesは配列で指定してください。`);
    }
    if (question.choices.length < 2 || question.choices.length > MAX_CHOICES_PER_QUESTION) {
      throw new Error(`問題${questionNumber}の選択肢は2〜${MAX_CHOICES_PER_QUESTION}個にしてください。`);
    }

    const choices = question.choices.map((choice, choiceIndex) => requireTrimmedString(
      choice,
      `問題${questionNumber}の選択肢${choiceIndex + 1}`,
      MAX_CHOICE_TEXT_LENGTH
    ));

    if (
      !Number.isInteger(question.correctIndex) ||
      question.correctIndex < 0 ||
      question.correctIndex >= choices.length
    ) {
      throw new Error(`問題${questionNumber}のcorrectIndexが選択肢の範囲外です。`);
    }

    const sanitized = {
      id,
      text,
      choices,
      correctIndex: question.correctIndex,
      difficulty: sanitizeDifficulties(question.difficulty, questionNumber)
    };

    const explanation = optionalTrimmedString(question.explanation, `問題${questionNumber}のexplanation`, MAX_EXTRA_TEXT_LENGTH);
    if (explanation !== undefined) sanitized.explanation = explanation;

    const image = optionalLocalMediaPath(question.image, `問題${questionNumber}のimage`, [".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"]);
    if (image !== undefined) sanitized.image = image;

    const imageAlt = optionalTrimmedString(question.imageAlt, `問題${questionNumber}のimageAlt`, 200);
    if (imageAlt !== undefined) sanitized.imageAlt = imageAlt;

    const audio = optionalLocalMediaPath(question.audio, `問題${questionNumber}のaudio`, [".mp3"]);
    if (audio !== undefined) sanitized.audio = audio;

    if (Number.isInteger(question.sourceLine) && question.sourceLine > 0) sanitized.sourceLine = question.sourceLine;

    return sanitized;
  });

  const rawSettings = input.settings === undefined ? {} : input.settings;
  if (!isPlainObject(rawSettings)) {
    throw new Error("settingsはオブジェクトで指定してください。");
  }

  const defaultQuestionCount = optionalBoundedInteger(
    rawSettings.defaultQuestionCount,
    Math.min(5, questions.length),
    1,
    questions.length,
    "settings.defaultQuestionCount"
  );

  const settings = {
    holdDurationMs: optionalBoundedInteger(
      rawSettings.holdDurationMs,
      1200,
      500,
      10000,
      "settings.holdDurationMs"
    ),
    resultDisplayMs: optionalBoundedInteger(
      rawSettings.resultDisplayMs,
      1300,
      300,
      10000,
      "settings.resultDisplayMs"
    ),
    spaceCountdownSeconds: optionalBoundedInteger(
      rawSettings.spaceCountdownSeconds,
      3,
      1,
      10,
      "settings.spaceCountdownSeconds"
    ),
    defaultQuestionCount,
    defaultMaxScore: optionalBoundedInteger(
      rawSettings.defaultMaxScore,
      defaultQuestionCount * 100,
      defaultQuestionCount,
      100000,
      "settings.defaultMaxScore"
    )
  };

  const sourceMeta = sanitizeSourceMeta(input.sourceMeta);
  return sourceMeta ? { settings, questions, sourceMeta } : { settings, questions };
}

async function parseQuestionFile(file) {
  if (!(file instanceof File)) throw new Error("JSONファイルを選択してください。");
  if (!file.name.toLowerCase().endsWith(".json")) {
    throw new Error("拡張子が.jsonのファイルを選択してください。");
  }
  if (file.size <= 0) throw new Error("選択したファイルが空です。");
  if (file.size > MAX_FILE_BYTES) {
    throw new Error("JSONファイルは10MB以下にしてください。");
  }

  let parsed;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    throw new Error("JSONの構文が正しくありません。");
  }

  return validateAndSanitizeQuestionData(parsed);
}

function buildLocalResponse(data) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

function installLocalQuestionFetch() {
  window.fetch = (input, init) => {
    const requestUrl = typeof input === "string" || input instanceof URL
      ? new URL(input, window.location.href).href
      : new URL(input.url, window.location.href).href;

    if (requestUrl === SAMPLE_QUESTIONS_URL && activeQuestionSource?.data) {
      return Promise.resolve(buildLocalResponse(activeQuestionSource.data));
    }

    return nativeFetch(input, init);
  };
}

function describeSourceMeta(data) {
  const meta = data?.sourceMeta;
  if (!meta || !Number.isInteger(meta.totalQuestions) || !Number.isInteger(meta.usableQuestions)) return "";
  const skipped = Math.max(0, meta.totalQuestions - meta.usableQuestions);
  return skipped > 0
    ? `（全${meta.totalQuestions}問中${meta.usableQuestions}問を出題可能、${skipped}問は回答不備などのため除外）`
    : `（${meta.usableQuestions}問）`;
}

function updateSourceStatus() {
  const status = document.querySelector("#questionSourceStatus");
  const sampleButton = document.querySelector("#useSampleQuestionsButton");
  if (!status || !sampleButton) return;

  if (activeQuestionSource?.data) {
    status.textContent = `ローカル問題「${activeQuestionSource.name}」を使用中（${activeQuestionSource.data.questions.length}問）${describeSourceMeta(activeQuestionSource.data)}。内容はサーバーへ送信されません。`;
    sampleButton.disabled = false;
  } else {
    status.textContent = "添付のAIクイズ問題マスタから生成した問題セットを使用中です。別のJSONを選択するとブラウザ内だけで切り替えられます。";
    sampleButton.disabled = true;
  }
}

function setControlsBusy(isBusy) {
  const input = document.querySelector("#questionFileInput");
  const sampleButton = document.querySelector("#useSampleQuestionsButton");
  if (input) input.disabled = isBusy;
  if (sampleButton) sampleButton.disabled = isBusy || !activeQuestionSource;
}

function attachQuestionSourceControls() {
  const input = document.querySelector("#questionFileInput");
  const sampleButton = document.querySelector("#useSampleQuestionsButton");
  const status = document.querySelector("#questionSourceStatus");
  if (!input || !sampleButton || !status) return;

  updateSourceStatus();

  input.addEventListener("change", async () => {
    const [file] = input.files ?? [];
    if (!file) return;

    setControlsBusy(true);
    status.textContent = "JSONをブラウザ内で確認しています…";

    try {
      const data = await parseQuestionFile(file);
      const source = {
        version: 3,
        name: file.name.slice(0, 255),
        savedAt: new Date().toISOString(),
        data
      };
      await saveStoredSource(source);
      activeQuestionSource = source;
      status.textContent = `「${source.name}」を保存しました。ローカル問題へ切り替えます…`;
      window.location.reload();
    } catch (error) {
      console.error(error);
      status.textContent = error instanceof Error ? error.message : "JSONファイルを読み込めませんでした。";
      input.value = "";
      setControlsBusy(false);
    }
  });

  sampleButton.addEventListener("click", async () => {
    setControlsBusy(true);
    status.textContent = "ローカル問題を削除し、添付マスタ由来の問題セットへ戻しています…";
    try {
      await clearStoredSource();
      activeQuestionSource = null;
      window.location.reload();
    } catch (error) {
      console.error(error);
      status.textContent = "ブラウザ内の問題データを削除できませんでした。";
      setControlsBusy(false);
    }
  });
}

async function loadActiveQuestionSource() {
  if (!("indexedDB" in window)) return null;

  try {
    const stored = await readStoredSource();
    if (!stored?.data) return null;

    return {
      version: 3,
      name: typeof stored.name === "string" ? stored.name.slice(0, 255) : "ローカル問題.json",
      savedAt: typeof stored.savedAt === "string" ? stored.savedAt : "",
      data: validateAndSanitizeQuestionData(stored.data)
    };
  } catch (error) {
    console.warn("ローカル問題データを読み込めませんでした。既定の問題セットを使用します。", error);
    try {
      await clearStoredSource();
    } catch {
      // 保存領域が利用できない場合も既定の問題セットで続行します。
    }
    return null;
  }
}

export async function initializeQuestionSource() {
  activeQuestionSource = await loadActiveQuestionSource();
  installLocalQuestionFetch();
  attachQuestionSourceControls();
}
