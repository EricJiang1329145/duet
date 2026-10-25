import { CHARACTERS, characterNameFor } from "../../src/config.js";
import { hashSeatWord } from "../../src/game/seatWord.js";

/**
 * Seat authentication helpers.
 *
 * Only the SHA-256 verifier for each seat is kept as a Worker secret. The
 * plaintext passphrase is posted over HTTPS, hashed in the Worker, compared in
 * constant time, and never stored. A successful login receives a signed,
 * HttpOnly cookie; the WebSocket endpoint verifies that cookie before letting
 * the Durable Object see the connection.
 */
export const SESSION_COOKIE = "duet_session";
export const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
const MIN_SECRET_LENGTH = 16;
const HASH_PATTERN = /^[0-9a-f]{64}$/;

export function seatName(seat) {
  if (seat === "A") return CHARACTERS.A.name;
  if (seat === "B") return CHARACTERS.B.name;
  return "";
}

export function seatForName(value) {
  const name = characterNameFor(value);
  if (name === CHARACTERS.A.name) return "A";
  if (name === CHARACTERS.B.name) return "B";
  return "";
}

export function normalizeHash(value) {
  const text = typeof value === "string" ? value.trim().toLowerCase() : "";
  return HASH_PATTERN.test(text) ? text : "";
}

/**
 * Compare two short strings without an early return. This is used for hex
 * digests and signatures, never for the raw passphrase.
 */
export function constantTimeEqual(left, right) {
  const a = new TextEncoder().encode(String(left ?? ""));
  const b = new TextEncoder().encode(String(right ?? ""));
  const length = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < length; i += 1) {
    diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }
  return diff === 0;
}

/**
 * Hash the submitted phrase once, then compare it against both configured
 * verifiers. Both comparisons run even if A matches, so the response does not
 * reveal which seat was detected.
 */
export async function matchSeat(word, hashes) {
  const hashA = normalizeHash(hashes?.A);
  const hashB = normalizeHash(hashes?.B);
  // Fail closed if the deployment is incomplete or both seats use one hash.
  if (!hashA || !hashB || hashA === hashB) return "";

  const digest = await hashSeatWord(word);
  if (!digest) return "";

  const matchesA = constantTimeEqual(digest, hashA);
  const matchesB = constantTimeEqual(digest, hashB);
  if (matchesA === matchesB) return "";
  return matchesA ? "A" : "B";
}

function base64UrlEncode(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

function base64UrlDecode(value) {
  const text = String(value ?? "").replaceAll("-", "+").replaceAll("_", "/");
  const padded = text + "=".repeat((4 - (text.length % 4)) % 4);
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

async function hmacBase64Url(secret, value) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(value)
  );
  return base64UrlEncode(new Uint8Array(signature));
}

function usableSecret(secret) {
  return typeof secret === "string" && secret.length >= MIN_SECRET_LENGTH;
}

/**
 * Token format: base64url(payload).base64url(HMAC-SHA256(payload)).
 * The payload contains only the seat, issued-at and expiry; it has no name,
 * passphrase or digest.
 */
export async function signSession(
  seat,
  secret,
  now = Date.now(),
  ttlSeconds = SESSION_TTL_SECONDS
) {
  if (!seatName(seat) || !usableSecret(secret)) return "";
  const ttl = Number.isFinite(Number(ttlSeconds))
    ? Math.max(1, Math.floor(Number(ttlSeconds)))
    : SESSION_TTL_SECONDS;
  const issuedAt = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  const payload = base64UrlEncode(
    new TextEncoder().encode(
      JSON.stringify({
        v: 1,
        seat,
        iat: issuedAt,
        exp: issuedAt + ttl * 1000
      })
    )
  );
  const signature = await hmacBase64Url(secret, payload);
  return `${payload}.${signature}`;
}

export async function verifySession(
  token,
  secret,
  now = Date.now()
) {
  if (!usableSecret(secret) || typeof token !== "string") return "";
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return "";

  const expected = await hmacBase64Url(secret, parts[0]);
  if (!constantTimeEqual(parts[1], expected)) return "";

  let payload;
  try {
    payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[0])));
  } catch {
    return "";
  }

  const issuedAt = Number(payload?.iat);
  const expiresAt = Number(payload?.exp);
  const current = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  if (
    payload?.v !== 1 ||
    !seatName(payload?.seat) ||
    !Number.isFinite(issuedAt) ||
    !Number.isFinite(expiresAt) ||
    issuedAt > current + 5 * 60 * 1000 ||
    expiresAt <= current
  ) {
    return "";
  }
  return payload.seat;
}

export function parseCookies(header) {
  const cookies = {};
  for (const part of String(header ?? "").split(";")) {
    const index = part.indexOf("=");
    if (index <= 0) continue;
    const name = part.slice(0, index).trim();
    if (!name || cookies[name] !== undefined) continue;
    cookies[name] = part.slice(index + 1).trim();
  }
  return cookies;
}

export function sessionCookie(token, { secure = false } = {}) {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}${secure ? "; Secure" : ""}`;
}

export function clearSessionCookie({ secure = false } = {}) {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? "; Secure" : ""}`;
}

export async function getSessionToken(request) {
  return parseCookies(request.headers.get("cookie"))[SESSION_COOKIE] ?? "";
}

export async function getSessionSeat(request, env) {
  const token = await getSessionToken(request);
  if (!token) return "";
  return verifySession(token, env?.SESSION_SECRET);
}

export function seatFromHeader(value) {
  const text = String(value ?? "").trim().toUpperCase();
  return text === "A" || text === "B" ? text : "";
}
