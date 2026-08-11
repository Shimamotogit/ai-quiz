import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  createPausableClock,
  parseRemainingSeconds
} from "../answer-timer-feedback.js";
import { convertQuestionMasterData } from "../question-master-adapter.js";
import { getPreparedAudioPath } from "../question-speech.js";

async function testCalmChoiceDesign() {
  const css = await readFile(new URL("../choice-display-fixes.css", import.meta.url), "utf8");
  const featureCss = await readFile(new URL("../feature-ui.css", import.meta.url), "utf8");
  const main = await readFile(new URL("../main.js", import.meta.url), "utf8");

  assert.match(css, /\.choice-label\.active\s*\{[^}]*background:\s*rgba\(229, 241, 237, 0\.94\)\s*!important/s);
  assert.match(css, /box-shadow:\s*inset 0 0 0 4px #176b5c/s);
  assert.doesNotMatch(css, /rgba\(255, 0, 200/, "強いマゼンタ色が回答UIに戻っています");
  assert.doesNotMatch(featureCss, /choice-color-[1-6][^}]*rgba\(220, 38, 38|rgba\(37, 99, 235|rgba\(147, 51, 234/s, "回答ゾーンに強い多色表現が戻っています");

  const styleLoadIndex = main.indexOf("await loadChoiceDisplayFixStyles();");
  const appImportIndex = main.indexOf('await import("./app.js")');
  assert.ok(styleLoadIndex >= 0 && appImportIndex > styleLoadIndex, "回答表示用CSSがapp.jsより後に読み込まれています");
  console.log("✓ 1. 回答位置はニュートラル面＋単一アクセントで表示");
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

async function testExplanationDesign() {
  const css = await readFile(new URL("../feature-ui.css", import.meta.url), "utf8");

  assert.match(css, /\.question-explanation\s*\{[^}]*border-left:\s*4px solid var\(--accent\)/s);
  assert.match(css, /\.question-explanation\s*\{[^}]*background:\s*var\(--surface\)/s);
  assert.match(css, /\.question-explanation::before\s*\{[^}]*content:\s*"解説"/s);
  assert.match(css, /\.question-explanation\s*\{[^}]*animation:\s*none/s);
  assert.doesNotMatch(css, /#facc15|explanation-pop|0 0 34px/, "旧来の黄色発光・ポップ演出が戻っています");
  console.log("✓ 3. 解説はマットな通常カード＋左アクセントで表示");
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

  assert.match(css, /\.answer-timer-value\s*\{[^}]*font-size:\s*clamp\(3\.2rem, 8vw, 5\.4rem\)/s);
  assert.match(css, /\.answer-timer-progress/);
  assert.match(css, /\.answer-timer-progress > span\s*\{[^}]*background:\s*var\(--accent\)/s);

  const installIndex = main.indexOf("installAnswerTimingGuard();");
  const speechClockIndex = main.indexOf("installQuestionSpeechClock();");
  const appImportIndex = main.indexOf('await import("./app.js")');
  const initializeIndex = main.indexOf("await initializeAnswerTimerFeedback();");
  const speechInitializeIndex = main.indexOf("await initializeQuestionSpeech();");
  assert.ok(installIndex >= 0 && appImportIndex > installIndex, "時間制御がapp.jsより後に初期化されています");
  assert.ok(speechClockIndex > installIndex && appImportIndex > speechClockIndex, "読み上げ用時計がapp.jsより後に初期化されています");
  assert.ok(initializeIndex > appImportIndex, "カウントダウンUIがapp.jsより前に初期化されています");
  assert.ok(speechInitializeIndex > initializeIndex, "問題読み上げがタイマーUIより前に初期化されています");
  console.log("✓ 4c. 読みやすい残り秒数UIと読み上げ用時計を安全な順序で初期化");
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

  const masterQuestion = { id: "Q001", sourceLine: 1 };
  assert.equal(getPreparedAudioPath(masterQuestion, "question"), "音声データ_MP3/02.問題/001.mp3");
  assert.equal(getPreparedAudioPath(masterQuestion, "explanation"), "音声データ_MP3/03.問題_補足説明/001.mp3");
  assert.equal(
    getPreparedAudioPath({ ...masterQuestion, audio: "audio/custom-question.mp3" }, "question"),
    "audio/custom-question.mp3"
  );
  assert.equal(
    getPreparedAudioPath({ ...masterQuestion, explanationAudio: "audio/custom-explanation.mp3" }, "explanation"),
    "audio/custom-explanation.mp3"
  );

  assert.match(speech, /new SpeechSynthesisUtterance\(text\)/);
  assert.match(speech, /utterance\.lang = "ja-JP"/);
  assert.match(speech, /audio\.play\(\)/);
  assert.match(speech, /startBrowserSpeech/);
  assert.match(speech, /feedbackReading/);
  assert.match(speech, /looksLikeQuizAutoAdvance/);
  assert.match(speech, /pauseGameClock\(\)/);
  assert.match(speech, /resumeGameClock\(\)/);
  assert.match(speech, /event\.stopImmediatePropagation\(\)/);
  console.log("✓ 6. 用意済みMP3を問題・回答後解説で優先し、無い場合だけブラウザ読み上げへフォールバック");
}

async function testCalmVisualLanguage() {
  const styles = await readFile(new URL("../styles.css", import.meta.url), "utf8");
  const featureCss = await readFile(new URL("../feature-ui.css", import.meta.url), "utf8");
  const index = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const combined = `${styles}\n${featureCss}`;

  assert.match(styles, /color-scheme:\s*light/);
  assert.match(styles, /--accent:\s*#176b5c/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(combined, /radial-gradient|backdrop-filter|rgba\(255, 0, 200|0 0 34px/i, "AIデモ風の強い演出がCSSへ戻っています");
  assert.match(index, /<title>立ち位置クイズ \| AIリテラシー<\/title>/);
  assert.match(index, /<h1 id="setupTitle">立ち位置クイズ<\/h1>/);
  assert.match(index, /テーマ：AIリテラシー/);
  assert.doesNotMatch(index, /カメラAI立ち位置クイズ|高精度人物検出モデル/);
  console.log("✓ 7. ニュートラルな学習サービスの視覚言語と文言を維持");
}

await testCalmChoiceDesign();
await testTwoChoiceBadgeVisibility();
await testExplanationDesign();
testPausableClock();
testRemainingSecondsParser();
await testTimerUiAndBootOrder();
await testQuestionMasterConversion();
await testQuestionSpeechImplementation();
await testCalmVisualLanguage();

console.log("All validation checks passed.");
