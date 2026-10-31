import test from 'node:test';import assert from 'node:assert/strict';
import {initialBlackjack,applyBlackjack,completePreparedDeal,blackjackActions,blackjackView,blackjackContext,blackjackPublicFacts,collectBlackjackNote} from '../lib/blackjack.mjs';
import {gameNotification} from '../lib/game-notification.mjs';import {resultCardData} from '../public/result-card-data.js';
const move=(s,m,actor='human')=>applyBlackjack(s,m,actor);
const deck=ranks=>()=>{const pool=['spades','hearts','diamonds','clubs'].flatMap(suit=>Array.from({length:13},(_,i)=>({rank:i+1,suit})));return [...ranks.map(rank=>pool.splice(pool.findIndex(c=>c.rank===rank),1)[0]),...pool];};
function dealt(ranks,bet=10,enabled=true){const s={id:'split-test',mode:'nexus',roomId:'example_room',personaName:'相手',status:'playing',version:0,delivery:{status:'idle'},conversation:[],...initialBlackjack(false,enabled)};return completePreparedDeal(applyBlackjack(s,'bet:'+bet,'human',deck(ranks)));}

test('スプリットは通常版ON・初手の同ランク・残額が足りる場合のみ。再分割なし',()=>{
 const yes=dealt([8,10,8,7,8,8],50);assert.ok(blackjackActions(yes).includes('split'));
 const split=move(yes,'split');assert.equal(split.bet,100);assert.equal(split.chips,0);assert.equal(split.status,'playing');assert.equal(split.playerHands.length,2);assert.ok(!blackjackActions(split).includes('split'));assert.ok(!blackjackActions(split).includes('double'));
 for(const s of [dealt([8,10,8,7],10,false),dealt([10,9,13,7]),dealt([8,10,8,7],60),move(dealt([8,10,8,7,2]),'hit')]){assert.ok(!blackjackActions(s).includes('split'));assert.throws(()=>move(s,'split'));}
 assert.equal(initialBlackjack(true,true).splitEnabled,false);
 const legacy=dealt([8,10,8,7]);delete legacy.splitEnabled;assert.ok(!blackjackActions(legacy).includes('split'));
});

test('片方がバストしても残りの組を続行し、共通ディーラーで2組を1回精算',()=>{
 let s=move(dealt([8,10,8,7,10,10,10]),'split');assert.equal(s.playerHands[0].cards.length,2);s=move(s,'hit');assert.equal(s.activeHand,1);assert.equal(s.phase,'player');assert.equal(s.turn,1);assert.equal(s.playerHands[0].state,'bust');assert.equal(s.rounds.length,0);
 s=move(s,'stand');assert.equal(s.phase,'dealer');s=move(s,'stand','persona');const r=s.rounds[0];assert.equal(s.rounds.length,1);assert.equal(r.split,true);assert.deepEqual(r.hands.map(h=>h.outcome),['loss','win']);assert.equal(r.net,0);assert.equal(r.outcome,'draw');assert.equal(s.chips,100);assert.equal(r.bet,20);assert.equal(r.payout,20);
 const next=move(s,'next');assert.equal(next.playerHands,undefined);assert.equal(next.activeHand,undefined);assert.equal(next.round,2);assert.equal(next.splitEnabled,true);
});

test('各組の初回にダブル可能、現在の組の賭け金を使い残額を共有',()=>{
 let s=move(dealt([5,10,5,7,6,6,10,9],20),'split');assert.equal(s.bet,40);s=move(s,'double');assert.equal(s.bet,60);assert.equal(s.chips,40);assert.equal(s.playerHands[0].bet,40);assert.equal(s.playerHands[0].doubled,true);assert.equal(s.activeHand,1);assert.ok(blackjackActions(s).includes('double'));s=move(s,'double');assert.equal(s.phase,'dealer');assert.equal(s.bet,80);assert.equal(s.chips,20);s=move(s,'stand','persona');assert.equal(s.chips,180);assert.equal(s.rounds[0].net,80);assert.deepEqual(s.rounds[0].hands.map(h=>h.bet),[40,40]);
 let hit=move(dealt([5,10,5,7,2,2,2]),'split');hit=move(hit,'hit');assert.ok(!blackjackActions(hit).includes('double'));
});

