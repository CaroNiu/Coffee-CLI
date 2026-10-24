import type { ClaudeMode } from '../../store/app-state';

export function LaunchModeControl({ value = 'terminal', disabled = false, onChange, label: modeLabel }: {
  value?: ClaudeMode; disabled?: boolean; onChange?: (mode: ClaudeMode) => void; label?: string;
}) {
  if (!onChange) return null;
  return <div className="launchpad-mode-tabs" role="group" aria-label={`${modeLabel ?? 'Claude'} launch mode`} lang="en" dir="ltr">
    {(['terminal', 'conversation'] as const).map(mode => <button key={mode} type="button" className={value === mode ? 'is-selected' : ''} disabled={disabled} aria-pressed={value === mode} onClick={event => { event.stopPropagation(); onChange(mode); }}>{mode === 'terminal' ? 'Terminal' : 'Desktop'}</button>)}
  </div>;
}
