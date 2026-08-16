import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  DEFAULT_HOLD_DURATION_SECONDS,
  normalizeHoldDurationSeconds
} from "../quiz-defaults.js";

assert.equal(DEFAULT_HOLD_DURATION_SECONDS, 10, "回答時間のデフォルトが10秒ではありません");
assert.equal(normalizeHoldDurationSeconds(1.2), 1.2, "有効な明示回答時間1.2秒を上書きしてはいけません");
assert.equal(normalizeHoldDurationSeconds(""), 10, "無効な回答時間は10秒へ補正する必要があります");
assert.equal(normalizeHoldDurationSeconds(12), 10, "上限外の回答時間は10秒へ補正する必要があります");

const defaults = await readFile(new URL("../quiz-defaults.js", import.meta.url), "utf8");
const countdownCss = await readFile(new URL("../countdown-neutral.css", import.meta.url), "utf8");
const main = await readFile(new URL("../main.js", import.meta.url), "utf8");

assert.doesNotMatch(defaults, /LEGACY_HOLD_DURATION_SECONDS/, "旧1.2秒を無条件置換するロジックを残してはいけません");
assert.match(defaults, /seconds >= 0\.5 && seconds <= 10/);

assert.match(countdownCss, /#stage \.countdown/);
assert.match(countdownCss, /border-top-width:\s*1px\s*!important/);
assert.match(countdownCss, /background:\s*rgba\(255, 253, 248, 0\.97\)\s*!important/);
assert.doesNotMatch(countdownCss, /quiz-yellow|#ffc83d|#d39d00/i, "3秒カウントダウンに黄色が残っています");

const appImportIndex = main.indexOf('await import("./app.js")');
const defaultsIndex = main.indexOf("initializeQuizDefaults();");
assert.ok(appImportIndex >= 0 && defaultsIndex > appImportIndex, "app.jsの設定反映後に回答時間の妥当性確認を行う必要があります");
assert.match(main, /quiz-defaults\.js\?v=2/);
assert.match(main, /countdown-neutral\.css\?v=1/);

console.log("✓ 回答時間の既定10秒・明示値尊重・3秒カウントダウン中立表示を検証");
