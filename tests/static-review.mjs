import assert from "node:assert/strict";

// Browser依存モジュールをNode上で読み込むため、URL解決とfetchだけ最小限用意する。
globalThis.window = {
  location: { href: "https://example.test/quiz/" },
  fetch: globalThis.fetch.bind(globalThis)
};

const {
  LOCAL_QUESTION_SOURCE_FLAG,
  buildLocalRuntimeQuestionData,
  validateAndSanitizeQuestionData
} = await import("../question-source.js");
const { normalizeQuestionSettings } = await import("../difficulty-filter.js");
const { getPreparedAudioPath } = await import("../question-speech.js");
const { normalizeHoldDurationSeconds } = await import("../quiz-defaults.js");
const { normalizeDefaultMaxScore } = await import("../quiz-show-ui.js");

const localInput = {
  settings: {
    holdDurationMs: 1200,
    defaultQuestionCount: 2,
    defaultMaxScore: 500
  },
  questions: [
    {
      id: "Q001",
      text: "ローカル問題1",
      choices: ["〇", "✕"],
      correctIndex: 0,
      audio: "audio/question-1.mp3",
      explanationAudio: "audio/explanation-1.mp3"
    },
    {
      id: "Q002",
      text: "ローカル問題2",
      choices: ["A", "B"],
      correctIndex: 1
    }
  ]
};

const sanitized = validateAndSanitizeQuestionData(localInput);
assert.equal(sanitized.settings.holdDurationMs, 1200, "ローカルJSONで明示した1.2秒が失われています");
assert.equal(sanitized.settings.defaultMaxScore, 500, "ローカルJSONで明示した500点が失われています");
assert.equal(sanitized.questions[0].explanationAudio, "audio/explanation-1.mp3", "解説音声パスが検証時に失われています");

const defaults = validateAndSanitizeQuestionData({
  questions: [{ text: "既定値確認", choices: ["〇", "✕"], correctIndex: 0 }]
});
assert.equal(defaults.settings.holdDurationMs, 10000, "設定省略時の回答時間は10秒である必要があります");
assert.equal(defaults.settings.defaultMaxScore, 100, "設定省略時の最大点数は100点である必要があります");

const bundledNormalized = normalizeQuestionSettings({
  holdDurationMs: 1200,
  defaultQuestionCount: 10,
  defaultMaxScore: 1000
}, 44, false);
assert.equal(bundledNormalized.holdDurationMs, 10000, "組み込み問題の旧1.2秒を10秒へ移行できていません");
assert.equal(bundledNormalized.defaultMaxScore, 100, "組み込み問題の旧1000点を100点へ移行できていません");

const localNormalized = normalizeQuestionSettings(sanitized.settings, sanitized.questions.length, true);
assert.equal(localNormalized.holdDurationMs, 1200, "ローカル問題の明示1.2秒を上書きしてはいけません");
assert.equal(localNormalized.defaultMaxScore, 500, "ローカル問題の明示500点を上書きしてはいけません");
assert.equal(normalizeHoldDurationSeconds(1.2), 1.2, "有効な明示回答時間を既定値補正で上書きしてはいけません");
assert.equal(normalizeDefaultMaxScore(500, 2), 500, "有効な明示最大点数を既定値補正で上書きしてはいけません");
assert.equal(normalizeDefaultMaxScore(Number.NaN, 2), 100, "無効な最大点数だけを100点へ補正する必要があります");

const runtimeLocal = buildLocalRuntimeQuestionData(sanitized);
assert.equal(runtimeLocal[LOCAL_QUESTION_SOURCE_FLAG], true, "ローカル問題の実行時識別情報がありません");
assert.equal(runtimeLocal.questions[0].id, "local:Q001", "Q形式のローカルIDを組み込み問題と区別できていません");
assert.equal(runtimeLocal.questions[1].id, "local:Q002", "Q形式のローカルIDを組み込み問題と区別できていません");
assert.equal(
  getPreparedAudioPath(runtimeLocal.questions[0], "question"),
  "audio/question-1.mp3",
  "ローカル問題で明示した問題音声は優先する必要があります"
);
assert.equal(
  getPreparedAudioPath(runtimeLocal.questions[0], "explanation"),
  "audio/explanation-1.mp3",
  "ローカル問題で明示した解説音声は優先する必要があります"
);
assert.equal(
  getPreparedAudioPath(runtimeLocal.questions[1], "question"),
  null,
  "音声未指定のローカルQ形式問題に組み込みMP3を誤対応させてはいけません"
);
assert.equal(
  getPreparedAudioPath({ id: "Q002", sourceLine: 2 }, "question"),
  "音声データ_MP3/02.問題/002.mp3",
  "組み込み問題の既存MP3自動対応は維持する必要があります"
);

console.log("✓ 静的レビュー: 既定値/明示設定、ローカル音声、explanationAudioの回帰を検証");
