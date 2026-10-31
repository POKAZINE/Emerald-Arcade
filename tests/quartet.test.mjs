import test from 'node:test';import assert from 'node:assert/strict';
import {QUARTET_PIECES,quartetLabel} from '../public/quartet-pieces.js';
import {initialQuartet,applyQuartet,quartetWins,quartetContext,quartetView,quartetBotMove} from '../lib/quartet.mjs';
import {personaActionRequired,withMcpProgress} from '../lib/mcp-progress.mjs';
import {gameNotification} from '../lib/game-notification.mjs';import {gameOutcome} from '../lib/game-outcome.mjs';import {resultCardData} from '../public/result-card-data.js';
const create=(first='user')=>({id:'quartet-test',mode:'nexus',roomId:'example_room',personaName:'模擬相手',status:'playing',version:0,createdAt:'2026-10-29T00:00:00Z',delivery:{status:'idle'},conversation:[],...initialQuartet(first)});
const move=(s,m)=>applyQuartet(s,m,s.turn===1?'human':'persona');
test('四重奏：16種類は4つの二値特徴の全組み合わせ。明暗は所有者ではない',()=>{
 assert.equal(QUARTET_PIECES.length,16);assert.equal(new Set(QUARTET_PIECES.map(p=>quartetLabel(p.id))).size,16);
 for(const key of ['tone','shape','hole','pattern']){const counts={};for(const p of QUARTET_PIECES)counts[p[key]]=(counts[p[key]]||0)+1;assert.deepEqual(Object.values(counts),[8,8]);}
 assert.equal(create('user').turn,1);assert.equal(create('persona').turn,2);assert.throws(()=>initialQuartet('invalid'));assert.equal(create().board.length,16);
});
test('四重奏：最初に渡す人と配置者は別。配置後は同じ人が相手へ渡す',()=>{
 let s=create();const original=JSON.stringify(s);s=move(s,{action:'give',piece_id:'q00'});assert.equal(JSON.stringify(create()),original);assert.equal(s.turn,2);assert.equal(s.phase,'place');assert.equal(s.remaining.includes('q00'),false);
 assert.throws(()=>applyQuartet(s,{action:'place',cell:'A1'},'human'));assert.throws(()=>move(s,{action:'place',cell:'A1',piece_id:'q01'}));
 s=move(s,{action:'place',cell:'A1'});assert.equal(s.board[0],'q00');assert.equal(s.turn,2);assert.equal(s.phase,'give');assert.equal(personaActionRequired(s),true);assert.match(withMcpProgress(s,quartetContext(s)).next_step,/続け/);
 assert.throws(()=>move(s,{action:'give',piece_id:'q00'}));s=move(s,{action:'give',piece_id:'q01'});assert.equal(s.turn,1);
 assert.throws(()=>move(s,{action:'place',cell:'A1'}));assert.throws(()=>move(s,{action:'place',cell:'E1'}));assert.throws(()=>move(s,{action:'place',cell:false}));
 assert.equal(s.version,3);assert.equal(s.events.length,3);assert.equal(quartetView(s).held.pieceId,'q01');
});
test('四重奏：縦横と2本の対角線、8種類の共通点。2×2や3駒では未成立',()=>{
 const lines=[...[0,1,2,3].map(r=>[0,1,2,3].map(c=>r*4+c)),...[0,1,2,3].map(c=>[0,1,2,3].map(r=>r*4+c)),[0,5,10,15],[3,6,9,12]];
 for(const cells of lines){const board=Array(16).fill(null);['q00','q01','q04','q09'].forEach((id,n)=>board[cells[n]]=id);assert.ok(quartetWins(board).some(g=>g.cells.join()===cells.join()&&g.attributes.some(a=>a.value==='round')));board[cells[3]]=null;assert.equal(quartetWins(board).length,0);}
 for(const key of ['tone','shape','hole','pattern'])for(const value of new Set(QUARTET_PIECES.map(p=>p[key]))){const pieces=QUARTET_PIECES.filter(p=>p[key]===value).slice(0,4),board=Array(16).fill(null);pieces.forEach((p,i)=>board[i]=p.id);assert.ok(quartetWins(board)[0].attributes.some(a=>a.key===key&&a.value===value));}
 const square=Array(16).fill(null);[0,1,4,5].forEach((i,n)=>square[i]=['q00','q01','q04','q09'][n]);assert.equal(quartetWins(square).length,0);
});
test('四重奏：成立した配置者が即勝利。次の駒は渡さず、確定した共通点を通知・共有する',()=>{
 let s=create();for(const [n,id]of ['q00','q01','q04','q05'].entries()){s=move(s,{action:'give',piece_id:id});s=move(s,{action:'place',cell:['A1','B1','C1','D1'][n]});}
 assert.equal(s.result,'win');assert.equal(s.status,'finished');assert.equal(s.moveCount,4);assert.equal(s.winner,1);assert.equal(s.phase,'finished');assert.ok(s.winningGroups[0].attributes.some(a=>a.value==='round'));assert.throws(()=>move(s,{action:'give',piece_id:'q02'}));assert.equal(personaActionRequired(s),false);
 assert.match(gameOutcome(s).message,/ユーザーの勝利/);assert.match(gameNotification(s),/操作は不要/);assert.doesNotMatch(gameNotification(s),/gameapps_play_move/);
 const d=resultCardData(s);assert.equal(d.name,'しるしの四重奏');assert.equal(d.moves,4);assert.equal(d.winningCells.length,4);assert.ok(d.commonLabels.includes('丸'));assert.equal('roomId'in d,false);assert.equal('conversation'in d,false);d.board[0]=null;assert.equal(s.board[0],'q00');
});
test('四重奏：ボット同士でも保存形式を保ち、最大32操作で決着する',()=>{
 for(const first of ['user','persona']){let s=create(first);while(s.status==='playing'){const old=structuredClone(s);s=move(s,quartetBotMove(s));assert.equal(s.remaining.length+s.board.filter(Boolean).length+(s.held?1:0),16);assert.equal(new Set([...s.remaining,...s.board.filter(Boolean),...(s.held?[s.held.pieceId]:[])]).size,16);assert.ok(s.version<=32);assert.equal(old.version,s.version-1);}
 assert.ok(s.moveCount<=16);assert.ok(s.winningGroups.length||s.result==='draw');assert.equal(s.events.length,s.version);}
});
test('四重奏：満杯でも共通点のある列がなければ引き分け',()=>{
 let seed=12345,board;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 for(let n=0;n<10000;n++){const b=QUARTET_PIECES.map(p=>p.id);for(let i=15;i>0;i--){const j=Math.floor(random()*(i+1));[b[i],b[j]]=[b[j],b[i]];}if(!quartetWins(b).length){board=b;break;}}assert.ok(board);
 const id=board[15];board[15]=null;let s={...create(),board,remaining:[],held:{pieceId:id,from:2,to:1},turn:1,phase:'place',moveCount:15};s=move(s,{action:'place',cell:'D4'});assert.equal(s.result,'draw');assert.equal(s.winningGroups.length,0);assert.equal(s.moveCount,16);
});
