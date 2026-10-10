import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'qrcode';
import { commands, invoke } from '../../tauri';
import { useAppState, type AgentPage } from '../../store/app-state';
import { loadOlderAgentMessages, refreshChannels, sendAgentMessage, useAgentClient } from '../../lib/agent-client';
import { MarkdownContent } from '../center/MarkdownContent';
import { Gambit } from '../center/Gambit';
import '../common/SettingsModal.css';
import './AgentPages.css';

function AgentSelect<Value extends string>({ value, options, onChange, label, className = '' }: {
  value: Value; options: { value: Value; label: string }[]; onChange: (value: Value) => void; label: string; className?: string;
}) {
  const { state } = useAppState();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0, width: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const visible = open && state.agentPageActive === 'config';
  const reposition = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const height = Math.min(options.length * 34 + 10, 320);
    setPosition({ left: rect.left, top: rect.bottom + height + 4 > window.innerHeight - 8 ? Math.max(8, rect.top - height - 4) : rect.bottom + 4, width: rect.width });
  }, [options.length]);
  const toggle = () => { if (!open) reposition(); setOpen(!open); };

  useEffect(() => {
    if (state.agentPageActive !== 'config') return;
    return () => setOpen(false);
  }, [state.agentPageActive]);

  useEffect(() => {
    if (!visible) return;
    menuRef.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus();
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => { window.removeEventListener('scroll', reposition, true); window.removeEventListener('resize', reposition); };
  }, [visible, reposition]);

  return <>
    <button type="button" ref={triggerRef} className={`settings-font-trigger agent-select-trigger ${className}`} role="combobox" aria-label={label} aria-haspopup="listbox" aria-expanded={visible} aria-controls={visible ? menuId : undefined} onClick={toggle} onKeyDown={event => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); if (!open) toggle(); }
    }}>
      <span className="settings-font-current">{options.find(option => option.value === value)?.label}</span>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
    </button>
    {visible && createPortal(<>
      <div className="settings-font-backdrop" onClick={() => setOpen(false)} />
      <div ref={menuRef} id={menuId} className="settings-font-menu" role="listbox" aria-label={label} style={{ position: 'fixed', ...position }} onKeyDown={event => {
        if (event.key === 'Escape' || event.key === 'Tab') { if (event.key === 'Escape') event.preventDefault(); setOpen(false); triggerRef.current?.focus(); }
        if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
          event.preventDefault();
          const buttons = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? []);
          const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
          buttons[next]?.focus();
        }
      }}>
        <div className="settings-font-list">{options.map(option => <button type="button" key={option.value} className={`settings-font-opt${value === option.value ? ' active' : ''}`} role="option" aria-selected={value === option.value} onClick={() => {
          if (option.value !== value) onChange(option.value);
          setOpen(false); triggerRef.current?.focus();
        }}>{option.label}</button>)}</div>
      </div>
    </>, document.body)}
  </>;
}

function PageFrame({ page, children }: { page: AgentPage; children: ReactNode }) {
  return <section className={`agent-page agent-page-${page}`} aria-label={page === 'agent' ? 'Coffee Agent' : '消息设置'}>
    {children}
  </section>;
}

