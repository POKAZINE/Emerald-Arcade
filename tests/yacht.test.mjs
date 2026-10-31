import test from 'node:test';
import assert from 'node:assert/strict';
import {CATEGORIES,initialYacht,applyYacht,scoreDice,totals,yachtView,yachtBotMove,yachtContext,previousHumanTurn} from '../lib/yacht.mjs';
import {gameNotification} from '../lib/game-notification.mjs';
import {gameOutcome} from '../lib/game-outcome.mjs';
import {yachtScoreReview} from '../lib/yacht-score-review.mjs';
const state=()=>({game:'yacht',...initialYacht(),humanColor:1,turn:1,status:'playing',version:0});
test('ユーザーの最後の再投と記入結果は、相手の操作後や保存復元後にも残る',()=>{
 let s=state(),n=0;const history=[];
 const act=(move,actor,dice=[])=>{n=0;s=applyYacht(s,move,actor,()=>dice[n++]);history.push(structuredClone(s));};
 act('roll','human',[5,5,1,2,3]);
 act('roll:1,2','human',[4,4,4]);
 act('roll:3,4,5','human',[1,2]);
 act('score:four_kind','human');
 const expected={round:1,last_reroll:{roll_number:3,kept_dice:[{position:3,value:4},{position:4,value:4},{position:5,value:4}],dice:[1,2,4,4,4]},final_dice:[1,2,4,4,4],category:'four_kind',category_name:'フォーダイス',points:0};
 assert.deepEqual(yachtContext(s).previous_user_turn,expected);
 act('roll','persona',[6,6,6,6,6]);act('score:yacht','persona');
 assert.deepEqual(yachtContext(JSON.parse(JSON.stringify(s))).previous_user_turn,expected);
 const legacy=structuredClone(s);delete legacy.lastHumanTurn;
 assert.deepEqual(previousHumanTurn(legacy,history),expected);
 act('roll','human',[1,2,3,4,5]);act('score:choice','human');
 const latest=yachtContext(s).previous_user_turn;
 assert.equal(latest.last_reroll,null);assert.equal(latest.points,15);assert.equal(latest.round,2);
 assert.deepEqual(latest.final_dice,[1,2,3,4,5]);
});
test('12役の採点、連番の重複、5個同目フルハウスとボーナス境界',()=>{
 assert.equal(scoreDice([6,6,6,2,2],'full_house'),22);
 assert.equal(scoreDice([6,6,6,6,6],'full_house'),30);
 assert.equal(scoreDice([6,6,6,6,1],'four_kind'),25);
 assert.equal(scoreDice([1,2,3,4,4],'small_straight'),15);
 assert.equal(scoreDice([2,3,4,5,6],'big_straight'),30);
 assert.equal(scoreDice([2,2,3,4,5],'big_straight'),0);
 assert.equal(scoreDice([5,5,5,5,5],'yacht'),50);
 assert.equal(scoreDice([5,5,5,5,5],'sixes'),0);
 assert.equal(totals({ones:3,twos:6,threes:9,fours:12,fives:15,sixes:18}).bonus,35);
 assert.equal(totals({ones:2,twos:6,threes:9,fours:12,fives:15,sixes:18}).bonus,0);
});
test('キープは位置番号、最大3投、使った役・未投球・手番違いを拒否',()=>{
 let s=state();assert.throws(()=>applyYacht(s,'score:choice','human'));assert.throws(()=>applyYacht(s,'roll:1','human'));
 let next=1;s=applyYacht(s,'roll','human',()=>next++);assert.deepEqual(s.dice,[1,2,3,4,5]);assert.equal(s.rolls,1);
 s=applyYacht(s,'roll:1,3','human',()=>6);assert.deepEqual(s.dice,[1,6,3,6,6]);
 assert.throws(()=>applyYacht(s,'roll:1,1','human'));assert.throws(()=>applyYacht(s,'roll:1,2,3,4,5','human'));
 s=applyYacht(s,'roll:1,3','human',()=>2);assert.equal(s.rolls,3);assert.throws(()=>applyYacht(s,'roll','human'));
 assert.throws(()=>applyYacht(s,'score:choice','persona'));const end=applyYacht(s,'score:choice','human');assert.equal(end.turn,2);assert.equal(end.sheets[1].choice,10);assert.equal(end.rolls,0);
});
test('両者が12役を記録した時だけ終局し、再開用履歴を壊さない',()=>{
 let s=state();const initial=structuredClone(s);
 while(s.status==='playing'){
  const actor=s.turn===1?'human':'persona';s=applyYacht(s,'roll',actor,()=>6);
  const category=CATEGORIES.find(([id])=>s.sheets[s.turn][id]===undefined)[0];s=applyYacht(s,'score:'+category,actor);
 }
 assert.equal(s.result,'draw');assert.equal(s.version,48);assert.equal(totals(s.sheets[1]).filled,12);assert.deepEqual(initial,state());assert.throws(()=>applyYacht(s,'roll','human'));
 assert.equal(gameOutcome(s).winner,'draw');assert.match(gameNotification(s),/ヨットの対局が終了/);assert.doesNotMatch(gameNotification(s),/黒.*枚/);
});
test('練習ボットは有限回の行動で12ラウンドを完了できる',()=>{
 let s=state();while(s.status==='playing')s=applyYacht(s,yachtBotMove(s),s.turn===1?'human':'persona');
 assert.ok(s.version<=96);assert.equal(yachtView(s).totals[2].filled,12);
});
test('AIにはキープで得点を伸ばす判断材料を渡し、早期確定も許容する',()=>{
 let s={...state(),humanColor:2};let n=0;const dice=[4,2,5,6,6];s=applyYacht(s,'roll','persona',()=>dice[n++]);
 const c=yachtContext(s);assert.equal(c.rolls_remaining,2);assert.deepEqual(c.dice_positions,[{position:1,value:4},{position:2,value:2},{position:3,value:5},{position:4,value:6},{position:5,value:6}]);assert.match(c.decision_guidance,/キープ/);assert.match(c.decision_guidance,/早期確定して構いません/);
 assert.equal(applyYacht(s,'score:sixes','persona').sheets[1].sixes,12);
});
test('2ペアと上段の改善機会を、保証点と期待点を分けて提示する',()=>{
 let n=0;const dice=[4,3,2,4,3];const s=applyYacht({...state(),humanColor:2},'roll','persona',()=>dice[n++]);
 const advice=yachtContext(s).tactical_opportunities;
 const fours=advice.upper_section_options.find(x=>x.category==='fours');
 assert.deepEqual(fours.keep_positions,[1,4]);assert.equal(fours.score_if_record_now,8);assert.equal(fours.guaranteed_score_in_this_category_after_reroll,8);assert.equal(fours.expected_score_after_one_reroll,10);
 assert.deepEqual(advice.two_pair_full_house.keep_positions,[1,2,4,5]);assert.equal(advice.two_pair_full_house.success_probability_one_reroll,1/3);
 assert.equal(yachtContext({...s,rolls:3}).tactical_opportunities,null);
 assert.ok(!yachtContext({...s,sheets:{1:{fours:8},2:{}}}).tactical_opportunities.upper_section_options.some(x=>x.category==='fours'));
});
test('AIの早期確定では得点を変えず再検討を返し、明示確認や3投目はそのまま確定できる',()=>{
 let n=0;const dice=[4,3,2,4,3];const s=applyYacht({...state(),humanColor:2},'roll','persona',()=>dice[n++]);
 const review=yachtScoreReview(s,'score:fours');assert.equal(review.action_applied,false);assert.equal(review.proposed_points,8);assert.equal(review.confirm_move,'score:fours:confirm');assert.equal(s.sheets[1].fours,undefined);
 assert.equal(yachtScoreReview(s,'score:fours:confirm'),null);assert.equal(yachtScoreReview({...s,rolls:3},'score:fours'),null);
 assert.equal(yachtScoreReview({...s,dice:[1,2,3,4,5]},'score:big_straight'),null);
});
