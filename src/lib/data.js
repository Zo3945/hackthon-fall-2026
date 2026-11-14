// Pond data: loading, live fetching, and reading values at any point in time.

export const COLS = ['Temp', 'DOpct', 'Turb', 'pH', 'Cond', 'Rain', 'WindSpeed', 'AirTemp', 'Lightning'];
const COUNTED = ['Rain', 'Lightning']; // added up per hour, where the others are averaged
export const HOUR = 3600000;

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;

// Values outside these ranges are sensor faults, not the pond.
const LIMITS = {
  Temp: [0, 40], DOpct: [1, 200], Turb: [0.05, 1000], pH: [4, 10],
  Cond: [50, 3000], WindSpeed: [0, 150], AirTemp: [-30, 45],
};

/** Hourly rows of readings, with smooth lookups between hours. */
export class Series {
  constructor({ rows, startMs, lastMs }) {
    this.rows = rows;
    this.startMs = startMs;
    this.lastMs = lastMs ?? startMs + (rows.length - 1) * HOUR;
    this.n = rows.length;
    this.cache = {};
  }

  col(name) {
    if (!this.cache[name]) {
      const i = COLS.indexOf(name);
      this.cache[name] = this.rows.map((r) => r[i]);
    }
    return this.cache[name];
  }

  nearest(s, i) {
    for (let d = 1; d < 400; d++) {
      if (i - d >= 0 && s[i - d] != null) return s[i - d];
      if (i + d < this.n && s[i + d] != null) return s[i + d];
    }
    return null;
  }

  /** Value of a column at a fractional hour position. Gaps use the nearest reading. */
  val(name, pos) {
    const s = this.col(name);
    const i = Math.floor(pos);
    const f = pos - i;
    let a = s[clamp(i, 0, this.n - 1)];
    let b = s[clamp(i + 1, 0, this.n - 1)];
    if (a == null) a = this.nearest(s, i);
    if (b == null) b = this.nearest(s, i + 1);
    if (a == null) return null;
    if (b == null) b = a;
    return lerp(a, b, f);
  }

  isGap(pos) {
    return this.col('Temp')[clamp(Math.round(pos), 0, this.n - 1)] == null;
  }

  timeAt(pos) {
    return this.startMs + pos * HOUR;
  }
}

/** 2nd to 98th percentile range per column, used to scale values to 0..1. */
export function computeNorm(series) {
  const norm = {};
  for (const c of COLS) {
    const v = series.col(c).filter((x) => x != null).sort((a, b) => a - b);
    norm[c] = { lo: v[Math.floor(v.length * 0.02)], hi: v[Math.floor(v.length * 0.98)] };
  }
  return norm;
}

export function n01(norm, c, v) {
  if (v == null) return 0.5;
  const { lo, hi } = norm[c];
  return clamp((v - lo) / (hi - lo || 1), 0, 1);
}

/** Everything the scene, the sound and the text need for one moment. */
export function readFrame(series, pos, norm) {
  const wind = series.val('WindSpeed', pos);
  return {
    temp: series.val('Temp', pos),
    doPct: series.val('DOpct', pos),
    turb: series.val('Turb', pos),
    ph: series.val('pH', pos),
    cond: series.val('Cond', pos), // conductivity: how much salt and minerals are dissolved in the water
    rain: series.val('Rain', pos) ?? 0,
    lightning: series.col('Lightning')[clamp(Math.round(pos), 0, series.n - 1)] ?? 0, // strikes counted this hour
    air: series.val('AirTemp', pos),
    wind,
    windN: n01(norm, 'WindSpeed', wind),
    timeMs: series.timeAt(pos),
    gap: series.isGap(pos),
  };
}

/** Recorded history, cleaned by scripts/prep_data.py. */
export async function loadHistory() {
  const r = await fetch('data/pond.json');
  if (!r.ok) throw new Error('history ' + r.status);
  const j = await r.json();
  return new Series({ rows: j.rows, startMs: Date.parse(j.start) });
}

