import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {Store} from '../lib/store.mjs';
import {applyBlackjack,completePreparedDeal} from '../lib/blackjack.mjs';
test('模擬本体API→MCP着手→応答保存、失敗時の同一ID再送',async()=>{
 const dir=fs.mkdtempSync(path.join(process.cwd(),'test-output','persona-flow-'));
 let app,base,mcpToken,failNext=false,skipMoves=0,dropAfterRoll=false,dropAfterScore=false,offline=false;let skipBlackjackMoves=0;const received=[];
 const fake=http.createServer(async(req,res)=>{
   if(req.method!=='POST'){res.writeHead(offline?503:200,{'Content-Type':'application/json'});res.end(JSON.stringify([{room_id:'example_room'}]));return;}
   let raw='';for await(const c of req)raw+=c;const b=JSON.parse(raw);received.push(b);
   if(failNext){failNext=false;res.writeHead(503);res.end('{}');return;}
   assert.ok(b.message.startsWith('【Emerald Arcade自動通知／本人の直接入力ではありません】'));
   const sessionId=b.message.match(/対局ID: ([\w-]+)/)[1];
   const stateResponse=await fetch(base+'/mcp',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${mcpToken}`},body:JSON.stringify({jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'gameapps_get_state',arguments:{input_args:{session_id:sessionId,room_id:'example_room'}}}})});
   const context=JSON.parse((await stateResponse.json()).result.content[0].text);
   const skipBlackjack=context.game==='blackjack'&&skipBlackjackMoves>0;if(skipBlackjack)skipBlackjackMoves--;
   if(context.turn==='persona'&&context.status==='playing'&&skipMoves===0&&!skipBlackjack){
     const response=await fetch(base+'/mcp',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${mcpToken}`},body:JSON.stringify({jsonrpc:'2.0',id:3,method:'tools/call',params:{name:'gameapps_play_move',arguments:{session_id:context.session_id,room_id:context.room_id,expected_version:context.version,move:context.game==='blackjack'?(context.phase==='deal'?'deal':'stand'):context.game==='yacht'?(context.rolls_used?'score:'+Object.keys(context.available_scores)[0]+':confirm':'roll'):context.legal_moves[0]}}})});
     const result=await response.json();assert.ok(!result.result.isError,JSON.stringify(result));
   }
   if(context.game==='yacht'&&((dropAfterRoll&&!context.rolls_used)||(dropAfterScore&&context.rolls_used))){dropAfterRoll=false;dropAfterScore=false;res.destroy();return;}
   if(skipMoves>0)skipMoves--;res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({reply:context.game==='blackjack'?'配ったよ。スペード7と8だよ。':'ここに置いたよ。次はあなたの番！'}));
 });
 await new Promise(r=>fake.listen(0,'127.0.0.1',r));
 const probe=http.createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));base=`http://127.0.0.1:${port}/gameapps`;
 const post=async(route,b)=>{const r=await fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});return r.json();};
 const waitFor=async(fn)=>{for(let i=0;i<100;i++){const v=await fn();if(v)return v;await new Promise(r=>setTimeout(r,25));}throw Error('timed out');};
 try{
   app=spawn(process.execPath,['--no-warnings','server.mjs','--no-open'],{cwd:process.cwd(),env:{...process.env,GAMEAPPS_PORT:String(port),GAMEAPPS_DATA_DIR:dir},stdio:'pipe'});
   await waitFor(async()=>{try{return (await fetch(base+'/api/health')).ok;}catch{return false;}});
   mcpToken=(await post('/api/mcp-info',{})).token;
   await post('/api/settings',{nexusUrl:`http://127.0.0.1:${fake.address().port}`});
   const game=await post('/api/games',{mode:'nexus',roomId:'example_room',personaName:'Test Persona',color:'white'});
   const get=async()=> (await fetch(base+`/api/games/${game.id}`)).json();
   const ready=await waitFor(async()=>{const s=await get();return s.version===1&&s.delivery.status==='sent'?s:false;});
   assert.equal(ready.delivery.notificationTotals.attempts,1);assert.equal(ready.delivery.notificationTotals.completedActionRequests,1);assert.equal(ready.delivery.notificationMetrics.outcome,'completed');assert.equal(ready.turn,ready.humanColor);assert.equal(ready.conversation.length,1);assert.equal(received[0].source,'gameapps');
   failNext=true;await post(`/api/games/${game.id}/move`,{index:ready.legal[0],version:ready.version,note:'この一手、どう？'});
   await waitFor(async()=>{const s=await get();return s.delivery.status==='error'?s:false;});
   assert.match(received.at(-1).message,/【ユーザー本人の入力／Emerald Arcadeの一言欄】\nこの一手、どう？/);
   const failedId=received.at(-1).client_message_id;
   await post(`/api/games/${game.id}/retry`,{});
   const after=await waitFor(async()=>{const s=await get();return s.version===3&&s.delivery.status==='sent'?s:false;});
   assert.equal(received.at(-1).client_message_id,failedId);assert.equal(after.conversation.length,2);assert.equal(after.lastMove.actor,'persona');
   skipMoves=2;
   const second=await post('/api/games',{mode:'nexus',roomId:'example_room',personaName:'Test Persona',color:'white'});
   await waitFor(async()=>{const s=await (await fetch(base+`/api/games/${second.id}`)).json();return s.delivery.status==='action_required';});
   const noMoveId=received.at(-1).client_message_id;await post(`/api/games/${second.id}/retry`,{});
   await waitFor(async()=>{const s=await (await fetch(base+`/api/games/${second.id}`)).json();return s.version===1&&s.delivery.status==='sent';});
   assert.notEqual(received.at(-1).client_message_id,noMoveId);
   const db=new Store(dir),ending=db.get(second.id);
   ending.board=Array(64).fill(2);ending.board[0]=0;ending.board[1]=1;
   ending.humanColor=1;ending.turn=2;ending.delivery={status:'action_required'};db.update(ending);db.db.close();
   await post(`/api/games/${second.id}/retry`,{});
   const finished=await waitFor(async()=>{const s=await (await fetch(base+`/api/games/${second.id}`)).json();return s.status==='finished'&&s.resultNotified&&s.delivery.status==='sent'?s:false;});
   assert.equal(finished.result,'loss');
   const notices=received.filter(x=>x.client_message_id.includes(':result:'));
   assert.equal(notices.length,1);assert.match(notices[0].message,/あなたの勝利/);assert.match(notices[0].message,/黒0枚・白64枚/);
   await post(`/api/games/${second.id}/notify-result`,{});
   assert.equal(received.filter(x=>x.client_message_id.includes(':result:')).length,1);
   const yacht=await post('/api/games',{game:'yacht',mode:'nexus',roomId:'example_room',personaName:'Test Persona',color:'white'});
   const yachtReady=await waitFor(async()=>{const s=await (await fetch(base+`/api/games/${yacht.id}`)).json();return s.turn===s.humanColor&&s.lastMove?.action==='score'&&s.delivery.status==='sent'?s:false;});
   assert.equal(yachtReady.game,'yacht');assert.equal(yachtReady.totals[1].filled,1);assert.equal(yachtReady.totals[2].filled,0);
   const roll=await post(`/api/games/${yacht.id}/move`,{move:'roll',version:yachtReady.version});
   assert.equal(roll.rolls,1);const reroll=await post(`/api/games/${yacht.id}/move`,{move:'roll:1,3',version:roll.version});
   assert.equal(reroll.dice[0],roll.dice[0]);assert.equal(reroll.dice[2],roll.dice[2]);
   const recorded=await post(`/api/games/${yacht.id}/move`,{move:'score:ones',version:reroll.version,note:'これでいくよ！'});assert.equal(recorded.sheets[2].ones,reroll.options.ones);assert.equal(recorded.userNote.text,'これでいくよ！');
   await waitFor(async()=>{const s=await (await fetch(base+`/api/games/${yacht.id}`)).json();return s.turn===s.humanColor&&s.delivery.status==='sent';});


   const beforeBlackjack=received.length;
   const blackjack=await post('/api/games',{game:'blackjack',mode:'nexus',roomId:'example_room',color:'white'});
   assert.equal(blackjack.humanColor,1);assert.equal(blackjack.phase,'betting');assert.equal(received.length,beforeBlackjack);
   const bjGet=async()=> (await fetch(base+'/api/games/'+blackjack.id)).json();
   const bet=await post('/api/games/'+blackjack.id+'/move',{move:'bet:10',version:0,note:'よろしくね！'});
   assert.ok(['player','round_over'].includes(bet.phase));assert.equal(bet.version,2);assert.equal(bet.lastMove.actor,'system');assert.equal(bet.deck,undefined);assert.equal(bet.playerCards.length,2);
   if(bet.phase==='player'){
    assert.equal(bet.delivery.status,'idle');assert.equal(bet.targetChips,120);assert.deepEqual(bet.pendingUserNotes,['よろしくね！']);
    await new Promise(r=>setTimeout(r,75));assert.equal(received.length,beforeBlackjack);
    const bjReady=await bjGet();assert.deepEqual(bjReady.dealerCards[1],{hidden:true});assert.equal(bjReady.dealerValue,null);
    await post('/api/games/'+blackjack.id+'/move',{move:'stand',version:bjReady.version,note:'ここで止めるね！'});
    const complete=await waitFor(async()=>{const s=await bjGet();return s.phase==='round_over'&&s.delivery.status==='sent'?s:false;});
    assert.deepEqual(complete.pendingUserNotes,[]);assert.match(received.at(-1).message,/よろしくね！\nここで止めるね！/);
    assert.deepEqual(complete.playerCards,bet.playerCards);
   }else{
    await waitFor(async()=>{const s=await bjGet();return s.delivery.status==='sent';});
    assert.match(received.at(-1).message,/よろしくね/);assert.match(received.at(-1).message,/ラウンド終了/);
   }
   assert.match(received.at(-1).message,/サーバー確定の公開情報/);
   // Deterministic dealer turns: omitted tools get one correction, never an endless loop.
   const dealerFixture=async()=>{
    const created=await post('/api/games',{game:'blackjack',mode:'nexus',roomId:'example_room'}),db=new Store(dir);
    const pool=['spades','hearts','diamonds','clubs'].flatMap(suit=>Array.from({length:13},(_,i)=>({rank:i+1,suit}))),top=[10,10,9,8].map(rank=>pool.splice(pool.findIndex(c=>c.rank===rank),1)[0]);
    const prepared=applyBlackjack(db.get(created.id),'bet:30','human',()=>[...top,...pool]);
    const dealer=applyBlackjack(completePreparedDeal(prepared),'stand','human');dealer.delivery={status:'action_required'};db.update(dealer);db.db.close();return dealer;
   };
   const omitted=await dealerFixture(),omittedGet=async()=> (await fetch(base+'/api/games/'+omitted.id)).json();
   skipBlackjackMoves=1;const beforeCorrection=received.length;
   await post('/api/games/'+omitted.id+'/retry',{});
   const corrected=await waitFor(async()=>{const s=await omittedGet();return s.phase==='round_over'&&s.delivery.status==='sent'?s:false;});
   assert.equal(corrected.delivery.notificationTotals.unactedReplies,1);assert.equal(corrected.delivery.notificationTotals.repairAttempts,1);assert.equal(corrected.delivery.notificationTotals.completedActionRequests,1);assert.equal(corrected.version,omitted.version+1);assert.equal(corrected.conversation.at(-2).operationUnverified,true);assert.equal(received.length,beforeCorrection+2);
   assert.match(received.at(-1).message,/操作未実行の訂正通知/);assert.match(received.at(-1).message,/gameapps_play_move/);assert.notEqual(received.at(-1).client_message_id,received.at(-2).client_message_id);
   const stubborn=await dealerFixture(),stubbornGet=async()=> (await fetch(base+'/api/games/'+stubborn.id)).json();skipBlackjackMoves=2;const beforeBound=received.length;
   await post('/api/games/'+stubborn.id+'/retry',{});
   const stopped=await waitFor(async()=>{const s=await stubbornGet();return received.length===beforeBound+2&&s.delivery.status==='action_required'?s:false;});
   await new Promise(r=>setTimeout(r,100));assert.equal(received.length,beforeBound+2);assert.equal(stopped.version,stubborn.version);assert.equal(stopped.phase,'dealer');assert.equal(stopped.chips,stubborn.chips);assert.deepEqual(stopped.dealerCards,stubborn.dealerHand);
   await post('/api/games/'+stubborn.id+'/resume',{});
   await waitFor(async()=>{const s=await stubbornGet();return s.phase==='round_over'&&s.delivery.status==='sent';});
   const bjHistory=await (await fetch(base+'/api/games/'+blackjack.id+'/history')).json();
   for(const snapshot of bjHistory){assert.equal(snapshot.deck,undefined);assert.equal(snapshot.dealerHand,undefined);if(snapshot.phase==='player')assert.deepEqual(snapshot.dealerCards[1],{hidden:true});}
   // Transport failure after a persona roll: resume from the same dice, not a new roll.
   dropAfterRoll=true;
   const partial=await post('/api/games',{game:'yacht',mode:'nexus',roomId:'example_room',color:'white'});
   const partialGet=async()=> (await fetch(base+'/api/games/'+partial.id)).json();
   const stalled=await waitFor(async()=>{const s=await partialGet();return s.delivery.status==='error'?s:false;});
   assert.equal(stalled.version,1);assert.equal(stalled.rolls,1);
   const postCount=received.length;
   const checked=await post('/api/games/'+partial.id+'/recover',{});
   assert.equal(checked.delivery.recoveryReady,true);assert.equal(received.length,postCount);assert.deepEqual(checked.dice,stalled.dice);
   await post('/api/games/'+partial.id+'/resume',{});
   const resumed=await waitFor(async()=>{const s=await partialGet();return s.turn===s.humanColor&&s.delivery.status==='sent'?s:false;});
   assert.equal(resumed.version,2);assert.deepEqual(resumed.lastMove.dice,stalled.dice);assert.notEqual(received.at(-1).client_message_id,stalled.delivery.messageId);
   // Transport failure after scoring: connection recovery unlocks the human turn without another chat POST.
   dropAfterScore=true;
   const scored=await post('/api/games',{game:'yacht',mode:'nexus',roomId:'example_room',color:'white'});
   const scoredGet=async()=> (await fetch(base+'/api/games/'+scored.id)).json();
   const scoredStall=await waitFor(async()=>{const s=await scoredGet();return s.delivery.status==='error'?s:false;});
   assert.equal(scoredStall.turn,scoredStall.humanColor);assert.equal(scoredStall.totals[1].filled,1);
   assert.ok(scoredStall.delivery.messageId);assert.ok(scoredStall.delivery.requestMessage);
   offline=true;const unavailable=await post('/api/games/'+scored.id+'/recover',{});assert.match(unavailable.error,/接続できません/);
   assert.equal((await scoredGet()).delivery.status,'error');offline=false;
   const postsBeforeRecovery=received.length;
   const recovered=await post('/api/games/'+scored.id+'/recover',{});
   assert.equal(recovered.delivery.status,'sent');assert.equal(received.length,postsBeforeRecovery);
   assert.equal(recovered.version,scoredStall.version);assert.deepEqual(recovered.sheets,scoredStall.sheets);
 }finally{if(app){const exited=new Promise(r=>app.once('exit',r));app.kill();await exited;}await new Promise(r=>fake.close(r));}
});
