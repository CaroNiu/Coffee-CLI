// Isolated browser regression; no Claude process, credentials or user windows.
// Optional: COFFEE_PLAYWRIGHT_MODULE=file:///.../playwright-core/index.mjs,
// COFFEE_CHROMIUM_EXECUTABLE=/path/to/chromium (otherwise Playwright's browser).
import assert from 'node:assert/strict';
import { mkdtemp, readFile, unlink, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import { build } from 'esbuild';

const { chromium } = await import(process.env.COFFEE_PLAYWRIGHT_MODULE || 'playwright-core');
const project = fileURLToPath(new URL('..', import.meta.url));
const directory = await mkdtemp(join(tmpdir(), 'coffee-scroll-'));
await build({
  stdin: { resolveDir: project, loader: 'tsx', contents: `
    import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
    import {ClaudeConversation} from './src/components/center/ClaudeConversation';
    import './src/styles/global.css';
    function Fixture(){const [active,setActive]=useState(true);window.setActive=setActive;return <div className="host" style={{display:active?'flex':'none'}}><ClaudeConversation sessionId="scroll" cwd={null} isActive={active}/></div>}
    createRoot(document.getElementById('root')).render(<Fixture/>);
  ` },
  bundle: true, outfile: join(directory, 'fixture.js'), jsx: 'automatic',
  external: ['/fonts/*', '/monogram.svg'],
  nodePaths: [join(project, 'node_modules')], loader: { '.webp': 'dataurl' },
  define: { 'process.env.NODE_ENV': '"development"' },
  plugins: [{ name: 'isolated-session', setup(builder) {
    builder.onResolve({ filter: /claude-session$/ }, () => ({ path: 'session', namespace: 'fixture' }));
    builder.onResolve({ filter: /store\/app-state$/ }, () => ({ path: 'store', namespace: 'fixture' }));
    builder.onResolve({ filter: /lib\/shiki$/ }, () => ({ path: 'syntax', namespace: 'fixture' }));
    builder.onResolve({ filter: /lib\/clipboard$/ }, () => ({ path: 'clipboard', namespace: 'fixture' }));
    builder.onResolve({ filter: /\.svg\?raw$/ }, args => ({ path: resolve(args.resolveDir, args.path.replace('?raw', '')), namespace: 'svg' }));
    builder.onLoad({ filter: /.*/, namespace: 'svg' }, async args => ({ contents: `export default ${JSON.stringify(await readFile(args.path, 'utf8'))}`, loader: 'js' }));
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ resolveDir: project, loader: 'js', contents: args.path === 'store' ? `
      export function useAppLanguage(){return 'en'};export function useAppState(){return {dispatch(){}}};
    ` : args.path === 'syntax' ? `
      export async function tokenizeFile(){return null};export async function tokenizeByLang(){return null};export function getShikiTheme(){return 'light'};
    ` : args.path === 'clipboard' ? `
      export async function clipboardWrite(text){window.copiedText=text};
    ` : `
      import {useSyncExternalStore} from 'react';import {emptyClaudeState} from './src/lib/claude-protocol';
      let state={...emptyClaudeState(),ready:true};const listeners=new Set();
      window.setSession=patch=>{state={...state,...patch};listeners.forEach(fn=>fn())};
      window.reset=kind=>{
        clearInterval(window.streamTimer);window.tick=0;
        const messages=Array.from({length:96},(_,i)=>({id:'history-'+i,role:i%2?'assistant':'user',content:'History '+i+'\\n\\n'+'Earlier readable context. '.repeat(35),timestamp:Date.now()-100000+i}));
        messages.push({id:'live',role:kind==='tool'||kind==='write'?'tool':kind,partial:kind!=='tool'&&kind!=='write',toolName:kind==='write'?'Write':'Bash',toolStatus:'running',input:kind==='write'?{file_path:'example.ts',content:'line\\n'.repeat(80)}:{command:'echo test'},output:'output\\n',content:'Live output.\\n\\n',timestamp:Date.now()});
        window.setSession({...emptyClaudeState(),ready:true,busy:true,status:'working',messages,historyCursor:100,startedAt:Date.now()});
      };
      window.startStream=()=>{window.streamTimer=setInterval(()=>{
        window.tick++;const last=state.messages.at(-1);window.setSession({messages:[...state.messages.slice(0,-1),{...last,content:last.content+'Streamed paragraph '+window.tick+'.\\n\\n',output:last.output+'output '+window.tick+'\\n'}],thinkingTokens:window.tick*20});
      },40)};
      window.stopStream=()=>clearInterval(window.streamTimer);
      window.appendReply=()=>window.setSession({messages:[...state.messages,{id:crypto.randomUUID(),role:'assistant',content:'A new reply paragraph.\\n\\n'.repeat(30),timestamp:Date.now()}]});
      window.finish=()=>{window.stopStream();window.setSession({busy:false,status:'idle',endedAt:Date.now(),messages:state.messages.map(m=>m.id==='live'?{...m,partial:false,toolStatus:m.role==='tool'?'done':undefined}:m)})};
      export function useClaudeSession(){return useSyncExternalStore(fn=>{listeners.add(fn);return()=>listeners.delete(fn)},()=>state)};
      export function retainClaudeSession(){return()=>{}};export async function controlClaude(){return {}};export async function respondClaude(){};
      export async function loadClaudeHistory(){const older=Array.from({length:24},(_,i)=>({id:'older-'+i,role:'user',content:'Older '+i+'\\n\\n'+'Older context. '.repeat(35),timestamp:Date.now()-200000+i}));window.setSession({messages:[...older,...state.messages],historyCursor:0})};
    ` }));
  } }],
});
const html = `<!doctype html><link rel="stylesheet" href="/fixture.css"><style>
*{box-sizing:border-box}body{margin:0;background:#15101d}:root{--font:Arial,sans-serif;--mono:monospace;--accent:#937fa3;--bg-terminal:#15101d;--bg-panel:#231c2b;--bg-hover:#302838;--text-1:#ded5e5;--text-2:#bdb0c7;--text-3:#a597af;--border:#463b50;--gambit-dock-h:180px}#root,.host{height:100vh}.host{width:100%}
</style><body class="gambit-docked"><div id="root"></div><script src="/fixture.js"></script>`;
const server = http.createServer(async (req, res) => {
  if (req.url === '/') return res.setHeader('Content-Type', 'text/html').end(html);
  const name = req.url.slice(1);
  if (!['fixture.js', 'fixture.css'].includes(name)) return res.writeHead(404).end();
  res.setHeader('Content-Type', name.endsWith('.js') ? 'text/javascript' : 'text/css');
  res.end(await readFile(join(directory, name)));
});
await new Promise(accept => server.listen(0, '127.0.0.1', accept));
const browser = await chromium.launch({ headless: true, ...(process.env.COFFEE_CHROMIUM_EXECUTABLE ? { executablePath: process.env.COFFEE_CHROMIUM_EXECUTABLE } : {}) });
const page = await browser.newPage({ viewport: { width: 1100, height: 800 }, reducedMotion: 'no-preference' });
const errors = []; page.on('pageerror', error => errors.push(error.message));
const scroll = page.locator('.claude-scroll');
const metrics = () => scroll.evaluate(el => ({ top: el.scrollTop, distance: el.scrollHeight - el.clientHeight - el.scrollTop }));
const atBottom = () => page.waitForFunction(() => { const el = document.querySelector('.claude-scroll'); return el.scrollHeight - el.clientHeight - el.scrollTop < 2; });
const wheelUp = async (pixels = 30) => {
  const box = await scroll.boundingBox(); await page.mouse.move(box.x + box.width - 70, box.y + box.height - 5);
  await page.mouse.wheel(0, -pixels); await page.waitForTimeout(150);
};
const returnBottom = async () => {
  const button = page.locator('.claude-scroll-bottom');
  if (await button.count()) await button.click();
  await atBottom();
};
try {
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  for (const role of ['reasoning', 'tool', 'assistant']) {
    await page.evaluate(role => window.reset(role), role); await page.waitForTimeout(450); await returnBottom();
    if (role === 'reasoning') await page.locator('.claude-reasoning summary').click();
    await page.evaluate(() => window.startStream()); await page.waitForTimeout(200); await atBottom();
    await wheelUp(); assert.ok((await metrics()).distance > 10, `${role}: small wheel escapes follow`);
    await wheelUp(450); const reading = await metrics(); await page.waitForTimeout(400);
    assert.ok(Math.abs((await metrics()).top - reading.top) < 2, `${role}: streaming preserves reading position`);
    await returnBottom(); await page.waitForTimeout(500); await atBottom();
    await wheelUp(300); const beforeFinish = await metrics(); await page.evaluate(() => window.finish()); await page.waitForTimeout(200);
    assert.ok(Math.abs((await metrics()).top - beforeFinish.top) < 2, `${role}: completion never pulls back`);
    console.log('ok', role, 'stream, upward reading, return follow and completion');
  }
  await returnBottom();
  await page.evaluate(() => window.setSession({usage:{input_tokens:69000,output_tokens:2100},totalCost:1.4818}));
  const summary = page.locator('.claude-turn-summary'); await summary.waitFor();
  assert.equal(await summary.locator('..').getAttribute('data-message-id'), 'live', 'usage belongs inside the final timeline message');
  const summaryBox = await summary.boundingBox(), copyBox = await summary.locator('..').locator('.conversation-copy').boundingBox();
  assert.ok(summaryBox.y - copyBox.y - copyBox.height >= 0 && summaryBox.y - copyBox.y - copyBox.height <= 12, 'usage follows the copy action without a large gap');
  assert.ok((await summary.textContent()).includes('71.1k') && (await summary.textContent()).includes('1.4818'), 'usage values remain intact');
  console.log('ok usage is inside the timeline, close to copy, with original values');
  await page.setViewportSize({ width: 1100, height: 600 }); await page.waitForTimeout(150); await atBottom();
  await page.setViewportSize({ width: 1100, height: 850 }); await page.waitForTimeout(150); await atBottom();
  await page.evaluate(() => window.setActive(false)); await page.waitForTimeout(100); await page.evaluate(() => window.setActive(true)); await page.waitForTimeout(200); await atBottom();
  await wheelUp(600); const beforeResize = await metrics();
  await page.setViewportSize({ width: 1100, height: 650 }); await page.waitForTimeout(200);
  assert.ok(Math.abs((await metrics()).top - beforeResize.top) < 2, 'resizing while reading never resumes follow');
  await page.evaluate(() => window.setActive(false)); await page.waitForTimeout(100); await page.evaluate(() => window.setActive(true)); await page.waitForTimeout(250);
  assert.ok(Math.abs((await metrics()).top - beforeResize.top) < 2, 'tab hide/reveal preserves reading position');
  console.log('ok viewport resizing and tab hide/reveal');

  await page.evaluate(() => window.reset('write')); await page.waitForTimeout(450); await returnBottom();
  await page.locator('.claude-tool-body .claude-tool-resize').click(); await page.waitForTimeout(200); await atBottom();
  await wheelUp(180); await page.locator('.claude-tool-body .claude-tool-resize').evaluate(el => el.click()); await page.waitForTimeout(200);
  const collapsed = await metrics(); await page.evaluate(() => window.appendReply()); await page.waitForTimeout(350);
  assert.ok(Math.abs((await metrics()).top - collapsed.top) < 2, 'tool collapse cannot silently resume follow');
  console.log('ok tool expansion follows only while pinned; collapse cannot re-enable follow');

  const beforeApproval = await metrics();
  await page.evaluate(() => window.setSession({requests:[{id:'approval',request:{subtype:'can_use_tool',tool_name:'Edit',input:{file_path:'example.ts'}}}]})); await page.waitForTimeout(150);
  await page.evaluate(() => window.setSession({requests:[]})); await page.waitForTimeout(150);
  assert.ok(Math.abs((await metrics()).top - beforeApproval.top) < 2, 'permission card appearance and dismissal preserve reading position');
  console.log('ok permission cards preserve reading position');

  await page.evaluate(() => window.reset('assistant')); await page.waitForTimeout(400); await returnBottom();
  await scroll.evaluate(el => { el.tabIndex = 0; el.focus(); }); await page.keyboard.press('PageUp'); await page.waitForTimeout(250);
  assert.ok((await metrics()).distance > 10, 'keyboard can move upward');
  const keyboardPosition = await metrics(); await page.evaluate(() => window.startStream()); await page.waitForTimeout(300); await page.evaluate(() => window.stopStream());
  assert.ok(Math.abs((await metrics()).top - keyboardPosition.top) < 2, 'keyboard reading stays paused');
  await scroll.evaluate(el => { el.scrollTop = el.scrollHeight; el.dispatchEvent(new Event('scroll')); }); await page.evaluate(() => window.startStream()); await page.waitForTimeout(200); await atBottom(); await page.evaluate(() => window.stopStream());
  console.log('ok keyboard reading and manual bottom resume');
  await scroll.evaluate(el => { el.scrollTop -= 30; window.appendReply(); }); await page.waitForTimeout(200);
  assert.ok((await metrics()).distance > 10, 'a scrollbar movement is respected even before its scroll event is delivered');
  await returnBottom(); await scroll.dispatchEvent('touchmove');
  await scroll.evaluate(el => { el.scrollTop -= 30; window.appendReply(); }); await page.waitForTimeout(200);
  assert.ok((await metrics()).distance > 10, 'touch movement pauses follow before content updates');
  console.log('ok scrollbar event race and touch intent');

  await page.evaluate(() => window.reset('assistant')); await page.waitForTimeout(400);
  await scroll.evaluate(el => { el.scrollTop = 0; el.dispatchEvent(new Event('scroll')); }); await page.waitForTimeout(350);
  const anchor = page.locator('[data-message-id="history-0"]');
  const before = await anchor.boundingBox(); await page.getByRole('button', { name: 'Load earlier messages', exact: true }).click(); await page.waitForTimeout(400);
  const after = await anchor.boundingBox(); assert.ok(Math.abs(after.y - before.y) < 2, `loading earlier history preserves its visible anchor: ${JSON.stringify({ before, after, scroll: await metrics() })}`);
  assert.equal(await page.locator('.conversation-navigation-item').count(), 72, 'navigation includes newly loaded history turns');
  console.log('ok history prepend anchor');
  await page.setViewportSize({ width: 1100, height: 800 });
  await page.evaluate(() => window.reset('assistant')); await page.waitForTimeout(400); await returnBottom();
  const navigation = page.locator('.conversation-navigation');
  assert.equal(await navigation.locator('button').count(), 48, 'each loaded user turn has one navigation tick');
  const turn = navigation.locator('[data-conversation-navigation-target="history-10"]');
  await turn.hover();
  assert.ok((await navigation.getByRole('tooltip').textContent()).startsWith('History 10'), 'hover previews the user prompt');
  const railBox = await navigation.boundingBox(), tooltipBox = await navigation.getByRole('tooltip').boundingBox();
  assert.ok(tooltipBox.x > railBox.x + railBox.width, 'left-side preview opens to the right');
  await turn.click(); await page.mouse.move(5, 5); await page.waitForTimeout(450);
  const target = await page.locator('[data-message-id="history-10"]').boundingBox();
  const viewport = await scroll.boundingBox();
  assert.ok(target && target.y >= viewport.y && target.y < viewport.y + 120, `navigation lands on its turn: ${JSON.stringify({ target, viewport })}`);
  const jumped = await metrics(); await page.evaluate(() => window.startStream()); await page.waitForTimeout(350);
  assert.ok(Math.abs((await metrics()).top - jumped.top) < 2, 'navigation pauses streaming follow');
  await wheelUp(90); const afterJumpWheel = await metrics(); await page.waitForTimeout(200);
  assert.ok(afterJumpWheel.top < jumped.top - 30 && Math.abs((await metrics()).top - afterJumpWheel.top) < 2, 'manual scrolling releases the navigation anchor');
  await returnBottom(); await page.waitForTimeout(200); await atBottom(); await page.evaluate(() => window.stopStream());
  await turn.click(); await page.waitForTimeout(300);
  assert.ok(Math.abs((await page.locator('[data-message-id="history-10"]').boundingBox()).y - 24) < 2, 'repeat jumps use measured rows accurately');
  await returnBottom();
  const slider = page.locator('.cc-scrollbar-wide .cc-scrollbar-slider');
  await scroll.hover(); await page.waitForTimeout(100);
  const sliderBox = await slider.boundingBox();
  assert.equal(sliderBox.width, 8, 'conversation scrollbar thumb is wider');
  assert.equal((await slider.locator('..').boundingBox()).width, 12, 'scrollbar hit area matches its wider layout');
  await page.mouse.move(sliderBox.x + 4, sliderBox.y + sliderBox.height / 2);
  await page.mouse.down(); await page.mouse.move(sliderBox.x + 4, sliderBox.y + sliderBox.height / 2 - 20, { steps: 5 }); await page.mouse.up();
  const dragged = await metrics(); assert.ok(dragged.distance > 10, 'wider thumb supports dragging upward');
  await page.evaluate(() => window.startStream()); await page.waitForTimeout(250); await page.evaluate(() => window.stopStream());
  assert.ok(Math.abs((await metrics()).top - dragged.top) < 2, 'dragging the wider thumb pauses follow');
  console.log('ok wider conversation scrollbar geometry and drag');
  for (const width of [1100, 850, 761]) {
    await page.setViewportSize({ width, height: 800 }); await page.waitForTimeout(150);
    const rail = await navigation.boundingBox(), thread = await page.locator('.claude-thread').boundingBox();
    assert.ok(rail && rail.x + rail.width + 12 <= thread.x, `left navigation stays outside the text at ${width}px`);
    assert.ok(rail.y + rail.height <= (await scroll.boundingBox()).height + 1, 'navigation clears the docked composer');
  }
  for (const width of [760, 390]) {
    await page.setViewportSize({ width, height: 800 }); await page.waitForTimeout(150);
    assert.equal(await navigation.isVisible(), false, `navigation hides at ${width}px instead of crowding the conversation`);
  }
  await page.evaluate(() => window.setSession({messages:[],busy:false}));
  assert.equal(await navigation.count(), 0, 'empty conversations have no navigation');
  console.log('ok left-side navigation preview, jump, paused follow, responsive spacing and empty state');

  await page.setViewportSize({ width: 1100, height: 800 });
  await page.evaluate(() => {
    window.reasoningMessage = { id: 'thinking-toggle', role: 'reasoning', content: 'Reasoning remains readable while tokens arrive.\n\n'.repeat(20), partial: true, timestamp: Date.now() };
    window.setSession({ messages: [window.reasoningMessage], busy: true, status: 'thinking', requests: [], historyCursor: 0, endedAt: undefined });
  });
  const thinking = page.locator('.claude-reasoning');
  await thinking.locator('summary').click();
  await page.evaluate(() => window.setSession({ thinkingTokens: 500, messages: [{ ...window.reasoningMessage, content: window.reasoningMessage.content + 'A new streamed thought.' }] }));
  await page.waitForTimeout(250);
  assert.equal(await thinking.evaluate(el => el.open), true, 'manual reasoning expansion survives streamed content and token rerenders');
  await thinking.locator('summary').click(); await page.waitForTimeout(100);
  await page.evaluate(() => window.setSession({ thinkingTokens: 600 }));
  assert.equal(await thinking.evaluate(el => el.open), false, 'manual collapse also survives updates');
  await page.keyboard.press('Control+o'); await page.waitForTimeout(100);
  assert.equal(await thinking.evaluate(el => el.open), true, 'Ctrl+O still expands reasoning');
  await page.keyboard.press('Control+o'); await page.waitForTimeout(100);
  assert.equal(await thinking.evaluate(el => el.open), false, 'Ctrl+O still collapses reasoning');
  await thinking.locator('summary').click(); await page.waitForTimeout(100);
  await page.evaluate(() => window.setSession({ messages: [window.reasoningMessage, ...Array.from({ length: 60 }, (_, i) => ({ id: 'toggle-tail-' + i, role: 'user', content: 'Another turn. '.repeat(50), timestamp: Date.now() }))] }));
  await scroll.evaluate(el => { el.scrollTop = el.scrollHeight; el.dispatchEvent(new Event('scroll')); }); await page.waitForTimeout(350);
  assert.equal(await thinking.count(), 0, 'offscreen reasoning is virtualized');
  await scroll.evaluate(el => { el.scrollTop = 0; el.dispatchEvent(new Event('scroll')); }); await page.waitForTimeout(350);
  assert.equal(await thinking.evaluate(el => el.open), true, 'expansion survives virtual row remounting');
  await page.evaluate(() => window.setSession({ messages: [{ ...window.reasoningMessage, content: '' }] }));
  assert.equal(await thinking.locator('summary').count(), 0, 'empty or withheld reasoning has no misleading expand arrow');
  await page.evaluate(() => window.setSession({ messages: [window.reasoningMessage] }));
  assert.equal(await thinking.evaluate(el => el.open), true, 'new reasoning content retains the saved expansion choice');
  console.log('ok reasoning toggle stays under user control during streaming');

  await page.evaluate(() => {
    window.toolMessage = { id: 'tool-controls', role: 'tool', toolName: 'Bash', toolStatus: 'done', input: { command: 'echo full-output' }, output: Array.from({ length: 80 }, (_, i) => 'Original output line ' + i).join('\n'), content: '', timestamp: Date.now() };
    window.setSession({ messages: [window.toolMessage], busy: false, requests: [], historyCursor: 0 });
  });
  await page.waitForTimeout(200);
  const inputRow = page.locator('.claude-io-row').first(), outputRow = page.locator('.claude-io-row').last();
  await inputRow.getByRole('button', { name: 'Copy message', exact: true }).click();
  assert.equal(await page.evaluate(() => window.copiedText), 'echo full-output');
  await outputRow.getByRole('button', { name: 'Copy message', exact: true }).click();
  assert.equal(await page.evaluate(() => window.copiedText), await page.evaluate(() => window.toolMessage.output), 'copy includes the whole output, beyond the clipped preview');
  const outputScroll = outputRow.locator('.claude-tool-content-scroll');
  const preview = await outputScroll.boundingBox();
  assert.ok(preview.height <= 180);
  await outputRow.getByRole('button', { name: 'Click to expand', exact: true }).click(); await page.waitForTimeout(100);
  assert.ok((await outputScroll.boundingBox()).height > preview.height + 100);
  await page.evaluate(() => window.setSession({ messages: [{ ...window.toolMessage, output: window.toolMessage.output + '\nLast streamed line' }] }));
  assert.equal(await outputRow.locator('.claude-tool-resize').getAttribute('aria-expanded'), 'true', 'stream updates preserve expanded output');
  await outputRow.getByRole('button', { name: 'Collapse', exact: true }).click();
  assert.equal(await outputRow.locator('.claude-tool-resize').getAttribute('aria-expanded'), 'false');
  await page.evaluate(() => window.setSession({ messages: [{ ...window.toolMessage, toolName: 'Write', toolStatus: 'running', input: {}, output: undefined }] }));
  assert.equal(await page.locator('.claude-tool-pending').count(), 1, 'a streaming Write with incomplete arguments displays a pending state');
  assert.equal(await page.locator('.claude-tool-subtitle').count(), 0, 'incomplete Write arguments do not claim a one-line file');
  await page.evaluate(() => window.setSession({ messages: [{ ...window.toolMessage, toolName: 'Write', input: { file_path: 'example.ts', content: 'new file line\n'.repeat(40) } }] }));
  await page.locator('.claude-tool-body').getByRole('button', { name: 'Copy message', exact: true }).click();
  assert.equal(await page.evaluate(() => window.copiedText), 'new file line\n'.repeat(40));
  await page.locator('.claude-tool-resize').click();
  assert.equal(await page.locator('.claude-tool-resize').getAttribute('aria-expanded'), 'true');
  await page.evaluate(() => window.setSession({ messages: [{ ...window.toolMessage, toolName: 'Edit', input: { file_path: 'example.ts', old_string: 'before\n'.repeat(20), new_string: 'after\n'.repeat(20) } }] }));
  await page.locator('.claude-diff').getByRole('button', { name: 'Copy message', exact: true }).click();
  assert.equal(await page.evaluate(() => window.copiedText), 'after\n'.repeat(20));
  await page.locator('.claude-tool-resize').click();
  assert.equal(await page.locator('.claude-diff.is-expanded').count(), 1);
  await page.setViewportSize({ width: 390, height: 800 }); await page.waitForTimeout(150);
  assert.ok(await scroll.evaluate(el => el.scrollWidth <= el.clientWidth + 1));
  console.log('ok tool input/output copy, expansion, streaming updates, Write pending state and diff controls');
  assert.deepEqual(errors, []);
} finally {
  await page.evaluate(() => window.stopStream?.()).catch(() => {});
  await browser.close(); await new Promise(accept => server.close(accept));
  for (const file of ['fixture.js', 'fixture.css']) await unlink(join(directory, file));
  await rmdir(directory);
}
