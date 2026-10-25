import { CHAT } from "../config.js";
import {
  canAcknowledgeChat,
  chatTextLength,
  normalizeChatText
} from "../game/chat.js";
import { getActivePlayer } from "../game/player.js";
import { clockNow } from "../runtime/clock.js";

/**
 * Ephemeral room chat. Messages are not part of game state and are never
 * persisted: the room authority relays them to same-scene players, and a
 * read receipt is sent only after the bubble was actually painted while the
 * tab is visible.
 */
export function createChatPanel({
  getState,
  sendChat = null,
  ackChat = null,
  isTransitioning = () => false,
  showBubble = null,
  hideBubble = null
}) {
  const dockEl = document.getElementById("chat-dock");
  const toggleEl = document.getElementById("chat-toggle");
  const sheetEl = document.getElementById("chat-sheet");
  const inputEl = document.getElementById("chat-input");
  const countEl = document.getElementById("chat-count");
  const sendEl = document.getElementById("chat-send");
  const closeEl = document.getElementById("chat-close");
  const hintEl = document.getElementById("chat-hint");
  const dotEl = toggleEl?.querySelector(".chat-fab__dot");

  const bubbles = new Map();
  const recent = new Map();
  const bubbleTimers = new Map();

  let open = false;
  let selfId = null;
  let roomEnabled = null;
  let lastScene = null;
  let lastSelfId = null;
  let hasUnread = false;
  let hintLockUntil = 0;

  function roomAvailable(state) {
    return Boolean(state?.room) && typeof sendChat === "function";
  }

  function setOpen(next) {
    if (open === next) return;
    open = next;
    sheetEl.hidden = !open;
    toggleEl?.setAttribute("aria-expanded", String(open));
    document.documentElement.classList.toggle("chat-open", open);
    if (open) {
      hasUnread = false;
      if (dotEl) dotEl.hidden = true;
      window.setTimeout(() => {
        inputEl.focus({ preventScroll: true });
        syncKeyboardOffset();
      }, 30);
    } else {
      inputEl.blur();
      document.documentElement.style.removeProperty("--keyboard-offset");
    }
  }

  function syncKeyboardOffset() {
    const vv = window.visualViewport;
    if (!vv) return;
    const offset = Math.max(
      0,
      window.innerHeight - vv.height - vv.offsetTop
    );
    document.documentElement.style.setProperty(
      "--keyboard-offset",
      `${Math.round(offset)}px`
    );
  }

  function clearBubble(playerId) {
    const timer = bubbleTimers.get(playerId);
    if (timer) window.clearTimeout(timer);
    bubbleTimers.delete(playerId);
    const existing = bubbles.get(playerId);
    if (existing && hideBubble) hideBubble(playerId);
    bubbles.delete(playerId);
  }

  function clearAllBubbles() {
    for (const playerId of [...bubbles.keys()]) clearBubble(playerId);
  }

  function expireBubble(playerId, id) {
    const current = bubbles.get(playerId);
    if (!current || current.id !== id) return;
    clearBubble(playerId);
  }

  function showOwnState(entry) {
    const current = bubbles.get(selfId);
    if (!current || current.id !== entry.id) return;
    if (showBubble) {
      showBubble(selfId, {
        text: entry.text,
        state: entry.read ? "已读" : "未读",
        own: true
      });
    }
  }

  function showMessage(message, { own = false, cid = null } = {}) {
    if (!message?.text) return;
    if (recent.has(message.id)) return;

    const entry = {
      ...message,
      own,
      cid,
      serverId: own ? null : message.id,
      read: false,
      acked: false
    };
    recent.set(entry.id, entry);
    while (recent.size > 24) {
      recent.delete(recent.keys().next().value);
    }

    clearBubble(entry.from);
    bubbles.set(entry.from, entry);
    if (showBubble) {
      showBubble(entry.from, {
        text: entry.text,
        state: own ? "未读" : "",
        own
      });
    }

    if (!own && !open) {
      hasUnread = true;
      if (dotEl) dotEl.hidden = false;
    }

    bubbleTimers.set(
      entry.from,
      window.setTimeout(
        () => expireBubble(entry.from, entry.id),
        CHAT.durationMs
      )
    );

    if (!own) scheduleReadAck(entry);
  }

  function scheduleReadAck(entry) {
    // Two animation frames: one to commit the DOM, one to let it paint.
    // Only then may we claim that the message was actually seen.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!recent.has(entry.id) || entry.acked) return;
        // If a newer message replaced this bubble before paint, this one was
        // never really readable; leave it unread.
        const current = bubbles.get(entry.from);
        if (!current || current.id !== entry.id) return;
        const state = getState();
        const self = getActivePlayer(state);
        const sender = state.players?.[entry.from];
        const sameScene =
          self?.currentScene && self.currentScene === sender?.currentScene;
        const visible = document.visibilityState === "visible";
        const allowed = canAcknowledgeChat({
          message: entry,
          selfId: self?.id,
          selfScene: self?.currentScene,
          senderScene: sender?.currentScene,
          documentVisible: visible,
          transitioning: isTransitioning(),
          now: clockNow()
        });
        if (!allowed || !sameScene) return;
        entry.acked = true;
        ackChat?.(entry.id);
      });
    });
  }

  function handleAck(ack) {
    if (!ack) return;
    const entry = ack.cid
      ? [...recent.values()].find((item) => item.cid === ack.cid)
      : null;
    if (!entry) return;

    if (ack.id) entry.serverId = ack.id;
    if (ack.code === "RATE_LIMITED") {
      setHint("说得太快了，稍等一下。", 2400);
      return;
    }
    if (ack.delivered === 0) {
      setHint("对方不在这一层，这条消息没有送达。", 3200);
      return;
    }
    showOwnState(entry);
  }

  function handleRead(read) {
    if (!read?.id) return;
    const entry = [...recent.values()].find(
      (item) => item.own && (item.serverId === read.id || item.id === read.id)
    );
    if (!entry) return;
    entry.read = true;
    showOwnState(entry);
    if (!bubbles.has(selfId)) setHint("对方已读上一条消息。", 2400);
  }

  function receive(message) {
    if (!message || !roomEnabled) return;
    if (message.from === selfId) return;

    const state = getState();
    const self = getActivePlayer(state);
    const sender = state.players?.[message.from];
    // Defensive same-scene check. A message that cannot be shown is also not
    // acknowledged, so the sender keeps 未读.
    if (!self || !sender || self.currentScene !== sender.currentScene) return;
    if (document.visibilityState !== "visible") return;
    if (isTransitioning()) return;

    showMessage(message, { own: false });
  }

  function sendCurrent() {
    if (typeof sendChat !== "function") return;
    if (isTransitioning()) {
      setHint("过场中，稍等一下再发。", 1600);
      return;
    }
    const text = normalizeChatText(inputEl.value);
    if (!text) return;

    const result = sendChat(text);
    if (!result?.ok) {
      setHint(
        result?.code === "OFFLINE"
          ? "连接中断了，正在重连…"
          : "这条消息没能发出去。",
        2400
      );
      return;
    }

    inputEl.value = "";
    updateComposer();
    showMessage(result.message, { own: true, cid: result.cid });
  }

  function updateComposer() {
    const text = normalizeChatText(inputEl.value);
    const length = chatTextLength(text);
    if (countEl) countEl.textContent = `${length}/${CHAT.textLimit}`;
    if (sendEl) sendEl.disabled = !text || typeof sendChat !== "function";
  }

  function setHint(text, duration = 0) {
    if (!hintEl) return;
    if (!duration) {
      hintEl.textContent = text;
      hintLockUntil = 0;
      return;
    }
    hintEl.textContent = text;
    hintLockUntil = clockNow() + duration;
  }

  function sync(state) {
    if (!state) return;
    const enabled = roomAvailable(state);
    const self = getActivePlayer(state);
    selfId = self?.id ?? null;

    if (enabled !== roomEnabled) {
      roomEnabled = enabled;
      if (dockEl) dockEl.hidden = !enabled;
      document.documentElement.classList.toggle("has-chat", enabled);
      if (!enabled) setOpen(false);
    }

    if (!enabled) {
      clearAllBubbles();
      lastScene = self?.currentScene ?? null;
      return;
    }

    if (self?.currentScene !== lastScene) {
      // Leaving a scene hides every transient bubble; messages are not kept.
      clearAllBubbles();
      lastScene = self?.currentScene ?? null;
    }

    if (self?.id !== lastSelfId) {
      clearAllBubbles();
      lastSelfId = self?.id ?? null;
    }

    const role = state.room?.role;
    if (role === "reconnecting" || role === "connecting") {
      setHint("连接中断，正在重连…");
    } else if (role === "rejected") {
      setHint("房间已满，暂时不能聊天。");
    } else if (clockNow() > hintLockUntil) {
      setHint("同场景可见 · 12 秒后消失");
    }
  }

  function onTogglePointerDown(event) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    setOpen(!open);
  }

  function onSendPointerDown(event) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    sendCurrent();
  }

  function onClosePointerDown(event) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    setOpen(false);
  }

  toggleEl?.addEventListener("pointerdown", onTogglePointerDown, {
    passive: false
  });
  sendEl?.addEventListener("pointerdown", onSendPointerDown, { passive: false });
  closeEl?.addEventListener("pointerdown", onClosePointerDown, {
    passive: false
  });
  inputEl?.addEventListener("input", updateComposer);
  inputEl?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.shiftKey) return;
    if (event.isComposing || event.keyCode === 229) return;
    event.preventDefault();
    sendCurrent();
  });

  window.visualViewport?.addEventListener("resize", syncKeyboardOffset);
  window.visualViewport?.addEventListener("scroll", syncKeyboardOffset);

  window.addEventListener("keydown", (event) => {
    if (!open || event.key !== "Escape") return;
    setOpen(false);
  });

  if (dotEl) dotEl.hidden = true;
  setHint("同场景可见 · 12 秒后消失");
  updateComposer();

  return {
    sync,
    receive,
    handleAck,
    handleRead,
    open: () => setOpen(true),
    close: () => setOpen(false),
    isOpen: () => open
  };
}
