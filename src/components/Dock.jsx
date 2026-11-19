import { useState } from 'react';
import { SPEEDS } from '../usePond.js';
import { cloudiness, compass, saltiness, toF } from '../lib/health.js';

// [full label, short label for phones, get value, format]
const READINGS = [
  ['Water temperature', 'Water', (f) => f.temp, (v) => `${toF(v).toFixed(0)}°F (${v.toFixed(1)}°C)`],
  ['Oxygen', 'Oxygen', (f) => f.doPct, (v) => `${v.toFixed(0)}% saturated`],
  ['Cloudiness', 'Cloudiness', (f) => f.turb, cloudiness],
  ['Acidity (pH)', 'pH', (f) => f.ph, (v) => v.toFixed(1)],
  ['Salt in the water', 'Salt', (f) => f.cond, (v) => `${saltiness(v)} (${v.toFixed(0)} µS/cm)`],
  ['Rain or snow this hour', 'Rain/snow', (f) => f.rain, (v) => (v < 0.05 ? 'None' : `${v.toFixed(1)} mm`)],
  ['Air temperature', 'Air', (f) => f.air, (v) => `${toF(v).toFixed(0)}°F`],
  // API gives km/h, we show mph
  ['Wind', 'Wind', (f) => (f.wind == null ? null : f), (f) => `${(f.wind * 0.621).toFixed(0)} mph${f.windDir == null ? '' : ` from the ${compass(f.windDir)}`}`],
];

export default function Dock({ pond }) {
  const { view, mode, connecting } = pond;
  const [open, setOpen] = useState(false); // phones only: the "More" sheet
  const speed = <button className="speed" onClick={pond.cycleSpeed} aria-label="Playback speed">{SPEEDS[pond.speed].label}</button>;
  return (
    <div className={open ? 'dock open' : 'dock'}>
      <div className="row">
        <button aria-pressed={mode === 'live'} onClick={pond.toggleLive}>
          {connecting ? 'Connecting…' : mode === 'live' ? 'Live' : 'Live now'}
        </button>
        <button className="primary" aria-pressed={pond.playing} onClick={pond.togglePlay}>{pond.playing ? 'Pause' : 'Play'}</button>
        <input
          className="scrub" type="range" min="0" max="1000" aria-label="Time"
          value={Math.round(view.progress * 1000)}
          onChange={(e) => pond.scrub(e.target.value / 1000)}
        />
        {speed}
        <button aria-pressed={pond.sound} onClick={pond.toggleSound}>
          <span className="long">{pond.sound ? 'Sound on' : 'Sound off'}</span>
          <span className="short" aria-hidden="true">{pond.sound ? '🔊' : '🔇'}</span>
        </button>
        <button className="more" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'Less' : 'More'}</button>
      </div>
      <div className="extra">
        <div className="events">
          <span>Jump to:</span>
          {pond.events.map((e) => (
            <button key={e.label} aria-pressed={pond.activeEvent === e.label} onClick={() => { pond.jumpTo(e.pos, e.label); setOpen(false); }}>{e.label}</button>
          ))}
        </div>
        <div className="reads">
          {READINGS.map(([label, short, get, format]) => {
            const v = get(view.frame);
            return (
              <div key={label}>
                <span className="long">{label}</span><span className="short">{short}</span>
                <b>{v == null ? 'No data' : format(v)}</b>
              </div>
            );
          })}
        </div>
        <div className="sheet-speed">Speed {speed}</div>
      </div>
    </div>
  );
}
