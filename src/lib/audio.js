// Calm ambient soundscape, built with the Web Audio API. Every sound follows a reading.
//
//   SOUND            READING              HOW
//   warm chord       water temperature    warmer water = higher chord
//   chord brightness dissolved oxygen     more oxygen = brighter and fuller, low oxygen = dull and thin
//   bell melody      pH                   higher pH = higher notes
//   water wash       turbidity            murkier water = louder, lower wash
//   airy hiss        wind                 more wind = louder, higher hiss
//   high drips       rain                 more rain = more drips
//
// Notes snap to a pentatonic scale so it always sounds like music, not an alarm.

import { clamp, lerp } from './data.js';

const PENT = [0, 2, 4, 7, 9]; // C major pentatonic: C D E G A
const STEP_MS = 600; // one melody step
const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

/** Move a MIDI note to the nearest note of the scale. */
function snap(m) {
  const octave = Math.floor(m / 12), d = ((m % 12) + 12) % 12;
  let best = PENT[0];
  for (const p of PENT) if (Math.abs(p - d) < Math.abs(best - d)) best = p;
  return octave * 12 + best;
}
/** The i-th note of the scale, counting up from C. */
const degree = (i) => Math.floor(i / 5) * 12 + PENT[((i % 5) + 5) % 5];

