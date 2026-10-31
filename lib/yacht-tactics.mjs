// Transparent one-roll opportunities, not an automatic player. The persona
// still selects the target, retained dice and scoring category.
export function yachtTactics(s,categories){
 if(s.status!=='playing'||!s.rolls||s.rolls>=3)return null;
 const sheet=s.sheets[s.turn],groups=Array.from({length:6},(_,i)=>({face:i+1,positions:s.dice.flatMap((v,n)=>v===i+1?[n+1]:[])}));
 const upper=categories.slice(0,6).filter(([id])=>sheet[id]===undefined).map(([id,name,face])=>{
   const keep=groups[face-1].positions,current=keep.length*face,rerolled=5-keep.length;
   return {category:id,name,keep_positions:keep,reroll_move:keep.length?'roll:'+keep.join(','):'roll',score_if_record_now:current,guaranteed_score_in_this_category_after_reroll:current,expected_score_after_one_reroll:Number((current+rerolled*face/6).toFixed(3)),best_possible_score:5*face,rerolled_dice:rerolled};
 }).filter(x=>x.rerolled_dice>0);
 const pairs=groups.filter(g=>g.positions.length===2);
 const fullHouse=pairs.length===2&&sheet.full_house===undefined?{category:'full_house',keep_positions:pairs.flatMap(p=>p.positions).sort((a,b)=>a-b),success_probability_one_reroll:2/6,note:'2組のペアを残して残り1個を振ると、1回につき1/3でフルハウス。別の役の得点を保証するものではありません。'}:null;
 return {remaining_rolls:3-s.rolls,upper_section_options:upper,two_pair_full_house:fullHouse,
   guidance:'確定する前に残り投数を使った改善を比較してください。upper_section_optionsは同じ目を全て残した場合の、その役単独の保守的な比較です。expected_scoreは次の1回の期待値で、実際の点数や最適手を保証しません。キープした目を残す限り、その数字役の現在点は失われません。使える別の役と上段ボーナスも考慮して、あなた自身で行動を選んでください。'};
}
