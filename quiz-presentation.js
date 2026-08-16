const KIDS_HIRAGANA_QUESTIONS = new Map([
  ["AIは、人間が考えて答えたように見える文章を作れる。", "AIは、にんげんがかんがえてこたえたようにみえるぶんしょうをつくれる。"],
  ["AIが答えたことは、いつでも100％正しい。", "AIがこたえたことは、いつでも100％ただしい。"],
  ["チェスや将棋のために作られたAIは、人間より強いことがある。", "チェスやしょうぎのためにつくられたAIは、にんげんよりつよいことがある。"],
  ["AIは、たくさんのデータから、ものの特徴やパターンを学ぶことができる。", "AIは、たくさんのデータから、もののとくちょうやパターンをまなぶことができる。"],
  ["写真に写っている犬と猫を見分けられるAIがある。", "しゃしんにうつっているいぬとねこをみわけられるAIがある。"],
  ["AIは、外国の言葉を日本語などの別の言葉に訳すことができない。", "AIは、がいこくのことばをにほんごなどのべつのことばにやくすことができない。"],
  ["写真の中から、人の顔がある場所を見つけられるAIがある。", "しゃしんのなかから、ひとのかおがあるばしょをみつけられるAIがある。"],
  ["画像生成AIを使うと、お願いした内容に合わせた絵を作ることができる。", "がぞうせいせいAIをつかうと、おねがいしたないようにあわせたえをつくることができる。"],
  ["車の運転を手伝うことができるAIがある。", "くるまのうんてんをてつだうことができるAIがある。"],
  ["ChatGPTなどのAIサービスには、自分や家族の個人情報を何でも入力してよい。", "ChatGPTなどのAIサービスには、じぶんやかぞくのこじんじょうほうをなんでもにゅうりょくしてよい。"],
  ["ゲームを作る手伝いができるAIがある。", "ゲームをつくるてつだいができるAIがある。"],
  ["この画像は生成AIによって作成されたものである", "このがぞうはせいせいAIによってさくせいされたものである"],
  ["学校の宿題にAIを使うとき、学校や先生のルールを確認し、考えるための手助けとして使っても良い。", "がっこうのしゅくだいにAIをつかうとき、がっこうやせんせいのルールをかくにんし、かんがえるためのてつだいとしてつかってもよい。"],
  ["むやみにAIサービスに自宅の住所を入力してもよい。", "むやみにAIサービスにじたくのじゅうしょをにゅうりょくしてもよい。"],
  ["AIが言った答えには、事実ではない内容が混ざっていることがある。", "AIがいったこたえには、じじつではないないようがまざっていることがある。"],
  ["AIはおなかがすくので、毎日ごはんを食べないと動かなくなる。", "AIはおなかがすくので、まいにちごはんをたべないとうごかなくなる。"],
  ["ChatGPTのような対話型AIに「散らかった部屋を片付けて」とお願いすると、片付けの順番や方法を教えてくれる。", "ChatGPTのようなたいわがたAIに「ちらかったへやをかたづけて」とおねがいすると、かたづけのじゅんばんやほうほうをおしえてくれる。"],
  ["AIが「明日は学校が休みになります」と答えた。先生・学校からの正式な連絡を確認しなくてもよい。", "AIが「あしたはがっこうがやすみになります」とこたえた。せんせい・がっこうからのせいしきなれんらくをかくにんしなくてもよい。"],
  ["生成AIがいろいろな質問に答えられる理由は、たくさんの文章や画像などから、特徴やパターンを学んでいるから。", "せいせいAIがいろいろなしつもんにこたえられるりゆうは、たくさんのぶんしょうやがぞうなどから、とくちょうやパターンをまなんでいるから。"],
  ["新しい歌や音楽を作ることができるAIがある。", "あたらしいうたやおんがくをつくることができるAIがある。"]
]);

const RULE_AUDIO_FILENAME = "ルールの説明です。.mp3";
const VALID_DIFFICULTIES = new Set(["kids", "adults", "all"]);

let activeDifficulty = "all";
let readingMode = "kanji";
let initialized = false;
let questionObserver = null;
let choiceObserver = null;
let systemAudioObserver = null;
let ruleOverlay = null;
let activeRuleAudio = null;

function normalizeDifficulty(value) {
  return VALID_DIFFICULTIES.has(value) ? value : "all";
}

