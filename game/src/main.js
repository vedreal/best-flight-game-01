// Skylark Valley — the game loop and the screens that hold it together.
// One clear job: own the frame, the phase changes and the wiring between the
// flight model, the renderer, the input and the sound.

import { VIEW, MISSIONS } from './config.js';
import { createWorld } from './world.js';
import { createFlight, stepFlight, say, starCount } from './flight.js';
import { renderGame } from './render.js';
import { createInput, readControls, takePressed, takeClick } from './input.js';
import { createAudio } from './audio.js';
import { setupShot } from './shots.js';

const canvas = document.getElementById('game');
const statusLine = document.getElementById('status');
const ctx = canvas.getContext('2d');

function fitCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = VIEW.width * dpr;
  canvas.height = VIEW.height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
fitCanvas();
window.addEventListener('resize', fitCanvas);

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const autopilotParam = params.get('autopilot') === '1';

const input = createInput(canvas);
const audio = createAudio();

const game = {
  missions: MISSIONS,
  world: null,
  flight: null,
  phase: 'title', // title | playing | paused | crashed | complete | landed-early
  stars: 0,
  mouse: input.mouse,
  time: 0,
  cards: [],
  cam: null,
  demo: false,
};

function startMission(index, demo = false) {
  const mission = MISSIONS[index];
  const world = createWorld(mission.seed);
  const flight = createFlight(mission, world);
  flight.autopilot = demo;
  game.world = world;
  game.flight = flight;
  game.phase = 'playing';
  game.stars = 0;
  game.demo = demo;
  if (demo) say(flight, 'Demo flight — the autopilot is flying', 9999);
  else say(flight, `${mission.name} — throttle up and lift off!`, 4);
  audio.unlock();
  updateStatus();
}

function backToTitle() {
  // The title screen flies the demo behind the menu.
  startMission(0, true);
  game.phase = 'title';
  updateStatus();
}

function updateStatus() {
  if (!statusLine) return;
  const flight = game.flight;
  if (!flight) {
    statusLine.textContent = 'Skylark Valley: choose a mission to fly.';
    return;
  }
  const plane = flight.plane;
  statusLine.textContent = `${game.phase}: ${flight.mission.name}, altitude ${Math.round(plane.y * 3.281)} feet, `
    + `speed ${Math.round(plane.speed * 1.944)} knots, score ${flight.score}.`;
}

// Title screen: the demo is already flying behind the cards.
backToTitle();

// A frozen shot for the screenshots: same renderer, same state, no loop.
if (shotName) {
  const { flight, world } = setupShot(shotName);
  game.world = world;
  game.flight = flight;
  game.phase = 'playing';
  game.time = 0;
  renderGame(ctx, game);
  window.__shotReady = true;
  window.__skylark = { game, startMission, backToTitle };
} else {
  let last = performance.now();
  let lastEvents = 0;

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    game.time += dt;

    const flight = game.flight;
    if (flight) {
      // Menu keys and clicks.
      if (game.phase === 'title') {
        for (let i = 0; i < 3; i++) {
          if (takePressed(input, `mission${i + 1}`)) {
            audio.click();
            startMission(i);
          }
        }
        const click = takeClick(input);
        if (click) {
          for (const card of game.cards) {
            if (click.x >= card.x && click.x <= card.x + card.w && click.y >= card.y && click.y <= card.y + card.h) {
              audio.click();
              startMission(card.mission);
            }
          }
        }
      } else {
        if (takePressed(input, 'pause') && (game.phase === 'playing' || game.phase === 'paused')) {
          game.phase = game.phase === 'playing' ? 'paused' : 'playing';
        }
        if (takePressed(input, 'restart') && game.phase !== 'title') {
          const index = MISSIONS.indexOf(flight.mission);
          startMission(index, game.demo && game.phase === 'title');
        }
        if (takePressed(input, 'title') && game.phase !== 'title') backToTitle();
      }
      if (takePressed(input, 'mute')) audio.toggleMute();

      // Fly, when the phase says flying.
      if (game.phase === 'playing') {
        const controls = readControls(input);
        stepFlight(flight, controls, dt);
        if (flight.phase === 'crashed') {
          game.phase = 'crashed';
          audio.crash();
          updateStatus();
        } else if (flight.phase === 'complete') {
          game.phase = 'complete';
          game.stars = starCount(flight);
          audio.complete();
          updateStatus();
        } else if (flight.phase === 'landed-early') {
          game.phase = 'landed-early';
          audio.touchdown();
          updateStatus();
        } else if (flight.phase === 'rollout' && !flight._touchdownSounded) {
          flight._touchdownSounded = true;
          audio.touchdown();
        }
        // Ring chimes and touchdown sounds follow the event log.
        while (lastEvents < flight.events.length) {
          const event = flight.events[lastEvents];
          lastEvents++;
          if (event.kind === 'ring') audio.ring();
        }
      }
      audio.update(flight.plane, game.phase);
    }

    // The demo restarts itself when it lands or crashes, so the title screen
    // never sits over an empty sky.
    if (game.demo && game.flight && (game.flight.phase === 'complete' || game.flight.phase === 'crashed' || game.flight.phase === 'landed-early')) {
      const index = MISSIONS.indexOf(game.flight.mission);
      startMission(index, true);
      game.phase = 'title';
    }

    renderGame(ctx, game);
    requestAnimationFrame(frame);
  }

  if (autopilotParam) {
    startMission(0, true);
    game.phase = 'playing';
  }
  requestAnimationFrame(frame);

  // The play-test's handle: state, missions and the autopilot switch.
  window.__skylark = {
    game,
    startMission,
    backToTitle,
    state() {
      const flight = game.flight;
      const plane = flight.plane;
      return {
        phase: game.phase,
        flightPhase: flight.phase,
        mission: flight.mission.id,
        x: plane.x,
        y: plane.y,
        z: plane.z,
        heading: plane.heading,
        speed: plane.speed,
        throttle: plane.throttle,
        fuel: plane.fuel,
        score: flight.score,
        rings: flight.ringsCleared,
        ringTotal: flight.rings.length,
        elapsed: flight.elapsed,
        events: flight.events.slice(),
        crashReason: flight.crashReason,
      };
    },
  };
}
