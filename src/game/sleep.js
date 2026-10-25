import { BEDROOMS, SCENE } from "../config.js";

export function isSleeping(player) {
  return player?.activity?.kind === "sleep";
}

export function sleepingBedFor(player) {
  const bedId = player?.activity?.bedId;
  return BEDROOMS[bedId] ?? null;
}

/**
 * A player who is not present in the room is shown as asleep in their own bed.
 * Present players (even in another scene) are represented by their real
 * presence and never duplicated here.
 */
export function offlineSleepers(players = []) {
  const presentNames = new Set(
    players.map((player) => String(player?.name ?? "").trim()).filter(Boolean)
  );
  return Object.values(BEDROOMS)
    .filter((bedroom) => !presentNames.has(bedroom.owner))
    .map((bedroom) => ({
      id: `offline-${bedroom.id}`,
      name: bedroom.owner,
      currentScene: SCENE.INDOOR_1,
      position: { x: bedroom.sleep.x, y: bedroom.sleep.z },
      facing: "north",
      destination: null,
      path: [],
      pathIndex: 0,
      activity: { kind: "sleep", bedId: bedroom.id, since: 0 }
    }));
}

