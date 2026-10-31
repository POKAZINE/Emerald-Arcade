import test from 'node:test';import assert from 'node:assert/strict';
import {initialIndian,applyIndian,indianView,indianContext,indianOptions,chooseIndianBotAction,indianHandResult,indianHandFacts} from '../lib/indian.mjs';
import {shuffledDeck} from '../lib/blackjack.mjs';import {expressionName,expressionEmoji} from '../public/persona-expression.js';import {resultCardData} from '../public/result-card-data.js';import {gameNotification} from '../lib/game-notification.mjs';import {gameOutcome} from '../lib/game-outcome.mjs';
const fresh=(quick=false,first=1)=>({id:'test',mode:'nexus',roomId:'example_room',personaName:'模擬相手',version:0,status:'playing',conversation:[],delivery:{status:'idle'},...initialIndian(quick,first)});
const ordered=(one,two)=>{const d=shuffledDeck(),pull=c=>d.splice(d.findIndex(x=>x.rank===c.rank&&x.suit===c.suit),1)[0];return [pull(one),pull(two),...d];};
const deck=(r1,r2)=>()=>ordered({rank:r1,suit:'spades'},{rank:r2,suit:'hearts'});
const act=(s,m)=>applyIndian(s,m,s.turn===1?'human':'persona');

test('段階別の見え方と通知：未配札・決着前の秘密・公開後の札と残額を混同しない',()=>{
 let s=fresh();assert.match(indianContext(s).instructions,/未配札/);assert.match(gameNotification(s),/未配札/);assert.equal(indianHandResult(s),null);
 s=applyIndian(s,'next','human',deck(3,9));const c=indianContext(s),notice=gameNotification(s);
 assert.match(c.card_visibility.opponent_card,/ユーザーの額.*あなたには最初から見える/);assert.match(c.card_visibility.own_card,/あなた自身の額.*あなた自身には見えず/);
 assert.equal(c.hand_result,null);assert.equal(indianHandFacts(s),'');assert.doesNotMatch(notice,/公開後に分かった自分の札/);assert.doesNotMatch(notice,/公開札|♠3|♥9/);assert.match(c.instructions,/本人が文章で伝えた場合だけ根拠/);assert.match(c.instructions,/口調・感情・からかい・自分自身の表情描写・予感は自由/);for(const t of [c.instructions,notice]){assert.match(t,/本当・誇張・嘘/);assert.match(t,/数値範囲/);assert.doesNotMatch(t,/直接的な強弱.*教えない|強弱は教えず/);}assert.match(c.instructions,/固定ルールは作らず/);assert.match(c.instructions,/決着前にブラフかどうか種明かししない/);
 s=act(s,'bet');s=act(s,'fold');const r=indianHandResult(s);assert.equal(r.winner,'user');assert.equal(r.folded,'persona');assert.deepEqual(r.net,{user:5,persona:-5});assert.deepEqual(r.stacks,{user:105,persona:95});assert.equal(r.leader,'user');
 const text=gameNotification(s);assert.match(text,/公開札：ユーザー♠3／あなた♥9/);assert.match(text,/あなたがフォールド/);assert.match(text,/ユーザー\+5枚／あなた-5枚/);assert.match(text,/ユーザー105枚／あなた95枚（ユーザーがリード）/);assert.doesNotMatch(text,/自分の札は分かりません|直接的な強弱は/);assert.match(text,/次はユーザーが開始/);
 assert.match(indianContext(s).instructions,/双方の札は公開済み/);assert.match(indianContext(s).instructions,/判断時は互いに自分の札を知らず/);assert.match(text,/本人が当時も知っていた前提で判断を評価しない/);assert.doesNotMatch(indianContext(s).instructions,/あなたには分からない/);
 r.cards.user.rank=13;assert.equal(s.hands[0].cards[1].rank,3);
 s=applyIndian(s,'next','human',deck(1,2));assert.equal(indianContext(s).hand_result,null);assert.deepEqual(indianContext(s).own_card,{hidden:true});assert.doesNotMatch(gameNotification(s),/公開札|♠A|♥2/);
});