function AgentChatPage() {
  const { state } = useAppState();
  const { conversationId, messages, hasOlder, loadingOlder, running, activity, error } = useAgentClient();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const draftKey = conversationId || 'desktop';
  const draft = drafts[draftKey] ?? '';
  const setDraft = (text: string) => setDrafts(current => ({ ...current, [draftKey]: text }));
  const [localError, setLocalError] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);
  const followOutput = useRef(true);
  useEffect(() => { followOutput.current = true; }, [conversationId]);

  useEffect(() => {
    if (followOutput.current && threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [messages, running, activity]);

  const send = async (prompt: string): Promise<boolean> => {
    const text = prompt.trim();
    if (!text || running) return false;
    setLocalError('');
    followOutput.current = true;
    try { await sendAgentMessage(text); return true; }
    catch (failure) { setLocalError(String(failure)); return false; }
  };
  const cancel = async () => {
    if (cancelling) return;
    setCancelling(true);
    setLocalError('');
    try { await invoke('agent_cancel', { conversationId: conversationId || 'desktop' }); }
    catch (failure) { setLocalError(String(failure)); }
    finally { setCancelling(false); }
  };

  return <PageFrame page="agent">
    <div className="agent-chat-thread" ref={threadRef} onScroll={() => {
      const node = threadRef.current;
      if (node) followOutput.current = node.scrollHeight - node.scrollTop - node.clientHeight < 120;
    }}>
      {hasOlder && <button type="button" className="agent-button quiet" disabled={loadingOlder} onClick={() => {
        followOutput.current = false;
        loadOlderAgentMessages().catch(failure => setLocalError(String(failure)));
      }}>{loadingOlder ? '正在加载…' : '查看更早的对话'}</button>}
      {messages.length === 0 ? <div className="agent-welcome">
        <h2>Coffee Agent</h2>
        <p>你可以通过消息渠道让它帮你管理 Coffee CLI 工作</p>
        <div className="agent-suggestions">{['看看现在打开了哪些终端', '读取终端画面，告诉我当前进度', '查看可以继续的历史会话'].map(text =>
          <button type="button" key={text} onClick={() => { setDraft(text); document.querySelector<HTMLTextAreaElement>('.gambit-textarea')?.focus(); }}>{text}<span aria-hidden="true">↗</span></button>)}</div>
      </div> : <div className="agent-message-list">{messages.map((message, index) =>
        <article className={`agent-message ${message.role}`} key={index}>
          <div className="agent-message-author">{message.role === 'user' ? '你' : 'Coffee Agent'}</div>
          {message.role === 'assistant' ? <MarkdownContent content={message.text} /> : <div className="agent-user-text">{message.text}</div>}
        </article>)}
        {running && <div className="agent-activity" role="status"><span className="agent-working-dot" />{activity || '正在思考…'}</div>}
      </div>}
    </div>
    {(localError || error) && <p className="agent-chat-feedback agent-feedback error" role="alert">{localError || error}</p>}
    {state.agentPageActive === 'agent' && <Gambit
      sessionId={`coffee-agent:${conversationId || 'desktop'}`} draft={draft} onDraftChange={setDraft}
      onClose={() => {}} onSend={send} running={running}
      onCancel={cancelling ? undefined : () => void cancel()}
      sendFailedHint="发送失败，请查看错误信息"
      workspaceName="Coffee Agent"
      leftPanelHidden={state.leftPanelHidden} rightPanelHidden={state.rightPanelHidden}
      canUseChat={false} viewMode="terminal" onViewModeChange={() => {}}
    />}
  </PageFrame>;
}

interface ModelSettings {
  provider: 'openai' | 'anthropic';
  baseUrl: string;
  model: string;
  hasApiKey: boolean;
}
const DEFAULT_URL = { openai: 'https://api.openai.com/v1', anthropic: 'https://api.anthropic.com' };

function AgentModelSection() {
  const [config, setConfig] = useState<ModelSettings>({ provider: 'openai', baseUrl: DEFAULT_URL.openai, model: '', hasApiKey: false });
  const [saved, setSaved] = useState<ModelSettings | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    invoke<ModelSettings>('agent_get_model').then(value => {
      if (active) { setConfig(value); setSaved(value); }
    }).catch(failure => { if (active) setError(String(failure)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const endpointChanged = saved !== null && (config.provider !== saved.provider || config.baseUrl.trim().replace(/\/$/, '') !== saved.baseUrl);
  const save = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true); setError(''); setFeedback('');
    try {
      await invoke('agent_save_model', { config: { provider: config.provider, baseUrl: config.baseUrl.trim(), model: config.model.trim(), ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}) } });
      const next = await invoke<ModelSettings>('agent_get_model');
      setConfig(next); setSaved(next); setApiKey(''); setFeedback('模型配置已保存');
    } catch (failure) { setError(String(failure)); }
    finally { setSaving(false); }
  };

  return <section className="agent-settings-section">
      <h2>Coffee Agent 模型配置</h2>
      <form className="agent-model-form" onSubmit={save}>
        <fieldset disabled={loading || saving}>
          <label className="agent-field">服务类型<AgentSelect label="服务类型" value={config.provider} options={[{ value: 'openai', label: 'OpenAI / 兼容服务' }, { value: 'anthropic', label: 'Anthropic / 兼容服务' }]} onChange={provider => {
            setConfig({ ...config, provider, baseUrl: DEFAULT_URL[provider] }); setFeedback('');
          }} /></label>
          <label className="agent-field">服务地址<input type="url" value={config.baseUrl} spellCheck={false} placeholder={DEFAULT_URL[config.provider]} onChange={event => { setConfig({ ...config, baseUrl: event.target.value }); setFeedback(''); }} /></label>
          <label className="agent-field">模型 ID<input value={config.model} maxLength={200} spellCheck={false} placeholder="输入模型 ID" onChange={event => { setConfig({ ...config, model: event.target.value }); setFeedback(''); }} /></label>
          <label className="agent-field">API 密钥<input type="password" autoComplete="new-password" value={apiKey} spellCheck={false} placeholder={config.hasApiKey && !endpointChanged ? '已保存，留空保留密钥' : '输入 API 密钥'} onChange={event => { setApiKey(event.target.value); setFeedback(''); }} /></label>
          <div className="agent-form-footer"><button type="submit" className="agent-button primary">{saving ? '正在保存…' : '保存'}</button><span className="agent-feedback" role="status">{loading ? '正在读取配置…' : feedback}</span></div>
        </fieldset>
        {error && <p className="agent-feedback error" role="alert">{error}</p>}
      </form>
  </section>;
}

