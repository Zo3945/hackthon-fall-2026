export default function Splash({ onStart }) {
  return (
    <div className="splash">
      <div className="theme">Right to know what's in our water</div>
      <h1>The Pond Wakes Up</h1>
      <p>
        Real readings from sensors floating in Choate Pond. Color is temperature, ripples are wind
        and rain, and the fish tell you how much oxygen there is.
      </p>
      <button className="primary" onClick={() => onStart(true)}>Start with sound</button>
      <button onClick={() => onStart(false)}>Start without sound</button>
    </div>
  );
}
