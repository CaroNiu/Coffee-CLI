import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useT } from '../../i18n/useT';
import { getUsageStatistics, readUsageSnapshot, writeUsageSnapshot, usageDays, usageRange, type UsageReport } from '../../lib/usage-stats';
import '../common/SettingsModal.css';
import './UsageDashboard.css';

function UsageFilter({ label, value, options, onChange }: {
  label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void;
}) {
  const [position, setPosition] = useState<{ left: number; top: number; width: number; maxHeight: number } | null>(null);
  const [highlight, setHighlight] = useState(0);
  const activeIndex = Math.min(highlight, options.length - 1);
  const trigger = useRef<HTMLButtonElement>(null), menu = useRef<HTMLDivElement>(null);
  const id = useId(), open = position !== null;
  const reposition = useCallback(() => {
    const rect = trigger.current?.getBoundingClientRect(); if (!rect) return;
    const width = Math.min(Math.max(rect.width, 180), window.innerWidth - 16);
    const maxHeight = Math.min(320, window.innerHeight - 16), height = Math.min(options.length * 36 + 10, maxHeight);
    setPosition({ left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)), top: rect.bottom + height + 4 > window.innerHeight - 8 ? Math.max(8, rect.top - height - 4) : rect.bottom + 4, width, maxHeight });
  }, [options.length]);
  const show = () => { setHighlight(Math.max(0, options.findIndex(option => option.value === value))); reposition(); };
  const pick = (next: string) => { onChange(next); setPosition(null); };
  useEffect(() => {
    if (!open) return;
    const update = (event: Event) => { if (!(event.target instanceof Node) || !menu.current?.contains(event.target)) reposition(); };
    window.addEventListener('scroll', update, true); window.addEventListener('resize', update);
    return () => { window.removeEventListener('scroll', update, true); window.removeEventListener('resize', update); };
  }, [open, reposition]);
  useEffect(() => {
    if (open) document.getElementById(`${id}-${activeIndex}`)?.scrollIntoView({ block: 'nearest' });
  }, [open, activeIndex, id]);
  return <>
    <button ref={trigger} type="button" className="settings-font-trigger usage-filter-trigger" role="combobox" aria-label={label} aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? id : undefined} aria-activedescendant={open ? `${id}-${activeIndex}` : undefined} onClick={() => open ? setPosition(null) : show()} onKeyDown={event => {
      if (['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', ' ', 'Escape'].includes(event.key)) { event.preventDefault(); event.stopPropagation(); }
      if (event.key === 'Escape' || event.key === 'Tab') { setPosition(null); return; }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        if (!open) show(); else setHighlight((activeIndex + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length);
      } else if (event.key === 'Home' || event.key === 'End') {
        if (!open) reposition(); setHighlight(event.key === 'Home' ? 0 : options.length - 1);
      } else if (event.key === 'Enter' || event.key === ' ') { if (open) pick(options[activeIndex].value); else show(); }
    }}><span className="settings-font-current">{options.find(option => option.value === value)?.label ?? value}</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg></button>
    {position && createPortal(<>
      <div className="settings-font-backdrop" onClick={() => setPosition(null)} />
      <div ref={menu} id={id} role="listbox" aria-label={label} className="settings-font-menu usage-filter-menu" style={{ position: 'fixed', ...position }}>
        {options.map((option, index) => <button key={option.value} id={`${id}-${index}`} type="button" role="option" tabIndex={-1} aria-selected={value === option.value} className={`settings-font-opt${value === option.value ? ' active' : ''}${activeIndex === index ? ' is-highlighted' : ''}`} onMouseEnter={() => setHighlight(index)} onMouseDown={event => event.preventDefault()} onClick={() => pick(option.value)}>{option.label}</button>)}
      </div>
    </>, document.body)}
  </>;
}