function AgentDelegationSection() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    invoke<boolean>('agent_get_english_delegation').then(value => {
      if (active) setEnabled(value);
    }).catch(failure => { if (active) setError(String(failure)); });
    return () => { active = false; };
  }, []);

  const toggle = async () => {
    if (enabled === null || saving) return;
    const next = !enabled;
    setSaving(true); setError('');
    try { await invoke('agent_set_english_delegation', { enabled: next }); setEnabled(next); }
    catch (failure) { setError(String(failure)); }
    finally { setSaving(false); }
  };

  return <section className="agent-settings-section">
    <div className="agent-delegation-heading"><h2 id="agent-delegation-label">用英文派发任务</h2><button type="button" className={`library-toggle agent-delegation-switch${enabled ? ' on' : ''}`} role="switch" aria-checked={enabled === true} aria-labelledby="agent-delegation-label" disabled={enabled === null || saving} onClick={() => void toggle()}><span className="library-toggle-knob" aria-hidden="true" /></button></div>
    <p className="agent-field-hint">建议开启。你用自己的语言与 Coffee Agent 沟通，它默认用英文向其他 CLI Agent 派发任务，再用你的语言汇报结果；关闭后，派发任务也默认使用你的语言。<span role="status">{saving ? '正在保存…' : enabled === null && !error ? '正在读取设置…' : '统一任务语言，便于多个 Agent 协作。切换后自动保存，从下一条任务生效。'}</span></p>
    {error && <p className="agent-feedback error" role="alert">{error}</p>}
  </section>;
}

interface TelegramPairing { botName: string; pairingCode: string }
interface WeixinLogin { sessionId: string; qrDataUrl: string }
interface WeixinPoll { status: string; connected: boolean; message?: string }
const CHANNEL_STATUS: Record<string, string> = { disconnected: '未连接', connecting: '连接中', waiting_pairing: '等待配对', waiting_scan: '等待扫码', connected: '已连接', error: '连接异常' };

