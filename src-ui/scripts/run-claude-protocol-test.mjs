import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { runInNewContext } from 'node:vm';
import { fileURLToPath } from 'node:url';
const result = await build({ entryPoints: [fileURLToPath(new URL('../src/lib/claude-protocol.ts', import.meta.url))], bundle: true, platform: 'node', format: 'cjs', write: false });
const module = { exports: {} }; runInNewContext(result.outputFiles[0].text, { module, exports: module.exports, console, Date });
const { emptyClaudeState, reduceClaudeEvent } = module.exports;
let passed = 0;
function test(name, fn) { fn(); passed++; console.log(`ok ${name}`); }
const stream = event => ({ type: 'stream_event', event });
function fixture() { let s = emptyClaudeState(); return { get state() { return s; }, send: (event, now = 1000) => { s = reduceClaudeEvent(s, event, now); return s; } }; }

test('partial thinking and text become exactly one block each after complete assistant messages', () => {
  const f = fixture();
  f.send(stream({ type:'message_start', message:{ id:'msg' } }));
  f.send(stream({ type:'content_block_start', index:0, content_block:{ type:'thinking', thinking:'' } }));
  f.send(stream({ type:'content_block_delta', index:0, delta:{ type:'thinking_delta', thinking:'Reason' } }));
  f.send({ type:'assistant', message:{ id:'msg', content:[{type:'thinking', thinking:'Reason'}] } });
  f.send(stream({type:'content_block_stop', index:0}), 2500);
  f.send(stream({ type:'content_block_start', index:1, content_block:{type:'text', text:''} }));
  f.send(stream({ type:'content_block_delta', index:1, delta:{type:'text_delta',text:'Answer'} }));
  f.send({type:'assistant',message:{id:'msg',content:[{type:'text',text:'Answer'}]}});
  f.send(stream({type:'content_block_stop',index:1}), 3000);
  assert.equal(f.state.messages.length,2);
  assert.equal(f.state.messages[0].content,'Reason');
  assert.equal(f.state.messages[0].endedAt,2500);
  assert.equal(f.state.messages[1].content,'Answer');
  assert.equal(f.state.messages[1].partial,false);
});
test('parallel tool blocks retain their own incremental input and out-of-order results', () => {
  const f = fixture(); f.send(stream({type:'message_start',message:{id:'tools'}}));
  for(const [index,id] of [[0,'bash-1'],[1,'bash-2']]) f.send(stream({type:'content_block_start',index,content_block:{type:'tool_use',id,name:'Bash',input:{}}}));
  f.send(stream({type:'content_block_delta',index:0,delta:{type:'input_json_delta',partial_json:'{"command":"echo first"}'}}));
  f.send(stream({type:'content_block_delta',index:1,delta:{type:'input_json_delta',partial_json:'{"command":"exit 7"}'}}));
  f.send({type:'user',message:{role:'user',content:[{type:'tool_result',tool_use_id:'bash-2',content:'Exit code 7',is_error:true},{type:'tool_result',tool_use_id:'bash-1',content:[{type:'text',text:'first'}]}]}});
  assert.equal(f.state.messages.length,2);
  assert.equal(f.state.messages[0].input.command,'echo first');
  assert.equal(f.state.messages[0].output,'first');
  assert.equal(f.state.messages[0].toolStatus,'done');
  assert.equal(f.state.messages[1].input.command,'exit 7');
  assert.equal(f.state.messages[1].toolStatus,'failed');
});
test('tool approval is paired and a cancelled request disappears', () => {
  const f = fixture(); f.send({type:'control_request',request_id:'p',request:{subtype:'can_use_tool',tool_name:'Edit',input:{}}});
  assert.equal(f.state.requests.length,1); assert.equal(f.state.status,'requires_action');
  f.send({type:'control_cancel_request',request_id:'p'}); assert.equal(f.state.requests.length,0);
});
test('usage comes from result and is not multiplied by assistant block count', () => {
  const f = fixture();
  for(let i=0;i<3;i++) f.send({type:'assistant',message:{id:`m${i}`,content:[{type:'text',text:'text'}],usage:{input_tokens:100,output_tokens:5,cache_read_input_tokens:300}}});
  f.send({type:'result',usage:{input_tokens:100,output_tokens:15},modelUsage:{test:{contextWindow:100000}},total_cost_usd:0.002});
  assert.equal(f.state.usage.output_tokens,15); assert.equal(f.state.contextTokens,405); assert.equal(f.state.totalCost,0.002); assert.equal(f.state.contextWindow,100000);
});
test('final result clears live thinking and unfinished tools after interruption', () => {
  const f=fixture(); f.send({type:'system',subtype:'thinking_tokens',estimated_tokens:123});
  f.send({type:'assistant',message:{id:'t',content:[{type:'tool_use',id:'unfinished',name:'Bash',input:{command:'sleep 30'}}]}});
  f.send({type:'result',subtype:'success',is_error:false},8000);
  assert.equal(f.state.thinkingTokens,undefined); assert.equal(f.state.busy,false); assert.equal(f.state.messages[0].toolStatus,'failed');
});
test('historical messages do not fabricate thinking durations or live usage',()=>{
  let s=emptyClaudeState(); s=reduceClaudeEvent(s,{type:'assistant',message:{id:'old',content:[{type:'thinking',thinking:'history'}]}},100,true);
  assert.equal(s.messages[0].startedAt,undefined); assert.equal(s.messages[0].endedAt,undefined);
});
test('optimistic prompts are reconciled with echoed user messages',()=>{
  const s=emptyClaudeState(); s.messages.push({id:'pending:x',role:'user',content:'hello',timestamp:1});
  const next=reduceClaudeEvent(s,{type:'user',uuid:'native-user',message:{role:'user',content:'hello'}},100);
  assert.equal(next.messages.length,1); assert.equal(next.messages[0].id,'native-user');
});
test('history pages retain a tool result until its earlier call is loaded',()=>{
  let s=reduceClaudeEvent(emptyClaudeState(),{type:'user',message:{content:[{type:'tool_result',tool_use_id:'older-edit',content:'edited'}]}},200,true);
  assert.equal(s.messages.length,0);
  s=reduceClaudeEvent(s,{type:'assistant',message:{id:'old-msg',content:[{type:'tool_use',id:'older-edit',name:'Edit',input:{old_string:'a',new_string:'b'}}]}},100,true);
  assert.equal(s.messages[0].output,'edited'); assert.equal(s.messages[0].toolStatus,'done');
});
test('a queued second turn keeps the session busy after the first result',()=>{
  const state=emptyClaudeState(); state.busy=true; state.pendingTurns=2;
  const next=reduceClaudeEvent(state,{type:'result',usage:{}},5000);
  assert.equal(next.busy,true); assert.equal(next.pendingTurns,1); assert.equal(next.endedAt,undefined);
  const end=reduceClaudeEvent(next,{type:'result',usage:{}},6000);
  assert.equal(end.busy,false); assert.equal(end.pendingTurns,0);
});
console.log(`${passed} Claude protocol checks passed`);
