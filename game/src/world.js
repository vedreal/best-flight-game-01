// Skylark Valley — the valley itself.
// One clear job: given a mission seed, build the terrain, the river, the
// airfield, the trees, the buildings, the clouds and the ring course, and
// answer "how high is the ground here?" for the flight model and renderer.

import { WORLD, RUNWAY, PALETTE } from './config.js';
import { makeFbm, mulberry32, clamp, smoothstep, lerp } from './random.js';

// The river winds north to south, east of the airfield.
export function riverCentreX(z) {
  return 1250 + 520 * Math.sin(z * 0.0009) + 260 * Math.sin(z * 0.0021 + 1.7);
}

export function riverDistance(x, z) {
  return Math.abs(x - riverCentreX(z));
}

export function isWater(x, z) {
  return riverDistance(x, z) < WORLD.riverHalfWidth;
}

export function onRunway(x, z) {
  const halfLen = RUNWAY.length / 2;
  const halfWid = RUNWAY.width / 2;
  return Math.abs(x) <= halfLen && Math.abs(z) <= halfWid;
}

// Flat apron around the runway so the airfield reads as built, not grown.
function airfieldBlend(x, z) {
  const d = Math.sqrt(x * x + z * z);
  return 1 - smoothstep(500, 1100, d);
}

