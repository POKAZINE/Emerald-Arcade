import {randomInt} from 'node:crypto';
import {NF_COLORS,NF_TROOPS,NF_TACTICS,nfCard,nfLabel,nfValues} from '../public/nineflags-cards.js';
const clone=x=>structuredClone(x),seatName=n=>n===1?'ユーザー':'あなた';
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=randomInt(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;}
export const nfCapacity=f=>f.terrain.some(t=>t.id==='mud')?4:3;
export const nfStats=t=>{const c=nfCard(t.id);return {color:t.color??c.color,value:t.value??c.value};};
export function nfFormation(tokens,fog=false){
 const a=tokens.map(nfStats),v=a.map(c=>c.value).sort((a,b)=>a-b),same=a.every(c=>c.color===a[0]?.color),equal=v.every(n=>n===v[0]),run=v.every((n,i)=>!i||n===v[i-1]+1),rank=fog?0:same&&run?4:equal?3:same?2:run?1:0;
 return {rank,sum:v.reduce((a,b)=>a+b,0),name:fog?'合計で比較':['合計で勝負','連番','同じ色','同じ数字','同色の連番'][rank]};
}
const compare=(a,b)=>a.rank-b.rank||a.sum-b.sum;
const options=t=>nfCard(t.id).type==='wild'?NF_COLORS.flatMap(c=>nfValues(t.id).map(value=>({...t,color:c.id,value}))):[t];
function someAssignment(tokens,fn,i=0,chosen=[]){if(i===tokens.length)return fn(chosen);for(const t of options(tokens[i]))if(someAssignment(tokens,fn,i+1,[...chosen,t]))return true;return false;}
function visibleTroops(s){return new Set([...s.flags.flatMap(f=>[...f.rows[1],...f.rows[2]].map(t=>t.id)),...s.discard].filter(id=>nfCard(id)?.type==='troop'));}
export function nfClaim(s,flagNumber,seat){
 const f=s.flags[flagNumber-1];if(!f||f.owner||f.rows[seat].length!==nfCapacity(f))return null;
 const own=f.rows[seat],other=f.rows[3-seat],size=nfCapacity(f),fog=f.terrain.some(t=>t.id==='fog'),score=nfFormation(own,fog),completeAt=a=>Math.max(...a.map(t=>t.at||0));
 const beats=a=>{const c=compare(nfFormation(a,fog),score);return c>0||c===0&&other.length===size&&completeAt(other)<completeAt(own);};
 if(other.length===size){if(someAssignment(other,beats))return null;return {flag:flagNumber,seat,reason:'完成した役の比較',formation:score,opponentFormation:nfFormation(other,fog),earlier:completeAt(own)<completeAt(other)};}
 const visible=visibleTroops(s),pool=NF_TROOPS.filter(c=>!visible.has(c.id)).sort((a,b)=>b.value-a.value),need=size-other.length;
 const search=(start,left,added)=>{if(!left)return someAssignment(other,a=>beats([...a,...added]));for(let i=start;i<=pool.length-left;i++)if(search(i+1,left-1,[...added,pool[i]]))return true;return false;};
 if(search(0,need,[]))return null;
 return {flag:flagNumber,seat,reason:'盤上の公開札だけで、相手が逆転できないと証明',formation:score,opponentFormation:null,earlier:true};
}
function event(s,data){const e={seq:++s.eventSerial,at:new Date().toISOString(),...data};s.events.push(e);s.lastMove=e;return e;}
function finish(s,seat,reason,flags=[]){s.status='finished';s.phase='finished';s.winner=seat;s.result=seat===null?'draw':seat===1?'win':'loss';s.winReason=reason;s.winningFlags=flags;s.endedAt=new Date().toISOString();event(s,{action:'finish',seat,reason,flags});}
function victory(s,seat){if(s.playStyle==='quick'){const ids=s.flags.filter(f=>f.owner===seat).map(f=>f.id);if(ids.length>=3){finish(s,seat,'three',ids);return true;}return false;}const ids=s.flags.filter(f=>f.owner===seat).map(f=>f.id);for(let i=1;i<=7;i++)if([i,i+1,i+2].every(n=>ids.includes(n))){finish(s,seat,'adjacent',[i,i+1,i+2]);return true;}if(ids.length>=5){finish(s,seat,'five',ids);return true;}return false;}
function claims(s){for(const f of s.flags){const proof=nfClaim(s,f.id,s.turn);if(!proof)continue;f.owner=s.turn;f.proof=proof;event(s,{action:'claim',seat:s.turn,flag:f.id,proof});if(victory(s,s.turn))return;}}
const ownWild=(s,seat)=>s.flags.filter(f=>!f.owner).flatMap(f=>f.rows[seat].filter(t=>nfCard(t.id).type==='wild').map(t=>({flag:f.id,...t})));
function startTurn(s){s.phase=ownWild(s,s.turn).length?'assign':'play';if(s.phase==='play')claims(s);}
function endTurn(s){s.turn=3-s.turn;s.turnNumber++;startTurn(s);}
function drawOne(s,pile,seat){const deck=pile==='troop'?s.troopDeck:s.tacticDeck;if(!['troop','tactic'].includes(pile)||!deck.length)throw Error('残っている山札を選んでください。');s.hands[seat].push(deck.shift());}
function afterPlay(s){s.phase='draw';const piles=['troop','tactic'].filter(p=>(p==='troop'?s.troopDeck:s.tacticDeck).length);if(piles.length===1){drawOne(s,piles[0],s.turn);event(s,{action:'draw',seat:s.turn,pile:piles[0],count:1});endTurn(s);}else if(!piles.length)endTurn(s);}
function overflow(s,resume){const queue=[];for(const f of s.flags)if(!f.owner)for(const seat of [resume.turn,3-resume.turn])if(f.rows[seat].length>nfCapacity(f))queue.push({flag:f.id,seat});if(queue.length){s.pending={kind:'trim',queue,resume};s.turn=queue[0].seat;s.phase='trim';}else if(resume.phase==='after_play')afterPlay(s);else{s.turn=resume.turn;s.phase=resume.phase;}}
export function initialNineflags(tactics=true,first='random',quick=false){
 if(typeof tactics!=='boolean'||!['random','user','persona'].includes(first))throw Error('戦術カードと先手を確認してください。');
 if(typeof quick!=='boolean')throw Error('遊ぶ長さを確認してください。');if(quick)tactics=false;
 const troopDeck=shuffle(NF_TROOPS.map(c=>c.id)),hands={1:troopDeck.splice(0,7),2:troopDeck.splice(0,7)};
 return {game:'nineflags',playStyle:quick?'quick':'standard',humanColor:1,turn:first==='random'?randomInt(2)+1:first==='user'?1:2,phase:'play',rulesConfig:{tactics,claims:'turn_start',handSize:7},hands,troopDeck,tacticDeck:tactics?shuffle(NF_TACTICS.map(c=>c.id)):[],flags:Array.from({length:quick?5:9},(_,i)=>({id:i+1,owner:0,rows:{1:[],2:[]},terrain:[],proof:null})),discard:[],tacticCounts:{1:0,2:0},leaderUsed:{1:false,2:false},turnNumber:1,moveCount:0,events:[],eventSerial:0,pending:null,pendingUserNotes:[],winner:null,winningFlags:[],ruleVersion:'nineflags-v1'};
}
function rowFlags(s,seat,ignore=null){return s.flags.filter(f=>!f.owner&&f.id!==ignore&&f.rows[seat].length<nfCapacity(f)).map(f=>f.id);}
function targets(s,seat,ordinary=false){return s.flags.filter(f=>!f.owner).flatMap(f=>[...f.rows[seat].filter(t=>!ordinary||nfCard(t.id).type==='troop').map(t=>({flag:f.id,card_id:t.id,terrain:false})),...(!ordinary?f.terrain.filter(t=>t.by===seat).map(t=>({flag:f.id,card_id:t.id,terrain:true})):[])]);}
export function nineflagsLegal(s,seat=s.turn){
 if(s.status!=='playing'||seat!==s.turn)return {};
 if(s.phase==='assign')return {action:'assign_or_begin',wild_cards:ownWild(s,seat).map(t=>({...t,values:nfValues(t.id),colors:NF_COLORS.map(c=>c.id)}))};
 if(s.phase==='trim'){const q=s.pending.queue[0];return {action:'trim',flag:q.flag,keep:nfCapacity(s.flags[q.flag-1]),card_ids:s.flags[q.flag-1].rows[seat].map(t=>t.id)};}
 if(s.phase==='draw'||s.phase==='scout_draw')return {action:s.phase==='draw'?'draw':'scout_draw',piles:['troop','tactic'].filter(p=>(p==='troop'?s.troopDeck:s.tacticDeck).length),remaining:s.pending?.drawsLeft??1};
 if(s.phase==='scout_return')return {action:'scout_return',count:s.pending.returnCount,card_ids:[...s.hands[seat]],order:'同じ山札へ戻す札は、配列の先頭が山札の上。'};
 const flags=rowFlags(s,seat),troops=s.hands[seat].filter(id=>nfCard(id).type==='troop'),canTactic=s.rulesConfig.tactics&&s.tacticCounts[seat]<=s.tacticCounts[3-seat];
 const tactics=canTactic?s.hands[seat].filter(id=>nfCard(id).type!=='troop').flatMap(id=>{
 const c=nfCard(id);if(c.type==='wild')return !flags.length||id.startsWith('leader')&&s.leaderUsed[seat]?[]:[{card_id:id,type:c.type,flags,colors:NF_COLORS.map(c=>c.id),values:nfValues(id)}];
 if(c.type==='terrain'){const flags=s.flags.filter(f=>!f.owner&&!f.terrain.some(t=>t.id===id)).map(f=>f.id);return flags.length?[{card_id:id,type:c.type,flags}]:[];}
 if(id==='scout')return s.troopDeck.length+s.tacticDeck.length?[{card_id:id,type:c.type}]:[];
 const list=targets(s,id==='redeploy'?seat:3-seat,id==='traitor');return list.length&&(id!=='traitor'||flags.length)?[{card_id:id,type:c.type,targets:list,destination_flags:flags,discard_allowed:id==='redeploy'}]:[];
 }):[];
 return {action:'play',troop_card_ids:flags.length?troops:[],flags,tactics,pass:!troops.length||!flags.length};
}
function getFlag(s,n){if(!Number.isInteger(n)||n<1||n>s.flags.length||s.flags[n-1].owner)throw Error('未確保の旗1〜'+s.flags.length+'を選んでください。');return s.flags[n-1];}
function assignment(id,m){if(!NF_COLORS.some(c=>c.id===m.color)||!nfValues(id).includes(m.value))throw Error('この万能札に使える色と数字を選んでください。');return {color:m.color,value:m.value};}
export function applyNineflags(before,raw,actor){
 if(before.game!=='nineflags'||before.status!=='playing')throw Error('この対局は終了しています。');
 if(!['human','persona'].includes(actor)||(actor==='human'?1:2)!==before.turn)throw Error('いまは相手の操作です。');
 let m;try{m=typeof raw==='string'?JSON.parse(raw):raw;}catch{throw Error('操作はJSON文字列で指定してください。');}if(!m||typeof m!=='object'||Array.isArray(m))throw Error('操作を確認してください。');
 const s=clone(before),seat=s.turn,legal=nineflagsLegal(s);s.eventSerial=s.eventSerial||0;
 if(s.phase==='assign'){
  if(m.action==='begin'){event(s,{action:'begin',seat});s.phase='play';claims(s);}else if(m.action==='assign'){const f=getFlag(s,m.flag),t=f.rows[seat].find(t=>t.id===m.card_id&&nfCard(t.id).type==='wild');if(!t)throw Error('自分の万能札を選んでください。');Object.assign(t,assignment(t.id,m));event(s,{action:'assign',seat,flag:f.id,cardId:t.id,...nfStats(t)});}else throw Error('万能札を確認し、beginで旗を判定してください。');
 }else if(s.phase==='trim'){
  const q=s.pending.queue[0],f=s.flags[q.flag-1],ids=m.keep_ids;if(m.action!=='trim'||!Array.isArray(ids)||ids.length!==nfCapacity(f)||new Set(ids).size!==ids.length||ids.some(id=>!f.rows[seat].some(t=>t.id===id)))throw Error('残す3枚を選んでください。');
  const removed=f.rows[seat].filter(t=>!ids.includes(t.id));s.discard.push(...removed.map(t=>t.id));f.rows[seat]=f.rows[seat].filter(t=>ids.includes(t.id));event(s,{action:'trim',seat,flag:f.id,removed:removed.map(t=>t.id)});s.pending.queue.shift();if(s.pending.queue.length)s.turn=s.pending.queue[0].seat;else{const resume=s.pending.resume;s.pending=null;s.turn=resume.turn;if(resume.phase==='after_play')afterPlay(s);else s.phase=resume.phase;}
 }else if(s.phase==='draw'){
  if(m.action!=='draw')throw Error('補充する山札を選んでください。');drawOne(s,m.pile,seat);event(s,{action:'draw',seat,pile:m.pile,count:1});endTurn(s);
 }else if(s.phase==='scout_draw'){
  if(m.action!=='scout_draw')throw Error('見晴らしで引く山札を選んでください。');drawOne(s,m.pile,seat);s.pending.drawsLeft--;s.pending.drawn++;event(s,{action:'scout_draw',seat,pile:m.pile,count:1});if(!s.pending.drawsLeft||!s.troopDeck.length&&!s.tacticDeck.length){s.pending.returnCount=Math.max(0,s.pending.drawn-1);s.phase='scout_return';if(!s.pending.returnCount){s.pending=null;endTurn(s);}}
 }else if(s.phase==='scout_return'){
  const ids=m.card_ids;if(m.action!=='scout_return'||!Array.isArray(ids)||ids.length!==s.pending.returnCount||new Set(ids).size!==ids.length||ids.some(id=>!s.hands[seat].includes(id)))throw Error('山札へ戻す札を必要枚数選んでください。');
  s.hands[seat]=s.hands[seat].filter(id=>!ids.includes(id));for(const id of ids.slice().reverse())(nfCard(id).type==='troop'?s.troopDeck:s.tacticDeck).unshift(id);event(s,{action:'scout_return',seat,count:ids.length});s.pending=null;endTurn(s);
 }else if(m.action==='pass'){
  if(!legal.pass)throw Error('部隊札を置ける間はパスできません。');event(s,{action:'pass',seat});endTurn(s);
 }else{
  const c=nfCard(m.card_id);if(!c||!s.hands[seat].includes(c.id))throw Error('自分の手札を選んでください。');
  if(c.type==='troop'){
   if(m.action!=='place'||!legal.flags.includes(m.flag))throw Error('空き枠のある旗へ配置してください。');const f=getFlag(s,m.flag);f.rows[seat].push({id:c.id,at:s.eventSerial+1});s.hands[seat]=s.hands[seat].filter(id=>id!==c.id);s.moveCount++;event(s,{action:'place',seat,cardId:c.id,flag:f.id});afterPlay(s);
  }else{
   const allowed=legal.tactics.find(t=>t.card_id===c.id);if(m.action!=='tactic'||!allowed)throw Error('この戦術はまだ使用できません。');
   let details={};
   if(c.type==='wild'){if(!allowed.flags.includes(m.flag))throw Error('空き枠のある旗を選んでください。');const f=getFlag(s,m.flag),a=assignment(c.id,m);f.rows[seat].push({id:c.id,...a,at:s.eventSerial+1});if(c.id.startsWith('leader'))s.leaderUsed[seat]=true;details={flag:f.id,...a};}
   else if(c.type==='terrain'){if(!allowed.flags.includes(m.flag))throw Error('地形を置ける旗を選んでください。');getFlag(s,m.flag).terrain.push({id:c.id,by:seat});details={flag:m.flag};}
   else if(c.type!=='scout'){
    const target=allowed.targets.find(t=>t.card_id===m.target_id);if(!target)throw Error('効果の対象を選んでください。');const from=getFlag(s,target.flag),sourceSeat=c.id==='redeploy'?seat:3-seat,list=target.terrain?from.terrain:from.rows[sourceSeat],i=list.findIndex(t=>t.id===target.card_id),token=list[i];
    if(c.id==='deserter'||c.id==='redeploy'&&m.to_flag===null){list.splice(i,1);s.discard.push(token.id);details={from:from.id,targetId:token.id,discarded:true};}
    else {const to=getFlag(s,m.to_flag);if(to.id===from.id&&c.id==='redeploy')throw Error('別の旗を選んでください。');if(target.terrain){if(to.terrain.some(t=>t.id===token.id))throw Error('同じ地形は重ねられません。');to.terrain.push({...token,by:seat});}else{if(to.rows[seat].length>=nfCapacity(to))throw Error('移動先に空き枠がありません。');to.rows[seat].push({...token,at:s.eventSerial+1});}list.splice(i,1);details={from:from.id,to:to.id,targetId:token.id};}
   }
   s.hands[seat]=s.hands[seat].filter(id=>id!==c.id);s.tacticCounts[seat]++;if(!['wild','terrain'].includes(c.type))s.discard.push(c.id);event(s,{action:'tactic',seat,cardId:c.id,...details});
   if(c.type==='scout'){s.phase='scout_draw';s.pending={kind:'scout',drawsLeft:Math.min(3,s.troopDeck.length+s.tacticDeck.length),drawn:0,returnCount:0};}else overflow(s,{turn:seat,phase:'after_play'});
  }
 }
 s.version=before.version+1;return s;
}
const phaseNames={play:'配置・戦術',assign:'万能札を確認して旗を判定',draw:'補充する山札を選択',scout_draw:'見晴らし：3枚の補充',scout_return:'見晴らし：札を山札へ戻す',trim:'残す3枚を選択',finished:'対局終了'};
export function nineflagsView(s,seat=1){
 const keys=['id','game','mode','roomId','personaName','nexusUrl','humanColor','turn','status','phase','version','createdAt','endedAt','result','delivery','conversation','userNote','resultNotified','rulesConfig','flags','discard','tacticCounts','leaderUsed','turnNumber','moveCount','events','eventSerial','winner','winningFlags','winReason','lastMove'];
 const v=Object.fromEntries(keys.map(k=>[k,clone(s[k])]));return {...v,playStyle:s.playStyle||'standard',hand:[...s.hands[seat]],handCounts:{1:s.hands[1].length,2:s.hands[2].length},deckCounts:{troop:s.troopDeck.length,tactic:s.tacticDeck.length},legal:nineflagsLegal(s,seat),phaseName:s.playStyle==='quick'&&s.phase==='play'?'札を配置':phaseNames[s.phase],resolution:s.phase==='trim'?{flag:s.pending.queue[0].flag}:s.pending?.kind==='scout'?{drawsLeft:s.pending.drawsLeft,returnCount:s.pending.returnCount}:null};
}
export function nineflagsContext(s){const v=nineflagsView(s,2),quick=s.playStyle==='quick';return {session_id:s.id,room_id:s.roomId,game:s.game,play_style:v.playStyle,version:s.version,status:s.status,turn:s.turn===2?'persona':'user',phase:s.phase,phase_name:v.phaseName,own_hand:v.hand,own_tactic_details:v.hand.filter(id=>nfCard(id).type!=='troop').map(id=>({id,name:nfCard(id).name,type:nfCard(id).type,effect:nfCard(id).help})),hand_counts:v.handCounts,deck_counts:v.deckCounts,flags:v.flags,discard:v.discard,tactic_counts:v.tacticCounts,legal_actions:v.legal,resolution:v.resolution,recent_events:v.events.slice(-8),rules:(quick?'九旗のかけひき・お手軽版。5旗・手札7枚・各旗3枚。場所を問わず先に3旗で勝ち。隣接勝利なし、戦術なし。':'九旗のかけひき・通常版。9旗。隣接3旗または計5旗で勝ち。')+'旗は自分の手番開始時、公開札だけから自動判定。役：同色連番＞同数＞同色＞連番＞合計。同役は合計、同点は先に完成した側。'+(quick?'配置後は自動補充。': '戦術は相手の使用数+1枚まで。万能2種は一人1枚。未確保の万能札は自分の手番開始時に色数字を選び直してbegin。霧は合計のみ、泥は4枚。'),instructions:s.status==='playing'?(quick?'あなたはseat 2、ユーザーはseat 1。自分の手札と公開盤面だけで判断し、未公開の札は話さない。legal_actionsの札IDと旗番号を使い、gameapps_play_moveのmoveへJSON文字列 {action:"place",card_id:"jade_8",flag:3}。配置後は自動補充。合法なときだけ{action:"pass"}。最新version・全引数input_args内。成功した操作結果を受けて、あなたらしく会話する。':'あなたはseat 2、ユーザーはseat 1。自分の手札と公開情報だけで判断。相手の手札・山札は分からない。自分の未公開札や戻した札は会話・思考表示にも明かさない。phaseとlegal_actionsに従いgameapps_play_moveのmoveへJSON文字列を指定。play: {action:"place",card_id:"jade_8",flag:4} または {action:"tactic",card_id:戦術ID,flag:旗,color:色,value:数字,target_id:対象ID,to_flag:移動先またはnull}。assign: {action:"assign",flag:旗,card_id:万能札,color:色,value:数字}で任意変更し{action:"begin"}。draw/scout_draw: {action:phase,pile:"troop"または"tactic"}。scout_return: {action:"scout_return",card_ids:[戻すIDを上から順に]}。trim: {action:"trim",keep_ids:[残す3枚のID]}。合法なときだけ{action:"pass"}。成功結果と最新versionを使いaction_requiredなら同じ会話内で続行し、補充・割り込み解決まで終えて話す。全引数input_args内。公開された直前の一手や効果を材料に、あなたらしく会話する。'):'対局終了。操作不要。旗の所有と決着理由だけを受けて振り返る。未公開の手札と山札は明かさない。'};}
export function nineflagsBotMove(s){
 const v=nineflagsView(s,s.turn),l=v.legal,seat=s.turn;
 if(s.phase==='assign'){for(const w of l.wild_cards){const f=s.flags[w.flag-1],row=f.rows[seat],i=row.findIndex(t=>t.id===w.id);let best=row[i],score=nfFormation(row,f.terrain.some(t=>t.id==='fog'));for(const o of options(row[i])){const a=[...row];a[i]=o;const r=nfFormation(a,f.terrain.some(t=>t.id==='fog'));if(compare(r,score)>0){score=r;best=o;}}if(best.color!==w.color||best.value!==w.value)return JSON.stringify({action:'assign',flag:w.flag,card_id:w.id,color:best.color,value:best.value});}return JSON.stringify({action:'begin'});}
 if(s.phase==='trim'){const f=s.flags[l.flag-1],cards=f.rows[seat],choices=cards.map((_,i)=>cards.filter((_,j)=>j!==i));choices.sort((a,b)=>compare(nfFormation(b,f.terrain.some(t=>t.id==='fog')),nfFormation(a,f.terrain.some(t=>t.id==='fog'))));return JSON.stringify({action:'trim',keep_ids:choices[0].map(t=>t.id)});}
 if(s.phase==='draw'||s.phase==='scout_draw')return JSON.stringify({action:s.phase,pile:l.piles.includes('troop')?'troop':l.piles[0]});
 if(s.phase==='scout_return')return JSON.stringify({action:'scout_return',card_ids:v.hand.slice().sort((a,b)=>(nfCard(a).value??11)-(nfCard(b).value??11)).slice(0,l.count)});
 const choices=[];for(const id of l.troop_card_ids)for(const flag of l.flags){const f=s.flags[flag-1],a=[...f.rows[seat],{id,at:0}],sc=nfFormation(a,f.terrain.some(t=>t.id==='fog')),own=s.flags.filter(f=>f.owner===seat).map(f=>f.id),near=own.some(n=>Math.abs(n-flag)<=2)?6:0;choices.push({move:{action:'place',card_id:id,flag},score:sc.rank*35+sc.sum+(a.length===nfCapacity(f)?16:0)+near});}
 if(choices.length){choices.sort((a,b)=>b.score-a.score);return JSON.stringify(choices[0].move);}
 const t=l.tactics.find(t=>t.type==='wild')||l.tactics[0];if(!t)return JSON.stringify({action:'pass'});
 if(t.type==='wild')return JSON.stringify({action:'tactic',card_id:t.card_id,flag:t.flags[0],color:'jade',value:nfValues(t.card_id).at(-1)});
 if(t.type==='terrain')return JSON.stringify({action:'tactic',card_id:t.card_id,flag:t.flags[0]});if(t.type==='scout')return JSON.stringify({action:'tactic',card_id:t.card_id});
 const target=t.targets[0];return JSON.stringify({action:'tactic',card_id:t.card_id,target_id:target.card_id,to_flag:t.type==='redeploy'?null:t.type==='traitor'?t.destination_flags[0]:undefined});
}
