import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import http from 'node:http';import {spawn} from 'node:child_process';
import {quartetBotMove} from '../lib/quartet.mjs';
test('四重奏HTTP/MCP：一要求で配置と受け渡し、未操作修復・一言集約・再送・途中再開・終局通知',async()=>{
 const dir=fs.mkdtempSync(path.join(process.cwd(),'test-output','quartet-flow-'));let child,base,token,failure,skipNext=true,failNext=false;const notices=[],operations=[];
 const rpc=async(name,args)=>{const r=await fetch(base+'/mcp',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:{input_args:args}}})});return (await r.json()).result;};
 const fake=http.createServer(async(req,res)=>{try{
  let text='';for await(const chunk of req)text+=chunk;const b=JSON.parse(text);notices.push(b);
  if(failNext){failNext=false;res.writeHead(503);return res.end('{}');}if(skipNext){skipNext=false;return res.end(JSON.stringify({reply:'模擬の未操作返答です。'}));}
  const id=b.message.match(/対局ID: ([\w-]+)/)[1];let context=JSON.parse((await rpc('gameapps_get_state',{session_id:id,room_id:'example_room'})).content[0].text),count=0;
  while(context.action_required){assert.ok(count++<3);const move=context.phase==='give'?{action:'give',piece_id:context.legal_actions.piece_ids[0]}:{action:'place',cell:context.legal_actions.cells[0]};
   const result=await rpc('gameapps_play_move',{session_id:id,room_id:'example_room',expected_version:context.version,move:JSON.stringify(move)});assert.ok(!result.isError);context=JSON.parse(result.content[0].text);assert.equal(context.action_applied,true);operations.push(move.action);
  }
  res.end(JSON.stringify({reply:'確定した操作と結果を確認しました。'}));
 }catch(e){failure=e;res.writeHead(500);res.end('{}');}});await new Promise(r=>fake.listen(0,'127.0.0.1',r));
 const probe=http.createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));base='http://127.0.0.1:'+port+'/gameapps';
 const wait=async fn=>{for(let i=0;i<400;i++){if(failure)throw failure;const v=await fn();if(v)return v;await new Promise(r=>setTimeout(r,15));}throw Error('timeout');};
 const post=async(route,b={})=>{const r=await fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});return {status:r.status,body:await r.json()};};
 const get=async id=>(await fetch(base+'/api/games/'+id)).json();
 const launch=async()=>{child=spawn(process.execPath,['--no-warnings','server.mjs','--no-open'],{cwd:process.cwd(),env:{...process.env,GAMEAPPS_PORT:String(port),GAMEAPPS_DATA_DIR:dir},stdio:'pipe',windowsHide:true});await wait(async()=>{try{return (await fetch(base+'/api/health')).ok;}catch{return false;}});};
 const stop=async()=>{if(child?.exitCode===null){const done=new Promise(r=>child.once('exit',r));child.kill();await done;}};
 try{
  await launch();await post('/api/settings',{nexusUrl:'http://127.0.0.1:'+fake.address().port});token=(await post('/api/mcp-info')).body.token;
  const catalog=JSON.parse((await rpc('gameapps_list_games',{})).content[0].text);assert.ok(catalog.some(g=>g.id==='quartet'));
  for(const file of ['quartet-ui.js','quartet-pieces.js','quartet.css'])assert.equal((await fetch(base+'/'+file)).status,200);
  assert.equal((await post('/api/games',{game:'quartet',mode:'nexus',roomId:'example_room',firstGiver:'invalid'})).status,400);
  let s=(await post('/api/games',{game:'quartet',mode:'nexus',roomId:'example_room',personaName:'模擬相手',firstGiver:'persona'})).body;const id=s.id;
  const settled=async()=>s=await wait(async()=>{const x=await get(id);return x.delivery.status==='sent'&&(x.turn===1||x.status==='finished'&&x.resultNotified)?x:false;});
  await settled();assert.equal(notices.length,2);assert.match(notices[1].message,/操作未実行/);assert.equal(s.phase,'place');assert.equal(s.held.pieceId,'q00');
  assert.ok((await rpc('gameapps_get_state',{session_id:id,room_id:'other'})).isError);
  const move=async(m,note='')=>{const r=await post('/api/games/'+id+'/move',{version:s.version,move:typeof m==='string'?m:JSON.stringify(m),note});assert.equal(r.status,200,JSON.stringify(r.body));s=r.body;};
  const before=notices.length;await move({action:'place',cell:'B2'},'配置の一言');assert.equal(s.phase,'give');assert.equal(s.turn,1);await new Promise(r=>setTimeout(r,80));assert.equal(notices.length,before);
  const snapshot=structuredClone(s);await stop();await launch();s=await get(id);assert.deepEqual(s.board,snapshot.board);assert.equal(s.phase,'give');assert.equal(s.version,snapshot.version);
  assert.equal((await post('/api/games/'+id+'/move',{version:0,move:'{}'})).status,400);
  failNext=true;await move({action:'give',piece_id:'q01'},'渡す一言');s=await wait(async()=>{const x=await get(id);return x.delivery.status==='error'?x:false;});const failedId=notices.at(-1).client_message_id,version=s.version;
  assert.match(notices.at(-1).message,/配置の一言\n渡す一言/);await post('/api/games/'+id+'/retry');await settled();assert.equal(notices.at(-1).client_message_id,failedId);assert.equal(s.version,version+2);assert.deepEqual(operations.slice(-2),['place','give']);
  for(let n=0;s.status==='playing'&&n<32;n++){assert.equal(s.turn,1);await move(quartetBotMove(s));if(s.turn===2||s.status==='finished')await settled();}
  assert.equal(s.status,'finished');assert.equal(s.resultNotified,true);assert.ok(s.winningGroups.length||s.result==='draw');assert.match(notices.at(-1).message,/終了しました/);
  const history=await(await fetch(base+'/api/games/'+id+'/history')).json();assert.ok(history.some(g=>g.phase==='give'&&g.moveCount>0));assert.deepEqual(history.at(-1).board,s.board);
  const oldCount=notices.length;let demo=(await post('/api/games',{game:'quartet',mode:'practice',firstGiver:'user'})).body;await post('/api/games/'+demo.id+'/move',{version:0,move:JSON.stringify({action:'give',piece_id:'q00'})});demo=await wait(async()=>{const x=await get(demo.id);return x.turn===1&&x.phase==='place'?x:false;});assert.equal(demo.moveCount,1);assert.equal(notices.length,oldCount);
 }finally{await stop();await new Promise(r=>fake.close(r));}
});
