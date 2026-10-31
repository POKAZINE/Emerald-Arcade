import {randomInt} from 'node:crypto';
import {dfRank,dfSort,dfChoices,dfSelection,dfLabel} from '../public/daifugo-rules.js';
export const DF_RULES='1対1・各15枚・3ラウンド。第3ラウンドの勝者が総合優勝。53枚（ジョーカー1枚）から配り、残り23枚は使わず非公開。通常3<4<…<K<A<2<ジョーカー。同数札は同じ枚数・階段は同じ枚数の階段でより強く出す。出せてもパス可能。空の場ではパス不可。相手がパスすると場が流れ最後に出した人から再開。8を実札として含む合法手で8切り（階段も対象）、スペード3単体はジョーカー単体を返して流せる（しばり中も可）。4枚以上の同数札で革命（ジョーカー代用可）、階段革命・11バックなし。ジョーカーを含む最終手は禁止。進行不能を防ぐためジョーカー1枚だけを残す手も事前に拒否。第1ラウンド先手はランダム。第2・3ラウンドは必ず1枚同時交換：敗者の通常順で最強の1枚と、勝者が交換前の手札から選ぶ1枚。交換後は敗者から開始。革命はラウンドごとに解除。しばりONなら同じスート構成のジョーカーなしの手が2回続くと場が流れるまで固定。ジョーカーは既存のしばりを代用可能だが新規成立させない。';
export function dfDeck(){const a=Object.keys({s:1,h:1,d:1,c:1}).flatMap(s=>Array.from({length:13},(_,i)=>s+(i+1)));a.push('jk');for(let i=a.length-1;i;i--){const j=randomInt(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;}
export function initialDaifugo(options={},quick=false){
 if(!options||typeof options!=='object'||Array.isArray(options)||Object.keys(options).some(k=>!['binding','stairs'].includes(k))||Object.values(options).some(v=>typeof v!=='boolean'))throw Error('しばり・階段はON/OFFで指定してください。');
 return {game:'daifugo',playStyle:quick?'quick':'standard',humanColor:1,turn:1,phase:'ready',roundNumber:0,roundLimit:quick?1:3,hands:{1:[],2:[]},unused:[],table:null,binding:null,revolution:false,actions:[],rounds:[],exchange:null,privateExchange:null,pendingUserNotes:[],rulesConfig:{binding:options.binding??false,stairs:options.stairs??false},ruleVersion:'daifugo-duel-v1'};
}
function deal(s,deck,first){
 if(deck.length!==53||new Set(deck).size!==53||deck.some(id=>!dfDeckSet.has(id)))throw Error('配札データが不正です。');
 s.roundNumber++;s.hands={1:[],2:[]};for(let i=0;i<30;i++)s.hands[i%2+1].push(deck[i]);s.hands[1]=dfSort(s.hands[1]);s.hands[2]=dfSort(s.hands[2]);s.unused=deck.slice(30);s.table=null;s.revolution=false;s.binding=null;s.actions=[];s.privateExchange=null;
 if(s.roundNumber===1){s.phase='playing';s.turn=first;}else{const winner=s.rounds.at(-1).winner,loser=3-winner;s.exchange={winner,loser,offered:dfSort(s.hands[loser]).at(-1)};s.phase='exchange';s.turn=winner;}
}
const dfDeckSet=new Set(['s','h','d','c'].flatMap(s=>Array.from({length:13},(_,i)=>s+(i+1))).concat('jk'));
export function daifugoOptions(s,seat){
 if(s.status!=='playing'||s.turn!==seat)return {actions:[],plays:[]};
 if(['ready','round_over'].includes(s.phase))return {actions:seat===s.humanColor?['next']:[],plays:[]};
 if(s.phase==='exchange')return {actions:dfSort(s.hands[seat]).map(id=>'exchange:'+id),plays:[]};
 const plays=dfChoices(s,s.hands[seat]);return {actions:[...plays.map(p=>p.move),...(s.table?['pass']:[])],plays};
}
export function applyDaifugo(s,move,actor,makeDeck=dfDeck,first=randomInt(2)+1){
 const seat=actor==='human'?s.humanColor:actor==='persona'?3-s.humanColor:0;if(!seat||s.status!=='playing'||s.turn!==seat)throw Error('今はあなたの手番ではありません。');
 if(typeof move!=='string')throw Error('操作を文字列で指定してください。');
 const a=structuredClone(s),events=[];let last={actor,action:move.split(':')[0],round:s.roundNumber,at:new Date().toISOString()};
 if(move==='next'){
  if(seat!==s.humanColor||!['ready','round_over'].includes(s.phase))throw Error('次のラウンドは結果画面から開始してください。');deal(a,makeDeck(),first);last.round=a.roundNumber;events.push(a.phase==='exchange'?'交換する札を選びます':'配札しました');
 }else if(s.phase==='exchange'){
  const id=move.startsWith('exchange:')?move.slice(9):'';if(!s.hands[seat].includes(id))throw Error('交換前の自分の手札から1枚選んでください。');
  const {loser,offered}=s.exchange;a.hands[seat]=dfSort([...s.hands[seat].filter(c=>c!==id),offered]);a.hands[loser]=dfSort([...s.hands[loser].filter(c=>c!==offered),id]);
  a.privateExchange={[seat]:{gave:id,received:offered},[loser]:{gave:offered,received:id}};a.exchange=null;a.phase='playing';a.turn=loser;events.push('1枚ずつ同時に交換しました');
 }else if(s.phase==='playing'){
  if(move==='pass'){
   if(!s.table)throw Error('空の場ではパスできません。札を出してください。');a.turn=s.table.seat;a.table=null;a.binding=null;events.push('パスで場が流れました');
  }else{
   const option=dfChoices(s,s.hands[seat]).find(p=>p.move===move);if(!option){const ids=move.startsWith('play:')?move.slice(5).split(':')[0].split(','):[];throw Error(dfSelection(s,ids,s.hands[seat]).error||'最新の合法手を選んでください。');}
   a.hands[seat]=s.hands[seat].filter(id=>!option.ids.includes(id));last.cards=option.ids;last.label=option.label;
   const sp3=option.count===1&&option.ids[0]==='s3'&&s.table?.ids[0]==='jk'&&s.table.count===1;
   if(a.rulesConfig.binding&&!a.binding&&s.table&&!s.table.joker&&!option.joker&&s.table.kind===option.kind&&s.table.suits===option.suits){a.binding=option.suits;events.push('しばり成立');}
   if(option.kind==='group'&&option.count>=4){a.revolution=!s.revolution;events.push(a.revolution?'革命！ 数字の強さが逆転':'革命返し！ 通常の強さに戻りました');}
   a.table={...option,seat};a.turn=3-seat;
   if(sp3||option.ids.some(id=>id!=='jk'&&Number(id.slice(1))===8)){a.table=null;a.binding=null;a.turn=seat;events.push(sp3?'スペード3返し！':'8切り！');}
   if(!a.hands[seat].length){a.phase='round_over';a.turn=s.humanColor;a.rounds.push({number:a.roundNumber,winner:seat,remaining:a.hands[3-seat].length,actions:[...a.actions,{...last,events}].map(x=>structuredClone(x))});events.push('ラウンド終了');if(a.roundNumber===(s.roundLimit||3)){a.status='finished';a.result=seat===s.humanColor?'win':'loss';a.endedAt=new Date().toISOString();}}
  }
 }else throw Error('現在はその操作を実行できません。');
 last.events=events;a.actions.push(last);a.version=s.version+1;a.lastMove=last;return a;
}
function common(s){return Object.fromEntries(['id','game','mode','roomId','personaName','nexusUrl','humanColor','turn','status','version','createdAt','result','endedAt','delivery','conversation','resultNotified','playStyle','roundNumber','roundLimit','phase','table','revolution','binding','rulesConfig','actions','rounds','lastMove'].map(k=>[k,structuredClone(s[k])]));}
export function daifugoView(s){return {...common(s),userHand:[...s.hands[s.humanColor]],opponentCount:s.hands[3-s.humanColor].length,userCount:s.hands[s.humanColor].length,exchangeWinner:s.exchange?.winner??null,ownExchange:s.privateExchange?.[s.humanColor]??null,options:daifugoOptions(s,s.humanColor)};}
export function daifugoContext(s){const seat=3-s.humanColor;return {session_id:s.id,game:s.game,room_id:s.roomId,version:s.version,status:s.status,turn:s.status==='playing'?(s.turn===seat?'persona':'user'):null,phase:s.phase,round:s.roundNumber,play_style:s.playStyle||'standard',round_limit:s.roundLimit||3,table:s.table,revolution:s.revolution,binding:s.binding,rules_config:s.rulesConfig,user_remaining:s.hands[s.humanColor].length,persona_remaining:s.hands[seat].length,rounds:s.rounds,public_history:s.actions,legal_actions:daifugoOptions(s,seat),rules:daifugoRulesText(s),instructions:'customカテゴリ。必要ならrequest_capability(category=custom)。全引数をinput_argsにまとめ、最新session_id・room_id・expected_versionでgameapps_play_move。legal_actions.actionsの文字列をそのままmoveに指定。自分の手札・交換する札や受け取った札を未公開の間に発言・思考表示へ書かない。相手の手札・未使用札は不明。出せる札があってもpassで温存可能。場が流れて再び自分の手番なら続けてツールで操作し、ユーザーの番またはラウンド終了まで進める。交換は交換前の自分の手札から1枚。nextはユーザーだけ。'+(s.playStyle==='quick'?'お気軽版は1回で決着、交換なし。':'第3ラウンドの勝者が優勝。'),private_hand:[...s.hands[seat]],private_exchange:s.privateExchange?.[seat]??null};}
export function daifugoBotMove(s){if(s.phase==='exchange')return 'exchange:'+dfSort(s.hands[3-s.humanColor])[0];const o=daifugoOptions(s,3-s.humanColor),p=[...o.plays].sort((a,b)=>b.count-a.count||(s.revolution?b.value-a.value:a.value-b.value))[0];return p?.move||'pass';}

export const daifugoRulesText=s=>s.playStyle==='quick'?DF_RULES.replace('各15枚・3ラウンド。第3ラウンドの勝者が総合優勝。','各15枚・1ラウンドのみのお気軽版。先に手札を出し切った側の勝ち。').replace(/第2・3ラウンドは必ず1枚同時交換：[\s\S]*?交換後は敗者から開始。/,'お気軽版はラウンド間の交換なし。'):DF_RULES;
