import { useEffect, useRef } from 'react';
import { usePond } from './usePond.js';
import Header from './components/Header.jsx';
import Dock from './components/Dock.jsx';
import Splash from './components/Splash.jsx';
import InfoBubble from './components/InfoBubble.jsx';

export default function App() {
  const canvasRef = useRef(null);
  const pond = usePond(canvasRef);

  // Space bar plays and pauses.
  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'Space' && !['BUTTON', 'INPUT', 'TEXTAREA'].includes(e.target.tagName)) { e.preventDefault(); pond.togglePlay(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (pond.status === 'error') {
    return (
      <div className="splash">
        <h1>Could not load pond data</h1>
        <p>Start the app with "npm run dev" and reload this page.</p>
      </div>
    );
  }

  return (
    <>
      <canvas
        ref={canvasRef}
        className="scene"
        onClick={(e) => pond.inspect(e.clientX, e.clientY)}
        onMouseMove={(e) => { e.currentTarget.style.cursor = pond.isAnimalAt(e.clientX, e.clientY) ? 'pointer' : 'default'; }}
      />
      {pond.info && <InfoBubble key={pond.info.title} info={pond.info} onClose={pond.closeInfo} />}
      {pond.view && <Header pond={pond} />}
      {pond.view && <Dock pond={pond} />}
      {!pond.started && <Splash onStart={pond.start} />}
    </>
  );
}
