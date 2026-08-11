export const DEFAULT_HOLD_DURATION_SECONDS = 10;
const LEGACY_HOLD_DURATION_SECONDS = 1.2;

export function initializeQuizDefaults() {
  const input = document.querySelector("#holdDurationInput");
  if (!input) return;

  let userChanged = false;
  const applyDefault = () => {
    if (userChanged) return;
    const value = Number(input.value);
    if (!Number.isFinite(value) || value === LEGACY_HOLD_DURATION_SECONDS) {
      input.value = String(DEFAULT_HOLD_DURATION_SECONDS);
    }
  };

  input.addEventListener("input", () => {
    userChanged = true;
  });

  // app.js が questions.json の旧1.2秒設定を反映した後にも10秒へ戻す。
  const help = document.querySelector("#questionCountHelp");
  if (help && /読み込み中/.test(help.textContent ?? "")) {
    const observer = new MutationObserver(() => {
      if (/読み込み中/.test(help.textContent ?? "")) return;
      applyDefault();
      observer.disconnect();
    });
    observer.observe(help, { childList: true, characterData: true, subtree: true });
    window.setTimeout(() => observer.disconnect(), 5000);
  }

  // 表示上もすぐ10秒にし、開始直前にも旧値だけを補正する。
  applyDefault();
  document.querySelector("#startQuizButton")?.addEventListener("click", applyDefault, { capture: true });
}
