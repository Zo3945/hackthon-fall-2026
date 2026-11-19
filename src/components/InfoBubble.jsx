export default function InfoBubble({ info, onClose }) {
  const width = 280;
  const left = Math.max(12, Math.min(window.innerWidth - width - 12, info.x - width / 2));
  const above = info.y > 260; // flip below if it's near the top
  const style = { left, width, ...(above ? { bottom: window.innerHeight - info.y + 28 } : { top: info.y + 28 }) };
  return (
    <div className="bubble" style={style} role="status">
      <div className="bubble-head">
        <b>{info.title}</b>
        <button onClick={onClose} aria-label="Close">Close</button>
      </div>
      <div className="bubble-fact">{info.fact}</div>
      <div className="bubble-reading">{info.reading}</div>
    </div>
  );
}
