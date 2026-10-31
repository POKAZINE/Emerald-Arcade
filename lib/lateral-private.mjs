import fs from 'node:fs';
import path from 'node:path';

// Private content stays under the user's data directory, never in public assets.
export class PrivateLateralLibrary {
 constructor(dataDir){this.file=path.join(dataDir,'private-lateral','library.json');}
 read(){
  if(!fs.existsSync(this.file))return {version:1,enabled:false,puzzles:[]};
  let d;try{d=JSON.parse(fs.readFileSync(this.file,'utf8'));}catch{throw Error('私用問題の保存ファイルを確認してください。');}
  if(d.version!==1||typeof d.enabled!=='boolean'||!Array.isArray(d.puzzles))throw Error('私用問題の保存形式を確認してください。');
  return d;
 }
 catalogue(nexusUrl){const d=this.read();return {enabled:d.enabled,puzzles:d.puzzles.map(p=>({id:p.id,label:p.label,roomId:p.roomId,available:nexusUrl===undefined||p.nexusUrl===nexusUrl}))};}
 get(id,roomId,nexusUrl){
  const d=this.read(),p=d.puzzles.find(p=>p.id===id);
  if(!d.enabled||!p)throw Error('私用問題を選び直してください。');
  if(p.roomId!==roomId||p.nexusUrl!==nexusUrl)throw Error('この私用問題は、登録元の接続先とペルソナを選んでください。');
  const text=v=>typeof v==='string'&&v.trim()&&v.length<=8000;
  if(!text(p.label)||!text(p.prompt)||!text(p.truth)||!Array.isArray(p.core)||!p.core.length||p.core.some(c=>!text(c.id)||!text(c.text))||!Array.isArray(p.facts)||p.facts.some(x=>!text(x))||!Array.isArray(p.hints)||p.hints.length>3||p.hints.some(x=>!text(x)))throw Error('私用問題の出題用データを確認してください。');
  return {id:p.id,number:null,title:p.label,genre:'private',difficulty:'normal',prompt:p.prompt,truth:p.truth,core:structuredClone(p.core),facts:[...p.facts],hints:[...p.hints]};
 }
 save(d){fs.mkdirSync(path.dirname(this.file),{recursive:true});const tmp=this.file+'.tmp';fs.writeFileSync(tmp,JSON.stringify(d,null,2),'utf8');fs.renameSync(tmp,this.file);}
 setEnabled(enabled){if(typeof enabled!=='boolean')throw Error('表示のON/OFFを指定してください。');const d=this.read();d.enabled=enabled;this.save(d);return this.catalogue();}
 remove(id,confirm){if(confirm!==true)throw Error('私用問題の削除を確認してください。');const d=this.read(),index=d.puzzles.findIndex(p=>p.id===id);if(index<0)throw Error('私用問題が見つかりません。');d.puzzles.splice(index,1);if(!d.puzzles.length)d.enabled=false;this.save(d);return this.catalogue();}
}
