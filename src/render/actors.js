import * as THREE from "three";
import { COLORS, FACING_YAW } from "../config.js";
import { addBox, addCylinder, addGroup } from "./geometry.js";
import { playerIsMoving } from "../game/player.js";

const SKIN = "#e9c3a2";
const SKIN_SHADE = "#d9ac8b";
const EYE = "#394135";
const HAIR = "#4a3a2c";
const HAIR_REMOTE = "#3b3026";

function shortestAngle(from, to) {
  let delta = (to - from) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}

function addContactShadow(avatar) {
  const shadow = addGroup(avatar, 0, 0.02, 0);
  const rings = [
    { radius: 0.36, height: 0.006, opacity: 0.07 },
    { radius: 0.27, height: 0.007, opacity: 0.1 },
    { radius: 0.17, height: 0.008, opacity: 0.13 }
  ];
  for (const ring of rings) {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(ring.radius, ring.radius, ring.height, 14),
      new THREE.MeshBasicMaterial({
        color: 0x40503e,
        transparent: true,
        opacity: ring.opacity,
        depthWrite: false
      })
    );
    mesh.position.y = ring.height / 2;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    shadow.add(mesh);
  }
  shadow.name = "contact-shadow";
  avatar.userData.shadow = shadow;
  return shadow;
}

function addHead(avatar, variant) {
  const head = addGroup(avatar, 0, 0, 0);
  const hair = variant === "remote" ? HAIR_REMOTE : HAIR;
  const skin = variant === "remote" ? SKIN_SHADE : SKIN;

  // A rounded head stack, with the face kept clear of the hair silhouette.
  addCylinder(head, 0.078, 0.084, 0.12, 8, skin, 0, 0.98, 0);
  addCylinder(head, 0.205, 0.225, 0.30, 10, skin, 0, 1.145, 0);
  addCylinder(head, 0.18, 0.205, 0.07, 10, skin, 0, 1.315, 0);
  addBox(head, 0.052, 0.085, 0.045, skin, -0.244, 1.13, 0.005);
  addBox(head, 0.052, 0.085, 0.045, skin, 0.244, 1.13, 0.005);

  // Hair cap sits on top of the rounded skull rather than swallowing it.
  addCylinder(head, 0.225, 0.235, 0.16, 10, hair, 0, 1.335, -0.012);
  addBox(head, 0.38, 0.24, 0.14, hair, 0, 1.19, -0.18);
  addCylinder(head, 0.052, 0.065, 0.24, 6, hair, -0.205, 1.13, 0.015);
  addCylinder(head, 0.052, 0.065, 0.24, 6, hair, 0.205, 1.13, 0.015);

  // Soft fringe: three small wedges, not one square slab.
  addBox(head, 0.15, 0.085, 0.045, hair, -0.09, 1.28, 0.235, { rz: 0.12 });
  addBox(head, 0.16, 0.07, 0.045, hair, 0.08, 1.285, 0.238, { rz: -0.08 });
  addBox(head, 0.08, 0.055, 0.035, hair, 0.005, 1.235, 0.245);
  addBox(head, 0.055, 0.18, 0.035, hair, -0.19, 1.19, 0.222, { rz: 0.14 });
  addBox(head, 0.055, 0.16, 0.035, hair, 0.19, 1.2, 0.222, { rz: -0.1 });
  addBox(head, 0.17, 0.025, 0.06, "#67513c", -0.07, 1.405, 0.06, { rz: 0.24 });

  // Face: small expressive eyes, brows, nose, blush and mouth.
  const eyes = addGroup(head, 0, 1.16, 0);
  addBox(eyes, 0.046, 0.058, 0.018, EYE, -0.075, 0, 0.215);
  addBox(eyes, 0.046, 0.058, 0.018, EYE, 0.075, 0, 0.215);
  addBox(eyes, 0.014, 0.018, 0.008, COLORS.white, -0.064, 0.012, 0.226);
  addBox(eyes, 0.014, 0.018, 0.008, COLORS.white, 0.086, 0.012, 0.226);
  head.userData.eyes = eyes;

  addBox(head, 0.06, 0.014, 0.018, hair, -0.075, 1.225, 0.218, { rz: 0.08 });
  addBox(head, 0.06, 0.014, 0.018, hair, 0.075, 1.225, 0.218, { rz: -0.08 });
  addBox(head, 0.035, 0.035, 0.03, skin, 0, 1.115, 0.232);
  addBox(head, 0.058, 0.016, 0.018, COLORS.rose, 0, 1.075, 0.218);
  addBox(head, 0.042, 0.022, 0.01, "#e8aa96", -0.15, 1.105, 0.205);
  addBox(head, 0.042, 0.022, 0.01, "#e8aa96", 0.15, 1.105, 0.205);

  if (variant === "remote") {
    // Straw hat and a tiny terracotta badge.
    addCylinder(head, 0.31, 0.32, 0.025, 10, COLORS.honey, 0, 1.36, -0.01);
    addCylinder(head, 0.17, 0.19, 0.12, 10, COLORS.honey, 0, 1.43, -0.015);
    addCylinder(head, 0.175, 0.18, 0.025, 10, COLORS.terracotta, 0, 1.385, -0.015);
    addBox(head, 0.11, 0.04, 0.1, COLORS.terracotta, 0.02, 1.48, -0.02);
  } else {
    // Low bun with a rose tie.
    addCylinder(head, 0.075, 0.1, 0.12, 8, hair, 0, 1.43, -0.09);
    addCylinder(head, 0.08, 0.08, 0.035, 8, COLORS.rose, 0, 1.385, -0.09);
    addBox(head, 0.13, 0.035, 0.025, COLORS.rose, 0.16, 1.23, 0.225, { rz: -0.45 });
  }

  avatar.userData.head = head;
  return head;
}

