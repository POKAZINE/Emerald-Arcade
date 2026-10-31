import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {Store} from '../lib/store.mjs';
import http from 'node:http';
import {initialBlackjack,applyBlackjack} from '../lib/blackjack.mjs';
test('HTTP・SQLite・MCP・再起動の結合検証（NexusArkへは送信しない）',async()=>{
 const root=process.cwd();fs.mkdirSync(path.join(root,'test-output'),{recursive:true});const dir=fs.mkdtempSync(path.join(root,'test-output','integration-'));
 const probe=http.createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
 const base=`http://127.0.0.1:${port}/gameapps`;
 const seed=new Store(dir);const cards=['spades','hearts','diamonds','clubs'].flatMap(suit=>Array.from({length:13},(_,i)=>({rank:i+1,suit})));const top=[10,9,8,7].map(rank=>cards.splice(cards.findIndex(c=>c.rank===rank),1)[0]);
 const pending=applyBlackjack({id:'legacy-deal',mode:'nexus',roomId:'example_room',personaName:'Test',status:'playing',version:0,delivery:{status:'action_required'},conversation:[{role:'persona',text:'配ったよ。スペード7と8だよ。',at:new Date().toISOString()}],...initialBlackjack()},'bet:30','human',()=>[...top,...cards]);delete pending.targetChips;pending.ruleVersion='blackjack-persona-v1';seed.create(pending);const historical={...structuredClone(pending),id:'old-finished',status:'finished',result:'win',chips:110};seed.create(historical);seed.db.close();
 let child;
 const start=async()=>{child=spawn(process.execPath,['--no-warnings','server.mjs','--no-open'],{cwd:root,env:{...process.env,GAMEAPPS_PORT:String(port),GAMEAPPS_DATA_DIR:dir},stdio:'pipe'});for(let i=0;i<70;i++){try{const r=await fetch(base+'/api/health');if(r.ok)return;}catch{}await new Promise(r=>setTimeout(r,50));}throw Error('test server failed to start');};
 const stop=async()=>{if(child.exitCode!==null)return;const p=new Promise(r=>child.once('exit',r));child.kill();await p;};
 const post=async(route,data,headers={})=>fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(data)});
 try{
 await start();
 const restored=await (await fetch(base+'/api/games/legacy-deal')).json();assert.equal(restored.targetChips,120);const oldRecord=await (await fetch(base+'/api/games/old-finished')).json();assert.equal(oldRecord.result,'win');assert.equal(oldRecord.chips,110);assert.equal(oldRecord.targetChips,undefined);assert.equal(restored.phase,'player');assert.equal(restored.version,2);assert.equal(restored.chips,70);assert.equal(restored.conversation.at(-1).operationUnverified,true);assert.equal(restored.delivery.status,'sent');assert.deepEqual(restored.dealerCards[1],{hidden:true});
 const inspect=new Store(dir),raw=inspect.get(pending.id);assert.deepEqual(raw.playerHand,pending.playerHand);assert.deepEqual(raw.dealerHand,pending.dealerHand);assert.deepEqual(raw.deck,pending.deck);inspect.db.close();
 assert.equal((await fetch(base+'/')).status,200);assert.equal((await fetch(base+'/app.js')).status,200);
 assert.equal((await post('/api/games',{mode:'practice',color:'black'},{Origin:'https://example.com'})).status,403);
 const cfg=await (await fetch(base+'/api/settings')).json();assert.equal('nexusToken' in cfg,false);assert.equal('mcpToken' in cfg,false);
 const game=await (await post('/api/games',{mode:'practice',color:'black'})).json();assert.equal(game.version,0);
 const first=await post(`/api/games/${game.id}/move`,{index:19,version:0});assert.equal(first.status,200);
 assert.equal((await post(`/api/games/${game.id}/move`,{index:26,version:0})).status,400);
 await new Promise(r=>setTimeout(r,1100));const played=await (await fetch(base+`/api/games/${game.id}`)).json();assert.ok(played.version>=2);
 assert.equal((await (await fetch(base+`/api/games/${game.id}/history`)).json()).length,played.version);
 const mcp=await (await post('/api/mcp-info',{})).json();const rpc=(method,params,token=mcp.token)=>post('/mcp',{jsonrpc:'2.0',id:1,method,params},{Authorization:`Bearer ${token}`});
 assert.equal((await rpc('tools/list',{},'wrong')).status,401);assert.equal((await (await rpc('tools/list',{})).json()).result.tools.length,4);
 const db=new Store(dir);const s=db.get(game.id);s.mode='nexus';s.roomId='example_room';s.delivery={status:'pending',messageId:'preserved-request',requestVersion:s.version,requestMessage:'保存された送信文'};db.update(s);db.db.close();
 const denied=await (await rpc('tools/call',{name:'gameapps_get_state',arguments:{session_id:s.id,room_id:'other_room'}})).json();assert.equal(denied.result.isError,true);
 const allowed=await (await rpc('tools/call',{name:'gameapps_get_state',arguments:{session_id:s.id,room_id:'example_room'}})).json();assert.equal(allowed.result.isError,undefined);
 await post('/api/settings',{title:'改名のテスト',theme:'dark'});await stop();await start();
 assert.equal((await (await fetch(base+'/api/games/legacy-deal')).json()).version,2);
 assert.equal((await (await fetch(base+'/api/settings')).json()).title,'Emerald Arcade');assert.equal((await (await fetch(base+`/api/games/${game.id}`)).json()).version,played.version);const recoveredState=await (await fetch(base+`/api/games/${game.id}`)).json();assert.equal(recoveredState.delivery.status,'error');assert.equal(recoveredState.delivery.messageId,'preserved-request');assert.equal(recoveredState.delivery.requestMessage,'保存された送信文');
 const exited=new Promise(r=>child.once('exit',r));assert.equal((await post('/api/shutdown',{})).status,200);await exited;
 }finally{if(child)await stop();}
});

test('ベットと自動配札は一括保存し、競合・途中失敗で部分保存しない',()=>{
 const dir=fs.mkdtempSync(path.join(process.cwd(),'test-output','atomic-')),db=new Store(dir);
 try{db.create({id:'atomic',version:0});db.updateMany([{id:'atomic',version:1},{id:'atomic',version:2}],0);assert.equal(db.get('atomic').version,2);assert.deepEqual(db.history('atomic').map(s=>s.version),[1,2]);
 assert.throws(()=>db.updateMany([{id:'atomic',version:3},{id:'atomic',version:4}],0));assert.equal(db.get('atomic').version,2);
 const invalid={id:'atomic',version:4};invalid.cycle=invalid;assert.throws(()=>db.updateMany([{id:'atomic',version:3},invalid],2));assert.equal(db.get('atomic').version,2);assert.equal(db.history('atomic').length,2);
 }finally{db.db.close();}
});
