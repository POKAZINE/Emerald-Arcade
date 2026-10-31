import {randomInt,randomUUID} from 'node:crypto';
export const GEISTER_RULES='6×6、各自よいおばけ4体・わるいおばけ4体。初期位置は自陣中央4列×2段。交互に1体を上下左右1マス移動し、移動先の相手を捕獲して正体を公開する。相手のよいおばけ4体を取る／自分のわるいおばけ4体を取らせる／自分のよいおばけを相手側の角から盤外へ脱出、のいずれかで勝ち。出口へ到達しただけでは勝たず、次の自分の手番でescapeを使う。斜め・自分の駒のいるマスへは進めない。';
export const geisterSquare=i=>'ABCDEF'[i%6]+(Math.floor(i/6)+1);
export const geisterIndex=s=>typeof s==='string'&&/^[A-F][1-6]$/i.test(s)?(Number(s[1])-1)*6+'ABCDEF'.indexOf(s[0].toUpperCase()):-1;
const exits=seat=>seat===1?[0,5]:[30,35],clone=x=>structuredClone(x);
const initialSquares=seat=>seat===1?[25,26,27,28,31,32,33,34]:[1,2,3,4,7,8,9,10];
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=randomInt(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;}
export function initialGeister(firstPlayer='random'){
 if(!['random','user','persona'].includes(firstPlayer))throw Error('先手を選んでください。');
 const pieces=[];for(const seat of [1,2]){const kinds=shuffle(['good','good','good','good','bad','bad','bad','bad']);initialSquares(seat).forEach((pos,i)=>pieces.push({id:randomUUID(),label:seat===1?'ABCDEFGH'[i]:String(i+1),seat,pos,kind:kinds[i],state:'board'}));}
 return {game:'geister',humanColor:1,phase:'setup',turn:1,startingSeat:firstPlayer==='random'?randomInt(2)+1:firstPlayer==='user'?1:2,firstPlayer,pieces,setup:{1:false,2:false},captured:[],events:[],eventSerial:0,moveCount:0,winner:null,winReason:null};
}
export function geisterMoves(s,seat){if(s.status!=='playing'||s.phase!=='play'||s.turn!==seat)return [];const all=s.pieces.filter(p=>p.state==='board'),moves=[];for(const p of all.filter(p=>p.seat===seat)){const row=Math.floor(p.pos/6),col=p.pos%6;for(const [dr,dc]of [[-1,0],[1,0],[0,-1],[0,1]]){const r=row+dr,c=col+dc;if(r<0||r>5||c<0||c>5)continue;const to=r*6+c,target=all.find(q=>q.pos===to);if(target?.seat===seat)continue;moves.push({action:'move',piece_id:p.id,from:geisterSquare(p.pos),to:geisterSquare(to),...(target?{capture_id:target.id}:{})});}if(p.kind==='good'&&exits(seat).includes(p.pos))moves.push({action:'escape',piece_id:p.id,from:geisterSquare(p.pos)});}return moves;}
function event(s,e){s.events.push({seq:++s.eventSerial,...e,at:new Date().toISOString()});}
function finish(s,winner,reason){s.status='finished';s.winner=winner;s.winReason=reason;s.result=winner===1?'win':'loss';s.endedAt=new Date().toISOString();event(s,{type:'finish',winner,reason});}
export function applyGeister(before,raw,actor){
 if(before.game!=='geister'||before.status!=='playing')throw Error('この対局は終了しています。');if(!['human','persona'].includes(actor)||(actor==='human'?1:2)!==before.turn)throw Error('いまは相手の手番です。');
 let m;try{m=typeof raw==='string'?JSON.parse(raw):raw;}catch{throw Error('操作はJSON文字列で指定してください。');}if(!m||typeof m!=='object'||Array.isArray(m))throw Error('操作を指定してください。');const seat=actor==='human'?1:2,s=clone(before);
 if(s.phase==='setup'){
  if(m.action!=='setup'||!Array.isArray(m.good_ids)||m.good_ids.length!==4||new Set(m.good_ids).size!==4||m.good_ids.some(id=>!s.pieces.some(p=>p.id===id&&p.seat===seat)))throw Error('自分の8体から、よいおばけを4体選んでください。');
  for(const p of s.pieces.filter(p=>p.seat===seat))p.kind=m.good_ids.includes(p.id)?'good':'bad';s.setup[seat]=true;event(s,{type:'setup',seat});
  if(s.setup[1]&&s.setup[2]){s.phase='play';s.turn=s.startingSeat;event(s,{type:'start',seat:s.startingSeat});}else s.turn=3-seat;
 }else{
  if(!['move','escape'].includes(m.action))throw Error('moveまたはescapeを指定してください。');const move=geisterMoves(before,seat).find(x=>x.action===m.action&&x.piece_id===m.piece_id&&(m.action==='escape'||x.to===String(m.to).toUpperCase()));if(!move)throw Error('選べる移動先を確認してください。');
  const p=s.pieces.find(p=>p.id===m.piece_id),from=p.pos;s.moveCount++;s.lastMove={actor,seat,action:m.action,piece_id:p.id,label:p.label,from,at:new Date().toISOString()};
  if(m.action==='escape'){p.state='escaped';p.pos=null;s.lastMove.to=null;event(s,{type:'escape',seat,piece_id:p.id,label:p.label,from,kind:'good'});finish(s,seat,'escape');}
  else{
   const to=geisterIndex(move.to),victim=s.pieces.find(q=>q.state==='board'&&q.pos===to);p.pos=to;s.lastMove.to=to;
   if(victim){victim.state='captured';victim.pos=null;const captured={id:victim.id,label:victim.label,seat:victim.seat,kind:victim.kind,by:seat,square:to,move:s.moveCount};s.captured.push(captured);s.lastMove.captured=clone(captured);event(s,{type:'capture',seat,piece_id:p.id,label:p.label,from,to,captured});const same=s.captured.filter(q=>q.seat===victim.seat&&q.kind===victim.kind).length;if(same===4)finish(s,victim.kind==='good'?seat:victim.seat,victim.kind==='good'?'capture_good':'lose_bad');}
   else event(s,{type:'move',seat,piece_id:p.id,label:p.label,from,to});
   if(s.status==='playing')s.turn=3-seat;
  }
 }
 s.version=before.version+1;if(s.phase==='setup'||m.action==='setup')s.lastMove={actor,seat,action:'setup',at:new Date().toISOString()};return s;
}
// Opponent identities are omitted even after the game ends. Explicit reveal is a separate, finished-only read.
function project(s,seat){return {id:s.id,game:'geister',mode:s.mode,roomId:s.roomId,personaName:s.personaName,nexusUrl:s.nexusUrl,humanColor:1,turn:s.turn,status:s.status,phase:s.phase,version:s.version,createdAt:s.createdAt,endedAt:s.endedAt,result:s.result,resultNotified:s.resultNotified,delivery:s.delivery,conversation:s.conversation,lastMove:clone(s.lastMove),firstPlayer:s.firstPlayer,startingSeat:s.startingSeat,setup:clone(s.setup),pieces:s.pieces.map(p=>({id:p.id,label:p.label,seat:p.seat,pos:p.pos,state:p.state,...(p.seat===seat||p.state!=='board'?{kind:p.kind}:{})})),captured:clone(s.captured),events:clone(s.events.slice(-48)),eventSerial:s.eventSerial,moveCount:s.moveCount,winner:s.winner,winReason:s.winReason,legal_actions:geisterMoves(s,seat),setup_slots:initialSquares(seat).map(geisterSquare)};}
export const geisterView=s=>project(s,1);
export function geisterIdentities(s){if(s.status!=='finished')throw Error('正体の一括公開は対局終了後に選べます。');return Object.fromEntries(s.pieces.map(p=>[p.id,p.kind]));}
export function geisterContext(s){const v=project(s,2);delete v.delivery;delete v.conversation;delete v.events;return {...v,session_id:s.id,room_id:s.roomId,turn:s.status!=='playing'?null:s.turn===2?'persona':'user',your_seat:2,board_orientation:'A1=左上、F6=右下。あなたは上側（seat=2）、ユーザーは下側（seat=1）。あなたの脱出口はA6/F6、ユーザーはA1/F1。駒のlabelは正体と無関係。',recent_moves:s.events.filter(e=>['move','capture'].includes(e.type)).slice(-12),rules:GEISTER_RULES,instructions:s.status!=='playing'?'操作不要。確定した勝敗と理由を受けて会話してください。未公開の正体は明かさない。':s.phase==='setup'?'自分の8体からよいおばけ4体のidを選び、moveにJSON文字列 {"action":"setup","good_ids":["id1","id2","id3","id4"]}。残り4体はわるいおばけ。位置は固定の8マスで、選ぶことで正体の初期配置が決まる。成功後も自分の手番なら最新状態のlegal_actionsで着手を続ける。自分の配置・正体は発話しない。':'あなたが対局者。legal_actionsから1手を選び、moveにJSON文字列 {"action":"move","piece_id":"自分の駒ID","to":"A3"}、または {"action":"escape","piece_id":"脱出可能な自分の駒ID"}。全引数はinput_args内。操作成功を確認して会話。相手の未公開の正体は分からない。公開の動き・捕獲から推測してよいが、推測を事実として扱わない。自分の未公開の正体・初期配置・どの駒がおとりかは発話しない。作戦の詳しい解説は不要。あなたらしい口調や駆け引きの会話は自由。'};}
export function chooseGeisterBotAction(c){
 const own=c.pieces.filter(p=>p.seat===2&&p.state==='board');if(c.phase==='setup')return {action:'setup',good_ids:own.filter(p=>p.kind==='good').map(p=>p.id)};
 const escape=c.legal_actions.find(m=>m.action==='escape');if(escape)return {action:'escape',piece_id:escape.piece_id};
 const enemies=c.pieces.filter(p=>p.seat===1&&p.state==='board'),takenGood=c.captured.filter(p=>p.seat===1&&p.kind==='good').length,takenBad=c.captured.filter(p=>p.seat===1&&p.kind==='bad').length,pGood=(4-takenGood)/Math.max(1,enemies.length),dist=(a,b)=>Math.abs(Math.floor(a/6)-Math.floor(b/6))+Math.abs(a%6-b%6),goal=p=>Math.min(dist(p,30),dist(p,35));
 const scored=c.legal_actions.map(m=>{const p=own.find(p=>p.id===m.piece_id),to=geisterIndex(m.to),near=enemies.filter(e=>dist(e.pos,to)===1).length;let score=p.kind==='good'?(goal(p.pos)-goal(to))*6+Math.max(0,5-goal(to))*1.4-near*7:Math.min(...enemies.map(e=>dist(e.pos,p.pos)))-Math.min(...enemies.map(e=>dist(e.pos,to)))+near*3;
  if(m.capture_id)score+=pGood*(takenGood===3?90:16)-(1-pGood)*(takenBad===3?110:2);
  for(const old of c.recent_moves||[])if(old.piece_id===p.id&&old.from===to)score-=8;
  return {m,score:score+randomInt(100)/100};}).sort((a,b)=>b.score-a.score);if(!scored.length)throw Error('合法手が見つかりません。');const {action,piece_id,to}=scored[0].m;return {action,piece_id,to};
}
export const geisterBotMove=s=>JSON.stringify(chooseGeisterBotAction(geisterContext(s)));
