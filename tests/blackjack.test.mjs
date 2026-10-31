import test from 'node:test';
import assert from 'node:assert/strict';
import {initialBlackjack,applyBlackjack,handValue,shuffledDeck,blackjackView,blackjackContext,blackjackActions,completePreparedDeal,blackjackPublicFacts,collectBlackjackNote} from '../lib/blackjack.mjs';
import {gameOutcome} from '../lib/game-outcome.mjs';
import {gameNotification} from '../lib/game-notification.mjs';
const state=()=>({id:'bj-test',mode:'nexus',roomId:'example_room',personaName:'AI',status:'playing',version:0,delivery:{status:'idle'},conversation:[],...initialBlackjack()});
const deckWith=ranks=>()=>{const pool=['spades','hearts','diamonds','clubs'].flatMap(suit=>Array.from({length:13},(_,i)=>({rank:i+1,suit})));const top=ranks.map(rank=>{const i=pool.findIndex(c=>c.rank===rank);assert.ok(i>=0);return pool.splice(i,1)[0];});return [...top,...pool];};
const dealt=(ranks,bet=10)=>applyBlackjack(applyBlackjack(state(),'bet:'+bet,'human',deckWith(ranks)),'deal','persona');

test('Aの点数、52枚の重複なしシャッフル、初期2枚だけのブラックジャック',()=>{
 const deck=shuffledDeck();assert.equal(deck.length,52);assert.equal(new Set(deck.map(c=>c.rank+c.suit)).size,52);
 const hand=ranks=>handValue(ranks.map(rank=>({rank,suit:'spades'})));
 assert.deepEqual(hand([1,6]),{total:17,soft:true,blackjack:false,bust:false});assert.equal(hand([1,1,9]).total,21);assert.equal(hand([1,6,10]).total,17);
 assert.equal(hand([1,13]).blackjack,true);assert.equal(hand([5,6,10]).blackjack,false);
});
test('最低ベット、残額オールイン、ダブルダウンの残高と初手制限を検証',()=>{
 assert.throws(()=>applyBlackjack(state(),'bet:9','human'));assert.throws(()=>applyBlackjack(state(),'bet:101','human'));
 assert.equal(applyBlackjack({...state(),chips:9},'bet:9','human').chips,0);
 let s=dealt([5,10,6,7,10],20);s=applyBlackjack(s,'double','human');assert.equal(s.bet,40);assert.equal(s.chips,60);assert.equal(s.playerHand.length,3);assert.equal(s.phase,'dealer');assert.throws(()=>applyBlackjack(s,'hit','human'));
 s=applyBlackjack(s,'stand','persona');assert.equal(s.chips,140);assert.equal(s.rounds[0].net,40);
 assert.ok(!blackjackActions(dealt([5,10,6,7],100)).includes('double'));
 s=applyBlackjack(dealt([2,10,3,7,4]),'hit','human');assert.ok(!blackjackActions(s).includes('double'));
 assert.throws(()=>applyBlackjack(state(),'bet:10','human',()=>Array(52).fill({rank:1,suit:'hearts'})));
});
test('通常配当・端数切り捨て・双方BJ・先にバスト・破産を正しく扱う',()=>{
 let s=dealt([1,9,13,7],11);assert.equal(s.phase,'round_over');assert.equal(s.chips,116);assert.equal(s.rounds[0].payout,27);
 s=dealt([1,1,10,13],100);assert.equal(s.chips,100);assert.equal(s.rounds[0].outcome,'draw');
 s=dealt([10,1,7,13],100);assert.equal(s.status,'finished');assert.equal(s.result,'loss');assert.equal(s.chips,0);
 s=applyBlackjack(dealt([10,10,8,6,10]),'hit','human');assert.equal(s.rounds[0].reason,'player_bust');assert.equal(s.chips,90);
});
test('ディーラーは17でもヒットでき、1枚ずつ確定。21超えは自動決着',()=>{
 let s=applyBlackjack(dealt([10,10,9,7,2,5]),'stand','human');assert.equal(s.phase,'dealer');
 s=applyBlackjack(s,'hit','persona');assert.equal(s.dealerHand.length,3);assert.equal(s.phase,'dealer');assert.equal(handValue(s.dealerHand).total,19);
 s=applyBlackjack(s,'hit','persona');assert.equal(s.phase,'round_over');assert.equal(s.rounds[0].reason,'dealer_bust');assert.equal(s.chips,110);
});
test('伏せ札・山札をHTTPとMCP用の投影から排除し、保存復元しても同じ札から続ける',()=>{
 const before=applyBlackjack(state(),'bet:10','human',deckWith([10,9,8,7,2]));const original=structuredClone(before);
 assert.deepEqual(blackjackView(before).dealerCards,[]);assert.deepEqual(blackjackView(before).playerCards,[]);
 const s=applyBlackjack(before,'deal','persona'),view=blackjackView(s),context=blackjackContext(s);
 assert.deepEqual(view.dealerCards,[s.dealerHand[0],{hidden:true}]);assert.equal(view.dealerValue,null);assert.equal(context.dealer_value,null);
 for(const obj of [view,context])for(const key of ['deck','dealerHand','playerHand'])assert.equal(key in obj,false);
 assert.deepEqual(before,original);
 const restored=JSON.parse(JSON.stringify(s));const a=applyBlackjack(s,'hit','human'),b=applyBlackjack(restored,'hit','human');assert.deepEqual(a.playerHand,b.playerHand);assert.deepEqual(a.deck,b.deck);
 const revealed=blackjackView(applyBlackjack(s,'stand','human'));assert.deepEqual(revealed.dealerCards,s.dealerHand);
});
test('最大5ラウンドの総合勝敗、終了通知、引き分け判定',()=>{
 let s=state();
 for(let round=1;round<=5;round++){
  s=applyBlackjack(s,'bet:10','human',deckWith([10,10,10,8]));s=applyBlackjack(s,'deal','persona');s=applyBlackjack(s,'stand','human');s=applyBlackjack(s,'stand','persona');
  if(round<5)s=applyBlackjack(s,'next','human');
 }
 assert.equal(s.status,'finished');assert.equal(s.chips,150);assert.equal(s.result,'win');assert.equal(s.rounds.length,5);assert.throws(()=>applyBlackjack(s,'next','human'));
 assert.equal(gameOutcome(s).winner,'user');assert.match(gameNotification(s),/ユーザーの勝利/);
 const tie={...s,chips:100,result:'draw'};assert.equal(gameOutcome(tie).winner,'draw');
});

