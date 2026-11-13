import { useEffect, useRef } from 'react';
import { usePond } from './usePond.js';
import Header from './components/Header.jsx';
import Dock from './components/Dock.jsx';
import Splash from './components/Splash.jsx';

export default function App() {
  const canvasRef = useRef(null);
  const pond = usePond(canvasRef);

  // Space bar plays and pauses.
  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'Space' && e.target.tagName !== 'BUTTON') { e.preventDefault(); pond.togglePlay(); }
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
      <canvas ref={canvasRef} className="scene" />
      {pond.view && <Header pond={pond} />}
      {pond.view && <Dock pond={pond} />}
      {!pond.started && <Splash onStart={pond.start} />}
    </>
  );
}
