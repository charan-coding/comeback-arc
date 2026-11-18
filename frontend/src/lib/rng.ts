/** Tiny deterministic PRNG (mulberry32) and a string seed hash, shared by demoData.ts, combat.ts, and autobattle.ts. */
export function mulberry32(seed: number): () => number {
  let s = seed;
  return function next() {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic 32-bit hash of a string, for turning e.g. "2026-02-01:p1" into a PRNG seed. */
export function seedFromString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (Math.imul(31, hash) + str.charCodeAt(i)) | 0;
  }
  return hash;
}

/** A PRNG that's stable for a given (date, key) pair — same "random" rolls on every reload of that day, different from day to day. */
export function dailyRng(date: string, key: string): () => number {
  return mulberry32(seedFromString(`${date}:${key}`));
}
