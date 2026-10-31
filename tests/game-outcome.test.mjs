import test from 'node:test';
import assert from 'node:assert/strict';
import {gameOutcome} from '../lib/game-outcome.mjs';
import {gameNotification} from '../lib/game-notification.mjs';
test('白黒・ユーザー・ペルソナの勝敗を取り違えず、終局通知へ明示する',()=>{
 const board=[...Array(20).fill(1),...Array(44).fill(2)];
 const s={id:'end',roomId:'example_room',status:'finished',board,humanColor:1,version:60};
 const result=gameOutcome(s);assert.deepEqual(result.counts,{black:20,white:44});assert.equal(result.winner,'persona');assert.equal(result.persona_result,'win');assert.match(gameNotification(s),/黒20枚・白44枚/);assert.match(gameNotification(s),/あなたの勝利/);
 assert.equal(gameOutcome({...s,humanColor:2}).winner,'user');
 assert.equal(gameOutcome({...s,board:[...Array(32).fill(1),...Array(32).fill(2)]}).winner,'draw');
 assert.equal(gameOutcome({...s,status:'playing'}),null);
});
