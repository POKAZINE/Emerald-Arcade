import test from 'node:test';import assert from 'node:assert/strict';import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import {spawn} from 'node:child_process';import {Store} from '../lib/store.mjs';
const A=['red','blue','green','white'],B=['yellow','purple','red','blue'],wrong='guess:red,red,blue,blue';
test('ヒット＆ブローのHTTP・MCP・通知・敗者続行・再起動と秘密情報の結合検証',async()=>{
 const dir=fs.mkdtempSync(path.join(process.cwd(),'test-output','hitblow-flow-'));let child,base,token,stopPersona=false;const received=[];let fakeError;
 const fake=http.createServer(async(req,res)=>{try{
  if(req.method==='GET'){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify([{room_id:'example_room'}]));return;}
  let raw='';for await(const c of req)raw+=c;const payload=JSON.parse(raw);received.push(payload);const id=payload.message.match(/対局ID: ([\w-]+)/)[1];
  const rpc=async(name,args)=>{const r=await fetch(base+'/mcp',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:{input_args:args}}})});const out=await r.json();assert.ok(!out.result.isError,JSON.stringify(out));return JSON.parse(out.result.content[0].text);};
  const context=await rpc('gameapps_get_state',{session_id:id,room_id:'example_room'});assert.equal(context.secrets,undefined);
  if(context.turn==='persona'&&context.status==='playing'){
   const move=context.legal_actions.includes('stop')&&stopPersona?'stop':'guess:'+B.join(',');
   await rpc('gameapps_play_move',{session_id:id,room_id:'example_room',expected_version:context.version,move});
  }
  res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({reply:'この結果を見ながら、もう少し推理してみよう！'}));
 }catch(e){fakeError=e;res.writeHead(500);res.end('{}');}});
 await new Promise(r=>fake.listen(0,'127.0.0.1',r));const probe=http.createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));base=`http://127.0.0.1:${port}/gameapps`;
 const wait=async fn=>{for(let i=0;i<130;i++){if(fakeError)throw fakeError;const r=await fn();if(r)return r;await new Promise(r=>setTimeout(r,25));}throw Error('timed out');};
 const post=async(route,b={})=>{const r=await fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});return {status:r.status,body:await r.json()};};
 const get=async id=>(await fetch(base+'/api/games/'+id)).json();
 const start=async()=>{child=spawn(process.execPath,['--no-warnings','server.mjs','--no-open'],{cwd:process.cwd(),env:{...process.env,GAMEAPPS_DATA_DIR:dir,GAMEAPPS_PORT:String(port)},stdio:'pipe'});await wait(async()=>{try{return (await fetch(base+'/api/health')).ok;}catch{return false;}});};
 const stop=async()=>{if(!child||child.exitCode!==null)return;const p=new Promise(r=>child.once('exit',r));child.kill();await p;};
 try{
  await start();assert.equal((await fetch(base+'/hitblow-ui.js')).status,200);
  const invalid=await post('/api/games',{game:'hitblow',mode:'practice',allowDuplicates:'true'});assert.equal(invalid.status,400);
  const repeatedGame=(await post('/api/games',{game:'hitblow',mode:'practice',color:'black',allowDuplicates:true})).body;assert.equal(repeatedGame.rulesConfig.allowDuplicates,true);assert.deepEqual(repeatedGame.answers,{1:null,2:null});await stop();await start();assert.equal((await get(repeatedGame.id)).rulesConfig.allowDuplicates,true);
 token=(await post('/api/mcp-info')).body.token;await post('/api/settings',{nexusUrl:`http://127.0.0.1:${fake.address().port}`});
  const created=(await post('/api/games',{game:'hitblow',mode:'nexus',roomId:'example_room',color:'black'})).body;assert.equal(received.length,0);assert.deepEqual(created.answers,{1:null,2:null});
  const db=new Store(dir),s=db.get(created.id);s.secrets={1:A,2:B};db.update(s);db.db.close();
  await post('/api/games/'+s.id+'/move',{move:wrong,version:0,note:'一緒に考えよう！'});
  const decided=await wait(async()=>{const s1=await get(s.id);return s1.matchDecided&&s1.delivery.status==='sent'?s1:false;});assert.equal(decided.result,'loss');assert.equal(decided.status,'playing');assert.equal(decided.players[1].state,'choice');assert.equal(decided.answers[1],null);assert.deepEqual(decided.answers[2],B);assert.match(received.at(-1).message,/一緒に考えよう/);
  const count=received.length;await post('/api/games/'+s.id+'/move',{move:'continue',version:decided.version});const continued=await get(s.id);assert.equal(received.length,count);
  const repeated=await post('/api/games/'+s.id+'/move',{move:wrong,version:continued.version});assert.equal(repeated.status,400);assert.equal((await get(s.id)).version,continued.version);
  await stop();await start();const restored=await get(s.id);assert.equal(restored.phase,'afterplay');assert.equal(restored.result,'loss');assert.equal(restored.answers[1],null);
  await post('/api/games/'+s.id+'/move',{move:'guess:'+A.join(','),version:restored.version,note:'解けた！'});
  const finished=await wait(async()=>{const s1=await get(s.id);return s1.status==='finished'&&s1.resultNotified&&s1.delivery.status==='sent'?s1:false;});assert.equal(finished.result,'loss');assert.equal(finished.players[1].solvedAt,2);assert.deepEqual(finished.answers[1],A);assert.match(received.at(-1).message,/解けた/);
  const history=await (await fetch(base+'/api/games/'+s.id+'/history')).json();assert.ok(history.every(v=>!('secrets'in v)));assert.ok(history.filter(v=>v.players[1].state==='guessing'||v.players[1].state==='choice').every(v=>v.answers[1]===null));
  // A human victory lets the persona explicitly stop its own unsolved challenge.
  const second=(await post('/api/games',{game:'hitblow',mode:'nexus',roomId:'example_room',color:'black'})).body;const seed=new Store(dir),raw=seed.get(second.id);raw.secrets={1:A,2:A};seed.update(raw);seed.db.close();
  stopPersona=true;await post('/api/games/'+second.id+'/move',{move:'guess:'+A.join(','),version:0});
  const ended=await wait(async()=>{const v=await get(second.id);return v.status==='finished'&&v.resultNotified&&v.delivery.status==='sent'?v:false;});assert.equal(ended.result,'win');assert.equal(ended.players[2].state,'stopped');assert.equal(ended.players[2].guesses.length,1);
 }finally{await stop();await new Promise(r=>fake.close(r));}
});
