import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {PrivateLateralLibrary} from '../lib/lateral-private.mjs';
import {Store} from '../lib/store.mjs';
import {initialLateral,applyLateral,lateralView,lateralContext} from '../lib/lateral.mjs';
import {resultCardData} from '../public/result-card-data.js';

// Entirely synthetic; never load the user's original question in tests.
const fixture={id:'private-fixture',label:'動作確認の創作問題',roomId:'example_room',nexusUrl:'http://127.0.0.1:8000',prompt:'これはテスト用の問題です。なぜ？',truth:'SECRET_FIXTURE_ONLY',core:[{id:'cause',text:'SECRET_CORE_ONLY'}],facts:['SECRET_FACT_ONLY'],hints:['段階1','段階2','段階3']};
function library(){const dir=fs.mkdtempSync(path.join(process.cwd(),'test-output','private-lateral-'));const lib=new PrivateLateralLibrary(dir);lib.save({version:1,enabled:true,puzzles:[structuredClone(fixture)]});return {dir,lib};}
test('私用問題は通常候補に混ざらず、出題者だけに真相を渡し、対局開始時に固定する',()=>{
 const {lib}=library(),p=lib.get(fixture.id,fixture.roomId,fixture.nexusUrl);
 assert.throws(()=>lib.get(fixture.id,'other',fixture.nexusUrl));assert.throws(()=>lib.get(fixture.id,fixture.roomId,'http://elsewhere'));
 assert.equal(JSON.stringify(lib.catalogue()).includes(fixture.truth),false);assert.equal('nexusUrl'in lib.catalogue().puzzles[0],false);
 assert.equal(lib.catalogue('http://elsewhere').puzzles[0].available,false);
 assert.ok(initialLateral().candidates.every(c=>c.id!==fixture.id));
 let s={id:'test',mode:'nexus',status:'playing',version:0,conversation:[],delivery:{status:'idle'},...initialLateral({privatePuzzle:p})};
 assert.equal(s.turn,1);assert.equal(s.phase,'table');assert.equal(s.source,'private');assert.equal(s.puzzle.number,null);
 p.truth='changed';assert.equal(s.puzzle.truth,fixture.truth);
 const v=lateralView(s);assert.equal(v.source,'private');for(const secret of [fixture.truth,'SECRET_CORE_ONLY','SECRET_FACT_ONLY'])assert.equal(JSON.stringify(v).includes(secret),false);
 assert.equal(lateralContext(s).secret.truth,fixture.truth);
 assert.throws(()=>initialLateral({mode:'practice',privatePuzzle:p}));
 lib.setEnabled(false);assert.throws(()=>lib.get(fixture.id,fixture.roomId,fixture.nexusUrl));assert.equal(lateralContext(s).secret.truth,fixture.truth);
 assert.throws(()=>lib.remove(fixture.id,false));lib.remove(fixture.id,true);assert.equal(lib.catalogue().puzzles.length,0);assert.equal(lib.catalogue().enabled,false);
 s=applyLateral(s,{action:'giveup',confirm:true},'human');assert.equal(lateralView(s).puzzle.truth,fixture.truth);
 const share=resultCardData(s);assert.equal(share.source,'private');for(const key of ['truth','core','facts','prompt','title'])assert.equal(key in share,false);
});

test('私用問題HTTP：選択・削除・非表示・対局の保持、公開APIと静的配信に秘密が出ない',async()=>{
 const {dir,lib}=library();const probe=http.createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
 const base='http://127.0.0.1:'+port+'/gameapps';
 const store=new Store(dir);store.saveSettings({nexusUrl:fixture.nexusUrl,mcpToken:'private-fixture-token',lanToken:'fixture-lan'});store.db.close();
 let child;const launch=async()=>{child=spawn(process.execPath,['--no-warnings','server.mjs','--no-open'],{cwd:process.cwd(),env:{...process.env,GAMEAPPS_PORT:String(port),GAMEAPPS_DATA_DIR:dir},stdio:'pipe'});for(let i=0;i<250;i++){try{if((await fetch(base+'/api/health')).ok)return;}catch{}await new Promise(r=>setTimeout(r,20));}throw Error('test server timeout');};
 const stop=async()=>{if(child?.exitCode===null){const done=new Promise(r=>child.once('exit',r));child.kill();await done;}};
 const post=async(route,b)=>{const r=await fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});return {status:r.status,body:await r.json()};};
 const rpc=async(name,args)=>(await post('/mcp',{jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:{input_args:args}}}));
 try{
  await launch();let c=await (await fetch(base+'/api/lateral-private')).json();assert.equal(c.puzzles[0].label,fixture.label);assert.equal(JSON.stringify(c).includes(fixture.truth),false);
  for(const file of ['/data/private-lateral/library.json','/private-lateral/library.json','/lib/lateral-private.mjs'])assert.equal((await fetch(base+file)).status,404);
  assert.equal((await post('/api/games',{game:'lateral',mode:'practice',privatePuzzleId:fixture.id})).status,400);
  assert.equal((await post('/api/games',{game:'lateral',mode:'nexus',roomId:'other',privatePuzzleId:fixture.id})).status,400);
  const created=await post('/api/games',{game:'lateral',mode:'nexus',roomId:fixture.roomId,privatePuzzleId:fixture.id});assert.equal(created.status,201);const id=created.body.id;assert.equal(created.body.turn,1);assert.equal(created.body.delivery.status,'idle');assert.equal(created.body.conversation.length,0);
  assert.equal(JSON.stringify(created.body).includes(fixture.truth),false);
  const mcp=await fetch(base+'/mcp',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer private-fixture-token'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'gameapps_get_state',arguments:{input_args:{session_id:id,room_id:fixture.roomId}}}})});const context=JSON.parse((await mcp.json()).result.content[0].text);assert.equal(context.secret.truth,fixture.truth);
  assert.equal((await post('/api/lateral-private',{action:'delete',id:fixture.id})).status,400);
  await post('/api/lateral-private',{action:'visibility',enabled:false});assert.equal((await post('/api/games',{game:'lateral',mode:'nexus',roomId:fixture.roomId,privatePuzzleId:fixture.id})).status,400);
  await post('/api/lateral-private',{action:'visibility',enabled:true});
  await post('/api/lateral-private',{action:'delete',id:fixture.id,confirm:true});
  await stop();await launch();
  const saved=await (await fetch(base+'/api/games/'+id)).json();assert.equal(saved.puzzle.prompt,fixture.prompt);assert.equal(saved.source,'private');assert.equal(JSON.stringify(saved).includes(fixture.truth),false);
  const list=await (await fetch(base+'/api/games')).json();assert.equal(JSON.stringify(list).includes(fixture.truth),false);
  const ended=await post('/api/games/'+id+'/end',{});assert.equal(ended.status,200);assert.equal(JSON.stringify(ended.body).includes(fixture.truth),false);
  const history=await (await fetch(base+'/api/games/'+id+'/history')).json();assert.equal(JSON.stringify(history).includes(fixture.truth),false);
  c=await (await fetch(base+'/api/lateral-private')).json();assert.equal(c.enabled,false);assert.deepEqual(c.puzzles,[]);
 }finally{await stop();}
});
