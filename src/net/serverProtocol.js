export const SERVER_PROTOCOL_VERSION = 1;

export const CLIENT_MESSAGE = Object.freeze({
  PRESENCE: "presence",
  ACT: "act",
  CHAT: "chat",
  CHAT_READ: "chat_read",
  BOARD_READ: "board_read",
  BOARD_EXPORT: "board_export",
  PING: "ping",
  BYE: "bye"
});

export const SERVER_MESSAGE = Object.freeze({
  WELCOME: "welcome",
  PRESENCE: "presence",
  STATE: "state",
  REJECT: "reject",
  BOARD: "board",
  BOARD_EXPORT: "board_export",
  CHAT: "chat",
  CHAT_ACK: "chat_ack",
  CHAT_READ: "chat_read",
  PONG: "pong",
  LEAVE: "leave",
  ERROR: "error"
});

export function isServerMessage(value) {
  return Boolean(
    value &&
      typeof value === "object" &&
      value.v === SERVER_PROTOCOL_VERSION &&
      typeof value.t === "string"
  );
}
