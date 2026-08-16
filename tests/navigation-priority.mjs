import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { GUIDE_IMAGE_PATH } from "../navigation-priority.js";

function text(path) {
  return readFileSync(resolve(path), "utf8");
}

const navigation = text("navigation-priority.js");
const navigationCss = text("navigation-priority.css");
const launchFlow = text("launch-flow.js");
const main = text("main.js");
const html = text("index.html");

assert.equal(GUIDE_IMAGE_PATH, "images/quiz-guide.jpg", "説明画像の固定パスはJPGである必要があります");
assert.ok(!navigation.includes("images/quiz-guide.png"), "旧PNGパスが残っています");
assert.ok(html.includes('id="showGuideImageButton"'), "タイトル画面に説明画像ボタンがありません");
assert.ok(html.includes('id="showParticipantGuideImageButton"'), "参加者選択画面に説明画像ボタンがありません");
assert.ok(html.match(/>説明画像を表示<\/button>/g)?.length >= 2, "タイトルと参加者選択の両方に説明画像ボタンが必要です");
assert.ok(html.includes('id="backToDifficultyButton" class="secondary-button" type="button">難易度選択へ戻る</button>'), "難易度戻るボタンの名称が正しくありません");
assert.ok(html.includes('src="main.js?v=10"'), "nginx向けのmain.jsキャッシュ更新がありません");
assert.ok(main.includes('from "./navigation-priority.js?v=2"'), "説明画像制御JSのキャッシュ更新がありません");
assert.ok(navigation.includes('new URL("./navigation-priority.css?v=2"'), "説明画像・タイマーCSSのキャッシュ更新がありません");

assert.ok(navigationCss.includes("font-size: clamp(2.7rem, 4.5vw, 3.825rem) !important;"), "PCの残り時間表示が従来値の1.5倍になっていません");
assert.ok(navigationCss.includes("font-size: 2.625rem !important;"), "モバイルの残り時間表示が従来値の1.5倍になっていません");

const pendingIndex = launchFlow.indexOf("const pendingDifficulty = sessionStorage.getItem");
const installIndex = launchFlow.indexOf("installSetupNavigationHandlers();");
assert.ok(installIndex >= 0 && pendingIndex >= 0 && installIndex < pendingIndex, "再読み込み判定より先に設定画面のナビゲーションを登録する必要があります");
assert.ok(launchFlow.includes('#backToDifficultyButton\")?.addEventListener("click", () => showSetupStep("difficulty"))'), "難易度選択へ戻るイベントがありません");

assert.ok(navigation.includes('document.querySelector("#backToParticipantButton")?.click();'), "再スタート時に参加者選択へ戻る処理がありません");
assert.ok(navigation.includes("beginSystemAudioDrain();"), "再スタート／タイトル戻り時の音声中断処理がありません");
assert.ok(navigation.includes("window.location.reload();"), "タイトル戻りを音声より優先する処理がありません");
assert.ok(navigation.includes('audio.addEventListener("ended", () => {'), "ルール音声終了の検知がありません");
assert.ok(navigation.includes("showStartTransition();"), "ルール音声終了後の『まもなくスタート』表示がありません");
assert.ok(navigation.includes("hideQuizForIntro();"), "ルール説明前に開始遷移を隠す処理がありません");
assert.ok(navigation.includes("ensureParticipantGuideButton"), "参加者選択用の説明画像ボタン初期化がありません");
assert.ok(navigation.includes("bindGuideButton(ensureParticipantGuideButton());"), "参加者選択用の説明画像ボタンが共通モーダルに接続されていません");

const priorityInit = main.indexOf("initializeNavigationPriority();");
const quizShowInit = main.indexOf("initializeQuizShowUI();");
const systemAudioInit = main.indexOf("initializeSystemAudioFlow();");
assert.ok(priorityInit >= 0 && priorityInit < quizShowInit && priorityInit < systemAudioInit, "ナビゲーション優先制御は既存の開始・音声ガードより先に初期化する必要があります");

console.log("✓ 参加者説明画像・JPGパス・残り時間1.5倍・既存ナビゲーションを検証");
