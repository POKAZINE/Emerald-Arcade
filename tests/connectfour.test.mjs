import test from 'node:test';import assert from 'node:assert/strict';
import {initialConnectFour,applyConnectFour,connectFourLine,connectFourColumns,connectFourBotMove,connectFourContext} from '../lib/connectfour.mjs';
import {gameOutcome} from '../lib/game-outcome.mjs';import {gameNotification} from '../lib/game-notification.mjs';
const initial=humanColor=>({id:'cf-test',roomId:'example_room',mode:'nexus',humanColor,status:'playing',version:0,delivery:{status:'idle'},conversation:[],lastMove:null,...initialConnectFour()});
const play=(s,cols)=>cols.reduce((s,c)=>applyConnectFour(s,'drop:'+c,s.turn===s.humanColor?'human':'persona'),s);
test('落下は下から積み上がり、満杯・手番違反・不正な列は状態を変えない',()=>{
 const s=initial(1);assert.throws(()=>applyConnectFour(s,'drop:4','persona'),/手番/);
 for(const m of ['drop:0','drop:8','drop:1x','D3','drop:1.5',null,1.1])assert.throws(()=>applyConnectFour(s,m,'human'),/列/);
 const a=play(s,[4,4,4,4,4,4]);assert.deepEqual(s.board,Array(42).fill(0));assert.equal(a.board[38],1);assert.equal(a.board[3],2);assert.ok(!connectFourColumns(a.board).includes(4));assert.throws(()=>applyConnectFour(a,'drop:4','human'),/満杯/);assert.equal(a.version,6);
});
test('縦・横・両方向の斜めの勝利を着手時に判定し、終了後は置けない',()=>{
 for(const cols of [[1,2,1,2,1,2,1],[1,7,2,7,3,6,4],[1,2,2,3,4,3,3,4,5,4,4],[7,6,6,5,4,5,5,4,3,4,4]]){
  const s=play(initial(1),cols);assert.equal(s.status,'finished');assert.equal(s.result,'win');assert.ok(s.winningLine.length>=4);assert.equal(s.winningLine.every(i=>s.board[i]===1),true);assert.throws(()=>applyConnectFour(s,'drop:5','persona'),/終了/);
 }
 const loss=play(initial(2),[1,2,1,2,1,2,1]);assert.equal(loss.result,'loss');assert.equal(gameOutcome(loss).persona_result,'win');assert.match(gameNotification(loss),/あなた.*勝利/);
});
test('42マスがそろわず埋まれば引き分け。4個以上でも勝利',()=>{
 const board=['1122112','2211221','1122112','2211221','1122112','2211221'].join('').split('').map(Number);assert.ok(board.every((_,i)=>connectFourLine(board,i).length===0));board[0]=0;const s={...initial(1),board,moveCount:41};const end=applyConnectFour(s,1,'human');assert.equal(end.status,'finished');assert.equal(end.result,'draw');assert.equal(gameOutcome(end).winner,'draw');
 const five=Array(42).fill(0);for(let c=0;c<5;c++)five[35+c]=1;assert.equal(connectFourLine(five,37).length,5);
});
test('MCP用盤面は向き・合法列・版番号が明確。通知で自動入力と一言を区別する',()=>{
 const s=play(initial(1),[4]);s.userNote={text:'ここに置くね！',version:1};const c=connectFourContext(s);assert.equal(c.board.length,6);assert.equal(c.board[5],'0001000');assert.equal(c.persona_piece,2);assert.deepEqual(c.legal_columns,[1,2,3,4,5,6,7]);assert.match(c.instructions,/input_args/);const n=gameNotification(s);assert.match(n,/直接入力ではありません/);assert.match(n,/ユーザー本人の入力/);assert.match(n,/4列目/);
});
test('練習ボットは即勝利を選び、相手の縦のリーチを防ぐ',()=>{
 const threat=play(initial(1),[1,2,1,2,1]);assert.equal(connectFourBotMove(threat),'drop:1');const win=play(initial(2),[1,2,1,2,1,3]);assert.equal(connectFourBotMove(win),'drop:1');
});
test('旧対局の色は互換維持。後手ユーザーでも選択色を通知とMCPで同じ相手に対応させる',()=>{
 const old=initial(2),legacy=connectFourContext(old);assert.equal(legacy.piece_colors[1].color_name,'琥珀');assert.equal(legacy.piece_colors[2].color_name,'青緑');assert.equal(old.pieceColors,undefined);
 const custom={...old,pieceColors:{1:'pink',2:'purple'}},c=connectFourContext(custom);assert.equal(c.piece_colors[c.user_piece].color_name,'紫');assert.equal(c.piece_colors[c.persona_piece].color_name,'ピンク');assert.equal(c.piece_colors[1].symbol,'●');assert.equal(c.piece_colors[2].symbol,'◎');assert.match(gameNotification(custom),/ユーザーは紫 ◎、あなたはピンク ●/);assert.deepEqual(custom.board,old.board);assert.equal(custom.version,old.version);
});
