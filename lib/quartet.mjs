import {QUARTET_PIECES,QUARTET_TRAITS,quartetPiece,quartetLabel,quartetTraitWord} from '../public/quartet-pieces.js';
const lines=[...Array.from({length:4},(_,r)=>Array.from({length:4},(_,c)=>r*4+c)),...Array.from({length:4},(_,c)=>Array.from({length:4},(_,r)=>r*4+c)),[0,5,10,15],[3,6,9,12]];
export const quartetCell=i=>String.fromCharCode(65+i%4)+(Math.floor(i/4)+1);
export function quartetIndex(cell){if(Number.isInteger(cell)&&cell>=0&&cell<16)return cell;if(typeof cell==='string'&&/^[A-D][1-4]$/i.test(cell))return (Number(cell[1])-1)*4+cell.toUpperCase().charCodeAt(0)-65;throw Error('A1〜D4の空きマスを選んでください。');}
export function quartetWins(board){return lines.flatMap(cells=>{const pieces=cells.map(i=>quartetPiece(board[i]));if(pieces.some(p=>!p))return [];const attributes=QUARTET_TRAITS.filter(([key])=>pieces.every(p=>p[key]===pieces[0][key])).map(([key])=>({key,value:pieces[0][key],label:quartetTraitWord(key,pieces[0][key])}));return attributes.length?[{cells:[...cells],attributes}]:[];});}
export function initialQuartet(firstGiver='random'){
 if(!['random','user','persona'].includes(firstGiver))throw Error('最初に駒を渡す人を選んでください。');
 const first=firstGiver==='random'?(Math.random()<.5?1:2):firstGiver==='user'?1:2;
 return {game:'quartet',humanColor:1,turn:first,phase:'give',firstGiver:first,board:Array(16).fill(null),remaining:QUARTET_PIECES.map(p=>p.id),held:null,moveCount:0,events:[],winningGroups:[],pendingUserNotes:[],ruleVersion:'quartet-pattern-v1'};
}
export function applyQuartet(before,raw,actor){
 if(before.game!=='quartet'||before.status!=='playing')throw Error('この対局は終了しています。');
 if(!['human','persona'].includes(actor)||actor!==(before.turn===1?'human':'persona'))throw Error('まだあなたの操作ではありません。');
 let m;try{m=typeof raw==='string'?JSON.parse(raw):raw;}catch{throw Error('操作はJSON文字列で指定してください。');}if(!m||Array.isArray(m)||typeof m!=='object')throw Error('操作を確認してください。');
 const s=structuredClone(before),at=new Date().toISOString();let event;
 if(s.phase==='give'){
  if(m.action!=='give'||!s.remaining.includes(m.piece_id))throw Error('未使用の駒を選び、giveで渡してください。');
  s.remaining=s.remaining.filter(id=>id!==m.piece_id);s.held={pieceId:m.piece_id,from:s.turn,to:3-s.turn};event={action:'give',pieceId:m.piece_id,actor,seat:s.turn,to:3-s.turn};s.turn=3-s.turn;s.phase='place';
 }else{
  if(m.action!=='place'||!s.held||s.held.to!==s.turn)throw Error('受け取った駒をplaceで置いてください。');
  const index=quartetIndex(m.cell);if(s.board[index]!==null)throw Error('そのマスには駒があります。空きマスを選んでください。');
  if(m.piece_id!==undefined&&m.piece_id!==s.held.pieceId)throw Error('置けるのは、相手から受け取った駒だけです。');
  const id=s.held.pieceId;s.board[index]=id;s.held=null;s.moveCount++;event={action:'place',pieceId:id,index,cell:quartetCell(index),actor,seat:s.turn};s.winningGroups=quartetWins(s.board);
  if(s.winningGroups.length||s.moveCount===16){s.status='finished';s.phase='finished';s.result=s.winningGroups.length?(s.turn===1?'win':'loss'):'draw';s.endedAt=at;s.winner=s.winningGroups.length?s.turn:null;}else s.phase='give';
 }
 s.version=before.version+1;s.lastMove={...event,at,version:s.version};s.events.push(s.lastMove);return s;
}
export function quartetView(s){return {id:s.id,game:s.game,mode:s.mode,roomId:s.roomId,personaName:s.personaName,nexusUrl:s.nexusUrl,humanColor:1,turn:s.turn,status:s.status,phase:s.phase,version:s.version,createdAt:s.createdAt,endedAt:s.endedAt,result:s.result,resultNotified:s.resultNotified,firstGiver:s.firstGiver,board:[...s.board],remaining:[...s.remaining],held:s.held?{...s.held}:null,moveCount:s.moveCount,lastMove:s.lastMove,events:structuredClone(s.events),winningGroups:structuredClone(s.winningGroups),delivery:s.delivery,conversation:s.conversation,legalCells:s.status==='playing'&&s.phase==='place'?s.board.flatMap((p,i)=>p===null?[quartetCell(i)]:[]):[],legalPieces:s.status==='playing'&&s.phase==='give'?[...s.remaining]:[]};}
export function quartetContext(s){return {session_id:s.id,room_id:s.roomId,game:'quartet',version:s.version,status:s.status,turn:s.status==='playing'?(s.turn===1?'user':'persona'):null,phase:s.phase,board:Array.from({length:4},(_,r)=>s.board.slice(r*4,r*4+4)),orientation:'列A〜Dは左から右、行1〜4は上から下。nullは空き。全駒は共有で、明暗は所属を表さない。',pieces:Object.fromEntries(QUARTET_PIECES.map(p=>[p.id,quartetLabel(p)])),received_piece:s.held?.pieceId??null,legal_actions:s.status!=='playing'?[]:s.phase==='give'?{action:'give',piece_ids:[...s.remaining]}:{action:'place',cells:quartetView(s).legalCells},last_move:s.lastMove,winning_groups:s.winningGroups,rules:'4×4。明暗・丸/四角・穴の有無・無地/しま模様の4特徴。縦横と端から端への対角線で、1つ以上の共通点がある4駒を揃えた配置者が勝ち。2×2は対象外。勝利は自動判定。最初は相手へ駒を渡すだけ。受け取った駒を置いたら、残りから相手へ渡す駒を選ぶ。',instructions:s.status==='playing'?'あなたはAIの対局者、ユーザーは人間。phaseとlegal_actionsに従いgameapps_play_moveのmoveにJSON文字列を指定。placeは {"action":"place","cell":"B2"}、giveは {"action":"give","piece_id":"q03"}。受け取った駒以外は配置不可。place成功後もaction_requiredなら、返された最新versionで必ずgiveまで続ける。同じ会話要求内で自分の操作を終えてから発話する。全引数はinput_args内。勝敗はサーバー確定。駒の特徴を確認し、事実と推測を区別してあなたらしく話す。':'操作不要。確定した盤面・共通点・勝敗を受けて振り返る。'};}
function winningCells(board,id){return board.flatMap((p,i)=>{if(p!==null)return [];const b=[...board];b[i]=id;return quartetWins(b).length?[i]:[];});}
export function quartetBotMove(s){
 if(s.phase==='give'){const choices=s.remaining.map(id=>({id,danger:winningCells(s.board,id).length}));choices.sort((a,b)=>a.danger-b.danger);return JSON.stringify({action:'give',piece_id:choices[0].id});}
 const id=s.held.pieceId,wins=winningCells(s.board,id);if(wins.length)return JSON.stringify({action:'place',cell:quartetCell(wins[0])});
 const cells=s.board.flatMap((p,i)=>p===null?[i]:[]);const score=i=>{const b=[...s.board];b[i]=id;let danger=0;if(s.moveCount>=2&&s.remaining.length){danger=Infinity;for(const piece of s.remaining){danger=Math.min(danger,winningCells(b,piece).length);if(danger===0)break;}}return danger*100+Math.abs(i%4-1.5)+Math.abs(Math.floor(i/4)-1.5);};
 const choices=cells.map(cell=>({cell,score:score(cell)}));choices.sort((a,b)=>a.score-b.score);return JSON.stringify({action:'place',cell:quartetCell(choices[0].cell)});
}
