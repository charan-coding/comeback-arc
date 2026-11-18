import { describe, it, expect } from 'vitest';
import { rfc6979Nonce, ecdsaSignP256, sha256, bytesToHex, buildVapidJwt, privateKeyToPublicPoint, publicPointToBytes, base64url } from '../vapid';

// RFC 6979 Appendix A.2.5 ("ECDSA, 256 Bits (Prime Field)", curve NIST P-256).
// These are the RFC's own published worked examples for deterministic ECDSA.
const PRIVATE_KEY_HEX = 'C9AFA9D845BA75166B5C215767B1D6934E50C3DB36E89B127B8A622B120F6721';
const PRIVATE_KEY = BigInt(`0x${PRIVATE_KEY_HEX}`);

const VECTORS = [
  {
    message: 'sample',
    k: 'A6E3C57DD01ABE90086538398355DD4C3B17AA873382B0F24D6129493D8AAD60',
    r: 'EFD48B2AACB6A8FD1140DD9CD45E81D69D2C877B56AAF991C34D0EA84EAF3716',
    s: 'F7CB1C942D657C41D436C7A1B6E29F65F3E900DBB9AFF4064DC4AB2F843ACDA8',
  },
  {
    message: 'test',
    k: 'D16B6AE827F17175E040871A1C7EC3500192C4C92677336EC2537ACAEE0008E0',
    r: 'F1ABB023518351CD71D881567B1EA663ED3EFCF6C5132B354F28D3B0B7D38367',
    s: '019F4113742A2B14BD25926B49C649155F267E60D3814B4C0CC84250E46F0083',
  },
];

describe('RFC 6979 deterministic k (P-256 / SHA-256)', () => {
  for (const v of VECTORS) {
    it(`matches the published vector for message "${v.message}"`, () => {
      const hash = sha256(new TextEncoder().encode(v.message));
      const k = rfc6979Nonce(PRIVATE_KEY, hash);
      expect(k.toString(16).toUpperCase().padStart(64, '0')).toBe(v.k);
    });
  }
});

describe('ECDSA sign over P-256/SHA-256', () => {
  for (const v of VECTORS) {
    it(`reproduces r and s for message "${v.message}"`, () => {
      const sig = ecdsaSignP256(PRIVATE_KEY_HEX, new TextEncoder().encode(v.message));
      expect(sig.r.toString(16).toUpperCase().padStart(64, '0')).toBe(v.r);
      expect(sig.s.toString(16).toUpperCase().padStart(64, '0')).toBe(v.s);
    });
  }
});

describe('buildVapidJwt', () => {
  it('produces a well-formed ES256 JWS and a 65-byte uncompressed public key', () => {
    const jwt = buildVapidJwt(PRIVATE_KEY_HEX, 'https://fcm.googleapis.com', 'mailto:test@example.com');
    const parts = jwt.split('.');
    expect(parts).toHaveLength(3);
    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    expect(header).toEqual({ typ: 'JWT', alg: 'ES256' });
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    expect(payload.aud).toBe('https://fcm.googleapis.com');
    expect(payload.sub).toBe('mailto:test@example.com');
    const sigBytes = Buffer.from(parts[2], 'base64url');
    expect(sigBytes.length).toBe(64); // raw r(32) || s(32), not DER

    const pubBytes = publicPointToBytes(privateKeyToPublicPoint(PRIVATE_KEY_HEX));
    expect(pubBytes.length).toBe(65);
    expect(pubBytes[0]).toBe(0x04); // uncompressed SEC1 point marker
    expect(base64url(pubBytes).length).toBeGreaterThan(0);
  });
});

describe('sha256', () => {
  it('matches the known SHA-256 digest of "abc"', () => {
    expect(bytesToHex(sha256(new TextEncoder().encode('abc')))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    );
  });
});
