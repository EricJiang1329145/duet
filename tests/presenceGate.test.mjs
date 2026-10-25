import test from "node:test";
import assert from "node:assert/strict";

import {
  presenceSignature,
  shouldSendPresence
} from "../src/net/presenceGate.js";

const payload = {
  name: "A",
  currentScene: "outdoor",
  position: { x: 0.5, y: -1 },
  facing: "south"
};

test("a changed position is sent once the minimum gap has passed", () => {
  const first = presenceSignature(payload);
  const moved = presenceSignature({ ...payload, position: { x: 0.6, y: -1 } });

  assert.equal(
    shouldSendPresence({
      signature: moved,
      lastSignature: first,
      now: 1000,
      lastSentAt: 900
    }),
    true
  );
});

test("micro jitter inside the minimum gap is dropped", () => {
  const first = presenceSignature(payload);
  const moved = presenceSignature({ ...payload, position: { x: 0.501, y: -1 } });

  assert.equal(
    shouldSendPresence({
      signature: moved,
      lastSignature: first,
      now: 1010,
      lastSentAt: 1000
    }),
    false
  );
});

test("a still player only sends the idle heartbeat", () => {
  const signature = presenceSignature(payload);

  assert.equal(
    shouldSendPresence({
      signature,
      lastSignature: signature,
      now: 3000,
      lastSentAt: 1000
    }),
    false
  );
  assert.equal(
    shouldSendPresence({
      signature,
      lastSignature: signature,
      now: 6000,
      lastSentAt: 1000
    }),
    true
  );
});

test("force always sends if the payload is unchanged", () => {
  const signature = presenceSignature(payload);

  assert.equal(
    shouldSendPresence({
      force: true,
      signature,
      lastSignature: signature,
      now: 1001,
      lastSentAt: 1000
    }),
    true
  );
});

test("the signature tracks scene, facing and name", () => {
  const base = presenceSignature(payload);

  assert.notEqual(base, presenceSignature({ ...payload, currentScene: "indoor_1" }));
  assert.notEqual(base, presenceSignature({ ...payload, facing: "north" }));
  assert.notEqual(base, presenceSignature({ ...payload, name: "B" }));
  assert.notEqual(
    base,
    presenceSignature({ ...payload, destination: { x: 2, y: 3 } })
  );
  assert.equal(
    base,
    presenceSignature({ ...payload, position: { x: 0.5001, y: -1 } })
  );
});
