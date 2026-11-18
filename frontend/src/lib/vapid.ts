/**
 * Pure P-256 ECDSA + RFC 6979 deterministic-nonce implementation, used to build the
 * VAPID JWT (RFC 8292) that authenticates Web Push sends. This module exists ONLY to be
 * unit tested against RFC 6979's own published test vectors before its logic is ported,
 * near-verbatim, into backend/Code.gs (which has no native ECDSA — see the README).
 *
 * It is NOT imported by the browser app: it uses Node's `crypto` module and must never
 * end up in the Vite bundle. The real, browser-side subscribe flow lives in `push.ts`.
 */
import { createHash, createHmac } from 'node:crypto';

// NIST P-256 (secp256r1) domain parameters.
const P = BigInt('0xFFFFFFFF00000001000000000000000000000000FFFFFFFFFFFFFFFFFFFFFFFF');
const A = P - 3n;
const B = BigInt('0x5AC635D8AA3A93E7B3EBBD55769886BC651D06B0CC53B0F63BCE3C3E27D2604B');
const N = BigInt('0xFFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC632551');
const GX = BigInt('0x6B17D1F2E12C4247F8BCE6E563A440F277037D812DEB33A0F4A13945D898C296');
const GY = BigInt('0x4FE342E2FE1A7F9B8EE7EB4A7C0F9E162BCE33576B315ECECBB6406837BF51F5');

export interface AffinePoint {
  x: bigint;
  y: bigint;
}

export const G: AffinePoint = { x: GX, y: GY };
export const CURVE_ORDER = N;

function mod(a: bigint, m: bigint): bigint {
  const r = a % m;
  return r < 0n ? r + m : r;
}

function modInverse(a: bigint, m: bigint): bigint {
  let [old_r, r] = [mod(a, m), m];
  let [old_s, s] = [1n, 0n];
  while (r !== 0n) {
    const q = old_r / r;
    [old_r, r] = [r, old_r - q * r];
    [old_s, s] = [s, old_s - q * s];
  }
  return mod(old_s, m);
}

const INFINITY: AffinePoint = { x: -1n, y: -1n };
const isInfinity = (p: AffinePoint) => p.x === -1n && p.y === -1n;

function pointDouble(p: AffinePoint): AffinePoint {
  if (isInfinity(p) || p.y === 0n) return INFINITY;
  const lambda = mod((3n * p.x * p.x + A) * modInverse(2n * p.y, P), P);
  const x3 = mod(lambda * lambda - 2n * p.x, P);
  const y3 = mod(lambda * (p.x - x3) - p.y, P);
  return { x: x3, y: y3 };
}

function pointAdd(p1: AffinePoint, p2: AffinePoint): AffinePoint {
  if (isInfinity(p1)) return p2;
  if (isInfinity(p2)) return p1;
  if (p1.x === p2.x) {
    if (mod(p1.y + p2.y, P) === 0n) return INFINITY;
    return pointDouble(p1);
  }
  const lambda = mod((p2.y - p1.y) * modInverse(p2.x - p1.x, P), P);
  const x3 = mod(lambda * lambda - p1.x - p2.x, P);
  const y3 = mod(lambda * (p1.x - x3) - p1.y, P);
  return { x: x3, y: y3 };
}

export function scalarMultiply(k: bigint, point: AffinePoint): AffinePoint {
  let result = INFINITY;
  let addend = point;
  let n = k;
  while (n > 0n) {
    if (n & 1n) result = pointAdd(result, addend);
    addend = pointDouble(addend);
    n >>= 1n;
  }
  return result;
}

// --- byte/hex helpers -------------------------------------------------------------

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.length % 2 === 0 ? hex : `0${hex}`;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i += 1) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function bigIntToBytes(n: bigint, length: number): Uint8Array {
  const hex = n.toString(16).padStart(length * 2, '0');
  return hexToBytes(hex);
}

