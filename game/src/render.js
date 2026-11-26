// Skylark Valley — the renderer, part one: the world.
// One clear job: turn the valley, the aeroplane's position and the rings into
// a chase-view picture — sky, mountains, clouds, terrain, runway, trees,
// buildings and rings, all projected from the camera behind the aeroplane.

import { VIEW, PALETTE, RUNWAY, WORLD } from './config.js';
import { clamp, degToRad, makeNoise2D } from './random.js';
import { riverCentreX } from './world.js';

const ridgeNoise1 = makeNoise2D(501);
const ridgeNoise2 = makeNoise2D(902);

// The camera sits behind and above the aeroplane and looks where it is going,
// rolling with the bank so the horizon tilts like it does from a real cockpit.
export function makeCamera(plane) {
  const heading = plane.heading;
  const fx = Math.sin(heading);
  const fz = -Math.cos(heading);
  const pos = {
    x: plane.x - fx * 16,
    y: plane.y + 4.2,
    z: plane.z - fz * 16,
  };
  const look = {
    x: plane.x + fx * 50,
    y: plane.y + 1 + plane.pitch * 26,
    z: plane.z + fz * 50,
  };
  let fwd = norm3(look.x - pos.x, look.y - pos.y, look.z - pos.z);
  // Level the camera's right vector, then roll it with the aeroplane.
  const r0 = cross(fwd, { x: 0, y: 1, z: 0 });
  let right = norm3(r0.x, r0.y, r0.z);
  let up = cross(right, fwd);
  const roll = plane.roll * 0.55;
  const cosR = Math.cos(roll);
  const sinR = Math.sin(roll);
  const r2 = {
    x: right.x * cosR + up.x * sinR,
    y: right.y * cosR + up.y * sinR,
    z: right.z * cosR + up.z * sinR,
  };
  const u2 = {
    x: up.x * cosR - right.x * sinR,
    y: up.y * cosR - right.y * sinR,
    z: up.z * cosR - right.z * sinR,
  };
  const focal = (VIEW.height / 2) / Math.tan(degToRad(VIEW.fov / 2));
  return { pos, fwd, right: r2, up: u2, focal };
}

function norm3(x, y, z) {
  const l = Math.hypot(x, y, z) || 1;
  return { x: x / l, y: y / l, z: z / l };
}

