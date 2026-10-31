import test from 'node:test';import assert from 'node:assert/strict';
import {gameNotification} from '../lib/game-notification.mjs';import {gameOutcome} from '../lib/game-outcome.mjs';
import {initialWordscale,wordscaleView,wordscaleContext} from '../lib/wordscale.mjs';
const base={id:'actors',roomId:'example_room',version:1,humanColor:1,turn:2,status:'playing',result:'loss',lastMove:null};
const games=[
 {game:'reversi',board:[...Array(20).fill(1),...Array(44).fill(2)]},
 {game:'yacht',round:2,sheets:{1:{ones:3},2:{ones:6}}},
 {game:'hitblow',rulesConfig:{allowDuplicates:false},matchDecided:true,players:{1:{solvedAt:null},2:{solvedAt:3}}},
 {game:'connectfour',winningLine:[0,1,2,3]},
 {game:'texas',handNumber:1,handLimit:5,phase:'hand_over',stacks:{1:90,2:110},hands:[{winner:2,reason:'fold'}]},
 {game:'daifugo',roundNumber:3,roundLimit:3,phase:'round_over',hands:{1:['s3'],2:[]},rulesConfig:{binding:false,stairs:false},rounds:[{number:3,winner:2}]},
 {game:'mancala',rulesConfig:{capture:false,winCondition:'score'},cups:[0,0,0,0,0,0,3,0,0,0,0,0,0,21]},
 {game:'blackjack',round:5,roundLimit:5,phase:'round_over',chips:90,targetChips:120,playerHand:[],dealerHand:[],rounds:[{playerTotal:18,dealerTotal:20,net:-10}]},
 {game:'lastcard',rulesConfig:{playerCount:3,stacking:false},events:['あなたが赤3を出しました。','パートナーが青3を出しました。']}
];
test('全対戦ゲームのAI向け通知はユーザー／あなたで明示、内部の識別子は維持',()=>{
 for(const g of games){const s={...base,...g},n=gameNotification(s);assert.doesNotMatch(n,/ペルソナ|パートナー/,g.game);for(const status of ['win','loss','draw']){if(g.game==='daifugo'&&status==='draw')continue;const o=gameOutcome({...s,status:'finished',result:status});assert.doesNotMatch(o.message,/ペルソナ|パートナー/,g.game);assert.ok(['user','persona','draw'].includes(o.winner));if(status==='loss')assert.match(o.message,/あなた/,g.game);}}
 const df=gameNotification({...base,...games.find(g=>g.game==='daifugo')});assert.match(df,/ユーザー残り1枚／あなた0枚/);assert.match(df,/このラウンドはあなたの勝ち/);
 for(const humanColor of [1,2]){const r=gameNotification({...base,...games[0],humanColor,turn:3-humanColor});assert.match(r,/あなたの番/);assert.match(r,humanColor===1?/あなたは白/:/あなたは黒/);}
});
test('ことばのものさしはシステムの出来事だけAI視点へ、画面と本人の言葉は保持',()=>{
 const s={...base,...initialWordscale(false,'human'),mode:'nexus',delivery:{status:'idle'},conversation:[],topicReason:'あなたと相談して、パートナーとして選んだ',dialogue:[{role:'human',text:'あなたのたとえ、パートナーっぽいね'}],referenceClues:{human:'あなたの笑顔',persona:'パートナーの贈り物'}};
 for(const [event,expected] of [['あなたの札 30 を公開。パートナーの札 40 を自動公開しました。','ユーザーの札 30 を公開。あなたの札 40 を自動公開しました。'],['あなたの札Aを出してよいか相談中。','ユーザーの札Aを出してよいか相談中。'],['相手の札を公開せず、まだ相談したいと伝えています。','あなたの札を公開せず、まだ相談したいと伝えています。']]){s.event=event;const before=JSON.stringify(s),v=wordscaleView(s),c=wordscaleContext(s);assert.equal(v.event,event);assert.equal(c.event,expected);assert.doesNotMatch(c.event,/ペルソナ|パートナー|相手の札/);assert.equal(JSON.stringify(s),before);assert.deepEqual(c.dialogue,s.dialogue);assert.equal(c.topicReason,s.topicReason);assert.deepEqual(c.referenceClues,s.referenceClues);assert.match(c.rules,/あなたらしい口調/);assert.ok(c.cards.filter(x=>x.owner==='human').every(x=>!('value'in x)));}
});
test('自動通知の主語変更は一言・相談の原文を書き換えない',()=>{
 const words='あなたの手、すごいね。ずっとパートナーだよ。';const s={...base,...games[0],userNote:{version:1,text:words}};assert.ok(gameNotification(s).endsWith(words));
 const w={...base,...initialWordscale(true,'human'),lastMove:{action:'discuss'},dialogue:[{role:'human',text:words}]};assert.ok(gameNotification(w).endsWith(words));
});
