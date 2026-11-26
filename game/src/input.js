// Skylark Valley — keyboard and mouse.
// One clear job: turn keys and the pointer into the stick, throttle and menu
// choices the game loop reads, and nothing else.

import { VIEW } from './config.js';

export function createInput(canvas) {
  const keys = new Set();
  const input = {
    keys,
    mouse: { x: VIEW.width / 2, y: VIEW.height / 2, down: false },
    // One-shot presses the loop consumes once: Enter, R, T, P, M, 1-3.
    pressed: new Set(),
    click: null, // { x, y } in canvas pixels, consumed once
  };

  const keyMap = {
    ArrowUp: 'up',
    ArrowDown: 'down',
    ArrowLeft: 'left',
    ArrowRight: 'right',
    KeyW: 'up',
    KeyS: 'down',
    KeyA: 'left',
    KeyD: 'right',
    ShiftLeft: 'throttleUp',
    ShiftRight: 'throttleUp',
    ControlLeft: 'throttleDown',
    ControlRight: 'throttleDown',
    Equal: 'throttleUp',
    Minus: 'throttleDown',
    Enter: 'enter',
    KeyR: 'restart',
    KeyT: 'title',
    KeyP: 'pause',
    KeyM: 'mute',
    Digit1: 'mission1',
    Digit2: 'mission2',
    Digit3: 'mission3',
  };

  function toCanvas(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * VIEW.width,
      y: ((clientY - rect.top) / rect.height) * VIEW.height,
    };
  }

  window.addEventListener('keydown', (event) => {
    const name = keyMap[event.code];
    if (!name) return;
    if (['up', 'down', 'left', 'right'].includes(name)) event.preventDefault();
    if (!event.repeat) input.pressed.add(name);
    keys.add(name);
  });
  window.addEventListener('keyup', (event) => {
    const name = keyMap[event.code];
    if (name) keys.delete(name);
  });
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('pointermove', (event) => {
    const p = toCanvas(event.clientX, event.clientY);
    input.mouse.x = p.x;
    input.mouse.y = p.y;
  });
  canvas.addEventListener('pointerdown', (event) => {
    const p = toCanvas(event.clientX, event.clientY);
    input.mouse.x = p.x;
    input.mouse.y = p.y;
    input.mouse.down = true;
    input.click = p;
  });
  window.addEventListener('pointerup', () => {
    input.mouse.down = false;
  });

  return input;
}

// Read the held keys as stick and throttle inputs for one step.
export function readControls(input) {
  const pitch = (input.keys.has('up') ? 1 : 0) - (input.keys.has('down') ? 1 : 0);
  const roll = (input.keys.has('right') ? 1 : 0) - (input.keys.has('left') ? 1 : 0);
  let pitchIn = pitch;
  let rollIn = roll;
  // Holding the mouse steers toward the pointer: the stick follows the hand.
  if (input.mouse.down) {
    const dx = (input.mouse.x - VIEW.width / 2) / (VIEW.width / 2);
    const dy = (input.mouse.y - VIEW.height * 0.42) / (VIEW.height * 0.42);
    rollIn = Math.max(-1, Math.min(1, dx * 1.4));
    pitchIn = Math.max(-1, Math.min(1, -dy * 1.2));
  }
  const throttleDelta = (input.keys.has('throttleUp') ? 0.55 : 0) - (input.keys.has('throttleDown') ? 0.55 : 0);
  return { pitch: pitchIn, roll: rollIn, throttleDelta };
}

export function takePressed(input, name) {
  if (!input.pressed.has(name)) return false;
  input.pressed.delete(name);
  return true;
}

export function takeClick(input) {
  const click = input.click;
  input.click = null;
  return click;
}
