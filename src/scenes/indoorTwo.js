import { ACTION, COLORS } from "../config.js";
import { buildPottedPlant } from "./props.js";

/**
 * Enlarged second-floor entertainment room. The TV, console, sofa, rug,
 * shelf, plant and lamp are fixed decorative slots; they can be bought and
 * refunded from the decoration catalogue.
 */
function buildStairwell(scene, addBox, addGroup) {
  // The floor has a real 1.8 x 1.8 opening. Steps sit below floor level and
  // descend toward the south, so this reads as going down rather than up.
  const x = 4.8;
  const z = 3.4;
  addBox(scene, 1.8, 0.06, 1.8, "#392b23", x, -0.09, z);
  for (let i = 0; i < 7; i += 1) {
    const stepZ = 2.58 + i * 0.23;
    const top = -0.12 - i * 0.14;
    const shade = ["#8a6a4c", "#7a5b43", "#6a4e3a", "#5b4333", "#4c382c"][Math.min(i, 4)];
    addBox(scene, 1.48, 0.14, 0.24, shade, x, top - 0.07, stepZ);
  }
  // A low rail around the opening makes the drop legible from above.
  for (const side of [-1, 1]) {
    addBox(scene, 0.07, 0.4, 1.8, COLORS.woodDark, x + side * 0.92, 0.2, z);
  }
  addBox(scene, 1.9, 0.09, 0.09, COLORS.wood, x, 0.4, 2.52);
}

