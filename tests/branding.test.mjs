import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';import http from 'node:http';import {spawn} from 'node:child_process';
import {Store} from '../lib/store.mjs';
test('正式名は旧設定から独立し、設定で変更できず、既存MCP識別子を維持する',async()=>{
 const dir=fs.mkdtempSync(path.join(process.cwd(),'test-output','branding-')),token='branding-fixture-token';
 const store=new Store(dir);store.saveSettings({title:'以前の任意名称',mcpToken:token,lanToken:'fixture-lan-key'});store.db.close();
 const probe=http.createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
 const base='http://127.0.0.1:'+port+'/gameapps',child=spawn(process.execPath,['--no-warnings','server.mjs','--no-open'],{cwd:process.cwd(),env:{...process.env,GAMEAPPS_PORT:String(port),GAMEAPPS_DATA_DIR:dir},stdio:'pipe',windowsHide:true});
 const request=async(route,body)=>{const r=await fetch(base+route,body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(body)});assert.equal(r.status,200);return r.json();};
 try{
  let ready=false;for(let i=0;i<200;i++){try{if((await fetch(base+'/api/health')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,20));}assert.ok(ready);
  assert.equal((await request('/api/settings')).title,'Emerald Arcade');
  const saved=new Store(dir);assert.equal(saved.settings().title,'以前の任意名称');saved.db.close();
  const settings=await request('/api/settings',{title:'変更を試す',theme:'light'});assert.equal(settings.title,'Emerald Arcade');assert.equal(settings.theme,'light');
  assert.equal((await request('/api/health')).app,'persona-gameapps');
  const init=await request('/mcp',{jsonrpc:'2.0',id:1,method:'initialize'});assert.equal(init.result.serverInfo.name,'GameApps');
  const list=await request('/mcp',{jsonrpc:'2.0',id:2,method:'tools/list'});assert.deepEqual(list.result.tools.map(t=>t.name),['gameapps_list_games','gameapps_list_sessions','gameapps_get_state','gameapps_play_move']);
 }finally{if(child.exitCode===null){const done=new Promise(r=>child.once('exit',r));child.kill();await done;}}
});
