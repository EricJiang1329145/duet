/**
 * The single formal room is full, or an idle socket was evicted. This overlay
 * only offers a reload; the test-room escape hatch has been retired.
 */
export function createRoomFull({ getState }) {
  const root = document.getElementById("room-full");
  const titleEl = document.getElementById("room-full-title");
  const copyEl = document.getElementById("room-full-copy");
  const retryEl = document.getElementById("room-full-retry");
  if (!root || !titleEl || !copyEl || !retryEl) {
    return { sync() {} };
  }

  function sync(state = getState()) {
    const room = state?.room;
    const rejected = room?.role === "rejected";
    root.hidden = !rejected;
    if (!rejected) return;

    const code = room.code || "ROOM_FULL";
    if (code === "REPLACED") {
      titleEl.textContent = "这个角色已在另一台设备登录";
      copyEl.textContent =
        "当前页面已经让出这个角色。要换回本机，请先在另一台设备退出，再刷新重试。";
      retryEl.hidden = true;
    } else if (code === "IDLE") {
      retryEl.hidden = false;
      titleEl.textContent = "连接已断开";
      copyEl.textContent =
        "超过 30 秒没有心跳，旧连接已经被服务端清理。刷新重试即可重新进入。";
    } else {
      retryEl.hidden = false;
      titleEl.textContent = "房间已满";
      copyEl.textContent =
        "房间最多两个人。关掉其他标签页或旧设备后再试；静默 30 秒的旧连接会自动释放。";
    }
  }

  function onRetry(event) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    window.location.reload();
  }

  retryEl.addEventListener("pointerdown", onRetry, { passive: false });

  return { sync };
}