export function buildPlayerAvatar(scene, player, { variant = "local" } = {}) {
  const avatar = new THREE.Group();
  avatar.name = `player-avatar-${player.id}`;
  avatar.userData.playerId = player.id;

  const shirt = variant === "remote" ? COLORS.terracotta : COLORS.sageDark;
  const sleeve = variant === "remote" ? COLORS.rose : COLORS.sage;
  const trouser = variant === "remote" ? "#6d5541" : COLORS.woodDeep;

  addContactShadow(avatar);

  // Slightly thicker legs and rounded shoes give the silhouette a grounded,
  // friendly stance instead of stick-like limbs.
  const leftLegPivot = addGroup(avatar, -0.105, 0.48, 0);
  addBox(leftLegPivot, 0.14, 0.32, 0.16, trouser, 0, -0.16, 0);
  addBox(leftLegPivot, 0.17, 0.09, 0.23, COLORS.woodDeep, 0, -0.355, 0.035);
  const rightLegPivot = addGroup(avatar, 0.105, 0.48, 0);
  addBox(rightLegPivot, 0.14, 0.32, 0.16, trouser, 0, -0.16, 0);
  addBox(rightLegPivot, 0.17, 0.09, 0.23, COLORS.woodDeep, 0, -0.355, 0.035);
  avatar.userData.legPivots = [leftLegPivot, rightLegPivot];

  addCylinder(avatar, 0.2, 0.24, 0.42, 8, shirt, 0, 0.71, 0);
  addBox(avatar, 0.4, 0.055, 0.25, COLORS.cream, 0, 0.905, 0);
  addCylinder(avatar, 0.215, 0.22, 0.055, 8, COLORS.woodDark, 0, 0.555, 0);

  if (variant === "remote") {
    // Satchel and strap.
    addBox(avatar, 0.17, 0.2, 0.26, COLORS.woodDark, 0.275, 0.62, -0.01, {
      rz: 0.06
    });
    addBox(avatar, 0.045, 0.4, 0.05, COLORS.woodDark, 0.18, 0.78, 0.09, {
      rz: 0.22
    });
    addBox(avatar, 0.08, 0.08, 0.03, COLORS.honey, 0.275, 0.64, 0.135);
  } else {
    // Apron with two small pockets.
    addBox(avatar, 0.23, 0.3, 0.045, COLORS.cream, 0, 0.66, 0.2);
    addBox(avatar, 0.075, 0.08, 0.02, COLORS.sage, -0.065, 0.62, 0.225);
    addBox(avatar, 0.075, 0.08, 0.02, COLORS.sage, 0.065, 0.62, 0.225);
    addBox(avatar, 0.2, 0.045, 0.03, COLORS.rose, 0, 0.8, 0.215);
  }

  // Arms hang from rounded shoulder pivots; hands are small separate forms.
  const leftArmPivot = addGroup(avatar, -0.245, 0.86, 0);
  addCylinder(leftArmPivot, 0.06, 0.075, 0.24, 6, sleeve, 0, -0.12, 0);
  addCylinder(leftArmPivot, 0.05, 0.055, 0.1, 6, variant === "remote" ? SKIN_SHADE : SKIN, 0, -0.31, 0);
  addCylinder(leftArmPivot, 0.058, 0.062, 0.085, 6, variant === "remote" ? SKIN_SHADE : SKIN, 0, -0.39, 0);
  const rightArmPivot = addGroup(avatar, 0.245, 0.86, 0);
  addCylinder(rightArmPivot, 0.06, 0.075, 0.24, 6, sleeve, 0, -0.12, 0);
  addCylinder(rightArmPivot, 0.05, 0.055, 0.1, 6, variant === "remote" ? SKIN_SHADE : SKIN, 0, -0.31, 0);
  addCylinder(rightArmPivot, 0.058, 0.062, 0.085, 6, variant === "remote" ? SKIN_SHADE : SKIN, 0, -0.39, 0);
  avatar.userData.armPivots = [leftArmPivot, rightArmPivot];

  addHead(avatar, variant);

  avatar.position.set(player.position.x, 0, player.position.y);
  avatar.rotation.y = FACING_YAW[player.facing] ?? 0;
  avatar.userData.yaw = avatar.rotation.y;
  avatar.userData.nextBlinkAt = 1200 + Math.random() * 2400;
  avatar.userData.blinkUntil = 0;

  scene.add(avatar);
  return avatar;
}

