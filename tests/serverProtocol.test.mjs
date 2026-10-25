import test from "node:test";
import assert from "node:assert/strict";
import {
  CLIENT_MESSAGE,
  SERVER_MESSAGE,
  SERVER_PROTOCOL_VERSION,
  isServerMessage
} from "../src/net/serverProtocol.js";

test("server messages require the protocol version and a type", () => {
  assert.equal(
    isServerMessage({ v: SERVER_PROTOCOL_VERSION, t: SERVER_MESSAGE.WELCOME }),
    true
  );
  assert.equal(isServerMessage({ t: SERVER_MESSAGE.WELCOME }), false);
  assert.equal(isServerMessage({ v: 2, t: SERVER_MESSAGE.WELCOME }), false);
  assert.equal(isServerMessage({ v: 1, t: 42 }), false);
  assert.equal(isServerMessage(null), false);
});

test("client and server message names stay distinct", () => {
  assert.equal(CLIENT_MESSAGE.ACT, "act");
  assert.equal(CLIENT_MESSAGE.PRESENCE, "presence");
  assert.equal(SERVER_MESSAGE.STATE, "state");
  assert.equal(SERVER_MESSAGE.WELCOME, "welcome");
  assert.equal(CLIENT_MESSAGE.CHAT, "chat");
  assert.equal(CLIENT_MESSAGE.CHAT_READ, "chat_read");
  assert.equal(SERVER_MESSAGE.CHAT_ACK, "chat_ack");
});
