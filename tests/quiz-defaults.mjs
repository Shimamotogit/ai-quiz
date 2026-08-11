import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DEFAULT_HOLD_DURATION_SECONDS } from "../quiz-defaults.js";

assert.equal(DEFAULT_HOLD_DURATION_SECONDS, 10, "回答時間のデフォルトが10秒ではありません");

const defaults = await readFile(new URL("../quiz-defaults.js", import.meta.url), "utf8");
const countdownCss = await readFile(new URL("../countdown-neutral.css", import.meta.url), "utf8");
const main = await readFile(new URL("../main.js", import.meta.url), "utf8");

assert.match(defaults, /LEGACY_HOLD_DURATION_SECONDS = 1\.2/);
assert.match(defaults, /input\.value = String\(DEFAULT_HOLD_DURATION_SECONDS\)/);
assert.match(defaults, /userChanged = true/);

assert.match(countdownCss, /#stage \.countdown/);
assert.match(countdownCss, /border-top-width:\s*1px\s*!important/);
assert.match(countdownCss, /background:\s*rgba\(255, 253, 248, 0\.97\)\s*!important/);
assert.doesNotMatch(countdownCss, /quiz-yellow|#ffc83d|#d39d00/i, "3秒カウントダウンに黄色が残っています");

const appImportIndex = main.indexOf('await import("./app.js")');
const defaultsIndex = main.indexOf("initializeQuizDefaults();");
assert.ok(appImportIndex >= 0 && defaultsIndex > appImportIndex, "app.jsが旧1.2秒を反映した後にデフォルト補正されていません");
assert.match(main, /countdown-neutral\.css\?v=1/);

console.log("✓ 回答時間のデフォルトは10秒、3秒カウントダウンは黄色なしの中立パネル");
