import { useEffect, useState } from 'react';
import { commands } from '../../tauri';
import { welcomeGreeting } from '../../lib/welcome-greeting';

let computerName: Promise<string> | undefined;

export function WelcomeGreeting() {
  const [name, setName] = useState('');
  const [hour, setHour] = useState(() => new Date().getHours());
  useEffect(() => {
    let mounted = true;
    computerName ??= commands.computerName().then(value => typeof value === 'string' ? value : '').catch(() => '');
    void computerName.then(value => { if (mounted) setName(value); });
    const update = () => setHour(new Date().getHours());
    const timer = setInterval(update, 60_000);
    document.addEventListener('visibilitychange', update);
    return () => { mounted = false; clearInterval(timer); document.removeEventListener('visibilitychange', update); };
  }, []);
  return <div className="claude-empty-title" lang="en">{welcomeGreeting(hour, name)}</div>;
}
