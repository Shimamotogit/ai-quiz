import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const CREDIT = "VOICEVOX:ずんだもん";
const VOICEVOX_TERMS = "https://voicevox.hiroshiba.jp/term/";
const ZUNDAMON_TERMS = "https://zunko.jp/con_ongen_kiyaku.html";
const VOICEVOX_QA = "https://voicevox.hiroshiba.jp/qa/";

function text(path) {
  return readFileSync(resolve(path), "utf8");
}

for (const path of [
  "README.md",
  "docs/AUDIO_LICENSE.md",
  "音声データ_MP3/README.md",
  "assets/js/voicevox-credit.js"
]) {
  const value = text(path);
  assert.ok(value.includes(CREDIT), `${path} に音声クレジットがありません`);
}

const audioLicense = text("docs/AUDIO_LICENSE.md");
assert.ok(audioLicense.includes(VOICEVOX_TERMS), "AUDIO_LICENSE.md にVOICEVOX公式規約への案内がありません");
assert.ok(audioLicense.includes(ZUNDAMON_TERMS), "AUDIO_LICENSE.md にずんだもん公式規約への案内がありません");
assert.ok(audioLicense.includes(VOICEVOX_QA), "AUDIO_LICENSE.md にVOICEVOX Q&Aへの案内がありません");
assert.ok(audioLicense.includes("確認日: 2026-08-17"), "AUDIO_LICENSE.md の公式規約確認日が更新されていません");
assert.ok(audioLicense.includes("反社会的勢力"), "ずんだもん音源共通規約の重要な禁止事項が概要から欠落しています");
assert.ok(audioLicense.includes("固定ハッシュの台帳は管理しません"), "音声差し替え運用がライセンス文書に明記されていません");

const audioReadme = text("音声データ_MP3/README.md");
assert.ok(audioReadme.includes(VOICEVOX_QA), "音声READMEにVOICEVOX Q&Aへの案内がありません");
assert.ok(audioReadme.includes("2026-08-17"), "音声READMEの規約再確認日が更新されていません");
assert.ok(audioReadme.includes("SHA-256 台帳は管理しません"), "音声READMEに差し替え運用が明記されていません");

const creditScript = text("assets/js/voicevox-credit.js");
assert.ok(creditScript.includes('document.querySelector("#titleStep")'), "タイトル画面にVOICEVOXクレジットを配置していません");
assert.ok(creditScript.includes('document.querySelector("#helpPanel")'), "ヘルプ欄にVOICEVOXクレジットを配置していません");
assert.ok(creditScript.includes("VOICEVOX ソフトウェア利用規約"), "VOICEVOX規約リンクが公式名称になっていません");
assert.ok(creditScript.includes(VOICEVOX_TERMS), "画面クレジットにVOICEVOX公式規約へのリンクがありません");
assert.ok(creditScript.includes(ZUNDAMON_TERMS), "画面クレジットにずんだもん音源規約へのリンクがありません");

assert.equal(existsSync(resolve("音声データ_MP3/SHA256SUMS.txt")), false, "差し替え運用と競合するSHA-256台帳が残っています");

for (const directory of [
  "音声データ_MP3/01.システム",
  "音声データ_MP3/02.問題",
  "音声データ_MP3/03.問題_補足説明"
]) {
  assert.ok(existsSync(resolve(directory)), `音声ディレクトリがありません: ${directory}`);
  assert.ok(statSync(resolve(directory)).isDirectory(), `音声パスがディレクトリではありません: ${directory}`);
}

for (const requiredFile of [
  "音声データ_MP3/01.システム/ルールの説明です。.mp3",
  "音声データ_MP3/01.システム/それでは、スタートです.mp3",
  "音声データ_MP3/01.システム/正解です。.mp3"
]) {
  assert.ok(existsSync(resolve(requiredFile)), `必須システム音声がありません: ${requiredFile}`);
  assert.ok(statSync(resolve(requiredFile)).size > 0, `必須システム音声が空です: ${requiredFile}`);
}

console.log("✓ VOICEVOX:ずんだもんのクレジット・規約案内と差し替え可能な音声構成を検証");
