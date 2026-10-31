import test from 'node:test';import assert from 'node:assert/strict';
import {initialTexas,applyTexas,texasOptions,texasView,texasContext,evaluatePoker,texasBotMove} from '../lib/texas.mjs';
import {gameNotification} from '../lib/game-notification.mjs';import {gameOutcome} from '../lib/game-outcome.mjs';
const suits={S:'spades',H:'hearts',D:'diamonds',C:'clubs'},card=s=>({rank:({A:1,K:13,Q:12,J:11,T:10})[s[0]]||Number(s[0]),suit:suits[s[1]]}),cards=s=>s.split(' ').map(card);
const deck=()=>{const first=cards('2C 4D 3C 5D 6C TS JS QS 7C KS 8C AS');return [...first,...Object.values(suits).flatMap(suit=>Array.from({length:13},(_,i)=>({rank:i+1,suit}))).filter(c=>!first.some(f=>f.rank===c.rank&&f.suit===c.suit))];};
const initial=(button=1,limit=5)=>({id:'texas-test',mode:'nexus',roomId:'example_room',personaName:'テスト',status:'playing',version:0,lastMove:null,delivery:{status:'idle'},conversation:[],...initialTexas(limit,button)});
const act=(s,m)=>applyTexas(s,m,s.turn===s.humanColor?'human':'persona',deck);
const sum=s=>s.stacks[1]+s.stacks[2]+s.pot;
test('5〜7枚から役を正しく比較し、Aの低位・キッカー・共通5枚・フォーカードに対応',()=>{
 const samples=[['2S 4H 6D 8C TS',0],['2S 2H 6D 8C TS',1],['2S 2H 6D 6C TS',2],['2S 2H 2D 8C TS',3],['AS 2H 3D 4C 5S',4],['2S 4S 6S 8S TS',5],['2S 2H 2D 8C 8S',6],['2S 2H 2D 2C TS',7],['9S TS JS QS KS',8]];
 for(const [hand,n]of samples)assert.equal(evaluatePoker(cards(hand)).value[0],n);
 assert.equal(evaluatePoker(cards('AS 2H 3D 4C 5S')).value[1],5);assert.equal(evaluatePoker(cards('TS JS QS KS AS 2H 3D')).label,'ロイヤルフラッシュ');
 assert.deepEqual(evaluatePoker(cards('AS AH AD KS KH KD 2C')).value,[6,14,13]);assert.deepEqual(evaluatePoker(cards('AS AH KS QH JD 9C 2C')).value,[1,14,13,12,11]);
 assert.deepEqual(evaluatePoker(cards('TS JS QS KS AS 2H 3D')).value,evaluatePoker(cards('TS JS QS KS AS 4H 5D')).value);
});
test('ブラインド・ヘッズアップの行動順・チェックとコール・4段階・次ハンドの交代',()=>{
 let s=act(initial(),'next');assert.equal(s.pot,7);assert.deepEqual(s.streetBets,{1:2,2:5});assert.equal(s.turn,1);assert.throws(()=>act(s,'check'),/段階/);
 s=act(s,'call');assert.equal(s.turn,2);assert.equal(s.street,'preflop');s=act(s,'check');assert.equal(s.street,'flop');assert.equal(s.turn,2);
 for(const stage of ['turn','river','river']){s=act(s,'check');s=act(s,'check');assert.equal(s.street,stage);assert.equal(sum(s),200);}
 assert.equal(s.phase,'hand_over');assert.equal(s.hands[0].reason,'showdown');assert.equal(s.hands[0].winner,null);assert.deepEqual(s.stacks,{1:100,2:100});s=act(s,'next');assert.equal(s.button,2);assert.equal(s.turn,2);
});
test('最小レイズ・整数入力・手番・全額確認・フォールドの未公開と保存状態の不変性',()=>{
 const s=act(initial(),'next');assert.throws(()=>act(s,'raise:9'),/合計ベット/);assert.throws(()=>act(s,'bet:10'),/段階/);assert.throws(()=>act(s,'raise:10.5'),/合法操作/);assert.throws(()=>applyTexas(s,'call','persona'),/手番/);assert.throws(()=>act(s,'allin'),/確認/);assert.throws(()=>act(s,'raise:100'),/確認/);assert.equal(s.version,1);assert.equal(s.stacks[1],98);
 const folded=act(s,'fold');assert.equal(folded.phase,'hand_over');assert.deepEqual(folded.stacks,{1:98,2:102});assert.equal(folded.hands[0].cards,null);assert.equal(folded.hands[0].scores,null);assert.ok(texasView(folded).opponentCards.every(c=>c.hidden));assert.ok(texasContext(folded).user_cards.every(c=>c.hidden));
});
test('オールインで自動ランアウト・同点分配。足りないコールも確認し超過分を返却',()=>{
 let s=act(initial(),'next');s=act(s,'allin:confirm');assert.equal(s.turn,2);assert.equal(s.community.length,0);s=act(s,'call');assert.equal(s.phase,'hand_over');assert.equal(s.community.length,5);assert.deepEqual(s.stacks,{1:100,2:100});assert.equal(s.hands[0].pot,200);
 s=act({...initial(),stacks:{1:160,2:40}},'next');s=act(s,'allin:confirm');s=act(s,'call');assert.deepEqual(s.stacks,{1:160,2:40});assert.equal(s.hands[0].pot,80);assert.equal(sum(s),200);
 s=act(initial(2),'next');s=act(s,'allin');assert.throws(()=>act(s,'call'),/確認/);s=act(s,'call:confirm');assert.equal(s.phase,'hand_over');
});
test('不足したブラインドと最小幅未満の全額レイズを処理し、チップを保存する',()=>{
 let s=act({...initial(),stacks:{1:193,2:7}},'next');s=act(s,'call');assert.equal(texasOptions(s).raiseToMin,7);s=act(s,'allin');assert.equal(s.currentBet,7);s=act(s,'call');assert.equal(s.hands[0].pot,14);assert.equal(sum(s),200);
 assert.throws(()=>act({...initial(),stacks:{1:1,2:199}},'next'),/確認/);s=act({...initial(),stacks:{1:1,2:199}},'next:confirm');assert.equal(s.phase,'hand_over');assert.equal(s.hands[0].pot,2);assert.equal(sum(s),200);
});
test('HTTP・履歴用の投影とMCPで非公開情報を分離し、全体結果を通知する',()=>{
 let s=act(initial(),'next');const v=texasView(s),ctx=texasContext(s);assert.equal(v.holeCards,undefined);assert.equal(v.deck,undefined);assert.ok(v.opponentCards.every(c=>c.hidden));assert.deepEqual(v.userCards,s.holeCards[1]);assert.deepEqual(ctx.private_hand,s.holeCards[2]);assert.ok(ctx.user_cards.every(c=>c.hidden));assert.equal(ctx.deck,undefined);assert.equal(ctx.holeCards,undefined);assert.ok(!gameNotification(s).includes('private_hand'));
 for(let i=0;i<5;i++){s=act(s,'fold');if(s.status==='playing')s=act(s,'next');}assert.equal(s.status,'finished');assert.equal(s.hands.length,5);assert.ok(gameOutcome(s));assert.match(gameNotification(s),/対局が終了/);assert.throws(()=>act(s,'next'),/終了/);assert.throws(()=>initialTexas(6),/ハンド数/);
});
test('複数の練習経路でハンド進行が停止せず、チップ総量200・カード一意性・秘密の保持を確認',()=>{
 for(let run=0;run<20;run++){let s=initial(run%2+1);let n=0;while(s.status==='playing'&&n++<180){const o=texasOptions(s);let m=o.actions.includes('next')?'next':texasBotMove(s);if(m==='call'&&o.callIsAllin&&s.turn===1)m+=':confirm';s=act(s,m);assert.equal(sum(s),200);assert.equal(new Set([...s.holeCards[1],...s.holeCards[2],...s.community,...s.deck].map(c=>c.suit+c.rank)).size,[...s.holeCards[1],...s.holeCards[2],...s.community,...s.deck].length);if(s.phase!=='hand_over')assert.ok(texasView(s).opponentCards.every(c=>c.hidden));}assert.equal(s.status,'finished');}
});
test('ランダム配札・多様なベット経路でもチップが消えず、5／10ハンド内で決着する',()=>{
 let seed=417;const random=n=>{seed=(seed*1664525+1013904223)>>>0;return seed%n;};
 for(let run=0;run<35;run++){
  let s=initial(run%2+1,run%3?5:10),n=0;
  while(s.status==='playing'&&n++<400){const o=texasOptions(s);let move,cost=0;
   if(o.actions.includes('next')){move='next';cost=o.nextIsAllin?s.stacks[s.turn]:0;}
   else if(random(8)===0)move='fold';
   else if(o.actions.includes('raise')&&random(3)===0){move='raise:'+o.raiseToMin;cost=o.raiseToMin-o.ownStreetBet;}
   else if(o.actions.includes('bet')&&random(3)===0){move='bet:'+o.raiseToMin;cost=o.raiseToMin;}
   else if(o.actions.includes('check'))move='check';else{move='call';cost=o.callCost;}
   if(s.turn===s.humanColor&&cost===s.stacks[s.turn]&&cost>0)move+=':confirm';
   s=applyTexas(s,move,s.turn===1?'human':'persona');assert.equal(sum(s),200);assert.ok([s.stacks[1],s.stacks[2],s.pot].every(x=>Number.isInteger(x)&&x>=0));
  }
  assert.equal(s.status,'finished');assert.ok(s.handNumber<=s.handLimit);assert.ok(s.hands.every(h=>h.reason==='showdown'||(h.cards===null&&h.scores===null)));
 }
});