function noiseBuffer(ctx) {
  const b = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate), d = b.getChannelData(0);
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
  let ctx = null, on = false, n = null, melody = 7, step = 0, meter = null;

  function init() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();

    // Output chain: everything -> bus -> (dry + reverb) -> limiter -> master volume -> speakers
    const master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
    const analyser = ctx.createAnalyser(); analyser.fftSize = 2048; master.connect(analyser);
    meter = { analyser, buf: new Float32Array(analyser.fftSize) };
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -14; limiter.ratio.value = 6; limiter.attack.value = 0.01; limiter.release.value = 0.3;
    limiter.connect(master);
    const reverb = ctx.createConvolver(); reverb.buffer = reverbImpulse(ctx);
    const wet = ctx.createGain(); wet.gain.value = 0.5; reverb.connect(wet); wet.connect(limiter);
    const dry = ctx.createGain(); dry.gain.value = 0.85; dry.connect(limiter);
    const bus = ctx.createGain(); bus.connect(dry); bus.connect(reverb);

    // Chord: four voices through a low-pass filter. A slow wobble makes it breathe.
    const padFilter = ctx.createBiquadFilter(); padFilter.type = 'lowpass'; padFilter.frequency.value = 700; padFilter.Q.value = 0.5;
    const padGain = ctx.createGain(); padGain.gain.value = 0; padFilter.connect(padGain); padGain.connect(bus);
    const breath = ctx.createOscillator(); breath.frequency.value = 0.09;
    const breathDepth = ctx.createGain(); breathDepth.gain.value = 160;
    breath.connect(breathDepth); breathDepth.connect(padFilter.frequency); breath.start();
    const pad = [-12, 0, 7, 16].map((interval, k) => {
      const osc = ctx.createOscillator(); osc.type = k === 0 ? 'sine' : 'triangle'; osc.frequency.value = 220; osc.detune.value = (k - 1.5) * 6;
      const g = ctx.createGain(); g.gain.value = [0.1, 0.2, 0.15, 0.1][k];
      osc.connect(g); g.connect(padFilter); osc.start();
      return { osc, interval };
    });

    // Noise layers. Each one swells slowly so it sounds like water and air, not static.
    const noise = noiseBuffer(ctx);
    const layer = (freq, q, swellHz) => {
      const src = ctx.createBufferSource(); src.buffer = noise; src.loop = true;
      const filter = ctx.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.value = freq; filter.Q.value = q;
      const swell = ctx.createGain(); swell.gain.value = 0.6;
      const lfo = ctx.createOscillator(); lfo.frequency.value = swellHz;
      const lfoDepth = ctx.createGain(); lfoDepth.gain.value = 0.4;
      lfo.connect(lfoDepth); lfoDepth.connect(swell.gain); lfo.start();
      const gain = ctx.createGain(); gain.gain.value = 0;
      src.connect(filter); filter.connect(swell); swell.connect(gain); gain.connect(bus); src.start();
      return { filter, gain };
    };
    n = { master, bus, padFilter, padGain, pad, wash: layer(420, 0.8, 0.13), wind: layer(1400, 0.6, 0.07) };

    update(0.05);
    setInterval(tick, STEP_MS);
  }

  /** A soft bell: two sine waves with a fast attack and a long fade. */
  function bell(freq, vol, dur = 2.6) {
    const t = ctx.currentTime;
    const a = ctx.createOscillator(), b = ctx.createOscillator(), env = ctx.createGain(), bGain = ctx.createGain();
    a.frequency.value = freq; b.frequency.value = freq * 2.01; bGain.gain.value = 0.2;
    env.gain.setValueAtTime(0, t); env.gain.linearRampToValueAtTime(vol, t + 0.02); env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    a.connect(env); b.connect(bGain); bGain.connect(env); env.connect(n.bus);
    a.start(t); b.start(t); a.stop(t + dur + 0.1); b.stop(t + dur + 0.1);
  }

  /** Point the continuous sounds (chord, wash, hiss) at the current readings. */
  function update(glide = 1.2) {
    const f = getFrame();
    if (!f) return null;
    const now = ctx.currentTime;
    const oxy = clamp((f.doPct ?? 90) / 100, 0.05, 1);
    const murk = clamp((f.turb ?? 5) / 50, 0, 1);

    // Temperature picks the chord: 1°C is a low C, 25°C is more than an octave higher.
    const root = snap(48 + clamp(((f.temp ?? 12) - 1) / 24, 0, 1) * 14);
    n.pad.forEach(({ osc, interval }) => osc.frequency.setTargetAtTime(midi(snap(root + interval)), now, glide));
    n.padGain.gain.setTargetAtTime(0.3 + 0.5 * oxy, now, glide);
    n.padFilter.frequency.setTargetAtTime(350 + 1900 * oxy, now, glide);

    n.wash.gain.gain.setTargetAtTime(0.03 + murk * 0.22, now, glide);
    n.wash.filter.frequency.setTargetAtTime(520 - murk * 260, now, glide);
    n.wind.gain.gain.setTargetAtTime(f.windN * 0.12, now, glide);
    n.wind.filter.frequency.setTargetAtTime(900 + f.windN * 1400, now, glide);
    return { f, oxy, root };
  }

  function tick() {
    if (!on) return;
    const state = update();
    if (!state) return;
    const { f, oxy, root } = state;
    step++;

    // Melody: pH sets the register it drifts toward. A note every other step, with rests.
    const target = Math.round(lerp(5, 13, clamp(((f.ph ?? 7) - 6.3) / 1.4, 0, 1)));
    if (step % 2 === 0 && Math.random() < 0.85) {
      const pull = Math.sign(target - melody);
      melody += Math.random() < 0.65 ? pull : Math.random() < 0.5 ? -1 : 1;
      melody = clamp(melody, 3, 15);
      bell(midi(48 + degree(melody)), 0.07 + 0.08 * oxy);
    }
    // Every 16 steps, a low bell on the chord's root marks the bar.
    if (step % 16 === 0) bell(midi(root), 0.12, 4);

    // Rain: drips, more of them the harder it rains.
    const drips = Math.round(clamp(f.rain, 0, 6) * 1.5 * (Math.random() + 0.3));
    for (let i = 0; i < drips; i++) {
      setTimeout(() => on && bell(midi(84 + degree(Math.floor(Math.random() * 6))), 0.04, 0.7), Math.random() * STEP_MS);
    }
  }

  return {
    setOn(value) {
      if (value && !ctx) init();
      on = value;
      if (ctx) { ctx.resume(); n.master.gain.setTargetAtTime(on ? 1.15 : 0, ctx.currentTime, 0.4); }
    },
    /** Current loudness, 0 to about 1. Used to check the sound is really playing. */
    level() {
      if (!meter) return 0;
      meter.analyser.getFloatTimeDomainData(meter.buf);
      let sum = 0, peak = 0;
      for (const v of meter.buf) { sum += v * v; peak = Math.max(peak, Math.abs(v)); }
      return { rms: Math.sqrt(sum / meter.buf.length), peak, state: ctx.state };
    },
  };
}
