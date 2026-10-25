/**
 * Full-screen scene curtain. Presentation controls the opacity per frame, so
 * there is no CSS transition to race with scene disposal.
 */
export function createSceneFade() {
  const el = document.getElementById("scene-fade");
  let last = -1;

  function setBlack(value) {
    const clamped = Math.min(1, Math.max(0, Number(value) || 0));
    // Never skip the exact endpoints: the scene must end fully transparent.
    if (Math.abs(clamped - last) < 0.004 && clamped !== 0 && clamped !== 1) {
      return;
    }
    last = clamped;
    if (el) el.style.opacity = String(clamped);
    document.documentElement.classList.toggle("scene-transition", clamped > 0.01);
  }

  function reset() {
    last = -1;
    setBlack(0);
  }

  return { setBlack, reset };
}
