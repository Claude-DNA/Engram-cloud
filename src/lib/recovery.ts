import { WORDLIST } from './wordlist';

/** Convert 32-byte hex entropy to a 24-word BIP-39-style mnemonic. */
export async function entropyToMnemonic(hexEntropy: string): Promise<string[]> {
  const bytes = hexToUint8Array(hexEntropy);
  if (bytes.length !== 32) throw new Error('Entropy must be 32 bytes');

  // Compute SHA-256 checksum (first byte)
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
  const checksum = new Uint8Array(hashBuffer)[0];

  // Build 264-bit array: 256 bits entropy + 8 bits checksum
  const bits: number[] = [];
  for (const byte of bytes) {
    for (let i = 7; i >= 0; i--) bits.push((byte >> i) & 1);
  }
  for (let i = 7; i >= 0; i--) bits.push((checksum >> i) & 1);

  // Split into 24 groups of 11 bits, each indexes a word
  const words: string[] = [];
  for (let i = 0; i < 24; i++) {
    let index = 0;
    for (let j = 0; j < 11; j++) {
      index = (index << 1) | bits[i * 11 + j];
    }
    words.push(WORDLIST[index]);
  }
  return words;
}

/** Convert a 24-word mnemonic back to 32-byte hex entropy. */
export async function mnemonicToEntropy(words: string[]): Promise<string> {
  if (words.length !== 24) throw new Error('Mnemonic must be 24 words');

  const wordIndex = new Map<string, number>(
    (WORDLIST as readonly string[]).map((w, i) => [w, i])
  );

  // Convert words to 264 bits
  const bits: number[] = [];
  for (const word of words) {
    const idx = wordIndex.get(word.toLowerCase().trim());
    if (idx === undefined) throw new Error(`Unknown word: "${word}"`);
    for (let i = 10; i >= 0; i--) bits.push((idx >> i) & 1);
  }

  // First 256 bits = entropy, last 8 = checksum
  const entropyBytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i * 8 + j];
    entropyBytes[i] = byte;
  }

  const checksumBits = bits.slice(256, 264);
  let checksumByte = 0;
  for (const bit of checksumBits) checksumByte = (checksumByte << 1) | bit;

  // Verify checksum
  const hashBuffer = await crypto.subtle.digest('SHA-256', entropyBytes);
  const expectedChecksum = new Uint8Array(hashBuffer)[0];
  if (checksumByte !== expectedChecksum) {
    throw new Error('Invalid mnemonic: checksum mismatch');
  }

  return Array.from(entropyBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToUint8Array(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error('Invalid hex string');
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}
