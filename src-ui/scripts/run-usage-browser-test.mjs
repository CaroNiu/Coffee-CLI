// Actual dashboard with a deterministic native boundary; no account or network calls.
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import { build } from 'esbuild';
const { chromium } = await import(process.env.COFFEE_PLAYWRIGHT_MODULE || 'playwright-core');
const project = fileURLToPath(new URL('..', import.meta.url));
const directory = await mkdtemp(join(tmpdir(), 'coffee-usage-ui-'));
await build({ stdin: { resolveDir: project, loader: 'tsx', contents: `
import React from 'react';import{createRoot}from'react-dom/client';import{UsageDashboard}from'./src/components/center/UsageDashboard';import './src/styles/global.css';
function App(){return <div className="panel-center"><UsageDashboard/></div>};createRoot(document.getElementById('root')).render(<App/>);
` }, bundle: true, outfile: join(directory, 'fixture.js'), jsx: 'automatic', nodePaths: [join(project, 'node_modules')], external: ['/fonts/*', '/monogram.svg'], plugins: [{ name: 'usage-fixture', setup(b) {
  b.onResolve({ filter: /store\/app-state$/ }, () => ({ path: 'store', namespace: 'fixture' }));
  b.onResolve({ filter: /(^|\/)tauri$/ }, () => ({ path: 'native', namespace: 'fixture' }));
  b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: args.path === 'store' ? `export function useAppLanguage(){return 'zh-CN'}` : `
window.queries=[];window.waiting=[];
const summary={sessions:12,prompts:36,calls:90,days:5,input:100000,output:20000,cacheRead:60000,cacheWrite:5000,reasoning:10000,tokens:185000};
window.report={summary,daily:Array.from({length:7},(_,i)=>{const date=new Date();date.setDate(date.getDate()-6+i);const key=[date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');return {key,summary:{...summary,tokens:[3000,8000,4500,28000,6000,19000,12000][i],sessions:i%3}}}),models:[{key:'model-alpha',summary},{key:'model-beta',summary:{...summary,tokens:60000}}],projects:['D:/Alpha','D:/Beta'],sources:[{tool:'claude',files:12,available:true,errors:0},{tool:'codex',files:8,available:true,errors:0}]};
export async function invoke(command,args){window.queries.push(args.query);if(window.fail)throw Error('fixture');if(window.defer){window.defer=false;return new Promise(resolve=>window.waiting.push(()=>resolve(structuredClone(window.report))))}return structuredClone(window.report)}
`, loader: 'js' }));
} }] });
const server = http.createServer(async (req, res) => {
  if (req.url === '/') return res.setHeader('Content-Type', 'text/html; charset=utf-8').end(`<!doctype html><html data-mode="dark" data-shape="soft"><link rel="stylesheet" href="/fixture.css"><style>html,body,#root{margin:0;width:100%;height:100%}.panel-center{position:relative;height:100%;padding:0!important}:root{--font-nav:'Segoe UI',sans-serif;--accent:#c595a5;--bg-terminal:#211e20;--bg-panel:#292528;--bg-hover:#393236;--text-1:#e5dce1;--text-2:#bcb2b8;--text-3:#9f939a;--border:#443a40;--success:#6fa087;--info:#7d97b8;--warning:#baa274;--shape-radius-panel:14px;--shape-radius-btn:7px}html[data-mode=light]{--bg-terminal:#f7f4f0;--bg-panel:#eeebe5;--bg-hover:#e3ded7;--text-1:#34302c;--text-2:#625a53;--text-3:#786f65;--border:#d5cec6;--accent:#9a6979}</style><div id="root"></div><script src="/fixture.js"></script></html>`);
  try { const name = req.url.slice(1); if (!['fixture.js', 'fixture.css'].includes(name)) throw Error(); res.setHeader('Content-Type', name.endsWith('.js') ? 'text/javascript' : 'text/css'); res.end(await readFile(join(directory, name))); } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ headless: true, ...(process.env.COFFEE_CHROMIUM_EXECUTABLE ? { executablePath: process.env.COFFEE_CHROMIUM_EXECUTABLE } : {}) });
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 1000 } }); const errors = []; page.on('pageerror', e => errors.push(e.message));
  const choose = async (label, option) => {
    await page.getByRole('combobox', { name: label, exact: true }).click();
    await page.getByRole('option', { name: option, exact: true }).click();
  };
  const finishSync = async () => {
    await page.locator('.usage-body[aria-busy="true"]').waitFor();
    await page.evaluate(() => window.waiting.shift()());
    await page.locator('.usage-body[aria-busy="false"]').waitFor();
  };
  await page.addInitScript(() => {
    window.defer = true;
    const interval = window.setInterval;
    window.setInterval = (callback, delay, ...args) => {
      if (delay === 15000) window.refreshUsage = callback;
      return interval(callback, delay, ...args);
    };
  });
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.locator('.usage-cards').waitFor();
  await page.waitForFunction(() => window.waiting.length === 1);
  assert.equal(await page.getByText('正在同步本地记录…', { exact: true }).count(), 0);
  assert.equal(await page.locator('.usage-cards > article').count(), 5, 'first launch shows the full layout while syncing');
  assert.equal(await page.locator('.usage-card-hero > strong').first().innerText(), '—', 'no invented totals before the first report');
  await finishSync();
  const cachedTokens = await page.locator('.usage-card-hero > strong').first().innerText();
  await page.reload();
  await page.waitForFunction(() => window.waiting.length === 1);
  assert.equal(await page.locator('.usage-card-hero > strong').first().innerText(), cachedTokens, 'persistent snapshot is visible before native sync completes after reload');
  assert.equal(await page.getByText('正在同步本地记录…', { exact: true }).count(), 0);
  await page.evaluate(() => { window.report.summary.tokens = 250000; window.waiting.shift()(); });
  await page.locator('.usage-body[aria-busy="false"]').waitFor();
  assert.notEqual(await page.locator('.usage-card-hero > strong').first().innerText(), cachedTokens, 'background sync replaces cached totals');
  assert.equal(await page.locator('.usage-cards > article').count(), 5);
  assert.equal(await page.locator('.usage-models tbody tr').count(), 2);
  assert.equal(await page.locator('.usage-header, .usage-icon-button, .usage-price-dialog').count(), 0);
  assert.equal(await page.locator('.usage-models thead th').count(), 5);
  assert.deepEqual(await page.locator('.usage-footer p').allTextContents(), ['数据来源：Claude Code 12 个日志文件 · Codex CLI 8 个日志文件']);
  assert.equal(await page.locator('.usage-toolbar select').count(), 0, 'both filters use themed menus');
  const toolPicker = page.getByRole('combobox', { name: '工具', exact: true });
  await toolPicker.press('ArrowDown');
  await page.getByRole('listbox', { name: '工具', exact: true }).waitFor();
  await toolPicker.press('End'); await toolPicker.press('Enter');
  await page.waitForFunction(() => window.queries.at(-1).tool === 'codex');
  await toolPicker.press('Home'); await toolPicker.press('Enter');
  await page.waitForFunction(() => window.queries.at(-1).tool === '');
  await page.setViewportSize({ width: 1100, height: 650 });
  const toolbarTop = await page.locator('.usage-toolbar').evaluate(el => el.getBoundingClientRect().top);
  await page.locator('.usage-cards').hover(); await page.mouse.wheel(0, 300);
  await page.waitForFunction(() => document.querySelector('.usage-dashboard').scrollTop > 100);
  const scrollGeometry = await page.evaluate(() => {
    const root = document.querySelector('.usage-dashboard'), body = document.querySelector('.usage-body');
    return { top: root.scrollTop, toolbarTop: document.querySelector('.usage-toolbar').getBoundingClientRect().top, innerOverflow: getComputedStyle(body).overflowY };
  });
  assert.ok(Math.abs(scrollGeometry.toolbarTop - (toolbarTop - scrollGeometry.top)) < 1, 'filters move with the entire page');
  assert.equal(scrollGeometry.innerOverflow, 'visible', 'the body does not create a nested vertical scrollbar');
  await page.locator('.usage-dashboard').evaluate(el => { el.scrollTop = 0; });
  await page.setViewportSize({ width: 1100, height: 1000 });
  await page.getByRole('button', { name: '今日', exact: true }).click(); await page.waitForFunction(() => window.queries.at(-1).to - window.queries.at(-1).from < 86401);
  await page.evaluate(() => { window.defer = true; });
  await choose('工具', 'Codex CLI'); await page.waitForFunction(() => window.waiting.length === 1 && window.queries.at(-1).tool === 'codex');
  assert.equal(await page.locator('.usage-card-hero > strong').first().innerText(), '—', 'uncached filters never display another filter\'s totals');
  await finishSync();
  const codexTokens = await page.locator('.usage-card-hero > strong').first().innerText();
  await choose('工具', 'Claude Code');
  await page.locator('.usage-body[aria-busy="false"]').waitFor();
  await page.evaluate(() => { window.defer = true; });
  await choose('工具', 'Codex CLI');
  await page.waitForFunction(() => window.waiting.length === 1);
  assert.equal(await page.locator('.usage-card-hero > strong').first().innerText(), codexTokens, 'returning to a filter restores its own snapshot');
  await finishSync();
  await choose('项目', 'D:/Beta'); await page.waitForFunction(() => window.queries.at(-1).project === 'D:/Beta');
  await page.locator('.usage-body[aria-busy="false"]').waitFor();
  await page.evaluate(() => { window.defer = true; });
  await page.getByRole('button', { name: '近 7 天', exact: true }).click();
  await page.waitForFunction(() => window.waiting.length === 1);
  assert.equal(await page.getByRole('combobox', { name: '项目', exact: true }).innerText(), 'D:/Beta', 'project selection stays visible during an uncached refresh');
  await page.getByRole('button', { name: '近 30 天', exact: true }).click();
  await page.locator('.usage-body[aria-busy="false"]').waitFor();
  const latestTokens = await page.locator('.usage-card-hero > strong').first().innerText();
  await page.evaluate(() => { window.report.summary.tokens = 9999999; window.waiting.shift()(); });
  assert.equal(await page.locator('.usage-card-hero > strong').first().innerText(), latestTokens, 'a late response cannot overwrite the active filter');
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('cc-usage-snapshots-v1')).some(([key]) => key === JSON.stringify([7, 'codex', 'D:/Beta']))), false, 'obsolete responses never populate persistent snapshots');
  await page.evaluate(() => { window.report.summary.tokens = 250000; });
  await page.getByRole('button', { name: '近 7 天', exact: true }).click(); await page.waitForTimeout(100);
  for (const [mode, shape, width] of [['dark', 'soft', 1100], ['light', 'soft', 1100], ['dark', 'glass', 760], ['light', 'panel', 360]]) {
    await page.evaluate(({ mode, shape }) => { document.documentElement.dataset.mode = mode; document.documentElement.dataset.shape = shape; }, { mode, shape }); await page.setViewportSize({ width, height: 1000 });
    assert.equal(await page.locator('.usage-dashboard').evaluate(el => el.scrollWidth <= el.clientWidth + 1), true, 'dashboard fits ' + width);
    if (width > 600) {
      const charts = await page.locator('.usage-charts > article').evaluateAll(nodes => nodes.map(node => { const box = node.getBoundingClientRect(); return { x: box.x, y: box.y }; }));
      assert.ok(Math.abs(charts[0].y - charts[1].y) < 1 && charts[1].x > charts[0].x, 'the two charts stay side by side');
    }
    const colors = await page.locator('.usage-donut-ring').evaluate(el => ({ ring: getComputedStyle(el).backgroundImage, mask: getComputedStyle(el).maskImage }));
    assert.notEqual(colors.ring, 'none'); assert.notEqual(colors.mask, 'none', 'donut has a true transparent center in every shape');
    await toolPicker.click();
    const menu = page.getByRole('listbox', { name: '工具', exact: true });
    const box = await menu.boundingBox();
    assert.ok(box.x >= 0 && box.x + box.width <= width && box.y >= 0 && box.y + box.height <= 1000, 'themed menu stays within the viewport');
    assert.equal(await menu.locator('.settings-font-opt.active').innerText(), 'Codex CLI');
    assert.notEqual(await menu.evaluate(el => getComputedStyle(el).backgroundImage), 'none', 'menu uses the settings font picker surface');
    await page.screenshot({ path: join(directory, `usage-${mode}-${shape}-${width}.png`) });
    await toolPicker.press('Escape');
    await menu.waitFor({ state: 'hidden' });
  }
  await page.evaluate(() => { window.report.projects = Array.from({ length: 40 }, (_, i) => 'D:/LongProject-' + i); });
  await page.getByRole('button', { name: '同步', exact: true }).click();
  await page.locator('.usage-body[aria-busy="false"]').waitFor();
  const projectPicker = page.getByRole('combobox', { name: '项目', exact: true });
  await projectPicker.press('End');
  await page.waitForFunction(() => document.querySelector('.usage-filter-menu')?.scrollTop > 0);
  await projectPicker.press('Enter');
  await page.waitForFunction(() => window.queries.at(-1).project === 'D:/LongProject-39');
  await projectPicker.press('End');
  await page.evaluate(() => { window.report.projects = ['D:/Only']; window.refreshUsage(); });
  await page.waitForFunction(() => document.querySelectorAll('.usage-filter-menu [role="option"]').length === 2);
  await projectPicker.press('Enter');
  await page.waitForFunction(() => window.queries.at(-1).project === 'D:/Only');
  await page.evaluate(() => { window.fail = true; }); await page.getByRole('button', { name: '同步', exact: true }).click(); await page.getByRole('alert').waitFor();
  assert.equal(await page.locator('.usage-cards > article').count(), 5, 'temporary sync failure keeps the last readable report');
  await page.evaluate(() => { window.fail = false; window.report.summary = { sessions: 0, prompts: 0, calls: 0, days: 0, input: null, output: null, cacheRead: null, cacheWrite: null, reasoning: null, tokens: null }; window.report.models = []; window.report.daily = []; });
  await page.getByRole('button', { name: '同步', exact: true }).click(); await page.getByRole('status').waitFor();
  assert.ok((await page.locator('.usage-cards').innerText()).includes('—'), 'missing token fields are never invented zeros');
  const recoveryPage = await browser.newPage();
  recoveryPage.on('pageerror', e => errors.push(e.message));
  await recoveryPage.addInitScript(() => { localStorage.setItem('cc-usage-snapshots-v1', '{broken'); Storage.prototype.setItem = () => { throw new Error('storage unavailable'); }; });
  await recoveryPage.goto(`http://127.0.0.1:${server.address().port}`);
  await recoveryPage.locator('.usage-body[aria-busy="false"]').waitFor();
  assert.equal(await recoveryPage.locator('.usage-models tbody tr').count(), 2, 'invalid cache and unavailable storage cannot block a live report');
  await recoveryPage.close();
  assert.deepEqual(errors, []); console.log('OK: persistent snapshots, silent background refresh, filter isolation, storage recovery, usage filters, concise sources, error recovery, missing values, whole-page scroll, themed charts and 360/760/1100px geometry'); console.log('Screenshots: ' + directory);
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
