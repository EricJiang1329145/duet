/**
 * Token buckets for per-connection flood control. Pure and clock-injected so
 * the limits can be tested with node:test and reasoned about without a DO.
 */
export function createRateLimiter({ capacity, refillPerSecond }) {
  const max = Math.max(1, Number(capacity) || 1);
  const refill = Math.max(0, Number(refillPerSecond) || 0);
  let tokens = max;
  let updatedAt = null;

  return {
    allow(nowMs, cost = 1) {
      const at = Number.isFinite(nowMs) ? nowMs : 0;
      if (updatedAt === null) updatedAt = at;
      const elapsedSeconds = Math.max(0, at - updatedAt) / 1000;
      updatedAt = Math.max(updatedAt, at);
      tokens = Math.min(max, tokens + elapsedSeconds * refill);

      const need = Math.max(1, Number(cost) || 1);
      if (tokens < need) return false;
      tokens -= need;
      return true;
    },
    available(nowMs) {
      const at = Number.isFinite(nowMs) ? nowMs : 0;
      if (updatedAt === null) return max;
      const elapsedSeconds = Math.max(0, at - updatedAt) / 1000;
      return Math.min(max, tokens + elapsedSeconds * refill);
    }
  };
}