export function getKidsHiraganaQuestion(text) {
  return KIDS_HIRAGANA_QUESTIONS.get(String(text ?? "").trim()) ?? null;
}

export function getKidsHiraganaQuestionCount() {
  return KIDS_HIRAGANA_QUESTIONS.size;
}

function normalizeChoiceText(value) {
  return String(value ?? "")
    .replace(/^[A-ZＡ-Ｚ][．.。]\s*/i, "")
    .trim();
}

function isCircle(value) {
  return ["〇", "○", "◯"].includes(normalizeChoiceText(value));
}

function isCross(value) {
  return ["✕", "×", "✖", "x", "X"].includes(normalizeChoiceText(value));
}

export function isCircleCrossQuestion(choices) {
  if (!Array.isArray(choices) || choices.length !== 2) return false;
  return choices.some(isCircle) && choices.some(isCross);
}

function loadPresentationStyles() {
  if (document.querySelector('link[data-quiz-presentation="true"]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = new URL("./quiz-presentation.css?v=1", window.location.href).href;
  link.dataset.quizPresentation = "true";
  document.head.append(link);
}

function createReadingModeOption(value, title, description, checked) {
  const label = document.createElement("label");
  label.className = "kids-reading-choice";

  const input = document.createElement("input");
  input.type = "radio";
  input.name = "kidsQuestionReadingMode";
  input.value = value;
  input.checked = checked;

  const text = document.createElement("span");
  const strong = document.createElement("strong");
  strong.textContent = title;
  const small = document.createElement("small");
  small.textContent = description;
  text.append(strong, small);
  label.append(input, text);
  return label;
}

function ensureKidsReadingSetting() {
  if (activeDifficulty !== "kids") return;
  if (document.querySelector("#kidsReadingSetting")) return;

  const gameStep = document.querySelector("#gameStep");
  const settingsGrid = gameStep?.querySelector(".game-settings-grid");
  if (!gameStep || !settingsGrid) return;

  const section = document.createElement("section");
  section.id = "kidsReadingSetting";
  section.className = "kids-reading-setting";
  section.setAttribute("aria-labelledby", "kidsReadingSettingTitle");

  const heading = document.createElement("h2");
  heading.id = "kidsReadingSettingTitle";
  heading.textContent = "もんだいぶんの ひょうじ";

  const description = document.createElement("p");
  description.textContent = "こどもむけでは、ひらがなをおすすめにしています。かんじまじりのもんだいぶんにもきりかえられます。";

  const options = document.createElement("div");
  options.className = "kids-reading-options";
  options.append(
    createReadingModeOption("hiragana", "ひらがな", "かんじをつかわず、よみやすくひょうじします。", true),
    createReadingModeOption("kanji", "漢字まじり", "もとの問題文をそのまま表示します。", false)
  );

  section.append(heading, description, options);
  settingsGrid.before(section);

  section.addEventListener("change", (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.name !== "kidsQuestionReadingMode") return;
    readingMode = input.value === "kanji" ? "kanji" : "hiragana";
    applyQuestionReading();
  });
}

function applyQuestionReading() {
  const questionText = document.querySelector("#questionText");
  if (!questionText) return;

  const rawText = questionText.textContent?.trim() ?? "";
  const hiragana = activeDifficulty === "kids" && readingMode === "hiragana"
    ? getKidsHiraganaQuestion(rawText)
    : null;

  if (hiragana) {
    questionText.dataset.displayText = hiragana;
    questionText.classList.add("hiragana-question-text");
    questionText.setAttribute("aria-label", hiragana);
  } else {
    delete questionText.dataset.displayText;
    questionText.classList.remove("hiragana-question-text");
    questionText.removeAttribute("aria-label");
  }
}

function installQuestionReadingObserver() {
  const questionText = document.querySelector("#questionText");
  if (!questionText || questionObserver) return;
  questionObserver = new MutationObserver(() => applyQuestionReading());
  questionObserver.observe(questionText, { childList: true, characterData: true, subtree: true });
  applyQuestionReading();
}

function updateCircleCrossPresentation() {
  const container = document.querySelector("#choiceLabels");
  if (!container) return;
  const labels = [...container.querySelectorAll(".choice-label")];
  const choices = labels.map((label) => label.dataset.rawChoiceText ?? label.textContent ?? "");
  container.classList.toggle("large-circle-cross", isCircleCrossQuestion(choices));
}

function installChoiceObserver() {
  const container = document.querySelector("#choiceLabels");
  if (!container || choiceObserver) return;
  choiceObserver = new MutationObserver(() => updateCircleCrossPresentation());
  choiceObserver.observe(container, { childList: true, subtree: true });
  updateCircleCrossPresentation();
}

function ensureRuleOverlay() {
  if (ruleOverlay) return ruleOverlay;
  const stage = document.querySelector("#stage");
  if (!stage) return null;

  const section = document.createElement("section");
  section.id = "ruleGuideOverlay";
  section.className = "rule-guide-overlay";
  section.hidden = true;
  section.setAttribute("role", "status");
  section.setAttribute("aria-live", "polite");

  const heading = document.createElement("h2");
  heading.textContent = "ルールの説明です。";
  const first = document.createElement("p");
  first.textContent = "問題の出題後、〇・×、正解だと思う位置に移動してください。";
  const second = document.createElement("p");
  second.textContent = "一度移動した後は、そのままの状態をキープしてください。";
  section.append(heading, first, second);
  stage.append(section);
  ruleOverlay = section;
  return section;
}

function isRuleAudio(audio) {
  try {
    const url = new URL(audio.currentSrc || audio.src, window.location.href);
    const pathname = decodeURIComponent(url.pathname);
    return pathname.endsWith(`/${RULE_AUDIO_FILENAME}`);
  } catch {
    return false;
  }
}

function showRuleOverlay(audio) {
  const overlay = ensureRuleOverlay();
  if (!overlay) return;
  activeRuleAudio = audio;
  overlay.hidden = false;
}

function hideRuleOverlay(audio = null) {
  if (audio && activeRuleAudio && audio !== activeRuleAudio) return;
  activeRuleAudio = null;
  if (ruleOverlay) ruleOverlay.hidden = true;
}

function bindRuleAudio(audio) {
  if (!(audio instanceof HTMLMediaElement) || !isRuleAudio(audio)) return;
  if (audio.dataset.ruleGuideBound === "true") return;
  audio.dataset.ruleGuideBound = "true";

  audio.addEventListener("play", () => showRuleOverlay(audio));
  audio.addEventListener("playing", () => showRuleOverlay(audio));
  audio.addEventListener("ended", () => hideRuleOverlay(audio));
  audio.addEventListener("error", () => hideRuleOverlay(audio));
  audio.addEventListener("pause", () => hideRuleOverlay(audio));

  if (!audio.paused && !audio.ended) showRuleOverlay(audio);
}

function scanSystemAudio() {
  document.querySelectorAll("#systemAudioPanel audio").forEach(bindRuleAudio);
  if (activeRuleAudio && !activeRuleAudio.isConnected) hideRuleOverlay(activeRuleAudio);
}

function installRuleAudioObserver() {
  const stage = document.querySelector("#stage");
  if (!stage || systemAudioObserver) return;
  ensureRuleOverlay();
  systemAudioObserver = new MutationObserver(() => scanSystemAudio());
  systemAudioObserver.observe(stage, { childList: true, subtree: true });
  scanSystemAudio();
}

function requestQuizFullscreen(event) {
  if (!event.isTrusted) return;
  const stage = document.querySelector("#stage");
  if (!stage || document.fullscreenElement || typeof stage.requestFullscreen !== "function") return;

  try {
    const request = stage.requestFullscreen({ navigationUI: "hide" });
    if (request && typeof request.catch === "function") {
      request.catch((error) => console.warn("クイズ開始時の全画面表示を開始できませんでした。", error));
    }
  } catch (error) {
    console.warn("クイズ開始時の全画面表示を開始できませんでした。", error);
  }
}

function installAutomaticFullscreen() {
  for (const selector of ["#startQuizButton", "#restartButton"]) {
    const button = document.querySelector(selector);
    if (!button || button.dataset.autoFullscreenBound === "true") continue;
    button.dataset.autoFullscreenBound = "true";
    button.addEventListener("click", requestQuizFullscreen, { capture: true });
  }
}

export function initializeQuizPresentation(difficulty) {
  if (initialized) return;
  initialized = true;
  activeDifficulty = normalizeDifficulty(difficulty);
  readingMode = activeDifficulty === "kids" ? "hiragana" : "kanji";

  loadPresentationStyles();
  ensureKidsReadingSetting();
  installQuestionReadingObserver();
  installChoiceObserver();
  installRuleAudioObserver();
  installAutomaticFullscreen();
}
