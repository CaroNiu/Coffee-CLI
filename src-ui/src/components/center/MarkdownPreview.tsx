import { useEffect, useMemo, useState } from 'react';
import { commands } from '../../tauri';
import { useT } from '../../i18n/useT';
import { MarkdownContent } from './MarkdownContent';
import './MarkdownPreview.css';

type PreviewState =
  | { state: 'loading' }
  | { state: 'error' }
  | { state: 'ok'; content: string };

const PREVIEW_MAX_BYTES = 1_000_000;

/** Read-only Markdown document viewer used by center content tabs. The raw
 *  source view is always available so malformed or extension-flavoured
 *  Markdown remains useful even when the rich renderer cannot represent it. */
export function MarkdownPreview({ path }: { path: string }) {
  const t = useT();
  const [result, setResult] = useState<PreviewState>({ state: 'loading' });
  const [view, setView] = useState<'rendered' | 'source'>('rendered');

  useEffect(() => {
    let cancelled = false;
    let loading = false;
    let pending = false;
    let previousContent: string | null = null;

    const load = async () => {
      if (cancelled) return;
      if (loading) {
        pending = true;
        return;
      }
      loading = true;
      try {
        const content = await commands.readTextFile(path);
        if (cancelled) return;
        if (content == null) {
          previousContent = null;
          setResult({ state: 'error' });
          return;
        }
        if (content === previousContent) return;
        previousContent = content;
        const bytes = new TextEncoder().encode(content).byteLength;
        setResult(bytes > PREVIEW_MAX_BYTES ? { state: 'error' } : { state: 'ok', content });
      } catch {
        previousContent = null;
        if (!cancelled) setResult({ state: 'error' });
      } finally {
        loading = false;
        if (pending && !cancelled) {
          pending = false;
          void load();
        }
      }
    };

    setView('rendered');
    setResult({ state: 'loading' });
    void load();

    let timer: ReturnType<typeof setTimeout> | undefined;
    const norm = (value: string) => value.replace(/\\/g, '/').replace(/\/+$/, '');
    const parent = norm(path).slice(0, norm(path).lastIndexOf('/'));
    const refresh = (event: Event) => {
      const dir = norm((event as CustomEvent<{ dirPath: string }>).detail.dirPath);
      if (dir !== parent) return;
      clearTimeout(timer);
      timer = setTimeout(() => { void load(); }, 250);
    };
    const poll = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, 8000);
    window.addEventListener('fs-refresh', refresh);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      window.clearInterval(poll);
      window.removeEventListener('fs-refresh', refresh);
    };
  }, [path]);

  const basename = useMemo(
    () => path.replace(/\\/g, '/').split('/').pop() || path,
    [path],
  );

  return (
    <div className="markdown-preview">
      <div className="markdown-preview-header">
        <span className="markdown-preview-name" title={path}>{basename}</span>
        <div className="markdown-preview-view-switch" role="group" aria-label={t('preview.view') || 'Preview mode'}>
          <button
            type="button"
            className={view === 'rendered' ? 'active' : ''}
            aria-pressed={view === 'rendered'}
            onClick={() => setView('rendered')}
          >
            {t('preview.rendered') || 'Rendered'}
          </button>
          <button
            type="button"
            className={view === 'source' ? 'active' : ''}
            aria-pressed={view === 'source'}
            onClick={() => setView('source')}
          >
            {t('preview.source') || 'Source'}
          </button>
        </div>
      </div>
      <div className="markdown-preview-body">
        {result.state === 'loading' && (
          <div className="markdown-preview-empty">{t('diff.loading') || 'Loading…'}</div>
        )}
        {result.state === 'error' && (
          <div className="markdown-preview-empty">
            {t('preview.error') || 'Unable to preview this file'}
          </div>
        )}
        {result.state === 'ok' && view === 'rendered' && (
          <article className="markdown-preview-document">
            <MarkdownContent content={result.content} />
          </article>
        )}
        {result.state === 'ok' && view === 'source' && (
          <pre className="markdown-preview-source">{result.content}</pre>
        )}
      </div>
    </div>
  );
}
