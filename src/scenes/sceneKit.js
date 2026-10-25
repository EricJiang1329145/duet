import * as THREE from "three";
import { ACTION } from "../config.js";
import {
  addBox,
  addCylinder,
  addGroup,
  addPlane
} from "../render/geometry.js";

/**
 * A scene-local facade for registering interactables, walk surfaces, field
 * views and DOM labels. Geometry helpers are exposed here so scene builders
 * stay focused on composition instead of module-level registries.
 */
export function createSceneKit({ scene, addWorldLabel }) {
  const interactables = [];
  const plotViews = Object.create(null);
  const doors = [];
  const props = Object.create(null);

  function addHitbox(parent, action, targetId, config) {
    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      depthWrite: false
    });
    material.colorWrite = false;

    const hitbox = new THREE.Mesh(
      new THREE.BoxGeometry(config.w, config.h, config.d),
      material
    );
    hitbox.position.set(config.x ?? 0, config.y ?? 0, config.z ?? 0);
    hitbox.userData.interaction = { action, targetId };
    parent.add(hitbox);
    interactables.push(hitbox);
    return hitbox;
  }

  function markWalkSurface(mesh) {
    mesh.userData.interaction = { action: ACTION.WALK_TO, targetId: null };
    interactables.push(mesh);
    return mesh;
  }

  function registerDoor(pivot, { openAngle = -1.35 } = {}) {
    const door = { pivot, openAngle, closedAngle: pivot?.rotation?.y ?? 0 };
    doors.push(door);
    return door;
  }

  function registerProp(name, parts) {
    props[name] = parts;
    return parts;
  }

  return {
    scene,
    interactables,
    plotViews,
    doors,
    props,
    addBox,
    addCylinder,
    addPlane,
    addGroup,
    addHitbox,
    markWalkSurface,
    addWorldLabel,
    registerDoor,
    registerProp
  };
}
