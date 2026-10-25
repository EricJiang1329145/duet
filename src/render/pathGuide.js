import * as THREE from "three";
import { samplePathPoints } from "../game/pathSamples.js";

const MAX_DOTS = 260;
const DOT_Y = 0.036;

/**
 * A pooled set of flat dots, one pool per mounted scene. The dots sit just
 * above the floor and never write depth, so they read as a dotted route rather
 * than a solid ribbon.
 */
export function buildPathGuide(scene) {
  const group = new THREE.Group();
  group.name = "path-guide";
  group.renderOrder = 3;

  const geometry = new THREE.CylinderGeometry(0.062, 0.062, 0.014, 8);
  const materials = {
    local: new THREE.MeshBasicMaterial({
      color: 0xf2ca7b,
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2
    }),
    remote: new THREE.MeshBasicMaterial({
      color: 0xd98a6b,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2
    })
  };

  const dots = [];
  for (let i = 0; i < MAX_DOTS; i += 1) {
    const dot = new THREE.Mesh(geometry, materials.remote);
    dot.visible = false;
    dot.position.y = DOT_Y;
    dot.castShadow = false;
    dot.receiveShadow = false;
    group.add(dot);
    dots.push(dot);
  }

  scene.add(group);
  return { group, dots, materials };
}

export function updatePathGuide(guide, entries = []) {
  if (!guide) return;
  let index = 0;
  for (const entry of entries) {
    if (index >= guide.dots.length) break;
    const points = samplePathPoints(entry.path, { max: guide.dots.length - index });
    const material = entry.kind === "local" ? guide.materials.local : guide.materials.remote;
    for (const point of points) {
      const dot = guide.dots[index];
      dot.material = material;
      dot.position.set(point.x, DOT_Y, point.y);
      dot.visible = true;
      index += 1;
    }
  }
  for (; index < guide.dots.length; index += 1) {
    guide.dots[index].visible = false;
  }
}

export function clearPathGuide(guide) {
  if (!guide) return;
  for (const dot of guide.dots) dot.visible = false;
}
