import {randomInt} from 'node:crypto';
import {shuffledDeck} from './blackjack.mjs';
export const TEXAS_RULES='ユーザー対ペルソナの1対1テキサスホールデム。各100チップ、5または10ハンド。ジョーカーなし52枚を毎ハンド暗号学的乱数でシャッフル。手札2枚と共通カード5枚から自由に最強の5枚を選ぶ。スートの優劣なし。Aは高位またはA2345の低位。ディーラー位置は初回ランダム、以降交代。ディーラーがスモールブラインド2枚、相手がビッグブラインド5枚。プリフロップはディーラーから、以降は相手から行動。ノーリミット、最小ベット5枚、最小レイズ幅は直前のフルベット／レイズ幅。残額不足のオールインも可。チェック、コール、ベット、レイズ、フォールド。全員の支払額が揃い行動済みなら共通カードを3枚→1枚→1枚と公開。片方が降りれば相手の勝ち、伏せ札は公開しない。ショーダウンなら双方を公開、同じ最強5枚なら折半、奇数の余りはディーラーでない側へ。応じられない超過ベットは返却。サイドポット不要の1対1。オールインで意思決定が終われば残りの共通カードを自動公開し判定。次のハンドはユーザーが開始。所定ハンド数か片方の0枚で終了し、所持チップが多い側の勝ち、同数は引き分け。追加購入・実金銭・換金なし。';
const rank=c=>c.rank===1?14:c.rank;
export const TEXAS_RANKS=['ハイカード','ワンペア','ツーペア','スリーカード','ストレート','フラッシュ','フルハウス','フォーカード','ストレートフラッシュ'];
const compare=(a,b)=>{for(let i=0;i<Math.max(a.length,b.length);i++)if((a[i]??0)!==(b[i]??0))return (a[i]??0)>(b[i]??0)?1:-1;return 0;};
function five(cards){
 const values=cards.map(rank).sort((a,b)=>b-a),groups=[...new Set(values)].map(v=>[v,values.filter(x=>x===v).length]).sort((a,b)=>b[1]-a[1]||b[0]-a[0]);
 const flush=cards.every(c=>c.suit===cards[0].suit),unique=[...new Set(values)],straight=unique.length===5?(unique[0]-unique[4]===4?unique[0]:unique.join(',')==='14,5,4,3,2'?5:0):0;
 let n=0,t=values;
 if(flush&&straight){n=8;t=[straight];}else if(groups[0][1]===4){n=7;t=groups.map(g=>g[0]);}else if(groups[0][1]===3&&groups[1][1]===2){n=6;t=groups.map(g=>g[0]);}else if(flush)n=5;else if(straight){n=4;t=[straight];}else if(groups[0][1]===3){n=3;t=groups.map(g=>g[0]);}else if(groups[0][1]===2&&groups[1][1]===2){n=2;t=groups.map(g=>g[0]);}else if(groups[0][1]===2){n=1;t=groups.map(g=>g[0]);}
 return {value:[n,...t],label:n===8&&t[0]===14?'ロイヤルフラッシュ':TEXAS_RANKS[n],bestFive:structuredClone(cards)};
}
export function evaluatePoker(cards){
 if(cards.length<5||cards.length>7)throw Error('役判定には5〜7枚が必要です。');let best;
 for(let a=0;a<cards.length-4;a++)for(let b=a+1;b<cards.length-3;b++)for(let c=b+1;c<cards.length-2;c++)for(let d=c+1;d<cards.length-1;d++)for(let e=d+1;e<cards.length;e++){const candidate=five([cards[a],cards[b],cards[c],cards[d],cards[e]]);if(!best||compare(candidate.value,best.value)>0)best=candidate;}
 return best;
}
export function initialTexas(handLimit=5,button=randomInt(2)+1){if(![2,5,10].includes(handLimit))throw Error('ハンド数は2・5・10から選んでください。');return {game:'texas',playStyle:handLimit===2?'quick':'standard',humanColor:1,turn:1,phase:'ready',street:'preflop',handNumber:0,handLimit,button,stacks:{1:100,2:100},pot:0,community:[],holeCards:{1:[],2:[]},deck:[],streetBets:{1:0,2:0},totalBets:{1:0,2:0},acted:{1:false,2:false},currentBet:0,lastFullRaise:5,hands:[],actions:[],pendingUserNotes:[],ruleVersion:'texas-headsup-v1'};}
function pay(s,seat,amount){s.stacks[seat]-=amount;s.streetBets[seat]+=amount;s.totalBets[seat]+=amount;s.pot+=amount;}
function revealNext(s){s.deck.shift();const count=s.community.length===0?3:1;for(let i=0;i<count;i++)s.community.push(s.deck.shift());s.street=({3:'flop',4:'turn',5:'river'})[s.community.length];s.streetBets={1:0,2:0};s.currentBet=0;s.lastFullRaise=5;s.acted={1:false,2:false};s.turn=3-s.button;}
function settle(s,winner,reason){
 if(reason==='showdown'){const excess=s.totalBets[1]-s.totalBets[2],seat=excess>0?1:2;if(excess){s.stacks[seat]+=Math.abs(excess);s.totalBets[seat]-=Math.abs(excess);s.pot-=Math.abs(excess);}}
 const scores=reason==='showdown'?{1:evaluatePoker([...s.holeCards[1],...s.community]),2:evaluatePoker([...s.holeCards[2],...s.community])}:null;
 if(scores){const order=compare(scores[1].value,scores[2].value);winner=order===0?null:order>0?1:2;}
 const pot=s.pot,payouts={1:0,2:0};if(winner)payouts[winner]=pot;else{payouts[1]=payouts[2]=Math.floor(pot/2);payouts[3-s.button]+=pot%2;}
 for(const seat of [1,2])s.stacks[seat]+=payouts[seat];
 const record={number:s.handNumber,button:s.button,reason,winner,pot,community:structuredClone(s.community),cards:reason==='showdown'?structuredClone(s.holeCards):null,scores,net:{1:s.stacks[1]-s.startingStacks[1],2:s.stacks[2]-s.startingStacks[2]},stacksAfter:{...s.stacks},actions:structuredClone(s.actions)};
 s.hands.push(record);s.pot=0;s.phase='hand_over';s.turn=s.humanColor;
 if(s.handNumber>=s.handLimit||s.stacks[1]===0||s.stacks[2]===0){s.status='finished';s.result=s.stacks[1]===s.stacks[2]?'draw':s.stacks[s.humanColor]>s.stacks[3-s.humanColor]?'win':'loss';s.endedAt=new Date().toISOString();}
}
function runout(s){while(s.community.length<5)revealNext(s);settle(s,null,'showdown');}
function advance(s){
 if((s.stacks[1]===0||s.stacks[2]===0)&&((s.stacks[1]===0&&s.stacks[2]===0)||s.streetBets[s.stacks[1]?1:2]>=s.streetBets[s.stacks[1]?2:1])){runout(s);return;}
 if(s.streetBets[1]===s.streetBets[2]&&s.acted[1]&&s.acted[2]){if(s.community.length===5)settle(s,null,'showdown');else revealNext(s);}
}
function deal(s,makeDeck){
 const deck=makeDeck();if(!Array.isArray(deck)||deck.length!==52||new Set(deck.map(c=>c.suit+':'+c.rank)).size!==52||deck.some(c=>!Number.isInteger(c.rank)||c.rank<1||c.rank>13||!['spades','hearts','diamonds','clubs'].includes(c.suit)))throw Error('山札の生成に失敗しました。');
 if(s.handNumber)s.button=3-s.button;s.handNumber++;s.startingStacks={...s.stacks};s.deck=structuredClone(deck);s.holeCards={1:[],2:[]};s.community=[];s.pot=0;s.street='preflop';s.phase='betting';s.streetBets={1:0,2:0};s.totalBets={1:0,2:0};s.acted={1:false,2:false};s.actions=[];s.lastFullRaise=5;
 for(let i=0;i<2;i++)for(const seat of [3-s.button,s.button])s.holeCards[seat].push(s.deck.shift());
 pay(s,s.button,Math.min(2,s.stacks[s.button]));pay(s,3-s.button,Math.min(5,s.stacks[3-s.button]));s.currentBet=Math.max(...Object.values(s.streetBets));s.turn=s.button;advance(s);
}
export function texasOptions(s,seat=s.turn){
 if(s.status!=='playing'||seat!==s.turn)return {actions:[]};
 if(s.phase==='ready'||s.phase==='hand_over'){const nextButton=s.handNumber?3-s.button:s.button,blind=seat===nextButton?2:5;return {actions:seat===s.humanColor?['next']:[],nextBlindCost:Math.min(blind,s.stacks[seat]),nextIsAllin:s.stacks[seat]<=blind};}
 const cost=Math.max(0,s.currentBet-s.streetBets[seat]),max=s.streetBets[seat]+s.stacks[seat],min=s.currentBet?s.currentBet+s.lastFullRaise:5,other=3-seat;
 const actions=[cost?'call':'check','fold'];if(s.stacks[other]>0&&max>s.currentBet){actions.push(s.currentBet?'raise':'bet');}if(s.stacks[seat]>0&&(s.stacks[other]>0||cost>0))actions.push('allin');
 return {actions,callCost:Math.min(cost,s.stacks[seat]),callIsAllin:cost>0&&cost>=s.stacks[seat],raiseToMin:Math.min(min,max),raiseToMax:max,minimumFullRaiseTo:min,ownStreetBet:s.streetBets[seat],currentBet:s.currentBet};
}
export function applyTexas(s,move,actor,makeDeck=shuffledDeck){
 if(s.status!=='playing')throw Error('この対局は終了しています。');if(actor!==(s.turn===s.humanColor?'human':'persona'))throw Error('まだあなたの手番ではありません。');
 if(typeof move!=='string'||!/^(?:next|check|fold|call|allin|bet:\d+|raise:\d+)(?::confirm)?$/.test(move))throw Error('合法操作を確認してください。');
 const confirmed=move.endsWith(':confirm'),command=move.replace(/:confirm$/,''),action=command.split(':')[0],seat=s.turn,options=texasOptions(s);
 if(!options.actions.includes(action))throw Error('この段階ではその操作を選べません。');const a=structuredClone(s),at=new Date().toISOString();
 if(action==='next'){if(options.nextIsAllin&&actor==='human'&&!confirmed)throw Error('ブラインドで残り全額を出します。確認後に next:confirm を指定してください。');deal(a,makeDeck);}
 else{
  let amount=0;
  if(action==='fold'){a.actions.push({seat,action,street:s.street,amount:0,total:s.streetBets[seat],at});settle(a,3-seat,'fold');}
  else{
   if(action==='call')amount=options.callCost;
   if(action==='allin')amount=s.stacks[seat];
   if(action==='bet'||action==='raise'){
    const target=Number(command.split(':')[1]);if(!Number.isSafeInteger(target)||target<=s.currentBet||target>options.raiseToMax||(target<options.minimumFullRaiseTo&&target!==options.raiseToMax))throw Error(`合計ベットは${options.raiseToMin}〜${options.raiseToMax}枚です。最小額未満は残り全額のみ。`);amount=target-s.streetBets[seat];
   }
   if(amount===s.stacks[seat]&&amount>0&&actor==='human'&&!confirmed)throw Error('オールインです。残り全額を賭ける確認後に :confirm を付けてください。');
   pay(a,seat,amount);a.acted[seat]=true;
   if(a.streetBets[seat]>s.currentBet){const increase=a.streetBets[seat]-s.currentBet;if(increase>=s.lastFullRaise)a.lastFullRaise=increase;a.currentBet=a.streetBets[seat];a.acted[3-seat]=false;}
   a.actions.push({seat,action,street:s.street,amount,total:a.streetBets[seat],at});a.turn=3-seat;advance(a);
  }
 }
 a.version=s.version+1;a.lastMove={actor,action,hand:a.handNumber,street:action==='next'?a.street:s.street,at,...(action!=='next'?{amount:a.actions.at(-1)?.amount??0,total:a.actions.at(-1)?.total??0}:{})};return a;
}
// Browser/replay views contain only the user's cards and genuinely revealed showdown cards.
export function texasView(s){
 const v=Object.fromEntries(['id','game','mode','roomId','personaName','nexusUrl','humanColor','turn','status','version','createdAt','endedAt','lastMove','result','delivery','conversation','userNote','resultNotified','ruleVersion','playStyle','phase','street','handNumber','handLimit','button','stacks','pot','streetBets','totalBets','currentBet','actions','hands','pendingUserNotes'].map(k=>[k,s[k]]));
 const shown=s.phase==='hand_over'&&s.hands.at(-1)?.reason==='showdown';
 return {...v,community:structuredClone(s.community),userCards:structuredClone(s.holeCards[s.humanColor]),opponentCards:shown?structuredClone(s.holeCards[3-s.humanColor]):s.holeCards[3-s.humanColor].map(()=>({hidden:true})),userRank:s.community.length>=3?evaluatePoker([...s.holeCards[s.humanColor],...s.community]):null,options:s.turn===s.humanColor?texasOptions(s):{actions:[]}};
}
export function texasContext(s){
 const seat=3-s.humanColor,shown=s.phase==='hand_over'&&s.hands.at(-1)?.reason==='showdown';
 return {session_id:s.id,room_id:s.roomId,game:s.game,version:s.version,status:s.status,turn:s.status==='playing'?(s.turn===seat?'persona':'user'):null,play_style:s.playStyle||'standard',phase:s.phase,street:s.street,hand_number:s.handNumber,hand_limit:s.handLimit,persona_seat:seat,user_seat:s.humanColor,button:s.button,stacks:s.stacks,pot:s.pot,street_bets:s.streetBets,community:s.community,actions:s.actions,previous_hands:s.hands,legal_actions:s.turn===seat?texasOptions(s):{actions:[]},last_action:s.lastMove,rules:s.playStyle==='quick'?TEXAS_RULES.replace('5または10ハンド。','最大2ハンドのお気軽版。チップは持ち越し、2ハンド目はブラインド交代。ただし片方が0枚なら1ハンド目でも終了。'):TEXAS_RULES,instructions:'あなたはユーザーと同じ立場のポーカー対局者です。配札・役判定・精算はサーバーが行います。customカテゴリのgameapps_get_stateで最新状態を確認し、自分の番にgameapps_play_moveを必ず実行します。全引数はinput_argsにまとめます。moveはcheck/call/fold/bet:10/raise:20/allin。bet/raiseの数値はこのベット段階の合計額で、追加額ではありません。次ハンドのnextはユーザー専用。private_handとprivate_rankはあなた専用の非公開情報で、カード・数字・スート・役・最強5枚を発言や思考の表示で明かさず、ツール結果も転載しないでください。相手が降りて勝っても自分の手札を明かしません。ショーダウン時だけ公開済みの事実として話せます。ブラフは可能ですが、実際のベット・勝敗は成功した操作結果を優先してください。自分の手札、共通カード、双方のチップと公開行動から自由に判断し、相手の手札や未公開カードを知っているように話さないでください。ユーザー手番・hand_over・終了後は操作不要です。',private_hand:s.holeCards[seat],private_rank:s.community.length>=3?evaluatePoker([...s.holeCards[seat],...s.community]):null,user_cards:shown?s.holeCards[s.humanColor]:s.holeCards[s.humanColor].map(()=>({hidden:true}))};
}
export function texasBotMove(s){
 const o=texasOptions(s),cards=s.holeCards[s.turn],strength=s.community.length>=3?evaluatePoker([...cards,...s.community]).value[0]:cards[0].rank===cards[1].rank?1:0;
 if(o.actions.includes('check'))return 'check';if(strength>0||o.callCost<=10)return 'call';return 'fold';
}
