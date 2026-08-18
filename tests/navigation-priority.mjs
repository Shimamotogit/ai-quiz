import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { GUIDE_IMAGE_PATH, buildGuideImageUrl } from "../assets/js/navigation-priority.js";

function text(path) {
  return readFileSync(resolve(path), "utf8");
}

const navigation = text("assets/js/navigation-priority.js");
const navigationCss = text("assets/css/navigation-priority.css");
const launchFlow = text("assets/js/launch-flow.js");
const main = text("assets/js/main.js");
const html = text("index.html");

assert.equal(GUIDE_IMAGE_PATH, "images/quiz-guide.jpg", "説明画像の固定パスはJPGである必要があります");
assert.ok(!navigation.includes("images/quiz-guide.png"), "旧PNGパスが残っています");
assert.ok(existsSync(resolve(GUIDE_IMAGE_PATH)), "説明画像 images/quiz-guide.jpg がリポジトリに存在しません");
assert.ok(statSync(resolve(GUIDE_IMAGE_PATH)).size > 0, "説明画像 images/quiz-guide.jpg が空ファイルです");

const guideUrl = new URL(buildGuideImageUrl());
assert.ok(guideUrl.pathname.endsWith("/images/quiz-guide.jpg"), "移動後のnavigation-priority.jsからルートの説明画像JPGへ解決される必要があります");
assert.equal(guideUrl.searchParams.get("v"), "4", "説明画像URLに最新のキャッシュバージョンが必要です");
const retryUrl = new URL(buildGuideImageUrl("retry-test"));
assert.equal(retryUrl.searchParams.get("retry"), "retry-test", "画像を別URLで再取得できる必要があります");
assert.ok(navigation.includes("import.meta.url"), "説明画像・追加CSSはモジュールURL基準で解決する必要があります");
assert.ok(navigation.includes('new URL(`../../${GUIDE_IMAGE_PATH}`, import.meta.url)'), "移動後もルートのimages/へ解決する処理がありません");
assert.ok(navigation.includes("refreshGuideImage(true);"), "ボタン押下時に説明画像を再取得する処理がありません");
assert.ok(navigation.includes('close.textContent = "×";'), "説明画像を閉じる×ボタンがありません");
assert.ok(navigation.includes('close.className = "guide-image-close";'), "×ボタン専用クラスがありません");
assert.ok(navigation.includes("document.fullscreenElement"), "ブラウザ全画面中の説明画像表示に対応していません");
assert.ok(navigation.includes("mountGuideOverlay(overlay);"), "表示時に説明画像を最前面ホストへ移す処理がありません");
assert.ok(navigation.includes('document.addEventListener("fullscreenchange"'), "全画面切り替え時の説明画像再配置がありません");
assert.ok(!navigation.includes("guide-image-card"), "旧カード型の説明画像表示が残っています");
assert.ok(!navigation.includes("guide-image-header"), "旧見出し付き説明画像表示が残っています");
assert.ok(navigation.includes("export function initializeGuideImageSupport()"), "説明画像だけを先行初期化する入口がありません");

assert.ok(html.includes('id="showGuideImageButton"'), "タイトル画面に説明画像ボタンがありません");
assert.ok(html.includes('id="showParticipantGuideImageButton"'), "参加者選択画面に説明画像ボタンがありません");
assert.ok(html.match(/>説明画像を表示<\/button>/g)?.length >= 2, "タイトルと参加者選択の両方に説明画像ボタンが必要です");
assert.ok(html.includes('id="backToDifficultyButton" class="secondary-button" type="button">難易度選択へ戻る</button>'), "難易度戻るボタンの名称が正しくありません");
assert.ok(html.includes('src="assets/js/main.js?v=15"'), "nginx向けのmain.jsパス/キャッシュ更新がありません");
assert.ok(main.includes('from "./navigation-priority.js?v=6"'), "説明画像制御JSのキャッシュ更新がありません");
assert.ok(navigation.includes('new URL("../css/navigation-priority.css?v=4", import.meta.url)'), "移動後の説明画像CSSパス/キャッシュ更新がありません");

