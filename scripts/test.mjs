import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
// 新規のソース展開先にも、テスト用一時データの親フォルダを用意する。
fs.mkdirSync(path.join(root,'test-output'),{recursive:true});
const tests=fs.readdirSync(path.join(root,'tests')).filter(n=>n.endsWith('.test.mjs')).sort().map(n=>path.join('tests',n));
const result=spawnSync(process.execPath,['--no-warnings','--test',...tests],{cwd:root,stdio:'inherit',windowsHide:true});
if(result.error)console.error(result.error.message);
process.exitCode=result.status??1;
