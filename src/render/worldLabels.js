import * as THREE from "three";

/**
 * DOM labels projected over the orthographic scene. Static labels are owned by
 * the current scene and cleared on scene swaps; player identity labels and
 * chat bubbles persist across scenes and are keyed by player id.
 */
export function createWorldLabels(container) {
  const labels = [];
  const playerLabels = new Map();
  const bubbles = new Map();

  function add(text, x, y, z, variant = "default") {
    const el = document.createElement("span");
    el.className = `world-label${variant === "default" ? "" : ` world-label--${variant}`}`;
    el.textContent = text;
    el.setAttribute("aria-hidden", "true");
    container.appendChild(el);
    labels.push({
      el,
      position: new THREE.Vector3(x, y, z),
      align: variant === "field" ? "center" : "above"
    });
    return el;
  }

  function clear() {
    for (const label of labels) {
      label.el.remove();
    }
    labels.length = 0;
    hideAllBubbles();
  }

  function ensurePlayerLabel(playerId) {
    let el = playerLabels.get(playerId);
    if (el) return el;

    el = document.createElement("span");
    el.className = "world-label world-label--avatar";
    el.setAttribute("aria-hidden", "true");
    container.appendChild(el);
    playerLabels.set(playerId, el);
    return el;
  }

  function removePlayerLabel(playerId) {
    const el = playerLabels.get(playerId);
    if (!el) return;
    el.remove();
    playerLabels.delete(playerId);
  }

  function ensureBubble(playerId) {
    let entry = bubbles.get(playerId);
    if (entry) return entry;

    const el = document.createElement("span");
    el.className = "world-label world-label--chat";
    el.setAttribute("aria-hidden", "true");
    el.hidden = true;

    const text = document.createElement("span");
    text.className = "chat-bubble__text";

    const state = document.createElement("span");
    state.className = "chat-bubble__state";

    el.append(text, state);
    container.appendChild(el);
    entry = { el, text, state, visible: false, own: false, width: 0 };
    bubbles.set(playerId, entry);
    return entry;
  }

  function setBubble(playerId, { text = "", state = "", own = false } = {}) {
    const entry = ensureBubble(playerId);
    entry.text.textContent = text;
    entry.state.textContent = state;
    entry.state.hidden = !state;
    entry.el.classList.toggle("is-own", Boolean(own));
    entry.el.hidden = !text;
    entry.visible = Boolean(text);
    entry.own = Boolean(own);
    entry.el.classList.remove("is-pop");
    if (text) {
      // Restart the pop animation even when a new message replaces an old one.
      // Measure once per message; update() must not force layout every frame.
      entry.el.classList.add("is-pop");
      entry.width = entry.el.offsetWidth || 0;
    } else {
      entry.width = 0;
    }
  }

  function hideBubble(playerId) {
    const entry = bubbles.get(playerId);
    if (!entry) return;
    entry.el.hidden = true;
    entry.visible = false;
    entry.el.classList.remove("is-own", "is-pop");
  }

  function hideAllBubbles() {
    for (const [playerId, entry] of bubbles) {
      entry.el.hidden = true;
      entry.visible = false;
      entry.el.classList.remove("is-pop");
      void playerId;
    }
  }

  function removeBubble(playerId) {
    const entry = bubbles.get(playerId);
    if (!entry) return;
    entry.el.remove();
    bubbles.delete(playerId);
  }

  function update({
    camera,
    width,
    height,
    players = [],
    localPlayerId = null,
    avatars = new Map()
  }) {
    if (!width || !height) return;

    const projected = new THREE.Vector3();

    for (const label of labels) {
      projected.copy(label.position).project(camera);
      const x = (projected.x * 0.5 + 0.5) * width;
      const y = (-projected.y * 0.5 + 0.5) * height;
      const anchor =
        label.align === "center"
          ? "translate(-50%, -50%)"
          : "translate(-50%, -100%)";
      label.el.style.transform = `translate3d(${x}px, ${y}px, 0) ${anchor}`;
      label.el.style.visibility = projected.z > 1 ? "hidden" : "visible";
    }

    const seen = new Set();
    for (const player of players) {
      seen.add(player.id);
      const avatar = avatars.get(player.id);
      const el = ensurePlayerLabel(player.id);
      el.classList.toggle("is-local", player.id === localPlayerId);

      if (!avatar) {
        el.style.visibility = "hidden";
        hideBubble(player.id);
        continue;
      }

      el.textContent = player.name;
      const baseY = avatar.position.y;
      projected
        .set(avatar.position.x, baseY + 1.63, avatar.position.z)
        .project(camera);
      const x = (projected.x * 0.5 + 0.5) * width;
      const y = (-projected.y * 0.5 + 0.5) * height;
      el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -100%)`;
      el.style.visibility = projected.z > 1 ? "hidden" : "visible";

      const entry = bubbles.get(player.id);
      if (entry?.visible) {
        projected
          .set(avatar.position.x, baseY + 2.02, avatar.position.z)
          .project(camera);
        const rawX = (projected.x * 0.5 + 0.5) * width;
        const rawY = (-projected.y * 0.5 + 0.5) * height;
        const half = Math.min(entry.width || 0, width) / 2 + 8;
        const clampedX = Math.min(width - half, Math.max(half, rawX));
        entry.el.style.transform = `translate3d(${clampedX}px, ${rawY}px, 0) translate(-50%, -100%)`;
        entry.el.style.visibility = projected.z > 1 ? "hidden" : "visible";
      }
    }

    for (const playerId of [...playerLabels.keys()]) {
      if (!seen.has(playerId)) {
        removePlayerLabel(playerId);
        hideBubble(playerId);
      }
    }
    for (const playerId of [...bubbles.keys()]) {
      if (!seen.has(playerId)) removeBubble(playerId);
    }
  }

  return {
    add,
    clear,
    update,
    ensurePlayerLabel,
    removePlayerLabel,
    setBubble,
    hideBubble,
    hideAllBubbles,
    removeBubble
  };
}
