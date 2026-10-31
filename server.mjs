import {initialLiars,applyLiars,liarsView,liarsContext,liarsBotMove} from './lib/liars.mjs';
import {initialNineflags,applyNineflags,nineflagsView,nineflagsContext,nineflagsBotMove} from './lib/nineflags.mjs';
import {initialQuartet,applyQuartet,quartetView,quartetContext,quartetBotMove} from './lib/quartet.mjs';
import {APP_NAME} from './public/branding.js';
import {PrivateLateralLibrary} from './lib/lateral-private.mjs';
import {initialParaphrase,applyParaphrase,paraphraseView,paraphraseContext,paraphraseBotMove} from './lib/paraphrase.mjs';
import {initialBestfive,applyBestfive,bestfiveView,bestfiveContext,bestfiveBotMove} from './lib/bestfive.mjs';
import {initialIndian,applyIndian,indianView,indianContext,indianBotMove} from './lib/indian.mjs';
import {expressionName} from './public/persona-expression.js';
import {initialGeister,applyGeister,geisterView,geisterContext,geisterBotMove,geisterIdentities} from './lib/geister.mjs';
import {initialLateral,applyLateral,lateralView,lateralContext,lateralPracticeMove} from './lib/lateral.mjs';
import {toolDefinitions} from './lib/mcp-tools.mjs';
import {personaActionRequired,withMcpProgress,unconfirmedOperation,shouldRepairOperation} from './lib/mcp-progress.mjs';
import {initialLastcard,applyLastcard,lastcardView,lastcardContext,lastcardBotAction} from './lib/lastcard.mjs';
import {initialWordscale,applyWordscale,wordscaleView,wordscaleContext,wordscaleBotMove} from './lib/wordscale.mjs';
import {beginNotification,completeNotification} from './lib/notification-metrics.mjs';
import {initialMancala,applyMancala,mancalaView,mancalaContext,mancalaBotMove} from './lib/mancala.mjs';
import {connectionURL,normalizeRooms,setupStatus,setupDiagnostic} from './lib/connection-setup.mjs';
import {initialDaifugo,applyDaifugo,daifugoView,daifugoContext,daifugoBotMove} from './lib/daifugo.mjs';
import {initialTexas,applyTexas,texasView,texasContext,texasBotMove} from './lib/texas.mjs';
import {cfValidateColors} from './public/connectfour-colors.js';
import {initialConnectFour,applyConnectFour,connectFourView,connectFourContext,connectFourBotMove} from './lib/connectfour.mjs';
import {initialHitBlow,applyHitBlow,hitBlowView,hitBlowContext,hitBlowBotMove,hitBlowDuplicate} from './lib/hitblow.mjs';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID,randomBytes,timingSafeEqual} from 'node:crypto';
import {spawn} from 'node:child_process';
import {Store} from './lib/store.mjs';
import {initialBlackjack,prepareQuickBlackjack,applyBlackjack,blackjackView,blackjackContext,blackjackBotMove,completePreparedDeal,collectBlackjackNote} from './lib/blackjack.mjs';
import {lanAddresses,localRequest,validHost,NetworkSessions} from './lib/network.mjs';
import {initialBoard,applyMove,view as reversiView,coordinate,parseMove,legalMoves,flips} from './lib/reversi.mjs';
import {initialYacht,applyYacht,yachtView,yachtContext,yachtBotMove} from './lib/yacht.mjs';
import {yachtScoreReview} from './lib/yacht-score-review.mjs';
import {normalizeArguments,requireArguments} from './lib/mcp-arguments.mjs';
import {gameNotification,commentaryInstruction,NOTIFICATION_FORMAT} from './lib/game-notification.mjs';
import {gameOutcome} from './lib/game-outcome.mjs';
import {failureMessage,recoveryMessage} from './lib/connection-recovery.mjs';