function Trend({ values, label }: { values: number[]; label: string }) {
  const max = Math.max(...values, 1);
  const samples = values.length === 1 ? [values[0], values[0]] : values;
  const points = samples.map((value, index) => `${index * 600 / Math.max(1, samples.length - 1)},${140 - value / max * 120}`).join(' ');
  return <svg className="usage-trend" viewBox="0 0 600 160" role="img" aria-label={label} preserveAspectRatio="none">
    {[20, 60, 100, 140].map(y => <line key={y} x1="0" y1={y} x2="600" y2={y} className="usage-gridline" />)}
    <polygon points={`0,140 ${points} 600,140`} fill="currentColor" opacity=".08" /><polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" />
  </svg>;
}

export function UsageDashboard() {
  const t = useT();
  const [days, setDays] = useState(7), [tool, setTool] = useState(''), [project, setProject] = useState('');
  const cacheKey = JSON.stringify([days, tool, project]);
  const [snapshot, setSnapshot] = useState<{ key: string; report: UsageReport | null }>(() => ({ key: cacheKey, report: readUsageSnapshot(cacheKey) }));
  const report = snapshot.key === cacheKey ? snapshot.report : readUsageSnapshot(cacheKey);
  const projects = report?.projects ?? snapshot.report?.projects ?? [];
  const [busy, setBusy] = useState(true), [error, setError] = useState(false);
  const generation = useRef<object | null>(null), inFlight = useRef(false);
  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    const id = {}; generation.current = id; inFlight.current = true; setBusy(true); setError(false);
    try {
      const result = await getUsageStatistics({ ...usageRange(days), tool, project });
      if (generation.current === id) { writeUsageSnapshot(cacheKey, result); setSnapshot({ key: cacheKey, report: result }); }
    }
    catch { if (generation.current === id) setError(true); }
    finally { if (generation.current === id) { setBusy(false); inFlight.current = false; } }
  }, [days, tool, project, cacheKey]);
  useEffect(() => {
    inFlight.current = false;
    void refresh();
    const interval = window.setInterval(() => { if (!document.hidden) void refresh(); }, 15000);
    return () => { generation.current = null; inFlight.current = false; clearInterval(interval); };
  }, [refresh]);
  const format = (value: number | null | undefined) => value == null ? '—' : new Intl.NumberFormat(undefined, { notation: value >= 10000 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(value);
  const s = report?.summary, daily = usageDays(report?.daily ?? [], days);
  const models = [...(report?.models ?? [])].sort((a, b) => (b.summary.tokens ?? 0) - (a.summary.tokens ?? 0));
  const total = models.reduce((sum, row) => sum + (row.summary.tokens ?? 0), 0);
  const cacheTotal = (s?.input ?? 0) + (s?.cacheRead ?? 0) + (s?.cacheWrite ?? 0);
  const cache = s?.cacheRead != null && cacheTotal > 0 ? `${Math.round(s.cacheRead / cacheTotal * 100)}%` : '—';
  let angle = 0;
  const segments = models.map((row, i) => { const start = angle; angle += (row.summary.tokens ?? 0) / (total || 1) * 360; return `var(--usage-series-${i % 5}) ${start}deg ${angle}deg`; });
  const cards = [
    { title: t('usage.tokens'), value: format(s?.tokens), detail: `${t('usage.input')} ${format(s?.input)} · ${t('usage.output')} ${format(s?.output)}`, hero: true, trend: daily.map(day => day.tokens) },
    { title: t('usage.sessions'), value: format(s?.sessions), detail: `${t('usage.calls')} ${format(s?.calls)}`, hero: true, trend: daily.map(day => day.sessions) },
    { title: t('usage.prompts'), value: format(s?.prompts), detail: t('usage.prompt_hint') },
    { title: t('usage.days'), value: format(s?.days), detail: t('usage.local_days') },
    { title: t('usage.cache'), value: cache, detail: `${t('usage.cacheRead')} ${format(s?.cacheRead)}` },
  ];
  return <section className="usage-dashboard" aria-label={t('usage.title')}>
    <div className="usage-toolbar"><div className="usage-range" role="group" aria-label={t('usage.range')}>{[1, 7, 30].map(value => <button type="button" key={value} aria-pressed={days === value} onClick={() => setDays(value)}>{t(value === 1 ? 'usage.today' : value === 7 ? 'usage.week' : 'usage.month')}</button>)}</div>
      <UsageFilter label={t('usage.tool')} value={tool} onChange={setTool} options={[{ value: '', label: t('usage.all_tools') }, { value: 'claude', label: 'Claude Code' }, { value: 'codex', label: 'Codex CLI' }]} />
      <UsageFilter label={t('usage.project')} value={project} onChange={setProject} options={[{ value: '', label: t('usage.all_projects') }, ...projects.map(path => ({ value: path, label: path }))]} />
      <button type="button" className="usage-refresh" disabled={busy} onClick={() => { void refresh(); }}>{t('usage.refresh')}</button>
    </div>
    <div className="usage-body" aria-busy={busy}>
      {error && <p className="usage-notice" role="alert">{t('usage.error')}</p>}
        <div className="usage-cards">{cards.map(card => <article key={card.title} className={`usage-card${card.hero ? ' usage-card-hero' : ''}`}><h2>{card.title}</h2><strong>{card.value}</strong><p>{card.detail}</p>{card.trend && <Trend values={card.trend} label={card.title} />}</article>)}</div>
        {report && !s?.sessions && <p className="usage-notice" role="status">{t('usage.empty')}</p>}
        <div className="usage-charts"><article className="usage-card"><h2>{t('usage.trend')}</h2><Trend values={daily.map(day => day.tokens)} label={t('usage.trend')} /><div className="usage-axis"><span>{daily[0].key}</span><span>{daily.at(-1)?.key}</span></div><div className="usage-day-values">{daily.map(day => <span key={day.key} title={`${day.key} · ${format(day.tokens)} Token`}><i style={{ height: `${Math.max(2, day.tokens / Math.max(...daily.map(d => d.tokens), 1) * 36)}px` }} />{days <= 7 && <small>{day.key.slice(5)}</small>}</span>)}</div></article>
          <article className="usage-card"><h2>{t('usage.models')}</h2><div className="usage-model-chart"><figure className="usage-donut" role="img" aria-label={`${t('usage.tokens')} ${format(s?.tokens)}`}><i className="usage-donut-ring" style={{ backgroundImage: total ? `conic-gradient(${segments.join(',')})` : undefined }} /><span><strong>{format(s?.tokens)}</strong><small>Token</small></span></figure><div className="usage-model-legend">{models.slice(0, 6).map((row, i) => <div key={row.key}><i style={{ background: `var(--usage-series-${i % 5})` }} /><span title={row.key}>{row.key || t('usage.unknown_model')}</span><b>{total ? Math.round((row.summary.tokens ?? 0) / total * 100) : 0}%</b></div>)}</div></div></article></div>
        <article className="usage-card usage-models"><h2>{t('usage.breakdown')}</h2><div className="usage-table-scroll"><table><thead><tr>{(['model', 'calls', 'input', 'output', 'cacheRead'] as const).map(key => <th key={key}>{t(`usage.${key}`)}</th>)}</tr></thead><tbody>{models.map(row => <tr key={row.key}><th scope="row">{row.key || t('usage.unknown_model')}</th><td>{format(row.summary.calls)}</td><td>{format(row.summary.input)}</td><td>{format(row.summary.output)}</td><td>{format(row.summary.cacheRead)}</td></tr>)}</tbody></table></div></article>
      {report && <footer className="usage-footer"><p>{t('usage.coverage')}{report.sources.map(source => `${source.tool === 'claude' ? 'Claude Code' : 'Codex CLI'} ${source.available ? t('usage.file_count', { count: source.files }) : t('usage.unavailable')}`).join(' · ')}</p></footer>}
    </div>
  </section>;
}
