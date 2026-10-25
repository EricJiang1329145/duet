import { ACTION, COLORS } from "../config.js";

/** A grassy orchard with two daily fruit trees and a little ladder. */
export function buildOrchardScene(kit) {
  const {
    scene,
    addBox,
    addGroup,
    addHitbox,
    addWorldLabel,
    markWalkSurface
  } = kit;

  addBox(scene, 13, 0.16, 8.6, COLORS.earth, 0, -0.08, 0);
  const floor = addBox(scene, 12.6, 0.05, 8.2, "#a9ca94", 0, 0, 0);
  markWalkSurface(floor);
  addBox(scene, 4.2, 0.03, 1.0, COLORS.path, 0, 0.035, 2.2);
  addBox(scene, 1.1, 0.03, 4.2, COLORS.pathAlt, 0, 0.037, 0.1);

  for (const x of [-5.9, -2.9, 0, 2.9, 5.9]) {
    addBox(scene, 0.08, 0.58, 0.08, COLORS.woodDeep, x, 0.3, -3.7);
    addBox(scene, 0.08, 0.58, 0.08, COLORS.woodDeep, x, 0.3, 3.7);
  }

  function tree(x, z, label, target) {
    const group = addGroup(scene, x, 0, z);
    addBox(group, 0.38, 2.4, 0.38, COLORS.woodDark, 0, 1.2, 0);
    addBox(group, 2.5, 1.5, 2.1, "#7e9b62", 0, 2.5, 0);
    addBox(group, 1.7, 1.2, 1.5, "#8cab72", 0, 3.2, 0);
    for (let i = 0; i < 5; i += 1) {
      const px = -0.75 + ((i * 37) % 11) / 11 * 1.5;
      const pz = -0.55 + ((i * 23) % 7) / 7 * 1.0;
      addBox(group, 0.26, 0.24, 0.26, "#d77e63", px, 2.65 + (i % 2) * 0.25, pz);
    }
    addWorldLabel(`${label} · 每天采集`, x, 4.2, z, "action");
    addHitbox(scene, ACTION.COLLECT_RESOURCE, target, {
      w: 2.5,
      h: 3.7,
      d: 2.2,
      x,
      y: 1.8,
      z
    });
    return group;
  }

  tree(-2.4, -0.4, "苹果树", "orchard_apples");
  tree(2.4, -0.4, "梨树", "orchard_pears");

  // Ladder, purely decorative; the tree hitbox is the collection point.
  const ladder = addGroup(scene, -3.45, 0, 0.6);
  addBox(ladder, 0.08, 1.5, 0.08, COLORS.wood, -0.25, 0.75, 0);
  addBox(ladder, 0.08, 1.5, 0.08, COLORS.wood, 0.25, 0.75, 0);
  for (let i = 0; i < 4; i += 1) {
    addBox(ladder, 0.58, 0.05, 0.06, COLORS.woodDark, 0, 0.35 + i * 0.3, 0);
  }

  addBox(scene, 1.0, 1.7, 0.08, COLORS.door, 0, 0.86, 3.35);
  addBox(scene, 0.84, 0.05, 0.09, COLORS.doorLine, 0, 1.45, 3.4);
  addBox(scene, 0.06, 0.06, 0.06, COLORS.brass, 0.3, 0.88, 3.42);
  addWorldLabel("回小院", 1.1, 1.9, 3.18, "action");
  addHitbox(scene, ACTION.EXIT_ORCHARD, "orchard_exit", {
    w: 1.2,
    h: 1.8,
    d: 0.28,
    x: 0,
    y: 0.85,
    z: 3.22
  });

  addWorldLabel("山坡果园", 0, 2.3, 0, "room");
}
