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
    function Fixture(){const [active,setActive]=useState(true);window.setActive=setActive;return <div className="host" style={{display:active?'flex':'none'}}><ClaudeConversation sessionId="scroll" cwd={null} isActive={active}/></div>}
    createRoot(document.getElementById('root')).render(<Fixture/>);
  ` },
  bundle: true, outfile: join(directory, 'fixture.js'), jsx: 'automatic',
  nodePaths: [join(project, 'node_modules')], loader: { '.webp': 'dataurl' },
  define: { 'process.env.NODE_ENV': '"development"' },
  plugins: [{ name: 'isolated-session', setup(builder) {
    builder.onResolve({ filter: /claude-session$/ }, () => ({ path: 'session', namespace: 'fixture' }));
    builder.onResolve({ filter: /store\/app-state$/ }, () => ({ path: 'store', namespace: 'fixture' }));
    builder.onResolve({ filter: /lib\/shiki$/ }, () => ({ path: 'syntax', namespace: 'fixture' }));
    builder.onResolve({ filter: /\.svg\?raw$/ }, args => ({ path: resolve(args.resolveDir, args.path.replace('?raw', '')), namespace: 'svg' }));
    builder.onLoad({ filter: /.*/, namespace: 'svg' }, async args => ({ contents: `export default ${JSON.stringify(await readFile(args.path, 'utf8'))}`, loader: 'js' }));
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ resolveDir: project, loader: 'js', contents: args.path === 'store' ? `
      export function useAppLanguage(){return 'en'};export function useAppState(){return {dispatch(){}}};
    ` : args.path === 'syntax' ? `
      export async function tokenizeFile(){return null};export async function tokenizeByLang(){return null};export function getShikiTheme(){return 'light'};
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
  const box = await scroll.boundingBox(); await page.mouse.move(box.x + box.width - 25, box.y + box.height - 5);
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
  await page.locator('.claude-tool-body > .claude-expand').click(); await page.waitForTimeout(200); await atBottom();
  await wheelUp(180); await page.locator('.claude-tool-body > .claude-expand').evaluate(el => el.click()); await page.waitForTimeout(200);
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
  console.log('ok history prepend anchor');
  assert.deepEqual(errors, []);
} finally {
  await page.evaluate(() => window.stopStream?.()).catch(() => {});
  await browser.close(); await new Promise(accept => server.close(accept));
  for (const file of ['fixture.js', 'fixture.css']) await unlink(join(directory, file));
  await rmdir(directory);
}
