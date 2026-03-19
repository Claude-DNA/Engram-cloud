/**
 * Generates a UUID v7 (time-ordered UUID) with monotonic counter.
 *
 * Structure (per RFC 9562):
 *   bits  0-47 : Unix timestamp in milliseconds (48 bits)
 *   bits 48-51 : version = 0111 (7)
 *   bits 52-63 : rand_a – 12 bits (monotonic counter within same ms)
 *   bits 64-65 : variant = 10
 *   bits 66-127: rand_b – 62 random bits
 *
 * Output format: xxxxxxxx-xxxx-7xxx-yxxx-xxxxxxxxxxxx
 *
 * Monotonic guarantee (RFC 9562 §6.2):
 *   Within the same millisecond, rand_a increments to ensure strict
 *   ascending sort order. Resets to random on new millisecond.
 */

let _lastMs = 0;
let _counter = 0;

export function generateUUIDv7(): string {
  const ms = Date.now();

  if (ms === _lastMs) {
    _counter++;
    if (_counter >= 0x1000) {
      // Counter overflow within same ms — extremely unlikely (4096 UUIDs/ms)
      // Spin-wait for next millisecond
      let now = Date.now();
      while (now === ms) {
        now = Date.now();
      }
      _lastMs = now;
      _counter = Math.floor(Math.random() * 0x200); // Reset with headroom
      return _buildUUID(_lastMs, _counter);
    }
  } else {
    _lastMs = ms;
    _counter = Math.floor(Math.random() * 0x200); // Start low, leave headroom for increments
  }

  return _buildUUID(ms, _counter);
}

function _buildUUID(ms: number, counter: number): string {
  // 48-bit timestamp as 12 hex chars
  const msHex = ms.toString(16).padStart(12, '0');

  // 12-bit counter for rand_a (monotonic within same ms)
  const randA = (counter & 0xfff).toString(16).padStart(3, '0');

  // variant bits 10xx (0x8000–0xBFFF) + 14 random bits
  const randB1 = (0x8000 | Math.floor(Math.random() * 0x4000))
    .toString(16)
    .padStart(4, '0');

  // 48 random bits for rand_b2
  const randB2 = Array.from({ length: 12 }, () =>
    Math.floor(Math.random() * 16).toString(16),
  ).join('');

  return `${msHex.slice(0, 8)}-${msHex.slice(8, 12)}-7${randA}-${randB1}-${randB2}`;
}

/**
 * Reset monotonic state — for testing only.
 */
export function _resetUUIDState(): void {
  _lastMs = 0;
  _counter = 0;
}
