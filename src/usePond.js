// Runs the whole pond: data, live vs replay, the clock, the scene and the sound.

import { useCallback, useEffect, useRef, useState } from 'react';
import { clamp, computeNorm, fetchLive, findEvents, loadHistory, readFrame } from './lib/data.js';
import { health } from './lib/health.js';
import { describe } from './lib/creatures.js';
import { createScene } from './lib/scene.js';
import { createAudio } from './lib/audio.js';

export const SPEEDS = [
  { hoursPerSec: 8, label: '1 day / 3 s' },
  { hoursPerSec: 24, label: '1 day / 1 s' },
  { hoursPerSec: 2, label: '1 day / 12 s' },
  { hoursPerSec: 0.5, label: 'Real slow' },
];
const LIVE_REFRESH_MS = 120000;
const UI_REFRESH_MS = 120;

export function usePond(canvasRef) {
  // fast-changing stuff lives in a ref so the animation loop doesn't wait on React
  const eng = useRef({ hist: null, live: null, series: null, norm: null, pos: 0, playing: true, started: false, speed: 0, stormPos: 0 }).current;
  const audioRef = useRef(null);

  const [status, setStatus] = useState('loading');
  const [mode, setMode] = useState('replay');
  const [liveFailed, setLiveFailed] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [playing, setPlayingState] = useState(true);
  const [speed, setSpeedState] = useState(0);
  const [started, setStarted] = useState(false);
  const [sound, setSoundState] = useState(false);
  const [events, setEvents] = useState([]);
  const [activeEvent, setActiveEvent] = useState(null);
  const [info, setInfo] = useState(null); // bubble for whatever got clicked
  const [view, setView] = useState(null); // what the UI shows, refreshed ~8x a second

  const atEnd = () => eng.series && eng.pos >= eng.series.n - 1.01;
  const snapshot = useCallback((given) => {
    if (!eng.series) return;
    const frame = given ?? readFrame(eng.series, eng.pos, eng.norm);
    const live = eng.series === eng.live;
    setView({
      frame,
      health: health(frame),
      progress: eng.pos / (eng.series.n - 1),
      timeMs: live && atEnd() ? eng.live.lastMs : frame.timeMs,
      liveNow: live && atEnd(),
      lastMs: eng.series.lastMs,
    });
  }, [eng]);

  const setPlaying = useCallback((v) => { eng.playing = v; setPlayingState(v); }, [eng]);

  const goReplay = useCallback((pos, play = true) => {
    eng.series = eng.hist;
    eng.pos = clamp(pos ?? eng.stormPos, 0, eng.hist.n - 1);
    setMode('replay'); setPlaying(play); snapshot();
  }, [eng, setPlaying, snapshot]);

  const goLive = useCallback(async () => {
    setConnecting(true);
    try {
      eng.live = await fetchLive();
      eng.series = eng.live;
      eng.pos = eng.live.n - 1;
      eng.speed = SPEEDS.length - 1; setSpeedState(eng.speed); // live = slowest speed
      setLiveFailed(false); setMode('live'); setPlaying(false); snapshot();
    } catch (err) {
      console.warn('Live feed failed', err);
      setLiveFailed(true);
    } finally {
      setConnecting(false);
    }
  }, [eng, setPlaying, snapshot]);

  // load the recorded data first, then try live
  useEffect(() => {
    let cancelled = false;
    loadHistory().then((hist) => {
      if (cancelled) return;
      eng.hist = hist; eng.series = hist; eng.norm = computeNorm(hist);
      const found = findEvents(hist);
      eng.stormPos = found[0].pos; eng.pos = eng.stormPos;
      setEvents(found); setStatus('ready'); snapshot();
      goLive();
    }).catch((err) => { console.error(err); if (!cancelled) setStatus('error'); });
    return () => { cancelled = true; };
  }, [eng, goLive, snapshot]);

  // animation loop
  useEffect(() => {
    if (status !== 'ready' || !canvasRef.current) return undefined;
    const scene = createScene(canvasRef.current, { onStrike: () => audioRef.current?.thunder(), panelTop: () => eng.panelTop });
    eng.scene = scene;
    let raf = 0, last = performance.now(), lastUi = 0;
    const loop = (now) => {
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      const s = eng.series;
      if (eng.playing && eng.started) {
        eng.pos += SPEEDS[eng.speed].hoursPerSec * dt;
        if (eng.pos > s.n - 1) eng.pos = 0;
      }
      const frame = readFrame(s, eng.pos, eng.norm); // read once, reuse below
      scene.draw(dt, frame);
      if (now - lastUi > UI_REFRESH_MS) {
        lastUi = now; snapshot(frame);
        eng.panelTop = document.querySelector('.dock')?.getBoundingClientRect().top; // panel size changes on phones
        // keep the bubble stuck to the animal as it swims
        const hit = scene.selectedHit();
        if (hit) setInfo({ x: hit.x, y: hit.y, ...describe(hit, frame) });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); scene.destroy(); };
  }, [status, canvasRef, eng, snapshot]);

  // refresh live data every 2 min (skip while the tab is hidden)
  useEffect(() => {
    if (mode !== 'live') return undefined;
    const id = setInterval(async () => {
      if (document.hidden) return;
      const wasAtEnd = atEnd();
      try {
        const next = await fetchLive();
        if (eng.series !== eng.live) return;
        const shift = (next.startMs - eng.live.startMs) / 3600000;
        eng.live = next; eng.series = next;
        eng.pos = wasAtEnd ? next.n - 1 : clamp(eng.pos - shift, 0, next.n - 1);
      } catch (err) { console.warn('Live refresh failed', err); }
    }, LIVE_REFRESH_MS);
    return () => clearInterval(id);
  }, [mode, eng]);

  const setSound = useCallback((on) => {
    if (!audioRef.current) {
      audioRef.current = createAudio(
        () => eng.series && readFrame(eng.series, eng.pos, eng.norm),
        (note, vol) => eng.scene?.pulse(note, vol),
      );
    }
    if (import.meta.env.DEV) window.__pondAudio = audioRef.current; // for checking volume in dev
    audioRef.current.setOn(on); setSoundState(on);
  }, [eng]);

  return {
    status, mode, liveFailed, connecting, playing, speed, started, sound, events, view,
    start: (withSound) => { eng.started = true; setStarted(true); if (withSound) setSound(true); },
    activeEvent,
    togglePlay: () => { setActiveEvent(null); setPlaying(!eng.playing); },
    cycleSpeed: () => { eng.speed = (eng.speed + 1) % SPEEDS.length; setSpeedState(eng.speed); },
    scrub: (fraction) => { setActiveEvent(null); eng.pos = clamp(fraction, 0, 1) * (eng.series.n - 1); snapshot(); },
    // jumping pauses on that moment, hit Play to see what happened next
    jumpTo: (pos, label) => { eng.speed = SPEEDS.length - 1; setSpeedState(eng.speed); goReplay(pos, false); setActiveEvent(label); },
    toggleLive: () => { setActiveEvent(null); return mode === 'live' ? goReplay() : goLive(); },
    toggleSound: () => setSound(!sound),
    info,
    closeInfo: () => { eng.scene?.setSelected(null); setInfo(null); },
    isAnimalAt: (x, y) => Boolean(eng.scene?.hitTest(x, y)),
    inspect: (x, y) => {
      const hit = eng.scene?.hitTest(x, y);
      eng.scene?.setSelected(hit);
      setInfo(hit ? { x: hit.x, y: hit.y, ...describe(hit, readFrame(eng.series, eng.pos, eng.norm)) } : null);
    },
  };
}
