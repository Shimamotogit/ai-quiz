import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const CREDIT = "VOICEVOX:ずんだもん";
const VOICEVOX_TERMS = "https://voicevox.hiroshiba.jp/term/";
const ZUNDAMON_TERMS = "https://zunko.jp/con_ongen_kiyaku.html";
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
