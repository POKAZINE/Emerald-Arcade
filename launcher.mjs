import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
const root=path.dirname(fileURLToPath(import.meta.url)),port=Number(process.env.GAMEAPPS_PORT||8040);
const url=`http://127.0.0.1:${port}/gameapps/`;
const noOpen=process.argv.includes('--no-open');
try{
 const response=await fetch(url+'api/health',{signal:AbortSignal.timeout(1200)});
 if(response.ok&&(await response.json()).app==='persona-gameapps'){
   if(noOpen)process.exit(0);
   const candidates=[process.env['ProgramFiles(x86)'],process.env.ProgramFiles,process.env.LOCALAPPDATA].filter(Boolean).map(p=>path.join(p,'Microsoft','Edge','Application','msedge.exe'));
   const edge=candidates.find(fs.existsSync);
   if(edge)spawn(edge,['--new-window',url],{detached:true,stdio:'ignore',windowsHide:true}).unref();
   else spawn('rundll32.exe',['url.dll,FileProtocolHandler',url],{detached:true,stdio:'ignore',windowsHide:true}).unref();
   process.exit(0);
 }
 throw Error('選択したポートは別のアプリが使用しています。GAMEAPPS_PORTを変更してください。');
}catch(e){if(!['TypeError','TimeoutError'].includes(e.name))throw e;}
fs.mkdirSync(path.join(root,'data'),{recursive:true});const log=fs.openSync(path.join(root,'data','server.log'),'a');
const child=spawn(process.execPath,['--no-warnings',path.join(root,'server.mjs'),...(noOpen?['--no-open']:[])],{cwd:root,detached:true,stdio:['ignore',log,log],windowsHide:true});child.unref();
let ready=false;
for(let i=0;i<30;i++){
 await new Promise(r=>setTimeout(r,200));
 try{const response=await fetch(url+'api/health',{signal:AbortSignal.timeout(500)});if(response.ok){ready=true;break;}}catch{}
}
if(!ready){console.error('起動できませんでした。data/server.log を確認してください。');process.exitCode=1;}
