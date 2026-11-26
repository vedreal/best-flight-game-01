// Skylark Valley — the flight model.
// One clear job: how the aeroplane moves, stalls, lands and crashes, how the
// autopilot flies it for the title-screen demo, and how a sortie is scored.

import { PLANE, RUNWAY, SCORE } from './config.js';
import { clamp, angleDelta, degToRad } from './random.js';
import { isWater, onRunway } from './world.js';

export function createPlane(mission) {
  return {
    x: RUNWAY.thresholdX - 60,
    y: 4,
    z: 0,
    heading: degToRad(90), // lined up with runway 09, pointing east
    pitch: 0,
    roll: 0,
    speed: 0,
    throttle: 0,
    fuel: mission.fuel,
    damage: 0,
    onGround: true,
    verticalSpeed: 0,
    groundSpeed: 0,
  };
}

export function createFlight(mission, world) {
  const plane = createPlane(mission);
  const rings = world.buildRings(mission);
  return {
    mission,
    world,
    plane,
    rings,
    ringIndex: 0,
    phase: 'ready', // ready | flying | rollout | complete | crashed | landed-early
    elapsed: 0,
    score: 0,
    ringsCleared: 0,
    timeBonus: 0,
    landing: null,
    crashReason: '',
    message: '',
    messageUntil: 0,
    autopilot: false,
    turbulenceSeed: 0,
    events: [], // { at, kind, text } — the log the play-test reads
  };
}

function logEvent(flight, kind, text) {
  flight.events.push({ at: flight.elapsed, kind, text });
}

export function nextObjective(flight) {
  if (flight.ringIndex < flight.rings.length) return flight.rings[flight.ringIndex];
  return { x: RUNWAY.thresholdX, z: RUNWAY.thresholdZ, y: 0, runway: true };
}

export function say(flight, text, seconds = 3) {
  flight.message = text;
  flight.messageUntil = flight.elapsed + seconds;
}

function forwardVector(plane) {
  return {
    x: Math.sin(plane.heading) * Math.cos(plane.pitch),
    y: Math.sin(plane.pitch),
    z: -Math.cos(plane.heading) * Math.cos(plane.pitch),
  };
}

