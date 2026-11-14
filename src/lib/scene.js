// The pond, drawn on a canvas. Everything that moves is driven by a reading.
//   water color  = temperature        murkiness = turbidity
//   waves        = wind               rain      = rain
//   fish energy  = dissolved oxygen   sky       = time of day
//   fish depth   = up top when oxygen is low, deep in cold water, storms and hot sun, low at night
//   geese        = leave when the water is near freezing, shelter from wind and rain
//   turtles      = bask on the log when warm and sunny, sink and rest when cold
//   reeds        = bend with the wind, turn dry and tan in cold water
//   winter       = frosty hills and a pale sun when the air is below freezing, ice as the water nears freezing,
//                  snow when it rains below freezing
//   rings of light = each piano note as it plays
//   dragonflies  = warm, calm, dry days   fireflies = warm, dry nights

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
  const geese = Array.from({ length: 3 }, (_, i) => ({ x: 0.24 + i * 0.2 + Math.random() * 0.06, dir: i % 2 ? 1 : -1, phase: Math.random() * TAU, size: 0.9 + Math.random() * 0.25, here: 1 }));
  const turtles = Array.from({ length: 2 }, (_, i) => ({ x: 0.3 + i * 0.3, y: 0.35, dir: i ? 1 : -1, phase: Math.random() * TAU, size: 1 - i * 0.22, slot: i }));
  const reeds = Array.from({ length: 18 }, (_, i) => ({ x: i < 10 ? Math.random() * 0.1 : 0.91 + Math.random() * 0.09, h: 0.07 + Math.random() * 0.09, phase: Math.random() * TAU, head: Math.random() < 0.6 }));
  const dragonflies = Array.from({ length: 3 }, () => ({ x: Math.random(), y: Math.random(), tx: Math.random(), ty: Math.random(), wait: 0 }));
  const fireflies = Array.from({ length: 16 }, () => ({ x: Math.random(), y: Math.random(), phase: Math.random() * TAU, speed: 0.5 + Math.random() }));
  let dragonflyAlpha = 0, fireflyAlpha = 0;
  let dropDebt = 0, flash = 0, bolt = null, nextStrike = 0; // rain and lightning state
  const pulses = []; // rings of light on the water, one per piano note
  let selected = null, selectedHit = null; // the animal the visitor clicked, if any
  const hits = []; // where each animal was drawn this frame, so clicks can find them

  // A turtle seen from the side. mode: 'bask' (on the log), 'swim', or 'rest' (tucked in, cold).
  function drawTurtle(px, py, s, dir, mode, phase, shell, skin, alpha) {
    const paddle = mode === 'swim' ? Math.sin(T * 1.2 + phase) * 0.5 : 0;
    const out = mode === 'rest' ? 0.3 : 1; // how far head and legs stick out
    g.save(); g.translate(px, py); g.scale(dir, 1); g.globalAlpha = alpha;
    g.fillStyle = rgb(skin);
    g.save(); g.translate(s * 0.65, s * 0.12); g.rotate(0.55 + paddle); g.beginPath(); g.ellipse(s * 0.3 * out, 0, s * 0.5 * out, s * 0.16, 0, 0, TAU); g.fill(); g.restore();
    g.save(); g.translate(-s * 0.75, s * 0.12); g.rotate(2.5 - paddle * 0.7); g.beginPath(); g.ellipse(s * 0.25 * out, 0, s * 0.4 * out, s * 0.14, 0, 0, TAU); g.fill(); g.restore();
    g.beginPath(); g.ellipse(s * (0.9 + 0.5 * out), -s * (mode === 'bask' ? 0.2 : 0.02), s * 0.32, s * 0.22, 0, 0, TAU); g.fill();
    if (out === 1) { g.fillStyle = '#0c1a14'; g.beginPath(); g.arc(s * 1.5, -s * (mode === 'bask' ? 0.26 : 0.08), s * 0.06, 0, TAU); g.fill(); }
    g.fillStyle = rgb(shell);
    g.beginPath(); g.ellipse(0, 0, s * 1.15, s * 0.75, 0, Math.PI, TAU); g.quadraticCurveTo(0, s * 0.42, -s * 1.15, 0); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.16)'; g.lineWidth = DPR;
    for (const k of [-0.5, 0, 0.5]) { g.beginPath(); g.arc(s * k, -s * 0.05, s * 0.36, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); }
    g.restore();
  }

  // A Canada goose floating on the surface. tucked = head down, sheltering.
  function drawGoose(px, py, s, dir, tucked, moving, day, alpha) {
    g.save(); g.translate(px, py); g.scale(dir, 1); g.globalAlpha = alpha;
    if (moving) { // wake
      g.strokeStyle = 'rgba(255,255,255,.3)'; g.lineWidth = 1.2 * DPR;
      for (const k of [1, 2]) { g.beginPath(); g.moveTo(-s * 1.2 * k, s * 0.42); g.lineTo(-s * (1.2 * k + 0.9), s * 0.42 + s * 0.05 * k); g.stroke(); }
    }
    const dark = mix([18, 18, 20], [34, 32, 30], day), body = mix([62, 52, 44], [146, 122, 98], day), pale = mix([120, 116, 110], [232, 226, 214], day);
    g.fillStyle = rgb(pale); g.beginPath(); g.ellipse(-s * 1.2, -s * 0.08, s * 0.42, s * 0.3, -0.3, 0, TAU); g.fill();
    g.fillStyle = rgb(dark); g.beginPath(); g.moveTo(-s * 1.35, -s * 0.3); g.lineTo(-s * 1.95, -s * 0.42); g.lineTo(-s * 1.45, -s * 0.02); g.closePath(); g.fill();
    g.fillStyle = rgb(body); g.beginPath(); g.ellipse(0, 0, s * 1.45, s * 0.6, 0, Math.PI, TAU); g.quadraticCurveTo(0, s * 0.75, -s * 1.45, 0); g.closePath(); g.fill();
    g.fillStyle = rgb(mix(body, pale, 0.55)); g.beginPath(); g.ellipse(s * 0.85, s * 0.02, s * 0.6, s * 0.4, 0, 0, TAU); g.fill();
    const hx = s * (tucked ? 1.25 : 1.4), hy = -s * (tucked ? 0.75 : 1.6);
    g.strokeStyle = rgb(dark); g.lineWidth = s * 0.32; g.lineCap = 'round';
    g.beginPath(); g.moveTo(s * 1.0, -s * 0.25); g.quadraticCurveTo(s * 1.0, hy * 0.7, hx, hy); g.stroke();
    g.fillStyle = rgb(dark);
    g.beginPath(); g.arc(hx, hy, s * 0.27, 0, TAU); g.fill();
    g.beginPath(); g.moveTo(hx + s * 0.2, hy - s * 0.1); g.lineTo(hx + s * 0.62, hy + s * 0.06); g.lineTo(hx + s * 0.2, hy + s * 0.16); g.closePath(); g.fill();
    g.fillStyle = rgb(pale); g.beginPath(); g.ellipse(hx - s * 0.02, hy + s * 0.1, s * 0.12, s * 0.17, 0.5, 0, TAU); g.fill();
    g.restore();
  }

  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = canvas.width = Math.floor(window.innerWidth * DPR);
    H = canvas.height = Math.floor(window.innerHeight * DPR);
  }

  function draw(dt, f) {
    T += dt;
    hits.length = 0;
    const tN = clamp(((f.temp ?? 12) - 1) / 24, 0, 1);
    const turbN = clamp((f.turb ?? 4) / 50, 0, 1);
    const rainN = clamp(f.rain / 3, 0, 1);
    const stormN = clamp((f.rain - 2) / 10, 0, 1); // 0 for showers, 1 for a downpour
    // Winter: frost follows the air temperature, ice follows the water temperature
    const airTemp = f.air ?? f.temp ?? 12;
    const frost = clamp((1 - airTemp) / 5, 0, 1); // 0 above freezing, 1 at about 25°F and colder
    const ice = clamp((3 - (f.temp ?? 12)) / 2.5, 0, 1); // ice forms as the water nears freezing
    const chill = clamp((9 - (f.temp ?? 12)) / 6, 0, 1); // plants die back in cold water
    const snowing = f.rain > 0.05 && airTemp <= 0.5; // rain that falls below freezing is drawn as snow
    const doN = clamp((f.doPct ?? 90) / 100, 0, 1.4);
    const windN = f.windN;
    const sun = sunPosition(f.timeMs);
    const day = clamp(Math.sin(clamp(sun, -0.08, 1.08) * Math.PI) * 1.6 + 0.22, 0, 1);
    const horizon = Math.floor(H * 0.36);

    // Sky
    let gr = g.createLinearGradient(0, 0, 0, horizon);
    gr.addColorStop(0, rgb(mix(mix([6, 12, 34], [96, 150, 205], day * (1 - rainN * 0.6 - stormN * 0.25)), [170, 188, 204], frost * 0.45 * day)));
    gr.addColorStop(1, rgb(mix(mix([16, 30, 58], [196, 222, 236], day * (1 - rainN * 0.55 - stormN * 0.3)), [226, 232, 238], frost * 0.6 * day)));
    g.fillStyle = gr; g.fillRect(0, 0, W, horizon);

    // Sun or moon
    const sunT = clamp(sun, 0, 1);
    if (sun > 0 && sun < 1) {
      g.fillStyle = rgb(mix([255, 236, 170], [250, 248, 238], frost), (0.9 - frost * 0.25) * (1 - rainN)); // a pale winter sun
      g.beginPath(); g.arc(W * (0.12 + 0.76 * sunT), horizon * (0.85 - 0.6 * Math.sin(sunT * Math.PI)), H * 0.035, 0, TAU); g.fill();
    } else {
      g.fillStyle = `rgba(235,240,255,${0.85 * (1 - rainN)})`;
      g.beginPath(); g.arc(W * 0.82, horizon * 0.3, H * 0.025, 0, TAU); g.fill();
    }

    // Far bank
    // Hills turn white with frost and snow when the air is below freezing
    g.fillStyle = rgb(mix(mix([10, 24, 24], [30, 70, 50], day), mix([70, 80, 100], [232, 238, 244], day), frost * 0.9));
    g.beginPath(); g.moveTo(0, horizon);
    for (let x = 0; x <= W; x += W / 40) g.lineTo(x, horizon - H * (0.03 + 0.03 * Math.abs(Math.sin(x * 0.011) + Math.sin(x * 0.0047))));
    g.lineTo(W, horizon); g.closePath(); g.fill();
    if (rainN > 0.02) {
      g.fillStyle = `rgba(60,70,90,${0.5 * rainN})`; g.fillRect(0, 0, W, horizon);
      // Rain clouds rolling across the top, darker and lower in a downpour
      const shade = Math.round(58 - stormN * 22);
      g.fillStyle = `rgba(${shade - 12},${shade - 6},${shade + 6},${Math.min(0.92, 0.35 + rainN * 0.55)})`;
      for (let i = 0; i < 9; i++) {
        const cx = (((i * 0.137 + T * (0.004 + windN * 0.012)) % 1.3) - 0.15) * W;
        const cy = horizon * (0.06 + (0.2 + stormN * 0.15) * ((i * 0.61) % 1));
        g.beginPath();
        g.ellipse(cx, cy, W * 0.2, horizon * 0.15, 0, 0, TAU);
        g.ellipse(cx + W * 0.11, cy + horizon * 0.05, W * 0.16, horizon * 0.12, 0, 0, TAU);
        g.fill();
        hits.push({ kind: 'cloud', id: i, x: cx + W * 0.05, y: cy + horizon * 0.02, r: Math.min(W * 0.13, horizon * 0.2) });
      }
    }

    // Lightning: only when the weather station counted strikes in this hour
    flash = Math.max(0, flash - dt * 3.5);
    if (f.lightning > 0) {
      nextStrike -= dt;
      if (nextStrike <= 0) {
        flash = 1; nextStrike = 1.2 + Math.random() * 5 / Math.min(4, 1 + f.lightning / 20);
        let x = W * (0.15 + Math.random() * 0.7), y = horizon * 0.12;
        bolt = [[x, y]];
        while (y < horizon * 0.95) { x += (Math.random() - 0.5) * W * 0.06; y += horizon * (0.08 + Math.random() * 0.1); bolt.push([x, y]); }
      }
    }
    if (flash > 0.45 && bolt) {
      g.strokeStyle = `rgba(255,255,235,${flash})`; g.lineWidth = 2.5 * DPR; g.lineJoin = 'round';
      g.beginPath(); bolt.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
    }

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
    const amp = (3 + windN * 16 + rainN * 6 + stormN * 10) * DPR * (1 - ice * 0.75); // ice calms the surface
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
    // Ice: a pale sheet across the surface, thicker the closer the water is to freezing
    if (ice > 0.02) {
      const depth = H * (0.012 + ice * 0.03);
      g.fillStyle = rgb(mix([150, 170, 195], [226, 238, 246], day), 0.3 + ice * 0.5);
      g.beginPath(); g.moveTo(0, horizon);
      g.lineTo(W, horizon);
      for (let x = W; x >= 0; x -= W / 36) g.lineTo(x, horizon + depth * (0.75 + 0.25 * Math.sin(x * 0.013) + 0.2 * Math.sin(x * 0.041 + 2)));
      g.closePath(); g.fill();
      g.strokeStyle = `rgba(255,255,255,${0.25 + ice * 0.35})`; g.lineWidth = DPR;
      for (let i = 0; i < 9; i++) { // cracks
        const x = W * ((i * 0.117 + 0.05) % 1);
        g.beginPath(); g.moveTo(x, horizon + 2 * DPR); g.lineTo(x + W * 0.03, horizon + depth * 0.5); g.lineTo(x + W * 0.012, horizon + depth * 0.9); g.stroke();
      }
    }

    // Each piano note spreads a ring of light across the surface: low notes on the left, high on the right
    for (let i = pulses.length - 1; i >= 0; i--) {
      const p = pulses[i]; p.r += 110 * DPR * dt; p.a -= 0.42 * dt;
      if (p.a <= 0) { pulses.splice(i, 1); continue; }
      const px = p.x * W, py = horizon + H * 0.035;
      g.fillStyle = `rgba(190,255,235,${p.a * 0.1})`; g.beginPath(); g.ellipse(px, py, p.r, p.r * 0.26, 0, 0, TAU); g.fill();
      g.strokeStyle = `rgba(190,255,235,${p.a * 0.85})`; g.lineWidth = 2 * DPR;
      g.beginPath(); g.ellipse(px, py, p.r, p.r * 0.26, 0, 0, TAU); g.stroke();
    }

    // Lily pads die back in cold water and spread as it warms
    const padCount = (f.temp ?? 12) < 8 ? 0 : Math.max(1, Math.round((tN - 0.2) * 7 - windN * 2));
    for (let i = 0; i < padCount; i++) {
      const p = pads[i % pads.length];
      const px = ((p.x + Math.sin(T * 0.05 + i) * 0.01) % 1) * W, py = horizon + (H - horizon) * (p.y - 0.34), r = p.r * H;
      g.fillStyle = rgb(mix([40, 110, 60], [70, 150, 80], tN), 0.9);
      g.beginPath(); g.ellipse(px, py, r * 1.6, r * 0.5, 0, 0.25, 6.0); g.lineTo(px, py); g.fill();
    }

    // Reeds at the edges, bending with the wind
    for (const r of reeds) {
      const bx = r.x * W, by = horizon + H * 0.014, len = r.h * H;
      const bend = (Math.sin(T * (0.8 + windN * 2) + r.phase) * (0.15 + windN * 0.6) + windN * 0.9) * len * 0.35;
      g.strokeStyle = rgb(mix(mix([24, 52, 34], [78, 128, 64], day), mix([70, 60, 44], [176, 152, 104], day), chill)); g.lineWidth = 2.2 * DPR; g.lineCap = 'round'; // green in summer, dry and tan in winter
      g.beginPath(); g.moveTo(bx, by); g.quadraticCurveTo(bx, by - len * 0.5, bx + bend, by - len); g.stroke();
      if (r.head) {
        g.fillStyle = rgb(mix([40, 28, 18], [112, 76, 46], day));
        g.save(); g.translate(bx + bend * 0.8, by - len * 0.86); g.rotate((bend / len) * 0.9);
        g.beginPath(); g.ellipse(0, 0, 2.8 * DPR, len * 0.1, 0, 0, TAU); g.fill(); g.restore();
      }
    }

    // A floating log, where turtles bask
    const logX = W * 0.68, logY = horizon + H * 0.022, logW = H * 0.2;
    g.fillStyle = rgb(mix([38, 27, 20], [98, 70, 46], day));
    g.beginPath(); g.ellipse(logX, logY, logW / 2, H * 0.012, 0, 0, TAU); g.fill();
    if (frost > 0.15) { // snow on the log
      g.fillStyle = rgb(mix([120, 130, 150], [240, 245, 250], day), frost);
      g.beginPath(); g.ellipse(logX, logY - H * 0.006, logW * 0.46, H * 0.008, 0, Math.PI, TAU); g.fill();
    }

    // Turtles: bask when warm and sunny, swim otherwise, rest low when the water is cold
    const waterTemp = f.temp ?? 12;
    const turtleMode = waterTemp < 6 ? 'rest' : waterTemp >= 15 && day > 0.5 && rainN < 0.1 ? 'bask' : 'swim';
    const shell = mix([34, 60, 38], [72, 108, 58], day), skin = mix([60, 80, 44], [128, 150, 78], day);
    for (const t of turtles) {
      const s = H * 0.026 * t.size;
      let ty;
      if (turtleMode === 'bask') {
        const tx = (logX + (t.slot - 0.5) * logW * 0.5) / W;
        t.x += (tx - t.x) * dt * 0.6; t.dir = 1;
        ty = (logY - H * 0.012 - s * 0.05 - horizon) / (H - horizon);
      } else if (turtleMode === 'rest') {
        ty = 0.5 + t.slot * 0.07;
      } else {
        t.x += t.dir * 0.006 * dt * (0.5 + tN);
        if (t.x > 0.9) t.dir = -1;
        if (t.x < 0.1) t.dir = 1;
        ty = 0.2 + t.slot * 0.13 + Math.sin(T * 0.25 + t.phase) * 0.04;
      }
      t.y += (ty - t.y) * dt * 0.6;
      const under = t.y > 0.03;
      drawTurtle(t.x * W, horizon + (H - horizon) * t.y, s, t.dir, turtleMode, t.phase,
        under ? mix(shell, water, 0.3) : shell, under ? mix(skin, water, 0.3) : skin, under ? 0.95 - turbN * 0.4 : 1);
      hits.push({ kind: 'turtle', id: t.slot, mode: turtleMode, x: t.x * W, y: horizon + (H - horizon) * t.y, r: s * 1.9 });
    }

    // Geese: paddle around, shelter by the reeds in wind and rain, leave when the water is near freezing
    const shelter = windN > 0.75 || rainN > 0.5;
    geese.forEach((gz, i) => {
      gz.here += ((waterTemp >= 4 ? 1 : 0) - gz.here) * dt * 0.5;
      if (gz.here < 0.02) return;
      let moving = true;
      if (shelter) {
        const tx = 0.13 + i * 0.055;
        moving = Math.abs(tx - gz.x) > 0.01;
        if (moving) { gz.dir = tx < gz.x ? -1 : 1; gz.x += gz.dir * 0.018 * dt; }
      } else {
        gz.x += gz.dir * 0.006 * dt * (0.5 + 0.5 * Math.sin(T * 0.3 + gz.phase) ** 2);
        if (gz.x > 0.56) gz.dir = -1;
        if (gz.x < 0.14) gz.dir = 1;
      }
      const s = H * 0.024 * gz.size;
      const py = horizon + H * 0.012 + Math.sin(T * (1 + windN * 2) + gz.phase) * amp * 0.2 - (1 - gz.here) * H * 0.3;
      drawGoose(gz.x * W, py, s, gz.dir, shelter && !moving, moving && gz.here > 0.9, day, gz.here);
      if (gz.here > 0.5) hits.push({ kind: 'goose', id: i, sheltering: shelter, x: gz.x * W, y: py - s * 0.6, r: s * 2.2 });
    });
    g.globalAlpha = 1;

    // Rain and the rings it leaves
    dropDebt += (rainN * 50 + stormN * 330) * dt; // drops per second: a shower is light, a downpour is a wall of rain
    for (; dropDebt >= 1 && drops.length < 700; dropDebt--) drops.push({ x: Math.random() * W * 1.1, y: -10, v: H * (0.9 + Math.random() * 0.5), end: horizon + (H - horizon) * (0.05 + Math.random() * 0.9) });
    if (dropDebt > 50) dropDebt = 0;
    const slant = (2 + windN * 12) * DPR; // wind blows the rain sideways
    if (snowing) { // below freezing, the same readings fall as slow, drifting snow
      g.fillStyle = 'rgba(255,255,255,.85)';
      for (const d of drops) {
        d.y -= d.v * dt * 0.8; // snow falls at a fifth of the speed of rain
        g.beginPath(); g.arc(d.x + Math.sin(T * 1.5 + d.end) * 6 * DPR, d.y, 2.2 * DPR, 0, TAU); g.fill();
      }
    }
    g.strokeStyle = 'rgba(200,225,255,.5)'; g.lineWidth = 1.2 * DPR;
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i]; d.y += d.v * dt; d.x -= slant * 3 * dt;
      if (!snowing) { g.beginPath(); g.moveTo(d.x + slant, d.y - 18 * DPR); g.lineTo(d.x, d.y); g.stroke(); }
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
    // Where the fish go, the way pond fish really behave. top and bottom are 0 (surface) to 1 (deepest).
    const place = gasping ? { kind: 'surface', top: 0.08, bottom: 0.2, speed: 0.3 } // gulping at the top
      : waterTemp < 8 ? { kind: 'cold', top: 0.75, bottom: 1, speed: 0.35 } // winter: the deep water is the warmest
        : stormN > 0.15 ? { kind: 'storm', top: 0.6, bottom: 1, speed: 0.8 } // away from the pounding surface
          : waterTemp >= 24 && day > 0.6 ? { kind: 'hot', top: 0.55, bottom: 1, speed: 0.7 } // hot sun: deeper is cooler
            : day < 0.25 ? { kind: 'night', top: 0.5, bottom: 0.95, speed: 0.45 } // resting low at night
              : { kind: 'normal', top: 0.2, bottom: 0.95, speed: 1 };
    // Deepest spot that is still visible above the control panel
    const floor = clamp((H - 215 * DPR - horizon) / (H - horizon), 0.35, 0.9);
    for (const fi of fish) {
      fi.x += fi.vx * energy * dt * 0.75 * place.speed;
      if (fi.x > 1.08) fi.x = -0.08;
      if (fi.x < -0.08) fi.x = 1.08;
      const targetY = (0.04 + lerp(place.top, place.bottom, (fi.row * 0.618) % 1) * 0.96) * floor;
      fi.y += (targetY - fi.y) * dt * 0.6;
      const bob = Math.sin(T * (gasping ? 3 : 1.4) + fi.phase) * (gasping ? 0.006 : 0.012);
      const px = fi.x * W, py = horizon + (H - horizon) * (fi.y + bob);
      const s = H * 0.028 * fi.size, dir = fi.vx > 0 ? 1 : -1;
      const tail = Math.sin(T * (2.5 + energy * 3.5) + fi.phase) * 0.45;
      const body = mix(mix([255, 140, 60], [255, 200, 120], fi.tint), water, 0.08 + (1 - energy) * 0.45);
      g.save(); g.translate(px, py); g.scale(dir, 1); g.globalAlpha = 0.95 - turbN * 0.45;
      g.fillStyle = rgb(body);
      g.beginPath(); g.ellipse(0, 0, s * 1.5, s * 0.7, 0, 0, TAU); g.fill();
      g.beginPath(); g.moveTo(-s * 1.3, 0); g.lineTo(-s * 2.4, -s * 0.8 + tail * s); g.lineTo(-s * 2.4, s * 0.8 + tail * s); g.closePath(); g.fill();
      g.fillStyle = '#10202a'; g.beginPath(); g.arc(s * 0.85, -s * 0.15, s * 0.13, 0, TAU); g.fill();
      if (gasping) { g.fillStyle = 'rgba(10,20,30,.7)'; g.beginPath(); g.ellipse(s * 1.35, s * 0.12, s * 0.14, s * 0.08, 0, 0, TAU); g.fill(); }
      g.restore();
      hits.push({ kind: 'fish', id: fi.row, where: place.kind, x: px, y: py, r: s * 2.2 });
      if (Math.random() < 1.2 * doN * dt) bubbles.push({ x: px + dir * s * 1.5, y: py - s * 0.3, v: 30 + Math.random() * 30, r: 1.5 + Math.random() * 2.5 });
    }
    g.globalAlpha = 1;
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i]; b.y -= b.v * dt * DPR; b.x += Math.sin(T * 3 + b.y * 0.05) * 0.4;
      if (b.y < horizon) { bubbles.splice(i, 1); continue; }
      g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = DPR;
      g.beginPath(); g.arc(b.x, b.y, b.r * DPR, 0, TAU); g.stroke();
    }

    // Dragonflies on warm, calm, dry days
    const dragonflyWeather = waterTemp >= 16 && day > 0.45 && rainN < 0.08 && windN < 0.75;
    dragonflyAlpha += ((dragonflyWeather ? 1 : 0) - dragonflyAlpha) * dt;
    if (dragonflyAlpha > 0.02) {
      for (const d of dragonflies) {
        d.wait -= dt;
        if (d.wait <= 0) { d.tx = 0.08 + Math.random() * 0.84; d.ty = Math.random(); d.wait = 1.5 + Math.random() * 3; }
        d.x += (d.tx - d.x) * dt * 1.4; d.y += (d.ty - d.y) * dt * 1.4;
        const s = H * 0.011, flap = Math.abs(Math.sin(T * 40 + d.tx * 9));
        g.save(); g.translate(d.x * W, horizon - H * 0.1 + d.y * H * 0.1); g.scale(d.tx > d.x ? 1 : -1, 1); g.globalAlpha = dragonflyAlpha;
        g.fillStyle = 'rgba(230,245,255,.55)';
        for (const wx of [-0.15, 0.3]) { g.beginPath(); g.ellipse(s * wx, -s * 0.55 * flap, s * 0.95, s * 0.22, -0.35, 0, TAU); g.fill(); }
        g.strokeStyle = 'rgba(70,200,225,.95)'; g.lineWidth = 2 * DPR; g.lineCap = 'round';
        g.beginPath(); g.moveTo(-s * 1.7, 0); g.lineTo(s * 0.6, 0); g.stroke();
        g.restore();
      }
    }

    // Fireflies on warm, dry nights
    const fireflyWeather = day < 0.3 && (f.air ?? waterTemp) >= 14 && rainN < 0.05;
    fireflyAlpha += ((fireflyWeather ? 1 : 0) - fireflyAlpha) * dt * 0.6;
    if (fireflyAlpha > 0.02) {
      for (const b of fireflies) {
        const px = (b.x + Math.sin(T * 0.1 * b.speed + b.phase) * 0.03) * W;
        const py = horizon - H * (0.01 + b.y * 0.12) + Math.sin(T * 0.7 * b.speed + b.phase) * H * 0.008;
        const a = Math.max(0, Math.sin(T * b.speed * 1.6 + b.phase)) ** 3 * fireflyAlpha;
        g.fillStyle = `rgba(220,255,120,${a * 0.25})`; g.beginPath(); g.arc(px, py, 7 * DPR, 0, TAU); g.fill();
        g.fillStyle = `rgba(240,255,170,${a})`; g.beginPath(); g.arc(px, py, 2 * DPR, 0, TAU); g.fill();
      }
    }

    // The whole scene lights up for an instant when lightning strikes
    if (flash > 0) { g.fillStyle = `rgba(235,240,255,${flash * 0.32})`; g.fillRect(0, 0, W, H); }

    // Murk veil and vignette
    g.fillStyle = `rgba(110,92,56,${turbN * 0.28})`; g.fillRect(0, horizon, W, H - horizon);
    gr = g.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, H * 0.95);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.4)');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);

    // Highlight the clicked animal with a soft pulsing ring that follows it
    selectedHit = selected ? hits.find((h) => h.kind === selected.kind && h.id === selected.id) ?? null : null;
    if (selectedHit) {
      const pulse = 0.5 + 0.5 * Math.sin(T * 4), r = selectedHit.r * (1.05 + pulse * 0.08);
      g.fillStyle = 'rgba(127,224,200,.12)'; g.beginPath(); g.arc(selectedHit.x, selectedHit.y, r, 0, TAU); g.fill();
      g.strokeStyle = `rgba(127,224,200,${0.65 + pulse * 0.35})`; g.lineWidth = 3 * DPR;
      g.beginPath(); g.arc(selectedHit.x, selectedHit.y, r, 0, TAU); g.stroke();
    }
  }

  resize();
  window.addEventListener('resize', resize);
  /** Which animal, if any, is at this point of the page? Returns the closest one. */
  function hitTest(cssX, cssY) {
    const x = cssX * DPR, y = cssY * DPR;
    let best = null, bestDist = Infinity;
    for (const h of hits) {
      const d = Math.hypot(h.x - x, h.y - y);
      if (d < h.r && d < bestDist) { best = h; bestDist = d; }
    }
    return best && { ...best, x: best.x / DPR, y: best.y / DPR };
  }

  const toCss = (h) => h && { ...h, x: h.x / DPR, y: h.y / DPR };

  return {
    pulse: (note, vol) => { if (pulses.length < 40) pulses.push({ x: clamp((note - 42) / 46, 0.06, 0.94), r: 4 * DPR, a: Math.min(1, vol * 5) }); },
    setSelected: (hit) => { selected = hit && { kind: hit.kind, id: hit.id }; },
    selectedHit: () => toCss(selectedHit), // where the clicked animal is right now
    draw, hitTest, destroy: () => window.removeEventListener('resize', resize),
  };
}
