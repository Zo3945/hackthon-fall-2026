// Loads the pond data (recorded + live) and reads values at any moment.

export const COLS = ['Temp', 'DOpct', 'Turb', 'pH', 'Cond', 'Rain', 'WindSpeed', 'AirTemp', 'Lightning', 'WindDir'];
const COUNTED = ['Rain', 'Lightning']; // these get added up per hour, the rest get averaged
export const HOUR = 3600000;

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;

// anything outside these is a broken sensor, not the pond
const LIMITS = {
  Temp: [0, 40], DOpct: [1, 200], Turb: [0.05, 1000], pH: [4, 10],
  Cond: [50, 3000], WindSpeed: [0, 150], AirTemp: [-30, 45], WindDir: [0, 360],
};

const MAX_REACH = 400; // how many hours we'll look for a reading to cover a gap

/** Gaps swapped for the closest real reading (earlier one wins a tie). Done once, not every frame. */
function fillGaps(s) {
  const n = s.length, out = s.slice();
  const prev = new Array(n), next = new Array(n);
  for (let i = 0, last = -1; i < n; i++) { if (s[i] != null) last = i; prev[i] = last; }
  for (let i = n - 1, last = -1; i >= 0; i--) { if (s[i] != null) last = i; next[i] = last; }
  for (let i = 0; i < n; i++) {
    if (s[i] != null) continue;
    const dp = prev[i] < 0 ? Infinity : i - prev[i], dn = next[i] < 0 ? Infinity : next[i] - i;
    const d = Math.min(dp, dn);
    out[i] = d < MAX_REACH ? s[dp <= dn ? prev[i] : next[i]] : null;
  }
  return out;
}

export class Series {
  constructor({ rows, startMs, lastMs }) {
    this.rows = rows;
    this.startMs = startMs;
    this.lastMs = lastMs ?? startMs + (rows.length - 1) * HOUR;
    this.n = rows.length;
    this.cache = {};
    this.filledCache = {};
  }

  col(name) {
    if (!this.cache[name]) {
      const i = COLS.indexOf(name);
      this.cache[name] = this.rows.map((r) => r[i]);
    }
    return this.cache[name];
  }

  filled(name) {
    return (this.filledCache[name] ||= fillGaps(this.col(name)));
  }

  /** Value at a fractional hour, blended between the two hours around it. */
  val(name, pos) {
    const s = this.filled(name);
    const i = Math.floor(pos);
    const a = s[clamp(i, 0, this.n - 1)];
    if (a == null) return null;
    const b = s[clamp(i + 1, 0, this.n - 1)] ?? a;
    return lerp(a, b, pos - i);
  }

  isGap(pos) {
    return this.col('Temp')[clamp(Math.round(pos), 0, this.n - 1)] == null;
  }

  timeAt(pos) {
    return this.startMs + pos * HOUR;
  }
}

/** 2nd-98th percentile per column, so we can squash values to 0..1. */
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

/** Everything the scene, sound and text need for one moment. */
export function readFrame(series, pos, norm) {
  const wind = series.val('WindSpeed', pos);
  const hour = clamp(Math.round(pos), 0, series.n - 1);
  const windDir = series.filled('WindDir')[hour]; // don't blend directions: 350 -> 10 would swing through south
  return {
    temp: series.val('Temp', pos),
    doPct: series.val('DOpct', pos),
    turb: series.val('Turb', pos),
    ph: series.val('pH', pos),
    cond: series.val('Cond', pos), // conductivity = salt and minerals in the water
    rain: series.val('Rain', pos) ?? 0,
    lightning: series.col('Lightning')[hour] ?? 0, // strikes this hour
    air: series.val('AirTemp', pos),
    wind,
    windN: n01(norm, 'WindSpeed', wind),
    windDir, // where the wind comes FROM, 0 = north
    // we're looking north, so east is on the right. +1 = blowing left to right
    windX: windDir == null ? 1 : -Math.sin((windDir * Math.PI) / 180),
    timeMs: series.timeAt(pos),
    gap: series.isGap(pos),
  };
}

