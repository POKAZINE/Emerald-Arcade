import {randomInt} from 'node:crypto';
import {paraphraseWords} from './paraphrase-words.mjs';
import {maskExplanation,normalizeAnswer} from '../public/paraphrase-text.js';
const copy=x=>structuredClone(x),now=()=>new Date().toISOString();
function text(v){if(typeof v!=='string'||!v.trim()||v.length>4000)throw Error('説明・回答を入力してください（保存上限4000文字）。');return v.trim();}
function deal(s){const pool=paraphraseWords.filter(w=>!s.used.includes(w.id));if(!pool.length)throw Error('お題を使い切りました。');s.secret=copy(pool[randomInt(pool.length)]);s.used.push(s.secret.id);s.clues=[];s.guesses=[];s.phase='explain';s.turn=s.explainer;s.event='説明役が、別のことばで伝える準備をしています。';}
export function initialParaphrase(quick=false,roleMode='alternate'){
 if(!['alternate','user','persona','random'].includes(roleMode))throw Error('説明役の設定を選んでください。');
 const s={game:'paraphrase',humanColor:1,turn:1,playStyle:quick?'quick':'standard',roundLimit:quick?1:5,roundNumber:1,roleMode,explainer:roleMode==='user'?1:roleMode==='persona'?2:randomInt(2)+1,passes:{1:0,2:0},rounds:[],exchanges:[],used:[],ruleVersion:'paraphrase-v1'};deal(s);return s;
}
function finish(s,reason,actor){s.rounds.push({number:s.roundNumber,explainer:s.explainer,answer:s.secret.answer,clues:copy(s.clues),guesses:copy(s.guesses),reason,at:now()});s.phase='review';s.turn=1;s.event=reason==='solved'?'通じ合いました！ふたりのことばを振り返ろう。':'答えを開きました。次はどんな言いかえに出会えるかな。';if(s.roundNumber===s.roundLimit){s.status='finished';s.result='clear';s.endedAt=now();if(actor==='persona')s.resultNotified=true;}}
export function applyParaphrase(before,raw,actor){
 if(before.status!=='playing')throw Error('このゲームは終了しています。');let m;try{m=typeof raw==='string'?JSON.parse(raw):raw;}catch{throw Error('操作をJSONで指定してください。');}if(!m||typeof m!=='object'||Array.isArray(m)||!['human','persona'].includes(actor))throw Error('操作を確認してください。');const seat=actor==='human'?1:2;if(before.turn!==seat)throw Error('相手の手番です。');const s=copy(before);
 if(m.action==='pass'){
  if(s.phase==='review'||s.roundLimit===1||s.passes[seat]>=1)throw Error('お題の交換は通常版で一人1回までです。');if(m.confirm!==true)throw Error('お題の交換を確認してください。');s.exchanges.push({by:seat,number:s.roundNumber,answer:s.secret.answer,clues:copy(s.clues),guesses:copy(s.guesses)});s.passes[seat]++;deal(s);s.event='お題を交換しました。同じ問題番号・同じ説明役で、新しく始めます。';
 }else if(s.phase==='review'){
  if(m.action!=='next'||actor!=='human')throw Error('次の問題はユーザーが開始します。');s.roundNumber++;if(s.roleMode==='alternate')s.explainer=3-s.explainer;else if(s.roleMode==='random')s.explainer=randomInt(2)+1;deal(s);
 }else if(s.phase==='explain'){
  if(m.action!=='explain')throw Error('専用の説明文を送ってください。');const masked=maskExplanation(text(m.text));s.clues.push({text:masked,at:now()});s.phase='guess';s.turn=3-s.explainer;s.event='説明が届きました。どんなことばか、考えてみよう。';
 }else if(s.phase==='guess'){
  if(m.action==='more'||m.action==='rephrase'){
   if(s.clues.length>=3)throw Error('追加の説明は2回までです。');s.phase='explain';s.turn=s.explainer;s.event=m.action==='rephrase'?'別の言い方をお願いしました。追加の説明を1回使います。':'もう少し説明をお願いしました。';
  }else if(m.action==='guess'){
   const answer=text(m.text),correct=[s.secret.answer,...s.secret.aliases].some(a=>normalizeAnswer(a)===normalizeAnswer(answer));s.guesses.push({text:answer,correct,at:now()});if(correct)finish(s,'solved',actor);else if(s.clues.length===3||s.guesses.length===3)finish(s,'attempts',actor);else{s.phase='explain';s.turn=s.explainer;s.event='まだ違うことばのようです。追加の説明を待ちましょう。';}
  }else throw Error('回答、追加説明のお願い、お題の交換を選んでください。');
 }else throw Error('現在の段階を確認してください。');s.version=before.version+1;s.lastMove={actor,action:m.action,at:now()};return s;
}
export function paraphraseStats(s){const solved=s.rounds.filter(r=>r.reason==='solved');return {solved:solved.length,first:solved.filter(r=>r.clues.length===1).length,added:solved.filter(r=>r.clues.length>1).length,total:s.roundLimit,exchanges:s.exchanges.length};}
function projection(s,seat){const {secret,used,exchanges,...v}=copy(s);v.exchanges=exchanges.map(({by,number})=>({by,number}));v.answer=seat===s.explainer||s.phase==='review'?secret.answer:null;v.summary=paraphraseStats(s);delete v.board;return v;}
export const paraphraseView=s=>projection(s,1);
export function paraphraseContext(s){const v=projection(s,2);delete v.conversation;delete v.delivery;delete v.nexusUrl;const active=s.status==='playing'&&s.phase!=='review'&&s.turn===2;return {...v,session_id:s.id,room_id:s.roomId,turn:s.turn===2?'persona':'user',your_role:s.explainer===2?'explainer':'guesser',legal_actions:active?[s.phase==='explain'?'explain':'guess',...(s.phase==='guess'&&s.clues.length<3?['more','rephrase']:[]),...(s.roundLimit>1&&s.passes[2]===0?['pass']:[])]:[],...(active?{move_example:{action:s.phase==='explain'?'explain':'guess',text:s.phase==='explain'?'意味や使い道を、日本語の別のことばで説明':'思いついた答え'}}:{}),...(s.explainer===2&&s.phase!=='review'?{explanation_guide:'意味・用途・特徴を別の日本語で伝える。単に外来語をひらがな・漢字・英語へ置き換えるのは禁止。例：ダウンロード→悪い例「だうんろーど」「download」、良い例「離れた場所の情報を、自分の機械へ取り込むこと」。説明は最初80文字程度、追加40文字程度の目安。少し超えても受理される。カタカナ・英字は連続部分ごとに＊＊＊へ伏字化され、元の説明は相手に届かない。'}:{}),rules:'協力して通じ合った回数を楽しむ。説明1回につき回答1回、追加説明は2回まで。正誤はシステムが判定。通常5問はお互い1回ずつお題交換可、交換分は5問に含まない。お試し1問は交換不可。',instructions:s.status==='finished'?'終了。公開された答えと説明・成績を振り返る。操作不要。':s.phase==='review'?'この問題は終了。公開された答えと説明を振り返る。次はユーザーが開始。':s.explainer===2?'あなたは説明役。answerだけを説明し、gameapps_play_moveでexplainを登録。答えそのもの、表記を変えただけの外来語を説明に入れない。通常発話で追加のヒント・答え・伏字前の説明を明かさず、専用欄の説明だけで進める。成功後の発話は短い応援にする。':'あなたは回答役。秘密の答えは渡していない。公開cluesだけからguess、またはmoreで追加説明を依頼。正解を捏造せずツールの判定を確認する。分からなければpass（confirm:true、通常版一人1回まで）。'};}
export function paraphrasePracticeAction(c){if(c.your_role==='explainer'){const w=paraphraseWords.find(w=>w.answer===c.answer);return {action:'explain',text:w?.clue||'身近な暮らしで使うもの。'};}const found=paraphraseWords.find(w=>c.clues.some(cl=>cl.text===maskExplanation(w.clue)));if(found)return {action:'guess',text:found.answer};return c.clues.length<3?{action:'more'}:{action:'guess',text:'わかりません'};}
export const paraphraseBotMove=s=>JSON.stringify(paraphrasePracticeAction(paraphraseContext(s)));