export function buildIndoorTwoScene(kit) {
  const {
    scene,
    addBox,
    addCylinder,
    addPlane,
    addGroup,
    addHitbox,
    markWalkSurface,
    addWorldLabel
  } = kit;

  const W = 18;
  const D = 12;
  addBox(scene, W + 0.2, 0.42, D + 0.2, COLORS.concreteDark, 0, -0.33, 0);
  // Leave a real stairwell opening in the floor instead of placing a fake
  // ascending stair on top of it.
  const hole = { minX: 3.9, maxX: 5.7, minZ: 2.5, maxZ: 4.25 };
  const floorPieces = [
    [-9, hole.minX, -6, 6],
    [hole.maxX, 9, -6, 6],
    [hole.minX, hole.maxX, -6, hole.minZ],
    [hole.minX, hole.maxX, hole.maxZ, 6]
  ];
  for (const [minX, maxX, minZ, maxZ] of floorPieces) {
    const piece = addBox(
      scene,
      maxX - minX,
      0.3,
      maxZ - minZ,
      COLORS.floor,
      (minX + maxX) / 2,
      -0.15,
      (minZ + maxZ) / 2
    );
    markWalkSurface(piece);
  }
  for (let i = 0; i < 14; i += 1) {
    const z = -5.55 + i * 0.82;
    addPlane(scene, W - 0.2, 0.018, COLORS.floorLine, 0, 0.008, z, {
      materialOptions: { transparent: true, opacity: 0.28 }
    });
  }

  addBox(scene, W, 2.4, 0.18, COLORS.wall, 0, 1.2, -6.02);
  addBox(scene, W, 0.14, 0.24, COLORS.houseTrim, 0, 0.1, -5.92);
  addBox(scene, 0.18, 1.55, D, COLORS.wallShade, -9.0, 0.77, 0);
  addBox(scene, 0.18, 1.55, D, COLORS.wallShade, 9.0, 0.77, 0);
  addBox(scene, 7.8, 0.5, 0.18, COLORS.wallShade, -5.1, 0.25, 5.92);
  addBox(scene, 7.8, 0.5, 0.18, COLORS.wallShade, 5.1, 0.25, 5.92);

  for (const x of [-6.2, -2.0, 2.0, 6.2]) {
    addBox(scene, 1.4, 1.15, 0.08, COLORS.houseTrim, x, 1.6, -5.92);
    addBox(scene, 1.14, 0.88, 0.04, COLORS.window, x, 1.6, -5.88);
    addBox(scene, 0.05, 0.88, 0.05, COLORS.houseTrim, x, 1.6, -5.85);
    addBox(scene, 1.4, 0.06, 0.14, COLORS.houseTrim, x, 1.0, -5.88);
  }

  // Decoration plaque.
  addBox(scene, 1.15, 0.7, 0.07, COLORS.woodDeep, 0, 1.48, -5.86);
  addBox(scene, 0.98, 0.55, 0.03, COLORS.cork, 0, 1.48, -5.82);
  addBox(scene, 0.62, 0.06, 0.02, COLORS.paper, 0, 1.59, -5.79);
  addBox(scene, 0.42, 0.06, 0.02, COLORS.paperAlt, 0, 1.43, -5.79);
  addHitbox(scene, ACTION.OPEN_DECOR, "decor_plaque", {
    w: 1.4,
    h: 1.25,
    d: 0.8,
    x: 0,
    y: 1.48,
    z: -5.75
  });
  addWorldLabel("装修", 0, 2.15, -5.7, "board");

  // Empty hint only until the first entertainment piece exists.
  const emptyZone = { minX: -5.8, maxX: 5.8, minZ: -4.5, maxZ: 4.5 };
  const ew = emptyZone.maxX - emptyZone.minX;
  const ed = emptyZone.maxZ - emptyZone.minZ;
  const ex = (emptyZone.minX + emptyZone.maxX) / 2;
  const ez = (emptyZone.minZ + emptyZone.maxZ) / 2;
  const emptyMeshes = [];
  emptyMeshes.push(
    addPlane(scene, ew, ed, COLORS.houseTrim, ex, 0.014, ez, {
      materialOptions: { transparent: true, opacity: 0.12 }
    })
  );
  for (const [w, d, x, z] of [
    [ew, 0.035, ex, emptyZone.minZ],
    [ew, 0.035, ex, emptyZone.maxZ],
    [0.035, ed, emptyZone.minX, ez],
    [0.035, ed, emptyZone.maxX, ez]
  ]) {
    emptyMeshes.push(
      addBox(scene, w, 0.012, d, COLORS.woodDark, x, 0.022, z, {
        materialOptions: { transparent: true, opacity: 0.3 }
      })
    );
  }
  const emptyLabel = addWorldLabel("娱乐室 · 待添置", 0, 1.35, -3.2, "empty");

  const decorViews = {};
  const hiddenGroup = (name) => {
    const group = addGroup(scene, 0, 0, 0);
    group.visible = false;
    decorViews[name] = group;
    return group;
  };

  const tv = hiddenGroup("tv");
  addBox(tv, 3.0, 0.12, 0.6, COLORS.woodDark, 0, 0.62, -5.55);
  addBox(tv, 2.75, 1.65, 0.12, COLORS.ink, 0, 1.55, -5.64);
  addBox(tv, 2.5, 1.4, 0.04, "#426067", 0, 1.55, -5.57);
  addBox(tv, 1.9, 0.05, 0.06, COLORS.sage, 0, 0.95, -5.5);

  const consoleG = hiddenGroup("console");
  addBox(consoleG, 1.0, 0.22, 0.55, COLORS.ink, 0, 0.78, -4.95);
  addBox(consoleG, 0.75, 0.08, 0.4, COLORS.metal, 0, 0.94, -4.95);
  addBox(consoleG, 0.22, 0.05, 0.14, COLORS.honey, -0.25, 0.99, -4.95);

  const sofa = hiddenGroup("sofa");
  addBox(sofa, 2.9, 0.5, 1.0, COLORS.sage, 0, 0.32, -3.2);
  addBox(sofa, 2.9, 0.6, 0.22, COLORS.sageDark, 0, 0.65, -3.65);
  addBox(sofa, 0.28, 0.65, 1.0, COLORS.sageDark, -1.45, 0.42, -3.2);
  addBox(sofa, 0.28, 0.65, 1.0, COLORS.sageDark, 1.45, 0.42, -3.2);
  addBox(sofa, 0.7, 0.14, 0.55, COLORS.rugAlt, -0.7, 0.6, -3.2);
  addBox(sofa, 0.7, 0.14, 0.55, COLORS.rugAlt, 0.7, 0.6, -3.2);

  const rug = hiddenGroup("rug");
  addPlane(rug, 3.8, 2.2, COLORS.rug, 0, 0.012, -1.4, {
    materialOptions: { transparent: true, opacity: 0.88 }
  });
  addPlane(rug, 3.2, 1.7, COLORS.rugAlt, 0, 0.02, -1.4, {
    materialOptions: { transparent: true, opacity: 0.32 }
  });

  const shelf = hiddenGroup("shelf");
  addBox(shelf, 2.4, 0.09, 0.3, COLORS.wood, 6.2, 1.45, -5.7);
  addBox(shelf, 2.4, 0.08, 0.3, COLORS.wood, 6.2, 1.95, -5.7);
  addBox(shelf, 0.08, 0.6, 0.3, COLORS.woodDark, 5.0, 1.7, -5.7);
  addBox(shelf, 0.08, 0.6, 0.3, COLORS.woodDark, 7.4, 1.7, -5.7);
  for (let i = 0; i < 5; i += 1) {
    addBox(
      shelf,
      0.18,
      0.34 + (i % 2) * 0.06,
      0.2,
      [COLORS.rose, COLORS.sage, COLORS.honey, COLORS.terracotta, COLORS.rugAlt][i],
      5.35 + i * 0.38,
      1.65,
      -5.67,
      { ry: 0.03 * i }
    );
  }

  const plant = hiddenGroup("plant");
  buildPottedPlant(plant, -7.0, -3.2, 1.15);

  const lamp = hiddenGroup("lamp");
  addCylinder(lamp, 0.18, 0.22, 0.08, 8, COLORS.metal, 7.0, 0.04, 2.0);
  addCylinder(lamp, 0.04, 0.05, 1.65, 6, COLORS.metal, 7.0, 0.86, 2.0);
  addCylinder(lamp, 0.28, 0.18, 0.38, 8, COLORS.honey, 7.0, 1.78, 2.0);

  buildStairwell(scene, addBox, addGroup);
  addHitbox(scene, ACTION.GO_DOWNSTAIRS, "stairs_down", {
    w: 1.5,
    h: 1.6,
    d: 1.9,
    x: 4.8,
    y: 0.55,
    z: 3.4
  });
  addWorldLabel("下楼", 5.65, 1.35, 3.4, "action");

  kit.registerProp("decor", {
    views: decorViews,
    emptyMeshes,
    emptyLabel
  });
}
