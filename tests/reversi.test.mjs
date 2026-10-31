import test from 'node:test';
import assert from 'node:assert/strict';
import {initialBoard,legalMoves,applyMove,flips,parseMove,coordinate,view} from '../lib/reversi.mjs';
const state=(board=initialBoard())=>({board,humanColor:1,turn:1,status:'playing',version:0});
test('初期盤面の合法手と座標',()=>{
 assert.deepEqual(legalMoves(initialBoard(),1).map(coordinate),['D3','C4','F5','E6']);
 assert.equal(parseMove('d3'),19);assert.throws(()=>parseMove('I1'));assert.throws(()=>parseMove(null));
});
test('合法手で石を返し、手番・版番号を進める。不正手では元の状態を変えない',()=>{
 const s=state(),after=applyMove(s,19,'human');assert.equal(after.board[27],1);assert.equal(after.turn,2);assert.equal(after.version,1);assert.deepEqual(view(after).counts,{black:4,white:1});assert.equal(s.board[27],2);
 assert.throws(()=>applyMove(s,0,'human'));assert.throws(()=>applyMove(s,19,'persona'));assert.throws(()=>applyMove(s,NaN,'human'));
});
test('行の端をまたいで挟まない',()=>{
 const b=Array(64).fill(0);b[7]=2;b[6]=1;assert.deepEqual(flips(b,8,1),[]);
});
test('全8方向で同時に石を返す',()=>{
 const b=Array(64).fill(0);for(const [dr,dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]){b[(3+dr)*8+3+dc]=2;b[(3+dr*2)*8+3+dc*2]=1;}
 assert.equal(flips(b,27,1).length,8);
});
test('空きマスが残っていても双方置けなければ終了する',()=>{
 const b=Array(64).fill(1);b[0]=0;b[1]=2;b[63]=0;
 const s=applyMove(state(b),0,'human');assert.equal(s.status,'finished');assert.equal(s.result,'win');assert.equal(s.board[63],0);
});
test('複数の実戦経路でパス・終局・石数の不変条件を確認する',()=>{
 let passSeen=false;
 for(let seed=1;seed<=40;seed++){
   let s=state(),n=seed;
   while(s.status==='playing'){
     const moves=legalMoves(s.board,s.turn);assert.ok(moves.length>0);const oldOccupied=s.board.filter(Boolean).length;
     n=(Math.imul(n,1664525)+1013904223)>>>0;
     s=applyMove(s,moves[n%moves.length],s.turn===s.humanColor?'human':'persona');
     assert.equal(s.board.filter(Boolean).length,oldOccupied+1);assert.ok(s.version<=60);
     if(s.passed){passSeen=true;assert.equal(legalMoves(s.board,3-s.turn).length,0);}
   }
   assert.equal(legalMoves(s.board,1).length,0);assert.equal(legalMoves(s.board,2).length,0);
 }
 assert.ok(passSeen);
});
