import { useState } from 'react';

/** The speech bubble that appears when you click an animal: its reading, then local facts. */
export default function InfoBubble({ info, onClose }) {
  const [fact, setFact] = useState(() => Math.floor(Math.random() * info.facts.length));
  const width = 300;
  const left = Math.max(12, Math.min(window.innerWidth - width - 12, info.x - width / 2));
  const above = info.y > 300; // show above the animal unless it is near the top
  const style = { left, width, ...(above ? { bottom: window.innerHeight - info.y + 28 } : { top: info.y + 28 }) };
  return (
    <div className="bubble" style={style} role="status">
      <div className="bubble-head">
        <b>{info.title}</b>
        <button onClick={onClose} aria-label="Close">Close</button>
      </div>
      <div className="bubble-shows">{info.shows}</div>
      <div>{info.text}</div>
      <div className="bubble-fact">
        <span>Local fact {fact + 1} of {info.facts.length}</span>
        {info.facts[fact]}
      </div>
      <button className="bubble-next" onClick={() => setFact((fact + 1) % info.facts.length)}>Another fact</button>
    </div>
  );
}
