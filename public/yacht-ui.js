import {bindResultShare} from './result-share.js';
import {createDiceRollBuffer} from './dice-audio.js';
const noteDrafts=new Map(),replyStates=new Map();let noteFocus=null;
function stored(key){try{return sessionStorage.getItem(key);}catch{return null;}}
function saveLocal(key,value){try{sessionStorage.setItem(key,value);}catch{}}
export function userNote(s){return noteDrafts.get(s.id)??stored('gameapps-note:'+s.id)??'';}
export function clearUserNote(s,submitted){if(userNote(s)!==submitted)return;noteDrafts.set(s.id,'');saveLocal('gameapps-note:'+s.id,'');}
export function captureConversation(s){const el=document.activeElement;noteFocus=el?.id==='game-user-note'?{id:s.id,start:el.selectionStart,end:el.selectionEnd}:null;}
export function conversationPanel(s,{includeNote=true}={}){
 const latest=s.conversation.at(-1);
 const open=replyStates.get(s.id)??stored('gameapps-reply:'+s.id)!=='closed';
 return `${s.conversation.length?`<details id="game-latest-reply" ${open?'open':''}><summary>直近の返答</summary>${latest.operationUnverified?`<p class="operation-warning" role="status">${esc(latest.warning||'操作が未完了の返答です。確定情報は盤面で確認してください。')}</p>`:''}<p class="quote">${esc(latest.text)}</p></details>`:''}${includeNote&&s.mode==='nexus'&&s.status==='playing'?`<div class="game-note"><label for="game-user-note">ペルソナへ一言 <span class="muted">任意</span></label><textarea id="game-user-note" rows="3" maxlength="500" placeholder="この一手、どうかな？" aria-describedby="game-note-help">${esc(userNote(s))}</textarea><p id="game-note-help" class="small muted">${s.game==='hitblow'?'次の予想・続行判断時（対戦後の単独推理中は終了時）':['liars','nineflags','quartet','indian','lastcard','texas','daifugo'].includes(s.game)?'次の選択時（相手へ通知するタイミングでまとめて送信）':s.game==='blackjack'?'あなたの手番終了時（ベット時の一言も保存）':s.game==='yacht'?'次の役の確定時':'次の着手時'}に、あなたの言葉として一緒に送ります。</p></div>`:''}`;
}
export function bindConversation(s){
 const reply=$('#game-latest-reply');if(reply)reply.ontoggle=()=>{replyStates.set(s.id,reply.open);saveLocal('gameapps-reply:'+s.id,reply.open?'open':'closed');};
 const input=$('#game-user-note');if(input){input.oninput=()=>{noteDrafts.set(s.id,input.value);saveLocal('gameapps-note:'+s.id,input.value);};if(noteFocus?.id===s.id){input.focus({preventScroll:true});input.setSelectionRange(noteFocus.start,noteFocus.end);}}
 noteFocus=null;
}
export function recoveryPanel(s){
 if(s.mode!=='nexus'||s.status==='abandoned')return '';
 const d=s.delivery,problem=['error','action_required'].includes(d.status),pending=d.status==='pending';
 const canResume=(d.recoveryReady||d.status==='action_required')&&((s.status==='playing'&&s.turn!==s.humanColor)||(s.status==='finished'&&!s.resultNotified));
 return `<details class="game-recovery" ${problem?'open':''}><summary>${problem?'接続・対局の復旧':'接続に困ったとき'}</summary><p class="small">対局の状態はEmerald Arcadeに保存されています。本体を起動し直してから接続を確認できます。</p>${pending?'<p class="small muted">現在の応答待ちは最大3分です。待機中は重複送信を防ぐため、手番を送り直しません。</p>':''}<div class="button-row"><button class="secondary" data-game-recovery="${pending?'check':'recover'}">${pending?'接続だけ確認':'接続を確認して復旧'}</button>${canResume?`<button class="primary" data-game-recovery="resume">${s.status==='finished'?'終了通知を再開':d.status==='action_required'?'未実行の操作をもう一度依頼':'相手の手番を再開'}</button>`:''}</div><p id="game-recovery-feedback" class="small" role="status"></p></details>`;
}
export function bindRecovery(s,api,refresh,toast){
 document.querySelectorAll('[data-game-recovery]').forEach(button=>button.onclick=async()=>{
  button.disabled=true;const action=button.dataset.gameRecovery;
  try{const result=await api(`games/${s.id}/${action}`,'POST',{});if(action==='check')$('#game-recovery-feedback').textContent=result.message;else{await refresh();toast(action==='resume'?'保存済みの対局から手番を再開します。':'接続を確認しました。保存済みの対局から続けられます。');}}
  catch(error){const output=$('#game-recovery-feedback');if(output)output.textContent=error.message;else toast(error.message);}
  finally{button.disabled=false;}
 });
}
const categories=[['ones','エース','1の目の合計'],['twos','デュース','2の目の合計'],['threes','トレイ','3の目の合計'],['fours','フォー','4の目の合計'],['fives','ファイブ','5の目の合計'],['sixes','シックス','6の目の合計'],['choice','チョイス','5個の合計'],['four_kind','フォーダイス','同じ目4個以上：合計'],['full_house','フルハウス','3＋2、または5個同じ：合計'],['small_straight','S.ストレート','4連番：15点'],['big_straight','B.ストレート','5連番：30点'],['yacht','ヨット','5個同じ：50点']];
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dots={1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]};
export const dieFace=(n)=>`<span class="die-face" aria-hidden="true">${Array.from({length:9},(_,i)=>`<i class="${dots[n]?.includes(i)?'pip':''}"></i>`).join('')}</span>`;
let holds=new Set(),selected=null,session=null,lastVersion=null,animationUntil=0,context,audioUnlocked=false,replay=null;
function audio(settings,kind,diceCount=5){
 if(!settings.sound||Number(settings.volume??.45)<=0||!audioUnlocked)return;
 try{
  context??=new AudioContext();context.resume();const start=context.currentTime,volume=Number(settings.volume??.45)*.18;
  if(kind==='roll'){
   const source=context.createBufferSource(),gain=context.createGain();
   source.buffer=createDiceRollBuffer(context,diceCount);gain.gain.value=volume*3.2;
   source.connect(gain).connect(context.destination);source.onended=()=>{source.disconnect();gain.disconnect();};source.start(start);
  }else{
   const notes=kind==='yacht'?[523.25,659.25,783.99,1046.5]:kind==='keep'?[520]:[660,880];
   notes.forEach((note,i)=>{const oscillator=context.createOscillator(),gain=context.createGain(),t=start+i*.085;oscillator.type='sine';oscillator.frequency.value=note;gain.gain.setValueAtTime(volume,t);gain.gain.exponentialRampToValueAtTime(.001,t+.22);oscillator.connect(gain).connect(context.destination);oscillator.start(t);oscillator.stop(t+.24);});
  }
 }catch{}
}
export function yachtRules(){
 let dialog=$('#yacht-rules');if(!dialog){dialog=document.createElement('dialog');dialog.id='yacht-rules';dialog.setAttribute('aria-labelledby','yacht-rules-title');dialog.innerHTML=`<div class="dialog-heading"><div><span class="eyebrow">HOW TO PLAY / YACHT</span><h2 id="yacht-rules-title">ヨットのルールブック</h2></div><button class="close" aria-label="閉じる">×</button></div><p>5個のサイコロから役を作る、運と選択のゲームです。</p><ol class="rules-list"><li><strong>1手番に最大3投。</strong><p>最初に5個すべて振ります。残したいダイスをクリックしてキープし、それ以外を振り直せます。途中でキープを解除することもできます。</p></li><li><strong>好きなタイミングで1つの役に記録。</strong><p>1投目から確定できます。各役は1回だけ。不成立の役に0点で記録することもできます。選んだ役の点数を確認して「確定」を押してください。</p></li><li><strong>12ラウンドで合計点を競う。</strong><p>交互に手番を進め、ふたりが12役を埋めたら終了。同点なら引き分けです。</p></li></ol><table class="yacht-rules-table"><thead><tr><th>役</th><th>成立条件・得点</th></tr></thead><tbody>${categories.map(([,name,hint])=>`<tr><td>${name}</td><td>${hint}</td></tr>`).join('')}</tbody></table><p class="bonus-note">上段6役の合計が63点以上なら、ボーナス＋35点！</p><details><summary>採用ルールについて</summary><p>Emerald Arcadeヨット12役版v1です。フォーダイス・フルハウスは5個の合計、S.ストレート15点、B.ストレート30点。5個同じ目もフルハウスとして記録できます。2回目以降のヨットに追加ボーナスはありません。ヨットやヤッツィーには別の採点方式もあるため、本Appではこのルールで統一します。</p></details><details><summary>サイコロと効果音</summary><p>出目はサーバーが無作為に生成します。アニメーションの途中で値を選んだり、ペルソナが好きな目を指定したりはできません。効果音は画面のスイッチでON/OFF、音量は共通設定で調整できます。動きを控えめにする設定にも対応します。</p></details>`;document.body.append(dialog);dialog.querySelector('.close').onclick=()=>dialog.close();}dialog.showModal();
}
export function renderYacht({s,history,settings,api,refresh,toast,openStart,onSettings}){
 captureConversation(s);
 if(session!==s.id){session=s.id;holds=new Set(s.held||[]);selected=null;lastVersion=null;replay=null;}
 if(selected&&s.sheets[s.turn][selected]!==undefined)selected=null;
 const changed=lastVersion!==null&&lastVersion!==s.version;
 if(changed){if(s.lastMove?.action==='roll')animationUntil=Date.now()+700;holds=new Set(s.held||[]);selected=null;if(s.lastMove?.action==='roll')audio(settings,'roll',5-(s.lastMove.held?.length||0));else if(s.lastMove?.action==='score'&&s.lastMove.points)audio(settings,s.lastMove.category==='yacht'?'yacht':'score');}
 const animate=s.lastMove?.action==='roll'&&Date.now()<animationUntil;lastVersion=s.version;
 const shown=replay===null?s:history[Math.max(0,replay)]||s,live=replay===null;
 const human=shown.humanColor,persona=3-human,yours=shown.turn===human;
 const active=live&&s.status==='playing'&&yours&&s.delivery.status!=='pending'&&s.delivery.status!=='error';
 const selectedScore=selected?shown.options[selected]:undefined;
 const status=s.status==='finished'?(s.result==='draw'?'引き分け！':s.result==='win'?'あなたの勝ち！':`${esc(s.personaName)}の勝ち！`):s.status==='abandoned'?'この対局は中止しました。':yours?'あなたの番です。':`${esc(s.personaName)}の番です。`;
 const lastScore=s.lastMove?.action==='score'?s.lastMove:null;
 $('#main').innerHTML=`<div class="page-top"><div><a href="#home" class="breadcrumb">← ゲーム選択</a><h2>ヨット <span class="yacht-word">YACHT</span></h2></div><button class="secondary" id="yacht-rule-open">？ ルールブック</button></div>
 <div class="yacht-topline"><span class="badge">ROUND ${shown.round} / 12</span><span>${live?'5つのダイス。残すか、振るか。':'操作履歴を振り返っています'}</span><button class="secondary" id="yacht-sound">${settings.sound?'♪ 音ON':'♪ 音OFF'}</button></div>
 <div class="players yacht-players">${[[human,'あなた'],[persona,esc(s.personaName)]].map(([p,name])=>`<div class="player ${shown.turn===p&&s.status==='playing'?'current':''}"><span class="avatar-die">${p===1?'Ⅰ':'Ⅱ'}</span><div class="name">${name}<small>${shown.totals[p].filled} / 12役</small></div><span class="score">${shown.totals[p].total}<small>POINTS</small></span></div>`).join('')}</div>
 ${s.status==='finished'?`<div class="result-banner"><span class="eyebrow">GOOD GAME</span><h2>${status}</h2><p>あなた ${s.totals[human].total}点 ／ ${esc(s.personaName)} ${s.totals[persona].total}点</p><button class="text-button" id="yacht-rematch">もう一局 ↗</button></div>`:''}
 <div class="yacht-layout"><section><div class="dice-tray ${animate?'rolling':''} ${lastScore?.category==='yacht'&&lastScore.points===50?'yacht-celebration':''}"><span class="eyebrow">${shown.rolls?`ROLL ${shown.rolls} OF 3`:'READY TO ROLL'}</span><div class="dice-row">${shown.dice.map((n,i)=>`<button class="die ${holds.has(i+1)&&live?'held':''} ${shown.held?.includes(i+1)&&!live?'held':''}" data-die="${i+1}" aria-label="ダイス${i+1}：${n||'未投球'}${holds.has(i+1)?'、キープ中':''}" aria-pressed="${holds.has(i+1)}" ${!active||!shown.rolls?'disabled':''}>${n?dieFace(n):'<span class="unrolled">?</span>'}<span class="keep-label">${holds.has(i+1)&&live?'KEEP':i+1}</span></button>`).join('')}</div><p class="dice-help">${shown.rolls?'残したいダイスを選んでキープ。もう一度押すと解除。':'まずは5個、振ってみよう。'}</p><button class="primary roll-button" id="yacht-roll" ${!active||shown.rolls>=3||holds.size===5?'disabled':''}>${shown.rolls?'残りを振りなおす':'サイコロを振る'} <span>↻</span></button><p class="small muted">${3-shown.rolls}投 残り${holds.size?' ／ '+holds.size+'個キープ':''}</p></div>
 <p class="board-status" role="status">${status} ${s.status==='playing'&&shown.rolls===3?'3投しました。記録する役を選んでください。':''}</p>
 ${lastScore?`<div class="yacht-score-receipt"><span>${lastScore.actor==='human'?'あなた':esc(s.personaName)}の記録</span><strong>${lastScore.categoryName} <em>＋${lastScore.points}</em></strong><span class="receipt-dice">${lastScore.dice.join(' · ')}</span></div>`:''}
 <div class="side-panel yacht-details"><h3>ふたりのテーブル</h3><p class="small muted">${s.mode==='practice'?'ローカルの練習ボットと対戦。本体へは送信しません。':esc(s.delivery.message||'手番の終了をNexusArkへ伝えます。')}</p>${recoveryPanel(s)}${conversationPanel(s)}${s.status==='playing'?'<button class="text-button" id="yacht-end">対局を終了する</button>':''}</div>
 ${history.length?`<div class="replay-controls"><button class="secondary" id="yacht-prev" aria-label="前の操作">‹</button><span class="small">${replay===null?'現在':(replay+1)+' / '+history.length}</span><button class="secondary" id="yacht-next" aria-label="次の操作">›</button><button class="text-button" id="yacht-live">${live?'振り返る':'最新へ'}</button></div>`:''}</section>
 <section class="scorecard"><div class="scorecard-heading"><span class="eyebrow">SCORE SHEET</span><h3>どの役に、記録する？</h3><p>点数を選んで、下のボタンで確定。</p></div><table><thead><tr><th>役・条件</th><th>あなた</th><th>${esc(s.personaName)}</th></tr></thead><tbody>${categories.map(([id,name,hint],i)=>{const n=shown.sheets[human][id],p=shown.sheets[persona][id],candidate=active&&n===undefined&&shown.rolls>0;return `<tr class="${selected===id?'selected':''} ${i===6?'lower-section':''}"><th><strong>${name}</strong><small>${hint}</small></th><td>${candidate?`<button class="score-option ${shown.options[id]===0?'zero':''}" data-category="${id}" aria-pressed="${selected===id}">${shown.options[id]}<small>点</small></button>`:n===undefined?'<span class="empty-score">—</span>':`<strong>${n}</strong>`}</td><td>${p===undefined?'<span class="empty-score">—</span>':`<strong>${p}</strong>`}</td></tr>`;}).join('')}<tr class="bonus-row"><th>上段ボーナス<small>63点以上で＋35点</small></th><td>${shown.totals[human].upper}/63<br><strong>＋${shown.totals[human].bonus}</strong></td><td>${shown.totals[persona].upper}/63<br><strong>＋${shown.totals[persona].bonus}</strong></td></tr><tr class="total-row"><th>合計</th><td>${shown.totals[human].total}</td><td>${shown.totals[persona].total}</td></tr></tbody></table><div class="score-confirm"><p role="status">${selected?`${categories.find(c=>c[0]===selected)[1]}に ${selectedScore}点を記録${selectedScore===0?'（この役を0点で使います）':''}`:'未使用の役を選んでください。'}</p><button class="primary wide" id="yacht-confirm" ${!active||selected===null?'disabled':''}>${selectedScore===0?'0点でこの役を確定':'この役で確定する'}</button></div></section></div>`;
 bindConversation(s);bindRecovery(s,api,refresh,toast);
 $('#yacht-rule-open').onclick=yachtRules;
 const act=async move=>{const note=move.startsWith('score:')&&s.mode==='nexus'?userNote(s):undefined;document.querySelectorAll('#yacht-roll,#yacht-confirm,[data-die],[data-category]').forEach(b=>b.disabled=true);audioUnlocked=true;try{if(settings.sound){context??=new AudioContext();context.resume();}await api(`games/${s.id}/move`,'POST',{move,version:s.version,note});if(note!==undefined)clearUserNote(s,note);selected=null;holds=new Set();await refresh();}catch(e){toast(e.message);await refresh();}};
 document.querySelectorAll('[data-die]').forEach(b=>b.onclick=()=>{audioUnlocked=true;const i=Number(b.dataset.die);holds.has(i)?holds.delete(i):holds.add(i);audio(settings,'keep');renderYacht({s,history,settings,api,refresh,toast,openStart,onSettings});});
 document.querySelectorAll('[data-category]').forEach(b=>b.onclick=()=>{selected=b.dataset.category;renderYacht({s,history,settings,api,refresh,toast,openStart,onSettings});});
 $('#yacht-roll').onclick=()=>act(holds.size?'roll:'+[...holds].sort().join(','):'roll');$('#yacht-confirm').onclick=()=>act('score:'+selected);
 $('#yacht-sound').onclick=async()=>{audioUnlocked=true;const next=await api('settings','POST',{sound:!settings.sound});onSettings(next);audio(next,'keep');renderYacht({s,history,settings:next,api,refresh,toast,openStart,onSettings});};
 if($('#yacht-end'))$('#yacht-end').onclick=()=>$('#confirm-dialog').showModal();
 if($('#yacht-rematch'))$('#yacht-rematch').onclick=()=>openStart('yacht');
 if(history.length){$('#yacht-prev').onclick=()=>{replay=Math.max(0,(replay??history.length)-1);renderYacht({s,history,settings,api,refresh,toast,openStart,onSettings});};$('#yacht-next').onclick=()=>{replay=Math.min(history.length-1,(replay??history.length-1)+1);renderYacht({s,history,settings,api,refresh,toast,openStart,onSettings});};$('#yacht-live').onclick=()=>{replay=replay===null?0:null;renderYacht({s,history,settings,api,refresh,toast,openStart,onSettings});};}
 bindResultShare(s,settings);
}
