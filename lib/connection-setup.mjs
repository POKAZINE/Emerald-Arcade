export function connectionURL(value){
 if(typeof value!=='string'||value.length>2048)throw Error('API接続先URLを確認してください。');
 let u;try{u=new URL(value.trim());}catch{throw Error('http://127.0.0.1:8000 のように入力してください。');}
 if(!['http:','https:'].includes(u.protocol)||u.username||u.password||u.search||u.hash)throw Error('URLはhttp/httpsの接続先だけを指定してください。認証情報やクエリは含めません。');
 if(/\/api\/v1(?:\/|$)/.test(u.pathname))throw Error('末尾の /api/v1 以下を除いた、API GatewayのURLを入力してください。');
 return u.href.replace(/\/+$/,'');
}
export function normalizeRooms(value){
 const a=Array.isArray(value)?value:value?.rooms;if(!Array.isArray(a)||a.some(r=>!r||typeof r.room_id!=='string'||!r.room_id||r.room_id.length>256))throw Error('APIの応答形式を確認してください。会話画面ではなくAPI GatewayのURLを指定してください。');
 return [...new Map(a.map(r=>[r.room_id,{room_id:r.room_id,display_name:String(r.display_name||r.room_id).slice(0,100)}])).values()];
}
export function setupStatus(config,run,port){
 const e=config.setupEvidence||{},revision=config.connectionRevision||0;
 const current=x=>!!x&&x.run===run&&x.revision===revision&&x.port===port;
 const api={status:e.api?(current(e.api)?'current':'previous'):'unverified',at:e.api?.at||null,count:e.api?.count??null};
 const mcp={status:e.mcp?(current(e.mcp)?'current':'previous'):'unverified',at:e.mcp?.at||null,toolsAt:e.mcp?.toolsAt||null,toolsCurrent:current(e.mcp)&&!!e.mcp.toolsAt};
 const approval={confirmed:!!e.approval?.confirmed&&e.approval.revision===revision&&e.approval.port===port,at:e.approval?.at||null};
 return {appVersion:'0.1.0',api,mcp,approval,complete:api.status==='current'&&mcp.toolsCurrent&&approval.confirmed,step:Math.min(5,Math.max(1,Number(e.step)||1))};
}
export function setupDiagnostic(s){
 const status=x=>x==='current'?'今回の起動後に確認済み':x==='previous'?'前回の確認記録あり（現在は未確認）':'未確認';
 return ['Emerald Arcade 連携診断','アプリ版：'+s.appVersion,'API：'+status(s.api.status),'MCP認証済み接続の受信：'+status(s.mcp.status),'MCPツール一覧の取得：'+(s.mcp.toolsCurrent?'今回確認済み':s.mcp.toolsAt?'前回の記録あり':'未確認'),'本体のツール有効化・承認：'+(s.approval.confirmed?'ユーザーが確認済み':'ユーザー確認待ち'),'ガイド：'+(s.complete?'完了':'確認途中'),'※実際のAI着手成功を保証する診断ではありません。'].join('\n');
}