const ROOT=path.dirname(fileURLToPath(import.meta.url));
const PORT=Number(process.env.GAMEAPPS_PORT||8040);
const BASE='/gameapps';
const DATA_DIR=process.env.GAMEAPPS_DATA_DIR||path.join(ROOT,'data');
const store=new Store(DATA_DIR);
const privateLateral=new PrivateLateralLibrary(DATA_DIR);
let config={title:APP_NAME,subtitle:'ペルソナと、ひと息のアソビ。',theme:'system',nexusUrl:'http://127.0.0.1:8000',nexusToken:'',showSetupHome:true,showExpressions:true,lanEnabled:false,sound:false,reducedMotion:false,...store.settings(),title:APP_NAME};
if(!config.mcpToken){config.mcpToken=randomBytes(32).toString('hex');store.saveSettings(config);}
if(!config.lanToken){config.lanToken=randomBytes(24).toString('hex');store.saveSettings(config);}
const lanActive=config.lanEnabled===true,networkSessions=new NetworkSessions();
const streams=new Set(),jobs=new Map(),setupRun=randomUUID();
const saveConfig=()=>store.saveSettings(config);
function setupRecord(kind,extra={}){const e=config.setupEvidence||{},now=new Date().toISOString(),revision=config.connectionRevision||0,previous=e[kind],same=previous?.run===setupRun&&previous.revision===revision&&previous.port===PORT;config.setupEvidence={...e,[kind]:{...(same?previous:{}),at:now,run:setupRun,revision,port:PORT,...extra}};saveConfig();}
async function connectionRooms(){const target={nexusUrl:config.nexusUrl,nexusToken:config.nexusToken};const rooms=normalizeRooms(await nexus('rooms','GET',undefined,target));if(target.nexusUrl!==config.nexusUrl||target.nexusToken!==config.nexusToken)throw Error('確認中に接続設定が変わりました。もう一度取得してください。');setupRecord('api',{count:rooms.length});return rooms;}
function rememberedRoom(rooms){const remembered=config.lastPersona?.nexusUrl===config.nexusUrl?config.lastPersona.roomId:store.all().find(g=>g.mode==='nexus'&&g.nexusUrl===config.nexusUrl)?.roomId;return rooms.some(r=>r.room_id===remembered)?remembered:null;}
const view=s=>s.game==='liars'?liarsView(s):s.game==='nineflags'?nineflagsView(s):s.game==='quartet'?quartetView(s):s.game==='paraphrase'?paraphraseView(s):s.game==='bestfive'?bestfiveView(s):s.game==='indian'?indianView(s):s.game==='geister'?geisterView(s):s.game==='lateral'?lateralView(s):s.game==='lastcard'?lastcardView(s):s.game==='wordscale'?wordscaleView(s):s.game==='mancala'?mancalaView(s):s.game==='daifugo'?daifugoView(s):s.game==='texas'?texasView(s):s.game==='connectfour'?connectFourView(s):s.game==='hitblow'?hitBlowView(s):s.game==='blackjack'?blackjackView(s):s.game==='yacht'?yachtView(s):reversiView(s);
const publicConfig=()=>{const {nexusToken,mcpToken,lanToken,setupEvidence,lastPersona,connectionRevision,...rest}=config;return {...rest,hasToken:!!nexusToken,mcpUrl:`http://127.0.0.1:${PORT}${BASE}/mcp`,hasMcpToken:true};};
const clientConfig=local=>local?publicConfig():Object.fromEntries(['title','subtitle','theme','sound','reducedMotion','volume','showExpressions','showSetupHome'].map(key=>[key,config[key]]));
const broadcast=(id)=>{for(const res of streams)res.write(`data: ${JSON.stringify({id})}\n\n`);};
const send=(res,status,body)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(body));};
const safeEqual=(a,b)=>{const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);};
async function body(req){let text='';for await(const chunk of req){text+=chunk;if(Buffer.byteLength(text)>65536)throw Error('送信データが大きすぎます。');}return text?JSON.parse(text):{};}
async function nexus(route,method='GET',payload,connection=config){
  const url=new URL(connection.nexusUrl);if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw Error('接続先URLを確認してください。');
  const response=await fetch(`${url.href.replace(/\/$/,'')}/api/v1/${route}`,{method,redirect:'error',headers:{'Content-Type':'application/json',...(connection.nexusToken?{Authorization:`Bearer ${connection.nexusToken}`}:{})},body:payload?JSON.stringify(payload):undefined,signal:AbortSignal.timeout(method==='POST'?180000:10000)});
  if(!response.ok)throw Error(`NexusArk接続エラー (${response.status})。API Gateway・Token・権限を確認してください。`);
  return await response.json();
}
function gameContext(s){return withMcpProgress(s,rawGameContext(s));}
function rawGameContext(s){if(s.game==='liars')return {...liarsContext(s),outcome:gameOutcome(s)};if(s.game==='nineflags')return {...nineflagsContext(s),outcome:gameOutcome(s)};if(s.game==='quartet')return {...quartetContext(s),outcome:gameOutcome(s)};if(s.game==='paraphrase')return {...paraphraseContext(s),outcome:gameOutcome(s)};if(s.game==='bestfive')return {...bestfiveContext(s),outcome:gameOutcome(s)};if(s.game==='indian')return {...indianContext(s),outcome:gameOutcome(s)};if(s.game==='geister')return {...geisterContext(s),outcome:gameOutcome(s)};if(s.game==='lateral')return {...lateralContext(s),outcome:gameOutcome(s)};if(s.game==='lastcard')return {...lastcardContext(s),outcome:gameOutcome(s)};if(s.game==='wordscale')return wordscaleContext(s);if(s.game==='mancala')return {...mancalaContext(s),outcome:gameOutcome(s)};if(s.game==='daifugo')return {...daifugoContext(s),outcome:gameOutcome(s)};if(s.game==='texas')return {...texasContext(s),outcome:gameOutcome(s)};if(s.game==='connectfour')return {...connectFourContext(s),outcome:gameOutcome(s)};if(s.game==='hitblow')return {...hitBlowContext(s),outcome:gameOutcome(s)};if(s.game==='blackjack')return {...blackjackContext(s),outcome:gameOutcome(s)};if(s.game==='yacht')return {...yachtContext(s,s.lastHumanTurn===undefined?store.history(s.id):[]),outcome:gameOutcome(s)};return {session_id:s.id,game:'reversi',room_id:s.roomId,version:s.version,status:s.status,outcome:gameOutcome(s),turn:s.status!=='playing'?null:s.turn===s.humanColor?'user':'persona',persona_color:s.humanColor===1?'white':'black',board:s.board.reduce((rows,_,i)=>{if(i%8===0)rows.push(s.board.slice(i,i+8).map(v=>'.BW'[v]).join(''));return rows;},[]),legal_moves:s.status==='playing'?legalMoves(s.board,s.turn).map(coordinate):[],last_move:s.lastMove,rules:'8×8のリバーシ。黒が先手。縦横斜めに相手の石を挟んで裏返す。置けなければ自動パス。双方置けなくなれば終了し石の多い側が勝ち。',instructions:s.status==='finished'?gameOutcome(s).message:'あなたは対局者です。Emerald Arcadeはchessカテゴリではなくcustomカテゴリの拡張ツールです。必要なら request_capability(category=custom) で取得してください。NexusArkのMCP中継では、すべての引数を input_args 辞書にまとめて呼び出してください。トップレベルに直接置くと中継で引数が失われます。自分の手番に最新のsession_id、room_id、versionを使い gameapps_play_move({input_args:{session_id:対局ID,room_id:ルームID,expected_version:version,move:合法手}}) を呼びます。操作結果を受けて会話してください。'+(s.testCommentary?'\n'+commentaryInstruction(s):'')};}
function createGame(b){
  if(b.game!==undefined&&!['liars','nineflags','quartet','paraphrase','bestfive','indian','geister','lateral','lastcard','reversi','yacht','blackjack','hitblow','connectfour','texas','daifugo','mancala','wordscale'].includes(b.game))throw Error('ゲームを選んでください。');
  if(b.game==='lastcard'&&((b.playerCount!==undefined&&![2,3].includes(b.playerCount))||(b.stacking!==undefined&&typeof b.stacking!=='boolean')))throw Error('人数とドロー重ねを確認してください。');
  if(b.game==='lastcard'&&((b.multiPlay!==undefined&&typeof b.multiPlay!=='boolean')||(b.firstPlayer!==undefined&&!['random','user','persona','bot'].includes(b.firstPlayer))||(b.firstPlayer==='bot'&&(b.playerCount??2)!==3)))throw Error('まとめ出しと先手設定を確認してください。');
  if(b.game==='mancala'&&b.winCondition!==undefined&&!['score','empty'].includes(b.winCondition))throw Error('マンカラの勝利条件を選んでください。');
  if(b.game==='mancala'&&b.capture!==undefined&&typeof b.capture!=='boolean')throw Error('横取り設定はON/OFFで指定してください。');
  if(b.game==='blackjack'&&b.splitEnabled!==undefined&&typeof b.splitEnabled!=='boolean')throw Error('スプリット設定はON/OFFで指定してください。');
  if(b.game==='blackjack'&&b.playStyle==='quick'&&b.splitEnabled===true)throw Error('スプリットは通常版で選べます。');
  if(b.game==='hitblow'&&b.allowDuplicates!==undefined&&typeof b.allowDuplicates!=='boolean')throw Error('答えの同色設定はON/OFFで指定してください。');
  if(!['practice','nexus'].includes(b.mode))throw Error('対戦モードを選んでください。');
  if(b.mode==='nexus'&&(!b.roomId||typeof b.roomId!=='string'))throw Error('対戦するルームを選んでください。');
  if(b.playStyle!==undefined&&!['quick','standard'].includes(b.playStyle))throw Error('遊ぶ長さを選んでください。');
  if(b.playStyle==='quick'&&!['liars','nineflags','paraphrase','bestfive','indian','daifugo','texas','blackjack','wordscale'].includes(b.game))throw Error('このゲームにはお気軽版はありません。');
  if(b.game==='texas'&&b.playStyle!=='quick'&&b.handLimit!==undefined&&![5,10].includes(b.handLimit))throw Error('通常版は5か10ハンドです。');
  if(b.privatePuzzleId!==undefined&&(b.game!=='lateral'||b.mode!=='nexus'||typeof b.privatePuzzleId!=='string'))throw Error('私用問題はペルソナとの水平思考クイズで選んでください。');
  const privatePuzzle=b.privatePuzzleId?privateLateral.get(b.privatePuzzleId,b.roomId,config.nexusUrl):null;
  const quick=b.playStyle==='quick';
  const color=b.color==='white'?2:b.color==='random'?(Math.random()<0.5?1:2):1;
  let s={id:randomUUID(),game:'reversi',mode:b.mode,roomId:b.mode==='practice'?'practice':b.roomId,personaName:b.mode==='practice'?'練習ボット':String(b.personaName||b.roomId).slice(0,100),nexusUrl:b.mode==='nexus'?config.nexusUrl:null,humanColor:color,board:initialBoard(),turn:1,status:'playing',version:0,createdAt:new Date().toISOString(),lastMove:null,passed:null,result:null,endedAt:null,delivery:{status:'idle'},conversation:[],...(b.game==='liars'?initialLiars(quick,b.firstPlayer??'random'):b.game==='nineflags'?initialNineflags(b.tactics??true,b.firstPlayer??'random',quick):b.game==='quartet'?initialQuartet(b.firstGiver??'random'):b.game==='paraphrase'?initialParaphrase(quick,b.roleMode??'alternate'):b.game==='bestfive'?initialBestfive(quick,b.genre??'daily',b.firstSetter??'random'):b.game==='indian'?initialIndian(quick):b.game==='geister'?initialGeister(b.firstPlayer??'random'):b.game==='lateral'?initialLateral({privatePuzzle,mode:b.mode,genre:b.genre??'any',difficulty:b.difficulty??'any',played:store.all().filter(g=>g.game==='lateral'&&g.status==='finished'&&g.mode===b.mode).map(g=>g.puzzle?.id)}):b.game==='lastcard'?initialLastcard(b.playerCount??2,b.stacking??false,undefined,undefined,{multiPlay:b.multiPlay??false,firstPlayer:b.firstPlayer??'random'}):b.game==='wordscale'?initialWordscale(quick):b.game==='mancala'?initialMancala(b.capture===true,b.winCondition??'score'):b.game==='daifugo'?initialDaifugo(b.rulesConfig,quick):b.game==='texas'?initialTexas(quick?2:b.handLimit??5):b.game==='connectfour'?initialConnectFour():b.game==='yacht'?{game:'yacht',...initialYacht()}:b.game==='blackjack'?initialBlackjack(quick,b.splitEnabled===true):b.game==='hitblow'?initialHitBlow(1,b.allowDuplicates===true):{})};
  if(s.game==='blackjack'&&quick)s=completePreparedDeal(prepareQuickBlackjack(s));
  if(s.game==='connectfour'&&config.connectFourColors){s.pieceColors={[color]:config.connectFourColors.user,[3-color]:config.connectFourColors.persona};}
  store.create(s);if(s.mode==='nexus'){config.lastPersona={nexusUrl:config.nexusUrl,roomId:s.roomId};saveConfig();}broadcast(s.id);if(['nineflags','quartet'].includes(s.game)){if(s.turn!==s.humanColor)schedule(s.id);return view(s);}if(['paraphrase','geister','lateral','lastcard','wordscale'].includes(s.game)&&s.turn!==s.humanColor)schedule(s.id);if(s.game==='blackjack'&&quick&&s.status==='finished')schedule(s.id);if(s.game!=='liars'&&s.game!=='paraphrase'&&s.game!=='bestfive'&&s.game!=='indian'&&s.game!=='geister'&&s.game!=='lateral'&&s.game!=='lastcard'&&s.game!=='wordscale'&&s.game!=='daifugo'&&s.game!=='texas'&&s.game!=='blackjack'&&(!['hitblow','connectfour','mancala'].includes(s.game)||s.turn!==s.humanColor))schedule(s.id);return view(s);
}
function moveGame(id,index,actor,expectedVersion,note=''){
  const before=store.get(id);if(['liars','nineflags','quartet','paraphrase','bestfive','indian','geister','lateral','lastcard','wordscale'].includes(before.game)&&actor==='human'&&jobs.has(id))throw Error('相手の返答が終わってから操作してください。');if(!Number.isInteger(expectedVersion)||expectedVersion!==before.version)throw Error('盤面が更新されています。最新の盤面を確認してください。');
  if(typeof note!=='string'||note.length>500)throw Error('一言は500文字以内で入力してください。');
  let after=before.game==='liars'?applyLiars(before,index,actor):before.game==='nineflags'?applyNineflags(before,index,actor):before.game==='quartet'?applyQuartet(before,index,actor):before.game==='paraphrase'?applyParaphrase(before,index,actor):before.game==='bestfive'?applyBestfive(before,index,actor):before.game==='indian'?applyIndian(before,index,actor):before.game==='geister'?applyGeister(before,index,actor):before.game==='lateral'?applyLateral(before,index,actor):before.game==='lastcard'?applyLastcard(before,index,actor):before.game==='wordscale'?applyWordscale(before,index,actor):before.game==='mancala'?applyMancala(before,index,actor):before.game==='daifugo'?applyDaifugo(before,index,actor):before.game==='texas'?applyTexas(before,index,actor):before.game==='connectfour'?applyConnectFour(before,index,actor):before.game==='hitblow'?applyHitBlow(before,index,actor):before.game==='blackjack'?applyBlackjack(before,index,actor):before.game==='yacht'?applyYacht(before,index,actor):applyMove(before,index,actor);
  const humanTurn=actor==='human'&&(after.game!=='yacht'||after.lastMove.action==='score');
  if(note.trim()&&(!humanTurn||after.mode!=='nexus'))throw Error('一言はペルソナ対局の着手・役の確定時に添えられます。');
  if(humanTurn&&!['liars','nineflags','quartet','indian','lastcard','blackjack','hitblow','texas','daifugo','mancala'].includes(after.game))after.userNote={text:note.trim(),version:after.version};
  const snapshots=[after];if(after.game==='blackjack'&&after.phase==='deal'){after=completePreparedDeal(after);snapshots.push(after);}
  if(actor==='human'&&after.game==='blackjack'&&after.mode==='nexus')collectBlackjackNote(after,note);
  if(actor==='human'&&after.game==='blackjack'&&after.phase==='player')after.delivery={status:'idle',message:after.playerHands?'手札'+(after.activeHand+1)+'を操作中です。両組の操作後に、一言とまとめてペルソナへ伝えます。':'配札しました。あなたの手番終了後に、操作と一言をペルソナへ伝えます。'};
  if(actor==='human'&&['liars','indian','texas','daifugo'].includes(after.game)&&after.mode==='nexus'){
    const pending=after.pendingUserNotes||[];if(note.trim())pending.push(note.trim());const notify=after.turn!==after.humanColor||['hand_over','round_over'].includes(after.phase);after.userNote={text:notify?pending.join('\n'):'',version:after.version};after.pendingUserNotes=notify?[]:pending;
  }
  if(actor==='human'&&['nineflags','quartet','lastcard','hitblow','mancala'].includes(after.game)&&after.mode==='nexus'){
    const pending=after.pendingUserNotes||[];if(note.trim())pending.push(note.trim());const notify=after.turn!==after.humanColor||after.status==='finished'||(!before.matchDecided&&after.matchDecided);after.userNote={text:notify?pending.join('\n'):'',version:after.version};after.pendingUserNotes=notify?[]:pending;
  }
  store.updateMany(snapshots,before.version);broadcast(id);
  if(['nineflags','quartet'].includes(after.game)){if(after.mode==='practice'||actor==='human'&&(after.turn!==after.humanColor||after.status==='finished'))schedule(id);return view(after);}
  if(after.game==='paraphrase'||after.game==='bestfive'){if(actor==='human'&&(after.turn===2||after.phase==='review'&&before.phase!=='review'))schedule(id);return view(after);}
  if(after.game==='lateral'){if(actor==='human'&&(after.turn===2||after.status==='finished'))schedule(id);return view(after);}
  if(after.game==='lastcard'){if(after.mode==='practice'||actor==='human'&&(after.turn===2||after.status==='finished'))schedule(id);return view(after);}
  if(after.game==='wordscale'){if(actor==='human'&&(after.turn!==after.humanColor||after.status==='finished'||after.phase==='review'&&before.phase!=='review'))schedule(id);return view(after);}
  const notifyHuman=actor==='human'&&(['liars','indian','texas','daifugo'].includes(after.game)?(after.turn!==after.humanColor||['hand_over','round_over'].includes(after.phase)):['hitblow','mancala'].includes(after.game)?(after.turn!==after.humanColor||after.status==='finished'||(!before.matchDecided&&after.matchDecided)):after.game==='blackjack'?(after.turn!==after.humanColor||after.phase==='round_over'):(after.game!=='yacht'||after.lastMove.action==='score'));
  if(notifyHuman||after.mode==='practice')schedule(id);
  return view(after);
}
function patchDelivery(id,delivery,reply,replyInfo={}){const s=store.get(id);s.delivery={...s.delivery,...delivery};if(reply)s.conversation.push({role:'persona',text:reply,at:new Date().toISOString(),...replyInfo});store.update(s);broadcast(id);}
async function checkGameConnection(id){
 const s=store.get(id);if(s.mode!=='nexus')throw Error('ペルソナとの対局で使用してください。');
 if(s.nexusUrl!==config.nexusUrl)throw Error('接続先が対局開始時と異なります。設定を元に戻してください。');
 let rooms;try{rooms=await nexus('rooms');}catch{throw Error('NexusArkへ接続できません。本体・API Gatewayの起動と、接続設定を確認してください。対局は保存されています。');}
 const list=Array.isArray(rooms)?rooms:rooms.rooms||[];
 if(!list.some(room=>room.room_id===s.roomId))throw Error('対戦ルームが見つかりません。接続先とルームを確認してください。');
 return store.get(id);
}
async function recoverGame(id){
 if(jobs.has(id))throw Error('まだ応答待ち中です。最大3分で待機が終わります。対局は保存されています。');
 const s=await checkGameConnection(id);if(s.status==='abandoned')throw Error('中止した対局は再開できません。');
 if(jobs.has(id))throw Error('ほかの画面で送信を再開しています。少し待ってください。');
 patchDelivery(id,{status:s.status==='playing'&&s.turn===s.humanColor?'sent':'action_required',message:recoveryMessage(s),recoveryReady:true});
 return view(store.get(id));
}
function schedule(id,{retry=false}={}){
  if(jobs.has(id))return;
  const s=store.get(id);
  if(s.status==='finished'&&s.resultNotified)return;
  if(s.mode==='practice'){
    if(s.status!=='playing'||s.turn===s.humanColor)return;
    const job=setTimeout(()=>{try{const latest=store.get(id);if(latest.status!=='playing'||latest.turn===latest.humanColor)return;if(latest.game==='liars'){moveGame(id,liarsBotMove(latest),'persona',latest.version);return;}if(latest.game==='nineflags'){moveGame(id,nineflagsBotMove(latest),'persona',latest.version);return;}if(latest.game==='quartet'){moveGame(id,quartetBotMove(latest),'persona',latest.version);return;}if(latest.game==='paraphrase'){moveGame(id,paraphraseBotMove(latest),'persona',latest.version);return;}if(latest.game==='bestfive'){moveGame(id,bestfiveBotMove(latest),'persona',latest.version);return;}if(latest.game==='indian'){moveGame(id,indianBotMove(latest),'persona',latest.version);return;}if(latest.game==='geister'){moveGame(id,geisterBotMove(latest),'persona',latest.version);return;}if(latest.game==='lateral'){moveGame(id,lateralPracticeMove(latest),'persona',latest.version);return;}if(latest.game==='lastcard'){moveGame(id,JSON.stringify(lastcardBotAction(latest)),'persona',latest.version);return;}if(latest.game==='wordscale'){moveGame(id,wordscaleBotMove(latest),'persona',latest.version);return;}if(latest.game==='mancala'){moveGame(id,mancalaBotMove(latest),'persona',latest.version);return;}if(latest.game==='daifugo'){moveGame(id,daifugoBotMove(latest),'persona',latest.version);return;}if(latest.game==='texas'){moveGame(id,texasBotMove(latest),'persona',latest.version);return;}if(latest.game==='connectfour'){moveGame(id,connectFourBotMove(latest),'persona',latest.version);return;}if(latest.game==='hitblow'){moveGame(id,hitBlowBotMove(latest),'persona',latest.version);return;}if(latest.game==='blackjack'){moveGame(id,blackjackBotMove(latest),'persona',latest.version);return;}if(latest.game==='yacht'){moveGame(id,yachtBotMove(latest),'persona',latest.version);return;}const choices=legalMoves(latest.board,latest.turn);choices.sort((a,b)=>{const value=i=>([0,7,56,63].includes(i)?100:0)+flips(latest.board,i,latest.turn).length;return value(b)-value(a);});moveGame(id,choices[0],'persona',latest.version);}finally{jobs.delete(id);const latest=store.get(id);if(latest.turn!==latest.humanColor)schedule(id);}},850);jobs.set(id,job);return;
  }
  if(s.nexusUrl!==config.nexusUrl){patchDelivery(id,{status:'error',message:'接続先が対局開始時と異なります。設定を元に戻してください。'});return;}
  if(s.delivery.status==='pending')return;
  const repeat=retry&&s.delivery.requestVersion===s.version&&s.delivery.requestMessage;
  const messageId=repeat?s.delivery.messageId:s.status==='finished'?`gameapps:${id}:result:${s.version}${s.requestSequence?':'+s.requestSequence:''}`:`gameapps:${id}:${s.version}:${s.requestSequence||0}`;
  const requestMessage=repeat?s.delivery.requestMessage:gameNotification(s);
  const notification=beginNotification(s.delivery,requestMessage,{format:repeat?(s.delivery.notificationMetrics?.format||'legacy'):NOTIFICATION_FORMAT,kind:s.status==='finished'?'result':!s.lastMove?'start':'turn',retry:!!repeat,repair:s.operationRepair?.version===s.version&&s.operationRepair.count>0,needsAction:personaActionRequired(s)});
  patchDelivery(id,{...notification,status:'pending',message:'NexusArkの応答を待っています。対局は保存済みです（最大3分）。',messageId,requestMessage,requestVersion:s.version,startedAt:new Date().toISOString(),recoveryReady:false});
  const job=(async()=>{try{
    const payload={source:'gameapps',user_id:'gameapps_user',client_message_id:messageId,message:requestMessage};
    const reply=await nexus(`rooms/${encodeURIComponent(s.roomId)}/chat`,'POST',payload);
    if(!reply.reply?.trim())throw Error('返答を取得できませんでした。');
    let latest=store.get(id);if(s.status==='finished'||latest.game==='liars'&&latest.status==='finished'&&latest.version>s.version){latest.resultNotified=true;store.update(latest);}
    const needsAction=personaActionRequired(latest)&&latest.version===s.version;
    const operationUnverified=personaActionRequired(latest);
    const warning=operationUnverified?'ペルソナの操作はまだ完了していません。この返答の操作・カード説明は未確認です。確定情報は盤面で確認してください。':undefined;
    const completion=completeNotification(store.get(id).delivery,notification.notificationMetrics.needsAction?(needsAction?'unacted':operationUnverified?'partial':'completed'):'not_required');
    patchDelivery(id,{...completion,...(needsAction?{status:'action_required',message:(latest.operationRepair?.version===latest.version&&latest.operationRepair.count>=1?'自動再依頼でも操作を確認できませんでした。追加の自動送信は止め、対局を保存しています。':'返答は届きましたが、対局の操作が実行されていません。')+'「接続・対局の復旧」から手番を再開できます。'}:{status:'sent',message:'NexusArkの会話履歴に保存されました。'})},reply.reply,{...(latest.game==='indian'?{expression:expressionName(reply)}:{}),operationUnverified,warning,gameVersion:latest.version});
  }catch(e){patchDelivery(id,{...completeNotification(store.get(id).delivery,'error'),status:'error',message:failureMessage(e,store.get(id)),errorDetail:e.message});}finally{jobs.delete(id);const latest=store.get(id);
      if(shouldRepairOperation(latest,s.version)){
        latest.operationRepair={version:latest.version,count:1};latest.requestSequence=(latest.requestSequence||0)+1;latest.delivery={...latest.delivery,status:'idle'};store.update(latest);schedule(id);
      }else if(latest.delivery.status==='sent'&&((personaActionRequired(latest)&&latest.version>s.version)||(latest.status==='finished'&&!latest.resultNotified)))schedule(id);
    }})();jobs.set(id,job);
}

