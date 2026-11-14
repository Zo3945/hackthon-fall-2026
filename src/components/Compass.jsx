import { compass } from '../lib/health.js';

/**
 * A small compass showing the wind. The arrow points the way the wind is blowing,
 * so wind from the northwest points to the southeast.
 */
export default function Compass({ frame }) {
  if (frame.windDir == null) return null;
  const blowingTo = (frame.windDir + 180) % 360;
  const mph = frame.wind == null ? null : (frame.wind * 0.621).toFixed(0);
  return (
    <div className="compass" aria-label={`Wind from the ${compass(frame.windDir)}`}>
      <svg viewBox="-50 -50 100 100" width="92" height="92" aria-hidden="true">
        <circle r="44" fill="rgba(8,28,36,.62)" stroke="rgba(255,255,255,.25)" strokeWidth="1.5" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
          <line key={a} y1="-44" y2={a % 90 === 0 ? -37 : -40} stroke="rgba(255,255,255,.45)" strokeWidth="1.5" transform={`rotate(${a})`} />
        ))}
        <text y="-25" className="compass-n">N</text>
        <text x="29" y="4.5">E</text>
        <text y="33">S</text>
        <text x="-29" y="4.5">W</text>
        <g className="compass-arrow" style={{ transform: `rotate(${blowingTo}deg)` }}>
          <line y1="16" y2="-12" stroke="#7fe0c8" strokeWidth="4" strokeLinecap="round" />
          <path d="M0 -24 L8 -9 L-8 -9 Z" fill="#7fe0c8" />
        </g>
      </svg>
      <div className="compass-label">
        Wind from the {compass(frame.windDir)}
        {mph != null && <b>{mph} mph</b>}
      </div>
    </div>
  );
}
