import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {lanAddresses,NetworkSessions} from '../lib/network.mjs';

test('接続キーの連続失敗を制限し、セッションの失効・期限切れを扱う',()=>{
 const sessions=new NetworkSessions(),req={socket:{remoteAddress:'192.168.1.2'},headers:{}};
 for(let i=0;i<10;i++)assert.equal(sessions.login(req,'wrong','secret').status,401);
 assert.equal(sessions.login(req,'secret','secret').status,429);
 sessions.attempts.clear();const login=sessions.login(req,'secret','secret');
 req.headers.cookie=login.cookie.split(';')[0];assert.equal(sessions.authenticated(req),true);
 const id=req.headers.cookie.split('=')[1];sessions.sessions.set(id,Date.now()-1);assert.equal(sessions.authenticated(req),false);
});

test('外部接続は任意・認証必須、遠隔ゲーム操作とPC限定管理を分離する',async t=>{
 const ip=lanAddresses()[0];if(!ip){t.skip('LANインターフェースなし');return;}
 const probe=http.createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
 const dir=fs.mkdtempSync(path.join(process.cwd(),'test-output','network-'));let child;
 const request=(route,{remote=false,method='GET',body,cookie,host,origin}={})=>new Promise((resolve,reject)=>{
  const headers={Host:host||(remote?ip:'127.0.0.1')+':'+port};
  if(cookie)headers.Cookie=cookie;
  if(origin)headers.Origin=origin;
  if(body!==undefined)headers['Content-Type']='application/json';
  const req=http.request({host:'127.0.0.1',port,path:'/gameapps'+route,method,headers},res=>{let data='';res.on('data',x=>data+=x);res.on('end',()=>{let json;try{json=JSON.parse(data);}catch{}resolve({status:res.statusCode,headers:res.headers,json,text:data});});});req.on('error',reject);if(body!==undefined)req.write(JSON.stringify(body));req.end();
 });
 const start=async()=>{child=spawn(process.execPath,['--no-warnings','server.mjs','--no-open'],{cwd:process.cwd(),env:{...process.env,GAMEAPPS_PORT:String(port),GAMEAPPS_DATA_DIR:dir},stdio:'pipe'});for(let i=0;i<80;i++){try{if((await request('/api/health')).status===200)return;}catch{}await new Promise(r=>setTimeout(r,40));}throw Error('network server startup failed');};
 const stop=async()=>{if(child.exitCode!==null)return;const done=new Promise(r=>child.once('exit',r));child.kill();await done;};
 const localPost=(route,body={})=>request(route,{method:'POST',body});
 try{
  await start();assert.equal((await request('/api/network')).json.active,false);
  assert.equal((await request('/api/games',{remote:true})).status,403);
  await localPost('/api/settings',{lanEnabled:true});assert.equal((await request('/api/network')).json.restartRequired,true);
  await stop();await start();assert.equal((await request('/api/network')).json.active,true);
  assert.equal((await request('/',{remote:true})).status,200);
  assert.equal((await request('/api/games',{remote:true})).status,401);
  assert.equal((await request('/api/client',{remote:true})).json.local,false);
  const key=(await localPost('/api/network-key')).json.key;
  assert.equal((await request('/api/login',{remote:true,method:'POST',body:{key:'wrong'}})).status,401);
  const login=await request('/api/login',{remote:true,method:'POST',body:{key}});assert.equal(login.status,200);
  const cookie=login.headers['set-cookie'][0].split(';')[0];assert.match(login.headers['set-cookie'][0],/HttpOnly/);
  const remote=(route,options={})=>request(route,{remote:true,cookie,...options});
  const cfg=(await remote('/api/settings')).json;
  for(const secret of ['nexusUrl','nexusToken','mcpToken','lanToken'])assert.equal(secret in cfg,false);
  for(const route of ['/api/network','/api/network-key','/api/restart','/api/shutdown','/api/mcp-info','/api/setup/test','/api/setup/approval','/api/setup/persona','/api/setup/progress'])assert.equal((await remote(route,{method:'POST',body:{}})).status,403);
  for(const route of ['/api/setup','/api/setup/diagnostic'])assert.equal((await remote(route)).status,403);
  assert.equal((await remote('/mcp',{method:'POST',body:{}})).status,403);
  assert.equal((await remote('/api/settings',{method:'POST',body:{nexusUrl:'http://example.com'}})).status,403);
  assert.equal((await remote('/api/settings',{method:'POST',body:{sound:true,volume:.2}})).status,200);
  assert.equal((await remote('/api/settings',{method:'POST',body:{showSetupHome:false}})).json.showSetupHome,false);
  assert.equal((await remote('/api/settings')).json.showSetupHome,false);
  assert.equal((await remote('/api/settings',{method:'POST',body:{sound:true},origin:'https://example.com'})).status,403);
  assert.equal((await remote('/api/settings',{host:'evil.example:'+port})).status,403);
  const game=(await remote('/api/games',{method:'POST',body:{mode:'practice',color:'black'}})).json;
  assert.equal((await remote('/api/games/'+game.id+'/move',{method:'POST',body:{index:19,version:0}})).status,200);
  await localPost('/api/network-key',{rotate:true});assert.equal((await remote('/api/games')).status,401);
  await localPost('/api/settings',{lanEnabled:false});await stop();await start();
  assert.equal((await request('/api/games',{remote:true})).status,403);
 }finally{if(child)await stop();}
});
