import {randomInt} from 'node:crypto';
import {yachtTactics} from './yacht-tactics.mjs';
export const CATEGORIES=[['ones','エース',1],['twos','デュース',2],['threes','トレイ',3],['fours','フォー',4],['fives','ファイブ',5],['sixes','シックス',6],['choice','チョイス'],['four_kind','フォーダイス'],['full_house','フルハウス'],['small_straight','S.ストレート'],['big_straight','B.ストレート'],['yacht','ヨット']];
export const YACHT_RULES='Emerald Arcadeヨット12役版v1。5個のサイコロ。各手番は初投を含め最大3投。残すダイスは1〜5の位置番号で指定。毎手番に未使用の役を1つ確定（不成立は0点）。各自12役を埋めて合計点を競う。1〜6の役は該当目の合計で、上段合計63点以上に35点加算。チョイスは全ダイス合計。フォーダイスは4個以上同じなら全合計。フルハウスは3+2または5個同じなら全合計。4連番は15点、5連番は30点、5個同じのヨットは50点。追加ヨットボーナスなし。同点は引き分け。';
export const YACHT_DECISION_GUIDANCE='1投で手番を終えることを目標にせず、通常は残りの投数を活用して役や上段ボーナスを狙ってください。確定前に、未使用の役、現在の出目、残り投数、キープして改善できる目を検討します。例えば6が2個でシックスが未使用なら、その2個の位置をキープし、残り3個だけを振り直して3個以上を狙えます。キープしたダイスは振り直しで変わらず、キープは毎投選び直せます。役を確定するとその役は再使用できないので、少数の一致だけで毎回すぐ確定しないでください。ヨットやB.ストレートなど十分な役が成立している場合、または残りの役・点差に照らして有利な場合は早期確定して構いません。必ず3投する義務はありません。';
export function scoreDice(dice,category){
 if(!Array.isArray(dice)||dice.length!==5||dice.some(v=>!Number.isInteger(v)||v<1||v>6))throw Error('サイコロを振ってください。');
 const counts=Array(7).fill(0);dice.forEach(v=>counts[v]++);const sum=dice.reduce((a,b)=>a+b,0),entry=CATEGORIES.find(c=>c[0]===category);
 if(!entry)throw Error('役を確認してください。');if(entry[2])return counts[entry[2]]*entry[2];
 switch(category){case 'choice':return sum;case 'four_kind':return Math.max(...counts)>=4?sum:0;case 'full_house':return (counts.includes(3)&&counts.includes(2))||counts.includes(5)?sum:0;
 case 'small_straight':return [1,2,3].some(n=>[n,n+1,n+2,n+3].every(v=>counts[v]))?15:0;
 case 'big_straight':return [1,2].some(n=>[n,n+1,n+2,n+3,n+4].every(v=>counts[v]))?30:0;
 case 'yacht':return counts.includes(5)?50:0;}
}
export function totals(sheet){const upper=CATEGORIES.slice(0,6).reduce((n,[id])=>n+(sheet[id]??0),0),bonus=upper>=63?35:0;return {upper,bonus,total:Object.values(sheet).reduce((a,b)=>a+b,0)+bonus,filled:Object.keys(sheet).length};}
export function initialYacht(){return {dice:[0,0,0,0,0],rolls:0,held:[],lastReroll:null,lastHumanTurn:null,sheets:{1:{},2:{}},ruleVersion:'yacht-12-v1',round:1};}
function rerollSummary(action){return {roll_number:action.rolls,kept_dice:action.held.map(position=>({position,value:action.dice[position-1]})),dice:[...action.dice]};}
function humanTurnSummary(action,reroll){return {round:action.round,last_reroll:reroll,final_dice:[...action.dice],category:action.category,category_name:action.categoryName,points:action.points};}
// Older saved games can recover the same facts from their existing operation records.
export function previousHumanTurn(s,history=[]){
 if(s.lastHumanTurn!==undefined)return s.lastHumanTurn;
 const actions=history.map(snapshot=>snapshot.lastMove).filter(Boolean);
 const index=actions.findLastIndex(action=>action.actor==='human'&&action.action==='score');
 if(index<0)return null;
 const score=actions[index];
 const roll=actions.slice(0,index).findLast(action=>action.actor==='human'&&action.action==='roll'&&action.round===score.round);
 return humanTurnSummary(score,roll?.rolls>1?rerollSummary(roll):null);
}
export function yachtView(s){return {...s,totals:{1:totals(s.sheets[1]),2:totals(s.sheets[2])},options:s.rolls?Object.fromEntries(CATEGORIES.filter(([id])=>s.sheets[s.turn][id]===undefined).map(([id])=>[id,scoreDice(s.dice,id)])):{}};}
export function applyYacht(s,move,actor,rollDie=()=>randomInt(1,7)){
 if(s.status!=='playing')throw Error('この対局は終了しています。');
 if(actor!==(s.turn===s.humanColor?'human':'persona'))throw Error('まだあなたの手番ではありません。');
 if(typeof move!=='string')throw Error('操作を指定してください。');
 const after=structuredClone(s),at=new Date().toISOString();
 if(/^roll(?::[1-5](?:,[1-5])*)?$/.test(move)){
  if(s.rolls>=3)throw Error('振れるのは3回までです。役を確定してください。');
  const held=move.includes(':')?move.split(':')[1].split(',').map(Number):[];
  if(new Set(held).size!==held.length||held.length===5)throw Error('キープする位置は重複なし・最大4個です。全部残す場合は役を確定してください。');
  if(!s.rolls&&held.length)throw Error('最初は5個すべて振ってください。');
  after.dice=s.dice.map((v,i)=>held.includes(i+1)?v:rollDie());
  if(after.dice.some(v=>!Number.isInteger(v)||v<1||v>6))throw Error('乱数生成に失敗しました。');
  after.rolls++;after.held=held;
  after.lastMove={actor,action:'roll',dice:[...after.dice],held,rolls:after.rolls,round:s.round,at};
  after.lastReroll=after.rolls>1?rerollSummary(after.lastMove):null;
 }else if(move.startsWith('score:')){
  const category=move.slice(6);if(!s.rolls)throw Error('まずサイコロを振ってください。');
  if(s.sheets[s.turn][category]!==undefined)throw Error('その役は記録済みです。');
  const points=scoreDice(s.dice,category);after.sheets[s.turn][category]=points;
  after.lastMove={actor,action:'score',category,categoryName:CATEGORIES.find(c=>c[0]===category)[1],points,dice:[...s.dice],round:s.round,at};
  if(actor==='human')after.lastHumanTurn=humanTurnSummary(after.lastMove,s.lastReroll??(s.lastMove?.action==='roll'&&s.lastMove.rolls>1?rerollSummary(s.lastMove):null));
  if(totals(after.sheets[1]).filled===12&&totals(after.sheets[2]).filled===12){
   after.status='finished';after.endedAt=at;const a=totals(after.sheets[s.humanColor]).total,b=totals(after.sheets[3-s.humanColor]).total;after.result=a===b?'draw':a>b?'win':'loss';
  }else{after.turn=3-s.turn;after.round=Math.min(totals(after.sheets[1]).filled,totals(after.sheets[2]).filled)+1;after.dice=[0,0,0,0,0];after.rolls=0;after.held=[];}
 }else throw Error('操作は roll、roll:1,3（位置1と3をキープ）、score:役ID で指定してください。');
 after.version=s.version+1;return after;
}
export function yachtContext(s,history=[]){const v=yachtView(s);return {session_id:s.id,game:'yacht',room_id:s.roomId,version:s.version,status:s.status,turn:s.status==='playing'?(s.turn===s.humanColor?'user':'persona'):null,persona_player:3-s.humanColor,round:s.round,dice:s.dice,tactical_opportunities:yachtTactics(s,CATEGORIES),dice_positions:s.dice.map((value,i)=>({position:i+1,value})),decision_guidance:YACHT_DECISION_GUIDANCE,rolls_used:s.rolls,rolls_remaining:3-s.rolls,held_positions:s.held,score_sheets:s.sheets,totals:v.totals,available_scores:v.options,categories:CATEGORIES.map(([id,name])=>({id,name})),last_action:s.lastMove,previous_user_turn:previousHumanTurn(s,history),rules:YACHT_RULES,instructions:'Emerald Arcadeはcustomカテゴリ。すべての引数をinput_args辞書にまとめてください。自分の手番はgameapps_play_moveでmove="roll"を指定して最初に振ります。結果を確認しmove="roll:1,3"のように残す位置番号を指定して再投、またはmove="score:full_house"などで役を確定します。expected_versionは毎回最新値を使います。最大3投で必ず役を確定し、手番を終えてからユーザーへ話してください。出目はサーバーが生成し、指定できません。'};}
export function yachtBotMove(s){
 const v=yachtView(s);if(!s.rolls)return 'roll';
 const scored=Object.entries(v.options).sort((a,b)=>b[1]-a[1]);
 if(s.rolls===3||scored.some(([id,n])=>id==='yacht'&&n===50)||scored.some(([id,n])=>id==='big_straight'&&n===30))return 'score:'+scored[0][0];
 const counts=Array(7).fill(0);s.dice.forEach(n=>counts[n]++);let face=6;for(let n=1;n<=6;n++)if(counts[n]>counts[face])face=n;
 const held=s.dice.flatMap((n,i)=>n===face?[i+1]:[]);return held.length===5?'score:'+scored[0][0]:'roll:'+held.join(',');
}
