import { ACTION, COLORS } from "../config.js";

/** A misty onsen terrace. Steam is a few translucent boxes, no particles. */
export function buildSpringScene(kit) {
  const {
    scene,
    addBox,
    addGroup,
    addHitbox,
    addWorldLabel,
    markWalkSurface
  } = kit;

  addBox(scene, 13, 0.16, 8.6, COLORS.earth, 0, -0.08, 0);
  const floor = addBox(scene, 12.6, 0.05, 8.2, "#b9c5a9", 0, 0, 0);
  markWalkSurface(floor);
  addBox(scene, 5.2, 0.04, 1.1, COLORS.path, 0, 0.035, 2.2);

  // Stone rim and the warm pool.
  addBox(scene, 4.6, 0.18, 3.4, COLORS.concrete, 0, 0.09, -0.2);
  addBox(scene, 4.0, 0.06, 2.8, "#9fc6c2", 0, 0.13, -0.2);
  addBox(scene, 3.2, 0.02, 2.2, "#c2ddd2", 0, 0.17, -0.2);
  addBox(scene, 0.5, 0.16, 0.5, "#8f9888", -2.1, 0.16, 1.1);
  addBox(scene, 0.42, 0.1, 0.42, "#a2ab99", 2.0, 0.14, -1.3);

  // Tea bushes and a little tea table.
  const tea = addGroup(scene, -2.4, 0, 0.1);
  addBox(tea, 1.5, 0.1, 1.2, COLORS.soil, 0, 0.05, 0);
  for (let i = 0; i < 8; i += 1) {
    const x = -0.5 + ((i * 31) % 9) / 9 * 1.0;
    const z = -0.4 + ((i * 19) % 7) / 7 * 0.8;
    addBox(tea, 0.34, 0.32, 0.34, "#6f9162", x, 0.24, z);
    addBox(tea, 0.2, 0.12, 0.2, "#8cab72", x, 0.42, z);
  }
  addWorldLabel("茶丛 · 每天采集", -2.4, 1.1, 0.1, "action");
  addHitbox(scene, ACTION.COLLECT_RESOURCE, "spring_tea", {
    w: 1.8,
    h: 1.2,
    d: 1.5,
    x: -2.4,
    y: 0.6,
    z: 0.1
  });

  const eggs = addGroup(scene, 2.4, 0, 0.4);
  addBox(eggs, 0.7, 0.3, 0.5, COLORS.woodDark, 0, 0.16, 0);
  for (let i = 0; i < 5; i += 1) {
    addBox(eggs, 0.18, 0.22, 0.18, "#f0d39a", -0.25 + (i % 3) * 0.24, 0.42 + (i % 2) * 0.05, 0.02);
  }
  addWorldLabel("温泉蛋 · 每天采集", 2.4, 1.05, 0.4, "action");
  addHitbox(scene, ACTION.COLLECT_RESOURCE, "spring_eggs", {
    w: 1.1,
    h: 1.0,
    d: 1.0,
    x: 2.4,
    y: 0.55,
    z: 0.4
  });

  // Low steam columns.
  for (const [x, z, h] of [
    [-0.8, -0.6, 1.2],
    [0.5, 0.3, 1.5],
    [1.0, -1.1, 0.9]
  ]) {
    addBox(scene, 0.6, h, 0.6, "#eaf4e9", x, 1.0 + h / 2, z, {
      materialOptions: {
        transparent: true,
        opacity: 0.16,
        depthWrite: false
      }
    });
  }

  addBox(scene, 1.0, 1.7, 0.08, COLORS.door, 0, 0.86, 3.35);
  addBox(scene, 0.84, 0.05, 0.09, COLORS.doorLine, 0, 1.45, 3.4);
  addBox(scene, 0.06, 0.06, 0.06, COLORS.brass, 0.3, 0.88, 3.42);
  addWorldLabel("回小院", 1.1, 1.9, 3.18, "action");
  addHitbox(scene, ACTION.EXIT_SPRING, "spring_exit", {
    w: 1.2,
    h: 1.8,
    d: 0.28,
    x: 0,
    y: 0.85,
    z: 3.22
  });

  addWorldLabel("雾汤温泉", 0, 2.3, 0, "room");
}
