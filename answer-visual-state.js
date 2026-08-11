export function normalizeChoiceResultClasses(labels) {
  const items = [...labels];
  const hasCorrect = items.some((label) => label.classList.contains("correct"));
  if (!hasCorrect) return false;

  items.forEach((label) => {
    label.classList.remove("active", "wrong");
  });
  return true;
}

export function initializeAnswerVisualState() {
  const container = document.querySelector("#choiceLabels");
  if (!container) return;

  let normalizing = false;
  const sync = () => {
    if (normalizing) return;
    normalizing = true;
    normalizeChoiceResultClasses(container.children);
    normalizing = false;
  };

  const observer = new MutationObserver(sync);
  observer.observe(container, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class"]
  });

  sync();
}
