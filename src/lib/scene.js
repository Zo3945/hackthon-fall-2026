// The pond, drawn on a canvas. Everything that moves is driven by a reading.
//   water color  = temperature        murkiness = turbidity
//   waves        = wind               rain      = rain
//   fish energy  = dissolved oxygen   sky       = time of day

import { clamp, lerp } from './data.js';

const mix = (a, b, t) => [0, 1, 2].map((i) => Math.round(lerp(a[i], b[i], t)));
const rgb = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const TAU = Math.PI * 2;

// Where the sun is for Pleasantville, NY: 0 at sunrise, 1 at sunset, outside that at night.
// Day length swings from about 9 hours in December to 15 in June.
function sunPosition(ms) {
  const d = new Date(ms);
  const m = d.getUTCMonth();
  const dst = (m > 2 && m < 10) || (m === 2 && d.getUTCDate() >= 8);
  const hour = (((ms / 3600000 + (dst ? -4 : -5)) % 24) + 24) % 24;
  const dayOfYear = (ms - Date.UTC(d.getUTCFullYear(), 0, 1)) / 86400000;
  const halfDay = 6.1 + 1.5 * Math.cos(((dayOfYear - 172) / 365) * TAU);
  const noon = dst ? 13 : 11.7;
  return (hour - (noon - halfDay)) / (2 * halfDay);
}

