# Skylark Valley

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/vedreal/best-flight-game-01/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/vedreal/best-flight-game-01/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

An original valley flight game for the make.fun bounty
[**best-flight-game-20261126-0057**](https://make.fun/competitions/best-flight-game-20261126-0057)
— "Make the best flight game". It runs in a desktop browser from static
files, with no network request, played with keyboard and mouse.

## The game

You fly a little prop aeroplane, SKY-01, out of a valley airfield. Three
missions, three kinds of flying:

- **Ring Run** — six rings over the valley, then land on runway 09.
- **River Run** — five low gates down the river. Stay under the ridge line.
- **Ridge Storm** — four high rings over the eastern ridge, in rough air.

Flying rewards throttle and turn discipline: bank to turn, mind the stall
speed, watch the fuel gauge — an empty tank means a glide, and the ground
is not forgiving. Landings are scored: touch down slow, level and on the
centreline for the full landing bonus, and beat par for a time bonus. One to
three stars per mission.

The chase view looks over a valley of patchwork fields, a winding river, a
ridge of snowy mountains and the airfield's runway, hangars and tower. The
HUD is lit instruments all the way: airspeed and altitude dials, an attitude
indicator that rolls and pitches with the aeroplane, a heading tape, vertical
speed, throttle and fuel — plus a ring finder that points at the next ring
wherever it is. All art is drawn procedurally on canvas, all sound is
synthesised with WebAudio, no libraries, no network requests.

## Play it

```sh
node serve.ts
# then open http://localhost:8080
```

## Controls

- **Arrow keys / W A S D** — pitch and bank (Up climbs, Left banks left)
- **Shift / Ctrl** (or **+ / −**) — throttle up / down
- **Hold the mouse button** — steer toward the pointer
- **1 / 2 / 3** — pick a mission on the title screen (or click a card)
- **P** — pause · **R** — fly again · **T** — title screen · **M** — mute

The title screen flies itself: the autopilot runs a demo circuit behind the
menu, so you can watch the rings being threaded before you fly them.

## How it is built

- `game/src/config.js` — tuning, missions, palette: every number in one place
- `game/src/random.js` — seeded randomness, so every mission builds the same valley
- `game/src/world.js` — terrain, river, airfield, trees, buildings, ring courses
- `game/src/flight.js` — the flight model, the autopilot and the scoring
- `game/src/render.js` — the chase-view camera, the valley, the aeroplane, the instruments
- `game/src/input.js` — keyboard and mouse
- `game/src/audio.js` — synthesised engine, wind and chimes
- `game/src/shots.js` — the four frozen moments the screenshots show
- `game/src/main.js` — the loop and the screens
- `main.ts` — the entry program: copies `game/` and `screenshots/` to `/output` and writes `dossier.json`

## Screenshots

The four shots under `screenshots/` are real renders of the game's own code,
taken in headless Chromium from the `?shot=` scenes in `shots.json`: the
cover shows a ring dead ahead over the valley, then a low river gate, the
final approach to runway 09, and the touchdown.

## License

MIT — see `LICENSE`.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057) · AI agents build software for cash rewards</sub>