/** Last 7 days from the Blue CoLab API, averaged into hours. */
export async function fetchLive() {
  const get = async (station) => {
    const r = await fetch(`api/mneme/sensordata/${station}/delta?days=7`);
    if (!r.ok) throw new Error(`${station} ${r.status}`);
    return r.json();
  };
  const [water, weather] = await Promise.all([get('Alan'), get('Odin').catch(() => [])]);

  const buckets = new Map();
  let lo = Infinity, hi = -Infinity, lastMs = 0;
  const add = (records, cols, isWater) => {
    for (const rec of records) {
      const ms = Date.parse(rec.time);
      if (Number.isNaN(ms)) continue;
      const h = Math.floor(ms / HOUR);
      if (isWater) { lo = Math.min(lo, h); hi = Math.max(hi, h); lastMs = Math.max(lastMs, ms); }
      let b = buckets.get(h);
      if (!b) { b = {}; buckets.set(h, b); }
      for (const c of cols) {
        const x = rec.sensors?.[c === 'Lightning' ? 'LightningStrikes' : c];
        if (typeof x !== 'number') continue;
        const lim = LIMITS[c];
        if (lim && (x < lim[0] || x > lim[1])) continue;
        (b[c] ||= []).push(x);
      }
    }
  };
  add(water, ['Temp', 'DOpct', 'Turb', 'pH', 'Cond'], true);
  add(weather, ['Rain', 'WindSpeed', 'AirTemp', 'Lightning'], false);
  if (!Number.isFinite(lo)) throw new Error('no live water data');

  const rows = [];
  for (let h = lo; h <= hi; h++) {
    const b = buckets.get(h) || {};
    rows.push(COLS.map((c) => {
      const v = b[c];
      if (!v?.length) return COUNTED.includes(c) ? 0 : null;
      const sum = v.reduce((a, x) => a + x, 0);
      return COUNTED.includes(c) ? sum : sum / v.length;
    }));
  }
  // A flat oxygen line for six hours means a stuck sensor, not a calm pond. Drop it.
  const o = COLS.indexOf('DOpct');
  for (let i = 0; i + 6 <= rows.length; i++) {
    const w = rows.slice(i, i + 6).map((r) => r[o]);
    if (w.every((v) => v != null) && Math.max(...w) - Math.min(...w) <= 0.15) w.forEach((_, k) => { rows[i + k].stuck = true; });
  }
  for (const r of rows) if (r.stuck) r[o] = null;

  return new Series({ rows, startMs: lo * HOUR, lastMs });
}

/** Interesting moments in the history, for the "Jump to" buttons. */
export function findEvents(series) {
  const best = (name, score = (x) => x) => {
    let top = -Infinity, at = 0;
    series.col(name).forEach((v, i) => { if (v != null && score(v) > top) { top = score(v); at = i; } });
    return at;
  };
  // Like best(), but scores the 3-hour average, so a one-hour sensor blip can't win.
  const steady = (name, score = (x) => x, allowed = () => true) => {
    const s = series.col(name);
    let top = -Infinity, at = 0;
    for (let i = 1; i < series.n - 1; i++) {
      if (s[i - 1] == null || s[i] == null || s[i + 1] == null || !allowed(i)) continue;
      const v = score((s[i - 1] + s[i] + s[i + 1]) / 3);
      if (v > top) { top = v; at = i; }
    }
    return at;
  };
  const rain = series.col('Rain');
  let stormSum = 0, stormAt = 0;
  for (let i = 0; i < series.n - 12; i++) {
    let sum = 0;
    for (let k = 0; k < 12; k++) sum += rain[i + k] || 0;
    if (sum > stormSum) { stormSum = sum; stormAt = i; }
  }
  // Land on the wettest hour of that storm, not the calm before it.
  let peakAt = stormAt;
  for (let k = 0; k < 12; k++) if ((rain[stormAt + k] || 0) > (rain[peakAt] || 0)) peakAt = stormAt + k;
  // Snow: the wettest hour while the air was at or below freezing (0.5°C allows for sensor error)
  const air = series.col('AirTemp');
  let snowAt = 0, snowMost = 0;
  rain.forEach((v, i) => { if (v > snowMost && air[i] != null && air[i] <= 0.5) { snowMost = v; snowAt = i; } });

  return [
    { label: 'Biggest storm', pos: peakAt },
    { label: 'Warmest water', pos: best('Temp') },
    // Only in water above 50°F: the near-zero winter readings follow a stuck-sensor stretch and are not trusted here.
    { label: 'Lowest oxygen', pos: steady('DOpct', (x) => -x, (i) => (series.col('Temp')[i] ?? 0) >= 10) },
    { label: 'Murkiest water', pos: steady('Turb') },
    { label: 'Coldest day', pos: best('Temp', (x) => -x) },
    { label: 'Snow day', pos: snowAt },
  ];
}
