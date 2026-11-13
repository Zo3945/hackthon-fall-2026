// One hook that runs the pond: data, live/replay mode, playback clock, scene and sound.

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
  // Fast-changing values live in a ref so the animation loop never waits on React.
  const eng = useRef({ hist: null, live: null, series: null, norm: null, pos: 0, playing: true, started: false, speed: 0, stormPos: 0 }).current;
  const audioRef = useRef(null);

  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [mode, setMode] = useState('replay'); // replay | live
  const [liveFailed, setLiveFailed] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [playing, setPlayingState] = useState(true);
  const [speed, setSpeedState] = useState(0);
  const [started, setStarted] = useState(false);
  const [sound, setSoundState] = useState(false);
  const [events, setEvents] = useState([]);
  const [activeEvent, setActiveEvent] = useState(null); // which Jump to button is showing, if any
  const [info, setInfo] = useState(null); // speech bubble for a clicked animal
  const [view, setView] = useState(null); // snapshot for the UI, refreshed a few times a second

  const atEnd = () => eng.series && eng.pos >= eng.series.n - 1.01;
  const snapshot = useCallback(() => {
    if (!eng.series) return;
    const frame = readFrame(eng.series, eng.pos, eng.norm);
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
      eng.speed = SPEEDS.length - 1; setSpeedState(eng.speed); // live mode always moves at the slowest speed
      setLiveFailed(false); setMode('live'); setPlaying(false); snapshot();
    } catch (err) {
      console.warn('Live feed failed', err);
      setLiveFailed(true);
    } finally {
      setConnecting(false);
    }
  }, [eng, setPlaying, snapshot]);

  // Load history, then try the live feed.
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

  // Animation loop: move the clock, draw the scene, refresh the UI snapshot.
  useEffect(() => {
    if (status !== 'ready' || !canvasRef.current) return undefined;
    const scene = createScene(canvasRef.current);
    eng.scene = scene;
    let raf = 0, last = performance.now(), lastUi = 0;
    const loop = (now) => {
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      const s = eng.series;
      if (eng.playing && eng.started) {
        eng.pos += SPEEDS[eng.speed].hoursPerSec * dt;
        if (eng.pos > s.n - 1) eng.pos = 0;
      }
      scene.draw(dt, readFrame(s, eng.pos, eng.norm));
      if (now - lastUi > UI_REFRESH_MS) {
        lastUi = now; snapshot();
        // Keep the bubble attached to the clicked animal as it moves, with fresh readings.
        const hit = scene.selectedHit();
        if (hit) setInfo({ x: hit.x, y: hit.y, ...describe(hit, readFrame(s, eng.pos, eng.norm)) });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); scene.destroy(); };
  }, [status, canvasRef, eng, snapshot]);

  // Keep the live feed fresh.
  useEffect(() => {
    if (mode !== 'live') return undefined;
    const id = setInterval(async () => {
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
        (note, vol) => eng.scene?.pulse(note, vol), // every piano note ripples the water
      );
    }
    if (import.meta.env.DEV) window.__pondAudio = audioRef.current; // lets us measure loudness while developing
    audioRef.current.setOn(on); setSoundState(on);
  }, [eng]);

  return {
    status, mode, liveFailed, connecting, playing, speed, started, sound, events, view,
    start: (withSound) => { eng.started = true; setStarted(true); if (withSound) setSound(true); },
    activeEvent,
    togglePlay: () => { setActiveEvent(null); setPlaying(!eng.playing); },
    cycleSpeed: () => { eng.speed = (eng.speed + 1) % SPEEDS.length; setSpeedState(eng.speed); },
    scrub: (fraction) => { setActiveEvent(null); eng.pos = clamp(fraction, 0, 1) * (eng.series.n - 1); snapshot(); },
    // Jumping to a moment holds it on screen. Press Play to watch what happened next.
    jumpTo: (pos, label) => { eng.speed = SPEEDS.length - 1; setSpeedState(eng.speed); goReplay(pos, false); setActiveEvent(label); },
    toggleLive: () => { setActiveEvent(null); return mode === 'live' ? goReplay() : goLive(); },
    toggleSound: () => setSound(!sound),
    // Clicking an animal: find which one is under the pointer and let it explain itself.
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