test('公開結果は勝利数ではなく残額でリード判定、引き分けと最終ハンドも正確',()=>{
 let s=fresh(true);for(const [a,b]of [[8,8],[1,13]]){s=applyIndian(s,'next','human',deck(a,b));s=act(s,'check');s=act(s,'check');if(a===8){assert.equal(indianHandResult(s).leader,'draw');assert.match(indianHandFacts(s),/引き分け.*ユーザー\+0枚／あなた\+0枚.*同数/);}}
 assert.equal(s.status,'finished');assert.match(gameNotification(s),/公開札：ユーザー♠A／あなた♥K/);assert.doesNotMatch(gameNotification(s),/次はユーザーが開始|自分の札は分かりません/);
 s.hands.at(-1).stacksAfter={1:80,2:120};assert.equal(indianHandResult(s).leader,'persona');assert.match(indianHandFacts(s),/あなたがリード/);
});
test('1枚の数字勝負：A最強・同ランク折半・フォールドでも双方公開・参加料精算',()=>{
 for(const [a,b,w]of [[1,13,1],[2,3,2],[7,7,null]]){let s=applyIndian(fresh(),'next','human',deck(a,b));assert.equal(s.pot,10);s=act(s,'check');s=act(s,'check');assert.equal(s.hands[0].winner,w);assert.equal(s.stacks[1]+s.stacks[2],200);assert.equal(indianView(s).userCard.rank,a);assert.equal(indianContext(s).own_card.rank,b);}
 let s=applyIndian(fresh(),'next','human',deck(1,2));s=act(s,'bet');s=act(s,'fold');assert.equal(s.hands[0].winner,1);assert.equal(s.hands[0].reason,'fold');assert.deepEqual(s.stacks,{1:105,2:95});assert.equal(indianView(s).userCard.rank,1);
});
test('固定幅ベット・レイズ1回・両チェック以外は手番継続・不正操作は原本不変',()=>{
 let s=applyIndian(fresh(),'next','human',deck(3,12));s=act(s,'check');s=act(s,'bet');assert.equal(s.phase,'betting');s=act(s,'raise');assert.equal(s.raises,1);assert.equal(indianOptions(s).actions.includes('raise'),false);const old=structuredClone(s);assert.throws(()=>act(s,'raise'));assert.deepEqual(s,old);s=act(s,'call');assert.deepEqual(s.stacks,{1:75,2:125});assert.equal(s.hands[0].pot,50);assert.equal(s.version,5);
 assert.throws(()=>applyIndian(fresh(),'bet','human'));assert.throws(()=>applyIndian(fresh(),'next','persona'));assert.throws(()=>applyIndian(fresh(),'next','human',()=>[]));
});
test('残額不足と参加料不足・自動決着・早期終了でもチップ保存',()=>{
 let s=fresh();s.stacks={1:12,2:188};s=applyIndian(s,'next','human',deck(13,1));assert.equal(indianOptions(s).betCost,7);s=act(s,'bet');assert.equal(indianOptions(s).actions.includes('raise'),false);s=act(s,'call');assert.equal(s.status,'finished');assert.equal(s.stacks[1],0);assert.equal(s.stacks[2],200);
 s=fresh();s.stacks={1:3,2:197};s=applyIndian(s,'next','human',deck(8,8));assert.equal(s.ante,3);assert.equal(s.phase,'hand_over');assert.deepEqual(s.stacks,{1:3,2:197});assert.equal(s.status,'playing');
});
test('通常6／お試し2ハンド・先手交代・nextはユーザー専用・最終通知に次開始なし',()=>{
 for(const quick of [false,true]){let s=fresh(quick,2);const seats=[];while(s.status==='playing'){s=applyIndian(s,'next','human',deck(8,8));seats.push(s.firstSeat);s=act(s,'check');s=act(s,'check');}assert.equal(s.handNumber,quick?2:6);assert.equal(s.result,'draw');assert.deepEqual(seats,Array.from({length:s.handLimit},(_,i)=>i%2?1:2));assert.doesNotMatch(gameNotification(s),/次はユーザーが開始/);assert.match(gameOutcome(s).message,/引き分け/);}
});
test('情報隔離：ブラウザには自札なし、MCPにはAI自札なし、既知の過去だけ公開、共有は終了だけ',()=>{
 let s=applyIndian(fresh(),'next','human',deck(3,12));const v=indianView(s),c=indianContext(s);assert.deepEqual(v.userCard,{hidden:true});assert.equal(v.opponentCard.rank,12);assert.equal('cards'in v,false);assert.deepEqual(c.own_card,{hidden:true});assert.equal(c.opponent_card.rank,3);const mutated=structuredClone(s);mutated.cards[2]={rank:1,suit:'clubs'};assert.deepEqual(indianContext(mutated),c);mutated.cards[1]={rank:9,suit:'clubs'};assert.deepEqual(indianView(mutated).userCard,v.userCard);assert.throws(()=>resultCardData(v));
 s=act(s,'fold');const old=s.hands[0].cards;s=applyIndian(s,'next','human',deck(5,9));assert.deepEqual(indianContext(s).previous_hands[0].cards,old);assert.deepEqual(indianContext(s).own_card,{hidden:true});
 s=act(s,'fold');s.status='finished';s.result='loss';s.userNote={text:'秘密の一言'};s.conversation=[{text:'会話の秘密'}];const shared=JSON.stringify(resultCardData(indianView(s)));assert.doesNotMatch(shared,/秘密|roomId|expression/);assert.match(shared,/userCard/);
});
test('練習ボットは公開状態だけで合法手を選び、最長でも各ハンド4操作で決着',()=>{
 for(let i=0;i<80;i++){let s=fresh(true,i%2+1);while(s.status==='playing'){s=act(s,'next');let n=0;while(s.phase==='betting'){const c=indianContext(s);c.legal_actions=indianOptions(s);c.opponent_card=s.cards[3-s.turn];const m=chooseIndianBotAction(c);assert.ok(c.legal_actions.actions.includes(m));s=act(s,m);assert.equal(s.stacks[1]+s.stacks[2]+s.pot,200);assert.ok(++n<=4);}assert.ok(s.stacks[1]>=0&&s.stacks[2]>=0);}}
});
test('表情は既知名だけ：数値を無視・未知/欠落は非表示・直前から継承しない',()=>{
 assert.equal(expressionName({expression:'joy',arousal:1}), 'joy');assert.equal(expressionEmoji('joy').emoji,'😊');assert.equal(expressionName({reply:'【表情】…sadness…'}),'sadness');assert.equal(expressionName({expression:'<img onerror=x>'}),null);assert.equal(expressionName({}),null);assert.equal(expressionEmoji(null),null);assert.equal(expressionName({reply:'<persona_emotion category="joy" intensity="1.0"/>'}),null);assert.equal(expressionName({expression:'toString'}),null);
});
