import test from 'node:test';import assert from 'node:assert/strict';import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import {spawn} from 'node:child_process';
import {Store} from '../lib/store.mjs';import {initialBlackjack,applyBlackjack,completePreparedDeal} from '../lib/blackjack.mjs';

test('分割HTTP/MCP：設定検証・両組終了後だけ通知・公開情報・再起動からの再開・同一精算',async()=>{
 const dir=fs.mkdtempSync(path.join(process.cwd(),'test-output','blackjack-split-'));let child,base,token,error;const notices=[];
 const rpc=async(name,args)=>{const r=await fetch(base+'/mcp',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:{input_args:args}}})});return (await r.json()).result;};
 const fake=http.createServer(async(req,res)=>{try{let body='';for await(const c of req)body+=c;notices.push(JSON.parse(body));const r=await rpc('gameapps_get_state',{session_id:'split-flow',room_id:'example_room'});assert.ok(!r.isError);const s=JSON.parse(r.content[0].text);assert.equal(s.player_hands.length,2);assert.equal(s.phase,'dealer');assert.equal(s.dealer_cards.length,2);assert.ok(s.player_hands.every(h=>h.state==='stood'));assert.ok(!('deck'in s));assert.match(notices.at(-1).message,/手札1/);assert.match(notices.at(-1).message,/手札2/);const result=await rpc('gameapps_play_move',{session_id:'split-flow',room_id:'example_room',expected_version:s.version,move:'stand'});assert.ok(!result.isError);res.end(JSON.stringify({reply:'両方の手札を確認して、ここで止めたよ。'}));}catch(e){error=e;res.writeHead(500);res.end('{}');}});await new Promise(r=>fake.listen(0,'127.0.0.1',r));
 const probe=http.createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));base='http://127.0.0.1:'+port+'/gameapps';
 const seed=new Store(dir),pool=['spades','hearts','diamonds','clubs'].flatMap(suit=>Array.from({length:13},(_,i)=>({rank:i+1,suit}))),top=[8,10,8,7,10,10].map(rank=>pool.splice(pool.findIndex(c=>c.rank===rank),1)[0]);
 const s=completePreparedDeal(applyBlackjack({id:'split-flow',mode:'nexus',roomId:'example_room',nexusUrl:'http://127.0.0.1:'+fake.address().port,personaName:'相手',status:'playing',version:0,delivery:{status:'idle'},conversation:[],...initialBlackjack(false,true)},'bet:50','human',()=>[...top,...pool]));seed.create(s);seed.saveSettings({nexusUrl:'http://127.0.0.1:'+fake.address().port});seed.db.close();
 const wait=async fn=>{for(let i=0;i<300;i++){if(error)throw error;const result=await fn();if(result)return result;await new Promise(r=>setTimeout(r,20));}throw Error('timeout');},post=async(route,b={})=>{const r=await fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});return {status:r.status,body:await r.json()};},get=async()=>(await fetch(base+'/api/games/split-flow')).json();
 const start=async()=>{child=spawn(process.execPath,['--no-warnings','server.mjs'],{cwd:process.cwd(),env:{...process.env,GAMEAPPS_PORT:String(port),GAMEAPPS_DATA_DIR:dir},stdio:'pipe'});await wait(async()=>{try{return (await fetch(base+'/api/health')).ok;}catch{return false;}});},stop=async()=>{if(child?.exitCode===null){const done=new Promise(r=>child.once('exit',r));child.kill();await done;}};
 try{
  await start();token=(await post('/api/mcp-info')).body.token;
  assert.equal((await post('/api/games',{game:'blackjack',mode:'practice',splitEnabled:'yes'})).status,400);
  assert.equal((await post('/api/games',{game:'blackjack',mode:'practice',playStyle:'quick',splitEnabled:true})).status,400);
  assert.equal((await post('/api/games',{game:'blackjack',mode:'practice'})).body.splitEnabled,false);
  assert.equal((await post('/api/games',{game:'blackjack',mode:'practice',splitEnabled:true})).body.splitEnabled,true);
  const split=await post('/api/games/split-flow/move',{move:'split',version:s.version,note:'二組に分けるね'});assert.equal(split.status,200);assert.equal(split.body.chips,0);assert.equal(notices.length,0);
  let current=await get();assert.equal(current.playerHands.length,2);assert.deepEqual(current.dealerCards,[s.dealerHand[0],{hidden:true}]);
  assert.equal((await post('/api/games/split-flow/move',{move:'stand',version:s.version})).status,400);
  const hidden=await rpc('gameapps_get_state',{session_id:s.id,room_id:'example_room'}),context=JSON.parse(hidden.content[0].text);assert.equal(context.dealer_value,null);assert.equal(context.dealer_cards[1].hidden,true);
  assert.ok((await rpc('gameapps_get_state',{session_id:s.id,room_id:'other_room'})).isError);
  await stop();await start();assert.deepEqual((await get()).playerHands,current.playerHands);token=(await post('/api/mcp-info')).body.token;
  let r=await post('/api/games/split-flow/move',{move:'stand',version:current.version,note:'一組目は止める'});assert.equal(r.status,200);current=await get();assert.equal(current.phase,'player');assert.equal(current.activeHand,1);assert.equal(notices.length,0);
  r=await post('/api/games/split-flow/move',{move:'stand',version:current.version,note:'二組目も止める'});assert.equal(r.status,200);
  current=await wait(async()=>{const x=await get();return x.phase==='round_over'&&x.delivery.status!=='pending'?x:false;});assert.equal(notices.length,1);assert.match(notices[0].message,/二組に分けるね\n一組目は止める\n二組目も止める/);assert.equal(current.chips,200);assert.equal(current.rounds.length,1);assert.deepEqual(current.rounds[0].hands.map(h=>h.outcome),['win','win']);
  assert.equal((await post('/api/games/split-flow/move',{move:'stand',version:current.version})).status,400);assert.equal((await get()).chips,200);
 }finally{await stop();await new Promise(r=>fake.close(r));}
});
