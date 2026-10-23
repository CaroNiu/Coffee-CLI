import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useT } from '../../i18n/useT';
import type { ClaudeMode } from '../../store/app-state';
import './ClaudeLaunchMode.css';

export function ClaudeLaunchMode({ value, disabled, onChange }: {
  value: ClaudeMode; disabled: boolean; onChange: (mode: ClaudeMode) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<CSSProperties>({});
  const trigger = useRef<HTMLButtonElement>(null), menu = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const rect = trigger.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(240, window.innerWidth - 16);
      setPosition({ width, left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)), ...(rect.bottom + 140 < window.innerHeight ? { top: rect.bottom + 6 } : { bottom: window.innerHeight - rect.top + 6 }) });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => { window.removeEventListener('resize', update); window.removeEventListener('scroll', update, true); };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: Event) => { if (!trigger.current?.contains(event.target as Node) && !menu.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); setOpen(false); trigger.current?.focus(); } };
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('focusin', outside, true);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside, true); document.removeEventListener('focusin', outside, true); document.removeEventListener('keydown', escape); };
  }, [open]);
  return <div className="launchpad-claude-mode" onClick={event => event.stopPropagation()}>
    <button ref={trigger} type="button" disabled={disabled} className="claude-launch-mode-trigger" aria-label={t('claude.launch.mode')} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(value => !value)}>
      {t(value === 'terminal' ? 'claude.launch.terminal_short' : 'claude.launch.conversation_short')}
      <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="m3 4.5 3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </button>
    {open && createPortal(<div className="claude-launch-mode-menu" ref={menu} role="dialog" aria-label={t('claude.launch.mode')} style={position}>
      {(['conversation', 'terminal'] as const).map(mode => <button key={mode} type="button" aria-pressed={value === mode} className={value === mode ? 'is-selected' : ''} onClick={() => { onChange(mode); setOpen(false); trigger.current?.focus(); }}>
        <span><strong>{t(mode === 'terminal' ? 'claude.launch.terminal' : 'claude.launch.conversation')}</strong><small>{t(mode === 'terminal' ? 'claude.launch.terminal_description' : 'claude.launch.conversation_description')}</small></span>
        {value === mode && <span aria-hidden="true">✓</span>}
      </button>)}
    </div>, document.body)}
  </div>;
}
