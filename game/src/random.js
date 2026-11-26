// Skylark Valley — seeded randomness.
// One clear job: every random choice in the valley comes from a seed, so the
// same mission always builds the same valley, the same trees and the same
// rings, and a screenshot can be taken twice and match.

// Mulberry32: small, fast, and good enough for a valley.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Smooth 2D value noise on a lattice, built from one seeded stream.
export function makeNoise2D(seed) {
  const rand = mulberry32(seed);
  const size = 64;
  const grid = new Float32Array(size * size);
  for (let i = 0; i < grid.length; i++) grid[i] = rand();
  const fade = (t) => t * t * (3 - 2 * t);
  function lattice(ix, iz) {
    const x = ((ix % size) + size) % size;
    const z = ((iz % size) + size) % size;
    return grid[z * size + x];
  }
  return function noise(x, z) {
    const ix = Math.floor(x);
    const iz = Math.floor(z);
    const fx = x - ix;
    const fz = z - iz;
    const a = lattice(ix, iz);
    const b = lattice(ix + 1, iz);
    const c = lattice(ix, iz + 1);
    const d = lattice(ix + 1, iz + 1);
    const u = fade(fx);
    const v = fade(fz);
    return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1;
  };
}

// Fractal noise: a few octaves of the base noise, for hills with detail.
export function makeFbm(seed) {
  const n1 = makeNoise2D(seed);
  const n2 = makeNoise2D(seed + 101);
  const n3 = makeNoise2D(seed + 202);
  return function fbm(x, z) {
    return n1(x, z) * 0.55 + n2(x * 2.7, z * 2.7) * 0.3 + n3(x * 7.1, z * 7.1) * 0.15;
  };
}

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

// Smallest signed turn from angle `from` to angle `to`, in radians.
export function angleDelta(from, to) {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function degToRad(d) {
  return (d * Math.PI) / 180;
}

export function radToDeg(r) {
  return (r * 180) / Math.PI;
}
