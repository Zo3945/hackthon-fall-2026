// Calm ambient soundscape, built with the Web Audio API. Every sound follows a reading.
//   pad pitch      = water temperature     pad brightness = dissolved oxygen
//   bell melody    = pH                    low murmur     = turbidity
//   airy noise     = wind                  high drips     = rain
// Notes snap to a pentatonic scale so it always sounds like music, not an alarm.

import { clamp, lerp } from './data.js';

const PENT = [0, 2, 4, 7, 9];
const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

function snap(m) {
  const octave = Math.floor(m / 12), d = ((m % 12) + 12) % 12;
  let best = PENT[0];
  for (const p of PENT) if (Math.abs(p - d) < Math.abs(best - d)) best = p;
  return octave * 12 + best;
}
const degree = (i) => Math.floor(i / 5) * 12 + PENT[((i % 5) + 5) % 5];

function noiseBuffer(ctx) {
  const b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = b.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
  return b;
}
function reverbImpulse(ctx) {
  const len = ctx.sampleRate * 3.2, b = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
  return b;
}

/** getFrame() returns the current readings (see readFrame in data.js). */
export function createAudio(getFrame) {
  let ctx = null, on = false, nodes = null, melody = 5, step = 0;

  function init() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    const master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
    const reverb = ctx.createConvolver(); reverb.buffer = reverbImpulse(ctx);
    const wet = ctx.createGain(); wet.gain.value = 0.55; reverb.connect(wet); wet.connect(master);
    const dry = ctx.createGain(); dry.gain.value = 0.8; dry.connect(master);
    const bus = ctx.createGain(); bus.connect(dry); bus.connect(reverb);

    const padFilter = ctx.createBiquadFilter(); padFilter.type = 'lowpass'; padFilter.frequency.value = 600; padFilter.Q.value = 0.4;
    const padGain = ctx.createGain(); padGain.gain.value = 0; padFilter.connect(padGain); padGain.connect(bus);
    const pad = [0, 7, 12, 16].map((interval, k) => {
      const osc = ctx.createOscillator(); osc.type = k % 2 ? 'triangle' : 'sine'; osc.frequency.value = 110; osc.detune.value = (k - 1.5) * 5;
      const og = ctx.createGain(); og.gain.value = 0.22 / (1 + k * 0.3);
      osc.connect(og); og.connect(padFilter); osc.start();
      return { osc, interval };
    });

    const noise = noiseBuffer(ctx);
    const band = (freq, q) => {
      const src = ctx.createBufferSource(); src.buffer = noise; src.loop = true;
      const filter = ctx.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.value = freq; filter.Q.value = q;
      const gain = ctx.createGain(); gain.gain.value = 0;
      src.connect(filter); filter.connect(gain); gain.connect(bus); src.start();
      return { filter, gain };
    };
    nodes = { master, bus, padFilter, padGain, pad, murk: band(280, 0.7), wind: band(900, 0.5) };
    setInterval(tick, 700);
  }

  function bell(freq, vol, dur = 2.4) {
    const t = ctx.currentTime;
    const a = ctx.createOscillator(), b = ctx.createOscillator(), env = ctx.createGain(), bGain = ctx.createGain();
    a.frequency.value = freq; b.frequency.value = freq * 2.01; bGain.gain.value = 0.25;
    env.gain.setValueAtTime(0, t); env.gain.linearRampToValueAtTime(vol, t + 0.015); env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    a.connect(env); b.connect(bGain); bGain.connect(env); env.connect(nodes.bus);
    a.start(t); b.start(t); a.stop(t + dur + 0.1); b.stop(t + dur + 0.1);
  }

  function tick() {
    const f = on && getFrame();
    if (!f) return;
    const now = ctx.currentTime;
    const temp = f.temp ?? 12, ph = f.ph ?? 7;
    const doN = clamp((f.doPct ?? 90) / 100, 0.05, 1.3), oxy = Math.min(1, doN);

    const root = snap(40 + clamp((temp - 1) / 24, 0, 1) * 14);
    nodes.pad.forEach(({ osc, interval }) => osc.frequency.setTargetAtTime(midi(snap(root + interval)), now, 1.5));
    nodes.padGain.gain.setTargetAtTime(0.25 + 0.5 * oxy, now, 1.2);
    nodes.padFilter.frequency.setTargetAtTime(280 + 1700 * oxy, now, 1.2);
    nodes.murk.gain.gain.setTargetAtTime(clamp((f.turb ?? 5) / 50, 0, 1) * 0.55, now, 1);
    nodes.wind.gain.gain.setTargetAtTime(f.windN * 0.18, now, 1);
    nodes.wind.filter.frequency.setTargetAtTime(500 + f.windN * 1200, now, 1);

    // Melody walks toward a register set by pH
    const target = Math.round(lerp(4, 12, clamp((ph - 6.3) / 1.4, 0, 1)));
    melody += Math.sign(target - melody) * (Math.random() < 0.6 ? 1 : 0);
    if (Math.random() < 0.25) melody += Math.random() < 0.5 ? -1 : 1;
    if (++step % 2 === 0) bell(midi(snap(48 + degree(melody) + ((root - 45) % 12))), 0.09 * oxy + 0.03);

    const drips = Math.round(clamp(f.rain, 0, 6) * 1.6 * (Math.random() + 0.3));
    for (let i = 0; i < drips; i++) setTimeout(() => on && bell(midi(snap(76 + Math.floor(Math.random() * 14))), 0.035, 0.9), Math.random() * 650);
  }

  return {
    setOn(value) {
      if (value && !ctx) init();
      on = value;
      if (ctx) { ctx.resume(); nodes.master.gain.setTargetAtTime(on ? 0.7 : 0, ctx.currentTime, 0.4); }
    },
  };
}
