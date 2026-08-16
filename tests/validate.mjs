import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  createPausableClock,
  parseRemainingSeconds
} from "../answer-timer-feedback.js";
import { convertQuestionMasterData } from "../question-master-adapter.js";
import { getPreparedAudioPath } from "../question-speech.js";
import { normalizeDefaultMaxScore } from "../quiz-show-ui.js";

async function testQuizChoiceDesign() {
  const css = await readFile(new URL("../choice-display-fixes.css", import.meta.url), "utf8");
  const uiFixes = await readFile(new URL("../ui-stability-fixes.css", import.meta.url), "utf8");
  const main = await readFile(new URL("../main.js", import.meta.url), "utf8");

  assert.match(css, /\.choice-label\.active\s*\{[^}]*background:\s*rgba\(248, 249, 251, 0\.98\)\s*!important/s);
  assert.match(css, /box-shadow:\s*inset 0 0 0 3px rgba\(101, 115, 138, 0\.72\)/s);
  assert.match(uiFixes, /\.choice-text\s*\{[^}]*text-overflow:\s*clip\s*!important/s);
  assert.match(uiFixes, /\.choice-text\s*\{[^}]*white-space:\s*normal\s*!important/s);
  assert.doesNotMatch(css, /#ffc83d|rgba\(255, 0, 200/i, "回答位置の黄色・マゼンタ強調が戻っています");

  const styleLoadIndex = main.indexOf("await loadChoiceDisplayFixStyles();");
  const appImportIndex = main.indexOf('await import("./app.js")');
  assert.ok(styleLoadIndex >= 0 && appImportIndex > styleLoadIndex, "回答表示用CSSがapp.jsより後に読み込まれています");
  console.log("✓ 1. 回答文は省略せず、現在位置は薄い全周枠で表示");
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

async function testCompactExplanationDesign() {
  const css = await readFile(new URL("../feature-ui.css", import.meta.url), "utf8");
  const uiFixes = await readFile(new URL("../ui-stability-fixes.css", import.meta.url), "utf8");
  const quizMedia = await readFile(new URL("../quiz-media.js", import.meta.url), "utf8");

  assert.match(css, /\.quiz-feedback-panel\s*\{[^}]*max-height:\s*112px/s);
  assert.match(css, /\.quiz-feedback-panel\s*\{[^}]*bottom:\s*calc\(22% \+ 10px\)/s);
  assert.match(uiFixes, /\.quiz-feedback-panel\s*\{[^}]*border:\s*1px solid rgba\(23, 32, 51, 0\.30\)\s*!important/s);
  assert.match(quizMedia, /function ensureFeedbackPanel\(\)/);
  assert.match(quizMedia, /stage\.append\(feedbackPanel\)/);
  assert.match(quizMedia, /stage\.append\(container\)/, "問題メディアが問題バー内に残っています");
  assert.doesNotMatch(uiFixes, /quiz-yellow|#ffc83d/i, "解説等の上辺に黄色アクセントが戻っています");
  console.log("✓ 3. 解説は低い横長帯を維持し、黄色ではなく薄い全周枠で表示");
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
  const uiFixes = await readFile(new URL("../ui-stability-fixes.css", import.meta.url), "utf8");
  const main = await readFile(new URL("../main.js", import.meta.url), "utf8");

  assert.match(css, /\.answer-timer-panel\s*\{[^}]*width:\s*250px/s);
  assert.match(css, /\.answer-timer-value\s*\{[^}]*font-size:\s*clamp\(1\.8rem, 3vw, 2\.55rem\)/s);
  assert.match(uiFixes, /\.answer-timer-progress > span\s*\{[^}]*background:\s*#aab5c5\s*!important/s);
  assert.match(css, /\.answer-timer-help\s*\{\s*display:\s*none/s);

  const installIndex = main.indexOf("installAnswerTimingGuard();");
  const speechClockIndex = main.indexOf("installQuestionSpeechClock();");
  const appImportIndex = main.indexOf('await import("./app.js")');
  const initializeIndex = main.indexOf("await initializeAnswerTimerFeedback();");
  const quizUiIndex = main.indexOf("initializeQuizShowUI();");
  const systemAudioIndex = main.indexOf("await initializeSystemAudioFlow();");
  const speechInitializeIndex = main.indexOf("await initializeQuestionSpeech();");

  assert.ok(installIndex >= 0 && appImportIndex > installIndex, "時間制御がapp.jsより後に初期化されています");
  assert.ok(speechClockIndex > installIndex && appImportIndex > speechClockIndex, "読み上げ用時計がapp.jsより後に初期化されています");
  assert.ok(initializeIndex > appImportIndex, "カウントダウンUIがapp.jsより前に初期化されています");
  assert.ok(quizUiIndex > initializeIndex, "クイズ画面制御がタイマーUIより前に初期化されています");
  assert.ok(systemAudioIndex > quizUiIndex, "再スタート画面制御より先にシステム音声ガードが登録されています");
  assert.ok(speechInitializeIndex > systemAudioIndex, "問題読み上げがシステム音声より前に初期化されています");
  console.log("✓ 4c. 小型タイマーと画面切替→システム音声の初期化順序を維持");
}

async function testRestartTransitionBeforeAudio() {
  const flow = await readFile(new URL("../quiz-show-ui.js", import.meta.url), "utf8");

  assert.match(flow, /function handleRestart\(event\)/);
  assert.match(flow, /showRoundTransition\("restart"\);/);
  assert.match(flow, /void waitForSystemAudioIdle\(\)\.then/);
  assert.match(flow, /if \(endScreen\) endScreen\.hidden = true;/, "前回結果を先に隠す処理がありません");
  assert.match(flow, /restartButton"\)\?\.addEventListener\("click", handleRestart, \{ capture: true \}\)/);

  const restartFunction = flow.slice(flow.indexOf("function handleRestart"), flow.indexOf("function applyDefaultMaxScore"));
  assert.ok(
    restartFunction.indexOf('showRoundTransition("restart")') < restartFunction.indexOf("waitForSystemAudioIdle"),
    "結果画面の切替より先に音声待機処理が走っています"
  );

  assert.doesNotMatch(flow, /QUESTION_FONT_(?:MIN|MAX)|fitQuestionText|ResizeObserver/, "問題文の動的サイズ調整処理が残っています");
  console.log("✓ 5. 再スタート順序を維持し、問題文の動的縮小は完全に廃止");
}

async function testStableTextAndDefaultScore() {
  const uiFixes = await readFile(new URL("../ui-stability-fixes.css", import.meta.url), "utf8");
  const flow = await readFile(new URL("../quiz-show-ui.js", import.meta.url), "utf8");
  const index = await readFile(new URL("../index.html", import.meta.url), "utf8");

  assert.match(uiFixes, /\.question-card h1,[\s\S]*font-size:\s*clamp\(1\.25rem, 2\.55vw, 2\.2rem\)\s*!important/);
  assert.match(uiFixes, /white-space:\s*normal\s*!important/);
  assert.match(uiFixes, /\.choice-text\s*\{[\s\S]*overflow-wrap:\s*anywhere/);
  assert.doesNotMatch(uiFixes, /text-overflow:\s*ellipsis/i, "回答文を省略する指定が追加されています");
  assert.match(flow, /const DEFAULT_MAX_SCORE = 100;/);
  assert.equal(normalizeDefaultMaxScore(500, 5), 500, "明示した500点を旧既定値扱いしてはいけません");
  assert.equal(normalizeDefaultMaxScore(1000, 5), 1000, "明示した1000点を旧既定値扱いしてはいけません");
  assert.equal(normalizeDefaultMaxScore(Number.NaN, 5), 100, "無効な最大点数は100点へ補正する必要があります");
  assert.doesNotMatch(flow, /value === 500 \|\| value === 1000/, "有効な500/1000点を旧既定値として強制上書きする処理が残っています");
  assert.match(index, /id="maxScoreInput"[^>]*value="100"/);

  const featureIndex = index.indexOf('href="feature-ui.css"');
  const fixesIndex = index.indexOf('href="ui-stability-fixes.css"');
  assert.ok(featureIndex >= 0 && fixesIndex > featureIndex, "安定表示CSSがfeature-ui.cssより前に読み込まれています");
  console.log("✓ 6. 問題文・回答文を安定表示し、最大点数の既定100と明示値尊重を検証");
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
  console.log("✓ 7. 添付マスタ形式を既存出題形式へ変換し、不完全な5問を安全に除外");
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
  console.log("✓ 8. 用意済みMP3を問題・回答後解説で優先し、無い場合だけブラウザ読み上げへフォールバック");
}

async function testQuizShowVisualLanguage() {
  const styles = await readFile(new URL("../styles.css", import.meta.url), "utf8");
  const featureCss = await readFile(new URL("../feature-ui.css", import.meta.url), "utf8");
  const uiFixes = await readFile(new URL("../ui-stability-fixes.css", import.meta.url), "utf8");
  const index = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const combined = `${styles}\n${featureCss}\n${uiFixes}`;

  assert.match(styles, /--text:\s*#172033/);
  assert.match(styles, /\.question-card\s*\{[^}]*right:\s*10px[^}]*left:\s*10px/s);
  assert.match(styles, /\.choice-labels\s*\{[^}]*height:\s*22%/s);
  assert.match(styles, /\.round-transition\s*\{/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(uiFixes, /\.question-card\s*\{[^}]*border:\s*1px solid rgba\(23, 32, 51, 0\.24\)\s*!important/s);
  assert.match(uiFixes, /\.setup-panel,[\s\S]*border:\s*1px solid var\(--panel-outline-strong\)\s*!important/s);
  assert.doesNotMatch(combined, /radial-gradient|backdrop-filter|rgba\(255, 0, 200/i, "AIデモ風の視覚表現がCSSへ戻っています");
  assert.doesNotMatch(combined, /#176b5c/i, "ずんだもんを連想しやすい旧メイン緑アクセントが残っています");
  assert.match(index, /<title>立ち位置クイズ<\/title>/);
  assert.match(index, /LIVE QUIZ/);
  assert.match(index, /AIリテラシー/);
  assert.doesNotMatch(index, /カメラAI立ち位置クイズ|高精度人物検出モデル/);
  console.log("✓ 9. クイズ番組型の構成を維持しつつ、黄色の上辺ではなく薄い全周枠を適用");
}

await testQuizChoiceDesign();
await testTwoChoiceBadgeVisibility();
await testCompactExplanationDesign();
testPausableClock();
testRemainingSecondsParser();
await testTimerUiAndBootOrder();
await testRestartTransitionBeforeAudio();
await testStableTextAndDefaultScore();
await testQuestionMasterConversion();
await testQuestionSpeechImplementation();
await testQuizShowVisualLanguage();

console.log("All validation checks passed.");
