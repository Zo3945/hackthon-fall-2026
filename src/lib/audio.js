// The pond's soundtrack, built with the Web Audio API. No audio files: every sound is made in code.
// The style is slow, sparse piano with a long echo, in the spirit of calm sandbox-game music.
// Every part follows a reading from the pond.
//
//   SOUND               READING              HOW
//   key of the music    water temperature    warmer water = the whole piece sits higher
//   how much is played  dissolved oxygen     more oxygen = fuller phrases and brighter tone,
//                                            low oxygen = a few slow, dull notes
//   melody height       pH                   higher pH = the piano plays higher
//   low water wash      turbidity            murkier water = louder, deeper wash
//   airy hiss           wind                 more wind = louder, higher hiss
//   high piano drips    rain                 more rain = more drips
//
// Notes snap to a pentatonic scale so it always sounds like music, not an alarm.

import { clamp, lerp } from './data.js';

const PENT = [0, 2, 4, 7, 9]; // major pentatonic: 1 2 3 5 6
const STEP_MS = 850; // one slow beat
const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);
/** The i-th note of the pentatonic scale above a key note. */
const degree = (i) => Math.floor(i / 5) * 12 + PENT[((i % 5) + 5) % 5];
const chance = (p) => Math.random() < p;

function noiseBuffer(ctx) {
  const b = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate), d = b.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
  return b;
}
/** A long, soft room: the "big empty world" echo. */
function reverbImpulse(ctx, seconds = 5) {
  const len = ctx.sampleRate * seconds, b = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
  return b;
}

/** getFrame() returns the current readings (see readFrame in data.js). */
export function createAudio(getFrame) {
  let ctx = null, on = false, n = null, meter = null;
  // Melody state: where the piano is, how many notes are left in the phrase, how long to rest.
  let melody = 7, phraseLeft = 0, rest = 2, step = 0;

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
    const wet = ctx.createGain(); wet.gain.value = 0.7; reverb.connect(wet); wet.connect(limiter);
    const dry = ctx.createGain(); dry.gain.value = 0.75; dry.connect(limiter);
    const bus = ctx.createGain(); bus.connect(dry); bus.connect(reverb);

    // Piano tone control: oxygen opens or closes this filter.
    const pianoTone = ctx.createBiquadFilter(); pianoTone.type = 'lowpass'; pianoTone.frequency.value = 2400; pianoTone.Q.value = 0.3;
    pianoTone.connect(bus);

    // Noise layers. Each one swells slowly so it sounds like water and air, not static.
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
    n = { master, bus, pianoTone, wash: layer(420, 0.8, 0.13), wind: layer(1400, 0.6, 0.07) };

    update(0.05);
    setInterval(tick, STEP_MS);
  }

  /**
   * A soft piano note: a stack of sine waves (the note plus its overtones).
   * Higher overtones are quieter and fade faster, which is what makes a piano sound like a piano.
   */
  function piano(note, vol, delay = 0) {
    const t = ctx.currentTime + delay, freq = midi(note);
    const dur = clamp(5.5 - (note - 48) * 0.06, 2, 6); // low notes ring longer
    const out = ctx.createGain(); out.gain.value = vol; out.connect(n.pianoTone);
    [[1, 1, 1], [2, 0.42, 0.55], [3, 0.2, 0.35], [4.02, 0.1, 0.22], [5.03, 0.05, 0.15]].forEach(([mult, amp, life]) => {
      const osc = ctx.createOscillator(), env = ctx.createGain();
      osc.frequency.value = freq * mult * (1 + (Math.random() - 0.5) * 0.0015); // tiny detune, like real strings
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(amp, t + 0.012); // soft hammer
      env.gain.exponentialRampToValueAtTime(amp * 0.35, t + 0.25 * life + 0.05); // quick first drop
      env.gain.exponentialRampToValueAtTime(0.0001, t + dur * life); // long tail
      osc.connect(env); env.connect(out);
      osc.start(t); osc.stop(t + dur * life + 0.1);
    });
  }

  /** Point the continuous sounds (wash, hiss, piano tone) at the current readings. */
  function update(glide = 1.5) {
    const f = getFrame();
    if (!f) return null;
    const now = ctx.currentTime;
    const oxy = clamp((f.doPct ?? 90) / 100, 0.05, 1);
    const murk = clamp((f.turb ?? 5) / 50, 0, 1);

    // Temperature picks the key: 1°C sits around A, 25°C is seven semitones higher.
    const key = Math.round(45 + clamp(((f.temp ?? 12) - 1) / 24, 0, 1) * 7);
    n.pianoTone.frequency.setTargetAtTime(700 + 3200 * oxy, now, glide);

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

    // The piano plays short phrases with silence between them.
    if (phraseLeft > 0) {
      if (chance(0.5 + 0.4 * oxy)) {
        // pH sets the height the melody drifts toward.
        const target = Math.round(lerp(5, 12, clamp(((f.ph ?? 7) - 6.3) / 1.4, 0, 1)));
        const pull = Math.sign(target - melody);
        melody = clamp(melody + (chance(0.6) ? pull : chance(0.5) ? -1 : 1) * (chance(0.2) ? 2 : 1), 3, 15);
        const note = key + 12 + degree(melody);
        piano(note, 0.16 + 0.1 * oxy);
        if (chance(0.3 * oxy)) piano(key + 12 + degree(melody - 2), 0.1, 0.03); // a soft harmony note underneath
        if (chance(0.25 * oxy)) piano(key + 12 + degree(melody + 1), 0.11, STEP_MS / 2000); // a quick in-between note
      }
      phraseLeft--;
      if (phraseLeft === 0) rest = Math.round(lerp(7, 3, oxy) + Math.random() * 3); // less oxygen = longer silences
    } else if (--rest <= 0) {
      phraseLeft = Math.round(2 + oxy * 4 + Math.random() * 2);
      piano(key + degree(chance(0.7) ? 0 : 3), 0.2); // a low note opens each phrase
      if (chance(0.5)) piano(key + 7, 0.1, 0.04);
    }

    // Rain: high, short piano drips.
    const drips = Math.round(clamp(f.rain, 0, 6) * 1.2 * (Math.random() + 0.3));
    for (let i = 0; i < drips; i++) piano(key + 36 + degree(Math.floor(Math.random() * 6)), 0.05, Math.random() * (STEP_MS / 1000));
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
