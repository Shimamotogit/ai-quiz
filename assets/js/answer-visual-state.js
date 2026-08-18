export function normalizeChoiceResultClasses(labels) {
  const items = [...labels];
  const hasCorrect = items.some((label) => label.classList.contains("correct"));
  if (!hasCorrect) return false;

  let changed = false;
  items.forEach((label) => {
    if (label.classList.contains("active")) {
      label.classList.remove("active");
      changed = true;
    }
    if (label.classList.contains("wrong")) {
      label.classList.remove("wrong");
      changed = true;
    }
  });
  return changed;
}

export function initializeAnswerVisualState() {
  const container = document.querySelector("#choiceLabels");
  if (!container) return;

  let observer;
  const observe = () => {
    observer.observe(container, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class"]
    });
  };

  const sync = () => {
    // 自分自身の class 変更を再検知してループしないよう、正規化中は監視を外す。
    observer.disconnect();
    try {
      normalizeChoiceResultClasses(container.children);
    } finally {
      observe();
    }
  };

  observer = new MutationObserver(sync);
  observe();
  sync();
}