export function createWorld(seed) {
  const fbm = makeFbm(seed);
  const rand = mulberry32(seed * 7 + 5);

  function baseHeight(x, z) {
    // Gentle rolling valley floor with a little detail, plus a high ridge to
    // the east. The floor never drops far below the river, so a low gate
    // still reads as low flying and never as flying underground.
    let h = 30 + fbm(x * 0.00045, z * 0.00045) * 45;
    h += fbm(x * 0.0021 + 40, z * 0.0021 + 40) * 10;
    const ridge = smoothstep(1400, 2900, x) * (380 + fbm(x * 0.001, z * 0.001 + 9) * 220);
    h += ridge;
    // The river carves a shallow channel through the valley floor, and the
    // water itself sits low so the river reads as water, not grass.
    const rd = riverDistance(x, z);
    h -= (1 - smoothstep(40, 260, rd)) * 34;
    if (rd < WORLD.riverHalfWidth) h = Math.min(h, 2);
    h = Math.max(h, -8);
    // The airfield is flat ground.
    let flat = airfieldBlend(x, z);
    // The approach corridor west of the runway is flat too, so a landing
    // never has to climb over a hill on final.
    const corridor = (1 - smoothstep(100, 260, Math.abs(z)))
      * smoothstep(-1700, -1200, x) * (1 - smoothstep(500, 900, x));
    flat = Math.max(flat, corridor);
    return lerp(h, 0, flat);
  }

  function terrainHeight(x, z) {
    return baseHeight(x, z);
  }

  // Precompute the terrain grid the renderer walks, with a colour per cell.
  const step = WORLD.cell;
  const half = WORLD.extent;
  const count = Math.floor((half * 2) / step) + 1;
  const heights = new Float32Array(count * count);
  const cellColour = new Array(count * count);
  const fieldRand = mulberry32(seed * 13 + 2);
  const fieldPick = new Uint8Array(count * count);
  for (let i = 0; i < fieldPick.length; i++) fieldPick[i] = Math.floor(fieldRand() * 6);
  for (let iz = 0; iz < count; iz++) {
    for (let ix = 0; ix < count; ix++) {
      const x = -half + ix * step;
      const z = -half + iz * step;
      const h = terrainHeight(x, z);
      heights[iz * count + ix] = h;
      cellColour[iz * count + ix] = pickCellColour(x, z, h, fieldPick[iz * count + ix]);
    }
  }

  function pickCellColour(x, z, h, field) {
    if (isWater(x, z) && h < 6) return '#8a7a4a'; // riverbank reeds under the ribbon
    // The runway itself is a ribbon drawn over the grid (below), so the
    // ground under it stays grass: a 120-metre grid cell cannot draw a
    // 30-metre strip without making it four times too wide.
    if (h > 420) return PALETTE.rockHigh;
    if (h > 300) return PALETTE.rock;
    if (h < 8 && riverDistance(x, z) < 300) return '#7a8a4a'; // riverbank reeds
    const shade = 0.92 + 0.16 * fieldRand();
    return shadeColour(PALETTE.field[field], shade);
  }

  // Trees: scattered where the ground is low and dry, never on the runway.
  const trees = [];
  let guard = 0;
  while (trees.length < WORLD.treeCount && guard < WORLD.treeCount * 40) {
    guard++;
    const x = (rand() - 0.5) * 2 * (half - 200);
    const z = (rand() - 0.5) * 2 * (half - 200);
    const h = terrainHeight(x, z);
    if (h > 260 || h < 4) continue;
    if (isWater(x, z)) continue;
    if (onRunway(x, z) || Math.abs(z) < 60 && Math.abs(x) < 600) continue;
    trees.push({ x, z, y: h, size: 14 + rand() * 16, hue: rand() });
  }

  // Buildings: hangars and a tower by the runway, farmhouses out in the fields.
  const buildings = [];
  const spots = [
    { x: -180, z: 120, w: 60, d: 40, h: 22, kind: 'hangar' },
    { x: -260, z: -90, w: 52, d: 36, h: 20, kind: 'hangar' },
    { x: 60, z: 150, w: 26, d: 26, h: 46, kind: 'tower' },
    { x: 700, z: -700, w: 24, d: 18, h: 12, kind: 'farm' },
    { x: -900, z: 800, w: 26, d: 20, h: 12, kind: 'farm' },
    { x: 1500, z: 500, w: 22, d: 18, h: 11, kind: 'farm' },
    { x: -1400, z: -1100, w: 24, d: 18, h: 12, kind: 'farm' },
    { x: 300, z: -1300, w: 22, d: 18, h: 11, kind: 'farm' },
    { x: 2100, z: -600, w: 26, d: 20, h: 12, kind: 'farm' },
  ];
  for (const s of spots) {
    buildings.push({ ...s, y: terrainHeight(s.x, s.z), rot: rand() * Math.PI });
  }

  // Clouds drift high over the valley.
  const clouds = [];
  for (let i = 0; i < WORLD.cloudCount; i++) {
    clouds.push({
      x: (rand() - 0.5) * 2 * half,
      z: (rand() - 0.5) * 2 * half,
      y: 700 + rand() * 320,
      r: 90 + rand() * 160,
      a: 0.5 + rand() * 0.35,
    });
  }

  // The ring course: a wandering line out from the airfield and back, so the
  // pilot has to turn, climb and descend instead of flying straight. The
  // river mission is different: its gates follow the river itself.
  function buildRings(mission) {
    const r = mulberry32(seed * 31 + mission.ringCount);
    if (mission.id === 'river-run') {
      const rings = [];
      for (let i = 0; i < mission.ringCount; i++) {
        const z = -1600 + i * 800;
        const x = riverCentreX(z) + (r() - 0.5) * 60;
        const nextZ = z + 800;
        const nextX = riverCentreX(nextZ);
        const heading = Math.atan2(nextX - x, -(nextZ - z));
        rings.push({
          x,
          z,
          y: terrainHeight(x, z) + 62 + r() * 28,
          radius: 18,
          heading,
          passed: false,
          low: true,
        });
      }
      return rings;
    }
    const rings = [];
    let angle = -Math.PI / 2 + (r() - 0.5) * 0.6; // start roughly north
    let dist = 700;
    let x = 0;
    let z = 0;
    for (let i = 0; i < mission.ringCount; i++) {
      const turn = (r() - 0.5) * 1.5;
      angle += turn;
      dist = 650 + r() * 550;
      x += Math.sin(angle) * dist;
      z += -Math.cos(angle) * dist;
      // Keep the course inside the valley and out of the ridge.
      x = clamp(x, -2400, 1800);
      z = clamp(z, -2400, 2400);
      const alt = mission.ringAltMin + r() * (mission.ringAltMax - mission.ringAltMin);
      rings.push({
        x,
        z,
        // A ring the hills swallow is a ring nobody can fly, so it sits at
        // least 50 metres clear of the ground beneath it.
        y: Math.max(alt, terrainHeight(x, z) + 50),
        radius: 18,
        heading: angle,
        passed: false,
        low: mission.id === 'river-run',
      });
    }
    return rings;
  }

  return {
    seed,
    terrainHeight,
    heights,
    cellColour,
    count,
    step,
    half,
    trees,
    buildings,
    clouds,
    buildRings,
  };
}

// A colour string like "#6da24a" lightened or darkened by a factor.
export function shadeColour(hex, factor) {
  const r = Math.min(255, Math.round(parseInt(hex.slice(1, 3), 16) * factor));
  const g = Math.min(255, Math.round(parseInt(hex.slice(3, 5), 16) * factor));
  const b = Math.min(255, Math.round(parseInt(hex.slice(5, 7), 16) * factor));
  return `rgb(${r},${g},${b})`;
}
