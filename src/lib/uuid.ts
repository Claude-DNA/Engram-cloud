/**
 * Generates a UUID v7 (time-ordered UUID).
 *
 * Structure (per RFC 9562):
 *   bits  0-47 : Unix timestamp in milliseconds (48 bits)
 *   bits 48-51 : version = 0111 (7)
 *   bits 52-63 : rand_a – 12 random bits
 *   bits 64-65 : variant = 10
 *   bits 66-127: rand_b – 62 random bits
 *
 * Output format: xxxxxxxx-xxxx-7xxx-yxxx-xxxxxxxxxxxx
 */
export function generateUUIDv7(): string {
  const ms = Date.now();

  // 48-bit timestamp as 12 hex chars
  const msHex = ms.toString(16).padStart(12, '0');

  // 12 random bits for rand_a
  const randA = Math.floor(Math.random() * 0x1000)
    .toString(16)
    .padStart(3, '0');

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
