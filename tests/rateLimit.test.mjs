import test from "node:test";
import assert from "node:assert/strict";

import { createRateLimiter } from "../worker/src/rateLimit.js";

test("a bucket allows its capacity and then refuses", () => {
  const bucket = createRateLimiter({ capacity: 3, refillPerSecond: 0 });

  assert.equal(bucket.allow(1000), true);
  assert.equal(bucket.allow(1000), true);
  assert.equal(bucket.allow(1000), true);
  assert.equal(bucket.allow(1000), false);
});

test("a bucket refills over time", () => {
  const bucket = createRateLimiter({ capacity: 2, refillPerSecond: 1 });

  assert.equal(bucket.allow(0), true);
  assert.equal(bucket.allow(0), true);
  assert.equal(bucket.allow(0), false);

  // Half a second restores half a token: still not enough.
  assert.equal(bucket.allow(500), false);
  // A full second restores one token.
  assert.equal(bucket.allow(1000), true);
  assert.equal(bucket.allow(1000), false);
});

test("refill never exceeds the capacity", () => {
  const bucket = createRateLimiter({ capacity: 2, refillPerSecond: 10 });

  bucket.allow(0);
  bucket.allow(0);

  assert.equal(bucket.available(60_000), 2);
  assert.equal(bucket.allow(60_000), true);
  assert.equal(bucket.allow(60_000), true);
  assert.equal(bucket.allow(60_000), false);
});

test("cost can spend several tokens at once", () => {
  const bucket = createRateLimiter({ capacity: 5, refillPerSecond: 0 });

  assert.equal(bucket.allow(0, 4), true);
  assert.equal(bucket.allow(0, 2), false);
  assert.equal(bucket.allow(0, 1), true);
});

test("buckets are independent", () => {
  const presence = createRateLimiter({ capacity: 1, refillPerSecond: 0 });
  const act = createRateLimiter({ capacity: 1, refillPerSecond: 0 });

  assert.equal(presence.allow(0), true);
  assert.equal(presence.allow(0), false);
  assert.equal(act.allow(0), true);
});

test("a burst of 10Hz presence fits the shipped presence budget", () => {
  const presence = createRateLimiter({ capacity: 30, refillPerSecond: 15 });

  let allowed = 0;
  for (let frame = 0; frame < 100; frame += 1) {
    if (presence.allow(frame * 100)) allowed += 1;
  }

  assert.equal(allowed, 100);
});
