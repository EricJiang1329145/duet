import test from "node:test";
import assert from "node:assert/strict";
import { CHAT } from "../src/config.js";
import {
  canAcknowledgeChat,
  chatTextLength,
  normalizeChatText,
  readLabel,
  sanitizeChatMessage
} from "../src/game/chat.js";

test("chat text keeps emoji sequences intact and strips control characters", () => {
  const family = "👨‍👩‍👧‍👦";
  assert.equal(normalizeChatText(`  ${family}  你好  `), `${family} 你好`);
  assert.equal(normalizeChatText("第一行\n第二行"), "第一行 第二行");
  assert.equal(normalizeChatText("a\u202Eb\u0007"), "ab");
  assert.equal(chatTextLength(family), 1);
});

test("chat text is limited by grapheme cluster, not UTF-16 units", () => {
  const many = "🌱".repeat(CHAT.textLimit + 10);
  const normalized = normalizeChatText(many);
  assert.equal(chatTextLength(normalized), CHAT.textLimit);
  assert.equal(normalized.length, CHAT.textLimit * 2);
});

test("chat message ids and timestamps are validated", () => {
  const now = 10_000;
  assert.ok(
    sanitizeChatMessage(
      { id: "ch_abc", from: "p_a", name: "A", text: "hi", at: now },
      now
    )
  );
  assert.equal(
    sanitizeChatMessage({ id: "bad id", from: "p_a", text: "hi", at: now }, now),
    null
  );
  assert.equal(
    sanitizeChatMessage({ id: "ch_abc", from: "p_a", text: "  ", at: now }, now),
    null
  );
  assert.equal(
    sanitizeChatMessage(
      { id: "ch_abc", from: "p_a", text: "hi", at: now + 10 * 60 * 1000 },
      now
    ),
    null
  );
});

test("read receipts are strict about the ambiguous cases", () => {
  const message = { id: "ch_1", from: "p_b", text: "hi", at: 1000, name: "B" };
  const base = {
    message,
    selfId: "p_a",
    selfScene: "outdoor",
    senderScene: "outdoor",
    documentVisible: true,
    transitioning: false,
    now: 2000
  };
  assert.equal(canAcknowledgeChat(base), true);
  assert.equal(canAcknowledgeChat({ ...base, documentVisible: false }), false);
  assert.equal(canAcknowledgeChat({ ...base, transitioning: true }), false);
  assert.equal(canAcknowledgeChat({ ...base, senderScene: "indoor_1" }), false);
  assert.equal(canAcknowledgeChat({ ...base, selfScene: "indoor_1" }), false);
  assert.equal(canAcknowledgeChat({ ...base, selfId: "p_b" }), false);
  assert.equal(
    canAcknowledgeChat({ ...base, now: message.at + CHAT.durationMs + 1 }),
    false
  );
  assert.equal(canAcknowledgeChat({ ...base, now: message.at - 1 }), false);
  assert.equal(canAcknowledgeChat({ ...base, message: null }), false);
});

test("only a real read, never mere delivery, shows 已读", () => {
  assert.equal(readLabel({ delivered: 0, read: false }), "未读");
  assert.equal(readLabel({ delivered: 1, read: false }), "未读");
  assert.equal(readLabel({ delivered: 1, read: true }), "已读");
});
