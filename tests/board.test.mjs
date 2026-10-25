import test from "node:test";
import assert from "node:assert/strict";

import { ACTION, PLAYER_ID, SCENE } from "../src/config.js";
import {
  BOARD_RETENTION_DAYS,
  BOARD_TEXT_LIMIT,
  appendBoardMessage,
  boardToMarkdown,
  boardUnreadCount,
  normalizeBoardText,
  sanitizeBoardMessages
} from "../src/game/board.js";
import { createPlayerEntity } from "../src/game/player.js";
import { reducer } from "../src/game/reducer.js";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const NOW = Date.now();

function message(id, overrides = {}) {
  return {
    id,
    authorId: "p_a",
    authorName: "小满",
    text: "今天萝卜熟了。",
    createdAt: NOW - HOUR_MS,
    ...overrides
  };
}

function makePlayer(overrides = {}) {
  return createPlayerEntity({
    id: PLAYER_ID,
    name: "A",
    currentScene: SCENE.INDOOR_1,
    position: { x: 0, y: 0 },
    facing: "south",
    ...overrides
  });
}

function makeState(overrides = {}) {
  return {
    schemaVersion: 2,
    activePlayerId: overrides.activePlayerId ?? PLAYER_ID,
    players: overrides.players ?? {
      [PLAYER_ID]: overrides.player ?? makePlayer()
    },
    plots: {},
    stats: { harvested: 0 },
    board: overrides.board ?? { messages: [], lastReadAt: 0 },
    ui: {
      notice: null,
      nextNoticeId: 1,
      emptyRoomSeen: false,
      selectedPlotId: null,
      boardOpen: false,
      ...overrides.ui
    }
  };
}

function event(action, payload = null, when = NOW) {
  return { who: PLAYER_ID, when, action, targetId: null, payload };
}

test("board text is trimmed, single-spaced and length-limited", () => {
  assert.equal(normalizeBoardText("  hello \n  world  "), "hello world");
  assert.equal(normalizeBoardText(null), "");
  assert.equal(normalizeBoardText("   "), "");
  assert.equal(
    normalizeBoardText("x".repeat(BOARD_TEXT_LIMIT + 20)).length,
    BOARD_TEXT_LIMIT
  );
});

test("messages outside the retention window are dropped", () => {
  const list = sanitizeBoardMessages(
    [
      message("old", { createdAt: NOW - (BOARD_RETENTION_DAYS * DAY_MS + HOUR_MS) }),
      message("fresh", { createdAt: NOW - HOUR_MS }),
      message("future", { createdAt: NOW + 10 * 60 * 1000 })
    ],
    NOW
  );

  assert.deepEqual(list.map((item) => item.id), ["fresh"]);
});

test("invalid and duplicate messages are rejected", () => {
  const list = sanitizeBoardMessages(
    [
      message("ok"),
      message("ok"),
      message("bad id", {}),
      message("empty-text", { text: "   " }),
      message("no-author", { authorId: "" }),
      message("bad-time", { createdAt: "yesterday" }),
      null
    ],
    NOW
  );

  assert.deepEqual(list.map((item) => item.id), ["ok"]);
});

test("messages sort oldest first and a limit keeps the newest", () => {
  const list = sanitizeBoardMessages(
    [
      message("c", { createdAt: NOW - 1 * HOUR_MS }),
      message("a", { createdAt: NOW - 3 * HOUR_MS }),
      message("b", { createdAt: NOW - 2 * HOUR_MS })
    ],
    NOW,
    2
  );

  assert.deepEqual(list.map((item) => item.id), ["b", "c"]);
});

test("appending keeps chronological order and drops expired notes", () => {
  let messages = [message("old", { createdAt: NOW - 200 * DAY_MS })];
  messages = appendBoardMessage(messages, message("new"), NOW);

  assert.deepEqual(messages.map((item) => item.id), ["new"]);
});

test("unread counts partner notes after the last read", () => {
  const messages = [
    message("mine", { authorId: PLAYER_ID, createdAt: NOW - 3 * HOUR_MS }),
    message("theirs-1", { createdAt: NOW - 2 * HOUR_MS }),
    message("theirs-2", { createdAt: NOW - HOUR_MS })
  ];

  assert.equal(boardUnreadCount(messages, 0, PLAYER_ID), 2);
  assert.equal(boardUnreadCount(messages, NOW - 90 * 60 * 1000, PLAYER_ID), 1);
  assert.equal(boardUnreadCount(messages, NOW, PLAYER_ID), 0);
});

