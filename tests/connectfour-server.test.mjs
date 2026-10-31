import test from 'node:test';import assert from 'node:assert/strict';import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import {spawn} from 'node:child_process';
test('四目並べ：HTTP・MCP・未操作の再依頼・終了通知・保存復元',async()=>{
 const dir=fs.mkdtempSync(path.join(process.cwd(),'test-output','connectfour-flow-'));let child,base,token,fakeError,release,omit=true;const received=[];
 const rpc=async(name,args)=>{const res=await fetch(base+'/mcp',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:{input_args:args}}})});return (await res.json()).result;};
 const fake=http.createServer(async(req,res)=>{try{if(req.method==='GET'){res.end(JSON.stringify([{room_id:'example_room'}]));return;}let raw='';for await(const c of req)raw+=c;const payload=JSON.parse(raw);received.push(payload);const id=payload.message.match(/対局ID: ([\w-]+)/)[1],result=await rpc('gameapps_get_state',{session_id:id,room_id:'example_room'});assert.ok(!result.isError);const s=JSON.parse(result.content[0].text);if(s.turn==='persona'&&s.status==='playing'){if(omit){await new Promise(r=>release=r);omit=false;}else{const out=await rpc('gameapps_play_move',{session_id:id,room_id:'example_room',expected_version:s.version,move:'drop:1'});assert.ok(!out.isError);}}res.end(JSON.stringify({reply:'コマを落とした結果を確認したよ。'}));}catch(e){fakeError=e;res.writeHead(500);res.end('{}');}});
 await new Promise(r=>fake.listen(0,'127.0.0.1',r));const probe=http.createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));base=`http://127.0.0.1:${port}/gameapps`;
 const wait=async fn=>{for(let i=0;i<160;i++){if(fakeError)throw fakeError;const r=await fn();if(r)return r;await new Promise(r=>setTimeout(r,25));}throw Error('timed out');};
 const post=async(route,b={})=>{const res=await fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});return {status:res.status,body:await res.json()};};
 const get=async id=>(await fetch(base+'/api/games/'+id)).json();
 const start=async()=>{child=spawn(process.execPath,['--no-warnings','server.mjs','--no-open'],{cwd:process.cwd(),env:{...process.env,GAMEAPPS_PORT:String(port),GAMEAPPS_DATA_DIR:dir},stdio:'pipe'});await wait(async()=>{try{return (await fetch(base+'/api/health')).ok;}catch{return false;}});};
 const stop=async()=>{if(child&&child.exitCode===null){const done=new Promise(r=>child.once('exit',r));child.kill();await done;}};
 try{
  await start();assert.equal((await fetch(base+'/connectfour-ui.js')).status,200);assert.equal((await fetch(base+'/connectfour.css')).status,200);token=(await post('/api/mcp-info')).body.token;await post('/api/settings',{nexusUrl:`http://127.0.0.1:${fake.address().port}`});
  const catalog=JSON.parse((await rpc('gameapps_list_games',{})).content[0].text);assert.ok(catalog.some(g=>g.id==='connectfour'));
  let s=(await post('/api/games',{game:'connectfour',mode:'nexus',roomId:'example_room',color:'black'})).body;assert.equal(s.board.length,42);assert.equal(received.length,0);const id=s.id;
  assert.equal((await post('/api/games/'+id+'/appearance',{version:0,userColor:'red',personaColor:'red'})).status,400);
  assert.equal((await post('/api/games/'+id+'/appearance',{version:0,userColor:'#bad',personaColor:'blue'})).status,400);
  assert.equal((await post('/api/games/'+id+'/appearance',{version:99,userColor:'red',personaColor:'blue'})).status,400);
  const colored=await post('/api/games/'+id+'/appearance',{version:0,userColor:'red',personaColor:'blue'});assert.equal(colored.status,200);assert.equal(colored.body.version,0);assert.deepEqual(colored.body.board,s.board);assert.deepEqual(colored.body.pieceColors,{'1':'red','2':'blue'});assert.equal(received.length,0);
  const coloredContext=JSON.parse((await rpc('gameapps_get_state',{session_id:id,room_id:'example_room'})).content[0].text);assert.equal(coloredContext.piece_colors[2].color_name,'青');assert.match(coloredContext.board_orientation,/1=赤/);
  assert.ok((await rpc('gameapps_get_state',{session_id:id,room_id:'wrong_room'})).isError);
  assert.ok((await rpc('gameapps_play_move',{session_id:id,room_id:'example_room',expected_version:0,move:'drop:1'})).isError);
  assert.equal((await post('/api/games/'+id+'/move',{move:'drop:8',version:0})).status,400);
  for(const [i,col] of [7,6,7,6].entries()){
   assert.equal((await post('/api/games/'+id+'/move',{move:'drop:'+col,version:s.version,note:i===0?'落としてみるね！':''})).status,200);
   if(i===0){await wait(()=>release);assert.equal((await post('/api/games/'+id+'/appearance',{version:1,userColor:'pink',personaColor:'blue'})).status,400);release();}
   s=await wait(async()=>{const v=await get(id);return v.version===(i+1)*2&&v.delivery.status==='sent'&&(i<3||v.resultNotified)?v:false;});
  }
  assert.ok(received.some(p=>p.message.includes('ユーザーは赤 ●、あなたは青 ◎')));assert.equal(s.result,'loss');assert.equal(s.winningLine.length,4);assert.ok(received.some(p=>p.message.includes('落としてみるね！')));assert.ok(received.some(p=>p.message.includes('未実行')));assert.match(received.at(-1).message,/あなた.*勝利/);
  const version=s.version;assert.equal((await post('/api/games/'+id+'/move',{move:'drop:2',version})).status,400);
  await stop();await start();const restored=await get(id);assert.deepEqual(restored.board,s.board);assert.equal(restored.result,'loss');assert.deepEqual(restored.pieceColors,{'1':'red','2':'blue'});const history=await (await fetch(base+'/api/games/'+id+'/history')).json();assert.equal(history.length,8);
  s=(await post('/api/games',{game:'connectfour',mode:'practice',color:'white'})).body;s=await wait(async()=>{const v=await get(s.id);return v.version===1?v:false;});assert.equal(s.lastMove.actor,'persona');assert.equal(s.turn,s.humanColor);assert.deepEqual(s.pieceColors,{'1':'blue','2':'red'});
 }finally{release?.();await stop();await new Promise(r=>fake.close(r));}
});
