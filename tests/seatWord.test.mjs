import test from "node:test";
import assert from "node:assert/strict";

import { hashSeatWord, normalizeSeatWord } from "../src/game/seatWord.js";

test("seat words trim outer whitespace and normalize Unicode", () => {
  assert.equal(normalizeSeatWord("  moss lantern  "), "moss lantern");
  assert.equal(normalizeSeatWord("cafe\u0301"), "café");
  assert.equal(normalizeSeatWord(""), "");
  assert.equal(normalizeSeatWord(null), "");
});

test("SHA-256 matches the standard test vector", async () => {
  assert.equal(
    await hashSeatWord("abc"),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
  );
});

test("the same phrase hashes the same across whitespace and devices", async () => {
  const first = await hashSeatWord("  moss   lantern  ");
  const second = await hashSeatWord("moss   lantern");
  assert.equal(first, second);
  assert.match(first, /^[0-9a-f]{64}$/);
});

test("passphrases are case-sensitive and empty input has no digest", async () => {
  assert.notEqual(await hashSeatWord("Moss"), await hashSeatWord("moss"));
  assert.equal(await hashSeatWord("   "), "");
});