function AgentChannelsSection() {
  const { state } = useAppState();
  const { channels } = useAgentClient();
  const [selectedChannel, setSelectedChannel] = useState<'weixin' | 'telegram'>('weixin');
  const [token, setToken] = useState('');
  const [pairing, setPairing] = useState<TelegramPairing | null>(null);
  const [login, setLogin] = useState<WeixinLogin | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [needsVerify, setNeedsVerify] = useState(false);
  const [loginMessage, setLoginMessage] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    if (state.agentPageActive === 'config') refreshChannels().catch(failure => setError(String(failure)));
  }, [state.agentPageActive]);

  const acceptPoll = useCallback((result: WeixinPoll) => {
    setLoginMessage(result.message || '等待微信扫码。');
    if (result.connected) {
      setLogin(null); setNeedsVerify(false); setVerifyCode(''); setFeedback('微信已连接');
      refreshChannels().catch(failure => setError(String(failure)));
    } else if (result.status === 'need_verifycode') setNeedsVerify(true);
    else if (['expired', 'verify_code_blocked', 'binded_redirect'].includes(result.status)) { setLogin(null); setNeedsVerify(false); }
    else setNeedsVerify(false);
  }, []);

  useEffect(() => {
    if (!login || needsVerify) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const result = await invoke<WeixinPoll>('channel_weixin_poll', { sessionId: login.sessionId });
        if (!active) return;
        acceptPoll(result);
        if (!result.connected && !['need_verifycode', 'expired', 'verify_code_blocked', 'binded_redirect'].includes(result.status)) timer = setTimeout(() => void poll(), 2000);
      } catch (failure) { if (active) { setError(String(failure)); setLogin(null); } }
    };
    timer = setTimeout(() => void poll(), 500);
    return () => { active = false; clearTimeout(timer); };
  }, [login, needsVerify, acceptPoll]);

  const connectTelegram = async (event: FormEvent) => {
    event.preventDefault(); setBusy('telegram'); setError(''); setFeedback('');
    try {
      const result = await invoke<TelegramPairing>('channel_connect_telegram', { token: token.trim() });
      setPairing(result); setToken(''); await refreshChannels();
    } catch (failure) { setError(String(failure)); }
    finally { setBusy(''); }
  };
  const connectWeixin = async () => {
    setBusy('weixin'); setError(''); setFeedback(''); setLogin(null); setNeedsVerify(false); setVerifyCode(''); setLoginMessage('');
    try {
      const result = await invoke<{ sessionId: string; qrCodeUrl: string }>('channel_weixin_start');
      const qrDataUrl = await QRCode.toDataURL(result.qrCodeUrl, { width: 240, margin: 3, errorCorrectionLevel: 'M' });
      setLogin({ sessionId: result.sessionId, qrDataUrl }); setLoginMessage('使用手机微信扫码，并确认连接。'); await refreshChannels();
    } catch (failure) { setError(String(failure)); }
    finally { setBusy(''); }
  };
  const verify = async (event: FormEvent) => {
    event.preventDefault(); if (!login) return;
    setBusy('verify'); setError('');
    try { acceptPoll(await invoke<WeixinPoll>('channel_weixin_poll', { sessionId: login.sessionId, verifyCode: verifyCode.trim() })); }
    catch (failure) { setError(String(failure)); }
    finally { setBusy(''); }
  };
  const disconnect = async (channel: 'telegram' | 'weixin') => {
    setBusy(channel); setError(''); setFeedback('');
    try {
      await invoke('channel_disconnect', { channel });
      if (channel === 'telegram') setPairing(null);
      else { setLogin(null); setNeedsVerify(false); setLoginMessage(''); }
      await refreshChannels(); setFeedback(`${channel === 'weixin' ? '微信' : 'Telegram'} 已断开`);
    } catch (failure) { setError(String(failure)); }
    finally { setBusy(''); }
  };

  return <section className="agent-settings-section">
    <div className="agent-section-heading"><h2>消息渠道</h2><AgentSelect className="agent-channel-select" label="选择消息渠道" value={selectedChannel} options={[{ value: 'weixin', label: '微信' }, { value: 'telegram', label: 'Telegram' }]} onChange={setSelectedChannel} /></div>
    <div className={`agent-channel-layout ${selectedChannel === 'weixin' && login ? '' : 'agent-channel-layout-single'}`}>
      <div className="agent-channel-list">
        {selectedChannel === 'weixin' ? <section className="agent-channel-row">
          <span className="agent-channel-mark weixin" aria-hidden="true"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 3C5.6 3 2 5.7 2 9c0 1.8 1.1 3.5 2.8 4.6L4 16l3-1.4c.6.2 1.2.3 1.9.4-.5-.8-.8-1.7-.8-2.6 0-3.2 3.2-5.8 7.1-5.8h1.7C15.7 4.5 13.1 3 10 3Zm-3 4a1 1 0 1 1 0 2 1 1 0 0 1 0-2Zm6 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z" /><path d="M22 13c0-2.8-2.8-5-6.3-5s-6.3 2.2-6.3 5 2.8 5 6.3 5c.7 0 1.4-.1 2.1-.3L20 19l-.5-2.1C21 16 22 14.6 22 13Zm-8.5-2a.8.8 0 1 1 0 1.6.8.8 0 0 1 0-1.6Zm4.5 0a.8.8 0 1 1 0 1.6.8.8 0 0 1 0-1.6Z" /></svg></span>
          <div className="agent-channel-content">
            <div className="agent-channel-heading"><h3>微信</h3><span className={`agent-status ${channels?.status.weixin === 'connected' ? 'connected' : ''}`}>{CHANNEL_STATUS[channels?.status.weixin ?? 'disconnected'] ?? '未连接'}</span></div>
            <p className="agent-channel-description">扫码连接，在手机上查看终端并发送指令。</p>
            {channels?.status.weixin === 'connected' && <p className="agent-channel-account">{channels.weixin.accountId}</p>}
            {!login && loginMessage && <p className="agent-field-hint" role="status">{loginMessage}</p>}
            <div className="agent-channel-controls"><button type="button" className="agent-button" disabled={!!busy} onClick={() => void connectWeixin()}>{busy === 'weixin' ? '正在连接…' : login ? '刷新二维码' : channels?.weixin.enabled ? '重新连接' : '连接微信'}</button>{(channels?.weixin.enabled || login) && <button type="button" className="agent-button quiet" disabled={!!busy} onClick={() => void disconnect('weixin')}>断开</button>}</div>
            {needsVerify && <form className="agent-channel-controls" onSubmit={verify}><input className="agent-inline-input" aria-label="微信验证码" required autoComplete="one-time-code" placeholder="微信验证码" value={verifyCode} onChange={event => setVerifyCode(event.target.value)} /><button type="submit" className="agent-button" disabled={!!busy}>提交</button></form>}
            {channels?.status.weixinError && <p className="agent-feedback error">{channels.status.weixinError}</p>}
          </div>
        </section> : <section className="agent-channel-row">
          <span className="agent-channel-mark telegram" aria-hidden="true"><svg viewBox="0 0 24 24" fill="currentColor"><path d="m20.7 4.2-3.2 15c-.2 1-1 1.2-1.8.7l-4.9-3.6-2.4 2.3c-.3.3-.5.5-1 .5l.4-5 9.1-8.2c.4-.4-.1-.6-.6-.3L5 12.7 1.2 11.5c-.9-.3-.9-.9.2-1.3L19 3.4c.8-.3 1.5.2 1.7.8Z" /></svg></span>
          <div className="agent-channel-content">
            <div className="agent-channel-heading"><h3>Telegram</h3><span className={`agent-status ${channels?.status.telegram === 'connected' ? 'connected' : ''}`}>{CHANNEL_STATUS[channels?.status.telegram ?? 'disconnected'] ?? '未连接'}</span></div>
            <p className="agent-channel-description">在 BotFather 创建 Bot，粘贴 Token 后配对。</p>
            {channels?.telegram.botName && <p className="agent-channel-account">@{channels.telegram.botName}</p>}
            <form className="agent-channel-controls" onSubmit={connectTelegram}><input className="agent-inline-input" aria-label="Bot Token" type="password" autoComplete="new-password" value={token} spellCheck={false} placeholder={channels?.telegram.hasToken ? '输入 Token 重新连接' : '粘贴 BotFather 提供的 Token'} onChange={event => setToken(event.target.value)} /><button type="submit" className="agent-button" disabled={!!busy || !token.trim()}>{busy === 'telegram' ? '正在连接…' : '连接'}</button>{channels?.telegram.enabled && <button type="button" className="agent-button quiet" disabled={!!busy} onClick={() => void disconnect('telegram')}>断开</button>}</form>
            {pairing && channels?.status.telegram !== 'connected' && <div className="agent-pairing"><p>向 @{pairing.botName} 发送（10 分钟内有效）：</p><code>/pair {pairing.pairingCode}</code></div>}
            {channels?.status.telegram === 'waiting_pairing' && !pairing && <p className="agent-field-hint">重新连接可获取新的配对码。</p>}
            {channels?.status.telegramError && <p className="agent-feedback error">{channels.status.telegramError}</p>}
          </div>
        </section>}
      </div>
      {selectedChannel === 'weixin' && login && <aside className="agent-qr" aria-label="微信二维码区域"><img src={login.qrDataUrl} width="160" height="160" alt="使用微信扫描此二维码连接 Agent" /><p role="status">{loginMessage}</p></aside>}
    </div>
    {feedback && <p className="agent-feedback" role="status">{feedback}</p>}{error && <p className="agent-feedback error" role="alert">{error}</p>}
  </section>;
}

