import assert from "node:assert/strict";
import {
  buildResultSystemSequence,
  getAnswerSystemCue,
  getGradeSystemCue,
  getQuestionCountCue
} from "../system-audio-flow.js";
import { rewriteSystemAudioSource } from "../system-audio-alias.js";

function testAnswerCues() {
  assert.deepEqual(
    getAnswerSystemCue({ choices: ["〇", "✕"], correctIndex: 0 }, true),
    { filename: "正解です。.mp3", text: "正解です。" }
  );

  assert.equal(
    getAnswerSystemCue({ choices: ["〇", "✕"], correctIndex: 1 }, false).filename,
    "答えは、×です！.mp3"
  );

  assert.equal(
    getAnswerSystemCue({ choices: ["A．赤", "B．青", "C．緑"], correctIndex: 1 }, false).filename,
    "答えは、Bです！.mp3"
  );
}

function testCountCues() {
  assert.equal(getQuestionCountCue(10, true).filename, "10問中.mp3");
  assert.equal(getQuestionCountCue(9, false).filename, "９問.mp3");
  assert.equal(getQuestionCountCue(0, false).filename, "0問.mp3");
}

function testGradeThreshold() {
  assert.equal(getGradeSystemCue(6, 10).filename, "とても良い結果です！.mp3");
  assert.equal(getGradeSystemCue(5, 10).filename, "いい成績です.mp3");

  const rewritten = rewriteSystemAudioSource(
    "https://example.test/音声データ_MP3/01.システム/いい成績です.mp3",
    "https://example.test/"
  );
  assert.equal(
    decodeURIComponent(new URL(rewritten).pathname),
    "/音声データ_MP3/01.システム/素晴らしい成績です！.mp3"
  );
}

function testResultSequence() {
  const files = buildResultSystemSequence(6, 10).map((cue) => cue.filename);
  assert.deepEqual(files, [
    "お疲れ様でした.mp3",
    "10問中.mp3",
    "6問.mp3",
    "正解です。.mp3",
    "とても良い結果です！.mp3"
  ]);
}

testAnswerCues();
testCountCues();
testGradeThreshold();
testResultSequence();

console.log("✓ システム音声の開始・回答・結果用ファイル選択を検証");