test("the markdown export keeps the room, retention note and every message", () => {
  const markdown = boardToMarkdown(
    [message("a", { createdAt: NOW - 2 * HOUR_MS }), message("b")],
    { roomId: "PAIR", exportedAt: NOW }
  );

  assert.match(markdown, /# Duet 留言板 · PAIR/);
  assert.match(markdown, /留言数量：2/);
  assert.match(markdown, /最近 180 天/);
  assert.match(markdown, /小满/);
  assert.equal((markdown.match(/今天萝卜熟了。/g) ?? []).length, 2);
});

test("opening the board marks it read, closes the plot card and stops walking", () => {
  const state = makeState({
    board: {
      messages: [message("note", { createdAt: NOW - HOUR_MS })],
      lastReadAt: 0
    },
    ui: { selectedPlotId: "field_01" },
    player: makePlayer({
      currentScene: SCENE.INDOOR_1,
      destination: { x: 1, y: 1 }
    })
  });

  const next = reducer(state, event(ACTION.READ_BOARD));
  assert.equal(next.ui.boardOpen, true);
  assert.equal(next.ui.selectedPlotId, null);
  assert.equal(next.players[PLAYER_ID].destination, null);
  assert.equal(next.board.lastReadAt, NOW);

  const closed = reducer(next, event(ACTION.CLOSE_BOARD));
  assert.equal(closed.ui.boardOpen, false);
});

test("posting a note appends it, in order, with the author's name", () => {
  let state = makeState();
  state = reducer(state, event(ACTION.READ_BOARD));
  state = reducer(
    state,
    event(ACTION.POST_MESSAGE, { text: "  晚安，明天见。 " }, NOW + 1000)
  );

  assert.equal(state.board.messages.length, 1);
  const note = state.board.messages[0];
  assert.equal(note.text, "晚安，明天见。");
  assert.equal(note.authorId, PLAYER_ID);
  assert.equal(note.authorName, "A");
  assert.equal(note.createdAt, NOW + 1000);
  assert.ok(note.id.startsWith("m_"));
  assert.equal(state.board.lastReadAt, NOW + 1000);
});

test("empty notes and notes outside the living room are ignored", () => {
  const inRoom = makeState();
  assert.strictEqual(
    reducer(inRoom, event(ACTION.POST_MESSAGE, { text: "   " })),
    inRoom
  );

  const outside = makeState({
    player: makePlayer({ currentScene: SCENE.OUTDOOR })
  });
  assert.strictEqual(
    reducer(outside, event(ACTION.POST_MESSAGE, { text: "hi" })),
    outside
  );
});

test("a host can apply a guest note without taking the guest's identity", () => {
  const host = makePlayer({ id: PLAYER_ID, name: "A", currentScene: SCENE.OUTDOOR });
  const guest = makePlayer({
    id: "p_guest",
    name: "B",
    currentScene: SCENE.INDOOR_1
  });
  const state = makeState({
    player: host,
    players: { [PLAYER_ID]: host, p_guest: guest }
  });

  const next = reducer(state, {
    who: "p_guest",
    when: NOW,
    action: ACTION.POST_MESSAGE,
    targetId: null,
    payload: { text: "我先写一句" }
  });

  assert.equal(next.board.messages.length, 1);
  assert.equal(next.board.messages[0].authorId, "p_guest");
  assert.equal(next.board.messages[0].authorName, "B");
});

test("entering the living room surfaces unread partner notes once", () => {
  const state = makeState({
    player: makePlayer({
      currentScene: SCENE.OUTDOOR,
      position: { x: 0, y: -1.2 }
    }),
    board: {
      messages: [message("note", { createdAt: NOW - HOUR_MS })],
      lastReadAt: 0
    }
  });

  const next = reducer(state, event(ACTION.ENTER_HOUSE));
  assert.equal(next.ui.notice?.tone, "board");
  assert.match(next.ui.notice.text, /1 条新留言/);

  const alreadyRead = reducer(
    {
      ...state,
      players: {
        ...state.players,
        [PLAYER_ID]: makePlayer({
          currentScene: SCENE.OUTDOOR,
          position: { x: 0, y: -1.2 }
        })
      },
      board: { ...state.board, lastReadAt: NOW }
    },
    event(ACTION.ENTER_HOUSE)
  );
  assert.equal(alreadyRead.ui.notice, null);
});

test("the local save round-trips board messages and the read marker", async () => {
  const { FARM_SAVE_KEY } = await import("../src/config.js");
  const { readFarmSave, writeFarmSave } = await import(
    "../src/persistence/farmSave.js"
  );
  const store = new Map();
  const storage = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, value)
  };

  const state = makeState({
    board: {
      messages: [message("a"), message("b")],
      lastReadAt: NOW - 30 * 60 * 1000
    }
  });
  writeFarmSave(state, storage);

  const saved = JSON.parse(store.get(FARM_SAVE_KEY));
  assert.equal(saved.board.messages.length, 2);

  const restored = readFarmSave(storage);
  assert.equal(restored.board.messages.length, 2);
  assert.equal(restored.board.lastReadAt, NOW - 30 * 60 * 1000);
});
