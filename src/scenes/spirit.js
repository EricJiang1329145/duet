import { ACTION, COLORS } from "../config.js";
import { SPIRIT_HOME } from "../game/spirit.js";

const BODY = "#f3ead8";
const HEAD = "#faf4e8";
const BODY_SHADE = "#e6d5ba";
const LEAF = "#7e9b82";
const LEAF_LIGHT = "#a8c197";
const LEAF_DARK = "#5d7b63";
const CHEEK = "#dfa08e";
const EYE = "#39463e";
const PINK = "#cf8e83";

function buildShadow(root, addCylinder) {
  addCylinder(root, 0.3, 0.3, 0.012, 14, COLORS.ink, 0, 0.018, 0, {
    materialOptions: {
      transparent: true,
      opacity: 0.15,
      depthWrite: false
    }
  });
}

/**
 * The garden spirit is deliberately abstract: a cream seed body, a huge round
 * head, two bead eyes, rosy cheeks and a sprout. No animal anatomy means the
 * silhouette can stay cute at the game's small camera scale.
 */
export function buildSpirit(parent, addGroup, addBox, addCylinder, addHitbox) {
  const root = addGroup(parent, SPIRIT_HOME.x, 0, SPIRIT_HOME.y);
  root.name = "spirit-tuanzi";
  root.userData.baseScale = 1.2;
  root.scale.setScalar(root.userData.baseScale);
  buildShadow(root, addCylinder);

  const body = addGroup(root, 0, 0, 0);
  addCylinder(body, 0.19, 0.27, 0.35, 12, BODY, 0, 0.26, 0);
  addCylinder(body, 0.16, 0.2, 0.1, 12, BODY_SHADE, 0, 0.44, 0.03);
  addBox(body, 0.2, 0.16, 0.055, "#fbf6ea", 0, 0.27, 0.2);

  // Visible leaf skirt around the seed body.
  for (let i = 0; i < 5; i += 1) {
    const angle = -1.05 + i * 0.525;
    const x = Math.sin(angle) * 0.2;
    const z = Math.cos(angle) * 0.18;
    addBox(body, 0.14, 0.028, 0.1, i % 2 ? LEAF_LIGHT : LEAF, x, 0.1, z, {
      ry: angle,
      rz: 0.22
    });
  }
  addBox(body, 0.09, 0.12, 0.02, LEAF, 0, 0.27, 0.21, { rz: 0.18 });
  addBox(body, 0.08, 0.11, 0.02, LEAF_LIGHT, 0.035, 0.28, 0.213, {
    rz: -0.38
  });

  // A leaf collar separates the head and seed body visually.
  addCylinder(root, 0.17, 0.19, 0.07, 12, LEAF, 0, 0.46, 0.03);

  const head = addGroup(root, 0, 0.57, 0.055);
  addCylinder(head, 0.2, 0.215, 0.21, 12, HEAD, 0, 0, 0);
  // A soft green cap makes the head read as a sprout, not a white blob.
  addCylinder(head, 0.16, 0.205, 0.045, 12, LEAF, 0, 0.115, 0.01);
  addBox(head, 0.19, 0.02, 0.1, LEAF_LIGHT, 0, 0.085, 0.13, {
    rz: 0.03
  });
  addBox(head, 0.15, 0.035, 0.05, BODY_SHADE, 0, -0.1, 0.13);

  const eyes = addGroup(head, 0, 0.015, 0);
  for (const side of [-1, 1]) {
    addBox(eyes, 0.062, 0.078, 0.018, EYE, side * 0.082, 0, 0.195);
    addBox(eyes, 0.016, 0.022, 0.008, COLORS.white, side * 0.098, 0.017, 0.207);
    addBox(eyes, 0.009, 0.014, 0.006, COLORS.white, side * 0.063, -0.013, 0.207);
  }
  addBox(head, 0.04, 0.022, 0.02, PINK, 0, -0.045, 0.2);
  addBox(head, 0.026, 0.01, 0.014, "#8b5c52", 0, -0.075, 0.2);
  addBox(head, 0.02, 0.01, 0.014, "#8b5c52", -0.022, -0.088, 0.2, {
    rz: 0.3
  });
  addBox(head, 0.02, 0.01, 0.014, "#8b5c52", 0.022, -0.088, 0.2, {
    rz: -0.3
  });
  addBox(head, 0.055, 0.024, 0.012, CHEEK, -0.15, -0.04, 0.17);
  addBox(head, 0.055, 0.024, 0.012, CHEEK, 0.15, -0.04, 0.17);
  addBox(head, 0.05, 0.018, 0.012, "#8b5c52", 0, -0.105, 0.2, {
    rz: 0.06
  });

  // Sprout: a stem plus two soft leaves; this is the spirit's "ears".
  addCylinder(head, 0.018, 0.024, 0.16, 6, LEAF_DARK, 0, 0.18, 0, {
    rz: -0.12
  });
  const leaf = addGroup(head, 0, 0.27, 0);
  // One broad face-on leaf plus a smaller side leaf; the face-on blade stays
  // readable at the game's normal camera distance.
  addBox(leaf, 0.17, 0.16, 0.025, LEAF, -0.035, 0.03, 0.025, {
    rz: -0.38,
    ry: 0.12
  });
  addBox(leaf, 0.2, 0.022, 0.11, LEAF_LIGHT, -0.065, 0.085, 0.005, {
    ry: 0.28,
    rz: -0.45
  });
  addBox(leaf, 0.14, 0.1, 0.022, LEAF_LIGHT, 0.095, 0.05, 0.01, {
    rz: 0.55,
    ry: -0.2
  });
  addBox(leaf, 0.06, 0.02, 0.045, LEAF_DARK, -0.13, 0.01, 0.02, {
    ry: 0.2,
    rz: -0.2
  });

  const legs = [];
  for (const side of [-1, 1]) {
    const foot = addGroup(root, side * 0.1, 0.06, 0.18);
    addBox(foot, 0.1, 0.075, 0.13, BODY, 0, 0, 0);
    addBox(foot, 0.1, 0.035, 0.08, LEAF_LIGHT, 0, 0.035, 0.03);
    legs.push(foot);
    addCylinder(root, 0.04, 0.05, 0.14, 8, BODY, side * 0.235, 0.3, 0.02, {
      rz: side * 0.28
    });
    addCylinder(root, 0.055, 0.06, 0.06, 8, LEAF_LIGHT, side * 0.29, 0.225, 0.05, {
      rz: side * 0.28
    });
  }

  // A curled vine with a leaf at the back.
  const tail = addGroup(root, 0, 0.22, -0.18);
  addBox(tail, 0.055, 0.055, 0.2, LEAF_DARK, 0, 0, -0.1, { rx: -0.15 });
  addBox(tail, 0.05, 0.05, 0.18, LEAF, 0.1, -0.03, -0.22, {
    ry: 0.85,
    rz: -0.2
  });
  addBox(tail, 0.12, 0.02, 0.07, LEAF_LIGHT, 0.2, -0.06, -0.2, {
    ry: 1.1,
    rz: -0.15
  });

  const hearts = addGroup(root, 0, 1.02, 0);
  hearts.visible = false;
  for (let i = 0; i < 3; i += 1) {
    const heart = addGroup(hearts, (i - 1) * 0.2, 0, 0);
    addBox(heart, 0.12, 0.12, 0.035, COLORS.rose, -0.035, 0, 0, {
      rz: Math.PI / 4
    });
    addBox(heart, 0.12, 0.12, 0.035, COLORS.rose, 0.035, 0, 0, {
      rz: Math.PI / 4
    });
  }

  root.userData.body = body;
  root.userData.head = head;
  root.userData.eyes = eyes;
  root.userData.leaf = leaf;
  root.userData.legs = legs;
  root.userData.tail = tail;
  root.userData.hearts = hearts;

  addHitbox(root, ACTION.GREET_SPIRIT, "spirit", {
    w: 0.75,
    h: 0.8,
    d: 0.9,
    x: 0,
    y: 0.38,
    z: 0.08
  });

  return root;
}
