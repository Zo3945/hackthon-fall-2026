import { SPEEDS } from '../usePond.js';
import { cloudiness, saltiness, toF } from '../lib/health.js';

const READINGS = [
  ['Water temperature', (f) => f.temp, (v) => `${toF(v).toFixed(0)}°F (${v.toFixed(1)}°C)`],
  ['Oxygen', (f) => f.doPct, (v) => `${v.toFixed(0)}% saturated`],
  ['Cloudiness', (f) => f.turb, cloudiness],
  ['Acidity (pH)', (f) => f.ph, (v) => v.toFixed(1)],
  ['Salt in the water', (f) => f.cond, (v) => `${saltiness(v)} (${v.toFixed(0)} µS/cm)`],
  ['Rain or snow this hour', (f) => f.rain, (v) => (v < 0.05 ? 'None' : `${v.toFixed(1)} mm`)],
  ['Air temperature', (f) => f.air, (v) => `${toF(v).toFixed(0)}°F`],
];

export default function Dock({ pond }) {
  const { view, mode, connecting } = pond;
  return (
    <div className="dock">
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
        <button onClick={pond.cycleSpeed} aria-label="Playback speed">{SPEEDS[pond.speed].label}</button>
        <button aria-pressed={pond.sound} onClick={pond.toggleSound}>{pond.sound ? 'Sound on' : 'Sound off'}</button>
      </div>
      <div className="events">
        <span>Jump to:</span>
        {pond.events.map((e) => (
          <button key={e.label} aria-pressed={pond.activeEvent === e.label} onClick={() => pond.jumpTo(e.pos, e.label)}>{e.label}</button>
        ))}
      </div>
      <div className="reads">
        {READINGS.map(([label, get, format]) => {
          const v = get(view.frame);
          return <div key={label}>{label}<b>{v == null ? 'No data' : format(v)}</b></div>;
        })}
      </div>
    </div>
  );
}
