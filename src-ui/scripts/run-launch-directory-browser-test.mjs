// Run against `npm run dev`. Real app/store/menu; native session views and picker are isolated.
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.COFFEE_PLAYWRIGHT_MODULE||'playwright-core');
const browser=await chromium.launch({headless:true,...(process.env.COFFEE_CHROMIUM_EXECUTABLE?{executablePath:process.env.COFFEE_CHROMIUM_EXECUTABLE}:{})});
async function prepare(recent){const page=await browser.newPage({viewport:{width:1400,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route(/\/src\/components\/center\/(TierTerminal|ClaudeConversation|CodexConversation)\.tsx/,route=>{const name=route.request().url().match(/\/([A-Za-z]+)\.tsx/)[1];return route.fulfill({contentType:'text/javascript',body:`export function ${name}(){return null} export const TERM_COLOR_SCHEMES=[];`})});await page.route(/@tauri-apps_plugin-dialog/,route=>route.fulfill({contentType:'text/javascript',body:'export async function open(){window.pickCount=(window.pickCount??0)+1;return window.pickedFolder??null}'}));await page.addInitScript(recent=>{if(localStorage.getItem('fixture:seeded'))return;for(const[k,v]of Object.entries({'fixture:seeded':'1','cc-lang':'en','cc-theme':'sakura','cc-mode':'dark','cc-shape':'soft','cc-tasks-seeded':'1','cc-folder':'D:/Inherited','coffee_pinned_items':JSON.stringify(['agent:claude','agent:codex','agent:opencode','agent:terminal','agent:four-split']),'coffee:last-cwd-by-tool':JSON.stringify({claude:'D:/Legacy',codex:'D:/Legacy',opencode:'D:/Legacy',terminal:'D:/Legacy'}),'coffee:recent-folders':JSON.stringify(recent),'coffee:claude-launch-mode':'conversation','coffee:codex-launch-mode':'terminal'}))localStorage.setItem(k,v)},recent);await page.goto('http://localhost:5173');await page.locator('.launchpad-mode-tabs').first().waitFor();return {page,errors};}
const state=page=>page.evaluate(()=>{const root=document.getElementById('root'),fiber=root[Object.keys(root).find(k=>k.startsWith('__reactContainer$'))];let context;function walk(f){if(!f||context)return;const v=f.memoizedProps?.value;if(v?.state?.terminals&&typeof v.dispatch==='function'){context=v;return}walk(f.child);walk(f.sibling)}walk(fiber.stateNode.current);return context.state.terminals.find(t=>t.id===context.state.activeTerminalId)});
const fresh=page=>page.evaluate(()=>{const root=document.getElementById('root'),fiber=root[Object.keys(root).find(k=>k.startsWith('__reactContainer$'))];function walk(f){if(!f)return;const v=f.memoizedProps?.value;if(v?.state?.terminals&&typeof v.dispatch==='function'){v.dispatch({type:'ADD_TERMINAL',session:{id:crypto.randomUUID(),tool:null,folderPath:'D:/Inherited'}});return true}return walk(f.child)||walk(f.sibling)}walk(fiber.stateNode.current)});
try{
 const {page,errors}=await prepare(['D:/Recent','D:/Older']);
 assert.equal(await page.locator('.launchpad-cwd').count(),0,'cards do not show a remembered path');
 assert.equal(await page.locator('.launchpad-card-info').filter({hasText:/D:\//}).count(),0);
 for(const card of await page.locator('.launchpad-card:has(.launchpad-directory)').all()){
   await card.locator('.launchpad-card-info').click();await page.locator('.folder-menu').waitFor();
   assert.equal((await state(page)).tool,null,'card always asks for a directory even when a legacy last directory exists');
   const cardMenu=await page.locator('.folder-menu').boundingBox();
   const cardBounds=await card.boundingBox();
   assert.ok(Math.abs(cardMenu.y-(cardBounds.y+cardBounds.height+4))<.5,'menu opens below the entire card, clear of the mode tabs');
   assert.ok(Math.abs(cardMenu.x-Math.min(cardBounds.x+cardBounds.width*.55,1400-290))<.5,'menu starts slightly right of the card midpoint');
   assert.deepEqual(await page.locator('.folder-menu-item:not(.folder-menu-open) .folder-menu-name').allTextContents(),['Recent','Older']);
   await page.keyboard.press('Escape');assert.equal((await state(page)).tool,null);
   await card.locator('.launchpad-directory').click();await page.locator('.folder-menu').waitFor();assert.equal((await state(page)).tool,null);
   const iconMenu=await page.locator('.folder-menu').boundingBox();
   for(const axis of ['x','y'])assert.ok(Math.abs(cardMenu[axis]-iconMenu[axis])<.5,'card and folder icon open the menu at the same right-side anchor');
   await page.keyboard.press('Escape');
 }
 console.log('OK all directory-using cards and folder buttons choose first; cancellation never launches; card paths hidden');
 const claude=page.getByRole('group',{name:'Claude launch mode'});
 await claude.getByRole('button',{name:'Terminal',exact:true}).click();assert.equal(await page.locator('.folder-menu').count(),0);assert.equal((await state(page)).tool,null);
 await claude.locator('..').locator('.launchpad-card-info').click();await page.locator('.folder-menu-item:not(.folder-menu-open)').nth(1).click();
 let launched=await state(page);assert.equal(launched.tool,'claude');assert.equal(launched.folderPath,'D:/Older');assert.equal(launched.claudeMode,'terminal');
 assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('coffee:recent-folders'))),['D:/Older','D:/Recent']);
 await fresh(page);await page.locator('.launchpad-mode-tabs').first().waitFor();
 const codex=page.getByRole('group',{name:'Codex launch mode'});await codex.getByRole('button',{name:'Desktop',exact:true}).click();await codex.locator('..').locator('.launchpad-directory').click();
 assert.deepEqual(await page.locator('.folder-menu-item:not(.folder-menu-open) .folder-menu-name').allTextContents(),['Older','Recent']);
 await page.locator('.folder-menu-item:not(.folder-menu-open)').first().click();launched=await state(page);assert.equal(launched.tool,'codex');assert.equal(launched.folderPath,'D:/Older');assert.equal(launched.codexMode,'conversation');
 assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('coffee:recent-folders'))),['D:/Older','D:/Recent'],'reusing a recent path does not duplicate it');
 await page.reload();await page.locator('.launchpad-mode-tabs').first().waitFor();await page.getByRole('group',{name:'Claude launch mode'}).locator('..').locator('.launchpad-card-info').click();assert.deepEqual(await page.locator('.folder-menu-item:not(.folder-menu-open) .folder-menu-name').allTextContents(),['Older','Recent']);await page.keyboard.press('Escape');
 assert.deepEqual(errors,[]);await page.close();console.log('OK explicit directory and current mode reach the session; most recent first, deduplication and reload persistence');
 const empty=await prepare([]),p=empty.page;
 await p.getByRole('group',{name:'Claude launch mode'}).locator('..').locator('.launchpad-card-info').click();await p.waitForFunction(()=>window.pickCount===1);assert.equal((await state(p)).tool,null,'cancelling a native chooser does not launch');
 await p.evaluate(()=>window.pickedFolder='D:/NewProject');await p.getByRole('group',{name:'Codex launch mode'}).locator('..').locator('.launchpad-directory').click();await p.waitForFunction(()=>window.pickCount===2);
 launched=await state(p);assert.equal(launched.tool,'codex');assert.equal(launched.folderPath,'D:/NewProject');assert.deepEqual(await p.evaluate(()=>JSON.parse(localStorage.getItem('coffee:recent-folders'))),['D:/NewProject']);assert.deepEqual(empty.errors,[]);
 console.log('OK empty history uses the native chooser; cancel is safe; a new selection becomes the first recent directory');await p.close();
}finally{await browser.close()}
