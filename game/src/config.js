// Skylark Valley — tuning, missions and palette.
// One clear job: every number the flight model, the world and the HUD agree
// on, so a balance change happens here and nowhere else.

export const VIEW = { width: 1280, height: 720, fov: 62 };

export const PLANE = {
  minSpeed: 26, // m/s — below this the wing stops flying
  cruiseSpeed: 55, // m/s — what the throttle holds at 75%
  maxSpeed: 83, // m/s — full throttle, level flight
  rollRate: 1.15, // rad/s at full stick
  maxRoll: 1.1, // rad — about 63 degrees of bank
  pitchRate: 0.55, // rad/s at full stick
  maxPitchUp: 0.5,
  maxPitchDown: -0.38,
  fuelBurnBase: 0.04, // percent per second at idle
  fuelBurnThrottle: 0.16, // extra percent per second at full throttle
  stallSpeed: 28,
  landingMaxSpeed: 60, // m/s — touchdown faster than this is a crash
  landingMaxSink: 5.0, // m/s of vertical speed a landing can absorb
  landingMaxRoll: 0.35, // rad of bank a landing can absorb
  ringRadius: 18, // metres — the ring's own radius
};

// The airfield sits at the origin; the runway runs east-west.
export const RUNWAY = {
  heading: 90, // degrees — runway 09, pointing east
  length: 900, // metres
  width: 30,
  thresholdX: -450, // west end; landings come in from the west
  thresholdZ: 0,
};

export const WORLD = {
  extent: 3600, // metres — terrain grid reaches +-extent
  cell: 120, // metres per terrain grid cell
  viewDistance: 2800, // metres — terrain drawn out to this range
  treeCount: 340,
  cloudCount: 26,
  buildingCount: 9,
  riverHalfWidth: 55, // metres of water either side of the river line
};

// Three sorties, three different kinds of flying. Each one is a fixed seed,
// so the valley, the rings and the weather are the same every time you fly it.
export const MISSIONS = [
  {
    id: 'ring-run',
    name: 'Ring Run',
    tagline: 'Six rings over the valley, then bring her home.',
    seed: 11,
    fuel: 100,
    parSeconds: 240,
    ringCount: 6,
    ringAltMin: 180,
    ringAltMax: 520,
    turbulence: 0.0,
    blurb: 'A gentle morning circuit. Learn the rings, learn the runway.',
  },
  {
    id: 'river-run',
    name: 'River Run',
    tagline: 'Low and fast down the river — stay under the ridge line.',
    seed: 23,
    fuel: 90,
    parSeconds: 210,
    ringCount: 5,
    ringAltMin: 55,
    ringAltMax: 130,
    turbulence: 0.15,
    blurb: 'Five low gates follow the river. Speed helps; the hills do not.',
  },
  {
    id: 'ridge-storm',
    name: 'Ridge Storm',
    tagline: 'High rings over the eastern ridge, in rough air.',
    seed: 37,
    fuel: 100,
    parSeconds: 260,
    ringCount: 4,
    ringAltMin: 480,
    ringAltMax: 760,
    turbulence: 0.6,
    blurb: 'Thin air, hard turns, and the wind shoves back. Fly it clean.',
  },
];

export const SCORE = {
  ring: 100,
  gate: 120, // low gates in River Run pay a little more
  timeBonusMax: 200, // for beating par
  landingBase: 300,
  landingSoftMax: 200, // gentle touchdown
  landingLineMax: 100, // on the centreline
  star1: 400,
  star2: 650,
  star3: 900,
};

export const PALETTE = {
  skyTop: '#2e6db0',
  skyMid: '#7fb2dd',
  skyHorizon: '#d9ecf7',
  sunCore: '#fff3c4',
  sunGlow: 'rgba(255, 214, 120, 0.45)',
  mountainFar: '#7d94b8',
  mountainNear: '#5d7396',
  snow: '#eef4fb',
  water: '#3f8fd2',
  waterDeep: '#2b6aa8',
  field: ['#6da24a', '#7fae52', '#5d8f3e', '#a8a05a', '#c2a95e', '#8a9a4b'],
  forest: '#3f7031',
  rock: '#8d8a80',
  rockHigh: '#b9b4a8',
  runway: '#3c4148',
  runwayEdge: '#e8e8e8',
  hudPanel: 'rgba(8, 18, 30, 0.72)',
  hudLine: '#9fd8ff',
  hudText: '#e8f4ff',
  hudAmber: '#ffb347',
  hudRed: '#ff5a4e',
  hudGreen: '#7be495',
  ringNext: '#ffc233',
  ringLater: '#37c8e8',
  ringDone: '#7be495',
};
