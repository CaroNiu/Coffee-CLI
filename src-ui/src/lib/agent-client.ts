import { useSyncExternalStore } from 'react';
import { invoke } from '../tauri';

export interface AgentMessage { id: number; role: 'user' | 'assistant'; text: string }
export interface AgentConversation { id: string; route: string; source: string; title: string; updatedAt: number; messageCount: number }
interface ConversationPage { id: string; route: string; messages: AgentMessage[]; hasOlder: boolean; runId: string | null }
export interface ChannelSettings {
  telegram: { enabled: boolean; botName?: string; allowedUserId?: string; hasToken?: boolean };
  weixin: { enabled: boolean; accountId?: string; allowedUserId?: string };
  status: { telegram: string; weixin: string; telegramError?: string; weixinError?: string };
}
export interface AgentEvent { conversationId: string; runId: string; kind: string; text?: string; tool?: string }
interface Snapshot {
  conversationId: string;
  route: string;
  conversations: AgentConversation[];
  hasOlder: boolean;
  loadingOlder: boolean;
  messages: AgentMessage[];
  running: boolean;
  activity: string;
  error: string;
  channels: ChannelSettings | null;
}
let snapshot: Snapshot = { conversationId: '', route: 'desktop', conversations: [], hasOlder: false, loadingOlder: false, messages: [], running: false, activity: '', error: '', channels: null };
let conversationRevision = 0;
let channelRevision = 0;
const listeners = new Set<() => void>();
const runs = new Map<string, string>();
let listRequest = 0;
function update(patch: Partial<Snapshot>) {
  if (patch.messages) conversationRevision++;
  if (patch.channels) channelRevision++;
  snapshot = { ...snapshot, ...patch };
  listeners.forEach(listener => listener());
}
export function useAgentClient() {
  return useSyncExternalStore(listener => { listeners.add(listener); return () => listeners.delete(listener); }, () => snapshot);
}
export async function refreshAgentConversation() {
  const revision = conversationRevision;
  const target = snapshot.conversationId || 'desktop';
  const page = await invoke<ConversationPage>('agent_get_conversation', { conversationId: target });
  if (revision === conversationRevision && target === (snapshot.conversationId || 'desktop')) {
    currentRun = runs.get(page.id) ?? page.runId ?? '';
    update({ conversationId: page.id, route: page.route, messages: page.messages, hasOlder: page.hasOlder, running: !!currentRun });
  }
}
export async function refreshAgentConversations() {
  const request = ++listRequest;
  const conversations = await invoke<AgentConversation[]>('agent_list_conversations');
  if (request === listRequest) update({ conversations });
}
export function receiveConversationChanged(id: string) {
  refreshAgentConversations().catch(() => {});
  if (snapshot.conversationId === id && !snapshot.running) refreshAgentConversation().catch(() => {});
}
export async function openAgentConversation(id: string) {
  currentRun = runs.get(id) ?? '';
  replyIndex = -1;
  update({ conversationId: id, messages: [], running: !!currentRun, hasOlder: false, loadingOlder: false, activity: '', error: '' });
  try { await refreshAgentConversation(); }
  catch (error) { if (snapshot.conversationId === id) update({ error: String(error) }); throw error; }
}
export async function loadOlderAgentMessages() {
  if (!snapshot.hasOlder || snapshot.loadingOlder || !snapshot.messages[0]) return;
  const id = snapshot.conversationId;
  const before = snapshot.messages[0].id;
  update({ loadingOlder: true });
  try {
    const page = await invoke<ConversationPage>('agent_get_conversation', { conversationId: id, before });
    if (snapshot.conversationId === id && snapshot.messages[0]?.id === before) {
      if (replyIndex >= 0) replyIndex += page.messages.length;
      update({ messages: [...page.messages, ...snapshot.messages], hasOlder: page.hasOlder });
    }
  } finally { if (snapshot.conversationId === id) update({ loadingOlder: false }); }
}
export async function refreshChannels() {
  const revision = channelRevision;
  const channels = await invoke<ChannelSettings>('channel_get_settings');
  if (revision === channelRevision) update({ channels });
}
export function receiveChannelStatus(channels: ChannelSettings) { update({ channels }); }
let currentRun = '';
let replyIndex = -1;
export function receiveAgentEvent(event: AgentEvent) {
  if (event.kind === 'started') runs.set(event.conversationId, event.runId);
  if (['done', 'error', 'cancelled'].includes(event.kind)) {
    if (runs.get(event.conversationId) === event.runId) runs.delete(event.conversationId);
    refreshAgentConversations().catch(() => {});
  }
  if (event.conversationId !== snapshot.conversationId) return;
  if (event.kind === 'started') {
    currentRun = event.runId;
    replyIndex = -1;
    update({ running: true, activity: '正在思考…', error: '' });
  } else if (event.runId === currentRun) {
    if (event.kind === 'tool') update({ activity: `正在操作：${event.tool ?? ''}` });
    if (event.kind === 'context') update({ activity: event.text ?? '正在整理前文…' });
    if (event.kind === 'text' && event.text) {
      const messages = [...snapshot.messages];
      if (replyIndex < 0) { replyIndex = messages.length; messages.push({ id: -Date.now(), role: 'assistant', text: event.text }); }
      else messages[replyIndex] = { ...messages[replyIndex], text: messages[replyIndex].text + event.text };
      update({ messages });
    }
    if (['done', 'error', 'cancelled'].includes(event.kind)) {
      update({ running: false, activity: '', error: event.kind === 'error' ? event.text ?? '请求失败' : '' });
      refreshAgentConversation().catch(error => update({ error: String(error) }));
    }
  }
}
export async function sendAgentMessage(text: string) {
  if (!snapshot.conversationId) await refreshAgentConversation();
  if (snapshot.running) throw new Error('Agent 正在处理上一条消息');
  if (['/new', '新对话', '开始新对话'].includes(text.trim())) {
    const id = await invoke<string>('agent_new_conversation', { conversationId: snapshot.conversationId });
    await openAgentConversation(id);
    await refreshAgentConversations();
    return;
  }
  const conversationId = snapshot.conversationId;
  update({ messages: [...snapshot.messages, { id: -Date.now(), role: 'user', text }], running: true, error: '', activity: '正在连接模型…' });
  try { await invoke('agent_send_message', { conversationId, text }); }
  catch (error) {
    if (snapshot.conversationId === conversationId) {
      update({ running: false, activity: '', error: String(error) });
      await refreshAgentConversation().catch(() => {});
    }
    throw error;
  }
}