// The autopilot: a plain controller that chases the next ring, then flies a
// 3-degree glide slope to the threshold and flares. It flies the title-screen
// demo, and it is what the play-test uses to prove a sortie can be finished.
export function autopilotInputs(flight, dt) {
  const plane = flight.plane;
  const target = nextObjective(flight);
  const inputs = { pitch: 0, roll: 0, throttle: plane.throttle };

  if (flight.phase === 'rollout') {
    inputs.throttle = 0;
    inputs.roll = clamp(angleDelta(plane.heading, degToRad(90)) * 2, -0.3, 0.3);
    return inputs;
  }

  // Line up on the ring from 300 metres out, along the course the ring
  // faces: a straight run through the ring beats a turn across it, and a
  // turn across a close ring is how an aeroplane ends up orbiting it. On
  // final, line up on the centreline 600 metres out, then aim 300 metres
  // PAST the threshold: aiming at the threshold itself lets the aeroplane
  // orbit it at its own turn radius and never touch down. Off the
  // centreline, go around: climb, fly back to the final fix and try again.
  const targetDist = Math.hypot(target.x - plane.x, target.z - plane.z);
  const alongTrack = RUNWAY.thresholdX - plane.x; // >0 while west of the threshold
  // The runway is 900 m long: a touchdown 300 m past the threshold still
  // leaves 600 m to roll out, so the landing window runs that far.
  const linedUp = Math.abs(plane.z) <= 100 && alongTrack > -300;
  let aim = target;
  if (target.runway) {
    // Within 250 m of the final fix, stop chasing the fix itself and aim
    // down the runway instead: a point right under the nose swings the
    // desired heading wildly and throws the aeroplane off the centreline.
    const fixDist = Math.hypot(RUNWAY.thresholdX - 600 - plane.x, RUNWAY.thresholdZ - plane.z);
    if ((!linedUp || targetDist > 500) && fixDist > 250) {
      aim = { x: RUNWAY.thresholdX - 600, z: RUNWAY.thresholdZ, y: 35 };
    } else {
      aim = { x: RUNWAY.thresholdX + 300, z: RUNWAY.thresholdZ, y: 2 };
    }
  } else if (targetDist > 350) {
    const cx = Math.sin(target.heading);
    const cz = -Math.cos(target.heading);
    aim = { x: target.x - cx * 300, z: target.z - cz * 300, y: target.y };
  }
  const dx = aim.x - plane.x;
  const dz = aim.z - plane.z;
  const desiredHeading = Math.atan2(dx, -dz);
  const headingErr = angleDelta(plane.heading, desiredHeading);
  // A tight bank at full speed turns a 400-metre circle, wider than the
  // distance to a close ring — so the autopilot slows right down as it
  // closes in and banks hard, or it would orbit the ring forever. Thirty
  // metres a second is just above the stall, and it turns a 50-metre circle.
  const maxBank = targetDist < 400 ? 1.05 : 0.75;
  const desiredRoll = clamp(headingErr * 1.6, -maxBank, maxBank);
  inputs.roll = clamp((desiredRoll - plane.roll) * 3.0, -1, 1);

  // Aim at the ring's height; on final, ride the glide slope instead.
  // The slope is measured ALONG the runway from the threshold: measuring
  // it from the straight-line distance makes the target altitude rise
  // again the moment the aeroplane flies past the threshold, so it levels
  // off at six metres, climbs away and tries again forever. The slope is
  // a line that runs past the final fix, so an aeroplane joining it from
  // 600 m out is already on it — holding 100 m until lined up left no
  // room to descend and every approach went around. Off the approach
  // corridor, climb to a safe altitude and get lined up instead.
  const groundHere = flight.world.terrainHeight(plane.x, plane.z);
  let desiredAlt = aim.y;
  if (target.runway) {
    const slopeAlt = Math.max(0.8, alongTrack * Math.tan(degToRad(3)) + 2);
    const overStrip = plane.x >= -600 && plane.x <= 450 && Math.abs(plane.z) <= 40;
    const inCorridor = alongTrack > -300 && Math.abs(plane.z) <= 260;
    if (inCorridor) {
      desiredAlt = overStrip ? slopeAlt : Math.max(2.5, slopeAlt);
      if (!overStrip) desiredAlt = Math.max(groundHere + 3, desiredAlt);
    } else {
      desiredAlt = Math.max(100, groundHere + 60);
    }
  } else {
    desiredAlt = Math.max(aim.y, flight.world.terrainHeight(aim.x, aim.z) + 60);
  }
  const altErr = desiredAlt - plane.y;
  // A stronger gain on final: the last few metres need a real descent,
  // not the gentle 0.004/m that leaves the aeroplane floating at 6 m.
  const pitchGain = target.runway ? 0.012 : 0.004;
  let desiredPitch = clamp(altErr * pitchGain, -0.25, 0.3);
  // No flare: an earlier version flared whenever the aeroplane was under
  // 3 m, which is above the 1.5 m touchdown height — the flare fought the
  // descent and the aeroplane hovered at 3 m over the runway forever,
  // then flew off the end and went around. The glide slope itself brings
  // the aeroplane down at under 1 m/s, which is already a gentle landing.
  const agl = plane.y - groundHere;
  const overStrip = target.runway && plane.x >= -600 && plane.x <= 450 && Math.abs(plane.z) <= 40;
  inputs.pitch = clamp((desiredPitch - plane.pitch) * 2.5, -1, 1);

  const desiredSpeed = target.runway
    ? (linedUp && alongTrack < 300 ? 32 : 55)
    : targetDist > 600 ? 58 : targetDist > 250 ? 46 : 30;
  // No throttle floor here: at the 0.25 floor the aeroplane cannot get
  // below 40 m/s, and 40 m/s turns too wide a circle to thread a ring.
  inputs.throttle = clamp(plane.throttle + (desiredSpeed - plane.speed) * 0.03, 0, 0.9);
  if (overStrip && alongTrack < 120 && agl < 10) inputs.throttle = 0.22;
  return inputs;
}