test('Aの分割は各1枚で終了。分割後2枚の21も割増なし',()=>{
 let s=move(dealt([1,10,1,7,13,9],20),'split');assert.equal(s.phase,'dealer');assert.equal(s.turn,2);assert.deepEqual(s.playerHands.map(h=>h.cards.length),[2,2]);assert.ok(blackjackView(s).playerHands.every(h=>!h.value.blackjack));s=move(s,'stand','persona');assert.equal(s.chips,140);assert.deepEqual(s.rounds[0].hands.map(h=>h.payout),[40,40]);assert.deepEqual(s.rounds[0].hands.map(h=>h.reason),['compare','compare']);
});

test('全組バストはディーラー操作なしで即精算。21の組は自動で操作終了',()=>{
 let s=move(dealt([10,10,10,7,6,6,10,9],50),'split');s=move(s,'hit');assert.equal(s.status,'playing');s=move(s,'hit');assert.equal(s.phase,'round_over');assert.equal(s.turn,1);assert.equal(s.chips,0);assert.equal(s.status,'finished');assert.deepEqual(s.rounds[0].hands.map(h=>h.reason),['player_bust','player_bust']);
 s=move(dealt([10,9,10,7,1,3]),'split');assert.equal(s.activeHand,1);assert.equal(s.playerHands[0].state,'stood');assert.equal(s.playerHands[1].state,'playing');
});

test('分割中の復元・履歴・公開投影で両組を保持し、伏せ札と山札は秘匿',()=>{
 const s=move(dealt([8,10,8,7,2,3,4]),'split'),before=structuredClone(s),restored=JSON.parse(JSON.stringify(s));const a=move(s,'hit'),b=move(restored,'hit');assert.deepEqual(a.playerHands,b.playerHands);assert.deepEqual(a.deck,b.deck);assert.deepEqual(s,before);
 for(const v of [blackjackView(s),blackjackContext(s)]){assert.equal('deck'in v,false);assert.equal('dealerHand'in v,false);assert.equal('playerHand'in v,false);}
 const context=blackjackContext(s);assert.equal(context.player_hands.length,2);assert.deepEqual(context.dealer_cards,[s.dealerHand[0],{hidden:true}]);assert.equal(context.dealer_value,null);assert.deepEqual(context.legal_actions,[]);assert.match(blackjackPublicFacts(s),/手札1/);assert.match(blackjackPublicFacts(s),/手札2/);assert.match(blackjackPublicFacts(s),/伏せ札/);assert.ok(!blackjackPublicFacts(s).includes('♠7'));
});

test('一言は両組の操作終了までまとめ、終局・記録・共有画像にも両組の結果を載せる',()=>{
 let s=collectBlackjackNote(dealt([8,10,8,7,2,3]),'配札時');s=collectBlackjackNote(move(s,'split'),'分けてみる');s=collectBlackjackNote(move(s,'stand'),'一組目はここまで');assert.equal(s.phase,'player');assert.equal(s.userNote.text,'');s=collectBlackjackNote(move(s,'stand'),'二組目も止める');assert.match(s.userNote.text,/分けてみる\n一組目/);assert.equal(blackjackContext(s).player_hands.length,2);assert.match(gameNotification(s),/手札2/);assert.match(gameNotification(s),/二組目も止める/);
 s.round=5;s=move(s,'stand','persona');assert.equal(s.status,'finished');assert.equal(s.rounds[0].split,true);assert.ok(!gameNotification(s).includes('ユーザーnull'));const data=resultCardData(blackjackView(s));assert.equal(data.rounds[0].hands.length,2);assert.deepEqual(data.rounds[0].hands.map(h=>h.net),s.rounds[0].hands.map(h=>h.net));assert.equal('dealerHand'in data,false);assert.equal('deck'in data,false);
});
