import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = file => ts.createSourceFile(file,
  readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8'),
  ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const center = source('components/center/CenterPanel.tsx');
const store = source('store/app-state.tsx');
function declaration(tree, name) {
  const node = tree.statements.find(item => ts.isFunctionDeclaration(item) && item.name?.text === name);
  assert.ok(node, `Missing actual ${name} declaration`);
  return node.getText(tree).replace(/^export\s+/, '');
}
function callback(name) {
  let found;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(center) === name) found = node.initializer;
    ts.forEachChild(node, visit);
  }
  visit(center);
  assert.ok(found, `Missing actual ${name} callback`);
  return found.getText(center);
}
const compile = code => ts.transpileModule(code, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const stateApi = vm.runInNewContext(compile(`${declaration(store, 'getTabOrder')}; ${declaration(store, 'reducer')}; ({ getTabOrder, reducer });`), {
  localStorage: { setItem() {}, removeItem() {} }, crypto: { randomUUID: () => 'replacement-terminal' },
  supportsAgentStatus: () => true,
});
const native = value => JSON.parse(JSON.stringify(value));
let passed = 0;
function test(name, run) { run(); passed++; console.log(`  ok  ${name}`); }

// Check the actual rendered Agent and terminal tabs use the tested pointer and
// click handlers, rather than exercising detached copies of dead callbacks.
const renderedTabs = [];
let agentClose;
function inspect(node) {
  if (ts.isJsxOpeningElement(node)) {
    const attrs = node.attributes.properties.filter(ts.isJsxAttribute);
    if (attrs.some(attr => attr.name.getText(center) === 'data-tab-id')) {
      renderedTabs.push(Object.fromEntries(attrs.map(attr => [attr.name.getText(center), attr.initializer?.getText(center)])));
    }
    const close = attrs.find(attr => attr.name.getText(center) === 'aria-label' && attr.initializer?.getText(center).includes('agent.page.close_agent'));
    if (close) agentClose = attrs.find(attr => attr.name.getText(center) === 'onClick')?.initializer?.expression;
  }
  ts.forEachChild(node, inspect);
}
inspect(center);
assert.equal(renderedTabs.length, 2, 'Agent and terminal branches each render a shared draggable tab');
for (const tab of renderedTabs) {
  assert.match(tab.onPointerDown, /onTabPointerDown/);
  assert.match(tab.onClick, /onTabClickGuarded/);
}
assert.ok(agentClose, 'Use the actual Agent tab close click handler');

function fixture(order = ['one', 'two', 'agent:config', 'agent:agent']) {
  let state = {
    terminals: [{ id: 'one', tool: 'claude', folderPath: 'E:\\one' }, { id: 'two', tool: 'codex', folderPath: 'E:\\two' }],
    agentPages: ['config', 'agent'], tabOrder: order,
    activeTerminalId: 'one', agentPageActive: null, diffTabActive: false,
  };
  const listeners = new Map(), actions = [], dragFrames = [];
  const dispatch = action => { actions.push(native(action)); state = stateApi.reducer(state, action); };
  const visible = () => Array.from(stateApi.getTabOrder(state)).filter(id => {
    const terminal = state.terminals.find(tab => tab.id === id);
    return !terminal || !terminal.isHidden || id === state.activeTerminalId;
  });
  const context = {
    dispatch, tabDrag: null, tabDragSuppressClickRef: { current: false },
    tabsHeaderRef: { current: { querySelectorAll(selector) {
      assert.equal(selector, '.chrome-tab[data-tab-id]');
      return visible().map((id, index) => ({ dataset: { tabId: id }, getBoundingClientRect: () => ({ left: index * 100, width: 100 }) }));
    } } },
    setTabDrag(value) { context.tabDrag = value; dragFrames.push(native(value)); },
    document: {
      addEventListener(name, handler) { assert.ok(!listeners.has(name)); listeners.set(name, handler); },
      removeEventListener(name, handler) { assert.equal(listeners.get(name), handler); listeners.delete(name); },
    },
    page: 'config',
  };
  const api = vm.runInNewContext(compile(`const onTabPointerDown = ${callback('onTabPointerDown')}; const onTabClickGuarded = ${callback('onTabClickGuarded')}; const getTabDragStyle = ${callback('getTabDragStyle')}; const close = ${agentClose.getText(center)}; ({ onTabPointerDown, onTabClickGuarded, getTabDragStyle, close });`), context);
  const centerX = id => visible().indexOf(id) * 100 + 50;
  function down(id, options = {}) {
    api.onTabPointerDown({ button: options.button ?? 0, clientX: centerX(id), target: { closest: selector => options.close && selector === '.tab-close-btn' ? {} : null } }, id);
  }
  function move(x) { listeners.get('pointermove')?.({ clientX: x }); }
  function up(x) { listeners.get('pointerup')?.({ clientX: x }); }
  return { api, actions, dragFrames, listeners, visible, down, move, up, centerX,
    get state() { return state; }, dispatch };
}

test('message settings drag left across terminal tabs without changing the focused surface', () => {
  const f = fixture();
  f.down('agent:config'); f.move(-50);
  assert.equal(f.dragFrames.at(-1).tabId, 'agent:config');
  assert.deepEqual(native(f.api.getTabDragStyle('one', 0)), { transform: 'translateX(100px)' });
  f.up(-50);
  assert.deepEqual(f.actions, [{ type: 'REORDER_TAB', tabId: 'agent:config', beforeId: 'one' }]);
  assert.deepEqual(f.visible(), ['agent:config', 'one', 'two', 'agent:agent']);
  assert.equal(f.state.activeTerminalId, 'one'); assert.equal(f.state.agentPageActive, null);
  assert.equal(f.listeners.size, 0); assert.equal(f.dragFrames.at(-1), null);
});

test('Coffee Agent drags right through terminals and message settings', () => {
  const f = fixture(['one', 'agent:agent', 'two', 'agent:config']);
  f.down('agent:agent'); f.move(500);
  assert.deepEqual(native(f.api.getTabDragStyle('two', 2)), { transform: 'translateX(-100px)' });
  f.up(500);
  assert.deepEqual(f.actions, [{ type: 'REORDER_TAB', tabId: 'agent:agent', beforeId: null }]);
  assert.deepEqual(f.visible(), ['one', 'two', 'agent:config', 'agent:agent']);
});

test('terminal dragging shares mixed tab order and keeps real terminal objects and numbering', () => {
  const f = fixture(['one', 'agent:config', 'two', 'agent:agent']);
  const original = [...f.state.terminals];
  f.down('one'); f.move(600); f.up(600);
  assert.deepEqual(f.visible(), ['agent:config', 'two', 'agent:agent', 'one']);
  assert.deepEqual(Array.from(f.state.terminals, tab => tab.id), ['two', 'one']);
  assert.equal(f.state.terminals[0], original[1]); assert.equal(f.state.terminals[1], original[0]);
  assert.equal(f.state.activeTerminalId, 'one');
});

test('the click generated after dragging never activates the dropped Agent tab', () => {
  const f = fixture();
  f.down('agent:agent'); f.move(-50); f.up(-50);
  f.api.onTabClickGuarded('agent:agent');
  assert.equal(f.actions.length, 1); assert.equal(f.state.agentPageActive, null);
  f.api.onTabClickGuarded('agent:agent');
  assert.deepEqual(f.actions.at(-1), { type: 'OPEN_AGENT_PAGE', page: 'agent' });
  assert.equal(f.state.agentPageActive, 'agent');
});

test('a normal settings click remains a click below the drag threshold', () => {
  const f = fixture(); const x = f.centerX('agent:config');
  f.down('agent:config'); f.move(x + 4); f.up(x + 4); f.api.onTabClickGuarded('agent:config');
  assert.deepEqual(f.actions, [{ type: 'OPEN_AGENT_PAGE', page: 'config' }]);
  assert.equal(f.state.agentPageActive, 'config'); assert.equal(f.listeners.size, 0);
});

test('close buttons do not start dragging and use the real Agent close action', () => {
  const f = fixture();
  f.down('agent:config', { close: true });
  assert.equal(f.listeners.size, 0); f.move(-100); f.up(-100);
  let stopped = false;
  f.api.close({ stopPropagation() { stopped = true; } });
  assert.equal(stopped, true);
  assert.deepEqual(f.actions, [{ type: 'CLOSE_AGENT_PAGE', page: 'config' }]);
  assert.deepEqual(f.visible(), ['one', 'two', 'agent:agent']);
});

test('non-primary buttons cannot start a drag', () => {
  const f = fixture();
  for (const button of [1, 2]) f.down('agent:config', { button });
  assert.equal(f.listeners.size, 0); assert.equal(f.actions.length, 0);
});

test('hidden terminals retain their lifecycle and are excluded from drag geometry', () => {
  const f = fixture(['one', 'two', 'agent:config', 'agent:agent']);
  f.dispatch({ type: 'SET_TERMINAL_HIDDEN', id: 'two', isHidden: true });
  f.actions.length = 0;
  f.down('agent:config'); f.move(-100); f.up(-100);
  assert.deepEqual(f.visible(), ['agent:config', 'one', 'agent:agent']);
  assert.deepEqual(Array.from(stateApi.getTabOrder(f.state)), ['agent:config', 'one', 'two', 'agent:agent']);
  assert.equal(f.state.terminals.find(tab => tab.id === 'two').isHidden, true);
});

test('close, reopen, new launch and terminal restart preserve remaining mixed order', () => {
  const f = fixture(['agent:config', 'one', 'agent:agent', 'two']);
  f.dispatch({ type: 'CLOSE_AGENT_PAGE', page: 'config' });
  f.dispatch({ type: 'OPEN_AGENT_PAGE', page: 'config' });
  f.dispatch({ type: 'LAUNCH_TERMINAL_TOOL', id: 'three', tool: 'claude', cwd: 'E:\\three' });
  f.dispatch({ type: 'RESTART_TERMINAL', id: 'one', newId: 'one-new' });
  assert.deepEqual(f.visible(), ['one-new', 'agent:agent', 'two', 'agent:config', 'three']);
  assert.equal(new Set(f.visible()).size, f.visible().length);
});

console.log(`\n${passed} shared tab pointer-drag tests passed.`);
