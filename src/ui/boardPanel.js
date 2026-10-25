import { ACTION, SCENE } from "../config.js";
import {
  BOARD_RETENTION_DAYS,
  BOARD_TEXT_LIMIT,
  boardToMarkdown,
  normalizeBoardText
} from "../game/board.js";
import { getActivePlayer } from "../game/player.js";
import { clockNow } from "../runtime/clock.js";

function pad2(value) {
  return String(value).padStart(2, "0");
}

function formatMessageTime(createdAt, now) {
  const date = new Date(createdAt);
  const current = new Date(now);
  if (!Number.isFinite(date.getTime())) return "";

  const time = `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
  const sameDay =
    date.getFullYear() === current.getFullYear() &&
    date.getMonth() === current.getMonth() &&
    date.getDate() === current.getDate();
  if (sameDay) return `今天 ${time}`;
  if (date.getFullYear() === current.getFullYear()) {
    return `${date.getMonth() + 1}月${date.getDate()}日 ${time}`;
  }
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

function fileStamp(now) {
  const date = new Date(now);
  return `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(
    date.getDate()
  )}`;
}

function triggerDownload(text, filename) {
  const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1200);
}

/**
 * Shared living-room message board. Message state lives in the session; this
 * module only renders it, collects text and turns the stored window into a
 * downloadable Markdown archive.
 */
export function createBoardPanel({ dispatch, getState, exportBoard = null }) {
  const panelEl = document.getElementById("board-panel");
  const backdropEl = document.getElementById("board-backdrop");
  const listEl = document.getElementById("board-list");
  const emptyEl = document.getElementById("board-empty");
  const inputEl = document.getElementById("board-input");
  const countEl = document.getElementById("board-count");
  const sendEl = document.getElementById("board-send");
  const closeEl = document.getElementById("board-close");
  const exportEl = document.getElementById("board-export");
  const noteEl = document.getElementById("board-note");

  noteEl.textContent = `仅保留最近 ${BOARD_RETENTION_DAYS} 天 · 导出可长期保存`;
  inputEl.maxLength = BOARD_TEXT_LIMIT;

  let isOpen = false;
  let lastSignature = "";
  let scrollToBottom = false;
  let pending = null;
  let exporting = false;

  function updateComposer() {
    const text = normalizeBoardText(inputEl.value);
    countEl.textContent = `${inputEl.value.length}/${BOARD_TEXT_LIMIT}`;
    sendEl.disabled = !text || Boolean(pending);
  }

  function resolvePending(messages, player) {
    if (!pending) return;
    const landed = messages.some(
      (message) =>
        message.authorId === player.id &&
        message.text === pending.text &&
        message.createdAt >= pending.since - 2000
    );
    if (!landed) return;

    window.clearTimeout(pending.timer);
    const text = pending.text;
    pending = null;
    if (normalizeBoardText(inputEl.value) === text) {
      inputEl.value = "";
    }
    updateComposer();
  }

  function renderMessages(messages, selfId, now) {
    const atBottom =
      listEl.scrollHeight - listEl.scrollTop - listEl.clientHeight < 48;
    listEl.textContent = "";
    emptyEl.hidden = messages.length > 0;

    for (const message of messages) {
      const article = document.createElement("article");
      article.className = "board-message";
      if (message.authorId === selfId) article.classList.add("is-self");

      const head = document.createElement("div");
      head.className = "board-message__head";

      const author = document.createElement("b");
      author.className = "board-message__author";
      author.textContent = message.authorName;

      const time = document.createElement("time");
      time.className = "board-message__time";
      time.dateTime = new Date(message.createdAt).toISOString();
      time.textContent = formatMessageTime(message.createdAt, now);

      const text = document.createElement("p");
      text.className = "board-message__text";
      text.textContent = message.text;

      head.append(author, time);
      article.append(head, text);
      listEl.append(article);
    }

    if (scrollToBottom || atBottom) {
      listEl.scrollTop = listEl.scrollHeight;
    }
    scrollToBottom = false;
  }

  function sync(state) {
    const player = getActivePlayer(state);
    const open = Boolean(
      player &&
        player.currentScene === SCENE.INDOOR_1 &&
        state.ui.boardOpen
    );

    if (open !== isOpen) {
      isOpen = open;
      panelEl.hidden = !open;
      document.documentElement.classList.toggle("board-open", open);
      if (!open && document.activeElement === inputEl) inputEl.blur();
      lastSignature = "";
      scrollToBottom = open;
      updateComposer();
    }
    if (!open || !player) return;

    const messages = state.board?.messages ?? [];
    const signature = [
      messages.length,
      messages[0]?.id ?? "",
      messages[messages.length - 1]?.id ?? "",
      player.id
    ].join("|");

    if (signature !== lastSignature) {
      lastSignature = signature;
      renderMessages(messages, player.id, clockNow());
    }

    resolvePending(messages, player);
  }

  function submit() {
    if (pending) return;
    const text = normalizeBoardText(inputEl.value);
    if (!text) return;

    const since = clockNow();
    pending = {
      text,
      since,
      timer: window.setTimeout(() => {
        pending = null;
        updateComposer();
      }, 6000)
    };

    dispatch(ACTION.POST_MESSAGE, null, { text });
    updateComposer();
  }

  async function exportArchive() {
    if (exporting) return;
    exporting = true;
    exportEl.disabled = true;
    const label = exportEl.textContent;
    exportEl.textContent = "导出中…";

    try {
      const state = getState();
      const messages = exportBoard
        ? await exportBoard()
        : state.board?.messages ?? [];
      const now = clockNow();
      const markdown = boardToMarkdown(messages, {
        roomId: state.room?.id ?? "",
        exportedAt: now
      });
      const room = state.room?.id ? `-${state.room.id}` : "";
      triggerDownload(markdown, `duet-board${room}-${fileStamp(now)}.md`);
      exportEl.textContent = label;
    } catch {
      exportEl.textContent = "导出失败";
      window.setTimeout(() => {
        exportEl.textContent = label;
      }, 1600);
    } finally {
      exporting = false;
      exportEl.disabled = false;
    }
  }

  function onClosePointerDown(event) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    dispatch(ACTION.CLOSE_BOARD, null, null);
  }

  function onSendPointerDown(event) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    submit();
  }

  function onExportPointerDown(event) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    exportArchive();
  }

  inputEl.addEventListener("input", updateComposer);
  inputEl.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      submit();
    }
  });
  sendEl.addEventListener("pointerdown", onSendPointerDown, { passive: false });
  closeEl.addEventListener("pointerdown", onClosePointerDown, { passive: false });
  backdropEl.addEventListener("pointerdown", onClosePointerDown, {
    passive: false
  });
  exportEl.addEventListener("pointerdown", onExportPointerDown, {
    passive: false
  });

  window.addEventListener("keydown", (event) => {
    if (!isOpen || event.key !== "Escape") return;
    dispatch(ACTION.CLOSE_BOARD, null, null);
  });

  return { sync };
}
