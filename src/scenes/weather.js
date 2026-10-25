import { COLORS } from "../config.js";

const RAIN_TOP = 3.6;
const RAIN_RANGE = 4.8;

/**
 * Outdoor-only ambience props. Fireflies are tiny emissive boxes; rain is a
 * pool of thin vertical strokes. Both are cheap, untextured meshes and are
 * toggled by the shared daylight/weather clock in presentation.
 */
export function buildWeatherEffects(parent, addGroup, addBox) {
  const fireflies = addGroup(parent, 0, 0, 0);
  fireflies.name = "weather-fireflies";
  fireflies.visible = false;
  const flyPositions = [
    [-5.8, 0.62, 1.0],
    [-3.9, 0.9, 4.4],
    [-1.0, 0.5, 5.9],
    [1.8, 0.78, 3.6],
    [4.6, 0.48, 7.0],
    [6.7, 0.86, 4.1],
    [-7.0, 0.72, -0.2],
    [8.6, 0.56, -1.5],
    [-4.4, 1.0, -2.7],
    [3.1, 0.68, -3.0]
  ];
  for (const [x, y, z] of flyPositions) {
    addBox(fireflies, 0.06, 0.06, 0.06, "#ffe3a0", x, y, z, {
      materialOptions: {
        emissive: 0xffd36b,
        emissiveIntensity: 1.1,
        transparent: true,
        opacity: 0.95,
        depthWrite: false
      }
    });
    fireflies.children[fireflies.children.length - 1].userData.base = { x, y, z };
  }

  const rain = addGroup(parent, 0, 0, 0);
  rain.name = "weather-rain";
  rain.visible = false;
  const drops = [];
  // Keep the streak geometry short and close to the camera; the old fall
  // speed was ~1 unit/s, which read like slow snow. Rain should cross the
  // visible band in roughly a third of a second.
  for (let i = 0; i < 54; i += 1) {
    const x = ((i * 37) % 17) / 17 * 15 - 7.5;
    const z = ((i * 53) % 19) / 19 * 13 - 6.5;
    const offset = (((i * 29) % 100) / 100) * RAIN_RANGE;
    const speed = 9.2 + ((i * 13) % 12) / 12 * 4.2;
    addBox(rain, 0.03, 0.78, 0.03, "#d8eef2", x, RAIN_TOP, z, {
      materialOptions: {
        transparent: true,
        opacity: 0.48,
        depthWrite: false
      }
    });
    drops.push({ x, z, offset, speed });
  }

  return { fireflies, rain, drops };
}
