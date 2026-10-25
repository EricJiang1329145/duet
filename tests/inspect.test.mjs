import test from "node:test";
import assert from "node:assert/strict";
import { inspectText } from "../src/game/inspect.js";

test("scenery with a door or landmark has inspect flavour text", () => {
  assert.match(inspectText("shed"), /工具棚/);
  assert.match(inspectText("well"), /井水/);
  assert.match(inspectText("compost"), /堆肥/);
  assert.match(inspectText("pond"), /水面/);
  assert.match(inspectText("unknown"), /没有/);
});
