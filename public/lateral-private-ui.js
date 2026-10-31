const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let controller;
export function resetPrivateLateralStart(){controller?.reset();}
export async function initPrivateLateral({api,toast,isLocal}){
 const form=document.querySelector('#start-form'),options=document.querySelector('#lateral-options');
 const block=document.createElement('div');block.className='lt-private-start';block.hidden=true;
 block.innerHTML='<input type="hidden" name="privatePuzzleId" disabled><button type="button" class="secondary" id="lt-private-pick">私用の問題を選ぶ（一時）</button><p class="small muted" id="lt-private-selection"></p><button type="button" class="text-button" id="lt-private-reset" hidden>通常の出題に戻す</button>';
 options.append(block);
 const input=block.querySelector('input'),pick=block.querySelector('#lt-private-pick'),caption=block.querySelector('#lt-private-selection'),reset=block.querySelector('#lt-private-reset');
 const management=document.createElement('div');management.className='lt-private-settings';management.hidden=true;
 management.innerHTML='<h3>私用の創作問題</h3><p class="small muted">問題文や真相を表示せず、選択ボタンの表示と問題の削除を管理できます。</p><button type="button" class="secondary">私用問題を管理する</button>';
 const settingsForm=document.querySelector('#settings-form');settingsForm.insertBefore(management,settingsForm.querySelector('button[type=submit]').parentElement);
 let catalogue={enabled:false,puzzles:[]},selected=null,sequence=0;
 const compatible=()=>catalogue.puzzles.filter(p=>p.roomId===form.roomId.value&&p.available);
 const paint=()=>{
  const lateral=form.game.value==='lateral',eligible=form.mode.value==='nexus'?compatible():[];
  if(selected&&!eligible.some(p=>p.id===selected.id))selected=null;
  block.hidden=!lateral||!catalogue.enabled||!catalogue.puzzles.length;
  input.disabled=block.hidden||!selected;input.value=input.disabled?'':selected.id;
  pick.disabled=!eligible.length;pick.textContent=selected?'私用の問題を選び直す（一時）':'私用の問題を選ぶ（一時）';
  caption.textContent=selected?'選択中：'+selected.label+'。問題文は「謎を開く」で初めて表示します。':form.mode.value!=='nexus'?'「NexusArkのペルソナと遊ぶ」を選ぶと使えます。':!eligible.length?'登録元の接続先・ペルソナを選ぶと使えます。':'通常の出題には混ざりません。問題文・真相を見ずに選べます。';
  reset.hidden=!selected;
  form.ltGenre.disabled=form.ltDifficulty.disabled=!lateral||!!selected;
  management.hidden=!isLocal()||!catalogue.puzzles.length;
 };
 const load=async()=>{const run=++sequence;try{const data=await api('lateral-private');if(run===sequence){catalogue=data;paint();}}catch{if(run===sequence){catalogue={enabled:false,puzzles:[]};selected=null;paint();}}};
 const dialog=(id,title,content)=>{
  document.querySelector('#'+id)?.remove();const d=document.createElement('dialog');d.id=id;d.className='lt-private-dialog';d.setAttribute('aria-labelledby',id+'-title');
  d.innerHTML='<div class="dialog-heading"><h2 id="'+id+'-title">'+title+'</h2><button type="button" class="close" aria-label="閉じる">×</button></div>'+content;
  d.querySelector('.close').onclick=()=>d.close();document.body.append(d);d.showModal();return d;
 };
 controller={reset(){selected=null;paint();load();}};
 form.mode.addEventListener('change',()=>{selected=null;paint();});form.roomId.addEventListener('change',paint);
 // Room options arrive asynchronously after the mode change.
 new MutationObserver(paint).observe(form.roomId,{childList:true});
 reset.onclick=()=>{selected=null;paint();};
 pick.onclick=async()=>{
  await load();const available=compatible();if(!available.length||!catalogue.enabled)return;
  const d=dialog('lt-private-picker','私用の問題を選ぶ','<p class="small muted">内容は表示しません。選択しただけでは開始・送信されません。</p><div class="lt-private-list">'+available.map(p=>'<label><input type="radio" name="private-choice" value="'+esc(p.id)+'" '+(selected?.id===p.id?'checked':'')+'><span>'+esc(p.label)+'</span></label>').join('')+'</div><div class="button-row"><button type="button" class="primary" id="lt-private-choose" disabled>この問題を選ぶ</button><button type="button" class="secondary" id="lt-private-cancel">戻る</button></div>');
  const choose=d.querySelector('#lt-private-choose');choose.disabled=!selected;
  d.querySelectorAll('input').forEach(r=>r.onchange=()=>choose.disabled=false);
  d.querySelector('#lt-private-cancel').onclick=()=>d.close();
  choose.onclick=()=>{const id=d.querySelector('input:checked')?.value;selected=available.find(p=>p.id===id)||null;paint();d.close();};
 };
 const manage=async()=>{
  await load();if(!isLocal()||!catalogue.puzzles.length)return;
  const d=dialog('lt-private-manager','私用問題の管理','<p class="small muted">配布用の問題集とは別に、このPCのdata内だけに保存しています。</p><label class="lt-private-toggle"><input type="checkbox" id="lt-private-visible" '+(catalogue.enabled?'checked':'')+'> 一時的な問題選択ボタンを表示する</label><p class="small muted">非表示にしても問題は残ります。ここから再表示できます。</p><div class="lt-private-list">'+catalogue.puzzles.map(p=>'<div><span>'+esc(p.label)+'</span><button type="button" class="secondary" data-private-delete="'+esc(p.id)+'">削除…</button></div>').join('')+'</div><p class="small muted">削除は問題集からのみ行います。遊んだ対局の問題・真相は記録に残り、元の創作ノートは変更しません。配布時はdata全体を除外してください。</p><p class="error" role="status" id="lt-private-error"></p>');
  d.querySelector('#lt-private-visible').onchange=async e=>{const box=e.target;box.disabled=true;try{catalogue=await api('lateral-private','POST',{action:'visibility',enabled:box.checked});paint();toast(box.checked?'問題選択ボタンを再表示しました。':'問題選択ボタンを非表示にしました。共通設定から戻せます。');}catch(error){box.checked=!box.checked;d.querySelector('#lt-private-error').textContent=error.message;}finally{box.disabled=false;}};
  d.querySelectorAll('[data-private-delete]').forEach(button=>button.onclick=()=>{
   const p=catalogue.puzzles.find(p=>p.id===button.dataset.privateDelete);
   const confirm=dialog('lt-private-delete','この私用問題を削除しますか？','<p>'+esc(p.label)+'</p><p class="small muted">問題集から削除すると選び直せません。遊んだ対局の記録と元の創作ノートは残ります。</p><div class="button-row"><button type="button" class="secondary" id="lt-private-keep">残す</button><button type="button" class="primary" id="lt-private-remove">削除する</button></div><p class="error" role="status"></p>');
   confirm.querySelector('#lt-private-keep').onclick=()=>confirm.close();
   confirm.querySelector('#lt-private-remove').onclick=async e=>{e.target.disabled=true;try{catalogue=await api('lateral-private','POST',{action:'delete',id:p.id,confirm:true});selected=null;paint();confirm.close();d.close();toast('私用問題を問題集から削除しました。');}catch(error){confirm.querySelector('.error').textContent=error.message;e.target.disabled=false;}};
  });
 };
 management.querySelector('button').onclick=manage;
 document.querySelector('#settings-open').addEventListener('click',load);
 await load();
}
