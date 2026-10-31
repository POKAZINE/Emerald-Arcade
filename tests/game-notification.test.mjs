import test from 'node:test';
import assert from 'node:assert/strict';
import {gameNotification,commentaryInstruction} from '../lib/game-notification.mjs';
const base={id:'session-1',roomId:'example_room',version:11,humanColor:1,turn:2,status:'playing',board:Array(64).fill(1),lastMove:{actor:'human',coordinate:'A4'}};
test('任意の一言は本人入力と明示し、後の手番に繰り返し添えない',()=>{
 const s={...base,userNote:{version:11,text:'この一手、どうかな？'}};
 assert.match(gameNotification(s),/【ユーザー本人の入力／Emerald Arcadeの一言欄】\nこの一手、どうかな？/);
 assert.doesNotMatch(gameNotification({...s,version:12}),/この一手、どうかな/);
 assert.match(gameNotification({...s,status:'finished'}),/この一手、どうかな/);
});
test('自動通知を直接入力と明確に区別し、毎手の盤面JSONは送らない',()=>{
 const text=gameNotification(base);
 assert.ok(text.startsWith('【Emerald Arcade自動通知／本人の直接入力ではありません】'));
 assert.match(text,/ユーザーがリバーシでA4に着手/);assert.match(text,/あなたの番/);
 assert.match(text,/session-1/);assert.match(text,/版番号: 11/);
 assert.match(text,/gameapps_get_state/);assert.match(text,/input_args/);
 assert.doesNotMatch(text,/"board"|"legal_moves"|"rules"/);
});
test('開始・パス・終局で手番や操作主体を取り違えない',()=>{
 assert.match(gameNotification({...base,lastMove:null}),/あなたは白（後手）/);
 const pass=gameNotification({...base,turn:1,passed:2});assert.match(pass,/ユーザーの番です/);assert.match(pass,/自動でパス/);
 const end=gameNotification({...base,status:'finished',lastMove:{actor:'persona',coordinate:'H8'}});assert.match(end,/対局が終了/);assert.doesNotMatch(end,/あなたの番|gameapps_get_state/);
});
test('着手の理由と相手の手への感想は、テスト設定をONにした相手の手番だけ依頼する',()=>{
 assert.equal(commentaryInstruction(base),'');
 const text=gameNotification({...base,testCommentary:true});assert.match(text,/そのマスを選んだ理由/);assert.match(text,/ユーザーの直前の手への感想/);assert.match(text,/無理に作らず/);
 assert.doesNotMatch(gameNotification({...base,testCommentary:false}),/一手のひとこと/);
 assert.doesNotMatch(gameNotification({...base,testCommentary:true,turn:1}),/一手のひとこと/);
 assert.doesNotMatch(gameNotification({...base,testCommentary:true,status:'finished'}),/一手のひとこと/);
});
