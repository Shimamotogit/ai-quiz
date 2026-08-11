const LEGACY_GRADE_AUDIO = "/音声データ_MP3/01.システム/いい成績です.mp3";
const ACTUAL_GRADE_AUDIO = "/音声データ_MP3/01.システム/素晴らしい成績です！.mp3";

export function rewriteSystemAudioSource(value, baseHref = "https://example.invalid/") {
  const source = String(value ?? "");
  if (!source) return source;

  try {
    const url = new URL(source, baseHref);
    const decodedPath = decodeURIComponent(url.pathname);
    if (!decodedPath.endsWith(LEGACY_GRADE_AUDIO)) return source;

    const replacementPath = decodedPath.slice(0, -LEGACY_GRADE_AUDIO.length) + ACTUAL_GRADE_AUDIO;
    url.pathname = replacementPath;
    return url.href;
  } catch {
    return source;
  }
}

export function installSystemAudioAlias() {
  if (typeof HTMLMediaElement === "undefined") return false;

  const prototype = HTMLMediaElement.prototype;
  if (prototype.__aiQuizGradeAudioAliasInstalled === true) return true;

  const descriptor = Object.getOwnPropertyDescriptor(prototype, "src");
  if (!descriptor?.get || !descriptor?.set || descriptor.configurable === false) return false;

  Object.defineProperty(prototype, "src", {
    configurable: descriptor.configurable,
    enumerable: descriptor.enumerable,
    get: descriptor.get,
    set(value) {
      const baseHref = globalThis.location?.href ?? "https://example.invalid/";
      return descriptor.set.call(this, rewriteSystemAudioSource(value, baseHref));
    }
  });

  Object.defineProperty(prototype, "__aiQuizGradeAudioAliasInstalled", {
    configurable: true,
    value: true
  });

  return true;
}