export function buildDestinationMarker(scene) {
  const marker = new THREE.Group();
  marker.name = "walk-destination";
  marker.visible = false;

  const disc = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.22, 0.012, 18),
    new THREE.MeshBasicMaterial({
      color: 0xf0c87c,
      transparent: true,
      opacity: 0.56,
      depthWrite: false
    })
  );
  disc.position.y = 0.025;
  marker.add(disc);

  const center = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.055, 0.016, 10),
    new THREE.MeshBasicMaterial({
      color: 0xb96545,
      transparent: true,
      opacity: 0.9,
      depthWrite: false
    })
  );
  center.position.y = 0.033;
  marker.add(center);

  scene.add(marker);
  return marker;
}

function applyPose(avatar, pose) {
  const legPivots = avatar.userData.legPivots ?? [];
  const armPivots = avatar.userData.armPivots ?? [];

  if (pose?.kind === "swing") {
    legPivots[0].rotation.x = -1.05;
    legPivots[1].rotation.x = -1.05;
    armPivots[0].rotation.x = -0.55;
    armPivots[1].rotation.x = -0.55;
    return;
  }
  if (pose?.kind === "seesaw") {
    legPivots[0].rotation.x = -0.9;
    legPivots[1].rotation.x = -0.9;
    armPivots[0].rotation.x = -0.3;
    armPivots[1].rotation.x = -0.3;
    return;
  }
  if (pose?.kind === "sleep") {
    for (const leg of legPivots) leg.rotation.x = 0;
    for (const arm of armPivots) arm.rotation.x = 0;
    return;
  }
  if (
    pose?.kind === "work" ||
    pose?.kind === "sofa" ||
    pose?.kind === "meal"
  ) {
    legPivots[0].rotation.x = -1.0;
    legPivots[1].rotation.x = -1.0;
    armPivots[0].rotation.x = -0.55;
    armPivots[1].rotation.x = -0.55;
  }
}

