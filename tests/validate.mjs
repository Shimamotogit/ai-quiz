import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  createPausableClock,
  parseRemainingSeconds
} from "../answer-timer-feedback.js";

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

async function testExplanationVisibility() {
  const css = await readFile(new URL("../feature-ui.css", import.meta.url), "utf8");

  assert.match(css, /\.question-explanation\s*\{[^}]*font-size:\s*clamp\(1\.3rem, 2\.3vw, 1\.85rem\)/s);
  assert.match(css, /\.question-explanation\s*\{[^}]*border:\s*4px solid #facc15/s);
  assert.match(css, /\.question-explanation::before\s*\{[^}]*回答の解説/s);
  assert.match(css, /@keyframes explanation-pop/);
  console.log("✓ 2. 解説は大文字・強調枠・見出し・表示アニメーション付き");
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
  console.log("✓ 3a. 音声待機中は時計停止、終了後は連続した時刻から再開");
}

function testRemainingSecondsParser() {
  assert.equal(parseRemainingSeconds("東京：あと 1.2 秒"), 1.2);
  assert.equal(parseRemainingSeconds("あと0.5秒"), 0.5);
  assert.equal(parseRemainingSeconds("回答エリアへ移動してください"), null);
  console.log("✓ 3b. 残り秒数を画面表示用に正しく解析");
}

async function testTimerUiAndBootOrder() {
  const css = await readFile(new URL("../feature-ui.css", import.meta.url), "utf8");
  const main = await readFile(new URL("../main.js", import.meta.url), "utf8");

  assert.match(css, /\.answer-timer-value\s*\{[^}]*font-size:\s*clamp\(3\.4rem, 8vw, 5\.8rem\)/s);
  assert.match(css, /\.answer-timer-progress/);

  const installIndex = main.indexOf("installAnswerTimingGuard();");
  const appImportIndex = main.indexOf('await import("./app.js")');
  const initializeIndex = main.indexOf("await initializeAnswerTimerFeedback();");
  assert.ok(installIndex >= 0 && appImportIndex > installIndex, "時間制御がapp.jsより後に初期化されています");
  assert.ok(initializeIndex > appImportIndex, "カウントダウンUIがapp.jsより前に初期化されています");
  console.log("✓ 3c. 大型残り秒数UIと安全な起動順序");
}

async function testQuestionJson() {
  const text = await readFile(new URL("../questions.json", import.meta.url), "utf8");
  const data = JSON.parse(text);
  assert.ok(Array.isArray(data.questions) && data.questions.length > 0);
  console.log(`✓ 問題JSON: ${data.questions.length}問を解析`);
}

await testActiveZoneColor();
await testExplanationVisibility();
testPausableClock();
testRemainingSecondsParser();
await testTimerUiAndBootOrder();
await testQuestionJson();

console.log("All validation checks passed.");
