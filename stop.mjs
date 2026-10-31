const port=Number(process.env.GAMEAPPS_PORT||8040),base=`http://127.0.0.1:${port}/gameapps/api/`;
try{
 const health=await fetch(base+'health',{signal:AbortSignal.timeout(2000)});
 if(!health.ok||(await health.json()).app!=='persona-gameapps')throw Error('Emerald Arcadeのサーバーではないため停止しません。');
 const response=await fetch(base+'shutdown',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(3000)});
 const result=await response.json();if(!response.ok)throw Error(result.error);console.log('Emerald Arcadeを停止しました。対局は保存されています。');
}catch(e){console.error(e.cause?.code==='ECONNREFUSED'?'Emerald Arcadeは起動していません。':e.message);process.exitCode=1;}