export function createScene(canvas) {
  const g = canvas.getContext('2d');
  let W = 0, H = 0, DPR = 1, T = 0;

  const fish = Array.from({ length: 9 }, (_, i) => ({
    x: Math.random(), y: 0.45 + Math.random() * 0.4,
    vx: (Math.random() < 0.5 ? -1 : 1) * (0.05 + Math.random() * 0.05),
    phase: Math.random() * TAU, size: 0.7 + Math.random() * 0.7, tint: Math.random(), row: i,
  }));
  const pads = Array.from({ length: 6 }, () => ({ x: Math.random(), y: 0.36 + Math.random() * 0.06, r: 0.03 + Math.random() * 0.035 }));
  const drops = [], ripples = [], bubbles = [];

  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = canvas.width = Math.floor(window.innerWidth * DPR);
    H = canvas.height = Math.floor(window.innerHeight * DPR);
  }

  function draw(dt, f) {
    T += dt;
    const tN = clamp(((f.temp ?? 12) - 1) / 24, 0, 1);
    const turbN = clamp((f.turb ?? 4) / 50, 0, 1);
    const rainN = clamp(f.rain / 3, 0, 1);
    const doN = clamp((f.doPct ?? 90) / 100, 0, 1.4);
    const windN = f.windN;
    const sun = sunPosition(f.timeMs);
    const day = clamp(Math.sin(clamp(sun, -0.08, 1.08) * Math.PI) * 1.6 + 0.22, 0, 1);
    const horizon = Math.floor(H * 0.36);

    // Sky
    let gr = g.createLinearGradient(0, 0, 0, horizon);
    gr.addColorStop(0, rgb(mix([6, 12, 34], [96, 150, 205], day * (1 - rainN * 0.6))));
    gr.addColorStop(1, rgb(mix([16, 30, 58], [196, 222, 236], day * (1 - rainN * 0.55))));
    g.fillStyle = gr; g.fillRect(0, 0, W, horizon);

    // Sun or moon
    const sunT = clamp(sun, 0, 1);
    if (sun > 0 && sun < 1) {
      g.fillStyle = `rgba(255,236,170,${0.9 * (1 - rainN * 0.7)})`;
      g.beginPath(); g.arc(W * (0.12 + 0.76 * sunT), horizon * (0.85 - 0.6 * Math.sin(sunT * Math.PI)), H * 0.035, 0, TAU); g.fill();
    } else {
      g.fillStyle = 'rgba(235,240,255,.85)';
      g.beginPath(); g.arc(W * 0.82, horizon * 0.3, H * 0.025, 0, TAU); g.fill();
    }

    // Far bank
    g.fillStyle = rgb(mix([10, 24, 24], [30, 70, 50], day));
    g.beginPath(); g.moveTo(0, horizon);
    for (let x = 0; x <= W; x += W / 40) g.lineTo(x, horizon - H * (0.03 + 0.03 * Math.abs(Math.sin(x * 0.011) + Math.sin(x * 0.0047))));
    g.lineTo(W, horizon); g.closePath(); g.fill();
    if (rainN > 0.02) { g.fillStyle = `rgba(60,70,90,${0.55 * rainN})`; g.fillRect(0, 0, W, horizon); }

    // Water: cold blue to warm green, browner when murky
    const water = mix(mix([14, 70, 120], [28, 128, 112], tN), [112, 94, 58], turbN * 0.85);
    gr = g.createLinearGradient(0, horizon, 0, H);
    gr.addColorStop(0, rgb(mix(water, [200, 225, 235], 0.18 * day)));
    gr.addColorStop(1, rgb(mix(water, [4, 14, 22], 0.55)));
    g.fillStyle = gr; g.fillRect(0, horizon, W, H - horizon);

    // Light shafts, hidden by murk
    g.globalAlpha = 0.07 * day * (1 - turbN);
    g.fillStyle = '#fff';
    for (let i = 0; i < 5; i++) {
      const x = W * (0.1 + 0.2 * i) + Math.sin(T * 0.2 + i) * 30;
      g.beginPath(); g.moveTo(x, horizon); g.lineTo(x + W * 0.05, horizon); g.lineTo(x + W * 0.22, H); g.lineTo(x + W * 0.1, H); g.closePath(); g.fill();
    }
    g.globalAlpha = 1;

    // Waves: taller and faster with wind
    const amp = (3 + windN * 16 + rainN * 6) * DPR;
    for (let L = 0; L < 4; L++) {
      g.strokeStyle = `rgba(255,255,255,${0.06 + 0.05 * (3 - L) * (0.4 + day)})`;
      g.lineWidth = 1.5 * DPR; g.beginPath();
      const y0 = horizon + (H - horizon) * (0.02 + L * 0.06);
      for (let x = 0; x <= W; x += 8 * DPR) {
        const y = y0 + Math.sin(x * 0.006 * (1 + L * 0.3) + T * (0.5 + windN * 1.6) * (1 + L * 0.2)) * amp * (0.4 + L * 0.25) + Math.sin(x * 0.017 + T * 1.3) * amp * 0.18;
        if (x) g.lineTo(x, y); else g.moveTo(x, y);
      }
      g.stroke();
    }

    // Lily pads: more when warm and calm
    const padCount = Math.max(1, Math.round(2 + tN * 4 - windN * 2));
    for (let i = 0; i < padCount; i++) {
      const p = pads[i % pads.length];
      const px = ((p.x + Math.sin(T * 0.05 + i) * 0.01) % 1) * W, py = horizon + (H - horizon) * (p.y - 0.34), r = p.r * H;
      g.fillStyle = rgb(mix([40, 110, 60], [70, 150, 80], tN), 0.9);
      g.beginPath(); g.ellipse(px, py, r * 1.6, r * 0.5, 0, 0.25, 6.0); g.lineTo(px, py); g.fill();
    }

    // Rain and the rings it leaves
    for (let i = 0; i < rainN * 40 * dt; i++) drops.push({ x: Math.random() * W, y: -10, v: H * (0.9 + Math.random() * 0.5), end: horizon + (H - horizon) * (0.05 + Math.random() * 0.9) });
    g.strokeStyle = 'rgba(200,225,255,.5)'; g.lineWidth = 1.2 * DPR;
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i]; d.y += d.v * dt;
      g.beginPath(); g.moveTo(d.x, d.y - 16 * DPR); g.lineTo(d.x - 2, d.y); g.stroke();
      if (d.y >= d.end) { ripples.push({ x: d.x, y: d.end, r: 2, a: 0.5 }); drops.splice(i, 1); }
    }
    if (ripples.length > 220) ripples.splice(0, ripples.length - 220);
    for (let i = ripples.length - 1; i >= 0; i--) {
      const r = ripples[i]; r.r += 38 * DPR * dt; r.a -= 0.55 * dt;
      if (r.a <= 0) { ripples.splice(i, 1); continue; }
      g.strokeStyle = `rgba(255,255,255,${r.a})`; g.lineWidth = 1.2 * DPR;
      g.beginPath(); g.ellipse(r.x, r.y, r.r, r.r * 0.32, 0, 0, TAU); g.stroke();
    }

    // Fish: lively with oxygen, gasping at the surface without it
    const energy = clamp(doN, 0.12, 1);
    const gasping = (f.doPct ?? 90) < 40;
    for (const fi of fish) {
      fi.x += fi.vx * energy * dt * (gasping ? 0.3 : 1.6);
      if (fi.x > 1.08) fi.x = -0.08;
      if (fi.x < -0.08) fi.x = 1.08;
      const targetY = gasping ? 0.12 + (fi.row % 3) * 0.02 : 0.28 + ((fi.row * 0.137) % 0.55);
      fi.y += (targetY - fi.y) * dt * 0.6;
      const bob = Math.sin(T * (gasping ? 3 : 1.4) + fi.phase) * (gasping ? 0.006 : 0.012);
      const px = fi.x * W, py = horizon + (H - horizon) * (fi.y + bob);
      const s = H * 0.028 * fi.size, dir = fi.vx > 0 ? 1 : -1;
      const tail = Math.sin(T * (4 + energy * 7) + fi.phase) * 0.45;
      const body = mix(mix([255, 140, 60], [255, 200, 120], fi.tint), water, 0.08 + (1 - energy) * 0.45);
      g.save(); g.translate(px, py); g.scale(dir, 1); g.globalAlpha = 0.95 - turbN * 0.45;
      g.fillStyle = rgb(body);
      g.beginPath(); g.ellipse(0, 0, s * 1.5, s * 0.7, 0, 0, TAU); g.fill();
      g.beginPath(); g.moveTo(-s * 1.3, 0); g.lineTo(-s * 2.4, -s * 0.8 + tail * s); g.lineTo(-s * 2.4, s * 0.8 + tail * s); g.closePath(); g.fill();
      g.fillStyle = '#10202a'; g.beginPath(); g.arc(s * 0.85, -s * 0.15, s * 0.13, 0, TAU); g.fill();
      if (gasping) { g.fillStyle = 'rgba(10,20,30,.7)'; g.beginPath(); g.ellipse(s * 1.35, s * 0.12, s * 0.14, s * 0.08, 0, 0, TAU); g.fill(); }
      g.restore();
      if (Math.random() < 1.2 * doN * dt) bubbles.push({ x: px + dir * s * 1.5, y: py - s * 0.3, v: 30 + Math.random() * 30, r: 1.5 + Math.random() * 2.5 });
    }
    g.globalAlpha = 1;
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i]; b.y -= b.v * dt * DPR; b.x += Math.sin(T * 3 + b.y * 0.05) * 0.4;
      if (b.y < horizon) { bubbles.splice(i, 1); continue; }
      g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = DPR;
      g.beginPath(); g.arc(b.x, b.y, b.r * DPR, 0, TAU); g.stroke();
    }

    // Murk veil and vignette
    g.fillStyle = `rgba(110,92,56,${turbN * 0.28})`; g.fillRect(0, horizon, W, H - horizon);
    gr = g.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, H * 0.95);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.4)');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, destroy: () => window.removeEventListener('resize', resize) };
}