function AgentHelpModal({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!previousFocus.current && document.activeElement instanceof HTMLElement) previousFocus.current = document.activeElement;
    if (!dialogRef.current?.open) dialogRef.current?.showModal();
    dialogRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => previousFocus.current?.focus();
  }, []);

  return createPortal(<dialog ref={dialogRef} className="settings-modal agent-help-modal" aria-labelledby="agent-help-title" onClose={onClose} onMouseDown={event => { if (event.target === event.currentTarget) event.currentTarget.close(); }}>
    <div className="settings-content">
    <div className="settings-header"><span className="settings-header-title" id="agent-help-title">使用说明与示例</span><button type="button" className="settings-close" aria-label="关闭使用说明" onClick={() => dialogRef.current?.close()}>×</button></div>
    <div className="settings-body agent-help-content">
    <h3>工作方式</h3>
    <p>市面上有很多终端工具推出了自己的移动端 App。我们认为，在手机上继续手动操作终端，体验仍不够流畅；因此，我们选择用消息网关打通聊天渠道，让 Coffee Agent 听取你的指令，通过 Coffee CLI 的接口操控主界面、协调各个 CLI Agent。这是我们对 AI 时代工作方式的探索，也为远程主机上的 Agent 协作提供了一种思路。</p>
    <p>Coffee Agent 连接微信或 Telegram 后，会听取你的指令，读取 Coffee CLI 中各个终端的实际内容，在你指定的工具和目录中打开可见标签、派发任务并汇报进度；你也可以让它记住工作偏好，或开始新对话安排下一项工作。</p>
    <p>Coffee Agent 的消息连接功能仍在完善，使用过程中可能遇到一些问题。如果你遇到问题，或有意见和建议，欢迎通过 <a className="agent-help-link" href="https://github.com/edison7009/Coffee-CLI/issues" onClick={event => { event.preventDefault(); void commands.openUrl(event.currentTarget.href).catch(() => {}); }}>GitHub Issues</a> 提交反馈。</p>
    <h3>英文派发</h3>
    <p>建议开启。你可以用自己熟悉的语言与 Coffee Agent 沟通，它会整理你的需求，保留任务目标与约束，再用英文向 Claude Code、Codex 等 CLI Agent 派发任务，并用你的语言向你汇报进度和结果。关闭后，Coffee Agent 与你的对话、向其他 CLI Agent 派发的任务，都默认使用你的语言。</p>
    <p>统一任务语言，便于多个 Agent 理解和交接工作。你只需说明需求，由 Coffee Agent 协调各个工具，减少在不同终端之间反复输入、整理和转述指令的步骤，让多工具协作更顺畅。</p>
    <p>代码、命令、路径、网址和需要保留的原文不会被翻译；你明确指定的任务语言与输出语言也会保留。手动 Gambit 输入保持原样。开关自动保存，从下一条任务生效，无需保存模型配置。</p>
    <p>小技巧：在符合当地要求，以及模型商、工具商的地区与账号政策的前提下，你可以在美国地区的远程主机上安装 Coffee CLI 和 Claude Code，连接微信并开启英文派发，用中文安排工作、用英文派发任务。遵守服务商政策，有助于减少因违规带来的账号风险；远程主机所在地和任务语言不改变实际使用资格。Coffee CLI 需要保持运行。</p>
    <h3>可以这样说</h3>
    <dl className="agent-command-examples">{[
      ['打开终端', '在 E:\\我的项目 打开 Claude Code。'],
      ['新建目录', '新建 E:\\新项目，并在这个目录打开 Codex。'],
      ['查看进度', '读取所有终端，分别告诉我在做什么、是否完成。'],
      ['安排工作', '让 1 号 Claude Code 终端运行测试，并汇报结果。'],
      ['继续历史', '继续 E:\\我的项目 最新的 Codex 历史会话。'],
      ['查看记录', '帮我查看最近十条的对话记录。'],
      ['记住偏好', '记住：我希望你用中文汇报，先说明结果。'],
      ['查看记忆', '你记住了哪些工作偏好？'],
      ['忘记内容', '忘记我之前让你记住的这条偏好：……'],
      ['开始新对话', '/new，或“新对话”。保留长期记忆和旧记录，不关闭终端。'],
      ['取消请求', '手机发送 /cancel 或“取消当前请求”，客户端点击停止按钮；已发给 CLI 的任务可能继续运行。'],
    ].map(([label, command]) => <div key={label}><dt>{label}</dt><dd>{command}</dd></div>)}</dl>
    <p className="agent-field-hint">你可以在手机渠道或 Coffee Agent 对话页安排工作。示例目录请替换成你的完整路径；未指定工具或目录时，Agent 会先询问。“查看记录”按最近活动时间列出 CLI 工作会话，不包含 Coffee Agent 自身聊天。新对话整理聊天上下文，打开终端会在主界面创建可见 tab。</p>
    </div>
    </div>
  </dialog>, document.body);
}