export function syncAvatar(avatar, player, elapsed, options = {}) {
  if (!avatar) return;

  const delta = Math.min(Math.max(options.deltaSeconds ?? 0.016, 0), 0.1);
  const moving = options.moving ?? playerIsMoving(player);
  const pose = options.pose ?? null;
  const x = options.position?.x ?? player.position.x;
  const y = options.position?.y ?? player.position.y;
  const gait = elapsed * 0.0118;
  const swing = moving && !pose ? Math.sin(gait) * 0.56 : 0;

  avatar.position.x = x;
  avatar.position.z = y;

  if (pose) {
    // Seated/sleeping: the presentation supplies the anchor height and lean.
    avatar.position.y = pose.y ?? 0.46;
    avatar.rotation.z = pose.lean ?? 0;
    avatar.rotation.x = pose.rotationX ?? 0;
    applyPose(avatar, pose);
  } else {
    avatar.position.y = moving
      ? 0.012 + Math.abs(Math.sin(gait)) * 0.022
      : 0.012 + Math.sin(elapsed * 0.0022) * 0.006;
    avatar.rotation.z = 0;
    avatar.rotation.x = 0;

    if (Array.isArray(avatar.userData.legPivots)) {
      avatar.userData.legPivots[0].rotation.x = swing;
      avatar.userData.legPivots[1].rotation.x = -swing;
    }
    if (Array.isArray(avatar.userData.armPivots)) {
      avatar.userData.armPivots[0].rotation.x = -swing * 0.8;
      avatar.userData.armPivots[1].rotation.x = swing * 0.8;
    }
  }

  // Smooth turn toward the 8-direction facing instead of snapping.
  const targetYaw = FACING_YAW[pose?.facing ?? player.facing] ?? 0;
  const current = avatar.userData.yaw ?? avatar.rotation.y;
  const alpha = 1 - Math.exp(-16 * delta);
  const nextYaw = current + shortestAngle(current, targetYaw) * alpha;
  avatar.rotation.y = nextYaw;
  avatar.userData.yaw = nextYaw;

  // Blink on an irregular timer so both avatars feel alive.
  if (elapsed > avatar.userData.nextBlinkAt) {
    avatar.userData.blinkUntil = elapsed + 90;
    avatar.userData.nextBlinkAt = elapsed + 2500 + Math.random() * 2800;
  }
  const eyes = avatar.userData.head?.userData.eyes;
  if (eyes) {
    const blinking = elapsed < avatar.userData.blinkUntil;
    eyes.scale.y = blinking ? 0.14 : 1;
  }

  // Keep the contact shadow on the floor even when the avatar is seated or
  // swinging above it.
  const shadow = avatar.userData.shadow;
  if (shadow) {
    shadow.visible = pose?.kind !== "sleep";
    shadow.position.y = 0.02 - avatar.position.y;
    const height = Math.max(0, avatar.position.y - 0.02);
    shadow.scale.setScalar(1 + Math.min(0.35, height * 0.2));
  }
}

export function syncDestinationMarker(marker, player, elapsed) {
  if (!marker) return;

  if (!player.destination) {
    marker.visible = false;
    return;
  }

  marker.visible = true;
  marker.position.set(player.destination.x, 0, player.destination.y);
  const pulse = 1 + Math.sin(elapsed * 0.0045) * 0.08;
  marker.scale.setScalar(pulse);
}
