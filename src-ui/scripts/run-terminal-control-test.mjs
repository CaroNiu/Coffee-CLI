import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { runInNewContext } from 'node:vm';
import { fileURLToPath } from 'node:url';

const compiled = await build({ entryPoints: [fileURLToPath(new URL('../src/lib/terminal-control.ts', import.meta.url))], bundle: true, platform: 'node', format: 'cjs', write: false });
let passed = 0;
async function test(name, run) { await run(); passed++; console.log(`  ok  ${name}`); }
function fixture() {
  const writes = [];
  let failure;
  let enterGate;
  const module = { exports: {} };
  runInNewContext(compiled.outputFiles[0].text, {
    module, exports: module.exports, console, setTimeout, clearTimeout,
    window: { __TAURI_INTERNALS__: { invoke: async (command, args) => {
      assert.equal(command, 'tier_terminal_input');
      writes.push(args);
      if (failure) throw new Error(failure);
      if (args.data === '\r' && enterGate) await enterGate;
    } } },
  });
  const api = module.exports;
  let submitted = 0;
  const term = { modes: { applicationCursorKeysMode: false }, paste: text => { api.forwardTerminalInput('target', `\x1b[200~${text.replace(/\n/g, '\r')}\x1b[201~`).catch(() => {}); } };
  const dispose = api.registerTerminalControl('target', term, () => submitted++);
  return { api, writes, term, dispose, setFailure: value => { failure = value; }, holdEnter: () => { let release; enterGate = new Promise(resolve => { release = resolve; }); return release; }, get submitted() { return submitted; } };
}
await test('does not send before PTY startup or after exit', async () => {
  const f = fixture();
  await assert.rejects(f.api.submitTerminalPrompt('target', '任务'), /尚未启动/);
  f.api.setTerminalControlReady('target', true);
  f.api.setTerminalControlReady('target', false);
  await assert.rejects(f.api.submitTerminalPrompt('target', '任务'), /进程已退出/);
  assert.equal(f.writes.length, 0);
});
await test('uses xterm bracketed paste, acknowledged write and separate Enter for one explicit target', async () => {
  const f = fixture(); f.api.setTerminalControlReady('target', true);
  await f.api.submitTerminalPrompt('target', '中文\r\n第二行');
  assert.equal(f.writes.length, 2);
  assert.equal(f.writes[0].sessionId, 'target');
  assert.equal(f.writes[0].data, '\x1b[200~中文\r第二行\x1b[201~');
  assert.equal(f.writes[1].data, '\r');
  assert.equal(f.submitted, 1);
});
await test('write error rejects and never sends Enter or reports submitted', async () => {
  const f = fixture(); f.api.setTerminalControlReady('target', true); f.setFailure('PTY gone');
  await assert.rejects(f.api.submitTerminalPrompt('target', '任务'), /PTY gone/);
  assert.equal(f.writes.length, 1);
  assert.equal(f.submitted, 0);
  assert.equal(f.api.terminalControlStatus('target').localInputPending, true);
});
await test('local unfinished input blocks remote paste and accidental Enter', async () => {
  const f = fixture(); f.api.setTerminalControlReady('target', true);
  await f.api.forwardTerminalInput('target', 'unsent');
  await assert.rejects(f.api.submitTerminalPrompt('target', 'remote'), /本地未提交/);
  await assert.rejects(f.api.sendTerminalKey('target', 'Enter', () => true), /本地未提交/);
  assert.equal(f.writes.length, 1);
  await f.api.sendTerminalKey('target', 'CtrlC', () => true);
  assert.equal(f.api.terminalControlStatus('target').localInputPending, false);
});
await test('a local multiline bracketed paste is unsent input, despite embedded newlines', async () => {
  const f = fixture(); f.api.setTerminalControlReady('target', true);
  await f.api.forwardTerminalInput('target', '\x1b[200~first\rsecond\x1b[201~');
  await assert.rejects(f.api.submitTerminalPrompt('target', 'remote'), /本地未提交/);
  assert.equal(f.writes.length, 1);
});
await test('local history navigation protects recalled input in normal and application cursor modes', async () => {
  for (const key of ['\x1b[A', '\x1b[B', '\x1bOA', '\x1bOB', '\x1b[1;5A']) {
    const f = fixture(); f.api.setTerminalControlReady('target', true);
    await f.api.forwardTerminalInput('target', key);
    await assert.rejects(f.api.submitTerminalPrompt('target', 'remote'), /本地未提交/);
    await assert.rejects(f.api.sendTerminalKey('target', 'Enter', () => true), /本地未提交/);
    assert.equal(f.writes.length, 1);
    await f.api.forwardTerminalInput('target', '\x03');
    assert.equal(f.api.terminalControlStatus('target').localInputPending, false);
  }
});
await test('local takeover during paste delay leaves pasted text unsubmitted', async () => {
  const f = fixture(); f.api.setTerminalControlReady('target', true);
  const operation = f.api.submitTerminalPrompt('target', 'remote');
  await f.api.forwardTerminalInput('target', 'local');
  await assert.rejects(operation, /检测到本地输入/);
  assert.equal(f.writes.some(write => write.data === '\r'), false);
  assert.equal(f.submitted, 0);
});
await test('typing while Enter acknowledgement is pending remains a protected local draft', async () => {
  const f = fixture(); f.api.setTerminalControlReady('target', true);
  const release = f.holdEnter();
  const operation = f.api.submitTerminalPrompt('target', 'remote');
  while (f.writes.length < 2) await new Promise(resolve => setTimeout(resolve, 10));
  await f.api.forwardTerminalInput('target', 'new-local-draft');
  release(); await operation;
  assert.equal(f.api.terminalControlStatus('target').localInputPending, true);
  await assert.rejects(f.api.submitTerminalPrompt('target', 'next-remote'), /本地未提交/);
});
await test('cancellation and replacement before delayed Enter cannot write to a new lifecycle', async () => {
  const f = fixture(); f.api.setTerminalControlReady('target', true);
  let valid = true;
  const operation = f.api.submitTerminalPrompt('target', 'remote', () => valid);
  valid = false;
  await assert.rejects(operation, /已关闭或改变/);
  assert.equal(f.writes.length, 1);
  await f.api.forwardTerminalInput('target', '\x03');
  const replacement = f.api.submitTerminalPrompt('target', 'old');
  f.api.registerTerminalControl('target', f.term, () => {});
  f.api.setTerminalControlReady('target', true);
  f.dispose();
  await assert.rejects(replacement, /已关闭或改变/);
  assert.equal(f.api.terminalControlStatus('target').ready, true);
});
await test('uses TUI application cursor mode and rejects arbitrary control sequences', async () => {
  const f = fixture(); f.api.setTerminalControlReady('target', true); f.term.modes.applicationCursorKeysMode = true;
  await f.api.sendTerminalKey('target', 'Down', () => true);
  assert.equal(f.writes[0].data, '\x1bOB');
  await assert.rejects(f.api.sendTerminalKey('target', '\x1b[3~', () => true), /不支持/);
  assert.equal(f.writes.length, 1);
});
console.log(`\n${passed} terminal control tests passed.`);
