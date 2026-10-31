import {randomInt} from 'node:crypto';
export const HB_COLORS=[['red','赤','●'],['blue','青','◆'],['green','緑','▲'],['yellow','黄','★'],['purple','紫','✚'],['white','白','■']];
export const HB_RULES='6色から4つを選び、色と順番を推理。答えは同色なし。予想には同じ色を複数使える（例：赤・赤・青・青）。双方に別々の答えをサーバーが生成し、交互に各8回まで予想。色と位置が一致した数がHIT、色だけ一致した数がBLOW。判定は個々の位置を示さない。正解までの回数を同じ回数まで揃えて比較し、同じ回数なら引き分け。双方8回で未正解も引き分け。勝敗確定後、未正解の側は続けるか終えるかを自分で選び、通算8回まで挑戦できる。追加の挑戦で勝敗は変わらない。同じ予想の再送には確認が必要。秘密の答えは、その側が正解・終了・8回到達するまで非公開。';
const ids=HB_COLORS.map(c=>c[0]);
export function judgeCode(answer,guess){let hits=0;const a={},g={};for(let i=0;i<answer.length;i++){if(answer[i]===guess[i])hits++;else{a[answer[i]]=(a[answer[i]]||0)+1;g[guess[i]]=(g[guess[i]]||0)+1;}}return {hits,blows:Object.keys(g).reduce((n,k)=>n+Math.min(g[k],a[k]||0),0)};}
export function makeCode(allowDuplicates=false,choose=randomInt){if(allowDuplicates)return Array.from({length:4},()=>ids[choose(6)]);const pool=[...ids],code=[];while(code.length<4)code.push(pool.splice(choose(pool.length),1)[0]);return code;}
export function initialHitBlow(first=1,allowDuplicates=false){return {game:'hitblow',turn:first,phase:'match',matchDecided:false,ruleVersion:'hitblow-6x4-v1',rulesConfig:{allowDuplicates,allowDuplicateGuesses:true,maxAttempts:8,slots:4},secrets:{1:makeCode(allowDuplicates),2:makeCode(allowDuplicates)},players:{1:{guesses:[],state:'guessing',solvedAt:null},2:{guesses:[],state:'guessing',solvedAt:null}},pendingUserNotes:[]};}
const done=p=>['solved','stopped','exhausted'].includes(p.state);
function guessFrom(move){const m=/^guess:([a-z]+(?:,[a-z]+){3})(:confirm)?$/.exec(move);return m?m[1].split(','):null;}
export function hitBlowDuplicate(s,move){const code=typeof move==='string'?guessFrom(move):null;if(!code||move.endsWith(':confirm'))return null;const prior=s.players[s.turn].guesses.find(g=>g.code.join(',')===code.join(','));return prior?{confirmation_required:true,message:`同じ並びを${prior.attempt}回目に試しています（${prior.hits} HIT / ${prior.blows} BLOW）。もう一度予想すると1回消費します。`,retry_move:move+':confirm',previous_attempt:prior.attempt}:null;}
export function hitBlowActions(s){if(s.status!=='playing')return [];const p=s.players[s.turn];if(p.state==='choice')return ['continue','stop'];if(p.state==='guessing')return s.matchDecided?['guess','stop']:['guess'];return [];}
function advance(s,seat){
 if(!s.matchDecided){const a=s.players[1],b=s.players[2],solvers=[1,2].filter(i=>s.players[i].solvedAt);const best=solvers.length?Math.min(...solvers.map(i=>s.players[i].solvedAt)):null;
  if((best!==null&&a.guesses.length>=best&&b.guesses.length>=best)||(a.guesses.length===8&&b.guesses.length===8)){
   const winner=best===null||a.solvedAt===b.solvedAt?null:a.solvedAt===best?1:2;s.matchDecided=true;s.winner=winner;s.result=winner===null?'draw':winner===s.humanColor?'win':'loss';s.decidedAt=new Date().toISOString();s.phase='afterplay';
   for(const p of Object.values(s.players))if(!done(p))p.state='choice';
  }
 }
 const unfinished=[1,2].filter(i=>!done(s.players[i]));
 if(!unfinished.length){s.status='finished';s.phase='finished';s.endedAt=new Date().toISOString();s.turn=s.humanColor;return;}
 s.turn=unfinished.includes(3-seat)?3-seat:unfinished[0];
}
export function applyHitBlow(s,move,actor){
 if(s.status!=='playing')throw Error('この挑戦は終了しています。');if(actor!==(s.turn===s.humanColor?'human':'persona'))throw Error('まだあなたの手番ではありません。');if(typeof move!=='string')throw Error('操作を指定してください。');
 const seat=s.turn,code=guessFrom(move),p=s.players[seat],action=code?'guess':move;
 if(!hitBlowActions(s).includes(action))throw Error('この段階ではその操作を選べません。');
 if(code&&(code.some(c=>!ids.includes(c))))throw Error('6色から4つ選んでください。予想には同じ色も使えます。');
 const duplicate=hitBlowDuplicate(s,move);if(duplicate)throw Error(duplicate.message+' 確認する場合は '+duplicate.retry_move+' を指定してください。');
 const a=structuredClone(s),player=a.players[seat],at=new Date().toISOString();
 if(action==='continue'){player.state='guessing';a.turn=seat;}
 else if(action==='stop'){player.state='stopped';advance(a,seat);}
 else{const result=judgeCode(a.secrets[seat],code),attempt=player.guesses.length+1;player.guesses.push({code,hits:result.hits,blows:result.blows,attempt,at});if(result.hits===4){player.state='solved';player.solvedAt=attempt;}else if(attempt===8)player.state='exhausted';advance(a,seat);}
 a.version=s.version+1;a.lastMove={actor,seat,action,at,...(code?{attempt:player.guesses.length,...player.guesses.at(-1)}:{})};return a;
}
export function hitBlowView(s){
 // Explicit whitelist: raw secrets must not leak through HTTP, history, MCP or events.
 const v=Object.fromEntries(['id','game','mode','roomId','personaName','nexusUrl','humanColor','turn','status','version','createdAt','endedAt','lastMove','result','delivery','conversation','userNote','resultNotified','ruleVersion','rulesConfig','players','phase','matchDecided','winner','decidedAt','pendingUserNotes'].map(k=>[k,s[k]]));
 return {...v,answers:Object.fromEntries([1,2].map(i=>[i,done(s.players[i])?s.secrets[i]:null])),legalActions:hitBlowActions(s),palette:HB_COLORS.map(([id,label,symbol])=>({id,label,symbol})),maxAttempts:s.rulesConfig.maxAttempts};
}
export function hitBlowRulesText(s){return HB_RULES.replace('答えは同色なし。',s.rulesConfig.allowDuplicates?'答えは同色あり（同じ色が複数入る場合がある）。':'答えは同色なし。');}
export function hitBlowContext(s){const v=hitBlowView(s);return {session_id:s.id,room_id:s.roomId,game:s.game,version:s.version,status:s.status,turn:s.status==='playing'?(s.turn===s.humanColor?'user':'persona'):null,persona_seat:3-s.humanColor,user_seat:s.humanColor,phase:s.phase,match_decided:s.matchDecided,result:s.result,winner:s.winner,players:v.players,answers:v.answers,palette:v.palette,answer_allows_duplicates:s.rulesConfig.allowDuplicates,guess_allows_duplicates:true,legal_actions:v.legalActions,rules:hitBlowRulesText(s),instructions:'あなたはユーザーと別の答えを推理する対局者です。両者の予想履歴とHIT/BLOWは公開ですが、相手と自分の答えは異なる問題です。自分の履歴をもとに推理してください。customカテゴリのgameapps_get_stateで最新状態を確認し、gameapps_play_moveの全引数をinput_args辞書にまとめて呼びます。moveはguess:red,blue,green,yellowの形式（色ID4つ。同じ色を複数使う予想も可能。answer_allows_duplicatesがtrueなら答えにも同じ色が複数入ることがあります）。同じ予想には確認要求が返るので、別の予想を考えるか、意図して繰り返すときのみ:confirmを末尾に付けます。勝敗確定後にlegal_actionsがcontinue/stopなら、続けたいか自分で判断して呼んでください。continue後はguessで推理を続けるかstopで終了。発話だけでは操作になりません。ツールの成功結果を確認して会話し、相手の公開された進捗にも自然に反応してください。ユーザーの手番には操作しません。'};}
export function hitBlowBotMove(s){if(s.players[s.turn].state==='choice')return 'continue';const history=s.players[s.turn].guesses;const candidates=[];for(const a of ids)for(const b of ids)for(const c of ids)for(const d of ids){const code=[a,b,c,d];if(!s.rulesConfig.allowDuplicates&&new Set(code).size!==4)continue;if(history.every(g=>{const r=judgeCode(code,g.code);return r.hits===g.hits&&r.blows===g.blows;}))candidates.push(code);}const chosen=candidates.find(c=>!history.some(g=>g.code.join(',')===c.join(',')));return chosen?'guess:'+chosen.join(','):'stop';}
