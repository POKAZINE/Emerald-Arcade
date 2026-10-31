import test from 'node:test';import assert from 'node:assert/strict';import {resultCardData} from '../public/result-card-data.js';
const base=game=>({game,status:'finished',result:'win',mode:'nexus',humanColor:1,personaName:'PRIVATE_PERSONA',id:'PRIVATE_ID',roomId:'PRIVATE_ROOM',nexusUrl:'PRIVATE_URL',conversation:[{text:'PRIVATE_CHAT'}],delivery:{requestMessage:'PRIVATE_REQUEST'},userNote:{text:'PRIVATE_NOTE'}});
test('共有画像の入力は公開結果だけに限定し、名前・アプリ名は明示選択した場合だけ含める',()=>{
 const s={...base('connectfour'),board:Array(42).fill(0),winningLine:[35,36,37,38],pieceColors:{1:'purple',2:'pink'},moveCount:7};s.board[35]=1;
 const d=resultCardData(s,{appTitle:'PRIVATE_APP'});assert.ok(!JSON.stringify(d).includes('PRIVATE_'));assert.equal(d.colors[1],'purple');assert.equal(d.opponent,'パートナー');d.board[35]=2;assert.equal(s.board[35],1);
 const visible=resultCardData(s,{showOpponent:true,showApp:true,appTitle:'変更後のアプリ名'});assert.equal(visible.opponent,'PRIVATE_PERSONA');assert.equal(visible.appTitle,'Emerald Arcade');assert.ok(!JSON.stringify(visible).includes('PRIVATE_ROOM'));assert.equal(resultCardData(s,{showApp:true,appTitle:'別の仮称'}).appTitle,'Emerald Arcade');
 for(const status of ['playing','abandoned'])assert.throws(()=>resultCardData({...s,status}),/終了/);
});
test('リバーシ・ヨットは自分の席に合わせて結果を集計する',()=>{
 const reversi=resultCardData({...base('reversi'),humanColor:2,board:[...Array(40).fill(2),...Array(24).fill(1)]});assert.equal(reversi.counts[2],40);assert.equal(reversi.userPiece,2);
 const sheet={ones:3,twos:6,threes:9,fours:12,fives:15,sixes:18,choice:25};const yacht=resultCardData({...base('yacht'),humanColor:2,sheets:{1:{ones:1},2:sheet}});assert.equal(yacht.totals.user.bonus,35);assert.equal(yacht.totals.user.total,123);assert.equal(yacht.totals.opponent.total,1);
});
test('ブラックジャックは結果のチップとラウンド成績だけを使い、山札・手札は取り込まない',()=>{
 const d=resultCardData({...base('blackjack'),chips:120,targetChips:120,deck:['PRIVATE_DECK'],playerHand:['PRIVATE_HAND'],rounds:[{round:1,bet:10,net:20,chipsAfter:120,playerCards:['PRIVATE_CARDS']}]});assert.equal(d.chips,120);assert.equal(d.rounds[0].chips,120);assert.ok(!JSON.stringify(d).includes('PRIVATE_'));
});
test('ヒット＆ブローは公開回答と判定のみ。勝敗確定後でも挑戦中は共有できない',()=>{
 const p={solvedAt:3,state:'solved',guesses:[{code:['red','red','blue','blue'],hits:1,blows:1,at:'PRIVATE_TIMESTAMP'}]},s={...base('hitblow'),rulesConfig:{allowDuplicates:true},players:{1:p,2:{...p,state:'stopped',solvedAt:null}},answers:{1:['red','blue','green','white'],2:['purple','blue','white','yellow']},secrets:{1:['PRIVATE_SECRET']},matchDecided:true};
 const d=resultCardData(s);assert.equal(d.sameColors,true);assert.deepEqual(d.players[0].answer,s.answers[1]);assert.ok(!JSON.stringify(d).includes('PRIVATE_'));assert.throws(()=>resultCardData({...s,status:'playing'}),/終了/);
});
test('テキサスの共有はチップと公開結果だけで、フォールドの手札や役は取り込まない',()=>{
 const s={...base('texas'),stacks:{1:110,2:90},handLimit:5,community:[{rank:1,suit:'spades',private:'PRIVATE_EXTRA'}],holeCards:{2:'PRIVATE_HAND'},deck:'PRIVATE_DECK',hands:[{number:1,reason:'fold',winner:1,net:{1:10,2:-10},stacksAfter:{1:110,2:90},cards:'PRIVATE_CARDS',scores:{1:{label:'PRIVATE_RANK'},2:{label:'PRIVATE_RANK'}}}]};
 const d=resultCardData(s);assert.equal(d.stacks.user,110);assert.equal(d.hands[0].userRank,null);assert.equal(d.hands[0].opponentRank,null);assert.ok(!JSON.stringify(d).includes('PRIVATE_'));assert.deepEqual(d.community,[{rank:1,suit:'spades'}]);
});