function executeTool(name,rawArgs){
  const args=normalizeArguments(rawArgs);
  if(name==='gameapps_list_games')return [{id:'liars',name:'ライアーズダイス',players:2},{id:'nineflags',name:'九旗のかけひき',players:2},{id:'quartet',name:'しるしの四重奏',players:2},{id:'paraphrase',name:'ことばの言いかえ',players:2,cooperative:true},{id:'bestfive',name:'ふたりのベスト5',players:2,cooperative:true},{id:'indian',name:'インディアンポーカー',players:2},{id:'geister',name:'おばけのかくしごと',players:2},{id:'lateral',name:'水平思考クイズ',players:2,cooperative:true},{id:'lastcard',name:'ラストカード',players:3},{id:'wordscale',name:'ことばのものさし',players:2,cooperative:true},{id:'reversi',name:'リバーシ',players:2},{id:'yacht',name:'ヨット',players:2},{id:'blackjack',name:'ブラックジャック',players:2},{id:'hitblow',name:'ヒット＆ブロー',players:2},{id:'connectfour',name:'四目並べ',players:2},{id:'texas',name:'テキサスポーカー',players:2},{id:'daifugo',name:'大富豪',players:2},{id:'mancala',name:'マンカラ',players:2}];
  if(name==='gameapps_list_sessions')requireArguments(args,['room_id']);
  if(name==='gameapps_list_sessions')return store.all().filter(s=>s.mode==='nexus'&&s.roomId===args.room_id&&s.status==='playing').map(gameContext);
  requireArguments(args,['session_id','room_id']);
  const s=store.get(String(args.session_id||''));if(s.mode!=='nexus'||s.roomId!==args.room_id)throw Error('このルームの対局ではありません。');
  if(name==='gameapps_get_state')return gameContext(s);
  if(name==='gameapps_play_move')requireArguments(args,['expected_version','move']);
  if(name==='gameapps_play_move'){
    if(args.expected_version!==s.version)throw Error('盤面が更新されています。最新の版番号を確認してください。');
    if(s.turn===s.humanColor)throw Error('まだあなたの手番ではありません。');
    if(s.game==='hitblow'){const confirmation=hitBlowDuplicate(s,args.move);if(confirmation)return unconfirmedOperation(confirmation,gameContext(s));}
    const review=yachtScoreReview(s,args.move);
    if(review)return unconfirmedOperation(review,gameContext(s));
    const move=['liars','nineflags','quartet','paraphrase','bestfive','indian','geister','lateral','lastcard','blackjack','hitblow','connectfour','texas','daifugo','mancala','wordscale'].includes(s.game)?args.move:s.game==='yacht'?args.move.replace(/:confirm$/,''):parseMove(args.move);
    moveGame(s.id,move,'persona',args.expected_version);return {...gameContext(store.get(s.id)),action_applied:true};
  }
  throw Error('不明なツールです。');
}
async function rpc(req,res,b){
  const key=new URL(req.url,`http://127.0.0.1:${PORT}`).searchParams.get('key')||'';
  if(!safeEqual(req.headers.authorization||'',`Bearer ${config.mcpToken}`)&&!safeEqual(key,config.mcpToken))return send(res,401,{error:'MCP用Tokenが必要です。'});
  if(!b||b.jsonrpc!=='2.0'||typeof b.method!=='string')return send(res,400,{error:'Invalid JSON-RPC request'});
  if(b.id===undefined){res.writeHead(202);return res.end();}
  let result;
  if(b.method==='initialize')result={protocolVersion:'2024-11-05',capabilities:{tools:{}},serverInfo:{name:'GameApps',version:'0.1.0'}};
  else if(b.method==='ping')result={};
  else if(b.method==='tools/list')result={tools:toolDefinitions};
  else if(b.method==='tools/call'){try{result={content:[{type:'text',text:JSON.stringify(executeTool(b.params?.name,b.params?.arguments||{}))}]};}catch(e){result={isError:true,content:[{type:'text',text:e.message}]};}}
  else return send(res,200,{jsonrpc:'2.0',id:b.id,error:{code:-32601,message:'Method not found'}});
  if(['initialize','tools/list'].includes(b.method)||(b.method==='tools/call'&&!result.isError))setupRecord('mcp',b.method==='tools/list'?{toolsAt:new Date().toISOString()}:{});
  send(res,200,{jsonrpc:'2.0',id:b.id,result});
}

