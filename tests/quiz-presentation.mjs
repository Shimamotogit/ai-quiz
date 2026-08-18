import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { getKidsHiraganaQuestion, getKidsHiraganaQuestionCount, isCircleCrossQuestion } from "../assets/js/quiz-presentation.js";

const questions = JSON.parse(await readFile(new URL("../questions.json", import.meta.url), "utf8"));
const kidsQuestions = questions.questions.filter((question) => question.difficulty?.includes("kids"));
assert.equal(kidsQuestions.length, 20, "組み込みの子ども向け問題数が想定と変わっています");
assert.equal(getKidsHiraganaQuestionCount(), kidsQuestions.length, "子ども向け問題のひらがな読みが不足しています");
for (const question of kidsQuestions) {
  const hiragana = getKidsHiraganaQuestion(question.text);
  assert.ok(hiragana, `${question.id} のひらがな表示がありません`);
  assert.doesNotMatch(hiragana, /[\u3400-\u9fff]/u, `${question.id} のひらがな表示に漢字が残っています: ${hiragana}`);
}
assert.equal(isCircleCrossQuestion(["〇", "✕"]), true);
assert.equal(isCircleCrossQuestion(["○", "×"]), true);
assert.equal(isCircleCrossQuestion(["はい", "いいえ"]), false);
assert.equal(isCircleCrossQuestion(["〇", "〇"]), false);
assert.equal(isCircleCrossQuestion(["A", "B", "C"]), false);

const presentationSource = await readFile(new URL("../assets/js/quiz-presentation.js", import.meta.url), "utf8");
const presentationCss = await readFile(new URL("../assets/css/quiz-presentation.css", import.meta.url), "utf8");
const mainSource = await readFile(new URL("../assets/js/main.js", import.meta.url), "utf8");
const indexSource = await readFile(new URL("../index.html", import.meta.url), "utf8");
for (const text of ["ルールの説明です。", "問題の出題後、〇・×、正解だと思う位置に移動してください。", "一度移動した後は、そのままの状態をキープしてください。"]) {
  assert.ok(presentationSource.includes(text), `ルール案内に「${text}」がありません`);
}
assert.ok(presentationSource.includes('const RULE_AUDIO_FILENAME = "ルールの説明です。.mp3"'));
assert.ok(presentationSource.includes('audio.addEventListener("play", () => showRuleOverlay(audio))'));
assert.ok(presentationSource.includes('audio.addEventListener("ended", () => hideRuleOverlay(audio))'));
assert.ok(presentationSource.includes('"#startQuizButton", "#restartButton"'), "開始/再開ボタンの全画面化対象が不足しています");
assert.ok(presentationSource.includes("event.isTrusted"), "全画面要求を実ユーザー操作に限定していません");
assert.ok(presentationSource.includes('stage.requestFullscreen({ navigationUI: "hide" })'), "クイズ開始時の全画面要求がありません");
assert.ok(indexSource.includes('id="fullscreenButton"'), "手動の全画面ボタンが削除されています");
assert.ok(presentationSource.includes('readingMode = activeDifficulty === "kids" ? "hiragana" : "kanji"'), "子ども向けのひらがな初期値がありません");
assert.ok(presentationSource.includes('createReadingModeOption("hiragana"'), "ひらがな選択肢がありません");
assert.ok(presentationSource.includes('createReadingModeOption("kanji"'), "漢字まじり選択肢がありません");
assert.ok(presentationCss.includes("#questionText.hiragana-question-text::after"), "ひらがな表示用スタイルがありません");
assert.match(presentationCss, /#choiceLabels\.large-circle-cross \.choice-label\s*\{[^}]*font-size:\s*clamp\(4\.75rem, 12vw, 9\.5rem\)\s*!important/s);
const presentationInit = mainSource.indexOf("initializeQuizPresentation(launchOptions.difficulty)");
const systemAudioInit = mainSource.indexOf("initializeSystemAudioFlow()");
assert.ok(presentationInit >= 0 && systemAudioInit >= 0 && presentationInit < systemAudioInit, "全画面開始ハンドラがシステム音声ガードより先に初期化されていません");
console.log("✓ ルール中央表示・開始時全画面・子ども向けひらがな・〇×拡大を検証");
