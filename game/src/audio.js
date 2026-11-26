// Skylark Valley — sound.
// One clear job: every sound the game makes, synthesised with WebAudio from
// nothing but oscillators and noise, so the game ships no audio files.

export function createAudio() {
  const audio = {
    ctx: null,
    master: null,
    engine: null,
    engineGain: null,
    wind: null,
    windGain: null,
    muted: false,
    started: false,
  };

  function ensure() {
    if (audio.ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      audio.ctx = new AC();
      audio.master = audio.ctx.createGain();
      audio.master.gain.value = 0.5;
      audio.master.connect(audio.ctx.destination);

      // Engine: two detuned saws through a low-pass, pitched by throttle.
      audio.engineGain = audio.ctx.createGain();
      audio.engineGain.gain.value = 0;
      const filter = audio.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      const osc1 = audio.ctx.createOscillator();
      osc1.type = 'sawtooth';
      osc1.frequency.value = 58;
      const osc2 = audio.ctx.createOscillator();
      osc2.type = 'sawtooth';
      osc2.frequency.value = 87;
      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(audio.engineGain);
      audio.engineGain.connect(audio.master);
      osc1.start();
      osc2.start();
      audio.engine = [osc1, osc2];

      // Wind: looped noise through a band-pass, louder the faster you fly.
      const len = audio.ctx.sampleRate;
      const buffer = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      const noise = audio.ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;
      const band = audio.ctx.createBiquadFilter();
      band.type = 'bandpass';
      band.frequency.value = 900;
      band.Q.value = 0.6;
      audio.windGain = audio.ctx.createGain();
      audio.windGain.gain.value = 0;
      noise.connect(band);
      band.connect(audio.windGain);
      audio.windGain.connect(audio.master);
      noise.start();
      audio.wind = noise;
      audio.started = true;
      return true;
    } catch {
      return false;
    }
  }

  audio.unlock = function unlock() {
    if (ensure() && audio.ctx.state === 'suspended') audio.ctx.resume();
  };

  audio.update = function update(plane, phase) {
    if (!audio.ctx || audio.muted) return;
    const t = audio.ctx.currentTime;
    const flying = phase === 'playing' || phase === 'paused';
    const thr = flying ? plane.throttle : 0;
    const speed = flying ? plane.speed : 0;
    audio.engineGain.gain.setTargetAtTime(plane.onGround && speed < 5 ? 0 : 0.05 + thr * 0.09, t, 0.1);
    audio.engine[0].frequency.setTargetAtTime(52 + thr * 46, t, 0.1);
    audio.engine[1].frequency.setTargetAtTime(78 + thr * 68, t, 0.1);
    audio.windGain.gain.setTargetAtTime(Math.min(0.16, (speed / 83) * 0.16), t, 0.15);
  };

  function tone(freq, dur, type, gain, when = 0, slideTo = null) {
    if (!audio.ctx || audio.muted) return;
    const t = audio.ctx.currentTime + when;
    const osc = audio.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = audio.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g);
    g.connect(audio.master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  function noiseBurst(dur, gain, freq) {
    if (!audio.ctx || audio.muted) return;
    const t = audio.ctx.currentTime;
    const len = Math.floor(audio.ctx.sampleRate * dur);
    const buffer = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = audio.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = audio.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq;
    const g = audio.ctx.createGain();
    g.gain.value = gain;
    src.connect(filter);
    filter.connect(g);
    g.connect(audio.master);
    src.start(t);
  }

  audio.ring = function ring() {
    tone(880, 0.18, 'sine', 0.22);
    tone(1318, 0.3, 'sine', 0.2, 0.09);
  };

  audio.touchdown = function touchdown() {
    tone(70, 0.25, 'sine', 0.4, 0, 42);
    noiseBurst(0.18, 0.25, 900);
  };

  audio.crash = function crash() {
    noiseBurst(0.6, 0.5, 700);
    tone(90, 0.7, 'sawtooth', 0.25, 0, 38);
  };

  audio.click = function click() {
    tone(660, 0.07, 'sine', 0.15);
  };

  audio.complete = function complete() {
    tone(523, 0.16, 'sine', 0.2);
    tone(659, 0.16, 'sine', 0.2, 0.12);
    tone(784, 0.3, 'sine', 0.22, 0.24);
  };

  audio.toggleMute = function toggleMute() {
    audio.muted = !audio.muted;
    if (audio.master) audio.master.gain.value = audio.muted ? 0 : 0.5;
    return audio.muted;
  };

  return audio;
}
