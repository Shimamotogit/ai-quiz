const CHOICE_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const COLOR_CLASS_PREFIX = "choice-color-";
const MAX_MEDIA_PATH_LENGTH = 240;

let questionData = [];
let lastMediaKey = "";
let feedbackPanel = null;

function normalizeChoiceText(value) {
  return String(value ?? "")
    .replace(/^[A-ZＡ-Ｚ][．.。]\s*/i, "")
    .trim();
}

function sameChoices(left, right) {
  if (left.length !== right.length) return false;
  return left.every((choice, index) => normalizeChoiceText(choice) === normalizeChoiceText(right[index]));
}

function getCurrentChoiceTexts() {
  return [...document.querySelectorAll("#choiceLabels .choice-label")].map((label) => (
    label.dataset.rawChoiceText ?? label.textContent
  ));
}

function getCurrentQuestion() {
  const text = document.querySelector("#questionText")?.textContent?.trim();
  if (!text) return null;

  const choices = getCurrentChoiceTexts();
  return questionData.find((question) => (
    question.text === text && sameChoices(question.choices ?? [], choices)
  )) ?? questionData.find((question) => question.text === text) ?? null;
}

function resolveSameOriginAsset(path, allowedExtensions) {
  if (typeof path !== "string" || !path.trim()) return null;
  const value = path.trim();
  if (value.length > MAX_MEDIA_PATH_LENGTH) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return null;
  if (value.includes("\\") || value.split("/").includes("..")) return null;

  const url = new URL(value, window.location.href);
  if (url.origin !== window.location.origin) return null;

  const pathname = url.pathname.toLowerCase();
  if (!allowedExtensions.some((extension) => pathname.endsWith(extension))) return null;
  return url.href;
}

function createMediaNotice(text) {
  const node = document.createElement("p");
  node.className = "media-notice";
  node.textContent = text;
  return node;
}

function ensureFeedbackPanel() {
  if (feedbackPanel?.isConnected) return feedbackPanel;
  const stage = document.querySelector("#stage");
  if (!stage) return null;

  feedbackPanel = document.createElement("section");
  feedbackPanel.id = "quizFeedbackPanel";
  feedbackPanel.className = "quiz-feedback-panel";
  feedbackPanel.setAttribute("aria-live", "polite");
  feedbackPanel.hidden = true;
  stage.append(feedbackPanel);
  return feedbackPanel;
}

function renderFeedback(question, showExplanation) {
  const panel = ensureFeedbackPanel();
  if (!panel) return;

  const explanationText = typeof question?.explanation === "string"
    ? question.explanation.trim()
    : "";

  if (!showExplanation || !explanationText) {
    panel.replaceChildren();
    panel.hidden = true;
    return;
  }

  const explanation = document.createElement("p");
  explanation.className = "question-explanation";
  explanation.textContent = explanationText;
  panel.replaceChildren(explanation);
  panel.hidden = false;
}

function renderQuestionMedia(question, showExplanation = false) {
  const container = document.querySelector("#questionMedia");
  if (!container) return;

  const mediaKey = `${question?.id ?? ""}|${showExplanation ? "explain" : "question"}`;
  if (mediaKey === lastMediaKey) return;
  lastMediaKey = mediaKey;

  container.replaceChildren();
  const nodes = [];

  const imageUrl = resolveSameOriginAsset(question?.image, [
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
    ".gif",
    ".svg"
  ]);
  if (imageUrl) {
    const figure = document.createElement("figure");
    figure.className = "question-image-frame";

    const image = document.createElement("img");
    image.src = imageUrl;
    image.alt = typeof question.imageAlt === "string" && question.imageAlt.trim()
      ? question.imageAlt.trim()
      : "問題画像";
    image.loading = "eager";
    image.decoding = "async";
    image.addEventListener("error", () => {
      figure.replaceChildren(createMediaNotice("画像ファイルが見つかりません。画像なしで続行します。"));
    }, { once: true });

    figure.append(image);
    nodes.push(figure);
  }

  const audioUrl = resolveSameOriginAsset(question?.audio, [".mp3"]);
  if (audioUrl) {
    const audioBox = document.createElement("div");
    audioBox.className = "question-audio-box";

    const label = document.createElement("span");
    label.textContent = "音声";

    const audio = document.createElement("audio");
    audio.controls = true;
    audio.preload = "none";
    audio.src = audioUrl;
    audio.addEventListener("error", () => {
      audioBox.replaceChildren(createMediaNotice("音声ファイルが見つかりません。音声なしで続行します。"));
    }, { once: true });

    audioBox.append(label, audio);
    nodes.push(audioBox);
  }

  container.hidden = nodes.length === 0;
  container.replaceChildren(...nodes);
  renderFeedback(question, showExplanation);
}

function shouldShowExplanation() {
  return [...document.querySelectorAll("#choiceLabels .choice-label")]
    .some((label) => label.classList.contains("correct") || label.classList.contains("wrong"));
}

function updateMediaForCurrentQuestion() {
  renderQuestionMedia(getCurrentQuestion(), shouldShowExplanation());
}

function decorateChoiceLabels() {
  const labels = [...document.querySelectorAll("#choiceLabels .choice-label")];

  labels.forEach((label, index) => {
    if (!label.dataset.rawChoiceText) {
      label.dataset.rawChoiceText = label.textContent.trim();
    }

    const colorClass = `${COLOR_CLASS_PREFIX}${(index % 6) + 1}`;
    for (const className of [...label.classList]) {
      if (className.startsWith(COLOR_CLASS_PREFIX) && className !== colorClass) {
        label.classList.remove(className);
      }
    }
    if (!label.classList.contains(colorClass)) {
      label.classList.add(colorClass);
    }

    const rawText = label.dataset.rawChoiceText;
    if (
      label.dataset.choiceDecorated === rawText &&
      label.querySelector(".choice-badge") &&
      label.querySelector(".choice-text")
    ) {
      return;
    }

    const normalizedText = normalizeChoiceText(rawText);
    const badgeText = rawText === "〇" || rawText === "✕"
      ? rawText
      : CHOICE_LETTERS[index] ?? String(index + 1);

    const badge = document.createElement("span");
    badge.className = "choice-badge";
    badge.textContent = badgeText;

    const body = document.createElement("span");
    body.className = "choice-text";
    body.textContent = normalizedText;

    label.replaceChildren(badge, body);
    label.dataset.choiceDecorated = rawText;
  });
}

function moveQuestionMediaToStage() {
  const stage = document.querySelector("#stage");
  const container = document.querySelector("#questionMedia");
  if (stage && container && container.parentElement !== stage) {
    stage.append(container);
  }
}

async function loadQuestionData() {
  const response = await fetch("questions.json", { cache: "no-store" });
  if (!response.ok) throw new Error(`問題データを読み込めませんでした (${response.status})`);
  const data = await response.json();
  questionData = Array.isArray(data.questions) ? data.questions : [];
}

export async function initializeQuizMedia() {
  try {
    await loadQuestionData();
  } catch (error) {
    console.error(error);
    questionData = [];
  }

  moveQuestionMediaToStage();
  ensureFeedbackPanel();

  const questionText = document.querySelector("#questionText");
  const choiceLabels = document.querySelector("#choiceLabels");

  const observer = new MutationObserver(() => {
    decorateChoiceLabels();
    updateMediaForCurrentQuestion();
  });

  if (questionText) {
    observer.observe(questionText, { childList: true, characterData: true, subtree: true });
  }

  if (choiceLabels) {
    observer.observe(choiceLabels, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class"]
    });
  }

  decorateChoiceLabels();
  updateMediaForCurrentQuestion();
}
