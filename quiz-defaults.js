export const DEFAULT_HOLD_DURATION_SECONDS = 10;

export function normalizeHoldDurationSeconds(value) {
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds >= 0.5 && seconds <= 10
    ? seconds
    : DEFAULT_HOLD_DURATION_SECONDS;
}

export function initializeQuizDefaults() {
  const input = document.querySelector("#holdDurationInput");
  if (!input) return;

  const applyValidValue = () => {
    const normalized = normalizeHoldDurationSeconds(input.value);
    if (String(normalized) !== input.value) {
      input.value = String(normalized);
    }
  };

  applyValidValue();
  document.querySelector("#startQuizButton")?.addEventListener("click", applyValidValue, { capture: true });
}
