import {randomInt} from 'node:crypto';
import {shuffledDeck} from './blackjack.mjs';
export const INDIAN_RULES='1対1・各1枚。相手の札だけ見え、自分の札は見えません。ジョーカーなし52枚を毎ハンド独立にシャッフル。2<3<…<10<J<Q<K<A、スートの優劣なし、同ランクは引き分け。各100チップ、通常6ハンド／お試し2ハンド、最終所持枚数で勝敗。同数は引き分け、片方0枚でも終了。各ハンド参加料5枚（足りなければ残額）、先手は初回ランダム・以後交代。チェック／ベット10枚／コール／レイズ10枚（全体で1回まで）／フォールド。双方チェックかコールで数字比較、フォールドで相手勝ち。残額が足りない場合は双方が出せる額まで、余剰は返却。決着後はフォールドでも双方の札を公開。次ハンドはユーザーが開始。仮想チップのみ・追加購入や換金なし。';
const value=c=>c.rank===1?14:c.rank;
export function initialIndian(quick=false,first=randomInt(2)+1){if(![1,2].includes(first))throw Error('先手を確認してください。');return {game:'indian',humanColor:1,turn:1,playStyle:quick?'quick':'standard',handLimit:quick?2:6,handNumber:0,firstSeat:first,phase:'ready',stacks:{1:100,2:100},bets:{1:0,2:0},pot:0,currentBet:0,raises:0,checked:false,cards:{1:null,2:null},hands:[],actions:[],ruleVersion:'indian-headsup-v1'};}
function pay(s,seat,n){s.stacks[seat]-=n;s.pot+=n;s.bets[seat]+=n;}
function settle(s,folded=null){
 const excess=s.bets[1]-s.bets[2];if(excess){const seat=excess>0?1:2,n=Math.abs(excess);s.stacks[seat]+=n;s.bets[seat]-=n;s.pot-=n;}
 const diff=value(s.cards[1])-value(s.cards[2]),winner=folded?3-folded:diff===0?null:diff>0?1:2,pot=s.pot;
 if(winner)s.stacks[winner]+=pot;else {s.stacks[1]+=pot/2;s.stacks[2]+=pot/2;}
 s.hands.push({number:s.handNumber,firstSeat:s.firstSeat,reason:folded?'fold':'showdown',folded,winner,pot,cards:structuredClone(s.cards),net:{1:s.stacks[1]-s.startingStacks[1],2:s.stacks[2]-s.startingStacks[2]},stacksAfter:{...s.stacks},actions:structuredClone(s.actions)});
 s.pot=0;s.phase='hand_over';s.turn=1;
 if(s.handNumber===s.handLimit||!s.stacks[1]||!s.stacks[2]){s.status='finished';s.result=s.stacks[1]===s.stacks[2]?'draw':s.stacks[1]>s.stacks[2]?'win':'loss';s.endedAt=new Date().toISOString();}
}
export function indianOptions(s,seat=s.turn){
 if(s.status!=='playing'||seat!==s.turn)return {actions:[]};
 if(s.phase==='ready'||s.phase==='hand_over')return {actions:seat===1?['next']:[]};
 const cost=s.currentBet-s.bets[seat],max=Math.min(s.bets[1]+s.stacks[1],s.bets[2]+s.stacks[2]);
 const actions=[cost?'call':'check','fold'];if(!cost&&!s.currentBet&&max>0)actions.push('bet');if(cost&&s.raises===0&&max>s.currentBet)actions.push('raise');
 const target=Math.min(s.currentBet+10,max);return {actions,callCost:Math.min(cost,s.stacks[seat]),betCost:target-s.bets[seat],target,totalPaid:s.bets[seat]+s.ante,raisesLeft:1-s.raises};
}
export function applyIndian(s,move,actor,makeDeck=shuffledDeck){
 if(s.status!=='playing')throw Error('この対局は終了しています。');if(actor!==(s.turn===1?'human':'persona'))throw Error('まだあなたの手番ではありません。');
 if(typeof move!=='string'||!indianOptions(s).actions.includes(move))throw Error('最新の合法操作から選んでください。');
 const a=structuredClone(s),seat=s.turn,at=new Date().toISOString();
 if(move==='next'){
  const deck=makeDeck();if(!Array.isArray(deck)||deck.length!==52||new Set(deck.map(c=>c.suit+':'+c.rank)).size!==52||deck.some(c=>!Number.isInteger(c.rank)||c.rank<1||c.rank>13||!['spades','hearts','diamonds','clubs'].includes(c.suit)))throw Error('配札に失敗しました。');
  if(a.handNumber)a.firstSeat=3-a.firstSeat;a.handNumber++;a.startingStacks={...a.stacks};a.cards={1:structuredClone(deck[0]),2:structuredClone(deck[1])};a.bets={1:0,2:0};a.pot=0;a.currentBet=0;a.raises=0;a.checked=false;a.actions=[];a.ante=Math.min(5,a.stacks[1],a.stacks[2]);
  for(const n of [1,2]){a.stacks[n]-=a.ante;a.pot+=a.ante;}a.phase='betting';a.turn=a.firstSeat;if(!a.stacks[1]||!a.stacks[2])settle(a);
 }else{
  const o=indianOptions(s),amount=move==='call'?o.callCost:['bet','raise'].includes(move)?o.betCost:0;
  a.actions.push({seat,action:move,amount,at});
  if(move==='fold')settle(a,seat);
  else if(move==='call'){pay(a,seat,amount);settle(a);}
  else if(move==='check'){if(a.checked)settle(a);else {a.checked=true;a.turn=3-seat;}}
  else {pay(a,seat,amount);a.currentBet=a.bets[seat];if(move==='raise')a.raises++;a.turn=3-seat;}
 }
 a.version=s.version+1;a.lastMove={actor,action:move,hand:a.handNumber,amount:move==='next'?0:a.actions.at(-1)?.amount??0,at};return a;
}
// Browser and MCP each receive their own explicit projection. No current own card or deck crosses it.
const publicBase=s=>Object.fromEntries(['id','game','mode','roomId','personaName','nexusUrl','humanColor','turn','status','version','createdAt','endedAt','result','delivery','conversation','userNote','resultNotified','playStyle','handLimit','handNumber','firstSeat','phase','stacks','bets','pot','currentBet','raises','ante','actions','hands','lastMove','ruleVersion'].map(k=>[k,structuredClone(s[k])]));
export function indianView(s){const shown=s.phase==='hand_over';return {...publicBase(s),userCard:shown?structuredClone(s.cards[1]):{hidden:true},opponentCard:s.cards[2]?structuredClone(s.cards[2]):{hidden:true},options:indianOptions(s,1)};}
export const INDIAN_REVIEW_INSTRUCTION='判断時は互いに自分の札を知らず、相手の札だけを見ていました。公開後に分かった自分の札を、本人が当時も知っていた前提で判断を評価しないでください。';
export function indianHandResult(s){
 if(s.phase!=='hand_over'||!s.hands.length)return null;
 const h=s.hands.at(-1);return {hand:h.number,reason:h.reason,winner:h.winner===null?'draw':h.winner===1?'user':'persona',folded:h.folded===null?null:h.folded===1?'user':'persona',cards:{user:structuredClone(h.cards[1]),persona:structuredClone(h.cards[2])},net:{user:h.net[1],persona:h.net[2]},stacks:{user:h.stacksAfter[1],persona:h.stacksAfter[2]},leader:h.stacksAfter[1]===h.stacksAfter[2]?'draw':h.stacksAfter[1]>h.stacksAfter[2]?'user':'persona'};
}
export function indianHandFacts(s){
 const h=indianHandResult(s);if(!h)return '';
 const who=v=>v==='user'?'ユーザー':'あなた',card=c=>({spades:'♠',hearts:'♥',diamonds:'♦',clubs:'♣'}[c.suit])+({1:'A',11:'J',12:'Q',13:'K'}[c.rank]||c.rank),signed=n=>(n>=0?'+':'')+n;
 return 'ハンド'+h.hand+'終了（'+(h.reason==='fold'?who(h.folded)+'がフォールド':'数字勝負')+'）。公開札：ユーザー'+card(h.cards.user)+'／あなた'+card(h.cards.persona)+'。'+(h.winner==='draw'?'このハンドは引き分け。':who(h.winner)+'がこのハンドの勝者。')+'増減：ユーザー'+signed(h.net.user)+'枚／あなた'+signed(h.net.persona)+'枚。現在：ユーザー'+h.stacks.user+'枚／あなた'+h.stacks.persona+'枚（'+(h.leader==='draw'?'同数':who(h.leader)+'がリード')+'）。';
}
export function indianContext(s){
 const shown=s.phase==='hand_over',dealt=s.cards[1]!==null;
 const visibility=!dealt?{opponent_card:'ユーザーの札。未配札。',own_card:'あなた自身の札。未配札。'}:shown?{opponent_card:'ユーザーの札。双方に公開済み。',own_card:'あなた自身の札。双方に公開済み。'}:{opponent_card:'ユーザーの額の札。あなたには最初から見えるが、ユーザー本人には見えない。',own_card:'あなた自身の額の札。ユーザーには見えるが、あなた自身には見えず未公開。'};
 return {session_id:s.id,room_id:s.roomId,game:s.game,version:s.version,status:s.status,turn:s.status==='playing'?(s.turn===2?'persona':'user'):null,phase:s.phase,hand_number:s.handNumber,hand_limit:s.handLimit,first_seat:s.firstSeat,stacks:s.stacks,bets:s.bets,pot:s.pot,actions:s.actions,previous_hands:s.hands,opponent_card:s.cards[1]?structuredClone(s.cards[1]):null,own_card:shown?structuredClone(s.cards[2]):{hidden:true},card_visibility:visibility,hand_result:indianHandResult(s),legal_actions:indianOptions(s,2),rules:INDIAN_RULES,instructions:'あなた=対局者のペルソナ（seat 2）、ユーザー=相手（seat 1）。'+(shown?'双方の札は公開済み。'+indianHandFacts(s)+'操作不要。公開札・増減・残額・リードを確認して振り返る。勝利数ではなく最終チップで総合勝敗が決まる。'+INDIAN_REVIEW_INSTRUCTION+(s.status==='finished'?'対局終了。次の開始は案内しない。':'nextはユーザー専用。'):!dealt?'未配札。nextはユーザー専用。':'【見える情報】opponent_cardはユーザーの札であなたに見え、own_cardはあなた自身の札でユーザーにだけ見える。自分の札は未知。ユーザーの表情・仕草などは本人が文章で伝えた場合だけ根拠にする。\n【秘密と駆け引き】未公開の札の数字・スート・絵札かどうか・数値範囲など、具体的な情報は明かさない。「強そう」「弱そう」などの評価は本当・誇張・嘘のいずれも自由。強弱の話は必ず嘘、毎回逆を言う、といった固定ルールは作らず、決着前にブラフかどうか種明かししない。口調・感情・からかい・自分自身の表情描写・予感は自由で、台詞や感情との対応を固定しない。\n合法手からgameapps_play_moveを必ず実行し、成功後は返された最新phaseを確認。hand_overなら公開された結果に基づいて振り返る。moveはcheck/bet/call/raise/foldの文字列。追加額はシステムが決定。custom、全引数input_args内。')};
}
export function chooseIndianBotAction(c,rng=Math.random){const o=c.legal_actions,actions=o.actions;if(!actions.length)throw Error('手番ではありません。');const rank=value(c.opponent_card);if(actions.includes('check'))return rank<=7&&rng()<.6?'bet':'check';if(actions.includes('raise')&&(rank<=6||rng()<.12))return 'raise';return rank>=12&&rng()<.75?'fold':'call';}
export const indianBotMove=s=>chooseIndianBotAction(indianContext(s));
