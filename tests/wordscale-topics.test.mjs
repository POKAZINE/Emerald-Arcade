import test from 'node:test';
import assert from 'node:assert/strict';
import {scaleTopics,createWordscaleTopicOptions,wordscaleTopicChoices} from '../lib/wordscale-topics.mjs';
import {initialWordscale,applyWordscale,wordscaleView,wordscaleContext,wordscaleBotMove} from '../lib/wordscale.mjs';

test('30のお題に尺度と5段階の独自練習例があり、全範囲で使える',()=>{
 assert.equal(scaleTopics.length,30);assert.equal(new Set(scaleTopics.map(t=>t.id)).size,30);assert.equal(new Set(scaleTopics.map(t=>t.title)).size,30);
 for(const topic of scaleTopics){
  for(const key of ['id','category','title','low','high'])assert.ok(topic[key]?.trim());
  assert.notEqual(topic.low,topic.high);assert.equal(topic.examples.length,5);assert.equal(new Set(topic.examples).size,5);
  assert.ok(topic.examples.every(e=>e.trim()&&e.length<=120));
  for(const value of [1,20,21,40,41,60,61,80,81,100]){
   const s={status:'playing',version:0,...initialWordscale(false,'human'),stage:3,reference:value,topic,phase:'clues',turn:2};
   const response=JSON.parse(wordscaleBotMove(s)),example=topic.examples[Math.floor((value-1)/20)];
   assert.equal(response.reference_clue,example);
   for(const c of s.cards.filter(c=>c.owner==='persona'))assert.equal(response.clues[c.id],topic.examples[Math.floor((c.value-1)/20)]);
   assert.doesNotThrow(()=>applyWordscale(s,response,'persona'));
  }
 }
});

test('新規対局の三択は3系統を混ぜ、保存・再読込しても固定、候補もステージ間で重複しない',()=>{
 const offered=new Set();
 for(let n=0;n<100;n++){
  const s={status:'playing',version:0,...initialWordscale(false,'human')},restored=JSON.parse(JSON.stringify(s));
  const ids=[];
  for(const stage of [1,2,3]){
   const choices=wordscaleTopicChoices(stage,s);assert.equal(choices.length,3);
   assert.deepEqual(choices,wordscaleTopicChoices(stage,restored));
   assert.deepEqual(new Set(choices.map(c=>scaleTopics.find(t=>t.id===c.id).category)),new Set(['daily','together','wonder']));
   for(const c of choices){ids.push(c.id);offered.add(c.id);assert.equal('examples'in c,false);}
  }
  assert.equal(new Set(ids).size,9);
  assert.deepEqual(wordscaleView(s).topicChoices,wordscaleContext(s).topicChoices);
  assert.deepEqual(wordscaleView(s).nextTopicChoices,wordscaleContext(s).nextTopicChoices);
 }
 assert.equal(offered.size,30);
});

test('使用済みのお題は候補から除き、固定お題・自由入力での再使用も拒否',()=>{
 const s={status:'playing',version:0,...initialWordscale(false,'human')};
 const topic=scaleTopics.find(t=>t.id===s.topicOptions[2][0]);s.stage=2;s.phase='topic';s.turn=1;
 s.stages=[{stage:1,topic,cards:[]}];
 assert.equal(wordscaleTopicChoices(2,s).length,3);assert.ok(wordscaleTopicChoices(2,s).every(t=>t.id!==topic.id));
 assert.throws(()=>applyWordscale(s,{action:'topic',topic:topic.id},'human'),/使ったお題/);
 assert.throws(()=>applyWordscale(s,{action:'topic',topic:{title:topic.title,low:'少し',high:'とても'}},'human'),/使ったお題/);
 const next=applyWordscale(s,{action:'topic',topic:wordscaleTopicChoices(2,s)[0].id},'human');assert.notEqual(next.topic.id,topic.id);
});

test('旧対局の現在の三択を保持し、登録済みの次のお題もそのまま開始する',()=>{
 const s={status:'playing',version:0,...initialWordscale(false,'human')};delete s.topicOptions;
 assert.deepEqual(wordscaleTopicChoices(1,s).map(t=>t.id),['pause','parcel','room']);
 assert.deepEqual(wordscaleTopicChoices(2,s).map(t=>t.id),['room','outing','surprise']);
 s.phase='review';s.nextTopicChoice={topicId:'room',reason:'前から選んでいたお題'};s.turn=1;
 s.stages=[{stage:1,topic:scaleTopics[2],cards:[]}];
 assert.ok(wordscaleTopicChoices(2,s).every(t=>t.id!=='room'));
 const next=applyWordscale(s,{action:'next'},'human');assert.equal(next.topic.id,'room');assert.equal(next.topicReason,'前から選んでいたお題');
 assert.equal(createWordscaleTopicOptions()[3].length,3);
});
