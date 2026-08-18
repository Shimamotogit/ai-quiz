import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { normalizeChoiceResultClasses } from "../assets/js/answer-visual-state.js";

function createLabel(...classes) {
  const values = new Set(classes);
  let removeCalls = 0;
  return {
    classList: {
      contains: (name) => values.has(name),
      remove: (...names) => {
        removeCalls += 1;
        names.forEach((name) => values.delete(name));
      }
    },
    has: (name) => values.has(name),
    removeCalls: () => removeCalls
  };
}

function testResultNormalization() {
  const wrongSelection = createLabel("choice-label", "active", "wrong");
  const correctAnswer = createLabel("choice-label", "correct");
  const untouched = createLabel("choice-label");

  const changed = normalizeChoiceResultClasses([wrongSelection, correctAnswer, untouched]);
  assert.equal(changed, true);
  assert.equal(wrongSelection.has("active"), false, "採点後に選択中表示が残っています");
  assert.equal(wrongSelection.has("wrong"), false, "採点後に不正解位置の強調が残っています");
  assert.equal(correctAnswer.has("correct"), true, "正解位置の強調が消えています");

  const removeCallsAfterFirstPass = wrongSelection.removeCalls() + correctAnswer.removeCalls() + untouched.removeCalls();
  const secondPassChanged = normalizeChoiceResultClasses([wrongSelection, correctAnswer, untouched]);
  const removeCallsAfterSecondPass = wrongSelection.removeCalls() + correctAnswer.removeCalls() + untouched.removeCalls();
  assert.equal(secondPassChanged, false, "正規化済みDOMを再度変更しています");
  assert.equal(removeCallsAfterSecondPass, removeCallsAfterFirstPass, "不要なclassList.removeがMutationObserver再帰を起こす可能性があります");

  const selecting = createLabel("choice-label", "active");
  assert.equal(normalizeChoiceResultClasses([selecting]), false);
  assert.equal(selecting.has("active"), true, "回答中の現在位置まで消しています");
  console.log("✓ 採点後の正規化は1回だけ行い、再帰的なclass変更を起こさない");
}

async function testInitializationOrder() {
  const main = await readFile(new URL("../assets/js/main.js", import.meta.url), "utf8");
  const systemAudioIndex = main.indexOf("await initializeSystemAudioFlow();");
  const questionSpeechIndex = main.indexOf("await initializeQuestionSpeech();");
  const visualStateIndex = main.indexOf("initializeAnswerVisualState();");

  assert.ok(systemAudioIndex >= 0 && visualStateIndex > systemAudioIndex, "見た目正規化がシステム音声の正誤判定より先に登録されています");
  assert.ok(questionSpeechIndex >= 0 && visualStateIndex > questionSpeechIndex, "見た目正規化が解説音声監視より先に登録されています");
  console.log("✓ 正誤音声・解説音声が結果classを読んだ後に見た目を正規化");
}

async function testAnswerAndExplanationStyles() {
  const css = await readFile(new URL("../assets/css/ui-stability-fixes.css", import.meta.url), "utf8");

  assert.match(css, /\.question-explanation\s*\{[^}]*font-size:\s*clamp\(1\.25rem, 2\.35vw, 2\.05rem\)\s*!important/s);
  assert.match(css, /#stage \.choice-label\.active\s*\{[^}]*background:\s*var\(--choice-fill/s);
  assert.match(css, /#stage \.choice-label\.correct\s*\{[^}]*background:\s*var\(--choice-fill/s);
  assert.match(css, /\.choice-label\s*\{[^}]*border-top:\s*6px solid var\(--choice-color/s);
  assert.match(css, /\.message\s*\{[^}]*border:\s*1px solid rgba\(23, 32, 51, 0\.30\)\s*!important/s);
  assert.doesNotMatch(css, /quiz-yellow|#ffc83d/i, "安定表示レイヤーに黄色アクセントが戻っています");
  console.log("✓ 回答中/正解は全面色、通常回答は上辺色、解説は問題文級サイズ");
}

testResultNormalization();
await testInitializationOrder();
await testAnswerAndExplanationStyles();
console.log("Answer visual state checks passed.");