test('初期配札はモデルによらず保存済みカードを確定し、再実行で配り直さない',()=>{
 const pending=applyBlackjack(state(),'bet:30','human',deckWith([10,9,8,7]));pending.userNote={text:'よろしく',version:pending.version};
 const original=structuredClone(pending),s=completePreparedDeal(pending);
 assert.equal(s.phase,'player');assert.equal(s.version,2);assert.equal(s.chips,70);assert.equal(s.bet,30);
 assert.deepEqual(s.playerHand,pending.playerHand);assert.deepEqual(s.dealerHand,pending.dealerHand);assert.deepEqual(s.deck,pending.deck);assert.deepEqual(pending,original);
 assert.equal(s.lastMove.actor,'system');assert.equal(s.userNote.version,2);assert.equal(completePreparedDeal(s),s);
 const facts=blackjackPublicFacts(s);assert.match(facts,/♠10・♠8/);assert.match(facts,/♠9・伏せ札/);assert.ok(!facts.includes('♠7'));assert.match(gameNotification(s),/よろしく/);
});

test('120枚ちょうどが総合勝利、119枚以下は敗北。途中到達では終わらない',()=>{
 for(const chips of [100,119,120,121]){
  let s={...dealt([10,10,9,8]),round:5,chips:chips-20};s=applyBlackjack(s,'stand','human');s=applyBlackjack(s,'stand','persona');
  assert.equal(s.chips,chips);assert.equal(s.result,chips>=120?'win':'loss');assert.equal(gameOutcome(s).target_chips,120);
 }
 let early=dealt([10,10,9,8]);early.chips=110;early=applyBlackjack(applyBlackjack(early,'stand','human'),'stand','persona');assert.equal(early.chips,130);assert.equal(early.status,'playing');
});
test('ベット・ヒットの一言は手番終了まで保存し、即決着時も一度だけまとめる',()=>{
 let s=collectBlackjackNote(dealt([2,10,3,8,4]),'ベット時');assert.deepEqual(s.pendingUserNotes,['ベット時']);assert.equal(s.userNote.text,'');
 s=collectBlackjackNote(applyBlackjack(s,'hit','human'),'ヒット時');assert.equal(s.phase,'player');assert.deepEqual(s.pendingUserNotes,['ベット時','ヒット時']);
 s=collectBlackjackNote(applyBlackjack(s,'stand','human'),'スタンド時');assert.equal(s.userNote.text,'ベット時\nヒット時\nスタンド時');assert.deepEqual(s.pendingUserNotes,[]);assert.match(gameNotification(s),/ベット時\nヒット時\nスタンド時/);
 const natural=collectBlackjackNote(dealt([1,9,13,7]),'即決着');assert.equal(natural.phase,'round_over');assert.equal(natural.userNote.text,'即決着');assert.deepEqual(natural.pendingUserNotes,[]);
 s=collectBlackjackNote(applyBlackjack(applyBlackjack(s,'stand','persona'),'next','human'));assert.equal(s.userNote.text,'');assert.deepEqual(s.pendingUserNotes,[]);
});