assert.ok(navigationCss.includes("position: fixed !important;"), "説明画像ビューは画面固定表示である必要があります");
assert.ok(navigationCss.includes("z-index: 2147483647 !important;"), "説明画像ビューを最前面に固定できていません");
assert.ok(navigationCss.includes("width: 100vw !important;"), "説明画像ビューが画面幅全体を使用していません");
assert.ok(navigationCss.includes("height: 100vh !important;"), "説明画像ビューが画面高全体を使用していません");
assert.ok(navigationCss.includes("object-fit: contain !important;"), "説明画像全体を画面内に収める指定がありません");
assert.ok(navigationCss.includes(".guide-image-close"), "右上×ボタンのスタイルがありません");
assert.ok(navigationCss.includes("font-size: clamp(2.7rem, 4.5vw, 3.825rem) !important;"), "PCの残り時間表示が従来値の1.5倍になっていません");
assert.ok(navigationCss.includes("font-size: 2.625rem !important;"), "モバイルの残り時間表示が従来値の1.5倍になっていません");

const pendingIndex = launchFlow.indexOf("const pendingDifficulty = sessionStorage.getItem");
const installIndex = launchFlow.indexOf("installSetupNavigationHandlers();");
assert.ok(installIndex >= 0 && pendingIndex >= 0 && installIndex < pendingIndex, "再読み込み判定より先に設定画面のナビゲーションを登録する必要があります");
assert.ok(launchFlow.includes('$("#backToDifficultyButton")?.addEventListener("click", () => showSetupStep("difficulty"));'), "難易度選択へ戻るイベントがありません");

assert.ok(navigation.includes('document.querySelector("#backToParticipantButton")?.click();'), "再スタート時に参加者選択へ戻る処理がありません");
assert.ok(navigation.includes("beginSystemAudioDrain();"), "再スタート／タイトル戻り時の音声中断処理がありません");
assert.ok(navigation.includes("window.location.reload();"), "タイトル戻りを音声より優先する処理がありません");
assert.ok(navigation.includes('audio.addEventListener("ended", () => {'), "ルール音声終了の検知がありません");
assert.ok(navigation.includes("showStartTransition();"), "ルール音声終了後の『まもなくスタート』表示がありません");
assert.ok(navigation.includes("hideQuizForIntro();"), "ルール説明前に開始遷移を隠す処理がありません");
assert.ok(navigation.includes("ensureParticipantGuideButton"), "参加者選択用の説明画像ボタン初期化がありません");
assert.ok(navigation.includes("bindGuideButton(ensureParticipantGuideButton());"), "参加者選択用の説明画像ボタンが全面表示に接続されていません");

const guideInit = main.indexOf("initializeGuideImageSupport();");
const sourceInit = main.indexOf("await initializeQuestionSource();");
const launchInit = main.indexOf("await initializeLaunchFlow();");
const presentationInit = main.indexOf("initializeQuizPresentation(launchOptions.difficulty);");
const priorityInit = main.indexOf("initializeNavigationPriority();");
const quizShowInit = main.indexOf("initializeQuizShowUI();");
const systemAudioInit = main.indexOf("initializeSystemAudioFlow();");
assert.ok(guideInit >= 0 && guideInit < sourceInit && guideInit < launchInit, "タイトル画面の説明画像は問題読み込み・難易度選択待ちより前に初期化する必要があります");
assert.ok(presentationInit >= 0 && priorityInit > presentationInit, "全画面要求のcaptureハンドラをナビゲーション停止処理より先に登録する必要があります");
assert.ok(priorityInit < quizShowInit && priorityInit < systemAudioInit, "ナビゲーション優先制御は既存の開始・音声ガードより先に初期化する必要があります");
assert.equal(main.match(/initializeGuideImageSupport\(\);/g)?.length, 1, "説明画像先行初期化を重複実行してはいけません");
assert.equal(main.match(/initializeNavigationPriority\(\);/g)?.length, 1, "ナビゲーション優先制御を重複初期化してはいけません");

console.log("✓ タイトル説明画像・全面表示・×閉じる・全画面capture順・既存ナビゲーションを検証");
