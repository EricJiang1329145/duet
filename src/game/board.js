/**
 * Pure message-board rules shared by the client, the M0 host and the Durable
 * Object. Messages live for a bounded window (180 days) so room storage stays
 * small; the export helper turns the stored window into a keepable Markdown
 * file.
 */
export const BOARD_RETENTION_DAYS = 180;
export const BOARD_TEXT_LIMIT = 140;
export const BOARD_SNAPSHOT_LIMIT = 200;
export const BOARD_EXPORT_LIMIT = 5000;
export const BOARD_MEMORY_LIMIT = 1000;

const DAY_MS = 24 * 60 * 60 * 1000;
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;
const ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;

export function boardCutoff(now = Date.now()) {
  return now - BOARD_RETENTION_DAYS * DAY_MS;
}

export function normalizeBoardText(value) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, BOARD_TEXT_LIMIT);
}

function sanitizeAuthorName(value) {
  const text = typeof value === "string" ? value.trim().slice(0, 12) : "";
  return text || "?";
}

function sanitizeMessage(raw, cutoff, now) {
  if (!raw || typeof raw !== "object") return null;

  const id = typeof raw.id === "string" && ID_PATTERN.test(raw.id) ? raw.id : "";
  const authorId =
    typeof raw.authorId === "string" ? raw.authorId.trim().slice(0, 64) : "";
  const text = normalizeBoardText(raw.text);
  const createdAt = Number(raw.createdAt);

  if (!id || !authorId || !text) return null;
  if (!Number.isFinite(createdAt)) return null;
  if (createdAt < cutoff || createdAt > now + FUTURE_TOLERANCE_MS) return null;

  return {
    id,
    authorId,
    authorName: sanitizeAuthorName(raw.authorName),
    text,
    createdAt
  };
}

/**
 * Normalize an untrusted list: drop expired/invalid entries, dedupe by id and
 * keep chronological order. `limit` keeps only the newest N messages.
 */
export function sanitizeBoardMessages(list, now = Date.now(), limit = 0) {
  if (!Array.isArray(list)) return [];

  const cutoff = boardCutoff(now);
  const seen = new Set();
  const messages = [];

  for (const raw of list) {
    const message = sanitizeMessage(raw, cutoff, now);
    if (!message || seen.has(message.id)) continue;
    seen.add(message.id);
    messages.push(message);
  }

  messages.sort(
    (a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id)
  );

  if (limit > 0 && messages.length > limit) {
    return messages.slice(-limit);
  }
  return messages;
}

export function createBoardMessage(raw, now = Date.now()) {
  return sanitizeMessage(raw, boardCutoff(now), now);
}

export function appendBoardMessage(messages, message, now = Date.now()) {
  const next = sanitizeBoardMessages(
    [...(messages ?? []), message],
    now,
    BOARD_MEMORY_LIMIT
  );
  return next;
}

export function cloneBoardMessages(messages) {
  return (messages ?? []).map((message) => ({ ...message }));
}

/**
 * How many messages the given player has not read yet. Your own notes never
 * count as unread.
 */
export function boardUnreadCount(messages, lastReadAt, selfId) {
  const since = Number(lastReadAt) || 0;
  return (messages ?? []).filter(
    (message) =>
      message.createdAt > since &&
      (!selfId || message.authorId !== selfId)
  ).length;
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

export function formatBoardTimestamp(value) {
  const date = new Date(Number(value) || 0);
  if (!Number.isFinite(date.getTime())) return "";
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(
    date.getDate()
  )} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

/**
 * Build the downloadable archive. Markdown keeps the notes readable years
 * after the room has pruned them.
 */
export function boardToMarkdown(
  messages,
  { roomId = "", exportedAt = Date.now() } = {}
) {
  const list = sanitizeBoardMessages(messages, exportedAt, BOARD_EXPORT_LIMIT);
  const title = roomId ? `Duet 留言板 · ${roomId}` : "Duet 留言板";
  const lines = [
    `# ${title}`,
    "",
    `- 导出时间：${formatBoardTimestamp(exportedAt)}`,
    `- 留言数量：${list.length}`,
    `- 保留范围：最近 ${BOARD_RETENTION_DAYS} 天`,
    "",
    "---",
    ""
  ];

  for (const message of list) {
    lines.push(
      `## ${formatBoardTimestamp(message.createdAt)} · ${message.authorName}`,
      "",
      message.text,
      ""
    );
  }

  lines.push(
    "---",
    "",
    `由 Duet 导出 · 更早的留言已按 ${BOARD_RETENTION_DAYS} 天策略清理。`,
    ""
  );

  return lines.join("\n");
}
