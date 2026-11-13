const TZ = 'America/New_York';
const time = (ms) => new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: TZ });
const date = (ms) => new Date(ms).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: TZ });
const STALE_MS = 3 * 3600000;

function liveTag({ mode, liveFailed, view }) {
  if (mode === 'replay') {
    return { text: liveFailed ? 'Live feed unavailable. Showing the replay.' : 'Replay of recorded readings', on: false };
  }
  if (!view.liveNow) return { text: 'Looking back over the last 7 days', on: false };
  if (Date.now() - view.lastMs > STALE_MS) return { text: `Sensor last reported at ${time(view.lastMs)}`, on: false };
  return { text: `Live · last reading ${time(view.lastMs)}`, on: true };
}

export default function Header({ pond }) {
  const { view } = pond;
  const tag = liveTag(pond);
  return (
    <header className="top">
      <div>
        <div className="title">Choate Pond · Pace University Pleasantville</div>
        <div className="mood">{view.health.mood}</div>
        <div className="why">{view.health.why}</div>
      </div>
      <div className="date">
        <b>{date(view.timeMs)}</b>
        <span>{time(view.timeMs)} Eastern</span>
        <div className={tag.on ? 'livetag on' : 'livetag'}>{tag.text}</div>
        <div className="gap">{view.frame.gap ? 'Sensor offline here. Showing the last known reading.' : ''}</div>
      </div>
    </header>
  );
}
