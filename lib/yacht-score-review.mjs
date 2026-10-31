import {CATEGORIES,scoreDice} from './yacht.mjs';
import {yachtTactics} from './yacht-tactics.mjs';
export function yachtScoreReview(s,move){
 if(s.game!=='yacht'||s.status!=='playing'||s.rolls<1||s.rolls>=3||typeof move!=='string'||!move.startsWith('score:')||move.endsWith(':confirm'))return null;
 const category=move.slice(6);if(!CATEGORIES.some(([id])=>id===category)||s.sheets[s.turn][category]!==undefined)return null;
 const points=scoreDice(s.dice,category);
 if(new Set(s.dice).size===1||(category==='big_straight'&&points===30))return null;
 return {action_applied:false,proposed_category:category,proposed_points:points,rolls_remaining:3-s.rolls,
  tactical_opportunities:yachtTactics(s,CATEGORIES),
  confirm_move:move+':confirm',
  message:'この得点確定はまだ実行していません。残りの投数でキープ・再投して狙える役を比較してください。振り直す場合はrollまたはroll:位置番号を指定します。検討しても早期確定が有利と判断した場合はconfirm_moveをそのまま指定すると確定できます。手番を終えたと発話するのは、確定成功後にしてください。'};
}
