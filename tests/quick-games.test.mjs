import test from 'node:test';import assert from 'node:assert/strict';
import {initialBlackjack,prepareQuickBlackjack,completePreparedDeal,applyBlackjack,blackjackActions,blackjackView,blackjackContext,shuffledDeck} from '../lib/blackjack.mjs';
import {initialDaifugo,applyDaifugo,daifugoOptions,daifugoView,daifugoContext} from '../lib/daifugo.mjs';import {initialTexas,applyTexas,texasContext} from '../lib/texas.mjs';
import {gameNotification} from '../lib/game-notification.mjs';import {gameOutcome} from '../lib/game-outcome.mjs';import {resultCardData} from '../public/result-card-data.js';
const base={id:'quick',mode:'practice',roomId:'practice',personaName:'相手',status:'playing',version:0,delivery:{status:'idle'},conversation:[]};
const deck=cards=>[...cards,...shuffledDeck().filter(c=>!cards.some(p=>p.rank===c.rank&&p.suit===c.suit))];const card=(rank,suit='spades')=>({rank,suit});
test('お気軽BJ：即配札、チップとダブルなし、手札の勝敗・同点・BJで1回終了',()=>{
 for(const [cards,outcome] of [[[card(10),card(9),card(8),card(8,'hearts')],'win'],[[card(10),card(10,'hearts'),card(8),card(8,'hearts')],'draw'],[[card(10),card(10,'hearts'),card(7),card(8,'hearts')],'loss'],[[card(1),card(10,'hearts'),card(13),card(8,'hearts')],'win'],[[card(1),card(1,'hearts'),card(13),card(13,'hearts')],'draw']]){
  let s=completePreparedDeal(prepareQuickBlackjack({...base,...initialBlackjack(true)},()=>deck(cards)));assert.equal(s.playStyle,'quick');assert.equal(s.chips,undefined);assert.equal(s.targetChips,undefined);assert.ok(!blackjackActions(s).includes('double'));
  if(s.status==='playing'){assert.throws(()=>applyBlackjack(s,'double','human'));s=applyBlackjack(s,'stand','human');if(s.status==='playing')s=applyBlackjack(s,'stand','persona');}
  assert.equal(s.status,'finished');assert.equal(s.result,outcome);assert.equal(s.rounds.length,1);assert.equal(s.rounds[0].bet,undefined);assert.equal(blackjackView(s).chips,undefined);assert.equal(blackjackContext(s).target_chips,null);assert.match(gameNotification(s),/お気軽版/);assert.equal(gameOutcome(s).user_result,outcome);const shared=resultCardData(s);assert.equal(shared.playStyle,'quick');assert.equal(shared.chips,undefined);assert.equal(shared.rounds[0].net,undefined);assert.ok(!JSON.stringify(shared).includes('NaN'));
 }
});
test('お気軽BJ：ヒットのバストも終了し、伏せ札・山札は通常どおり非公開',()=>{
 let s=completePreparedDeal(prepareQuickBlackjack({...base,...initialBlackjack(true)},()=>deck([card(10),card(5),card(9),card(6),card(8)])));assert.ok(blackjackView(s).dealerCards[1].hidden);assert.equal(blackjackContext(s).deck,undefined);s=applyBlackjack(s,'hit','human');assert.equal(s.status,'finished');assert.equal(s.result,'loss');assert.throws(()=>applyBlackjack(s,'next','human'));
});
test('お気軽大富豪：15枚から1ラウンドで終わり、交換・第3ラウンド条件を使わない',()=>{
 let s=applyDaifugo({...base,...initialDaifugo({binding:true,stairs:true},true)},'next','human');assert.equal(s.hands[1].length,15);assert.equal(s.roundLimit,1);assert.ok(!daifugoContext(s).rules.includes('必ず1枚同時交換'));let n=0;while(s.status==='playing'&&n++<100){const o=daifugoOptions(s,s.turn),move=o.plays.sort((a,b)=>b.count-a.count)[0]?.move||'pass';s=applyDaifugo(s,move,s.turn===1?'human':'persona');assert.notEqual(s.phase,'exchange');}assert.equal(s.status,'finished');assert.equal(s.rounds.length,1);assert.equal(daifugoView(s).playStyle,'quick');assert.equal(daifugoContext(s).round_limit,1);assert.match(gameNotification(s),/1\/1ラウンド/);assert.ok(!gameOutcome(s).message.includes('第3ラウンド'));assert.equal(resultCardData(s).rounds.length,1);
});
test('お気軽ポーカー：2ハンドでD/SB/BB交代、残高持ち越し、0枚なら交代前にも終了',()=>{
 let s=applyTexas({...base,...initialTexas(2,1)},'next','human');const button=s.button;s=applyTexas(s,'fold','human');const chips={...s.stacks};assert.equal(s.status,'playing');s=applyTexas(s,'next','human');assert.equal(s.button,3-button);assert.equal(s.hands.length,1);assert.equal(s.handNumber,2);assert.equal(s.stacks[1]+s.stacks[2]+s.pot,200);assert.equal(s.stacks[1]+s.streetBets[1],chips[1]);s=applyTexas(s,'fold','persona');assert.equal(s.status,'finished');assert.equal(s.handLimit,2);assert.match(texasContext(s).rules,/最大2ハンド/);assert.equal(resultCardData(s).playStyle,'quick');
 const cards=[card(1),card(2,'hearts'),card(1,'hearts'),card(3,'hearts'),card(4),card(5),card(6),card(9),card(10),card(11),card(12),card(13)];s=applyTexas({...base,...initialTexas(2,1)},'next','human',()=>deck(cards));s=applyTexas(s,'allin:confirm','human');s=applyTexas(s,'call','persona');assert.equal(s.status,'finished');assert.equal(s.handNumber,1);assert.equal(Math.min(s.stacks[1],s.stacks[2]),0);
});
test('通常版の初期値は従来どおり、旧記録をお気軽版と誤認しない',()=>{
 assert.equal(initialBlackjack().targetChips,120);assert.equal(initialBlackjack().phase,'betting');assert.equal(initialDaifugo().roundLimit,3);assert.equal(initialTexas().handLimit,5);
 const old={...base,game:'blackjack',status:'finished',result:'win',chips:130,targetChips:120,rounds:[]};assert.equal(resultCardData(old).playStyle,'standard');assert.equal(resultCardData(old).chips,130);
});