export function stepFlight(flight, rawInputs, dt) {
  const plane = flight.plane;
  const mission = flight.mission;
  if (flight.phase === 'complete' || flight.phase === 'crashed' || flight.phase === 'landed-early') return;
  flight.elapsed += dt;

  const inputs = flight.autopilot ? autopilotInputs(flight, dt) : rawInputs;

  // Rough air in the storm mission shoves the stick a little.
  let pitchIn = clamp(inputs.pitch, -1, 1);
  let rollIn = clamp(inputs.roll, -1, 1);
  if (mission.turbulence > 0 && !plane.onGround) {
    flight.turbulenceSeed += dt * 7;
    const wobble = Math.sin(flight.turbulenceSeed * 1.7) * mission.turbulence * 0.35;
    pitchIn += wobble * 0.4;
    rollIn += Math.sin(flight.turbulenceSeed * 2.3) * mission.turbulence * 0.5;
  }

  // Throttle: Shift-style input nudges it, the autopilot sets it directly.
  if (flight.autopilot) {
    plane.throttle = clamp(inputs.throttle, 0, 1);
  } else {
    plane.throttle = clamp(plane.throttle + (inputs.throttleDelta || 0) * dt, 0, 1);
  }
  if (plane.fuel <= 0) plane.throttle = 0;

  const stalled = plane.speed < PLANE.stallSpeed && !plane.onGround;

  // Roll and pitch answer the stick at once, at every speed.
  plane.roll = clamp(plane.roll + rollIn * PLANE.rollRate * dt, -PLANE.maxRoll, PLANE.maxRoll);
  if (Math.abs(rollIn) < 0.05) plane.roll -= plane.roll * 0.25 * dt;
  let pitchRate = pitchIn * PLANE.pitchRate;
  if (stalled) pitchRate -= 0.35; // a stalled wing drops its nose
  plane.pitch = clamp(plane.pitch + pitchRate * dt, PLANE.maxPitchDown, PLANE.maxPitchUp);
  if (Math.abs(pitchIn) < 0.05) plane.pitch -= plane.pitch * 0.12 * dt;

  // A banked aeroplane turns: the tighter the bank, the tighter the turn.
  const turnRate = (9.81 * Math.tan(plane.roll)) / Math.max(plane.speed, 20);
  plane.heading += turnRate * dt;

  // Speed chases the throttle; drag grows with the square of speed. On
  // the ground after touchdown the wing is done flying: the target speed
  // is zero, or the throttle's pull exactly cancels the rollout braking
  // and the aeroplane rolls along at 9 m/s forever, up the nearest hill.
  const targetSpeed = flight.phase === 'rollout'
    ? 0
    : 25 + plane.throttle * (PLANE.maxSpeed - 25);
  plane.speed += (targetSpeed - plane.speed) * 0.32 * dt;
  if (plane.onGround) plane.speed += (targetSpeed - plane.speed) * 0.25 * dt;

  const fwd = forwardVector(plane);
  const liftFactor = stalled ? 0.35 : 1;
  const vy = plane.speed * fwd.y * liftFactor;
  plane.verticalSpeed = vy;
  plane.x += fwd.x * plane.speed * dt;
  plane.z += fwd.z * plane.speed * dt;
  plane.y += vy * dt;

  // Fuel: throttle is what drinks it.
  plane.fuel = Math.max(0, plane.fuel - (PLANE.fuelBurnBase + PLANE.fuelBurnThrottle * plane.throttle) * dt);

  // Take-off: once the wing is flying, the wheels leave the ground.
  if (plane.onGround && plane.speed > 32 && plane.pitch > 0.02) {
    plane.onGround = false;
    if (flight.phase === 'ready') {
      flight.phase = 'flying';
      say(flight, 'Airborne — fly the rings!', 3);
      logEvent(flight, 'takeoff', 'airborne');
    }
  }

  // Ring checks: crossing within the ring's radius clears it.
  if (flight.phase === 'flying' && flight.ringIndex < flight.rings.length) {
    const ring = flight.rings[flight.ringIndex];
    const d = Math.hypot(plane.x - ring.x, plane.y - ring.y, plane.z - ring.z);
    if (d < ring.radius) {
      ring.passed = true;
      flight.ringIndex++;
      flight.ringsCleared++;
      const gain = ring.low ? SCORE.gate : SCORE.ring;
      flight.score += gain;
      say(flight, `Ring ${flight.ringIndex} of ${flight.rings.length} — +${gain}`, 2.5);
      logEvent(flight, 'ring', `ring ${flight.ringIndex}/${flight.rings.length}`);
      if (flight.ringIndex >= flight.rings.length) {
        say(flight, 'All rings clear — land on runway 09!', 4);
        logEvent(flight, 'rings-done', 'all rings cleared');
      }
    }
  }

  // The ground: landing, or the end of the sortie.
  const ground = flight.world.terrainHeight(plane.x, plane.z);
  const agl = plane.y - ground;
  if (agl <= 1.5 && !plane.onGround) {
    const onRwy = onRunway(plane.x, plane.z);
    const gentle = Math.abs(vy) <= PLANE.landingMaxSink;
    const slow = plane.speed <= PLANE.landingMaxSpeed;
    const level = Math.abs(plane.roll) <= PLANE.landingMaxRoll && plane.pitch < 0.22;
    if (onRwy && gentle && slow && level && flight.phase === 'flying') {
      touchDown(flight, vy);
    } else {
      crash(flight, crashCause(plane, ground, onRwy, vy));
    }
  }

  // Rolling out after touchdown.
  if (flight.phase === 'rollout') {
    plane.y = flight.world.terrainHeight(plane.x, plane.z) + 1.5;
    plane.speed = Math.max(0, plane.speed - 9 * dt);
    plane.pitch = 0;
    plane.roll *= 0.9;
    const fwdG = forwardVector(plane);
    plane.x += fwdG.x * plane.speed * dt;
    plane.z += fwdG.z * plane.speed * dt;
    if (plane.speed < 4) finishLanding(flight);
  }

  // Out of fuel over the hills is a glide, not a crash — until the ground.
  if (plane.fuel <= 0 && flight.phase === 'flying' && plane.throttle === 0) {
    // nothing to do here; the glide ends at the ground, as it should
  }
}

