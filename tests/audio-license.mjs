import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const CREDIT = "VOICEVOX:ずんだもん";
const VOICEVOX_TERMS = "https://voicevox.hiroshiba.jp/term/";
const ZUNDAMON_TERMS = "https://zunko.jp/con_ongen_kiyaku.html";
const VOICEVOX_QA = "https://voicevox.hiroshiba.jp/qa/";
const EXPECTED_ARCHIVE_SHA256 = "3819c5e367380f10510ea87d587934ceff421b467e354d148c8176f19e2fea78";
const EXPECTED_MP3_COUNT = 114;

function text(path) {
  return readFileSync(resolve(path), "utf8");
}

for (const path of [
  "README.md",
  "AUDIO_LICENSE.md",
  "音声データ_MP3/README.md",
  "voicevox-credit.js"
]) {
  const value = text(path);
  assert.ok(value.includes(CREDIT), `${path} に音声クレジットがありません`);
}

const audioLicense = text("AUDIO_LICENSE.md");
assert.ok(audioLicense.includes(VOICEVOX_TERMS), "AUDIO_LICENSE.md にVOICEVOX公式規約への案内がありません");
assert.ok(audioLicense.includes(ZUNDAMON_TERMS), "AUDIO_LICENSE.md にずんだもん公式規約への案内がありません");
assert.ok(audioLicense.includes(VOICEVOX_QA), "AUDIO_LICENSE.md にVOICEVOX Q&Aへの案内がありません");
assert.ok(audioLicense.includes("確認日: 2026-08-17"), "AUDIO_LICENSE.md の公式規約確認日が更新されていません");
assert.ok(audioLicense.includes("反社会的勢力"), "ずんだもん音源共通規約の重要な禁止事項が概要から欠落しています");

const audioReadme = text("音声データ_MP3/README.md");
assert.ok(audioReadme.includes(VOICEVOX_QA), "音声READMEにVOICEVOX Q&Aへの案内がありません");
assert.ok(audioReadme.includes("2026-08-17"), "音声READMEの規約再確認日が更新されていません");

const creditScript = text("voicevox-credit.js");
assert.ok(creditScript.includes('document.querySelector("#titleStep")'), "タイトル画面にVOICEVOXクレジットを配置していません");
assert.ok(creditScript.includes('document.querySelector("#helpPanel")'), "ヘルプ欄にVOICEVOXクレジットを配置していません");
assert.ok(creditScript.includes("VOICEVOX ソフトウェア利用規約"), "VOICEVOX規約リンクが公式名称になっていません");
assert.ok(creditScript.includes(VOICEVOX_TERMS), "画面クレジットにVOICEVOX公式規約へのリンクがありません");
assert.ok(creditScript.includes(ZUNDAMON_TERMS), "画面クレジットにずんだもん音源規約へのリンクがありません");

const manifest = text("音声データ_MP3/SHA256SUMS.txt");
assert.ok(
  manifest.includes(`# Source archive SHA-256: ${EXPECTED_ARCHIVE_SHA256}`),
  "元ZIPのSHA-256が一致しません"
);

const entries = manifest
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith("#"))
  .map((line) => {
    const match = line.match(/^([0-9a-f]{64})\s{2}(.+)$/);
    assert.ok(match, `不正なSHA256SUMS行です: ${line}`);
    return { expectedHash: match[1], relativePath: match[2] };
  });

assert.equal(entries.length, EXPECTED_MP3_COUNT, `MP3マニフェストは${EXPECTED_MP3_COUNT}件必要です`);

for (const { expectedHash, relativePath } of entries) {
  const path = resolve("音声データ_MP3", relativePath);
  assert.ok(existsSync(path), `音声ファイルがありません: 音声データ_MP3/${relativePath}`);
  const actualHash = createHash("sha256").update(readFileSync(path)).digest("hex");
  assert.equal(actualHash, expectedHash, `音声ファイルのSHA-256が一致しません: ${relativePath}`);
}

console.log(`✓ ${EXPECTED_MP3_COUNT}個のVOICEVOX:ずんだもん音声とライセンス表示を検証`);
