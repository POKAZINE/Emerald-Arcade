import test from 'node:test';import assert from 'node:assert/strict';
import {initialDaifugo,applyDaifugo,daifugoOptions,daifugoView,daifugoContext,dfDeck,daifugoBotMove} from '../lib/daifugo.mjs';
import {dfSelection,dfChoices} from '../public/daifugo-rules.js';
import {gameNotification} from '../lib/game-notification.mjs';import {gameOutcome} from '../lib/game-outcome.mjs';import {resultCardData} from '../public/result-card-data.js';
const base=()=>({id:'df-test',mode:'nexus',roomId:'example_room',personaName:'試験相手',status:'playing',version:0,delivery:{status:'idle'},conversation:[],result:null,...initialDaifugo()});
const position=(a,b,options={})=>({...base(),phase:'playing',roundNumber:1,hands:{1:a,2:b},rulesConfig:{binding:false,stairs:false,...options}});
const play=(s,move)=>applyDaifugo(s,move,s.turn===1?'human':'persona');
test('配札は53枚から各15枚、未使用23枚。先手・設定検証・再配札拒否',()=>{
 assert.throws(()=>initialDaifugo({binding:'yes'}));assert.throws(()=>initialDaifugo({evil:true}));
 const a=applyDaifugo(base(),'next','human',dfDeck,2);assert.equal(a.turn,2);assert.equal(a.hands[1].length,15);assert.equal(a.hands[2].length,15);assert.equal(a.unused.length,23);assert.equal(new Set([...a.hands[1],...a.hands[2],...a.unused]).size,53);assert.throws(()=>applyDaifugo(a,'next','persona'));assert.equal(base().version,0);
});
test('同数札・パス温存・パス後の再開・不正手拒否・ジョーカー上がり防止',()=>{
 let s=position(['h3','s3','d4','jk'],['h4','s4','d7']);assert.throws(()=>play(s,'pass'),/空/);s=play(s,'play:h3,s3');assert.throws(()=>play(s,'play:d7'),/同じ枚数/);assert.ok(daifugoOptions(s,2).actions.includes('pass'));s=play(s,'pass');assert.equal(s.turn,1);assert.equal(s.table,null);
 const stuck=position(['jk','h8'],['s9']);assert.match(dfSelection(stuck,['h8'],stuck.hands[1]).error,/ジョーカーだけ/);assert.throws(()=>play(stuck,'play:h8'));const p=position(['jk'],['s3']);assert.equal(dfChoices(p,p.hands[1]).length,0);assert.match(dfSelection(p,['jk'],p.hands[1]).error,/上がれません/);assert.throws(()=>play(p,'play:jk'));
});
test('8切り・階段の8切り・ジョーカー代用8では切らない・スペ3返し',()=>{
 let s=play(position(['h8','s4'],['s9']),'play:h8');assert.equal(s.turn,1);assert.equal(s.table,null);assert.match(s.lastMove.events.join(),/8切り/);
 s=play(position(['h7','h8','h9','s4'],['s9'],{stairs:true}),'play:h7,h8,h9:7');assert.equal(s.turn,1);assert.equal(s.table,null);
 s=play(position(['h7','h9','jk','s4'],['s9'],{stairs:true}),'play:h7,h9,jk:7');assert.ok(s.table);
 s=play(position(['jk','h4'],['s3','d4']),'play:jk');s.binding='h';s=play(s,'play:s3');assert.equal(s.table,null);assert.equal(s.binding,null);assert.equal(s.turn,2);
});
test('革命と革命返し・逆順の比較・しばりは革命で解除しない',()=>{
 let s=position(['s4','h4','d4','c4','s3'],['s5','h5','d5','c5','h3']);s.binding='cdhs';s=play(s,'play:c4,d4,h4,s4');assert.equal(s.revolution,true);assert.equal(s.binding,'cdhs');assert.equal(dfChoices(s,s.hands[2]).length,0);s=play(s,'pass');s=play(s,'play:s3');assert.equal(s.phase,'round_over');
 s=position(['s4','h4','d4','c4','s9'],['s3','h3','d3','c3','h9']);s=play(s,'play:c4,d4,h4,s4');s=play(s,'play:c3,d3,h3,s3');assert.equal(s.revolution,false);
});
test('スート構成しばり・ジョーカー補充・階段設定・ジョーカー解釈を明示選択',()=>{
 let s=position(['s3','h3','s5','h5','jk','c9'],['s4','h4','d9'],{binding:true});s=play(s,'play:h3,s3');s=play(s,'play:h4,s4');assert.equal(s.binding,'hs');assert.ok(dfChoices(s,s.hands[1]).some(p=>p.move==='play:h5,s5'));assert.equal(dfSelection(s,['s5','jk'],s.hands[1]).choices.length,1);
 let p=position(['h4','h5','jk','s9'],['s6'],{stairs:true});const c=dfSelection(p,['h4','h5','jk'],p.hands[1]).choices;assert.equal(c.length,2);assert.ok(c.some(p=>p.move.endsWith(':3')));assert.ok(c.some(p=>p.move.endsWith(':4')));p.rulesConfig.stairs=false;assert.equal(dfSelection(p,['h4','h5','jk'],p.hands[1]).choices.length,0);
});
test('2ラウンド以降は勝者が交換前から選び、敗者最強と同時交換して敗者先手',()=>{
 let s=position(['h3'],['s2','d7']);s=play(s,'play:h3');assert.equal(s.phase,'round_over');const deck=['s3','jk',...dfDeck().filter(x=>!['s3','jk'].includes(x))];s=applyDaifugo(s,'next','human',()=>deck);assert.equal(s.phase,'exchange');assert.equal(s.turn,1);const before=structuredClone(s.hands),offered=s.exchange.offered;assert.equal(offered,'jk');assert.throws(()=>play(s,'exchange:jk'));s=play(s,'exchange:s3');assert.equal(s.hands[1].length,15);assert.equal(s.hands[2].length,15);assert.ok(s.hands[1].includes('jk'));assert.ok(s.hands[2].includes('s3'));assert.equal(s.turn,2);assert.equal(s.privateExchange[1].gave,'s3');assert.equal(before[1].includes('jk'),false);assert.equal(s.phase,'playing');assert.equal(s.revolution,false);
});
test('秘密投影・自動通知・結果カード・優勝は最終ラウンドだけ',()=>{
 let s=position(['s3'],['h4','h5']);s.roundNumber=3;s.rounds=[{number:1,winner:2,remaining:3,actions:[]},{number:2,winner:2,remaining:3,actions:[]}];s=play(s,'play:s3');assert.equal(s.result,'win');assert.equal(s.status,'finished');assert.equal(gameOutcome(s).winner,'user');assert.match(gameNotification(s),/総合優勝/);
 const v=daifugoView(s),ctx=daifugoContext(s);assert.equal(v.hands,undefined);assert.equal(v.unused,undefined);assert.equal(v.exchange,undefined);assert.equal(ctx.hands,undefined);assert.equal(ctx.unused,undefined);assert.deepEqual(ctx.private_hand,['h4','h5']);assert.equal(ctx.userHand,undefined);
 s.unused=['PRIVATE_UNUSED'];s.privateExchange={1:{gave:'PRIVATE_EXCHANGE'}};const shared=JSON.stringify(resultCardData(s));assert.ok(!shared.includes('PRIVATE_'));assert.ok(!shared.includes('h5'));assert.equal(resultCardData(s).rounds.length,3);
});
test('全オプションのランダム配札で3ラウンド完走、札の保存・手番・有限進行',()=>{
 for(let trial=0;trial<16;trial++){
  let s={...base(),rulesConfig:{binding:!!(trial%2),stairs:!!(trial%4>=2)}};let steps=0;
  while(s.status==='playing'&&steps++<260){let move;if(['ready','round_over'].includes(s.phase))move='next';else if(s.phase==='exchange')move='exchange:'+s.hands[s.turn][0];else {const choices=daifugoOptions(s,s.turn);move=choices.plays.sort((a,b)=>b.count-a.count)[0]?.move||'pass';}s=play(s,move);
   const currentPlays=s.actions.flatMap(a=>a.cards||[]),all=[...s.hands[1],...s.hands[2],...s.unused,...currentPlays];if(s.roundNumber){assert.equal(all.length,53);assert.equal(new Set(all).size,53);}assert.ok(s.hands[1].length<=15&&s.hands[2].length<=15);
  }assert.equal(s.status,'finished','trial '+trial+' steps '+steps);assert.equal(s.rounds.length,3);assert.equal(s.result,s.rounds.at(-1).winner===1?'win':'loss');
 }
});
