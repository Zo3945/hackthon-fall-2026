// The pond's music, all made in code with Web Audio (no sound files).
// Water temp sets the key, oxygen sets how much gets played, pH sets how high the melody sits.
// Murk = low water wash, wind = hiss, rain = high drips, lightning = thunder, sensor gap = silence.

import { clamp, lerp } from './data.js';
import { sunPosition } from './scene.js';

const PENT = [0, 2, 4, 7, 9]; // pentatonic so it never sounds wrong
const STEP_MS = 980; // one slow beat
const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);
const degree = (i) => Math.floor(i / 5) * 12 + PENT[((i % 5) + 5) % 5];
const chance = (p) => Math.random() < p;

function noiseBuffer(ctx) {
  const b = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate), d = b.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
  return b;
}
// long soft echo
function reverbImpulse(ctx, seconds = 6.5) {
  const len = ctx.sampleRate * seconds, b = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
  return b;
}

export function createAudio(getFrame, onNote) {
  let ctx = null, on = false, n = null, meter = null;
  let melody = 7, phraseLeft = 0, rest = 2, step = 0;

  function init() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();

    // bus -> dry + echo -> limiter -> volume -> speakers
    const master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
    const analyser = ctx.createAnalyser(); analyser.fftSize = 2048; master.connect(analyser);
    meter = { analyser, buf: new Float32Array(analyser.fftSize) };
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -14; limiter.ratio.value = 6; limiter.attack.value = 0.01; limiter.release.value = 0.3;
    limiter.connect(master);
    const reverb = ctx.createConvolver(); reverb.buffer = reverbImpulse(ctx);
    const wet = ctx.createGain(); wet.gain.value = 0.95; reverb.connect(wet); wet.connect(limiter);
    const dry = ctx.createGain(); dry.gain.value = 0.6; dry.connect(limiter);
    const bus = ctx.createGain(); bus.connect(dry); bus.connect(reverb);

    // oxygen brightens or dulls the piano through this filter
    const pianoTone = ctx.createBiquadFilter(); pianoTone.type = 'lowpass'; pianoTone.frequency.value = 2400; pianoTone.Q.value = 0.3;
    pianoTone.connect(bus);
    // slight wobble on every note, like an old tape
    const wobble = ctx.createOscillator(); wobble.frequency.value = 0.23;
    const wow = ctx.createGain(); wow.gain.value = 5;
    wobble.connect(wow); wobble.start();

    // noise layers that slowly swell, so they sound like water/air instead of static
    const noise = noiseBuffer(ctx);
    const layer = (freq, q, swellHz) => {
      const src = ctx.createBufferSource(); src.buffer = noise; src.loop = true;
      const filter = ctx.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.value = freq; filter.Q.value = q;
      const level = ctx.createGain(); level.gain.value = 0.6;
      const lfo = ctx.createOscillator(); lfo.frequency.value = swellHz;
      const lfoDepth = ctx.createGain(); lfoDepth.gain.value = 0.4;
      lfo.connect(lfoDepth); lfoDepth.connect(level.gain); lfo.start();
      const gain = ctx.createGain(); gain.gain.value = 0;
      src.connect(filter); filter.connect(level); level.connect(gain); gain.connect(bus); src.start();
      return { filter, gain };
    };
    n = { master, bus, noise, pianoTone, wow, wash: layer(420, 0.8, 0.13), wind: layer(1400, 0.6, 0.07) };

    update(0.05);
    setInterval(tick, STEP_MS);
    setInterval(nightLife, 100);
  }

  // soft piano note: a few stacked sine waves, the high ones fade first
  function piano(note, vol, delay = 0) {
    const t = ctx.currentTime + delay, freq = midi(note);
    // let the scene ripple the water in time
    if (onNote && vol >= 0.09) setTimeout(() => on && onNote(note, vol), delay * 1000);
    const dur = clamp(6.5 - (note - 48) * 0.07, 2.5, 7); // low notes ring longer
    const out = ctx.createGain(); out.gain.value = vol; out.connect(n.pianoTone);
    // [overtone, volume, length, detune]
    [[1, 1, 1, -3], [1, 0.6, 1, 4], [2, 0.3, 0.5, 0], [3, 0.1, 0.3, 0], [4.02, 0.04, 0.2, 0]].forEach(([mult, amp, life, cents]) => {
      const osc = ctx.createOscillator(), env = ctx.createGain();
      osc.frequency.value = freq * mult; osc.detune.value = cents;
      n.wow.connect(osc.detune);
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(amp, t + 0.03);
      env.gain.exponentialRampToValueAtTime(amp * 0.4, t + 0.3 * life + 0.06);
      env.gain.exponentialRampToValueAtTime(0.0001, t + dur * life);
      osc.connect(env); env.connect(out);
      osc.start(t); osc.stop(t + dur * life + 0.1);
      // unhook from the wobble when done, otherwise every note ever played stays in memory
      osc.onended = () => { n.wow.disconnect(osc.detune); osc.disconnect(); env.disconnect(); };
    });
  }

  // move the background sounds toward the current readings
  function update(glide = 1.5) {
    const f = getFrame();
    if (!f) return null;
    const now = ctx.currentTime;
    const oxy = clamp((f.doPct ?? 90) / 100, 0.05, 1);
    const murk = clamp((f.turb ?? 5) / 50, 0, 1);

    // warmer water = higher key
    const key = Math.round(45 + clamp(((f.temp ?? 12) - 1) / 24, 0, 1) * 7);
    n.pianoTone.frequency.setTargetAtTime(600 + 2000 * oxy, now, glide);

    n.wash.gain.gain.setTargetAtTime(0.02 + murk * 0.2, now, glide);
    n.wash.filter.frequency.setTargetAtTime(520 - murk * 260, now, glide);
    n.wind.gain.gain.setTargetAtTime(f.windN * 0.1, now, glide);
    n.wind.filter.frequency.setTargetAtTime(900 + f.windN * 1400, now, glide);
    return { f, oxy, key };
  }

  function tick() {
    if (!on) return;
    const state = update();
    if (!state) return;
    const { f, oxy, key } = state;
    step++;
    if (f.gap) { phraseLeft = 0; return; } // no data, no music

    // short phrases with rests in between
    if (phraseLeft > 0) {
      if (chance(0.5 + 0.4 * oxy)) {
        // melody drifts toward a height set by pH
        const target = Math.round(lerp(5, 12, clamp(((f.ph ?? 7) - 6.3) / 1.4, 0, 1)));
        const pull = Math.sign(target - melody);
        melody = clamp(melody + (chance(0.6) ? pull : chance(0.5) ? -1 : 1) * (chance(0.2) ? 2 : 1), 3, 15);
        const note = key + 12 + degree(melody);
        piano(note, 0.16 + 0.1 * oxy);
        if (chance(0.3 * oxy)) piano(key + 12 + degree(melody - 2), 0.1, 0.03); // harmony
        if (chance(0.25 * oxy)) piano(key + 12 + degree(melody + 1), 0.11, STEP_MS / 2000);
      }
      phraseLeft--;
      if (phraseLeft === 0) {
        if (chance(0.6)) piano(key + 12 + degree(chance(0.5) ? 5 : 7), 0.14, STEP_MS / 1000); // end on a home note
        rest = Math.round(lerp(8, 4, oxy) + Math.random() * 3); // low oxygen = longer silences
      }
    } else if (--rest <= 0) {
      phraseLeft = Math.round(2 + oxy * 4 + Math.random() * 2);
      // each phrase starts with a slow rolled chord
      const beat = STEP_MS / 1000, top = chance(0.5) ? 14 : 16;
      piano(key, 0.2); piano(key + 7, 0.14, beat * 0.5); piano(key + top, 0.13, beat);
    }

    // rain = little high drips
    const drips = Math.round(clamp(f.rain, 0, 6) * 1.2 * (Math.random() + 0.3));
    for (let i = 0; i < drips; i++) piano(key + 36 + degree(Math.floor(Math.random() * 6)), 0.05, Math.random() * (STEP_MS / 1000));
  }

  // rumble a beat after the flash
  function thunder() {
    if (!on || !ctx) return;
    const t = ctx.currentTime + 0.3;
    const src = ctx.createBufferSource(); src.buffer = n.noise; src.loop = true;
    const low = ctx.createBiquadFilter(); low.type = 'lowpass'; low.frequency.setValueAtTime(220, t); low.frequency.exponentialRampToValueAtTime(55, t + 3);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t); env.gain.linearRampToValueAtTime(1.6, t + 0.08);
    env.gain.exponentialRampToValueAtTime(0.5, t + 0.7); env.gain.exponentialRampToValueAtTime(0.0001, t + 3.8);
    src.connect(low); low.connect(env); env.connect(n.bus);
    src.start(t, Math.random() * 3); src.stop(t + 4);
  }

  function cricket(t) {
    for (let k = 0; k < 3; k++) {
      const osc = ctx.createOscillator(), env = ctx.createGain(), start = t + k * 0.05;
      osc.frequency.value = 4200 + Math.random() * 250;
      env.gain.setValueAtTime(0, start); env.gain.linearRampToValueAtTime(0.02, start + 0.006); env.gain.exponentialRampToValueAtTime(0.0001, start + 0.04);
      osc.connect(env); env.connect(n.bus); osc.start(start); osc.stop(start + 0.05);
    }
  }

  function frog(t) {
    for (let k = 0; k < 2; k++) {
      const start = t + k * 0.45;
      const osc = ctx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.setValueAtTime(190, start); osc.frequency.linearRampToValueAtTime(150, start + 0.3);
      const tone = ctx.createBiquadFilter(); tone.type = 'bandpass'; tone.frequency.value = 600; tone.Q.value = 2;
      const pulse = ctx.createOscillator(); pulse.type = 'square'; pulse.frequency.value = 38;
      const pulseDepth = ctx.createGain(); pulseDepth.gain.value = 0.03;
      const env = ctx.createGain(); env.gain.setValueAtTime(0, start); env.gain.linearRampToValueAtTime(0.035, start + 0.03); env.gain.linearRampToValueAtTime(0, start + 0.32);
      pulse.connect(pulseDepth); pulseDepth.connect(env.gain);
      osc.connect(tone); tone.connect(env); env.connect(n.bus);
      osc.start(start); pulse.start(start); osc.stop(start + 0.34); pulse.stop(start + 0.34);
    }
  }

  // crickets + frogs on warm dry nights. crickets chirp faster when it's warmer (Dolbear's law)
  let nextChirp = 0;
  function nightLife() {
    const f = on && getFrame();
    if (!f || f.gap) return;
    const sun = sunPosition(f.timeMs), air = f.air ?? f.temp;
    if ((sun > -0.02 && sun < 1.02) || air == null || air < 13 || f.rain > 0.5) return;
    const now = ctx.currentTime;
    if (now < nextChirp) return;
    const chirpsPerSecond = clamp(((air * 9) / 5 + 32 - 40) / 14, 0.6, 3.5);
    nextChirp = now + (0.85 + Math.random() * 0.3) / chirpsPerSecond;
    cricket(now + 0.02);
    if (Math.random() < 0.03 && (f.temp ?? 0) >= 15) frog(now + 0.2);
  }

  return {
    thunder,
    setOn(value) {
      if (value && !ctx) init();
      on = value;
      if (ctx) { ctx.resume(); n.master.gain.setTargetAtTime(on ? 1.15 : 0, ctx.currentTime, 0.4); }
    },
    // loudness check, used while testing
    level() {
      if (!meter) return 0;
      meter.analyser.getFloatTimeDomainData(meter.buf);
      let sum = 0, peak = 0;
      for (const v of meter.buf) { sum += v * v; peak = Math.max(peak, Math.abs(v)); }
      return { rms: Math.sqrt(sum / meter.buf.length), peak, state: ctx.state };
    },
  };
}
