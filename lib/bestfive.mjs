import {randomInt,randomUUID} from 'node:crypto';
import {bestfiveTopics} from './bestfive-topics.mjs';
const copy=x=>structuredClone(x),now=()=>new Date().toISOString();
function text(v,max=600){if(typeof v!=='string'||!v.trim()||v.length>max)throw Error('1〜'+max+'文字で入力してください。');return v.trim();}
function permutation(order,items){const ids=items.map(i=>i.id);if(!Array.isArray(order)||order.length!==5||new Set(order).size!==5||order.some(id=>!ids.includes(id)))throw Error('5項目を重複なく、一つずつ並べてください。');return [...order];}
function choices(s,exclude=[]){const used=s.rounds.map(r=>r.topic.id),pool=bestfiveTopics.filter(t=>t.genre===s.genre&&!used.includes(t.id)&&!exclude.includes(t.id));for(let i=pool.length-1;i>0;i--){const j=randomInt(i+1);[pool[i],pool[j]]=[pool[j],pool[i]];}return copy(pool.slice(0,3));}
export function initialBestfive(quick=false,genre='daily',first='random'){
 if(!['daily','close'].includes(genre)||!['random','user','persona'].includes(first))throw Error('お題の雰囲気と最初の出題者を確認してください。');
 const s={game:'bestfive',humanColor:1,turn:1,playStyle:quick?'quick':'standard',roundLimit:quick?1:2,roundNumber:1,setter:first==='random'?randomInt(2)+1:first==='user'?1:2,phase:'topic',genre,topic:null,candidates:[],secret:null,lives:3,guesses:[],questions:[],pending:null,rounds:[],event:'まずは二人で話したいお題を選びましょう。',ruleVersion:'bestfive-v1'};s.candidates=choices(s);return s;
}
function closeRound(s,reason,actor){
 const best=s.guesses.length?Math.max(...s.guesses.map(g=>g.matches)):null,topHit=s.guesses.some(g=>g.order[0]===s.secret.order[0]);
 s.rounds.push({number:s.roundNumber,setter:s.setter,topic:copy(s.topic),order:copy(s.secret.order),reasons:copy(s.secret.reasons),guesses:copy(s.guesses),questions:copy(s.questions),reason,lives:s.lives,bestMatches:best,topHit,at:now()});s.phase='review';s.turn=1;s.pending=null;s.event=reason==='solved'?'5つの順位が、ぴったり一致しました！':'秘密のランキングを開きました。好きの理由を見比べましょう。';
 if(s.roundNumber===s.roundLimit){s.status='finished';s.result='clear';s.endedAt=now();if(actor==='persona')s.resultNotified=true;}
}
export function applyBestfive(before,raw,actor){
 if(before.status!=='playing')throw Error('このゲームは終了しています。');let m;try{m=typeof raw==='string'?JSON.parse(raw):raw;}catch{throw Error('操作はJSON文字列で指定してください。');}if(!m||typeof m!=='object'||Array.isArray(m)||!['human','persona'].includes(actor))throw Error('操作を確認してください。');
 const seat=actor==='human'?1:2;if(seat!==before.turn)throw Error('相手の返事を待ってから操作してください。');const s=copy(before);
 if(s.phase==='topic'){
  if(actor!=='human')throw Error('お題はユーザーが選びます。');
  if(m.action==='reroll'){const next=choices(s,s.candidates.map(c=>c.id));if(next.length===3)s.candidates=next;else s.candidates=choices(s);s.event='別のお題候補に変えました。まだ送信していません。';}
  else if(m.action==='choose'){const t=s.candidates.find(t=>t.id===m.topic);if(!t)throw Error('候補からお題を選んでください。');s.topic=copy(t);s.candidates=[];s.phase='setup';s.turn=s.setter;s.event='出題者が、秘密の順位と理由を決めています。';}
  else throw Error('お題を選んでください。');
 }else if(s.phase==='setup'){
  if(m.action!=='set'||seat!==s.setter)throw Error('出題者が順位を確定してください。');const order=permutation(m.order,s.topic.items),reasons={};for(const id of order)reasons[id]=text(m.reasons?.[id],160);s.secret={order,reasons};s.phase='table';s.turn=3-s.setter;s.event='順位を封印しました。質問しながら、好きの順番を探ってみよう。';
 }else if(s.phase==='review'){
  if(actor!=='human'||m.action!=='next'||s.roundNumber>=s.roundLimit)throw Error('次のラウンドへはユーザーが進めます。');s.roundNumber++;s.setter=3-s.setter;s.phase='topic';s.turn=1;s.topic=null;s.secret=null;s.lives=3;s.guesses=[];s.questions=[];s.pending=null;s.candidates=choices(s);s.event='出題者を交代しました。次のお題を選びましょう。';
 }else if(s.phase==='table'){
  if(m.action==='reveal'){
   if(actor!=='human'&&seat===s.setter)throw Error('回答者の挑戦を待ってください。');if(m.confirm!==true)throw Error('答えを公開することを確認してください。');closeRound(s,'revealed',actor);
  }else if(s.pending){
   if(m.action!=='answer')throw Error('届いている質問・予想に返事をしてください。');const reply=text(m.text);if(s.pending.kind==='question'){s.questions.find(q=>q.id===s.pending.id).answer=reply;}else s.guesses[s.pending.index].comment=reply;s.pending=null;s.turn=3-s.setter;s.event='返事が届きました。予想を考えてみよう。';
  }else{
   if(seat===s.setter)throw Error('回答者の質問・予想を待ってください。');
   if(m.action==='ask'){const q={id:randomUUID(),text:text(m.text),answer:null,at:now()};s.questions.push(q);s.pending={kind:'question',id:q.id};s.turn=s.setter;s.event='質問を出題者へ伝えています。ライフは減りません。';}
   else if(m.action==='guess'){const order=permutation(m.order,s.topic.items),matches=order.filter((id,i)=>id===s.secret.order[i]).length;s.guesses.push({order,matches,comment:null,at:now()});if(matches===5)closeRound(s,'solved',actor);else {s.lives--;if(s.lives===0)closeRound(s,'attempts',actor);else {s.pending={kind:'feedback',index:s.guesses.length-1};s.turn=s.setter;s.event='順位の一致は'+matches+'／5。出題者の一言を待っています。';}}}
   else throw Error('質問、予想、または答えを見る操作を選んでください。');
  }
 }else throw Error('現在の段階を確認してください。');
 s.version=before.version+1;s.lastMove={actor,action:m.action,at:now()};return s;
}
function projection(s,seat){const revealed=s.phase==='review',owns=seat===s.setter;return {id:s.id,game:s.game,mode:s.mode,roomId:s.roomId,personaName:s.personaName,nexusUrl:s.nexusUrl,humanColor:1,turn:s.turn,status:s.status,version:s.version,createdAt:s.createdAt,endedAt:s.endedAt,result:s.result,resultNotified:s.resultNotified,delivery:copy(s.delivery),conversation:copy(s.conversation),lastMove:copy(s.lastMove),playStyle:s.playStyle,roundLimit:s.roundLimit,roundNumber:s.roundNumber,setter:s.setter,phase:s.phase,genre:s.genre,topic:copy(s.topic),candidates:copy(s.candidates),lives:s.lives,guesses:copy(s.guesses),questions:copy(s.questions),pending:copy(s.pending),rounds:copy(s.rounds),event:s.event,ranking:s.secret&&(owns||revealed)?copy(s.secret):null,ruleVersion:s.ruleVersion};}
export const bestfiveView=s=>projection(s,1);
export function bestfiveContext(s){const v=projection(s,2);delete v.delivery;delete v.conversation;delete v.nexusUrl;const action=s.phase==='setup'?'set':s.phase==='table'?s.pending?'answer':'ask / guess / reveal':null;const move_example=action==='set'?{action:'set',order:s.topic.items.map(i=>i.id),reasons:Object.fromEntries(s.topic.items.map(i=>[i.id,'この項目が好きな理由']))}:action==='answer'?{action:'answer',text:'好みや理由についての返事'}:{action:'ask',text:'どんな場面で選びたくなりますか？'};return {...v,...(s.status==='playing'&&s.turn===2?{move_example}:{}),session_id:s.id,room_id:s.roomId,turn:s.turn===2?'persona':'user',your_role:s.setter===2?'setter':'guesser',legal_actions:s.status==='playing'&&s.turn===2?(action==='ask / guess / reveal'?['ask','guess','reveal']:[action]):[],rules:'好みを知る会話ゲーム。5項目・同率なし、下位も嫌いという意味ではありません。質問ではライフ消費なし、予想が外れると1減り、3回まで。途中は一致数だけ公開、正解位置や1位的中は未公開。出題者と回答者を交代し、総合勝敗は付けません。',instructions:s.status==='finished'?'ゲーム終了。全ラウンドの公開順位と好きな理由を振り返る。総合勝敗なし。操作不要。':s.phase==='review'?'操作不要。公開された順位と理由、予想を振り返って話してください。次の開始はユーザーです。':s.phase==='setup'?'あなたは出題者。自分らしい好みで、topic.itemsの全5IDを好きな順に並べ、各項目の理由も先に固定します。moveはJSON文字列 {"action":"set","order":["項目ID5つ"],"reasons":{"項目ID":"短い好きの理由"}}。順位と理由はまだ発話しない。ツール成功後、質問を促してください。':s.pending?'moveはJSON文字列 {"action":"answer","text":"質問または予想結果への短い返事"}。あなたは出題者。固定のrankingを変えず、その価値観から答えてください。数字の順位、1位/最下位、AはBより上など位置や正解を直接教えない。途中の予想の正しい項目や1位的中も教えず、気持ち・状況・好きな理由を自然に話す。直接順位を聞かれたらやさしく別の質問へ促す。予想への一言はツールに登録してから自然に会話。':'あなたは回答者。ユーザーの秘密の順位は分かりません。自分の好みで代弁しない。moveはJSON文字列 {"action":"ask","text":"価値観を探る質問"} または {"action":"guess","order":["項目ID5つ"]}。質問ではライフ消費なし、順位や大小関係を直接尋ねず価値観を探ってください。過去の予想とmatchesに矛盾しない順を検討。外れたら出題者が返事をするので待つ。一度に1操作。操作を必ず実行し、成功してから会話。降りる場合は {"action":"reveal","confirm":true}。'};}
function permutations(a){return a.length===1?[a]:a.flatMap((v,i)=>permutations(a.filter((_,j)=>j!==i)).map(p=>[v,...p]));}
export function bestfivePracticeAction(c){
 if(c.phase==='setup'){const order=c.topic.items.map(i=>i.id);for(let i=4;i>0;i--){const j=randomInt(i+1);[order[i],order[j]]=[order[j],order[i]];}return {action:'set',order,reasons:Object.fromEntries(order.map(id=>[id,'操作練習用の好みです。自分のペースで楽しめるところに惹かれます。']))};}
 if(c.pending)return {action:'answer',text:c.pending.kind==='question'?'操作練習用の返事です。手軽さや、落ち着いて楽しめる雰囲気を大切にしたいです。':'その予想は'+c.guesses.at(-1).matches+'／5一致でした。好みの理由を手がかりに、もう少し考えてみよう。'};
 if(!c.questions.length)return {action:'ask',text:'この中で、疲れた日にも楽しみたいものはありますか？'};
 const pool=permutations(c.topic.items.map(i=>i.id)).filter(p=>c.guesses.every(g=>p.filter((id,i)=>id===g.order[i]).length===g.matches));return {action:'guess',order:pool[0]||c.topic.items.map(i=>i.id)};
}
export const bestfiveBotMove=s=>JSON.stringify(bestfivePracticeAction(bestfiveContext(s)));