function cross(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

// Project a world point to the screen. Null when it is behind the camera.
export function project(cam, x, y, z) {
  const dx = x - cam.pos.x;
  const dy = y - cam.pos.y;
  const dz = z - cam.pos.z;
  const cz = dx * cam.fwd.x + dy * cam.fwd.y + dz * cam.fwd.z;
  if (cz < 0.6) return null;
  const cx = dx * cam.right.x + dy * cam.right.y + dz * cam.right.z;
  const cy = dx * cam.up.x + dy * cam.up.y + dz * cam.up.z;
  return {
    x: VIEW.width / 2 + (cx * cam.focal) / cz,
    y: VIEW.height / 2 - (cy * cam.focal) / cz,
    depth: cz,
    scale: cam.focal / cz,
  };
}

function drawSky(ctx, cam, plane, time) {
  const g = ctx.createLinearGradient(0, 0, 0, VIEW.height);
  g.addColorStop(0, PALETTE.skyTop);
  g.addColorStop(0.55, PALETTE.skyMid);
  g.addColorStop(0.78, PALETTE.skyHorizon);
  g.addColorStop(1, '#c8d8c2');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);

  // The sun hangs north-west, low enough to warm the horizon.
  const sunDir = norm3(-0.62, 0.42, -0.66);
  const sd = {
    x: sunDir.x * cam.right.x + sunDir.y * cam.right.y + sunDir.z * cam.right.z,
    y: sunDir.x * cam.up.x + sunDir.y * cam.up.y + sunDir.z * cam.up.z,
    z: sunDir.x * cam.fwd.x + sunDir.y * cam.fwd.y + sunDir.z * cam.fwd.z,
  };
  if (sd.z > 0.05) {
    const sx = VIEW.width / 2 + (sd.x * cam.focal) / sd.z;
    const sy = VIEW.height / 2 - (sd.y * cam.focal) / sd.z;
    const glow = ctx.createRadialGradient(sx, sy, 4, sx, sy, 150);
    glow.addColorStop(0, PALETTE.sunGlow);
    glow.addColorStop(1, 'rgba(255, 214, 120, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sx - 160, sy - 160, 320, 320);
    ctx.fillStyle = PALETTE.sunCore;
    ctx.beginPath();
    ctx.arc(sx, sy, 26, 0, Math.PI * 2);
    ctx.fill();
  }
}

// The horizon line on screen, from the camera's forward direction.
function horizonY(cam) {
  const p = project(cam, cam.pos.x + cam.fwd.x * 9000, cam.pos.y, cam.pos.z + cam.fwd.z * 9000);
  return p ? p.y : VIEW.height * 0.45;
}

function drawMountains(ctx, cam, plane) {
  const hy = horizonY(cam);
  const halfFov = degToRad(VIEW.fov / 2) * 1.35;
  const layers = [
    { noise: ridgeNoise1, amp: 300, base: 60, color: PALETTE.mountainFar, dist: 9000 },
    { noise: ridgeNoise2, amp: 220, base: 40, color: PALETTE.mountainNear, dist: 3800 },
  ];
  for (const layer of layers) {
    const top = layer.base + layer.amp * 0.72;
    ctx.fillStyle = layer.color;
    ctx.beginPath();
    ctx.moveTo(-20, hy + 60);
    const steps = 72;
    const ridgeY = [];
    for (let i = 0; i <= steps; i++) {
      const off = -halfFov + (2 * halfFov * i) / steps;
      const az = plane.heading + off;
      const h = layer.base + (layer.noise(az * 4.0, 0) * 0.5 + 0.5) * layer.amp
        + (layer.noise(az * 11.0, 3) * 0.5 + 0.5) * layer.amp * 0.35;
      const sx = VIEW.width / 2 + Math.tan(off) * cam.focal;
      const sy = hy - (h * cam.focal) / layer.dist;
      ridgeY.push({ sx, sy, h });
      ctx.lineTo(sx, sy);
    }
    ctx.lineTo(VIEW.width + 20, hy + 60);
    ctx.closePath();
    ctx.fill();
    // Snow caps only the high tops: a band between the ridge line and the
    // snow line, never a wash over the whole slope.
    const snowLineY = hy - (top * cam.focal) / layer.dist;
    ctx.fillStyle = PALETTE.snow;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.moveTo(-20, snowLineY);
    for (const pt of ridgeY) {
      ctx.lineTo(pt.sx, Math.min(pt.sy, snowLineY));
    }
    ctx.lineTo(VIEW.width + 20, snowLineY);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function drawClouds(ctx, cam, world, time) {
  for (const c of world.clouds) {
    const drift = time * 2;
    const p = project(cam, c.x + drift, c.y, c.z);
    if (!p || p.depth > 6000) continue;
    const r = c.r * p.scale;
    if (r < 6) continue;
    ctx.fillStyle = `rgba(255,255,255,${c.a})`;
    for (const [ox, oy, s] of [[-0.5, 0.1, 0.7], [0, -0.15, 1], [0.55, 0.08, 0.75], [0.1, 0.18, 0.8]]) {
      ctx.beginPath();
      ctx.ellipse(p.x + ox * r, p.y + oy * r, r * s, r * s * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// The terrain: a grid of quads, painter-sorted far to near, plus runway
// markings laid over the strip.
function drawTerrain(ctx, cam, world, plane, time) {
  const { heights, cellColour, count, step, half } = world;
  const camX = cam.pos.x;
  const camZ = cam.pos.z;
  const quads = [];
  const range = Math.ceil(WORLD.viewDistance / step);
  const ccx = Math.round((camX + half) / step);
  const ccz = Math.round((camZ + half) / step);
  const minIx = Math.max(0, ccx - range);
  const maxIx = Math.min(count - 2, ccx + range);
  const minIz = Math.max(0, ccz - range);
  const maxIz = Math.min(count - 2, ccz + range);

  for (let iz = minIz; iz <= maxIz; iz++) {
    for (let ix = minIx; ix <= maxIx; ix++) {
      const x0 = -half + ix * step;
      const z0 = -half + iz * step;
      const cx = x0 + step / 2;
      const cz = z0 + step / 2;
      const dx = cx - camX;
      const dz = cz - camZ;
      const distSq = dx * dx + dz * dz;
      if (distSq > WORLD.viewDistance * WORLD.viewDistance) continue;
      // Behind the camera? A cell whose centre is behind the view direction
      // cannot be seen; skip it before projecting its corners.
      const fwdDot = dx * cam.fwd.x + dz * cam.fwd.z;
      if (fwdDot < -step) continue;
      const h00 = heights[iz * count + ix];
      const h10 = heights[iz * count + ix + 1];
      const h01 = heights[(iz + 1) * count + ix];
      const h11 = heights[(iz + 1) * count + ix + 1];
      const p00 = project(cam, x0, h00, z0);
      const p10 = project(cam, x0 + step, h10, z0);
      const p01 = project(cam, x0, h01, z0 + step);
      const p11 = project(cam, x0 + step, h11, z0 + step);
      if (!p00 && !p10 && !p01 && !p11) continue;
      const pts = [p00, p10, p11, p01].filter(Boolean);
      if (pts.length < 3) continue;
      const depth = pts.reduce((s, p) => s + p.depth, 0) / pts.length;
      let colour = cellColour[iz * count + ix];
      // Water shimmers with the clock.
      if (colour === PALETTE.water) {
        const shimmer = 0.9 + 0.1 * Math.sin(time * 1.4 + ix * 0.7 + iz * 0.9);
        colour = `rgb(${Math.round(63 * shimmer)},${Math.round(143 * shimmer)},${Math.round(210 * shimmer)})`;
      }
      quads.push({ pts, colour, depth });
    }
  }

  // The runway ribbon and its markings are drawn as an overlay after the
  // sorted terrain: the strip is a smooth 30 metres over the grid, so the
  // runway reads as a runway instead of a 120-metre grid cell, and the
  // markings stay visible on top of it. The airfield is flat, so nothing
  // in front of the strip can hide it.
  const runwayQuads = [];
  const rwyY = 0.35;
  for (let x = -RUNWAY.length / 2; x < RUNWAY.length / 2; x += 30) {
    const a = project(cam, x, rwyY, -RUNWAY.width / 2);
    const b = project(cam, x + 30, rwyY, -RUNWAY.width / 2);
    const c = project(cam, x + 30, rwyY, RUNWAY.width / 2);
    const d = project(cam, x, rwyY, RUNWAY.width / 2);
    if (!a || !b || !c || !d) continue;
    const depth = (a.depth + b.depth + c.depth + d.depth) / 4;
    if (depth > WORLD.viewDistance) continue;
    runwayQuads.push({ pts: [a, b, c, d], colour: PALETTE.runway, depth });
  }
  for (const m of runwayMarkings(cam)) runwayQuads.push(m);

  // The river ribbon: a smooth winding strip of water over the channel, so
  // the river reads as a river instead of blue grid squares.
  const waterY = 3;
  for (let z = -WORLD.extent; z < WORLD.extent; z += 120) {
    const cx0 = riverCentreX(z);
    const cx1 = riverCentreX(z + 120);
    const a = project(cam, cx0 - WORLD.riverHalfWidth, waterY, z);
    const b = project(cam, cx0 + WORLD.riverHalfWidth, waterY, z);
    const c = project(cam, cx1 + WORLD.riverHalfWidth, waterY, z + 120);
    const d = project(cam, cx1 - WORLD.riverHalfWidth, waterY, z + 120);
    if (!a || !b || !c || !d) continue;
    const depth = (a.depth + b.depth + c.depth + d.depth) / 4;
    if (depth > WORLD.viewDistance) continue;
    quads.push({ pts: [a, b, c, d], colour: PALETTE.water, depth });
  }

  quads.sort((a, b) => b.depth - a.depth);
  for (const q of quads) {
    if (q.circle) {
      ctx.fillStyle = q.colour;
      ctx.beginPath();
      ctx.arc(q.circle.x, q.circle.y, q.circle.r, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    ctx.fillStyle = q.colour;
    ctx.beginPath();
    ctx.moveTo(q.pts[0].x, q.pts[0].y);
    for (let i = 1; i < q.pts.length; i++) ctx.lineTo(q.pts[i].x, q.pts[i].y);
    ctx.closePath();
    ctx.fill();
  }
  // Runway overlay: the strip first, far to near, then the markings on top
  // of it, far to near — so a dash is never hidden by the strip beneath it.
  runwayQuads.sort((a, b) => {
    const aMark = a.colour === PALETTE.runway ? 0 : 1;
    const bMark = b.colour === PALETTE.runway ? 0 : 1;
    return aMark - bMark || b.depth - a.depth;
  });
  for (const q of runwayQuads) {
    if (q.circle) {
      ctx.fillStyle = q.colour;
      ctx.beginPath();
      ctx.arc(q.circle.x, q.circle.y, q.circle.r, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    ctx.fillStyle = q.colour;
    ctx.beginPath();
    ctx.moveTo(q.pts[0].x, q.pts[0].y);
    for (let i = 1; i < q.pts.length; i++) ctx.lineTo(q.pts[i].x, q.pts[i].y);
    ctx.closePath();
    ctx.fill();
  }
}

function runwayMarkings(cam) {
  const out = [];
  const y = 0.35;
  const halfLen = RUNWAY.length / 2;
  // Centreline dashes.
  for (let x = -halfLen + 30; x < halfLen - 30; x += 70) {
    const a = project(cam, x, y, -1.5);
    const b = project(cam, x + 40, y, -1.5);
    const c = project(cam, x + 40, y, 1.5);
    const d = project(cam, x, y, 1.5);
    if (a && b && c && d) {
      out.push({ pts: [a, b, c, d], colour: PALETTE.runwayEdge, depth: (a.depth + b.depth + c.depth + d.depth) / 4 });
    }
  }
  // Threshold chevrons at the west end.
  for (let i = -2; i <= 2; i++) {
    const z = i * 5;
    const a = project(cam, -halfLen + 8, y, z - 1.6);
    const b = project(cam, -halfLen + 26, y, z);
    const c = project(cam, -halfLen + 8, y, z + 1.6);
    if (a && b && c) {
      out.push({ pts: [a, b, c], colour: PALETTE.runwayEdge, depth: (a.depth + b.depth + c.depth) / 3 });
    }
  }
  // Edge lights: amber dots down both sides.
  for (let x = -halfLen; x <= halfLen; x += 90) {
    for (const z of [-RUNWAY.width / 2, RUNWAY.width / 2]) {
      const p = project(cam, x, y + 0.6, z);
      if (p && p.depth < 2600) {
        const r = Math.max(1.5, 260 / p.depth);
        out.push({ pts: null, circle: { x: p.x, y: p.y, r }, colour: '#ffc233', depth: p.depth });
      }
    }
  }
  return out;
}

// Trees, buildings and rings all sort by depth together, after the terrain.
function drawBillboards(ctx, cam, world, flight, time) {
  const items = [];
  for (const t of world.trees) {
    const dx = t.x - cam.pos.x;
    const dz = t.z - cam.pos.z;
    if (dx * dx + dz * dz > 2200 * 2200) continue;
    const p = project(cam, t.x, t.y, t.z);
    if (!p) continue;
    items.push({ kind: 'tree', p, t, depth: p.depth });
  }
  for (const b of world.buildings) {
    const p = project(cam, b.x, b.y, b.z);
    if (!p) continue;
    items.push({ kind: 'building', p, b, depth: p.depth });
  }
  items.sort((a, b) => b.depth - a.depth);
  for (const it of items) {
    if (it.kind === 'tree') drawTree(ctx, it.p, it.t);
    else drawBuilding(ctx, cam, it.b);
  }
}

function drawTree(ctx, p, t) {
  const h = t.size * p.scale;
  if (h < 2) return;
  const x = p.x;
  const baseY = p.y;
  ctx.strokeStyle = '#5a3d24';
  ctx.lineWidth = Math.max(1, h * 0.07);
  ctx.beginPath();
  ctx.moveTo(x, baseY);
  ctx.lineTo(x, baseY - h * 0.35);
  ctx.stroke();
  const green = t.hue > 0.5 ? '#2f6b2a' : '#3f7d33';
  const light = '#5da24a';
  ctx.fillStyle = green;
  ctx.beginPath();
  ctx.moveTo(x, baseY - h);
  ctx.lineTo(x - h * 0.42, baseY - h * 0.28);
  ctx.lineTo(x + h * 0.42, baseY - h * 0.28);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = light;
  ctx.beginPath();
  ctx.moveTo(x, baseY - h * 0.82);
  ctx.lineTo(x - h * 0.3, baseY - h * 0.3);
  ctx.lineTo(x + h * 0.3, baseY - h * 0.3);
  ctx.closePath();
  ctx.fill();
}

function drawBuilding(ctx, cam, b) {
  const hw = b.w / 2;
  const hd = b.d / 2;
  const cos = Math.cos(b.rot);
  const sin = Math.sin(b.rot);
  const corner = (lx, lz, y) => {
    const wx = b.x + lx * cos - lz * sin;
    const wz = b.z + lx * sin + lz * cos;
    return project(cam, wx, b.y + y, wz);
  };
  const top = [corner(-hw, -hd, b.h), corner(hw, -hd, b.h), corner(hw, hd, b.h), corner(-hw, hd, b.h)];
  if (top.some((p) => !p)) return;
  // The two walls facing the camera, chosen by which side it stands on.
  const toCamX = cam.pos.x - b.x;
  const toCamZ = cam.pos.z - b.z;
  const localX = toCamX * cos + toCamZ * sin;
  const localZ = -toCamX * sin + toCamZ * cos;
  const walls = [];
  if (localZ > 0) walls.push([corner(-hw, hd, 0), corner(hw, hd, 0), corner(hw, hd, b.h), corner(-hw, hd, b.h)]);
  else walls.push([corner(hw, -hd, 0), corner(-hw, -hd, 0), corner(-hw, -hd, b.h), corner(hw, -hd, b.h)]);
  if (localX > 0) walls.push([corner(hw, -hd, 0), corner(hw, hd, 0), corner(hw, hd, b.h), corner(hw, -hd, b.h)]);
  else walls.push([corner(-hw, hd, 0), corner(-hw, -hd, 0), corner(-hw, -hd, b.h), corner(-hw, hd, b.h)]);
  const wallColour = b.kind === 'hangar' ? '#7d8a7a' : b.kind === 'tower' ? '#cfc4a8' : '#d8c9a3';
  for (const wall of walls) {
    if (wall.some((p) => !p)) continue;
    ctx.fillStyle = wallColour;
    ctx.beginPath();
    ctx.moveTo(wall[0].x, wall[0].y);
    for (let i = 1; i < wall.length; i++) ctx.lineTo(wall[i].x, wall[i].y);
    ctx.closePath();
    ctx.fill();
    // Windows and a door, interpolated across the wall so the building
    // reads as built rather than as a flat slab.
    const wallW = Math.hypot(wall[1].x - wall[0].x, wall[1].y - wall[0].y);
    if (wallW > 24) {
      const at = (u, v) => {
        const bx = wall[0].x + (wall[1].x - wall[0].x) * u;
        const by = wall[0].y + (wall[1].y - wall[0].y) * u;
        const tx = wall[3].x + (wall[2].x - wall[3].x) * u;
        const ty = wall[3].y + (wall[2].y - wall[3].y) * u;
        return { x: bx + (tx - bx) * v, y: by + (ty - by) * v };
      };
      const win = Math.max(2.5, wallW * 0.07);
      ctx.fillStyle = '#2c4256';
      for (const u of [0.25, 0.5, 0.75]) {
        const p = at(u, 0.55);
        ctx.fillRect(p.x - win / 2, p.y - win / 2, win, win);
      }
      if (b.kind !== 'tower') {
        const d = at(0.5, 0.18);
        ctx.fillStyle = '#4a3626';
        ctx.fillRect(d.x - win * 0.7, d.y - win, win * 1.4, win * 2);
      }
    }
  }
  // Roof: red-brown for farms, grey-green for hangars, glass for the tower.
  ctx.fillStyle = b.kind === 'tower' ? '#3f6d8f' : b.kind === 'hangar' ? '#5d6b5a' : '#a5503c';
  ctx.beginPath();
  ctx.moveTo(top[0].x, top[0].y);
  for (let i = 1; i < top.length; i++) ctx.lineTo(top[i].x, top[i].y);
  ctx.closePath();
  ctx.fill();
  if (b.kind === 'tower') {
    const cab = [corner(-7, -7, b.h + 7), corner(7, -7, b.h + 7), corner(7, 7, b.h + 7), corner(-7, 7, b.h + 7)];
    if (cab.every(Boolean)) {
      ctx.fillStyle = '#9fd8ff';
      ctx.beginPath();
      ctx.moveTo(cab[0].x, cab[0].y);
      for (let i = 1; i < cab.length; i++) ctx.lineTo(cab[i].x, cab[i].y);
      ctx.closePath();
      ctx.fill();
    }
  }
}

// Rings: glowing circles floating on the course. The next one is gold, the
// rest are cyan, and a cleared one is gone.
function drawRings(ctx, cam, flight, time) {
  for (let i = 0; i < flight.rings.length; i++) {
    const ring = flight.rings[i];
    if (ring.passed) continue;
    const isNext = i === flight.ringIndex;
    const colour = isNext ? PALETTE.ringNext : PALETTE.ringLater;
    const centre = project(cam, ring.x, ring.y, ring.z);
    if (!centre) continue;
    const normal = { x: Math.sin(ring.heading), y: 0, z: -Math.cos(ring.heading) };
    const u = norm3(0, 1, 0);
    const v = cross(normal, u);
    const pts = [];
    const segs = 22;
    for (let s = 0; s <= segs; s++) {
      const a = (s / segs) * Math.PI * 2;
      const px = ring.x + (Math.cos(a) * u.x + Math.sin(a) * v.x) * ring.radius;
      const py = ring.y + (Math.cos(a) * u.y + Math.sin(a) * v.y) * ring.radius;
      const pz = ring.z + (Math.cos(a) * u.z + Math.sin(a) * v.z) * ring.radius;
      const p = project(cam, px, py, pz);
      if (p) pts.push(p);
    }
    if (pts.length < 4) continue;
    const width = clamp(centre.scale * 1.6, 2, 14);
    ctx.strokeStyle = colour;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = width * 2.4;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i2 = 1; i2 < pts.length; i2++) ctx.lineTo(pts[i2].x, pts[i2].y);
    ctx.closePath();
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.lineWidth = width;
    ctx.stroke();
    // The next ring gets a pulsing centre marker so it is easy to aim at.
    if (isNext) {
      const pulse = 0.6 + 0.4 * Math.sin(time * 3.6);
      ctx.fillStyle = `rgba(255, 194, 51, ${pulse})`;
      ctx.beginPath();
      ctx.arc(centre.x, centre.y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

export function renderWorld(ctx, cam, game) {
  const { world, flight } = game;
  drawSky(ctx, cam, flight.plane, game.time);
  drawMountains(ctx, cam, flight.plane);
  drawGroundHaze(ctx, cam);
  drawClouds(ctx, cam, world, game.time);
  drawTerrain(ctx, cam, world, flight.plane, game.time);
  drawBillboards(ctx, cam, world, flight, game.time);
  drawRings(ctx, cam, flight, game.time);
}

// Beyond the terrain grid's edge the valley does not end: a hazy band of
// distant ground runs from the horizon down, so the mountains sit on land
// instead of floating over sky, and the grid's far edge never shows as a
// straight cut. It follows the horizon's tilt when the aeroplane banks.
function drawGroundHaze(ctx, cam) {
  const far = 9000;
  const left = project(cam,
    cam.pos.x + (cam.fwd.x * Math.cos(1.2) - cam.fwd.z * Math.sin(1.2)) * far,
    cam.pos.y,
    cam.pos.z + (cam.fwd.x * Math.sin(1.2) + cam.fwd.z * Math.cos(1.2)) * far);
  const right = project(cam,
    cam.pos.x + (cam.fwd.x * Math.cos(-1.2) - cam.fwd.z * Math.sin(-1.2)) * far,
    cam.pos.y,
    cam.pos.z + (cam.fwd.x * Math.sin(-1.2) + cam.fwd.z * Math.cos(-1.2)) * far);
  if (!left || !right) return;
  const topY = Math.min(left.y, right.y);
  const g = ctx.createLinearGradient(0, topY, 0, VIEW.height);
  g.addColorStop(0, 'rgba(217, 236, 247, 0.9)');
  g.addColorStop(0.3, '#8aa86a');
  g.addColorStop(1, '#6d8f4e');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-60, left.y + 8);
  ctx.lineTo(VIEW.width + 60, right.y + 8);
  ctx.lineTo(VIEW.width + 60, VIEW.height + 60);
  ctx.lineTo(-60, VIEW.height + 60);
  ctx.closePath();
  ctx.fill();
}

// ---- The aeroplane -------------------------------------------------------

// The aeroplane's shadow on the ground below, fading as it climbs. It is
// drawn under the aeroplane on screen, sized by altitude, so it can never
// blow up when the camera sits low over the runway.
function drawShadow(ctx, cam, world, plane) {
  const ground = world.terrainHeight(plane.x, plane.z);
  const agl = plane.y - ground;
  if (agl > 600) return;
  const cx = VIEW.width / 2;
  const cy = VIEW.height * 0.6 - plane.pitch * 46 + 34 + agl * 0.06;
  const rx = clamp(58 - agl * 0.07, 14, 58);
  ctx.fillStyle = `rgba(10, 20, 10, ${clamp(0.3 - agl * 0.0004, 0.04, 0.3)})`;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, rx * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();
}

// The aeroplane, drawn from behind and slightly above: wings, tail, canopy
// and a spinning prop, banking with the roll.
export function drawPlane(ctx, plane, time) {
  const cx = VIEW.width / 2;
  const cy = VIEW.height * 0.6 - plane.pitch * 46 + Math.sin(time * 2.1) * 1.5;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(plane.roll);
  // Prop blur at the nose.
  const propAngle = time * 22;
  ctx.strokeStyle = 'rgba(240, 244, 248, 0.35)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.ellipse(0, -38, 42, 8, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(220, 230, 240, 0.5)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(Math.cos(propAngle) * 40, -38 + Math.sin(propAngle) * 7);
  ctx.lineTo(-Math.cos(propAngle) * 40, -38 - Math.sin(propAngle) * 7);
  ctx.stroke();
  // Main wings.
  ctx.fillStyle = '#e8e4d8';
  ctx.beginPath();
  ctx.moveTo(-168, -16);
  ctx.quadraticCurveTo(-120, -30, -30, -22);
  ctx.lineTo(30, -22);
  ctx.quadraticCurveTo(120, -30, 168, -16);
  ctx.lineTo(158, 2);
  ctx.lineTo(0, -4);
  ctx.lineTo(-158, 2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#c8443c';
  ctx.fillRect(-168, -16, 14, 12);
  ctx.fillRect(154, -16, 14, 12);
  // Fuselage, foreshortened: from behind and above you see the tail close
  // and the nose far away, so the body is short and the wings do the talking.
  const fus = ctx.createLinearGradient(-14, 0, 14, 0);
  fus.addColorStop(0, '#b9c4cc');
  fus.addColorStop(0.5, '#eef2f5');
  fus.addColorStop(1, '#9fb0bc');
  ctx.fillStyle = fus;
  ctx.beginPath();
  ctx.moveTo(-14, 56);
  ctx.quadraticCurveTo(-17, -6, -10, -32);
  ctx.quadraticCurveTo(0, -40, 10, -32);
  ctx.quadraticCurveTo(17, -6, 14, 56);
  ctx.quadraticCurveTo(0, 62, -14, 56);
  ctx.closePath();
  ctx.fill();
  // Canopy.
  ctx.fillStyle = '#7fc4e8';
  ctx.beginPath();
  ctx.ellipse(0, -16, 9, 15, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.beginPath();
  ctx.ellipse(-3, -21, 3, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  // Tailplane and fin.
  ctx.fillStyle = '#d8d2c2';
  ctx.beginPath();
  ctx.moveTo(-62, 40);
  ctx.lineTo(62, 40);
  ctx.lineTo(50, 52);
  ctx.lineTo(-50, 52);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#c8443c';
  ctx.beginPath();
  ctx.moveTo(-7, 54);
  ctx.lineTo(7, 54);
  ctx.lineTo(11, 22);
  ctx.lineTo(-11, 22);
  ctx.closePath();
  ctx.fill();
  // Registration on the fin.
  ctx.fillStyle = '#f4f6f8';
  ctx.font = 'bold 8px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SKY-01', 0, 50);
  // Navigation lights: red left, green right.
  ctx.fillStyle = '#ff4b3e';
  ctx.beginPath();
  ctx.arc(-166, -8, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#39d353';
  ctx.beginPath();
  ctx.arc(166, -8, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ---- The instruments -----------------------------------------------------

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = PALETTE.hudPanel;
  ctx.strokeStyle = 'rgba(159, 216, 255, 0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10);
  ctx.fill();
  ctx.stroke();
}

function gaugeFace(ctx, cx, cy, r, label) {
  ctx.fillStyle = '#0a1622';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = PALETTE.hudLine;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = 'bold 10px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, cx, cy + r + 14);
}

function gaugeTicks(ctx, cx, cy, r, from, to, steps, fmt) {
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = '9px Arial, sans-serif';
  ctx.textAlign = 'center';
  for (let i = 0; i <= steps; i++) {
    const v = from + ((to - from) * i) / steps;
    const a = (-225 + (270 * i) / steps) * (Math.PI / 180);
    const x1 = cx + Math.cos(a) * (r - 4);
    const y1 = cy + Math.sin(a) * (r - 4);
    const x2 = cx + Math.cos(a) * (r - 10);
    const y2 = cy + Math.sin(a) * (r - 10);
    ctx.strokeStyle = PALETTE.hudLine;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.fillText(fmt(v), cx + Math.cos(a) * (r - 19), cy + Math.sin(a) * (r - 19) + 3);
  }
}

function gaugeNeedle(ctx, cx, cy, r, fraction, colour = PALETTE.hudAmber) {
  const a = (-225 + 270 * clamp(fraction, 0, 1)) * (Math.PI / 180);
  ctx.strokeStyle = colour;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(a) * (r - 8), cy + Math.sin(a) * (r - 8));
  ctx.stroke();
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
  ctx.fill();
}

// The attitude indicator: a horizon that rolls and pitches with the aeroplane.
function drawAttitude(ctx, cx, cy, r, plane) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(cx, cy);
  ctx.rotate(-plane.roll);
  const pitchPx = plane.pitch * 90;
  ctx.translate(0, pitchPx);
  ctx.fillStyle = '#5ea8dd';
  ctx.fillRect(-r - 4, -r - 90 - 4, (r + 4) * 2, r + 90 + 4);
  ctx.fillStyle = '#8a5a33';
  ctx.fillRect(-r - 4, 0, (r + 4) * 2, r + 90 + 4);
  ctx.strokeStyle = '#e8f4ff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-r, 0);
  ctx.lineTo(r, 0);
  ctx.stroke();
  ctx.lineWidth = 1;
  for (const deg of [-20, -10, 10, 20]) {
    const y = -deg * 2.2;
    ctx.beginPath();
    ctx.moveTo(-16, y);
    ctx.lineTo(16, y);
    ctx.stroke();
  }
  ctx.restore();
  // Fixed aeroplane symbol over the moving horizon.
  ctx.strokeStyle = '#ffd23e';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - 22, cy);
  ctx.lineTo(cx - 7, cy);
  ctx.moveTo(cx + 7, cy);
  ctx.lineTo(cx + 22, cy);
  ctx.moveTo(cx, cy - 1);
  ctx.lineTo(cx, cy + 5);
  ctx.stroke();
  ctx.strokeStyle = PALETTE.hudLine;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
}

function drawHeadingTape(ctx, cx, y, plane) {
  const w = 300;
  ctx.fillStyle = 'rgba(8, 18, 30, 0.6)';
  ctx.beginPath();
  ctx.roundRect(cx - w / 2, y, w, 26, 6);
  ctx.fill();
  const headingDeg = ((radToDeg(plane.heading) % 360) + 360) % 360;
  const labels = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(cx - w / 2, y, w, 26, 6);
  ctx.clip();
  for (let d = 0; d < 360; d += 15) {
    const rel = ((d - headingDeg + 540) % 360) - 180;
    const x = cx + rel * 3.2;
    if (x < cx - w / 2 - 10 || x > cx + w / 2 + 10) continue;
    const major = d % 45 === 0;
    ctx.strokeStyle = PALETTE.hudLine;
    ctx.lineWidth = major ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(x, y + (major ? 6 : 12));
    ctx.lineTo(x, y + 20);
    ctx.stroke();
    if (major) {
      ctx.fillStyle = PALETTE.hudText;
      ctx.font = 'bold 10px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(labels[d] ?? String(d).padStart(3, '0'), x, y + 14);
    }
  }
  ctx.restore();
  ctx.fillStyle = PALETTE.hudAmber;
  ctx.beginPath();
  ctx.moveTo(cx - 6, y - 1);
  ctx.lineTo(cx + 6, y - 1);
  ctx.lineTo(cx, y + 7);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = 'bold 13px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${String(Math.round(headingDeg)).padStart(3, '0')}°`, cx, y + 40);
}

function radToDeg(r) {
  return (r * 180) / Math.PI;
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function drawHud(ctx, game) {
  const { flight, phase } = game;
  const plane = flight.plane;
  const W = VIEW.width;
  const H = VIEW.height;
  const panelY = H - 118;

  panel(ctx, 0, panelY, W, 118);

  // Airspeed, left.
  const speedKt = Math.round(plane.speed * 1.944);
  gaugeFace(ctx, 92, panelY + 46, 38, 'AIRSPEED');
  gaugeTicks(ctx, 92, panelY + 46, 38, 0, 180, 6, (v) => String(v));
  gaugeNeedle(ctx, 92, panelY + 46, 38, speedKt / 180);
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = 'bold 12px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${speedKt} KT`, 92, panelY + 112);

  // Throttle.
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = 'bold 10px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('THR', 178, panelY + 18);
  ctx.fillStyle = '#0a1622';
  ctx.fillRect(170, panelY + 24, 16, 72);
  const thrH = 72 * plane.throttle;
  ctx.fillStyle = plane.throttle > 0.85 ? PALETTE.hudAmber : PALETTE.hudGreen;
  ctx.fillRect(170, panelY + 24 + (72 - thrH), 16, thrH);
  ctx.fillText(`${Math.round(plane.throttle * 100)}%`, 178, panelY + 110);

  // Attitude, centre, with the heading tape above it.
  drawAttitude(ctx, W / 2, panelY + 56, 46, plane);
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = 'bold 10px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('ATTITUDE', W / 2, panelY + 114);
  drawHeadingTape(ctx, W / 2, panelY - 34, plane);

  // Altimeter, right.
  const altFt = Math.round(plane.y * 3.281);
  gaugeFace(ctx, W - 92, panelY + 46, 38, 'ALTITUDE');
  gaugeTicks(ctx, W - 92, panelY + 46, 38, 0, 3000, 6, (v) => `${v / 1000}k`);
  gaugeNeedle(ctx, W - 92, panelY + 46, 38, altFt / 3000);
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = 'bold 12px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${altFt.toLocaleString('en-US')} FT`, W - 92, panelY + 112);

  // Vertical speed, beside the altimeter.
  const vsi = Math.round(plane.verticalSpeed * 196.85);
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = 'bold 10px Arial, sans-serif';
  ctx.fillText('VSI', W - 190, panelY + 18);
  ctx.fillStyle = '#0a1622';
  ctx.fillRect(W - 198, panelY + 24, 14, 72);
  const vsiH = clamp(Math.abs(vsi) / 2000, 0, 1) * 34;
  ctx.fillStyle = vsi >= 0 ? PALETTE.hudGreen : PALETTE.hudAmber;
  if (vsi >= 0) ctx.fillRect(W - 198, panelY + 60 - vsiH, 14, vsiH);
  else ctx.fillRect(W - 198, panelY + 60, 14, vsiH);
  ctx.strokeStyle = PALETTE.hudLine;
  ctx.beginPath();
  ctx.moveTo(W - 198, panelY + 60);
  ctx.lineTo(W - 184, panelY + 60);
  ctx.stroke();
  ctx.fillStyle = PALETTE.hudText;
  ctx.fillText(`${vsi > 0 ? '+' : ''}${vsi}`, W - 191, panelY + 110);

  // Fuel, bottom right of the panel.
  const fuelW = 150;
  const fuelX = W - 380;
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = 'bold 10px Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('FUEL', fuelX, panelY + 18);
  ctx.fillStyle = '#0a1622';
  ctx.fillRect(fuelX, panelY + 24, fuelW, 14);
  ctx.fillStyle = plane.fuel < 20 ? PALETTE.hudRed : plane.fuel < 40 ? PALETTE.hudAmber : PALETTE.hudGreen;
  ctx.fillRect(fuelX, panelY + 24, fuelW * (plane.fuel / 100), 14);
  ctx.fillStyle = PALETTE.hudText;
  ctx.fillText(`${Math.round(plane.fuel)}%`, fuelX + fuelW + 8, panelY + 36);

  // Top-left: mission and objective.
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(8, 18, 30, 0.55)';
  ctx.beginPath();
  ctx.roundRect(14, 12, 330, 66, 8);
  ctx.fill();
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = 'bold 15px Arial, sans-serif';
  ctx.fillText(flight.mission.name.toUpperCase(), 26, 34);
  ctx.font = '12px Arial, sans-serif';
  const objective = flight.ringIndex < flight.rings.length
    ? `Fly through ring ${flight.ringIndex + 1} of ${flight.rings.length}`
    : 'Land on runway 09';
  ctx.fillText(objective, 26, 54);
  for (let i = 0; i < flight.rings.length; i++) {
    ctx.fillStyle = flight.rings[i].passed ? PALETTE.hudGreen : i === flight.ringIndex ? PALETTE.ringNext : 'rgba(232,244,255,0.4)';
    ctx.beginPath();
    ctx.arc(30 + i * 18, 68, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Top-right: score, time, fuel.
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(8, 18, 30, 0.55)';
  ctx.beginPath();
  ctx.roundRect(W - 224, 12, 210, 66, 8);
  ctx.fill();
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = 'bold 15px Arial, sans-serif';
  ctx.fillText(`SCORE ${flight.score}`, W - 26, 34);
  ctx.font = '12px Arial, sans-serif';
  ctx.fillText(`TIME ${formatTime(flight.elapsed)}  ·  PAR ${formatTime(flight.mission.parSeconds)}`, W - 26, 54);
  ctx.fillStyle = plane.fuel < 20 ? PALETTE.hudRed : PALETTE.hudText;
  ctx.fillText(`FUEL ${Math.round(plane.fuel)}%`, W - 26, 70);

  // Reticle at the centre of the sky.
  ctx.strokeStyle = 'rgba(232, 244, 255, 0.8)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(W / 2, H * 0.42, 12, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(W / 2 - 18, H * 0.42);
  ctx.lineTo(W / 2 - 6, H * 0.42);
  ctx.moveTo(W / 2 + 6, H * 0.42);
  ctx.lineTo(W / 2 + 18, H * 0.42);
  ctx.moveTo(W / 2, H * 0.42 - 18);
  ctx.lineTo(W / 2, H * 0.42 - 6);
  ctx.moveTo(W / 2, H * 0.42 + 6);
  ctx.lineTo(W / 2, H * 0.42 + 18);
  ctx.stroke();

  drawObjectiveArrow(ctx, game);

  // Warnings.
  const warnings = [];
  if (plane.speed < 30 && !plane.onGround && phase === 'playing') warnings.push(['STALL — NOSE DOWN, ADD POWER', PALETTE.hudRed]);
  if (plane.fuel < 20 && plane.fuel > 0) warnings.push(['LOW FUEL', PALETTE.hudAmber]);
  if (plane.fuel <= 0) warnings.push(['FUEL EMPTY — GLIDING', PALETTE.hudRed]);
  const ground = game.world.terrainHeight(plane.x, plane.z);
  if (plane.y - ground < 60 && plane.verticalSpeed < -6 && !plane.onGround) warnings.push(['PULL UP', PALETTE.hudRed]);
  if (warnings.length > 0 && Math.floor(game.time * 2.4) % 2 === 0) {
    ctx.fillStyle = warnings[0][1];
    ctx.font = 'bold 20px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(warnings[0][0], W / 2, 128);
  }

  // Toast message.
  if (flight.message && flight.elapsed < flight.messageUntil) {
    ctx.font = 'bold 17px Arial, sans-serif';
    const tw = ctx.measureText(flight.message).width;
    ctx.fillStyle = 'rgba(8, 18, 30, 0.65)';
    ctx.beginPath();
    ctx.roundRect(W / 2 - tw / 2 - 14, 92, tw + 28, 30, 8);
    ctx.fill();
    ctx.fillStyle = PALETTE.hudText;
    ctx.textAlign = 'center';
    ctx.fillText(flight.message, W / 2, 113);
  }
}

function drawObjectiveArrow(ctx, game) {
  const { flight } = game;
  if (flight.phase !== 'flying' && flight.phase !== 'ready') return;
  const target = flight.ringIndex < flight.rings.length
    ? flight.rings[flight.ringIndex]
    : { x: RUNWAY.thresholdX, z: RUNWAY.thresholdZ, y: 0 };
  const cam = game.cam;
  const p = project(cam, target.x, target.y, target.z);
  const W = VIEW.width;
  const H = VIEW.height;
  const dist = Math.hypot(target.x - flight.plane.x, target.y - flight.plane.y, target.z - flight.plane.z);
  const label = `${Math.round(dist)} m`;
  if (p && p.x > 40 && p.x < W - 40 && p.y > 90 && p.y < H - 160) {
    ctx.strokeStyle = PALETTE.ringNext;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 14, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = PALETTE.ringNext;
    ctx.font = 'bold 12px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, p.x, p.y - 20);
    return;
  }
  let dx;
  let dy;
  if (p) {
    dx = p.x - W / 2;
    dy = p.y - H * 0.42;
  } else {
    const ahead = { x: Math.sin(flight.plane.heading), z: -Math.cos(flight.plane.heading) };
    const to = { x: target.x - flight.plane.x, z: target.z - flight.plane.z };
    const crossProd = ahead.x * to.z - ahead.z * to.x;
    dx = crossProd > 0 ? 1 : -1;
    dy = -0.4;
  }
  const len = Math.hypot(dx, dy) || 1;
  const nx = dx / len;
  const ny = dy / len;
  const margin = 60;
  const ax = clamp(W / 2 + nx * 400, margin, W - margin);
  const ay = clamp(H * 0.42 + ny * 260, 100, H - 170);
  const ang = Math.atan2(ny, nx);
  ctx.save();
  ctx.translate(ax, ay);
  ctx.rotate(ang);
  ctx.fillStyle = PALETTE.ringNext;
  ctx.beginPath();
  ctx.moveTo(16, 0);
  ctx.lineTo(-10, -10);
  ctx.lineTo(-4, 0);
  ctx.lineTo(-10, 10);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = PALETTE.ringNext;
  ctx.font = 'bold 12px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, ax, ay + 26);
}

// ---- Screens ---------------------------------------------------------------

function overlay(ctx, alpha = 0.55) {
  ctx.fillStyle = `rgba(6, 14, 24, ${alpha})`;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
}

function bigTitle(ctx, text, y, size = 54) {
  ctx.font = `bold ${size}px Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#0a1622';
  ctx.fillText(text, VIEW.width / 2 + 3, y + 3);
  ctx.fillStyle = '#f4f6f8';
  ctx.fillText(text, VIEW.width / 2, y);
}

export function drawTitle(ctx, game) {
  const { missions } = game;
  overlay(ctx, 0.42);
  ctx.textAlign = 'center';
  bigTitle(ctx, 'SKYLARK VALLEY', 118, 58);
  ctx.fillStyle = '#ffd23e';
  ctx.font = 'bold 19px Arial, sans-serif';
  ctx.fillText('A valley flight game — rings, rivers and one good runway', VIEW.width / 2, 152);
  ctx.fillStyle = '#e8f4ff';
  ctx.font = '13px Arial, sans-serif';
  ctx.fillText('Fly with the arrow keys or W A S D · Shift / Ctrl for throttle · Hold the mouse to steer · P pauses · M mutes', VIEW.width / 2, 182);

  const cardW = 360;
  const cardH = 190;
  const gap = 28;
  const totalW = cardW * 3 + gap * 2;
  const startX = (VIEW.width - totalW) / 2;
  const y = 250;
  game.cards = [];
  missions.forEach((m, i) => {
    const x = startX + i * (cardW + gap);
    const hover = game.mouse.x >= x && game.mouse.x <= x + cardW && game.mouse.y >= y && game.mouse.y <= y + cardH;
    ctx.fillStyle = hover ? 'rgba(24, 48, 70, 0.92)' : 'rgba(10, 24, 38, 0.82)';
    ctx.strokeStyle = hover ? PALETTE.ringNext : 'rgba(159, 216, 255, 0.4)';
    ctx.lineWidth = hover ? 2.5 : 1.5;
    ctx.beginPath();
    ctx.roundRect(x, y, cardW, cardH, 12);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffd23e';
    ctx.font = 'bold 12px Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`MISSION ${i + 1}`, x + 20, y + 28);
    ctx.fillStyle = '#f4f6f8';
    ctx.font = 'bold 24px Arial, sans-serif';
    ctx.fillText(m.name, x + 20, y + 62);
    ctx.fillStyle = '#cfe3f2';
    ctx.font = '13px Arial, sans-serif';
    wrapText(ctx, m.tagline, x + 20, y + 88, cardW - 40, 18);
    ctx.fillStyle = '#9fd8ff';
    ctx.font = '12px Arial, sans-serif';
    ctx.fillText(`${m.ringCount} rings  ·  fuel ${m.fuel}%  ·  par ${formatTime(m.parSeconds)}`, x + 20, y + 152);
    ctx.fillStyle = '#e8f4ff';
    ctx.font = 'bold 13px Arial, sans-serif';
    ctx.fillText(`Press ${i + 1} or click to fly`, x + 20, y + 174);
    game.cards.push({ x, y, w: cardW, h: cardH, mission: i });
  });

  ctx.fillStyle = '#cfe3f2';
  ctx.font = '13px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('The demo flight behind this menu is the autopilot flying Ring Run — watch it thread the rings.', VIEW.width / 2, 500);
  ctx.fillText('Landings count: touch down slow, level and on the centreline of runway 09.', VIEW.width / 2, 524);
  ctx.fillStyle = '#8fa8bd';
  ctx.font = '12px Arial, sans-serif';
  ctx.fillText('An original game built for the make.fun best flight game bounty · no network, no libraries', VIEW.width / 2, 560);
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, yy);
      line = word;
      yy += lineHeight;
    } else {
      line = test;
    }
  }
  ctx.fillText(line, x, yy);
}

function endScreen(ctx, title, lines, footer) {
  overlay(ctx, 0.62);
  bigTitle(ctx, title, 150, 46);
  ctx.textAlign = 'center';
  let y = 230;
  for (const line of lines) {
    ctx.fillStyle = line.colour || '#e8f4ff';
    ctx.font = line.bold ? 'bold 19px Arial, sans-serif' : '15px Arial, sans-serif';
    ctx.fillText(line.text, VIEW.width / 2, y);
    y += 34;
  }
  ctx.fillStyle = '#9fd8ff';
  ctx.font = '14px Arial, sans-serif';
  ctx.fillText(footer, VIEW.width / 2, y + 30);
}

export function drawEndScreens(ctx, game) {
  const { flight, phase } = game;
  if (phase === 'paused') {
    overlay(ctx, 0.5);
    bigTitle(ctx, 'PAUSED', 300, 48);
    ctx.fillStyle = '#e8f4ff';
    ctx.font = '15px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Press P to keep flying', VIEW.width / 2, 360);
    return;
  }
  if (phase === 'crashed') {
    endScreen(ctx, 'CRASHED', [
      { text: flight.crashReason, bold: true },
      { text: `${flight.mission.name} — ${flight.ringsCleared} of ${flight.rings.length} rings cleared` },
      { text: `Score ${flight.score}  ·  Time ${formatTime(flight.elapsed)}` },
    ], 'R — fly again   ·   T — back to the title screen');
    return;
  }
  if (phase === 'landed-early') {
    const l = flight.landing || { softPts: 0, linePts: 0, speedPts: 0 };
    endScreen(ctx, 'LANDED EARLY', [
      { text: `You landed with ${flight.rings.length - flight.ringIndex} rings still to fly.`, bold: true },
      { text: `Rings ${flight.ringsCleared} of ${flight.rings.length}  ·  Landing +${300 + l.softPts + l.linePts + l.speedPts}` },
      { text: `Score ${flight.score}  ·  Time ${formatTime(flight.elapsed)}` },
    ], 'R — fly again   ·   T — back to the title screen');
    return;
  }
  if (phase === 'complete') {
    const stars = '★'.repeat(game.stars) + '☆'.repeat(3 - game.stars);
    const l = flight.landing || { softPts: 0, linePts: 0, speedPts: 0 };
    endScreen(ctx, 'MISSION COMPLETE', [
      { text: stars, bold: true, colour: '#ffd23e' },
      { text: `${flight.mission.name} — all ${flight.rings.length} rings, landed on runway 09`, bold: true },
      { text: `Rings  +${flight.ringsCleared * 100}` },
      { text: `Landing  +${300 + l.softPts + l.linePts + l.speedPts}  (soft ${l.softPts} · centreline ${l.linePts} · speed ${l.speedPts})` },
      { text: `Time bonus  +${flight.timeBonus}  (par ${formatTime(flight.mission.parSeconds)})` },
      { text: `TOTAL  ${flight.score}`, bold: true, colour: '#ffd23e' },
    ], 'R — fly again   ·   T — back to the title screen');
  }
}

// ---- Top-level frame --------------------------------------------------------

export function renderGame(ctx, game) {
  const plane = game.flight.plane;
  const cam = makeCamera(plane);
  game.cam = cam;
  ctx.clearRect(0, 0, VIEW.width, VIEW.height);
  renderWorld(ctx, cam, game);
  drawShadow(ctx, cam, game.world, plane);
  drawPlane(ctx, plane, game.time);
  if (game.phase === 'title') {
    drawTitle(ctx, game);
  } else {
    drawHud(ctx, game);
    drawEndScreens(ctx, game);
  }
}
