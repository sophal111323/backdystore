/**
 * Edge-safe HMAC-SHA256 JWT Verifier
 *
 * Implements pure JavaScript SHA-256 and HMAC-SHA256 with zero dependencies.
 * Does not rely on crypto.subtle or Node.js native crypto, making it 100% reliable
 * across Next.js Edge runtime, Node.js, and standalone/embedded environments.
 */

function rightRotate(value: number, amount: number): number {
  return (value >>> amount) | (value << (32 - amount));
}

function sha256(data: Uint8Array): Uint8Array {
  const hash: number[] = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];

  const k: number[] = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  const composite: number[] = Array.from(data);
  const bitLength = composite.length * 8;
  composite.push(0x80);
  while (composite.length % 64 !== 56) {
    composite.push(0);
  }

  for (let i = 0; i < 4; i++) composite.push((0 >>> (i * 8)) & 0xff);
  for (let i = 3; i >= 0; i--) composite.push((bitLength >>> (i * 8)) & 0xff);

  const blockCount = composite.length / 64;
  for (let i = 0; i < blockCount; i++) {
    const w = new Uint32Array(64);
    for (let j = 0; j < 16; j++) {
      w[j] =
        (composite[i * 64 + j * 4] << 24) |
        (composite[i * 64 + j * 4 + 1] << 16) |
        (composite[i * 64 + j * 4 + 2] << 8) |
        composite[i * 64 + j * 4 + 3];
    }
    for (let j = 16; j < 64; j++) {
      const s0 = rightRotate(w[j - 15], 7) ^ rightRotate(w[j - 15], 18) ^ (w[j - 15] >>> 3);
      const s1 = rightRotate(w[j - 2], 17) ^ rightRotate(w[j - 2], 19) ^ (w[j - 2] >>> 10);
      w[j] = (w[j - 16] + s0 + w[j - 7] + s1) | 0;
    }

    let a = hash[0], b = hash[1], c = hash[2], d = hash[3];
    let e = hash[4], f = hash[5], g = hash[6], h = hash[7];

    for (let j = 0; j < 64; j++) {
      const S1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + k[j] + w[j]) | 0;
      const S0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) | 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }

    hash[0] = (hash[0] + a) | 0;
    hash[1] = (hash[1] + b) | 0;
    hash[2] = (hash[2] + c) | 0;
    hash[3] = (hash[3] + d) | 0;
    hash[4] = (hash[4] + e) | 0;
    hash[5] = (hash[5] + f) | 0;
    hash[6] = (hash[6] + g) | 0;
    hash[7] = (hash[7] + h) | 0;
  }

  const out = new Uint8Array(32);
  for (let i = 0; i < 8; i++) {
    out[i * 4] = (hash[i] >>> 24) & 0xff;
    out[i * 4 + 1] = (hash[i] >>> 16) & 0xff;
    out[i * 4 + 2] = (hash[i] >>> 8) & 0xff;
    out[i * 4 + 3] = hash[i] & 0xff;
  }
  return out;
}

function hmacSha256(keyBytes: Uint8Array, messageBytes: Uint8Array): Uint8Array {
  const blockSize = 64;
  let key = keyBytes;
  if (key.length > blockSize) {
    key = sha256(key);
  }
  if (key.length < blockSize) {
    const padded = new Uint8Array(blockSize);
    padded.set(key);
    key = padded;
  }

  const oKeyPad = new Uint8Array(blockSize);
  const iKeyPad = new Uint8Array(blockSize);
  for (let i = 0; i < blockSize; i++) {
    oKeyPad[i] = key[i] ^ 0x5c;
    iKeyPad[i] = key[i] ^ 0x36;
  }

  const inner = new Uint8Array(blockSize + messageBytes.length);
  inner.set(iKeyPad);
  inner.set(messageBytes, blockSize);
  const innerHash = sha256(inner);

  const outer = new Uint8Array(blockSize + 32);
  outer.set(oKeyPad);
  outer.set(innerHash, blockSize);
  return sha256(outer);
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

/**
 * Verifies an HMAC-SHA256 (HS256) JWT string against the secret.
 * Checks structure, expiration ('exp'), and cryptographic signature.
 */
export function verifyAdminJwt(token?: string, secret?: string): boolean {
  if (!token || !secret) return false;

  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;
    const [headerB64, payloadB64, sigB64] = parts;

    // Check payload exp
    const payloadStr = base64UrlDecode(payloadB64);
    const payload = JSON.parse(payloadStr);
    if (payload.exp && typeof payload.exp === "number") {
      if (payload.exp < Date.now() / 1000) {
        return false; // Expired
      }
    }

    const keyBytes = new TextEncoder().encode(secret);
    const msgBytes = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    const expectedSig = base64UrlEncode(hmacSha256(keyBytes, msgBytes));

    return expectedSig === sigB64;
  } catch {
    return false;
  }
}

