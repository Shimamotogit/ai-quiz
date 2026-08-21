import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  normalizeBuiltInQuestionData,
  requiresVisualAsset
} from "../assets/js/built-in-question-policy.js";

const raw = JSON.parse(readFileSync(resolve("questions.json"), "utf8"));
const normalized = normalizeBuiltInQuestionData(raw);

assert.equal(raw.questions.length, 45, "元の組み込み問題数が想定外に変わっています");
assert.equal(
  raw.questions.filter((question) => typeof question.image === "string" && question.image.trim()).length,
  0,
  "現在のquestions.jsonに画像ファイルを直接指定した問題があります"
);

const promptQuestion = normalized.questions.find((question) => question.id === "Q027");
assert.ok(promptQuestion, "Q027が組み込み問題から消えています");
assert.equal(
  promptQuestion.text,
  "生成AIに与える指示文や質問テキストのことを「プロンプト」と呼ぶ。",
  "Q027の問題文が指定文言と一致しません"
);
assert.deepEqual(promptQuestion.choices, ["〇", "✕"], "Q027が〇✕問題になっていません");
assert.equal(promptQuestion.correctIndex, 0, "Q027の正解は〇である必要があります");

assert.equal(normalized.questions.some((question) => question.id === "Q012"), false, "画像提示前提のQ012が出題対象に残っています");
assert.equal(normalized.questions.length, 44, "Q012除外後の出題可能問題数は44問である必要があります");
assert.equal(normalized.sourceMeta?.usableQuestions, 44, "sourceMetaの出題可能問題数が44問に更新されていません");
assert.ok(
  normalized.sourceMeta?.skippedQuestions?.some((item) => item.no === 12 && String(item.reason).includes("画像")),
  "Q012の除外理由がsourceMetaに記録されていません"
);
assert.equal(
  normalized.sourceMeta?.warnings?.some((item) => item.no === 12),
  false,
  "出題対象外になったQ012の警告が残っています"
);

assert.equal(normalized.questions.filter(requiresVisualAsset).length, 0, "画像・写真の提示を前提とする問題が出題対象に残っています");
for (const id of ["Q005", "Q007", "Q049"]) {
  assert.ok(
    normalized.questions.some((question) => question.id === id),
    `${id}は写真について説明する文章問題であり、画像表示不要なので除外してはいけません`
  );
}

console.log("✓ Q027の〇✕化と、写真・画像提示が必要な組み込み問題の除外を検証");
