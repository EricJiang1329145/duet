const STORAGE_KEY = "duet.audio.v1";

function readEnabled() {
  try {
    return localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

/**
 * Tiny procedural soundtrack: no audio files, no network. The first pointer
 * gesture unlocks Web Audio; music stays very quiet, rain is filtered noise.
 */
export function createAmbience({ onChange = null } = {}) {
  let context = null;
  let master = null;
  let musicGain = null;
  let rainGain = null;
  let rainSource = null;
  let enabled = readEnabled();
  let started = false;
  let rain = false;
  let scene = "outdoor";
  let nextPhraseAt = 0;

  function emit() {
    onChange?.({ enabled, started, rain });
  }

  function writeEnabled() {
    try {
      localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
    } catch {
      // Audio still works for this session when storage is unavailable.
    }
  }

  function gainNode(value) {
    const node = context.createGain();
    node.gain.value = value;
    return node;
  }

  function musicNote(frequency, at, duration, type = "sine", volume = 0.018) {
    if (!context || !musicGain) return;
    const osc = context.createOscillator();
    const envelope = gainNode(0);
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, at);
    envelope.gain.setValueAtTime(0, at);
    envelope.gain.linearRampToValueAtTime(volume, at + 0.08);
    envelope.gain.exponentialRampToValueAtTime(0.001, at + duration);
    osc.connect(envelope).connect(musicGain);
    osc.start(at);
    osc.stop(at + duration + 0.05);
  }

  function schedulePhrase() {
    if (!context || !enabled) return;
    const now = context.currentTime;
    if (now < nextPhraseAt - 0.15) return;
    nextPhraseAt = now + 3.4;

    // A slow C-pentatonic music box, two voices at a time.
    const roots = [261.63, 293.66, 329.63, 392.0, 440.0, 392.0, 329.63, 293.66];
    const base = roots[Math.floor(Math.random() * roots.length)];
    musicNote(base, now + 0.05, 2.6, "sine", 0.014);
    musicNote(base * 1.5, now + 0.22, 2.2, "triangle", 0.009);
    if (Math.random() > 0.45) {
      musicNote(base * 2, now + 1.55, 1.8, "sine", 0.008);
    }
  }

  function makeRain() {
    if (!context || !rainGain || rainSource) return;
    const seconds = 2;
    const buffer = context.createBuffer(
      1,
      Math.floor(context.sampleRate * seconds),
      context.sampleRate
    );
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }
    rainSource = context.createBufferSource();
    rainSource.buffer = buffer;
    rainSource.loop = true;
    const filter = context.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 1900;
    filter.Q.value = 0.35;
    const highpass = context.createBiquadFilter();
    highpass.type = "highpass";
    highpass.frequency.value = 380;
    rainSource.connect(filter).connect(highpass).connect(rainGain);
    rainSource.start();
  }

  function applyGain() {
    if (!context || !master) return;
    const now = context.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setTargetAtTime(enabled ? 0.5 : 0, now, 0.12);
    if (rainGain) {
      const level = rain ? (scene === "outdoor" ? 0.055 : 0.022) : 0;
      rainGain.gain.cancelScheduledValues(now);
      rainGain.gain.setTargetAtTime(level, now, 0.25);
    }
  }

  function ensureContext() {
    if (context) {
      if (context.state === "suspended") void context.resume();
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    context = new Ctx();
    master = gainNode(enabled ? 0.5 : 0);
    musicGain = gainNode(0.65);
    rainGain = gainNode(0);
    master.connect(context.destination);
    musicGain.connect(master);
    rainGain.connect(master);
    makeRain();
    applyGain();
    started = true;
    emit();
    schedulePhrase();
    window.setInterval(schedulePhrase, 900);
  }

  function unlock() {
    if (!enabled) return;
    ensureContext();
  }

  function setEnabled(value) {
    enabled = Boolean(value);
    writeEnabled();
    if (enabled) ensureContext();
    applyGain();
    emit();
  }

  function toggle() {
    setEnabled(!enabled);
    return enabled;
  }

  function setRain(value) {
    rain = Boolean(value);
    applyGain();
    emit();
  }

  function setScene(value) {
    if (!value || value === scene) return;
    scene = value;
    applyGain();
  }

  function install() {
    const handler = () => {
      if (enabled) ensureContext();
    };
    window.addEventListener("pointerdown", handler, { capture: true });
    return () => window.removeEventListener("pointerdown", handler, { capture: true });
  }

  return {
    install,
    setEnabled,
    toggle,
    setRain,
    setScene,
    getEnabled: () => enabled,
    getState: () => ({ enabled, started, rain })
  };
}
