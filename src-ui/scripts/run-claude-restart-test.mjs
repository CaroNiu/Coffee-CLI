import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import { build } from 'esbuild';

const bundle = await build({ entryPoints: ['src/lib/claude-session.ts'], bundle: true, platform: 'node', format: 'cjs', write: false,
  plugins: [{ name: 'native-fixture', setup(builder) {
    builder.onResolve({ filter: /(?:^react$|\/tauri$|^@tauri-apps\/api\/event$)/ }, args => ({ path: args.path, namespace: 'fixture' }));
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ loader: 'js', contents: args.path === 'react' ? 'export function useSyncExternalStore() {}' : args.path.includes('/event') ? 'export async function listen(name, listener) { globalThis.setListener(listener); return () => {}; }' : 'export const invoke = globalThis.nativeInvoke;' }));
  } }],
});
function fixture(options = {}) {
  let listener, starts = 0, generation;
  const calls = [], original = { command: 'custom-claude --verbose', extra_args: ['--effort', 'high'], default_cwd: 'D:/Workspace', history_path: 'D:/History' };
  let config = structuredClone(original), native = { model: 'custom-model', effort: 'xhigh', ultracode: true, thinking: false, mode: 'default' };
  const invoke = async (command, args) => {
    calls.push({ command, ...args });
    if (command === 'get_tool_config') return structuredClone(config);
    if (command === 'set_tool_config') { if (options.failSave) throw new Error('Config could not be saved'); config = structuredClone(args.entry); return; }
    if (command === 'claude_session_start') {
      starts++; generation = args.generation;
      if (starts > 1) { if (options.failStart) throw new Error('Restart failed'); native = { model: 'default-model', effort: 'high', ultracode: false, thinking: true, mode: 'default' }; }
      return { sessionId: args.resumeToken || `native-${starts}`, initialization: { models: [], commands: [], current_permission_mode: native.mode }, history: { data: options.empty ? '' : JSON.stringify({ type: 'user', uuid: 'original', message: { content: 'Keep this conversation' } }), cursor: starts > 1 && !options.empty ? 128 : 0 } };
    }
    if (command === 'claude_session_close') { listener({ payload: { id: args.id, generation: args.generation, event: { type: 'coffee_exit', code: 1 } } }); return; }
    if (command === 'claude_session_send') return;
    assert.equal(command, 'claude_session_control');
    assert.equal(args.generation, generation);
    const request = args.request;
    if (request.subtype === 'get_settings') return { applied: { model: native.model, effort: native.effort, ultracode: native.ultracode }, effective: { alwaysThinkingEnabled: native.thinking } };
    if (request.subtype === 'set_model') native.model = request.model;
    if (request.subtype === 'apply_flag_settings') native = { ...native, effort: request.settings.effortLevel, ultracode: request.settings.ultracode, thinking: request.settings.alwaysThinkingEnabled };
    if (request.subtype === 'set_permission_mode') { if (options.failMode) throw new Error('Policy denied bypass'); native.mode = request.mode; }
    if (request.subtype === 'interrupt') listener({ payload: { id: args.id, generation, event: { type: 'result', usage: {} } } });
    return {};
  };
  const module = { exports: {} };
  runInNewContext(bundle.outputFiles[0].text, { module, exports: module.exports, nativeInvoke: invoke, setListener: fn => { listener = fn; }, crypto: { randomUUID }, setTimeout, clearTimeout });
  return { api: module.exports, calls, options, original, config: () => config, native: () => native };
}
async function ready(h) {
  const release = h.api.retainClaudeSession('tab', 'D:/Workspace');
  for (let i = 0; i < 100 && !h.api.getClaudeSession('tab').ready; i++) await new Promise(resolve => setTimeout(resolve, 2));
  assert.equal(h.api.getClaudeSession('tab').ready, true);
  return release;
}
for (const options of [{}, { busy: true }, { empty: true }]) {
  const h = fixture(options), release = await ready(h);
  try {
    if (options.busy) await h.api.sendClaudeMessage('tab', 'Working prompt');
    const before = h.api.getClaudeSession('tab');
    await h.api.controlClaude('tab', { subtype: 'set_permission_mode', mode: 'bypassPermissions' });
    const after = h.api.getClaudeSession('tab'), starts = h.calls.filter(c => c.command === 'claude_session_start');
    assert.equal(starts.length, 2);
    assert.equal(starts[1].resumeToken, options.empty ? null : before.nativeId);
    assert.notEqual(starts[0].generation, starts[1].generation);
    assert.equal(starts[1].cwd, 'D:/Workspace');
    assert.deepEqual(after.messages.map(m => m.content), before.messages.map(m => m.content));
    assert.equal(after.historyCursor, 0, 'loaded history position does not get replaced with a newer page cursor');
    for (const key of ['model', 'effort', 'ultracode', 'thinking']) assert.equal(after[key], before[key], `${key} restored`);
    assert.equal(after.permissionMode, 'bypassPermissions'); assert.equal(after.ready, true); assert.equal(after.error, undefined);
    assert.equal(h.native().mode, 'bypassPermissions');
    assert.deepEqual(h.config(), { ...h.original, extra_args: [...h.original.extra_args, '--allow-dangerously-skip-permissions'] });
    if (options.busy) assert.ok(h.calls.findIndex(c => c.request?.subtype === 'interrupt') < h.calls.findIndex(c => c.command === 'claude_session_close'));
    await h.api.controlClaude('tab', { subtype: 'set_permission_mode', mode: 'default' });
    assert.equal(h.calls.filter(c => c.command === 'claude_session_start').length, 2, 'ordinary modes switch live');
    console.log('OK: restart preserves conversation, settings, cwd and unrelated launch configuration', options);
  } finally { release(); }
}
for (const options of [{ failSave: true }, { failStart: true }, { failMode: true }]) {
  const h = fixture(options), release = await ready(h);
  try {
    await assert.rejects(h.api.controlClaude('tab', { subtype: 'set_permission_mode', mode: 'bypassPermissions' }));
    const state = h.api.getClaudeSession('tab');
    assert.equal(state.permissionMode, 'default');
    assert.equal(state.messages[0].content, 'Keep this conversation');
    assert.equal(state.errorKey, 'claude.error.restart');
    assert.equal(state.ready, !!options.failSave);
    if (options.failSave) assert.equal(h.calls.filter(c => c.command === 'claude_session_close').length, 0);
    console.log('OK: failed restart never fakes an applied bypass selection', options);
  } finally { release(); }
}