function crashCause(plane, ground, onRwy, vy) {
  if (isWater(plane.x, plane.z)) return 'Ditched in the river';
  if (onRwy && plane.speed > PLANE.landingMaxSpeed) return 'Too fast for the runway';
  if (onRwy && Math.abs(vy) > PLANE.landingMaxSink) return 'Slammed onto the runway';
  if (onRwy) return 'Lost it on the runway';
  if (plane.y < 40) return 'Clipped the valley floor';
  return 'Flew into the hillside';
}

function crash(flight, reason) {
  const plane = flight.plane;
  plane.damage = 100;
  flight.phase = 'crashed';
  flight.crashReason = reason;
  say(flight, reason, 6);
  logEvent(flight, 'crash', reason);
}

function touchDown(flight, vy) {
  const plane = flight.plane;
  plane.onGround = true;
  plane.y = flight.world.terrainHeight(plane.x, plane.z) + 1.5;
  flight.phase = 'rollout';
  const centreline = Math.abs(plane.z);
  const soft = clamp(1 - Math.abs(vy) / PLANE.landingMaxSink, 0, 1);
  const line = clamp(1 - centreline / (RUNWAY.width / 2), 0, 1);
  const speedOk = clamp(1 - Math.max(0, plane.speed - 42) / 18, 0, 1);
  const softPts = Math.round(SCORE.landingSoftMax * soft);
  const linePts = Math.round(SCORE.landingLineMax * line);
  const speedPts = Math.round(100 * speedOk);
  flight.landing = { softPts, linePts, speedPts, sink: Math.abs(vy), centreline };
  flight.score += SCORE.landingBase + softPts + linePts + speedPts;
  say(flight, 'Touchdown! Rolling out…', 3);
  logEvent(flight, 'touchdown', `sink ${Math.abs(vy).toFixed(1)} m/s, centreline ${centreline.toFixed(0)} m`);
}

function finishLanding(flight) {
  const allRings = flight.ringIndex >= flight.rings.length;
  flight.timeBonus = Math.max(0, Math.round(SCORE.timeBonusMax * (1 - flight.elapsed / flight.mission.parSeconds)));
  if (allRings) {
    flight.score += flight.timeBonus;
    flight.phase = 'complete';
    say(flight, 'Mission complete!', 6);
    logEvent(flight, 'complete', `score ${flight.score}`);
  } else {
    flight.phase = 'landed-early';
    say(flight, `Landed early — ${flight.rings.length - flight.ringIndex} rings left`, 6);
    logEvent(flight, 'landed-early', `${flight.ringIndex}/${flight.rings.length} rings`);
  }
}

export function starCount(flight) {
  if (flight.score >= SCORE.star3) return 3;
  if (flight.score >= SCORE.star2) return 2;
  if (flight.score >= SCORE.star1) return 1;
  return 0;
}
