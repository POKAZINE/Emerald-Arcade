import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeArguments,requireArguments} from '../lib/mcp-arguments.mjs';
test('通常MCP引数とNexusArkのinput_argsラッパーを両方受け付ける',()=>{
 const values={session_id:'session-1',room_id:'example_room',expected_version:0,move:'D3'};
 assert.deepEqual(normalizeArguments(values),values);
 assert.deepEqual(normalizeArguments({input_args:values}),values);
 assert.deepEqual(normalizeArguments({kwargs:values}),values);
 assert.deepEqual(normalizeArguments({input_args:values,room_name:'example_room'}),{...values,room_name:'example_room'});
 assert.doesNotThrow(()=>requireArguments(values,['expected_version']));
});
test('中継で落ちた引数を対局不存在と誤診せず、渡し方を案内する',()=>{
 assert.throws(()=>requireArguments({},['session_id','room_id']),/input_args/);
 assert.throws(()=>normalizeArguments({input_args:'invalid'}),/辞書/);
 assert.throws(()=>normalizeArguments({room_id:'other',input_args:{room_id:'example_room'}}),/異なります/);
 assert.throws(()=>normalizeArguments({input_args:{kwargs:{room_id:'example_room'}}}),/深すぎます/);
});
