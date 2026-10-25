/**
 * Seat passphrases are never stored: the tool and the room only keep a
 * SHA-256 digest. Inputs are Unicode-NFC normalized and trimmed so the same
 * phrase produces the same digest on every device.
 */
export function normalizeSeatWord(value) {
  return String(value ?? "").normalize("NFC").trim();
}

export async function hashSeatWord(value) {
  const normalized = normalizeSeatWord(value);
  if (!normalized) return "";

  const bytes = new TextEncoder().encode(normalized);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}
