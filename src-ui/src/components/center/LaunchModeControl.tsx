import { useT } from '../../i18n/useT';
import type { ClaudeMode } from '../../store/app-state';

export function LaunchModeControl({ value = 'terminal', disabled = false, onChange }: {
  value?: ClaudeMode; disabled?: boolean; onChange?: (mode: ClaudeMode) => void;
}) {
  const t = useT();
  // Lucide monitor / square-terminal; see /icons/LICENSE-lucide.txt.
  const icon = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {value === 'conversation' ? <><rect width="20" height="14" x="2" y="3" rx="2" /><path d="M8 21h8M12 17v4" /></> : <><path d="m7 11 2-2-2-2M11 13h4" /><rect width="18" height="18" x="3" y="3" rx="2" ry="2" /></>}
  </svg>;
  const label = t(value === 'conversation' ? 'claude.launch.conversation' : 'claude.launch.terminal');
  return onChange
    ? <button type="button" className="launchpad-mode-icon is-switchable" data-mode={value} disabled={disabled} aria-label={`${t('claude.launch.mode')}: ${label}`} onClick={event => { event.stopPropagation(); onChange(value === 'conversation' ? 'terminal' : 'conversation'); }}>{icon}</button>
    : <span className="launchpad-mode-icon" data-mode="terminal" role="img" aria-label={label} onClick={event => event.stopPropagation()}>{icon}</span>;
}
