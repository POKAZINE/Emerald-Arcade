import {randomInt} from 'node:crypto';

export const LIARS_RULES='1対1のライアーズダイス。毎ラウンド各5個をシステムで振り、本人だけ出目を見る。1も通常の目で万能なし。双方合計10個の中に「faceの目がcount個以上」と宣言する。数量を増やせば目は自由、同数なら目を大きくする。各100チップ、参加料各10枚（足りなければ少ない側の残額）。宣言時に賭け合計totalを上げてもよい。最低レイズ10枚・10枚刻み、ただし双方が払える上限へのオールインは端数でも可。totalは参加料を含む今ラウンドの自分の合計支払額で、追加額ではない。宣言だけ上げるならtotal=current_bet。同額にする支払いは必須。ダウトもコール額を払って検証し、実数>=宣言数なら宣言者勝利、未満ならダウト者勝利。フォールドは追加支払いなし、未対抗の上乗せ額を返して相手がポット獲得。フォールドでも双方の出目を公開。オールイン後も宣言とダウトは続行。通常最大4ラウンド・お試し1ラウンド、先手交代、0チップで早期終了。最終所持が多い側の勝ち、同額は引き分け。次ラウンドはユーザーが開始。仮想チップのみ。';
export function initialLiars(quick=false,first='random'){
 if(!['random','user','persona'].includes(first))throw Error('先手を選んでください。');
 return {game:'liars',humanColor:1,turn:1,playStyle:quick?'quick':'standard',roundLimit:quick?1:4,roundNumber:0,firstSeat:first==='random'?randomInt(2)+1:first==='user'?1:2,phase:'ready',stacks:{1:100,2:100},bets:{1:0,2:0},pot:0,currentBet:0,bid:null,dice:{1:[],2:[]},rounds:[],actions:[],ruleVersion:'liars-chips-v1'};
}
export function liarsOptions(s,seat=s.turn){
 if(s.status!=='playing'||s.turn!==seat)return {actions:[]};
 if(['ready','round_over'].includes(s.phase))return {actions:seat===1?['next']:[]};
 const maxTotal=Math.min(s.stacks[1]+s.bets[1],s.stacks[2]+s.bets[2]);
 const minCountByFace=Array.from({length:6},(_,i)=>!s.bid?1:s.bid.count+(i+1>s.bid.face?0:1));
 return {actions:[...(minCountByFace.some(n=>n<=10)?['bid']:[]),...(s.bid?['doubt','fold']:[])],callCost:s.currentBet-s.bets[seat],currentBet:s.currentBet,maxTotal,minRaiseTotal:s.currentBet+10,minCountByFace,maxCount:10,raiseStep:10,allIn:maxTotal===s.currentBet};
}
function pay(s,seat,amount){s.stacks[seat]-=amount;s.bets[seat]+=amount;s.pot+=amount;}
function settle(s,seat,reason){
 const actual=s.bid?s.dice[1].concat(s.dice[2]).filter(n=>n===s.bid.face).length:null;
 const winner=reason==='fold'?3-seat:actual>=s.bid.count?s.bid.seat:seat;
 const excess=s.bets[1]-s.bets[2];if(excess){const n=Math.abs(excess),owner=excess>0?1:2;s.stacks[owner]+=n;s.bets[owner]-=n;s.pot-=n;}
 const pot=s.pot;s.stacks[winner]+=pot;
 s.rounds.push({number:s.roundNumber,firstSeat:s.firstSeat,reason,challenger:reason==='doubt'?seat:null,folded:reason==='fold'?seat:null,winner,pot,bid:structuredClone(s.bid),actual,dice:structuredClone(s.dice),net:{1:s.stacks[1]-s.startingStacks[1],2:s.stacks[2]-s.startingStacks[2]},stacksAfter:{...s.stacks},actions:structuredClone(s.actions)});
 s.pot=0;s.phase='round_over';s.turn=1;
 if(s.roundNumber>=s.roundLimit||s.stacks[1]===0||s.stacks[2]===0){s.status='finished';s.result=s.stacks[1]===s.stacks[2]?'draw':s.stacks[1]>s.stacks[2]?'win':'loss';s.endedAt=new Date().toISOString();}
}
export function applyLiars(s,input,actor,roll=()=>randomInt(1,7)){
 if(s.status!=='playing')throw Error('この対局は終了しています。');if(actor!==(s.turn===1?'human':'persona'))throw Error('まだあなたの手番ではありません。');
 let m;try{m=typeof input==='string'?JSON.parse(input):input;}catch{throw Error('moveはactionを持つJSONで指定してください。');}
 const o=liarsOptions(s);if(!m||typeof m!=='object'||!o.actions.includes(m.action))throw Error('最新の合法操作を選んでください。');
 if(m.action==='next'&&actor!=='human')throw Error('次の開始はユーザーが行います。');
 const a=structuredClone(s),seat=s.turn,at=new Date().toISOString();let amount=0;
 if(m.action==='next'){
  const dice={1:Array.from({length:5},roll),2:Array.from({length:5},roll)};if(Object.values(dice).flat().some(n=>!Number.isInteger(n)||n<1||n>6))throw Error('出目を生成できませんでした。');
  if(a.roundNumber)a.firstSeat=3-a.firstSeat;a.roundNumber++;a.startingStacks={...a.stacks};a.dice=dice;a.bets={1:0,2:0};a.pot=0;a.bid=null;a.actions=[];
  a.ante=Math.min(10,a.stacks[1],a.stacks[2]);for(const n of [1,2])pay(a,n,a.ante);a.currentBet=a.ante;a.turn=a.firstSeat;a.phase='bidding';
 }else if(m.action==='bid'){
  const {face,count}=m,total=m.total===undefined?s.currentBet:m.total;
  if(!Number.isInteger(face)||face<1||face>6||!Number.isInteger(count)||count<o.minCountByFace[face-1]||count>10)throw Error('数量を増やすか、同数なら目を大きくして宣言してください。');
  if(!Number.isInteger(total)||total<s.currentBet||total>o.maxTotal||total>s.currentBet&&total!==o.maxTotal&&(total<o.minRaiseTotal||(total-s.currentBet)%10!==0))throw Error('レイズは最低10枚・10枚刻み、または双方が払える上限です。totalは参加料込みの合計額です。');
  amount=total-a.bets[seat];pay(a,seat,amount);a.currentBet=total;a.bid={seat,face,count};a.turn=3-seat;
 }else if(m.action==='doubt'){amount=o.callCost;pay(a,seat,amount);a.actions.push({seat,action:m.action,amount,at});settle(a,seat,'doubt');}
 else {a.actions.push({seat,action:m.action,amount:0,at});settle(a,seat,'fold');}
 if(m.action==='bid')a.actions.push({seat,action:'bid',face:m.face,count:m.count,total:a.currentBet,amount,at});
 a.version=s.version+1;a.lastMove={actor,seat,action:m.action,...(m.action==='bid'?{face:m.face,count:m.count,total:a.currentBet}:{}),amount,round:a.roundNumber,at};return a;
}
const publicKeys=['id','game','mode','roomId','personaName','nexusUrl','humanColor','turn','status','version','createdAt','endedAt','result','delivery','conversation','userNote','resultNotified','playStyle','roundLimit','roundNumber','firstSeat','phase','stacks','bets','pot','currentBet','ante','actions','rounds','bid','lastMove','ruleVersion'];
export function liarsView(s,seat=1){return {...Object.fromEntries(publicKeys.map(k=>[k,structuredClone(s[k])])),ownDice:[...s.dice[seat]],opponentDice:s.phase==='round_over'?[...s.dice[3-seat]]:null,options:liarsOptions(s,seat)};}
export function liarsFacts(s){const r=s.rounds.at(-1);if(s.phase!=='round_over'||!r)return '';return 'ラウンド'+r.number+'終了。'+(r.reason==='fold'?(r.folded===1?'ユーザー':'あなた')+'がフォールド。':'宣言：'+r.bid.face+'の目が'+r.bid.count+'個以上、実数'+r.actual+'個。')+(r.winner===1?'ユーザー':'あなた')+'が勝利。現在ユーザー'+s.stacks[1]+'枚／あなた'+s.stacks[2]+'枚。'+(s.status==='finished'?'最終終了、次の開始は案内しない。':'次ラウンドはユーザーが開始。');}
export function liarsSpeechPolicy(s){
 if(s.phase==='round_over')return '【公開後】このラウンドの出目はシステムが双方へ公開済み。実際の配列・個数・有無を使って振り返ってよい。過去ラウンドの出目を現在の秘密の出目と混同しない。';
 return '【秘密と駆け引き】own_diceは判断用の非公開情報。未公開の自分の出目の配列、特定の目の保有数・有無、内訳を逆算できる理由を、台詞・地の文・ユーザーに表示される思考へ転載しない。嘘として具体的な内訳を述べることも避ける。ふたり合計についての公開の宣言は自由。自信・不安・挑発・出目への曖昧な評価は本当・誇張・嘘のいずれも自由で、毎回の対応や必ず嘘という規則を固定しない。口調・性格・着手・レイズ・ダウトの判断は自由。口でダウトと言っただけでは公開扱いにせず、成功したツール結果でphase=round_overになるまで秘密を守る。previous_roundsの公開済みの出目は振り返れるが、このラウンドとは区別する。';
}
export function liarsContext(s){const v=liarsView(s,2);return {session_id:s.id,room_id:s.roomId,game:s.game,version:s.version,status:s.status,turn:s.turn===2?'persona':'user',phase:s.phase,round_number:s.roundNumber,round_limit:s.roundLimit,own_dice:v.ownDice,opponent_dice:v.opponentDice,dice_visibility:s.phase==='round_over'?'both_public':s.phase==='ready'?'not_rolled':'own_private_opponent_hidden',stacks:s.stacks,bets:s.bets,pot:s.pot,current_bid:s.bid,actions:s.actions,previous_rounds:s.rounds,legal_actions:v.options,rules:LIARS_RULES,instructions:'あなた=seat 2、ユーザー=seat 1。相手の未公開出目は不明。ユーザーの表情・仕草は本人が文章で伝えた場合だけ根拠にする。'+liarsSpeechPolicy(s)+''+(s.phase==='bidding'?'合法手をgameapps_play_moveで必ず実行。moveはJSON文字列：宣言は{"action":"bid","face":1〜6,"count":個数,"total":参加料込みの自分の合計支払額}、ダウトは{"action":"doubt"}、降りるなら{"action":"fold"}。金額と宣言は同時に確定。成功した操作結果で会話し、実行せず宣言したことにしない。':'操作不要。'+liarsFacts(s))+' custom／全引数input_args内。'};}
// Only the actor projection enters the bot. It never receives the opponent dice.
export function chooseLiarsBot(c,rng=Math.random){
 const o=c.legal_actions;if(o.actions.includes('next'))return {action:'next'};
 const probability=(face,count)=>{const need=count-c.own_dice.filter(n=>n===face).length;if(need<=0)return 1;let p=0;const comb=[1,5,10,10,5,1];for(let n=need;n<=5;n++)p+=comb[n]*(1/6)**n*(5/6)**(5-n);return p;};
 if(c.current_bid&&probability(c.current_bid.face,c.current_bid.count)<.28){if(o.callCost>20&&rng()<.4)return {action:'fold'};return {action:'doubt'};}
 const choices=[];for(let face=1;face<=6;face++){const count=o.minCountByFace[face-1];if(count<=10)choices.push({face,count,p:probability(face,count)});}choices.sort((a,b)=>b.p-a.p);
 if(!choices.length||choices[0].p<.15&&c.current_bid)return {action:'doubt'};
 const best=choices[Math.floor(rng()*Math.min(2,choices.length))];let total=o.currentBet;
 if(best.p>.7&&o.maxTotal>total&&rng()<.35)total=Math.min(total+10,o.maxTotal);
 return {action:'bid',face:best.face,count:best.count,total};
}
export const liarsBotMove=s=>JSON.stringify(chooseLiarsBot(liarsContext(s)));
