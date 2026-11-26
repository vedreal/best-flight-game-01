// Skylark Valley — staged scenes for the entry's screenshots.
// One clear job: build a fixed, readable moment of real gameplay for each
// screenshot name, using the same state the game itself plays with. The
// screenshots are real renders of the game's own code, frozen mid-flight.

import { MISSIONS } from './config.js';
import { createWorld } from './world.js';
import { createFlight } from './flight.js';
import { degToRad } from './random.js';

// Put the aeroplane a set distance before a ring, pointed straight at it.
function placeBeforeRing(flight, ring, distance, speed, throttle) {
  const plane = flight.plane;
  const dirX = ring.x - plane.x;
  const dirZ = ring.z - plane.z;
  const len = Math.hypot(dirX, dirZ) || 1;
  const ux = dirX / len;
  const uz = dirZ / len;
  plane.x = ring.x - ux * distance;
  plane.z = ring.z - uz * distance;
  plane.y = ring.y;
  plane.heading = Math.atan2(ux, -uz);
  plane.pitch = 0.02;
  plane.roll = 0.08;
  plane.speed = speed;
  plane.throttle = throttle;
  plane.onGround = false;
}

// Every shot returns a flight in the middle of a sortie, with its clock
// frozen so the screenshot is the same on every run.
export function setupShot(name, seed = 20261126) {
  const mission = MISSIONS[name === 'river' ? 1 : 0];
  const world = createWorld(mission.seed);
  const flight = createFlight(mission, world);
  const plane = flight.plane;
  flight.phase = 'flying';
  flight.elapsed = 74;
  flight.score = 320;
  flight.message = '';
  flight.messageUntil = 0;

  if (name === 'cover') {
    // The full flight at a glance: a ring dead ahead, the river and the
    // runway in the valley below, instruments lit, throttle up.
    flight.rings[0].passed = true;
    flight.ringIndex = 1;
    flight.ringsCleared = 1;
    placeBeforeRing(flight, flight.rings[1], 300, 58, 0.75);
    plane.fuel = 88;
    flight.message = 'Ring 2 of 6 — thread it!';
    flight.messageUntil = 9999;
    return { flight, world };
  }

  if (name === 'river') {
    // Low over the water: a gate hugging the river, hills on both sides.
    flight.rings[0].passed = true;
    flight.ringIndex = 1;
    flight.ringsCleared = 1;
    flight.elapsed = 52;
    flight.score = 240;
    const gate = flight.rings[1];
    placeBeforeRing(flight, gate, 380, 62, 0.8);
    plane.y = Math.max(gate.y, world.terrainHeight(plane.x, plane.z) + 55);
    plane.fuel = 81;
    flight.message = 'Stay low — follow the river!';
    flight.messageUntil = 9999;
    return { flight, world };
  }

  if (name === 'approach') {
    // Final approach: every ring cleared, the runway dead ahead, gear of
    // the mind on the threshold, speed coming back.
    for (const ring of flight.rings) ring.passed = true;
    flight.ringIndex = flight.rings.length;
    flight.ringsCleared = flight.rings.length;
    flight.elapsed = 198;
    flight.score = 740;
    plane.x = -950;
    plane.z = 4;
    plane.y = 38;
    plane.heading = degToRad(90);
    plane.pitch = -0.05;
    plane.roll = 0.02;
    plane.speed = 46;
    plane.throttle = 0.38;
    plane.onGround = false;
    plane.fuel = 64;
    flight.message = 'Final — runway 09 ahead, slow and level';
    flight.messageUntil = 9999;
    return { flight, world };
  }

  if (name === 'landing') {
    // The touchdown: wheels on the strip, rollout beginning, the sortie won.
    for (const ring of flight.rings) ring.passed = true;
    flight.ringIndex = flight.rings.length;
    flight.ringsCleared = flight.rings.length;
    flight.elapsed = 226;
    flight.score = 6 * 100 + 300 + 168 + 92 + 96; // rings + landing (base + soft + line + speed)
    flight.phase = 'rollout';
    plane.x = -220;
    plane.z = 2;
    plane.y = world.terrainHeight(plane.x, plane.z) + 1.5;
    plane.heading = degToRad(90);
    plane.pitch = 0;
    plane.roll = 0.01;
    plane.speed = 36;
    plane.throttle = 0;
    plane.onGround = true;
    plane.fuel = 58;
    flight.landing = { softPts: 168, linePts: 92, speedPts: 96, sink: 1.6, centreline: 2 };
    flight.timeBonus = 12;
    flight.message = 'Touchdown! Rolling out…';
    flight.messageUntil = 9999;
    return { flight, world };
  }

  // Unknown shot name: the cover, so a bad query still shows the game.
  return setupShot('cover', seed);
}
