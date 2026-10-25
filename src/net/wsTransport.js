/**
 * Browser WebSocket transport with exponential backoff. The room client owns
 * the protocol; this adapter only moves JSON frames and reconnects.
 */
export function createWsTransport({
  url,
  onOpen = null,
  onClose = null,
  onMessage = null,
  onError = null,
  shouldReconnect = null
}) {
  let socket = null;
  let status = "idle";
  let retry = 0;
  let reconnectTimer = 0;
  let closedByUser = false;

  function clearTimer() {
    if (reconnectTimer) {
      window.clearTimeout(reconnectTimer);
      reconnectTimer = 0;
    }
  }

  function scheduleReconnect() {
    if (closedByUser) return;
    const base = Math.min(15000, 1000 * 2 ** Math.min(retry, 4));
    const delay = base + Math.floor(Math.random() * 250);
    retry += 1;
    clearTimer();
    reconnectTimer = window.setTimeout(connect, delay);
  }

  function connect() {
    if (closedByUser) return;
    clearTimer();
    if (
      socket &&
      (socket.readyState === WebSocket.OPEN ||
        socket.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    status = "connecting";
    let nextSocket;
    try {
      nextSocket = new WebSocket(url);
    } catch (error) {
      status = "closed";
      onError?.(error);
      scheduleReconnect();
      return;
    }

    socket = nextSocket;

    nextSocket.onopen = () => {
      if (socket !== nextSocket) return;
      status = "open";
      retry = 0;
      onOpen?.();
    };

    nextSocket.onmessage = (event) => {
      if (socket !== nextSocket) return;
      let message;
      try {
        message = JSON.parse(String(event.data));
      } catch {
        return;
      }
      onMessage?.(message);
    };

    nextSocket.onclose = (event) => {
      if (socket !== nextSocket) return;
      socket = null;
      status = "closed";
      onClose?.(event);
      if (closedByUser) return;
      if (shouldReconnect && shouldReconnect(event) === false) {
        closedByUser = true;
        return;
      }
      scheduleReconnect();
    };

    nextSocket.onerror = (event) => {
      onError?.(event);
    };
  }

  function send(message) {
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    try {
      socket.send(JSON.stringify(message));
      return true;
    } catch {
      return false;
    }
  }

  function close() {
    closedByUser = true;
    clearTimer();
    const current = socket;
    socket = null;
    status = "closed";
    if (current) {
      try {
        current.close(1000, "bye");
      } catch {
        // Already closed.
      }
    }
  }

  return {
    connect,
    send,
    close,
    getState: () => status
  };
}
