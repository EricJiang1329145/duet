import * as THREE from "three";
import { ACTION } from "../config.js";

/**
 * Scene taps are the only 3D input path: Pointer Events -> Raycaster -> event.
 * Non-primary pointers are allowed so a second finger can select objects while
 * taps are handled independently of any other finger.
 */
export function createScenePointer({
  canvas,
  camera,
  getInteractables,
  dispatch,
  movementOnly = false
}) {
  const raycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2();

  function isVisibleInTree(object) {
    let node = object;
    while (node) {
      if (!node.visible) return false;
      node = node.parent;
    }
    return true;
  }

  function onPointerDown(event) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();

    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    pointerNdc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointerNdc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointerNdc, camera);

    const activeInteractables = getInteractables().filter(
      (object) => isVisibleInTree(object) && object.userData.interaction
    );
    const hits = raycaster.intersectObjects(activeInteractables, false);
    if (!hits.length) return;

    const interaction = hits[0].object.userData.interaction;
    if (!interaction) return;
    if (movementOnly && interaction.action !== ACTION.WALK_TO) return;

    if (interaction.action === ACTION.WALK_TO) {
      dispatch(ACTION.WALK_TO, null, {
        x: hits[0].point.x,
        y: hits[0].point.z
      });
      return;
    }

    dispatch(interaction.action, interaction.targetId ?? null, null);
  }

  canvas.addEventListener("pointerdown", onPointerDown, { passive: false });

  return {
    destroy() {
      canvas.removeEventListener("pointerdown", onPointerDown);
    }
  };
}