function bytesToBigInt(bytes: Uint8Array): bigint {
  return BigInt(`0x${bytesToHex(bytes)}` || '0x0');
}

export function sha256(data: Uint8Array): Uint8Array {
  return new Uint8Array(createHash('sha256').update(data).digest());
}

function hmacSha256(key: Uint8Array, data: Uint8Array): Uint8Array {
  return new Uint8Array(createHmac('sha256', Buffer.from(key)).update(Buffer.from(data)).digest());
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

/**
 * RFC 6979 deterministic k, specialized for the case qlen === hlen === 256 bits
 * (P-256 + SHA-256), which lets bits2octets/bits2int collapse to "interpret as a
 * 32-byte big-endian integer, reduced mod n once if needed."
 */
export function rfc6979Nonce(privateKey: bigint, hash: Uint8Array): bigint {
  let z1 = bytesToBigInt(hash);
  if (z1 >= N) z1 -= N;
  const int2octets = (x: bigint) => bigIntToBytes(mod(x, N), 32);
  const h1Octets = int2octets(z1);
  const xOctets = int2octets(privateKey);

  let V = new Uint8Array(32).fill(1);
  let K = new Uint8Array(32).fill(0);
  K = hmacSha256(K, concatBytes(V, Uint8Array.of(0x00), xOctets, h1Octets));
  V = hmacSha256(K, V);
  K = hmacSha256(K, concatBytes(V, Uint8Array.of(0x01), xOctets, h1Octets));
  V = hmacSha256(K, V);

  // eslint-disable-next-line no-constant-condition
  while (true) {
    V = hmacSha256(K, V);
    const k = bytesToBigInt(V);
    if (k >= 1n && k < N) return k;
    K = hmacSha256(K, concatBytes(V, Uint8Array.of(0x00)));
    V = hmacSha256(K, V);
  }
}

export interface Signature {
  r: bigint;
  s: bigint;
}

/** Deterministic ECDSA sign over P-256/SHA-256, per RFC 6979. `message` is hashed internally. */
export function ecdsaSignP256(privateKeyHex: string, message: Uint8Array): Signature {
  const x = BigInt(`0x${privateKeyHex}`);
  const hash = sha256(message);
  const k = rfc6979Nonce(x, hash);
  const R = scalarMultiply(k, G);
  const r = mod(R.x, N);
  const e = bytesToBigInt(hash);
  const kInv = modInverse(k, N);
  const s = mod(kInv * (e + r * x), N);
  return { r, s };
}

export function signatureToBytes(sig: Signature): Uint8Array {
  return concatBytes(bigIntToBytes(sig.r, 32), bigIntToBytes(sig.s, 32));
}

export function privateKeyToPublicPoint(privateKeyHex: string): AffinePoint {
  return scalarMultiply(BigInt(`0x${privateKeyHex}`), G);
}

/** Uncompressed SEC1 public key encoding: 0x04 || X(32) || Y(32). */
export function publicPointToBytes(point: AffinePoint): Uint8Array {
  return concatBytes(Uint8Array.of(0x04), bigIntToBytes(point.x, 32), bigIntToBytes(point.y, 32));
}

// --- base64url + JWT ---------------------------------------------------------------

export function base64url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function buildVapidJwt(privateKeyHex: string, audience: string, subject: string, expirySeconds = 12 * 60 * 60): string {
  const header = { typ: 'JWT', alg: 'ES256' };
  const payload = { aud: audience, exp: Math.floor(Date.now() / 1000) + expirySeconds, sub: subject };
  const encoder = new TextEncoder();
  const signingInput = `${base64url(encoder.encode(JSON.stringify(header)))}.${base64url(encoder.encode(JSON.stringify(payload)))}`;
  const sig = ecdsaSignP256(privateKeyHex, encoder.encode(signingInput));
  return `${signingInput}.${base64url(signatureToBytes(sig))}`;
}
