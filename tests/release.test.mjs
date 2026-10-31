import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {inflateRawSync} from 'node:zlib';
import {collectPackage,scanContent,makeZip,crc32,safeRelative} from '../scripts/release-lib.mjs';

function fixture(){
 const root=fs.mkdtempSync(path.join(process.cwd(),'test-output','release-test-'));
 const write=(name,text)=>{fs.mkdirSync(path.dirname(path.join(root,name)),{recursive:true});fs.writeFileSync(path.join(root,name),text);};
 write('package.json',JSON.stringify({name:'fixture',version:'0.1.0',engines:{node:'>=22.13.0'}}));
 write('public/index.html','<script type="module" src="./app.js"></script>');write('public/app.js',"import {x} from './future.js';");write('public/future.js','export const x=1;');write('lib/future-game.mjs','export const game=1;');write('distribution/README.md','配布用の説明書');write('README.md','開発用の私的な説明');write('data/keep.txt','not for distribution');
 const config={archiveRoot:'GameApps',runtimeDirectories:['public','lib'],runtimeFiles:[],documents:[{source:'distribution/README.md',target:'README.md'}],optionalDocuments:['LICENSE'],developmentOnly:['package.json','README.md','distribution','data'],allowedRuntimeExtensions:['.html','.js','.mjs','.png']};
 return {root,write,config};
}
test('配布：追加ゲーム・素材を自動収録し、data・開発文書は含めない',()=>{
 const {root,write,config}=fixture();write('public/new-game/art.png',Buffer.from([0,1,2]));write('lib/new-game.mjs','export const newer=1;');
 const p=collectPackage(root,config);const names=p.entries.map(e=>e.name);
 assert.ok(names.includes('public/new-game/art.png'));assert.ok(names.includes('lib/new-game.mjs'));assert.ok(!names.some(n=>n.startsWith('data/')));assert.equal(p.entries.find(e=>e.name==='README.md').bytes.toString(),'配布用の説明書');
 assert.throws(()=>collectPackage(root,{...config,runtimeFiles:['data/keep.txt']}),/対象外/);
 assert.throws(()=>collectPackage(root,{...config,documents:[{source:'distribution/README.md',target:'package.json'}]}),/予約/);
 const pkg=JSON.parse(p.entries.find(e=>e.name==='package.json').bytes);assert.deepEqual(Object.keys(pkg.scripts),['start']);
});
test('配布：不明な場所・形式・不足した参照・外部依存では黙ってZIPを作らない',()=>{
 let f=fixture();f.write('new-runtime.mjs','export const x=1');assert.throws(()=>collectPackage(f.root,f.config),/未分類/);
 f=fixture();f.write('public/new.bin','binary');assert.throws(()=>collectPackage(f.root,f.config),/未知の素材形式/);
 f=fixture();f.write('public/future.js',"import './not-shipped.js';");assert.throws(()=>collectPackage(f.root,f.config),/参照先/);
 f=fixture();f.write('public/.env','no');assert.throws(()=>collectPackage(f.root,f.config),/対象外/);
 f=fixture();f.write('package.json',JSON.stringify({version:'0.1.0',dependencies:{unknown:'1'}}));assert.throws(()=>collectPackage(f.root,f.config),/外部依存/);
});
test('配布：既知の私用文字列・キーらしい値・個人環境パスを検出して本文を出さない',()=>{
 const check=text=>scanContent([{name:'public/test.js',bytes:Buffer.from(text)}],['PRIVATE_INFORMATION_FIXTURE']);
 assert.throws(()=>check('PRIVATE_INFORMATION_FIXTURE'),e=>/私用情報/.test(e.message)&&!e.message.includes('PRIVATE_INFORMATION_FIXTURE'));
 assert.throws(()=>check("const apiKey='abcdefghijklmnopqrstuvwxyz';"),/秘密キー/);
 assert.throws(()=>check('C:\\Users\\fictional\\private.txt'),/絶対パス/);
 assert.doesNotThrow(()=>check('const apiKey="";'));
});
test('配布ZIP：展開後のバイト・日本語名・CRC・単一ルートが一致する',()=>{
 const entries=[{name:'README.md',bytes:Buffer.from('説明書\n')},{name:'public/新作.png',bytes:Buffer.from([0,255,127,4])}];const zip=makeZip(entries,'GameApps');let offset=0;const found=[];
 while(zip.readUInt32LE(offset)===0x04034b50){const flags=zip.readUInt16LE(offset+6),method=zip.readUInt16LE(offset+8),crc=zip.readUInt32LE(offset+14),size=zip.readUInt32LE(offset+18),length=zip.readUInt16LE(offset+26),extra=zip.readUInt16LE(offset+28);assert.ok(flags&0x800);assert.equal(method,8);const name=zip.subarray(offset+30,offset+30+length).toString('utf8'),start=offset+30+length+extra;const bytes=inflateRawSync(zip.subarray(start,start+size));assert.equal(crc32(bytes),crc);found.push({name,bytes});offset=start+size;}
 assert.deepEqual(found,entries.map(e=>({name:'GameApps/'+e.name,bytes:e.bytes})));assert.equal(zip.readUInt32LE(offset),0x02014b50);assert.equal(zip.readUInt32LE(zip.length-22),0x06054b50);assert.equal(zip.readUInt16LE(zip.length-12),entries.length);assert.equal(crc32(Buffer.from('123456789')),0xcbf43926);
 assert.throws(()=>makeZip([...entries,entries[0]],'GameApps'),/重複/);
 for(const name of ['../secret','/absolute','C:/private','public/../data','a\\b'])assert.throws(()=>safeRelative(name));
});
