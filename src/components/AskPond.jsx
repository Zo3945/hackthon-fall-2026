import { useEffect, useRef, useState } from 'react';
import { SUGGESTIONS } from '../lib/ask.js';

/** A small chat panel. The pond answers from the real readings (see lib/ask.js). */
export default function AskPond({ pond }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const listRef = useRef(null);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, open]);

  const send = (question) => {
    const q = question.trim();
    if (!q) return;
    const reply = pond.ask(q);
    setMessages((m) => [...m, { from: 'you', text: q }, { from: 'pond', ...reply }]);
    setInput('');
  };

  if (!open) {
    return <button className="ask-toggle" onClick={() => setOpen(true)}>Ask the pond</button>;
  }

  return (
    <section className="ask" aria-label="Ask the pond">
      <div className="ask-head">
        <b>Ask the pond</b>
        <button className="ask-close" onClick={() => setOpen(false)} aria-label="Close">Close</button>
      </div>
      <div className="ask-list" ref={listRef}>
        {messages.length === 0 && <p className="ask-hint">I answer from my own sensor readings. Try one of these:</p>}
        {messages.map((m, i) => (
          <div key={i} className={`ask-msg ${m.from}`}>
            {m.text}
            {m.pos != null && <button className="ask-show" onClick={() => pond.showMoment(m.pos)}>Show me</button>}
          </div>
        ))}
      </div>
      <div className="ask-chips">
        {SUGGESTIONS.map((s) => <button key={s} onClick={() => send(s)}>{s}</button>)}
      </div>
      <form className="ask-form" onSubmit={(e) => { e.preventDefault(); send(input); }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="How was last night?" aria-label="Your question" />
        <button className="primary" type="submit">Ask</button>
      </form>
    </section>
  );
}
