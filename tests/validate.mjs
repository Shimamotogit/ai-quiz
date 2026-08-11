import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  createPausableClock,
  parseRemainingSeconds
} from "../answer-timer-feedback.js";
import { convertQuestionMasterData } from "../question-master-adapter.js";

async function testActiveZoneColor() {
  const css = await readFile(new URL("../choice-display-fixes.css", import.meta.url), "utf8");
  const main = await readFile(new URL("../main.js", import.meta.url), "utf8");
  const palette = [
    "rgba(220, 38, 38, 0.62)",
    "rgba(37, 99, 235, 0.62)",
    "rgba(22, 163, 74, 0.62)",
    "rgba(202, 138, 4, 0.62)",
    "rgba(147, 51, 234, 0.62)",
    "rgba(8, 145, 178, 0.62)"
  ];
  const activeColor = "rgba(71, 85, 105, 0.82)";

  assert.match(css, /\.choice-label\.active\s*\{[^}]*background:\s*rgba\(71, 85, 105, 0\.82\)\s*!important/s);
  assert.ok(!palette.includes(activeColor), "現在位置の色が選択肢色と重複しています");
  assert.doesNotMatch(css, /rgba\(255, 0, 200/, "強すぎるマゼンタ色が残っています");

  const styleLoadIndex = main.indexOf("await loadChoiceDisplayFixStyles();");
  const appImportIndex = main.indexOf('await import("./app.js")');
  assert.ok(styleLoadIndex >= 0 && appImportIndex > styleLoadIndex, "回答表示用CSSがapp.jsより後に読み込まれています");
  console.log("✓ 1. 現在位置は控えめなスレートグレーで、選択肢色と重複しない");
}

async function testTwoChoiceBadgeVisibility() {
  const css = await readFile(new URL("../choice-display-fixes.css", import.meta.url), "utf8");
  const quizMedia = await readFile(new URL("../quiz-media.js", import.meta.url), "utf8");

  assert.match(
    css,
    /\.choice-labels:has\(> \.choice-label:nth-child\(2\):last-child\) \.choice-badge\s*\{[^}]*display:\s*none/s,
    "2択専用のバッジ非表示ルールがありません"
  );
  assert.match(
    quizMedia,
    /const CHOICE_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"\.split\(""\);/,
    "3択以上で使うABCの定義が削除されています"
  );
  assert.match(quizMedia, /badge\.textContent = badgeText;/, "3択以上のバッジ生成処理が削除されています");
  console.log("✓ 2. 2択だけバッジを隠し、3択以上のABC表示は維持");
}

async function testExplanationVisibility() {
  const css = await readFile(new URL("../feature-ui.css", import.meta.url), "utf8");

  assert.match(css, /\.question-explanation\s*\{[^}]*font-size:\s*clamp\(1\.3rem, 2\.3vw, 1\.85rem\)/s);
  assert.match(css, /\.question-explanation\s*\{[^}]*border:\s*4px solid #facc15/s);
  assert.match(css, /\.question-explanation::before\s*\{[^}]*回答の解説/s);
  assert.match(css, /@keyframes explanation-pop/);
  console.log("✓ 3. 解説は大文字・強調枠・見出し・表示アニメーション付き");
}

function testPausableClock() {
  let realNow = 1000;
  const clock = createPausableClock(() => realNow);

  assert.equal(clock.now(), 1000);
  realNow = 1120;
  assert.equal(clock.now(), 1120);

  clock.pause();
  realNow = 2120;
  assert.equal(clock.now(), 1120, "音声待機中に回答用時計が進んでいます");
  assert.equal(clock.isPaused(), true);

  clock.resume();
  assert.equal(clock.isPaused(), false);
  realNow = 2320;
  assert.equal(clock.now(), 1320, "音声終了後の時計再開位置が不正です");

  clock.pause();
  realNow = 2820;
  clock.resume();
  realNow = 2920;
  assert.equal(clock.now(), 1420, "複数回の音声待機時間を正しく除外できません");
  console.log("✓ 4a. 音声待機中は時計停止、終了後は連続した時刻から再開");
}

function testRemainingSecondsParser() {
  assert.equal(parseRemainingSeconds("東京：あと 1.2 秒"), 1.2);
  assert.equal(parseRemainingSeconds("あと0.5秒"), 0.5);
  assert.equal(parseRemainingSeconds("回答エリアへ移動してください"), null);
  console.log("✓ 4b. 残り秒数を画面表示用に正しく解析");
}

async function testTimerUiAndBootOrder() {
  const css = await readFile(new URL("../feature-ui.css", import.meta.url), "utf8");
  const main = await readFile(new URL("../main.js", import.meta.url), "utf8");

  assert.match(css, /\.answer-timer-value\s*\{[^}]*font-size:\s*clamp\(3\.4rem, 8vw, 5\.8rem\)/s);
  assert.match(css, /\.answer-timer-progress/);

  const installIndex = main.indexOf("installAnswerTimingGuard();");
  const speechClockIndex = main.indexOf("installQuestionSpeechClock();");
  const appImportIndex = main.indexOf('await import("./app.js")');
  const initializeIndex = main.indexOf("await initializeAnswerTimerFeedback();");
  const speechInitializeIndex = main.indexOf("await initializeQuestionSpeech();");
  assert.ok(installIndex >= 0 && appImportIndex > installIndex, "時間制御がapp.jsより後に初期化されています");
  assert.ok(speechClockIndex > installIndex && appImportIndex > speechClockIndex, "読み上げ用時計がapp.jsより後に初期化されています");
  assert.ok(initializeIndex > appImportIndex, "カウントダウンUIがapp.jsより前に初期化されています");
  assert.ok(speechInitializeIndex > initializeIndex, "問題読み上げがタイマーUIより前に初期化されています");
  console.log("✓ 4c. 大型残り秒数UIと読み上げ用時計を安全な順序で初期化");
}

async function testQuestionMasterConversion() {
  const text = await readFile(new URL("../questions.json", import.meta.url), "utf8");
  const data = JSON.parse(text);
  assert.equal(data.sourceMeta?.totalQuestions, 50);
  assert.equal(data.sourceMeta?.usableQuestions, 45);
  assert.equal(data.questions.length, 45);
  assert.deepEqual(data.sourceMeta?.skippedQuestions?.map((item) => item.no), [21, 22, 23, 24, 26]);

  const q1 = data.questions.find((question) => question.id === "Q001");
  const q25 = data.questions.find((question) => question.id === "Q025");
  assert.equal(q1?.correctIndex, 0);
  assert.deepEqual(q1?.difficulty, ["kids"]);
  assert.equal(q25?.correctIndex, 0);
  assert.deepEqual(q25?.difficulty, ["adults"]);

  const syntheticMaster = {
    schema_version: "1.0",
    questions: [
      {
        id: "Q900",
        no: 900,
        adopted: true,
        question: "テスト問題",
        choice_type: "true_false",
        choices: ["〇", "✕"],
        answer: "✕",
        target: { children: true, adults: false, employees: false },
        supplemental_comment: "テスト解説",
        validation_warnings: []
      }
    ]
  };
  const converted = convertQuestionMasterData(syntheticMaster);
  assert.equal(converted.questions[0].text, "テスト問題");
  assert.equal(converted.questions[0].correctIndex, 1);
  assert.deepEqual(converted.questions[0].difficulty, ["kids"]);
  console.log("✓ 5. 添付マスタ形式を既存出題形式へ変換し、不完全な5問を安全に除外");
}

async function testQuestionSpeechImplementation() {
  const speech = await readFile(new URL("../question-speech.js", import.meta.url), "utf8");
  assert.match(speech, /new SpeechSynthesisUtterance\(text\)/);
  assert.match(speech, /utterance\.lang = "ja-JP"/);
  assert.match(speech, /pauseGameClock\(\)/);
  assert.match(speech, /utterance\.onend = \(\) => finishSpeech/);
  assert.match(speech, /resumeGameClock\(\)/);
  assert.match(speech, /event\.stopImmediatePropagation\(\)/);
  console.log("✓ 6. 問題を日本語で読み上げ、終了まで回答用時計とスペース回答を停止");
}

await testActiveZoneColor();
await testTwoChoiceBadgeVisibility();
await testExplanationVisibility();
testPausableClock();
testRemainingSecondsParser();
await testTimerUiAndBootOrder();
await testQuestionMasterConversion();
await testQuestionSpeechImplementation();

console.log("All validation checks passed.");
