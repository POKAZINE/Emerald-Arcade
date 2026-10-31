import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {spawn,spawnSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {collectPackage,knownSecrets,sha256,makeZip} from './release-lib.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const ensure=(ok,message)=>{if(!ok)throw Error(message);};
const under=(parent,child)=>child.startsWith(parent+path.sep);
function checkedOutput(){
 const release=path.join(ROOT,'release');if(fs.existsSync(release)&&fs.lstatSync(release).isSymbolicLink())throw Error('releaseをリンク先へ出力しません。');
 fs.mkdirSync(release,{recursive:true});ensure(under(fs.realpathSync(ROOT),fs.realpathSync(release)),'出力先はGameApps内にしてください。');return release;
}
function cleanupWork(release,work){
 const target=path.resolve(work);ensure(under(path.resolve(release),target)&&/^\.work-[a-f0-9-]+$/.test(path.basename(target)),'作業フォルダの削除対象を確認してください。');
 if(fs.existsSync(target)){ensure(!fs.lstatSync(target).isSymbolicLink()&&under(fs.realpathSync(release),fs.realpathSync(target)),'作業フォルダの実体を確認してください。');fs.rmSync(target,{recursive:true,force:true});}
}
function runTests(){
 fs.mkdirSync(path.join(ROOT,'test-output'),{recursive:true});
 const tests=fs.readdirSync(path.join(ROOT,'tests')).filter(n=>n.endsWith('.test.mjs')).sort().map(n=>path.join('tests',n));ensure(tests.length,'検証用テストがありません。');
 console.log('2/4 全テストを実行しています…');
 const r=spawnSync(process.execPath,['--no-warnings','--test',...tests],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:180000,maxBuffer:32*1024*1024});
 ensure(r.status===0,'テストに失敗しました。npm testで詳細を確認してください。ZIPは生成していません。');
 const count=r.stdout.match(/^# tests (\d+)/m)?.[1];console.log('    '+(count||tests.length)+'件のテストに成功しました。');return {passed:true,count:Number(count||0)};
}
async function smoke(folder,entries){
 const probe=http.createServer();await new Promise((r,j)=>{probe.once('error',j);probe.listen(0,'127.0.0.1',r);});const port=probe.address().port;await new Promise(r=>probe.close(r));
 const env={...process.env,GAMEAPPS_PORT:String(port),NODE_OPTIONS:''};delete env.GAMEAPPS_DATA_DIR;
 const child=spawn(process.execPath,['--no-warnings','server.mjs','--no-open'],{cwd:folder,env,stdio:'pipe',windowsHide:true});let spawnError;child.on('error',e=>spawnError=e);child.stdout.resume();child.stderr.resume();
 const exited=new Promise(r=>child.once('exit',r)),base='http://127.0.0.1:'+port+'/gameapps';
 const request=async route=>{const r=await fetch(base+route,{signal:AbortSignal.timeout(2000)});ensure(r.ok,'初期状態の起動確認に失敗しました: '+route);return r;};
 try{
  let ready=false;for(let i=0;i<100;i++){if(spawnError||child.exitCode!==null)break;try{if((await request('/api/health')).ok){ready=true;break;}}catch{}await pause(100);}ensure(ready,'配布用コピーの起動に失敗しました。');
  const settings=await(await request('/api/settings')).json(),client=await(await request('/api/client')).json(),games=await(await request('/api/games')).json(),privateLibrary=await(await request('/api/lateral-private')).json();
  ensure(settings.lanEnabled===false&&settings.hasToken===false&&client.local===true&&client.lanActive===false,'初期設定が新規利用者用になっていません。');
  ensure(games.length===0&&privateLibrary.enabled===false&&privateLibrary.puzzles.length===0,'個人データが初期状態へ混入しています。');
  const db=new DatabaseSync(path.join(folder,'data','games.sqlite'),{readOnly:true});let stored;try{stored=JSON.parse(db.prepare('SELECT body FROM settings WHERE id=1').get().body);}finally{db.close();}
  ensure(stored.mcpToken?.length>=32&&stored.lanToken?.length>=32&&!stored.nexusToken,'利用者ごとの新規キーを確認できません。');
  for(const entry of entries.filter(e=>e.name.startsWith('public/'))){const r=await request(entry.name==='public/index.html'?'/':'/'+entry.name.slice(7));ensure(Buffer.from(await r.arrayBuffer()).equals(entry.bytes),'画面用ファイルの配信内容が一致しません: '+entry.name);}
  ensure(child.exitCode===null,'起動確認中にサーバーが停止しました。');
  return {freshSettings:true,emptyRecords:true,privateSelectorUnavailable:true,lanOff:true,newKeysGenerated:true,staticFilesServed:true};
 }finally{
  if(child.exitCode===null&&!spawnError){try{await fetch(base+'/api/shutdown',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(2000)});}catch{}await Promise.race([exited,pause(2000)]);if(child.exitCode===null){child.kill();await Promise.race([exited,pause(2000)]);}}
 }
}
async function main(){
 const args=process.argv.slice(2);ensure(args.every(a=>a==='--check')&&args.length<=1,'使用方法: node scripts/release.mjs [--check]');
 const checkOnly=args.includes('--check'),config=JSON.parse(fs.readFileSync(path.join(ROOT,'release.config.json'),'utf8'));
 console.log('1/4 収録対象・参照先・既知の私用情報を確認しています…');
 const secrets=knownSecrets(ROOT),packageInfo=collectPackage(ROOT,config,secrets),{entries,version,licensePresent}=packageInfo;
 for(const entry of entries.filter(e=>/\.(?:m?js|cjs)$/.test(e.name))){const r=spawnSync(process.execPath,['--check',path.join(ROOT,entry.name)],{cwd:ROOT,encoding:'utf8',windowsHide:true});ensure(r.status===0,'構文を確認してください: '+entry.name);}
 const tests=runTests();
 if(checkOnly){console.log('確認成功。'+entries.length+'ファイルが収録予定です。ZIPは作成していません。新規起動の確認はrelease:buildで行います。');return;}
 const release=checkedOutput(),work=path.join(release,'.work-'+randomUUID()),folder=path.join(work,'配布確認 '+config.archiveRoot);
 fs.mkdirSync(folder,{recursive:true});
 try{
  for(const entry of entries){const target=path.join(folder,entry.name);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,entry.bytes);}
  console.log('3/4 別ポート・空のデータで、配布用コピーの起動を確認しています…');
  const smokeResult=await smoke(folder,entries);
  // Smoke may create data, but only this captured allowlist is written to the ZIP.
  for(const entry of entries)ensure(fs.readFileSync(path.join(folder,entry.name)).equals(entry.bytes),'起動確認中に配布ファイルが変更されました: '+entry.name);
  const builtAt=new Date().toISOString(),id=config.archiveRoot.replace(/\s+/g,'-')+'-'+version+'-preview-'+builtAt.replace(/[-:]/g,'').replace(/\.\d+Z$/,'Z')+'-'+randomUUID().slice(0,6);
  const manifest={format:1,version,builtAt,kind:'preview',files:entries.map(e=>({path:e.name,bytes:e.bytes.length,sha256:sha256(e.bytes)}))};
  const zip=makeZip([...entries,{name:'PACKAGE-MANIFEST.json',bytes:Buffer.from(JSON.stringify(manifest,null,2)+'\n')}],config.archiveRoot),zipHash=sha256(zip);
  const report={version,builtAt,kind:'preview',tests,smoke:smokeResult,files:entries.length+1,zipSha256:zipHash,licenseFilePresent:licensePresent,manualReviewRequired:['アプリ名・ライセンス・素材の利用条件','対応するNexusArkの版と連携画面','各ゲームのPC／スマホ操作と利用者向け説明','GitHub公開時の管理対象と過去の履歴'],limitations:'既知のローカル秘密情報と明らかなキー・絶対パスを検査。任意の個人情報や権利関係を網羅する検査ではありません。'};
  const output=path.join(release,id);fs.mkdirSync(output);
  console.log('4/4 ZIP・チェックサム・収録一覧を保存しています…');
  fs.writeFileSync(path.join(output,id+'.zip'),zip,{flag:'wx'});fs.writeFileSync(path.join(output,id+'.zip.sha256'),zipHash+'  '+id+'.zip\n',{flag:'wx'});
  fs.writeFileSync(path.join(output,'PACKAGE-MANIFEST.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});fs.writeFileSync(path.join(output,'CHECK-REPORT.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  console.log('配布候補を作成しました: '+path.relative(ROOT,output));console.log('アップロード・Git操作・公開はしていません。公開前の確認事項はCHECK-REPORT.jsonを参照してください。');
 }finally{cleanupWork(release,work);}
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