const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
  if(!validHost(req,PORT,lanActive))return send(res,403,{error:'この接続先は許可されていません。PC側のネットワーク設定を確認してください。'});
  const local=localRequest(req,PORT);
  if(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`)return send(res,403,{error:'異なるサイトからの操作は許可されていません。'});
  const url=new URL(req.url,`http://127.0.0.1:${PORT}`),p=url.pathname;
  try{
    if(p===BASE+'/api/client'&&req.method==='GET')return send(res,200,{local,lanActive,authenticated:local||networkSessions.authenticated(req)});
    if(p===BASE+'/api/login'&&req.method==='POST'){
      if(!lanActive)return send(res,403,{error:'外部接続はOFFです。'});
      if(!(req.headers['content-type']||'').includes('application/json'))return send(res,415,{error:'application/json が必要です。'});
      const b=await body(req),result=networkSessions.login(req,b.key,config.lanToken);
      if(result.cookie)res.setHeader('Set-Cookie',result.cookie);
      return send(res,result.status,result.error?{error:result.error}:{authenticated:true});
    }
    if(p===BASE+'/mcp'&&!local)return send(res,403,{error:'MCP接続はPC内で使用してください。'});
    if(p.startsWith(BASE+'/api/')&&!local&&(!lanActive||!networkSessions.authenticated(req)))return send(res,401,{error:'PC側で表示したEmerald Arcade接続キーを入力してください。'});
    if(!local&&p.startsWith(BASE+'/api/setup'))return send(res,403,{error:'連携設定は起動したPCで行ってください。'});
    if(!local&&[BASE+'/api/mcp-info',BASE+'/api/shutdown',BASE+'/api/restart',BASE+'/api/network',BASE+'/api/network-key'].includes(p))return send(res,403,{error:'この操作は起動したPCのローカル画面で行ってください。'});
    if(p===BASE+'/api/lateral-private'&&req.method==='GET')return send(res,200,privateLateral.catalogue(config.nexusUrl));
    if(p===BASE+'/api/lateral-private'&&!local)return send(res,403,{error:'私用問題の管理は起動したPCで行ってください。'});
    if(p===BASE+'/api/network'&&req.method==='GET')return send(res,200,{enabled:config.lanEnabled===true,active:lanActive,restartRequired:(config.lanEnabled===true)!==lanActive,urls:lanAddresses().map(ip=>'http://'+ip+':'+PORT+BASE+'/')});

    if(p==='/'||p===BASE){res.writeHead(302,{Location:BASE+'/'});return res.end();}
    if(req.method==='GET'&&p===BASE+'/api/events'){
      res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive'});res.write('data: {}\n\n');res.gameappsRemote=!local;streams.add(res);
      const heartbeat=setInterval(()=>res.write(': heartbeat\n\n'),15000);req.on('close',()=>{clearInterval(heartbeat);streams.delete(res);});return;
    }
    if(req.method==='POST'){
      if(!(req.headers['content-type']||'').includes('application/json'))return send(res,415,{error:'application/json が必要です。'});
      const b=await body(req);
      if(p===BASE+'/mcp')return await rpc(req,res,b);
      if(p===BASE+'/api/lateral-private'){if(b.action==='visibility'){privateLateral.setEnabled(b.enabled);return send(res,200,privateLateral.catalogue(config.nexusUrl));}if(b.action==='delete'){privateLateral.remove(b.id,b.confirm);return send(res,200,privateLateral.catalogue(config.nexusUrl));}throw Error('私用問題の管理操作を確認してください。');}
      if(p===BASE+'/api/settings'){
        if(!local&&Object.keys(b).some(key=>!['theme','sound','reducedMotion','volume','showExpressions','showSetupHome'].includes(key)))return send(res,403,{error:'接続設定は起動したPCで変更してください。'});
        if(b.showSetupHome!==undefined&&typeof b.showSetupHome!=='boolean')throw Error('ホームの連携案内はON/OFFで指定してください。');
        if(b.lanEnabled!==undefined&&typeof b.lanEnabled!=='boolean')throw Error('外部接続はON/OFFで指定してください。');
        const candidate={...config};for(const key of ['subtitle','theme','nexusUrl','sound','reducedMotion','volume','showExpressions','lanEnabled','showSetupHome'])if(b[key]!==undefined)candidate[key]=b[key];
        if(typeof candidate.showExpressions!=='boolean')throw Error('表情の表示はON/OFFで指定してください。');
        if(candidate.volume!==undefined&&(!Number.isFinite(candidate.volume)||candidate.volume<0||candidate.volume>1))throw Error('音量は0〜1で指定してください。');
        candidate.title=APP_NAME;candidate.subtitle=String(candidate.subtitle).slice(0,120);
        if(!['light','dark','system'].includes(candidate.theme))throw Error('テーマを確認してください。');
        const target=new URL(candidate.nexusUrl);if(!['http:','https:'].includes(target.protocol)||target.username||target.password)throw Error('接続先URLを確認してください。');
        if(typeof b.nexusToken==='string'&&b.nexusToken.trim())candidate.nexusToken=b.nexusToken.trim();
        if(b.clearToken)candidate.nexusToken='';if(candidate.nexusUrl!==config.nexusUrl||candidate.nexusToken!==config.nexusToken)candidate.connectionRevision=(config.connectionRevision||0)+1;config=candidate;store.saveSettings(config);return send(res,200,clientConfig(local));
      }
      if(p===BASE+'/api/connection'){const rooms=await connectionRooms();return send(res,200,{rooms,lastRoomId:rememberedRoom(rooms)});}
      if(p===BASE+'/api/setup/progress'){
        if(!Number.isInteger(b.step)||b.step<1||b.step>5)throw Error('手順を確認してください。');config.setupEvidence={...config.setupEvidence,step:b.step};saveConfig();return send(res,200,setupStatus(config,setupRun,PORT));
      }
      if(p===BASE+'/api/setup/persona'){
        if(typeof b.roomId!=='string'||!b.roomId)throw Error('相手を選んでください。');const rooms=await connectionRooms();if(!rooms.some(r=>r.room_id===b.roomId))throw Error('相手が見つかりません。ルーム一覧を取得し直してください。');config.lastPersona={nexusUrl:config.nexusUrl,roomId:b.roomId};saveConfig();return send(res,200,{saved:true});
      }
      if(p===BASE+'/api/setup/approval'){

        if(typeof b.confirmed!=='boolean')throw Error('確認状態を指定してください。');setupRecord('approval',{confirmed:b.confirmed});return send(res,200,setupStatus(config,setupRun,PORT));
      }
      if(p===BASE+'/api/setup/test'){
        if(b.clearToken!==undefined&&typeof b.clearToken!=='boolean')throw Error('Tokenの使用設定を確認してください。');
        const requested=connectionURL(b.nexusUrl);let old;try{old=connectionURL(config.nexusUrl);}catch{old=null;}const changed=requested!==old;
        if(b.nexusToken!==undefined&&(typeof b.nexusToken!=='string'||b.nexusToken.length>4096||/[\r\n]/.test(b.nexusToken)))throw Error('Tokenの入力を確認してください。');
        if(changed&&!b.nexusToken?.trim()&&!b.clearToken)throw Error('接続先を変更する場合はTokenを再入力してください。認証なしの接続先では「Tokenを使わない」を選びます。');
        const affected=changed?store.all().filter(g=>g.mode==='nexus'&&g.status==='playing'&&g.nexusUrl===config.nexusUrl).length:0;
        if(affected&&b.confirmChange!==true)return send(res,409,{error:'接続先を変えると、進行中の対局は元の接続先に戻すまで再開できません。',requiresConfirmation:true,affectedGames:affected});
        if([...jobs.values()].some(j=>j instanceof Promise))throw Error('ペルソナの応答待ちが終わってから接続を確認してください。');
        const originalURL=config.nexusUrl,originalToken=config.nexusToken;
        const candidate={nexusUrl:changed?requested:config.nexusUrl,nexusToken:b.clearToken?'':b.nexusToken?.trim()||config.nexusToken};
        let rooms;try{rooms=normalizeRooms(await nexus('rooms','GET',undefined,candidate));}catch(e){const auth=/\((401|403)\)/.test(e.message),format=/形式|JSON|Unexpected token/.test(e.message);return send(res,400,{error:auth?'認証・アクセス権を確認してください。保存済みの設定は変更していません。':format?'APIの応答形式を確認してください。API GatewayのURLを指定します。保存済みの設定は変更していません。':'APIへ接続できません。本体・API Gatewayの起動、URL、ポートを確認してください。保存済みの設定は変更していません。'});}
        if(config.nexusUrl!==originalURL||config.nexusToken!==originalToken)throw Error('確認中に接続設定が変わりました。もう一度確認してください。');
        if(candidate.nexusUrl!==config.nexusUrl||candidate.nexusToken!==config.nexusToken)config.connectionRevision=(config.connectionRevision||0)+1;
        Object.assign(config,candidate);setupRecord('api',{count:rooms.length});return send(res,200,{status:setupStatus(config,setupRun,PORT),rooms,lastRoomId:rememberedRoom(rooms)});
      }
      if(p===BASE+'/api/network-key'){if(b.rotate===true){config.lanToken=randomBytes(24).toString('hex');store.saveSettings(config);networkSessions.clear();for(const stream of streams)if(stream.gameappsRemote)stream.end();}return send(res,200,{key:config.lanToken});}
      if(p===BASE+'/api/shutdown'||p===BASE+'/api/restart'){
        if([...jobs.values()].some(job=>job instanceof Promise))throw Error('NexusArkの応答を待っています。完了後に停止してください。');
        send(res,200,{status:'stopping'});for(const job of jobs.values())clearTimeout(job);for(const stream of streams)stream.end();
        server.close(()=>{store.db.close();if(p===BASE+'/api/restart'){const log=fs.openSync(path.join(ROOT,'data','server.log'),'a');spawn(process.execPath,[path.join(ROOT,'launcher.mjs'),'--no-open'],{cwd:ROOT,env:process.env,detached:true,stdio:['ignore',log,log],windowsHide:true}).unref();fs.closeSync(log);}});server.closeIdleConnections();return;
      }
      if(p===BASE+'/api/mcp-info')return send(res,200,{url:publicConfig().mcpUrl,connectionUrl:`${publicConfig().mcpUrl}?key=${config.mcpToken}`,token:config.mcpToken,type:'streamable_http',alternativeType:'simple_http'});
      if(p===BASE+'/api/games')return send(res,201,createGame(b));
      const match=p.match(/^\/gameapps\/api\/games\/([\w-]+)\/(move|retry|end|commentary|appearance|notify-result|recover|resume|check|identities)$/);
      if(match){const [,id,action]=match;
        if(action==='identities'){const s=store.get(id);if(s.game!=='geister')throw Error('おばけのかくしごとの正体公開です。');if(b.version!==s.version)throw Error('最新の対局を確認してください。');return send(res,200,{identities:geisterIdentities(s)});}
        if(action==='check'){await checkGameConnection(id);return send(res,200,{message:'NexusArkと対戦ルームへの接続を確認しました。'});}
        if(action==='recover')return send(res,200,await recoverGame(id));
        if(action==='resume'){
          const ready=await recoverGame(id);
          if(ready.status==='abandoned')throw Error('中止した対局は再開できません。');
          if(ready.status==='playing'&&ready.turn===ready.humanColor)return send(res,200,ready);
          const s=store.get(id);s.requestSequence=(s.requestSequence||0)+1;s.delivery={status:'idle'};store.update(s);schedule(id);return send(res,200,view(store.get(id)));
        }

        if(action==='notify-result'){
          const s=store.get(id);if(s.mode!=='nexus'||s.status!=='finished')throw Error('終了したペルソナ対局で使用してください。');
          schedule(id);return send(res,200,view(store.get(id)));
        }
        if(action==='appearance'){
          const s=store.get(id);if(s.game!=='connectfour')throw Error('四目並べの色設定です。');
          if(s.status!=='playing'||s.turn!==s.humanColor||jobs.has(id)||['pending','error'].includes(s.delivery.status))throw Error('あなたの手番で、応答が終わってから色を変更してください。');
          if(!Number.isInteger(b.version)||b.version!==s.version)throw Error('盤面が更新されています。最新の盤面を確認してください。');
          cfValidateColors(b.userColor,b.personaColor);s.pieceColors={[s.humanColor]:b.userColor,[3-s.humanColor]:b.personaColor};store.update(s,s.version);
          config.connectFourColors={user:b.userColor,persona:b.personaColor};store.saveSettings(config);broadcast(id);return send(res,200,view(s));
        }
        if(action==='commentary'){
          if(typeof b.enabled!=='boolean')throw Error('ON/OFFを指定してください。');
          if(jobs.has(id))throw Error('相手の応答が終わってから切り替えてください。');
          const s=store.get(id);if(s.mode!=='nexus')throw Error('この設定はペルソナとの対局で使えます。');
          s.testCommentary=b.enabled;store.update(s);broadcast(id);return send(res,200,view(s));
        }
        if(action==='move')return send(res,200,moveGame(id,b.move??b.index,'human',b.version,b.note));
        if(action==='retry'){const s=store.get(id);if(s.status==='playing'&&s.turn===s.humanColor)return send(res,200,await recoverGame(id));if(jobs.has(id))throw Error('送信中です。しばらくお待ちください。');if(!['error','action_required'].includes(s.delivery.status))throw Error('再送が必要な対局ではありません。');const repeat=s.delivery.status==='error'&&s.delivery.requestVersion===s.version;if(!repeat)s.requestSequence=(s.requestSequence||0)+1;s.delivery={...s.delivery,status:'idle'};store.update(s);schedule(id,{retry:repeat});return send(res,200,view(store.get(id)));}
        if(jobs.has(id))throw Error('相手の操作が進行中です。応答後に終了してください。');
        const s=store.get(id);if(s.status!=='playing')throw Error('対局は終了しています。');s.status='abandoned';s.endedAt=new Date().toISOString();store.update(s);broadcast(id);return send(res,200,view(s));
      }
      return send(res,404,{error:'見つかりません。'});
    }
    if(req.method!=='GET')return send(res,405,{error:'Method not allowed'});
    if(p===BASE+'/api/health')return send(res,200,{app:'persona-gameapps',version:'0.1.0'});
    if(p===BASE+'/api/setup')return send(res,200,setupStatus(config,setupRun,PORT));
    if(p===BASE+'/api/setup/diagnostic')return send(res,200,{text:setupDiagnostic(setupStatus(config,setupRun,PORT))});
    if(p===BASE+'/api/settings')return send(res,200,clientConfig(local));
    if(p===BASE+'/api/games')return send(res,200,store.all().map(view));
    const match=p.match(/^\/gameapps\/api\/games\/([\w-]+)(\/history)?$/);
    if(match)return send(res,200,match[2]?store.history(match[1]).map(view):view(store.get(match[1])));
    const files={'/liars-ui.js':'liars-ui.js','/liars.css':'liars.css','/nineflags-ui.js':'nineflags-ui.js','/nineflags-cards.js':'nineflags-cards.js','/nineflags.css':'nineflags.css','/quartet-ui.js':'quartet-ui.js','/quartet-pieces.js':'quartet-pieces.js','/quartet.css':'quartet.css','/branding.js':'branding.js','/lateral-private-ui.js':'lateral-private-ui.js','/paraphrase-ui.js':'paraphrase-ui.js','/paraphrase-text.js':'paraphrase-text.js','/paraphrase.css':'paraphrase.css','/bestfive-ui.js':'bestfive-ui.js','/bestfive.css':'bestfive.css','/indian-ui.js':'indian-ui.js','/indian.css':'indian.css','/persona-expression.js':'persona-expression.js','/geister-ui.js':'geister-ui.js','/geister-pieces.js':'geister-pieces.js','/geister.css':'geister.css','/lateral-ui.js':'lateral-ui.js','/lateral.css':'lateral.css','/lastcard-selection.js':'lastcard-selection.js','/lastcard-events.js':'lastcard-events.js','/lastcard-ui.js':'lastcard-ui.js','/lastcard.css':'lastcard.css','/wordscale-send.js':'wordscale-send.js','/wordscale-ui.js':'wordscale-ui.js','/wordscale.css':'wordscale.css','/mancala-ui.js':'mancala-ui.js','/mancala.css':'mancala.css','/connection-setup-ui.js':'connection-setup-ui.js','/connection-setup.css':'connection-setup.css','/daifugo-ui.js':'daifugo-ui.js','/daifugo-rules.js':'daifugo-rules.js','/daifugo.css':'daifugo.css','/':'index.html','/app.js':'app.js','/yacht-ui.js':'yacht-ui.js','/dice-audio.js':'dice-audio.js','/blackjack-ui.js':'blackjack-ui.js','/hitblow-ui.js':'hitblow-ui.js','/connectfour-ui.js':'connectfour-ui.js','/connectfour-colors.js':'connectfour-colors.js','/result-share.js':'result-share.js','/texas-ui.js':'texas-ui.js','/result-card-data.js':'result-card-data.js','/style.css':'style.css','/connectfour.css':'connectfour.css','/texas.css':'texas.css'};
    const file=files[p.slice(BASE.length)];
    if(file){res.writeHead(200,{'Content-Type':file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8','Cache-Control':'no-cache','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"});return res.end(fs.readFileSync(path.join(ROOT,'public',file)));}
    send(res,404,{error:'見つかりません。'});
  }catch(e){send(res,400,{error:e.message});}
});
server.requestTimeout=200000;
server.on('error',e=>{console.error(e.code==='EADDRINUSE'?`ポート ${PORT} は使用中です。GAMEAPPS_PORT で別ポートを指定してください。`:e.message);process.exitCode=1;});
server.listen(PORT,lanActive?'0.0.0.0':'127.0.0.1',()=>{
  for(const s of store.all())if(s.game==='blackjack'&&s.playStyle!=='quick'&&s.status==='playing'&&s.targetChips===undefined){s.targetChips=120;s.ruleVersion='blackjack-persona-v2';store.update(s);}
    // Upgrade older interrupted deals using the exact saved hands/deck; never send chat on recovery.
  for(const s of store.all())if(s.game==='blackjack'&&s.status==='playing'&&s.phase==='deal'){
    const after=completePreparedDeal(s),reply=after.conversation.at(-1);
    if(reply&&(!s.delivery.startedAt||reply.at>=s.delivery.startedAt)){reply.operationUnverified=true;reply.warning='この返答では配札操作が未完了でした。発話中のカード説明は未確認です。盤面が確定情報です。';}
    after.delivery={...after.delivery,status:'sent',message:'保存済みのカードで初期配札を復旧しました。盤面が確定情報です。',recoveryReady:false};
    store.update(after,s.version);
  }
  for(const s of store.all())if(s.delivery.status==='pending')patchDelivery(s.id,{status:'error',message:'前回の応答待ち中に終了しました。同じ送信IDで再試行できます。'});
  for(const s of store.all())if(s.mode==='practice'&&s.status==='playing')schedule(s.id);
  console.log(`${config.title} (非公式) http://127.0.0.1:${PORT}${BASE}/`);
  if(!process.argv.includes('--no-open')&&process.platform==='win32'){
    const url=`http://127.0.0.1:${PORT}${BASE}/`;
    const edgeRoots=[process.env['ProgramFiles(x86)'],process.env.ProgramFiles,process.env.LOCALAPPDATA].filter(Boolean);
    const edge=edgeRoots.map(root=>path.join(root,'Microsoft','Edge','Application','msedge.exe')).find(fs.existsSync);
    if(edge)spawn(edge,['--new-window',url],{detached:true,stdio:'ignore',windowsHide:true}).unref();
    else spawn('rundll32.exe',['url.dll,FileProtocolHandler',url],{detached:true,stdio:'ignore',windowsHide:true}).unref();
  }
});
