const CREDIT_TEXT = "VOICEVOX:ずんだもん";
const VOICEVOX_TERMS_URL = "https://voicevox.hiroshiba.jp/term/";
const ZUNDAMON_TERMS_URL = "https://zunko.jp/con_ongen_kiyaku.html";

function createExternalLink(label, href) {
  const link = document.createElement("a");
  link.href = href;
  link.textContent = label;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  return link;
}

function createCreditNotice(id) {
  const paragraph = document.createElement("p");
  paragraph.id = id;
  paragraph.className = "local-only-note";
  paragraph.setAttribute("aria-label", "音声クレジット");

  const label = document.createTextNode("音声：");
  const credit = document.createElement("strong");
  credit.textContent = CREDIT_TEXT;
  const separator = document.createTextNode(" ／ ");
  const voicevoxLink = createExternalLink("VOICEVOX利用規約", VOICEVOX_TERMS_URL);
  const separator2 = document.createTextNode(" ／ ");
  const zundamonLink = createExternalLink("ずんだもん音源利用規約", ZUNDAMON_TERMS_URL);

  paragraph.append(label, credit, separator, voicevoxLink, separator2, zundamonLink);
  return paragraph;
}

export function installVoicevoxCredit() {
  const titleStep = document.querySelector("#titleStep");
  if (titleStep && !document.querySelector("#voicevoxCreditTitle")) {
    titleStep.append(createCreditNotice("voicevoxCreditTitle"));
  }

  const helpPanel = document.querySelector("#helpPanel");
  if (helpPanel && !document.querySelector("#voicevoxCreditHelp")) {
    helpPanel.append(createCreditNotice("voicevoxCreditHelp"));
  }
}
