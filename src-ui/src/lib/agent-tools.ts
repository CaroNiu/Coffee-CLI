import type { RefObject } from 'react';
import { isSplitTool, paneSessionId, type ToolType, type AppState, type useAppDispatch } from '../store/app-state';
import { commands, invoke } from '../tauri';
import { getTerminalObserver, listTerminalObservers } from './terminal-observer';
import { terminalControlStatus, submitTerminalPrompt, sendTerminalKey } from './terminal-control';
import { focusTerminal } from './focus-registry';

export interface ToolRequest { requestId: string; name: string; arguments: Record<string, unknown> }
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
function historyDirectory(path: string): string {
  const windows = /^[a-z]:[\\/]/i.test(path) || path.startsWith('\\\\');
  if (windows) return path.replace(/\\/g, '/').replace(/^\/\/\?\/UNC\//i, '//').replace(/^\/\/\?\//, '').replace(/\/+$/, '').toLowerCase();
  return path.replace(/\/+$/, '') || '/';
}

interface ToolContext {
  stateRef: RefObject<AppState>;
  dispatch: ReturnType<typeof useAppDispatch>;
  pending: (requestId: string) => Promise<boolean>;
  isCancelled: (requestId: string) => boolean;
}
export function createAgentToolExecutor({ stateRef, dispatch, pending, isCancelled }: ToolContext) {
    const project = () => {
      const observers = new Map(listTerminalObservers().map(observer => [observer.sessionId, observer]));
      return stateRef.current.terminals.flatMap(tab => {
        const panes = isSplitTool(tab.tool) ? tab.multiAgent?.panes ?? [] : [];
        const items = isSplitTool(tab.tool)
          ? panes.filter(pane => pane.tool).map(pane => ({ sessionId: paneSessionId(tab.id, pane.paneIdx, 'split'), tool: pane.tool, cwd: pane.folderPath ?? tab.folderPath, paneIdx: pane.paneIdx, status: pane.agentStatus }))
          : tab.tool ? [{ sessionId: tab.id, tool: tab.tool, cwd: tab.folderPath, paneIdx: undefined, status: tab.agentStatus }] : [];
        return items.map(item => ({ ...item, tabId: tab.id, title: tab.toolTitle, generation: observers.get(item.sessionId)?.generation ?? null, ...terminalControlStatus(item.sessionId) }));
      }).map((item, index) => ({ number: index + 1, ...item }));
    };
    return async (request: ToolRequest): Promise<unknown> => {
      const args = request.arguments;
      if (!await pending(request.requestId)) throw new Error('操作已取消');
      if (request.name === 'sessions_list') return { sessions: project(), observedAt: new Date().toISOString() };
      if (request.name === 'tools_list') return { tools: [...await commands.listTools(), { id: 'terminal', displayName: 'Terminal' }], installed: await commands.checkToolsInstalled() };
      if (request.name === 'directory_create') {
        if (typeof args.path !== 'string' || !args.path.trim()) throw new Error('请先指定新建目录的完整路径');
        return invoke<{ path: string; created: boolean }>('agent_create_directory', { path: args.path });
      }
      if (['workspace_list', 'file_read', 'file_create', 'file_edit'].includes(request.name)) {
        if (typeof args.cwd !== 'string' || !args.cwd.trim()) throw new Error('请先询问用户要操作哪个工作目录');
        return invoke('agent_workspace_tool', { name: request.name, arguments: args });
      }
      if (request.name === 'history_list') {
        const history = await commands.getNativeHistory();
        return { sessions: history.filter(item => (!args.tool || item.tool === args.tool) && (!args.cwd || historyDirectory(item.cwd) === historyDirectory(String(args.cwd)))).slice(0, 100) };
      }
      if (request.name === 'sessions_open') {
        if (typeof args.tool !== 'string' || !args.tool.trim()) throw new Error('请先询问用户要打开什么 CLI 工具');
        const tools = await commands.listTools();
        if (typeof args.tool !== 'string' || (args.tool !== 'terminal' && !tools.some(tool => tool.id === args.tool))) throw new Error('请选择已支持的 CLI 工具');
        if (typeof args.cwd !== 'string' || !args.cwd.trim()) throw new Error('请先询问用户要打开哪个目录');
        const cwd = await invoke<string>('agent_validate_directory', { path: args.cwd });
        if (!await pending(request.requestId)) throw new Error('操作已取消');
        const id = crypto.randomUUID();
        dispatch({ type: 'LAUNCH_TERMINAL_TOOL', id, tool: args.tool as ToolType, cwd, strictCwd: true, resumeToken: typeof args.resumeToken === 'string' ? args.resumeToken : undefined });
        const deadline = Date.now() + 15_000;
        let appeared = false;
        while (Date.now() < deadline) {
          if (isCancelled(request.requestId)) return { sessionId: id, cwd, opened: true, ready: false, message: '等待已取消；真实终端已打开' };
          if (stateRef.current.terminals.some(tab => tab.id === id)) appeared = true;
          else if (appeared) throw new Error('新终端已被用户关闭');
          const observer = getTerminalObserver(id);
          const status = terminalControlStatus(id);
          if (status.error) return { sessionId: id, cwd, opened: true, ready: false, generation: observer?.generation, error: status.error };
          if (observer && status.ready) return { ...project().find(item => item.sessionId === id), opened: true, screen: await observer.readScreen(), message: 'PTY 已启动；请先依据画面确认 CLI 已进入输入状态。登录、信任和授权提示需要用户处理。' };
          await pause(100);
        }
        if (!stateRef.current.terminals.some(tab => tab.id === id)) throw new Error('新终端未能打开或已经关闭');
        return { sessionId: id, cwd, opened: true, ready: false, generation: getTerminalObserver(id)?.generation, message: '终端仍在启动，请读屏核对后再发送' };
      }
      const sessionId = String(args.sessionId ?? '');
      const generation = String(args.generation ?? '');
      const observer = getTerminalObserver(sessionId);
      const target = project().find(item => item.sessionId === sessionId);
      if (!observer || !target || !generation || observer.generation !== generation) throw new Error('会话已关闭或重启，请重新读取终端清单');
      const guard = () => !isCancelled(request.requestId) && getTerminalObserver(sessionId)?.generation === generation;
      if (request.name === 'terminal_read_screen') return observer.readScreen(args.view === 'viewport' ? 'viewport' : 'live');
      if (request.name === 'terminal_read_scrollback') return observer.readScrollback(typeof args.startRow === 'number' ? args.startRow : undefined, typeof args.limit === 'number' ? args.limit : undefined);
      if (request.name === 'sessions_select') {
        dispatch({ type: 'SET_ACTIVE_TERMINAL', id: target.tabId });
        if (target.paneIdx !== undefined) dispatch({ type: 'SET_FOCUSED_PANE', tabId: target.tabId, paneIdx: target.paneIdx });
        requestAnimationFrame(() => { if (guard() && stateRef.current.activeTerminalId === target.tabId && !stateRef.current.agentPageActive && !stateRef.current.diffTabActive) focusTerminal(sessionId); });
        return { selected: true, ...target };
      }
      if (request.name === 'sessions_close') {
        await commands.tierTerminalKill(sessionId);
        if (!guard()) throw new Error('关闭期间目标会话已改变');
        if (target.paneIdx !== undefined) dispatch({ type: 'SET_PANE_TOOL', tabId: target.tabId, paneIdx: target.paneIdx, tool: null });
        else dispatch({ type: 'REMOVE_TERMINAL', id: target.tabId });
        return { closed: true, sessionId, generation };
      }
      if (request.name === 'terminal_send' || request.name === 'terminal_key') {
        const before = await observer.readScreen();
        const interrupt = request.name === 'terminal_key' && args.key === 'CtrlC';
        if (!interrupt && (before.freshness.gap || before.freshness.failed || before.freshness.flushState !== 'flushed')) throw new Error('终端输出尚未同步或存在丢失，暂不发送输入');
        if (!await pending(request.requestId) || !guard()) throw new Error('操作已取消或目标会话已改变');
        if (request.name === 'terminal_send') {
          if (typeof args.text !== 'string') throw new Error('消息必须是文本');
          await submitTerminalPrompt(sessionId, args.text, guard);
        } else await sendTerminalKey(sessionId, String(args.key), guard);
        await pause(200);
        if (!guard()) return { written: true, sessionId, generation, message: '输入已写入；会话随后关闭或操作已取消' };
        return { written: true, sessionId, generation, screen: await observer.readScreen(), message: 'PTY 已接收输入；请依据屏幕判断执行结果' };
      }
      throw new Error(`不支持的 Agent 工具：${request.name}`);
    };
}
