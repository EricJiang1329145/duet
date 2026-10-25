import { CHAT } from "../config.js";

const ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;
// Control characters, bidi overrides, BOM and zero-width space. Deliberately
// keeps U+200C/U+200D and variation selectors so family / skin-tone emoji stay
// intact.
const FORBIDDEN = /[\u0000-\u001F\u007F-\u009F\u200B\u202A-\u202E\u2066-\u2069\uFEFF]/g;
const MAX_CODE_UNITS = 1024;
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

let segmenter = null;
try {
  if (typeof Intl !== "undefined" && typeof Intl.Segmenter === "function") {
    segmenter = new Intl.Segmenter("zh", { granularity: "grapheme" });
  }
} catch {
  segmenter = null;
}

export function splitGraphemes(text) {
  const value = String(text ?? "");
  if (!value) return [];
  if (segmenter) {
    return Array.from(segmenter.segment(value), (part) => part.segment);
  }
  // Code-point fallback: never splits a surrogate pair, even though it can
  // split a ZWJ sequence on very old engines.
  return Array.from(value);
}

export function chatTextLength(text) {
  return splitGraphemes(text).length;
}

/**
 * Chat text is plain text rendered with textContent. Newlines collapse to a
 * single space, bidi/control characters are removed, and the limit is counted
 * in grapheme clusters so emoji are never cut in half.
 */
export function normalizeChatText(value) {
  if (typeof value !== "string") return "";
  const cleaned = value
    .replace(/[\r\n\t\f\v]+/g, " ")
    .replace(FORBIDDEN, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "";
  const graphemes = splitGraphemes(cleaned);
  const truncated = graphemes.slice(0, CHAT.textLimit).join("");
  return truncated.slice(0, MAX_CODE_UNITS).trim();
}

function sanitizeName(value) {
  const text = typeof value === "string" ? value.trim().slice(0, 12) : "";
  return text || "?";
}

export function createChatMessage(raw) {
  if (!raw || typeof raw !== "object") return null;

  const id = typeof raw.id === "string" && ID_PATTERN.test(raw.id) ? raw.id : "";
  const from =
    typeof raw.from === "string" ? raw.from.trim().slice(0, 64) : "";
  const text = normalizeChatText(raw.text);
  const at = Number(raw.at);

  if (!id || !from || !text || !Number.isFinite(at)) return null;

  return {
    id,
    from,
    name: sanitizeName(raw.name),
    text,
    at
  };
}

export function sanitizeChatMessage(raw, now = Date.now()) {
  const message = createChatMessage(raw);
  if (!message) return null;
  if (message.at > now + FUTURE_TOLERANCE_MS) return null;
  return message;
}

/**
 * Strict "seen" decision. Ambiguous situations stay unread on purpose:
 * different scene, hidden tab, scene transition, or a message older than the
 * bubble lifetime never produces a read receipt.
 */
export function canAcknowledgeChat({
  message,
  selfId,
  selfScene,
  senderScene,
  documentVisible = true,
  transitioning = false,
  now = Date.now()
} = {}) {
  if (!message || !selfId || !selfScene || !senderScene) return false;
  if (message.from === selfId) return false;
  if (selfScene !== senderScene) return false;
  if (!documentVisible) return false;
  if (transitioning) return false;
  if (now < message.at) return false;
  if (now - message.at > CHAT.durationMs) return false;
  return true;
}

export function readLabel({ delivered = 0, read = false } = {}) {
  if (read) return "已读";
  // Delivered but not seen is still 未读; this is the strict rule.
  return "未读";
}

export function shouldShowChatCopy(message, selfId) {
  return Boolean(message && message.from !== selfId);
}
