import test from "node:test";
import assert from "node:assert/strict";

import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  clearSessionCookie,
  constantTimeEqual,
  matchSeat,
  normalizeHash,
  parseCookies,
  seatForName,
  seatFromHeader,
  seatName,
  sessionCookie,
  signSession,
  verifySession
} from "../worker/src/auth.js";
import { hashSeatWord } from "../src/game/seatWord.js";
import { handleLoginPage, handleLogout } from "../worker/src/loginPage.js";

const SECRET = "unit-test-session-secret-0123456789";
// A deliberately mixed Chinese/punctuation passphrase exercises the same
// Unicode path as the real seats.
const A_WORD = "A的密语·2026！";
const B_WORD = "B的密语_2026？";

test("fixed character names map to seats", () => {
  assert.equal(seatName("A"), "A");
  assert.equal(seatName("B"), "B");
  assert.equal(seatName("C"), "");
  assert.equal(seatForName("A"), "A");
  assert.equal(seatForName("B"), "B");
  assert.equal(seatForName("Alice"), "");
  assert.equal(seatFromHeader("A"), "A");
  assert.equal(seatFromHeader(" b "), "B");
  assert.equal(seatFromHeader("C"), "");
});

test("seat hashes must be complete 64-character hex values", () => {
  assert.equal(
    normalizeHash(" 0DB1DA81FCA76DE232DE8677DCF1182E6A00FCA09FA7ED37753409D8B0E0ACF2 "),
    "0db1da81fca76de232de8677dcf1182e6a00fca09fa7ed37753409d8b0e0acf2"
  );
  assert.equal(normalizeHash("not-a-hash"), "");
  assert.equal(normalizeHash("a".repeat(63)), "");
});

test("the submitted phrase selects exactly one configured seat", async () => {
  const hashes = {
    A: await hashSeatWord(A_WORD),
    B: await hashSeatWord(B_WORD)
  };
  assert.equal(await matchSeat(A_WORD, hashes), "A");
  assert.equal(await matchSeat(`  ${B_WORD}  `, hashes), "B");
  assert.equal(await matchSeat("wrong phrase", hashes), "");
  assert.equal(await matchSeat("", hashes), "");
  assert.equal(await matchSeat(A_WORD, { A: hashes.A }), "");
  assert.equal(await matchSeat(A_WORD, { A: hashes.A, B: hashes.A }), "");
});

test("constant-time equality still compares by value", () => {
  assert.equal(constantTimeEqual("abcd", "abcd"), true);
  assert.equal(constantTimeEqual("abcd", "abce"), false);
  assert.equal(constantTimeEqual("abcd", "abcde"), false);
});

test("a signed session round-trips, has one month lifetime and rejects tampering", async () => {
  const now = 1_800_000_000_000;
  const token = await signSession("A", SECRET, now);
  assert.ok(token.includes("."));
  assert.equal(await verifySession(token, SECRET, now + 1000), "A");
  assert.equal(
    await verifySession(token, SECRET, now + SESSION_TTL_SECONDS * 1000 + 1),
    ""
  );
  assert.equal(await verifySession(token, "different-secret-0123456789", now), "");
  assert.equal(await verifySession(`${token}x`, SECRET, now), "");
  assert.equal(await signSession("C", SECRET, now), "");
  assert.equal(await signSession("A", "short", now), "");
});

test("the login page verifies a phrase and sets an HttpOnly session", async () => {
  const env = {
    SEAT_A_HASH: await hashSeatWord(A_WORD),
    SEAT_B_HASH: await hashSeatWord(B_WORD),
    SESSION_SECRET: SECRET
  };

  const getPage = await handleLoginPage(
    new Request("https://duet.test/login"),
    env
  );
  assert.equal(getPage.status, 200);
  const pageHtml = await getPage.text();
  assert.match(pageHtml, /进入小院/);
  assert.match(pageHtml, /type="text"/);
  assert.doesNotMatch(pageHtml, /type="password"/);

  const bad = await handleLoginPage(
    new Request("https://duet.test/login", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ word: "wrong" }).toString()
    }),
    env
  );
  assert.equal(bad.status, 401);
  assert.equal(bad.headers.get("set-cookie"), null);

  const good = await handleLoginPage(
    new Request("https://duet.test/login", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ word: A_WORD }).toString()
    }),
    env
  );
  assert.equal(good.status, 303);
  const cookie = good.headers.get("set-cookie");
  assert.match(cookie, new RegExp(`^${SESSION_COOKIE}=`));
  const token = cookie.slice(SESSION_COOKIE.length + 1).split(";")[0];
  assert.equal(await verifySession(token, SECRET), "A");
});

test("logout clears the session cookie", () => {
  const response = handleLogout(new Request("https://duet.test/logout"));
  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), "/login");
  assert.match(response.headers.get("set-cookie"), /Max-Age=0/);
});

test("session cookies are HttpOnly, SameSite Lax and one month long", () => {
  const cookie = sessionCookie("abc.def", { secure: true });
  assert.match(cookie, new RegExp(`^${SESSION_COOKIE}=abc\\.def;`));
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);
  assert.match(cookie, new RegExp(`Max-Age=${SESSION_TTL_SECONDS}`));
  assert.match(cookie, /Secure/);
  assert.doesNotMatch(sessionCookie("abc.def"), /Secure/);
  assert.match(clearSessionCookie(), /Max-Age=0/);
  assert.deepEqual(parseCookies("a=1; duet_session=x.y; b=2"), {
    a: "1",
    duet_session: "x.y",
    b: "2"
  });
});