export function AgentPages({ page }: { page: AgentPage }) {
  const { state } = useAppState();
  const [helpOpen, setHelpOpen] = useState(false);
  if (page === 'config') return <PageFrame page="config"><div className="agent-settings-scroll"><div className="agent-settings-content"><p className="agent-settings-intro">通过微信或 Telegram 与 Coffee Agent 对话，读取终端、安排任务，在电脑上继续接管工作。<button type="button" className="agent-help-link" onClick={() => setHelpOpen(true)}>（使用说明，首次使用必看）</button></p><AgentModelSection /><AgentDelegationSection /><AgentChannelsSection /></div></div>{helpOpen && state.agentPageActive === 'config' && <AgentHelpModal onClose={() => setHelpOpen(false)} />}</PageFrame>;
  return <AgentChatPage />;
}

export function ChannelConnectionSummary() {
  const { state, dispatch } = useAppState();
  const { channels } = useAgentClient();
  const weixin = channels?.status.weixin === 'connected';
  const telegram = channels?.status.telegram === 'connected';
  const label = weixin && telegram ? '微信 · Telegram 已连接' : weixin ? '微信已连接' : telegram ? 'Telegram 已连接' : '尚未连接消息渠道';
  return <div className="agent-channel-summary">
    <button type="button" className="agent-channel-summary-label" aria-label={`${label}，打开消息设置`} onClick={() => dispatch({ type: 'OPEN_AGENT_PAGE', page: 'config' })}>{label}</button>
    <button type="button" className="agent-sidebar-button" aria-label="打开 Coffee Agent" aria-pressed={state.agentPageActive === 'agent'} onClick={() => dispatch({ type: 'OPEN_AGENT_PAGE', page: 'agent' })}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 14H6l-4 3V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3" /><path d="M10 8h10a2 2 0 0 1 2 2v12l-4-3h-8a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z" /></svg>
    </button>
  </div>;
}
