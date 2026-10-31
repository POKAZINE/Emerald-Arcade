import {networkInterfaces} from 'node:os';
import {randomBytes,timingSafeEqual} from 'node:crypto';

export function lanAddresses(){return [...new Set(Object.values(networkInterfaces()).flat().filter(x=>x&&!x.internal&&x.family==='IPv4').map(x=>x.address))];}
export function localRequest(req,port){return ['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress)&&[`127.0.0.1:${port}`,`localhost:${port}`].includes(req.headers.host);}
export function validHost(req,port,enabled){return new Set([`localhost:${port}`,`127.0.0.1:${port}`,...(enabled?lanAddresses().map(ip=>`${ip}:${port}`):[])]).has(req.headers.host);}
export function equalSecret(a,b){const x=Buffer.from(a||''),y=Buffer.from(b||'');return x.length===y.length&&timingSafeEqual(x,y);}
export class NetworkSessions{
 constructor(){this.sessions=new Map();this.attempts=new Map();}
 authenticated(req){const raw=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('gameapps_session='))?.slice(17);const expires=this.sessions.get(raw);if(!expires)return false;if(expires<Date.now()){this.sessions.delete(raw);return false;}return true;}
 login(req,key,expected){
  const address=req.socket.remoteAddress,now=Date.now();
  for(const [id,expiry] of this.sessions)if(expiry<now)this.sessions.delete(id);
  for(const [ip,entry] of this.attempts)if(entry.until<now)this.attempts.delete(ip);
  const entry=this.attempts.get(address)||{count:0,until:now+60000};
  if(entry.count>=10)return {status:429,error:'接続キーの確認が続いています。1分ほど待ってから試してください。'};
  entry.count++;this.attempts.set(address,entry);
  if(typeof key!=='string'||!expected||!equalSecret(key.trim(),expected))return {status:401,error:'接続キーが一致しません。PC側の設定で確認してください。'};
  if(this.sessions.size>=100)this.sessions.delete(this.sessions.keys().next().value);
  const id=randomBytes(32).toString('hex');this.sessions.set(id,now+12*60*60*1000);this.attempts.delete(address);
  return {status:200,cookie:`gameapps_session=${id}; Path=/gameapps; HttpOnly; SameSite=Strict; Max-Age=43200`};
 }
 clear(){this.sessions.clear();}
}
