import { useEffect, useState } from 'react';
import { commands, isTauri, type GitProjectStatus } from '../tauri';
import { onWindowBackground, onWindowForeground } from './window-focus-filter';

export const gitFolderKey = (folder: string) => {
  const path = folder.replace(/\\/g, '/').replace(/\/$/, '');
  return /^[a-z]:\//i.test(path) ? path.toLowerCase() : path;
};
const cache = new Map<string, { at: number; value: GitProjectStatus | null }>();
const pending = new Map<string, Promise<GitProjectStatus | null>>();

async function read(folder: string) {
  const key = gitFolderKey(folder), cached = cache.get(key);
  if (cached && Date.now() - cached.at < 30_000) return cached.value;
  let request = pending.get(key);
  if (!request) {
    request = commands.gitProjectStatus(folder).then(value => {
      cache.set(key, { at: Date.now(), value });
      return value;
    }).finally(() => pending.delete(key));
    pending.set(key, request);
  }
  return request;
}

/** Shared per-folder reads, at most two at once; no per-history-row polling. */
export function useProjectGitStatuses(folders: string[]) {
  const signature = JSON.stringify([...new Set(folders.filter(Boolean))].sort());
  const [statuses, setStatuses] = useState<Map<string, GitProjectStatus | null>>(new Map());
  useEffect(() => {
    if (!isTauri) return;
    const paths: string[] = JSON.parse(signature);
    if (!paths.length) return;
    let cancelled = false, inFlight = false, foreground = true;
    const refresh = async () => {
      if (cancelled || inFlight || !foreground || document.hidden) return;
      inFlight = true;
      let next = 0;
      const worker = async () => {
        while (!cancelled && foreground && next < paths.length) {
          const path = paths[next++];
          try {
            const value = await read(path);
            if (!cancelled) setStatuses(previous => {
              const key = gitFolderKey(path);
              if (previous.get(key) === value && previous.has(key)) return previous;
              return new Map(previous).set(key, value);
            });
          } catch { /* Unknown/unavailable is never reported as a failed CI check. */ }
        }
      };
      await Promise.all([worker(), worker()]);
      inFlight = false;
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30_000);
    const unsubscribeForeground = onWindowForeground(() => { foreground = true; void refresh(); });
    const unsubscribeBackground = onWindowBackground(() => { foreground = false; });
    return () => { cancelled = true; window.clearInterval(timer); unsubscribeForeground(); unsubscribeBackground(); };
  }, [signature]);
  return statuses;
}
