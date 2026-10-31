import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {deflateRawSync} from 'node:zlib';
import {builtinModules} from 'node:module';
import {DatabaseSync} from 'node:sqlite';

const sha256=b=>createHash('sha256').update(b).digest('hex');
export {sha256};
export function safeRelative(name){
 if(typeof name!=='string'||!name||name.includes('\\')||name.startsWith('/')||name.split('/').some(s=>!s||s==='.'||s==='..')||/[:\x00-\x1f]/.test(name))throw Error('配布ファイルの相対パスを確認してください。');
 return name;
}
function regularFile(root,relative){
 safeRelative(relative);let current=root;
 for(const part of relative.split('/')){current=path.join(current,part);if(fs.lstatSync(current).isSymbolicLink())throw Error('リンクされたファイル／フォルダは配布しません: '+relative);}
 if(!fs.statSync(current).isFile())throw Error('通常ファイルを指定してください: '+relative);
 return fs.readFileSync(current);
}
const forbidden=/(^|\/)(?:\.[^/]+|data|backups?|fixtures?|__tests__|tests|node_modules)(\/|$)|(?:\.sqlite(?:-wal|-shm)?|\.db|\.log|\.bak|\.pem|\.key|\.pfx|\.zip|~)$/i;
export function knownSecrets(root){
 const values=[];const dbFile=path.join(root,'data','games.sqlite');
 if(fs.existsSync(dbFile)){
  let db;try{db=new DatabaseSync(dbFile,{readOnly:true});const s=JSON.parse(db.prepare('SELECT body FROM settings WHERE id=1').get()?.body||'{}');for(const key of ['nexusToken','mcpToken','lanToken'])if(typeof s[key]==='string'&&s[key].length>=12)values.push(s[key]);}finally{db?.close();}
 }
 const file=path.join(root,'data','private-lateral','library.json');
 if(fs.existsSync(file)){const d=JSON.parse(fs.readFileSync(file,'utf8'));for(const p of d.puzzles||[])for(const key of ['prompt','truth'])if(typeof p[key]==='string'&&p[key].length>=12)values.push(p[key]);}
 return values;
}
export function scanContent(entries,secrets=[]){
 for(const {name,bytes} of entries){
  const text=bytes.toString('utf8');
  if(secrets.some(secret=>bytes.includes(Buffer.from(secret))||text.includes(JSON.stringify(secret).slice(1,-1))))throw Error('収録予定のファイルに私用情報との一致があります。本文は表示しません: '+name);
  if(/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\bAIza[\w-]{30,}|\bsk-[A-Za-z0-9_-]{24,}/.test(text)||/(?:nexusToken|mcpToken|lanToken|api[_-]?key|access[_-]?token)["']?\s*[:=]\s*["'][^"'\r\n]{16,}["']/i.test(text))throw Error('収録予定のファイルに秘密キーらしい値があります。本文は表示しません: '+name);
  if(/(?:[A-Z]:[\\/]+Users[\\/]+[^\\/\s"']+[\\/]|\/Users\/[^/\s"']+\/|\/home\/[^/\s"']+\/)/i.test(text))throw Error('収録予定のファイルに個人環境の絶対パスがあります: '+name);
 }
}
export function collectPackage(root,config,secrets=[]){
 const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
 if(!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(pkg.version))throw Error('package.jsonの版番号を確認してください。');
 if(Object.keys(pkg.dependencies||{}).length||Object.keys(pkg.optionalDependencies||{}).length)throw Error('外部依存が追加されています。依存を含めた配布方法を先に更新してください。');
 safeRelative(config.archiveRoot);if(config.archiveRoot.includes('/'))throw Error('ZIPのルート名は1フォルダにしてください。');
 const entries=[],seen=new Set();
 const add=(source,target=source)=>{safeRelative(source);safeRelative(target);if(forbidden.test(source)||forbidden.test(target))throw Error('配布対象外のパスは明示しても収録しません: '+target);const folded=target.toLowerCase();if(['package.json','package-manifest.json'].includes(folded))throw Error('生成用に予約されたファイル名です: '+target);if(seen.has(folded))throw Error('大文字小文字を区別しない環境でファイル名が重複します: '+target);seen.add(folded);entries.push({name:target,bytes:regularFile(root,source)});};
 const walk=relative=>{safeRelative(relative);if(fs.lstatSync(path.join(root,relative)).isSymbolicLink())throw Error('リンクされたフォルダは配布しません: '+relative);for(const item of fs.readdirSync(path.join(root,relative),{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name,'en'))){const name=relative+'/'+item.name;if(forbidden.test(name)||item.isSymbolicLink())throw Error('実行用フォルダに配布対象外のファイルがあります: '+name);if(item.isDirectory())walk(name);else{if(!config.allowedRuntimeExtensions.includes(path.extname(name).toLowerCase()))throw Error('未知の素材形式です。配布設定を確認してください: '+name);add(name);}}};
 for(const dir of config.runtimeDirectories)walk(dir);
 for(const file of config.runtimeFiles)add(file);
 for(const doc of config.documents)add(doc.source,doc.target);
 const notices=config.optionalDocuments.filter(name=>fs.existsSync(path.join(root,name)));for(const file of notices)add(file);
 const classified=new Set([...config.runtimeDirectories,...config.runtimeFiles,...config.developmentOnly,...config.optionalDocuments]);
 const unknown=fs.readdirSync(root).filter(name=>!classified.has(name));if(unknown.length)throw Error('ルート直下に未分類の項目があります。release.config.jsonを確認してください: '+unknown.join(', '));
 const releasePkg={name:pkg.name,version:pkg.version,private:true,description:pkg.description,type:'module',scripts:{start:'node --no-warnings server.mjs'},engines:pkg.engines};
 entries.push({name:'package.json',bytes:Buffer.from(JSON.stringify(releasePkg,null,2)+'\n')});
 entries.sort((a,b)=>a.name.localeCompare(b.name,'en'));
 if(entries.reduce((n,e)=>n+e.bytes.length,0)>256*1024*1024)throw Error('配布サイズが256MiBを超えました。生成方法の見直しが必要です。');
 scanContent(entries,secrets);checkReferences(entries);
 return {entries,version:pkg.version,licensePresent:notices.some(n=>/^LICENSE/.test(n))};
}
export function checkReferences(entries){
 const names=new Set(entries.map(e=>e.name));
 for(const entry of entries){
  const refs=[];const text=entry.bytes.toString('utf8');
  if(/\.(?:m?js|cjs)$/.test(entry.name)){
   for(const m of text.matchAll(/\b(?:import|export)\s+(?:[^;\n]*?\s+from\s*)?["']([^"']+)["']/g))refs.push(m[1]);
   for(const m of text.matchAll(/\bimport\(\s*["']([^"']+)["']\s*\)/g))refs.push(m[1]);
  }
  if(/\.html$/.test(entry.name))for(const m of text.matchAll(/(?:src|href)=["'](\.[^"'#?]*)["']/g))refs.push(m[1]);
  if(/\.css$/.test(entry.name)){for(const m of text.matchAll(/url\(\s*["']?(\.[^"')?#\s]*)/g))refs.push(m[1]);for(const m of text.matchAll(/@import\s*["'](\.[^"']+)["']/g))refs.push(m[1]);}
  for(const ref of refs){if(ref.startsWith('node:')||builtinModules.includes(ref))continue;if(!ref.startsWith('.'))throw Error('配布に含めていない依存先です: '+entry.name);const target=path.posix.normalize(path.posix.join(path.posix.dirname(entry.name),ref));if(!names.has(target))throw Error('配布に必要な参照先がありません: '+entry.name+' → '+target);}
 }
}

// Small, dependency-free ZIP writer (DEFLATE, UTF-8 names, CRC32). ZIP64 is deliberately rejected.
const crcTable=Uint32Array.from({length:256},(_,i)=>{let c=i;for(let n=0;n<8;n++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
export function crc32(bytes){let c=0xffffffff;for(const b of bytes)c=crcTable[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
export function makeZip(entries,rootName){
 safeRelative(rootName);if(entries.length>65535)throw Error('ZIP64が必要な件数です。');
 const local=[],central=[],names=new Set();let offset=0;
 for(const entry of entries){
  safeRelative(entry.name);if(names.has(entry.name.toLowerCase()))throw Error('ZIP内のファイル名が重複します。');names.add(entry.name.toLowerCase());const name=Buffer.from(rootName+'/'+entry.name,'utf8'),bytes=entry.bytes,compressed=deflateRawSync(bytes,{level:9}),crc=crc32(bytes);
  if(name.length>65535||bytes.length>0xffffffff||offset+compressed.length>0xffffffff)throw Error('ZIP64が必要なサイズです。');
  const h=Buffer.alloc(30);h.writeUInt32LE(0x04034b50);h.writeUInt16LE(20,4);h.writeUInt16LE(0x800,6);h.writeUInt16LE(8,8);h.writeUInt16LE(33,12);h.writeUInt32LE(crc,14);h.writeUInt32LE(compressed.length,18);h.writeUInt32LE(bytes.length,22);h.writeUInt16LE(name.length,26);
  local.push(h,name,compressed);
  const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt16LE(0x800,8);c.writeUInt16LE(8,10);c.writeUInt16LE(33,14);c.writeUInt32LE(crc,16);c.writeUInt32LE(compressed.length,20);c.writeUInt32LE(bytes.length,24);c.writeUInt16LE(name.length,28);c.writeUInt32LE(offset,42);central.push(c,name);offset+=h.length+name.length+compressed.length;
 }
 const size=central.reduce((n,b)=>n+b.length,0);if(offset+size>0xffffffff)throw Error('ZIP64が必要なサイズです。');
 const end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(size,12);end.writeUInt32LE(offset,16);
 return Buffer.concat([...local,...central,end]);
}