/** The recorded history (cleaned by scripts/prep_data.py). */
export async function loadHistory() {
  const r = await fetch('data/pond.json');
  if (!r.ok) throw new Error('history ' + r.status);
  const j = await r.json();
  return new Series({ rows: j.rows, startMs: Date.parse(j.start) });
}

/** Last 7 days from the Blue CoLab API, rolled up into hours. */
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
  add(weather, ['Rain', 'WindSpeed', 'AirTemp', 'Lightning', 'WindDir'], false);
  if (!Number.isFinite(lo)) throw new Error('no live water data');

  const rows = [];
  for (let h = lo; h <= hi; h++) {
    const b = buckets.get(h) || {};
    rows.push(COLS.map((c) => {
      const v = b[c];
      if (!v?.length) return COUNTED.includes(c) ? 0 : null;
      if (c === 'WindDir') { // average directions on a circle so 350 + 10 = north, not south
        const x = v.reduce((a, d) => a + Math.sin((d * Math.PI) / 180), 0), y = v.reduce((a, d) => a + Math.cos((d * Math.PI) / 180), 0);
        return ((Math.atan2(x, y) * 180) / Math.PI + 360) % 360;
      }
      const sum = v.reduce((a, x) => a + x, 0);
      return COUNTED.includes(c) ? sum : sum / v.length;
    }));
  }
  // oxygen flat for 6 hours straight = stuck sensor, not a calm pond. toss it
  const o = COLS.indexOf('DOpct');
  const stuck = new Array(rows.length).fill(false);
  for (let i = 0; i + 6 <= rows.length; i++) {
    let min = Infinity, max = -Infinity, ok = true;
    for (let k = i; k < i + 6; k++) { const v = rows[k][o]; if (v == null) { ok = false; break; } min = Math.min(min, v); max = Math.max(max, v); }
    if (ok && max - min <= 0.15) for (let k = i; k < i + 6; k++) stuck[k] = true;
  }
  stuck.forEach((s, i) => { if (s) rows[i][o] = null; });

  return new Series({ rows, startMs: lo * HOUR, lastMs });
}

/** The big moments in the record, for the "Jump to" buttons. */
export function findEvents(series) {
  const best = (name, score = (x) => x) => {
    let top = -Infinity, at = 0;
    series.col(name).forEach((v, i) => { if (v != null && score(v) > top) { top = score(v); at = i; } });
    return at;
  };
  // same idea but uses a 3-hour average, so a one-hour glitch can't win
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
  // wettest 12 hours, using a running total instead of re-adding every window
  let sum = 0, stormSum = 0, stormAt = 0;
  for (let i = 0; i < series.n; i++) {
    sum += rain[i] || 0;
    if (i >= 12) sum -= rain[i - 12] || 0;
    const start = i - 11;
    if (start >= 0 && start < series.n - 12 && sum > stormSum) { stormSum = sum; stormAt = start; }
  }
  // land on the heaviest hour, not the calm before it
  let peakAt = stormAt;
  for (let k = 0; k < 12; k++) if ((rain[stormAt + k] || 0) > (rain[peakAt] || 0)) peakAt = stormAt + k;
  // snow = wettest hour with the air at freezing (0.5°C of slack for the sensor)
  const air = series.col('AirTemp');
  let snowAt = 0, snowMost = 0;
  rain.forEach((v, i) => { if (v > snowMost && air[i] != null && air[i] <= 0.5) { snowMost = v; snowAt = i; } });

  return [
    { label: 'Biggest storm', pos: peakAt },
    { label: 'Warmest water', pos: best('Temp') },
    // only above 50°F - the winter lows come right after the stuck-sensor stretch, so we don't trust them
    { label: 'Lowest oxygen', pos: steady('DOpct', (x) => -x, (i) => (series.col('Temp')[i] ?? 0) >= 10) },
    { label: 'Murkiest water', pos: steady('Turb') },
    { label: 'Coldest day', pos: best('Temp', (x) => -x) },
    { label: 'Snow day', pos: snowAt },
  ];
}
