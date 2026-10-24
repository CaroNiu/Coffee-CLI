import { useEffect, useRef, useState } from 'react';
import mascotUrl from '../../icons-inline/codex-mascot.webp';
import './CodexWelcomeIcon.css';

// Native Codex atlas rows and frame holds. Idle is deliberately six times slower.
const WELCOME_ANIMATIONS = [
  { id: 'idle', row: 0, holds: [1680, 660, 660, 840, 840, 1920] },
  { id: 'walking-right', row: 1, holds: [120, 120, 120, 120, 120, 120, 120, 220] },
  { id: 'walking-left', row: 2, holds: [120, 120, 120, 120, 120, 120, 120, 220] },
  { id: 'waving', row: 3, holds: [140, 140, 140, 280] },
  { id: 'jumping', row: 4, holds: [140, 140, 140, 140, 280] },
  { id: 'waiting', row: 6, holds: [150, 150, 150, 150, 150, 260] },
  { id: 'running', row: 7, holds: [120, 120, 120, 120, 120, 220] },
  { id: 'review', row: 8, holds: [150, 150, 150, 150, 150, 280] },
];

export function CodexWelcomeIcon({ isActive }: { isActive: boolean }) {
  const [icon] = useState(() => WELCOME_ANIMATIONS[Math.floor(Math.random() * WELCOME_ANIMATIONS.length)]);
  const ref = useRef<HTMLSpanElement>(null);
  const [motionAllowed, setMotionAllowed] = useState(() => !document.hidden && !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setMotionAllowed(!document.hidden && !motion.matches);
    motion.addEventListener('change', update);
    document.addEventListener('visibilitychange', update);
    return () => { motion.removeEventListener('change', update); document.removeEventListener('visibilitychange', update); };
  }, []);
  useEffect(() => {
    if (!ref.current || !isActive || !motionAllowed) return;
    const duration = icon.holds.reduce((total, hold) => total + hold, 0);
    let elapsed = 0;
    const frames = icon.holds.map((hold, column) => {
      const frame = { backgroundPosition: `${column / 7 * 100}% ${icon.row * 10}%`, offset: elapsed / duration, easing: 'step-end' };
      elapsed += hold;
      return frame;
    });
    const animation = ref.current.animate([...frames, { ...frames[frames.length - 1], offset: 1 }], { duration, iterations: Infinity });
    return () => animation.cancel();
  }, [icon, isActive, motionAllowed]);
  return <span ref={ref} className="codex-welcome-icon" style={{ backgroundImage: `url("${mascotUrl}")`, backgroundPosition: `0% ${icon.row * 10}%` }} data-welcome-icon={icon.id} data-paused={!isActive || !motionAllowed || undefined} aria-hidden="true" />;
}
