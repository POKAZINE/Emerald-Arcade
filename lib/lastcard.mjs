import {groupEndColors,orderNumberGroup} from '../public/lastcard-selection.js';
import {randomInt,randomUUID} from 'node:crypto';
export const LC_COLORS=['red','blue','green','yellow'];
export const lcColor=c=>({red:'赤',blue:'青',green:'緑',yellow:'黄'})[c]||'';
export const lcLabel=c=>c?`${lcColor(c.color)}${({skip:'スキップ',reverse:'リバース',draw2:'ドロー2',wild:'色変更',wild4:'ワイルドドロー4'})[c.kind]??c.number}`:'—';
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=randomInt(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;}
export function lastcardDeck(){const cards=[];const add=(color,kind,number=null)=>cards.push({id:randomUUID(),color,kind,number});for(const color of LC_COLORS){add(color,'number',0);for(let n=1;n<=9;n++)for(let i=0;i<2;i++)add(color,'number',n);for(const kind of ['skip','reverse','draw2'])for(let i=0;i<2;i++)add(color,kind);}for(let i=0;i<4;i++){add(null,'wild');add(null,'wild4');}return shuffle(cards);}
const active=s=>s.seats.filter(i=>!s.out.includes(i));
const next=s=>{const all=s.seats;let i=all.indexOf(s.turn);do{i=(i+s.direction+all.length)%all.length;}while(s.out.includes(all[i]));return all[i];};
const name=(s,i)=>i===1?'ユーザー':i===2?'ペルソナ':'ボット';
export const lastcardPublicText=text=>String(text).replaceAll('あなた','ユーザー').replaceAll('パートナー','ペルソナ');
// Saved/UI event text can use the human reader's perspective; normalize it before addressing the AI.
export const lastcardPersonaText=text=>lastcardPublicText(text).replaceAll('ペルソナ側','あなた').replaceAll('ペルソナ','あなた');
export const lastcardPrivacy='対戦であり、3人戦も共闘ではありません。未公開の自分の手札の色・数字・種類・内訳や引いた札を会話で明かさず、残り枚数・出した札など公開情報だけで話してください。口調や感想は自由です。';
function cue(s,type,seat,details={}){s.eventSerial=(s.eventSerial||0)+1;s.publicActions=[...(s.publicActions||[]),{seq:s.eventSerial,type,seat,...details}].slice(-100);}
function log(s,text){s.events.push(text);s.events=s.events.slice(-20);s.timeline=[...(s.timeline||[]),text].slice(-100);}
function take(s,n){const cards=[];while(cards.length<n){if(!s.deck.length&&s.discard.length>1){const top=s.discard.pop();s.deck=shuffle(s.discard);s.discard=[top];log(s,'捨て札を混ぜ直して山札に戻しました。');}if(!s.deck.length)break;cards.push(s.deck.shift());}return cards;}
function finish(s,result){s.status='finished';s.result=result;s.endedAt=new Date().toISOString();s.drawnCard=null;cue(s,'finish',null,{result});log(s,result==='draw'?'双方が動けないため、引き分けです。':result==='win'?'ユーザーが先に上がりました。':'ペルソナ側が先に上がりました。');}
function pass(s){s.drawnCard=null;s.turn=next(s);}
export function lastcardActions(s,seat=s.turn){
 if(s.status!=='playing'||seat!==s.turn)return {plays:[],canDraw:false,canPass:false,pending:0};
 const hand=s.hands[seat],top=s.discard.at(-1),pending=s.penalty;
 const plays=hand.filter(c=>s.drawnCard?c.id===s.drawnCard:pending?s.rulesConfig.stacking&&c.kind===pending.kind:c.kind==='wild'||c.kind==='wild4'&&!hand.some(h=>h.color===s.currentColor)||c.color===s.currentColor||c.kind==='number'&&top.kind==='number'&&c.number===top.number||c.color&&c.kind!=='number'&&c.kind===top.kind);
 return {plays:plays.map(c=>c.id),canDraw:!s.drawnCard,canPass:!!s.drawnCard,pending:pending?.count||0,...(s.rulesConfig.multiPlay?{multiPlay:!s.drawnCard&&!pending,groupRule:'同じ数字札のみ。card_idsを出す順に指定し、最初はplays内の札、最後の札の色が次の色。'}:{})};
}
function play(s,m){
 const h=s.hands[s.turn],ids=m.card_ids===undefined?[m.card_id]:m.card_ids;
 if(!Array.isArray(ids)||!ids.length||ids.some(id=>typeof id!=='string')||new Set(ids).size!==ids.length||m.card_ids!==undefined&&m.card_id!==undefined)throw Error('重複のない自分の札IDを指定してください。');
 const cards=ids.map(id=>h.find(c=>c.id===id)),card=cards.at(-1),first=cards[0];
 if(cards.some(c=>!c)||!lastcardActions(s).plays.includes(first.id))throw Error('最初に、現在の場に出せる札を選んでください。');
 if(cards.length>1&&(!s.rulesConfig.multiPlay||s.drawnCard||s.penalty||cards.some(c=>c.kind!=='number'||c.number!==first.number)))throw Error('まとめ出しは設定ONのときの同じ数字札だけです。引いた後やドロー重ね中は1枚だけ出せます。');
 if(['wild','wild4'].includes(card.kind)&&!LC_COLORS.includes(m.color))throw Error('変更する色を選んでください。');
 if(h.length-cards.length===1&&m.declare_last!==true)throw Error('残り1枚になるため、declare_last:trueで宣言と一緒に出してください。');
 const seat=s.turn;for(const c of cards)h.splice(h.indexOf(c),1);s.discard.push(...cards);s.currentColor=card.color||m.color;s.drawnCard=null;s.passes=0;s.cardsPlayed=(s.cardsPlayed??s.moveCount)+cards.length;s.moveCount++;
 cue(s,'play',seat,{card:{...card},...(cards.length>1?{cards:cards.map(c=>({...c}))}:{}),color:s.currentColor,last:h.length===1,countAfter:h.length});log(s,name(s,seat)+'が'+cards.map(lcLabel).join('・')+(card.color?'':'（'+lcColor(m.color)+'に変更）')+(cards.length>1?'を'+cards.length+'枚まとめて出しました。':'を出しました。')+(h.length===1?'ラスト！':''));
 if(card.kind==='reverse'){if(active(s).length>2){s.direction*=-1;cue(s,'reverse',seat,{direction:s.direction});}else{s.turn=next(s);cue(s,'skip',s.turn,{source:'reverse'});log(s,'2人のリバース：相手を飛ばします。');}}
 if(card.kind==='skip'){s.turn=next(s);cue(s,'skip',s.turn,{source:'skip'});log(s,name(s,s.turn)+'の手番をスキップ。');}
 if(['draw2','wild4'].includes(card.kind))s.penalty={kind:card.kind,count:(s.penalty?.count||0)+(card.kind==='draw2'?2:4)};
 s.turn=next(s);
 if(!h.length){if(seat===3){s.out.push(3);cue(s,'out',3);log(s,'ボットが上がりました。最後の札の効果を引き継ぎ、ここから二人の勝負！');}else finish(s,seat===1?'win':'loss');}
}
function act(s,m){
 if(m.action==='play')play(s,m);
 else if(m.action==='draw'){
  const a=lastcardActions(s);if(!a.canDraw)throw Error('引いた札を出すか、手番を終えてください。');
  const seat=s.turn,penalty=s.penalty,source=penalty?{...s.discard.at(-1)}:null,n=penalty?.count||1,cards=take(s,n);s.hands[seat].push(...cards);
  log(s,name(s,seat)+'が'+cards.length+'枚引きました。'+(n>cards.length?'山札に引ける札が足りません。':''));
  if(penalty){s.penalty=null;s.passes=cards.length?0:s.passes+1;pass(s);}
  else if(cards.length){s.passes=0;const c=cards[0];s.drawnCard=null;if(lastcardActions(s).plays.includes(c.id))s.drawnCard=c.id;else pass(s);}
  else{s.passes++;pass(s);}
  cue(s,'draw',seat,{count:cards.length,countBefore:s.hands[seat].length-cards.length,countAfter:s.hands[seat].length,reason:penalty?'penalty':m.automatic?'no_play':'choice',source,requested:n,turnEnded:s.turn!==seat,stacking:s.rulesConfig.stacking});
 }else if(m.action==='pass'&&s.drawnCard){cue(s,'pass',s.turn,{reason:'keep'});log(s,name(s,s.turn)+'は引いた札を手札に残しました。');pass(s);}
 else throw Error('この操作は選べません。');
 if(s.status==='playing'&&s.passes>=active(s).length)finish(s,'draw');
}
export function lastcardBotAction(s){const a=lastcardActions(s),h=s.hands[s.turn],counts=Object.fromEntries(LC_COLORS.map(c=>[c,h.filter(x=>x.color===c).length]));const cards=h.filter(c=>a.plays.includes(c.id));cards.sort((a,b)=>{const score=c=>(c.color?30:0)+(['skip','reverse','draw2'].includes(c.kind)?15:0)+(c.number||0);return score(b)-score(a);});if(cards[0]?.kind==='number'&&a.multiPlay){const group=h.filter(c=>c.kind==='number'&&c.number===cards[0].number);if(group.length>1){const ends=groupEndColors(group,a.plays).sort((a,b)=>h.filter(c=>c.color===b&&!group.includes(c)).length-h.filter(c=>c.color===a&&!group.includes(c)).length);const card_ids=orderNumberGroup(group,a.plays,ends[0]);if(card_ids.length)return {action:'play',card_ids,declare_last:h.length-card_ids.length===1};}}return cards.length?{action:'play',card_id:cards[0].id,color:LC_COLORS.reduce((a,b)=>counts[b]>counts[a]?b:a),declare_last:h.length===2}:a.canPass?{action:'pass'}:{action:'draw'};}
function automatic(s){for(let i=0;i<250&&s.status==='playing';i++){const a=lastcardActions(s);if(s.penalty&&!a.plays.length){log(s,name(s,s.turn)+(s.rulesConfig.stacking?'は同種のドロー札で重ね返せないため、':'はドロー札の効果で、')+'自動で'+s.penalty.count+'枚引いて手番を終えます。');act(s,{action:'draw',automatic:true});}else if(!a.plays.length&&!s.drawnCard){log(s,name(s,s.turn)+'は出せる札がないため、自動で1枚引きます。');act(s,{action:'draw',automatic:true});}else if(s.turn===3){act(s,lastcardBotAction(s));}else return;}if(s.status==='playing')throw Error('自動処理を安全に完了できませんでした。');}
export function initialLastcard(playerCount=2,stacking=false,first=randomInt(playerCount)+1,makeDeck=lastcardDeck,options={}){if(![2,3].includes(playerCount)||typeof stacking!=='boolean')throw Error('人数とドロー重ね設定を確認してください。');if(typeof options.multiPlay!=='undefined'&&typeof options.multiPlay!=='boolean'||options.firstPlayer!==undefined&&!['random','user','persona','bot'].includes(options.firstPlayer)||options.firstPlayer==='bot'&&playerCount!==3)throw Error('まとめ出しと先手設定を確認してください。');const fixed={user:1,persona:2,bot:3}[options.firstPlayer];if(fixed)first=fixed;const s={game:'lastcard',humanColor:1,status:'playing',rulesConfig:{playerCount,stacking,multiPlay:options.multiPlay===true,firstPlayer:options.firstPlayer??'random'},startingSeat:first,cardsPlayed:0,seats:Array.from({length:playerCount},(_,i)=>i+1),turn:first,direction:1,out:[],hands:{1:[],2:[],3:[]},deck:makeDeck(),discard:[],currentColor:null,drawnCard:null,penalty:null,passes:0,moveCount:0,events:[],pendingUserNotes:[]};if(!s.seats.includes(first)||s.deck.length!==108||new Set(s.deck.map(c=>c.id)).size!==108)throw Error('初期配札を確認してください。');for(let n=0;n<5;n++)for(const i of s.seats)s.hands[i].push(s.deck.shift());const index=s.deck.findIndex(c=>c.kind==='number');if(index<0)throw Error('場札がありません。');s.discard.push(s.deck.splice(index,1)[0]);s.currentColor=s.discard[0].color;log(s,'各5枚で開始。先手は'+name(s,first)+'。ユーザーとペルソナ側の先上がり勝負です。');automatic(s);return s;}
export function applyLastcard(before,raw,actor){if(before.status!=='playing')throw Error('この対局は終了しています。');if(actor!==(before.turn===1?'human':'persona')||before.turn===3)throw Error('まだあなたの手番ではありません。');let m;try{m=typeof raw==='string'?JSON.parse(raw):raw;}catch{throw Error('moveはJSON文字列で指定してください。');}if(!m||typeof m!=='object')throw Error('操作を指定してください。');const s=structuredClone(before);s.events=[];act(s,m);automatic(s);s.pendingPublicEvents=actor==='human'?[...(before.pendingPublicEvents||[]),...s.events].slice(-40):[];s.version=before.version+1;s.lastMove={actor,action:m.action,at:new Date().toISOString()};return s;}
function projection(s,owner){const v=Object.fromEntries(['id','game','mode','roomId','personaName','nexusUrl','status','result','endedAt','createdAt','version','delivery','conversation','userNote','pendingUserNotes','lastMove','resultNotified','humanColor','turn','rulesConfig','direction','out','seats','currentColor','penalty','moveCount','cardsPlayed','startingSeat','events','timeline'].map(k=>[k,s[k]]));return {...v,publicActions:structuredClone(s.publicActions||[]),eventSerial:s.eventSerial||0,recentDiscards:structuredClone(s.discard.slice(-3)),topCard:s.discard.at(-1),deckCount:s.deck.length,discardCount:s.discard.length,players:s.seats.map(seat=>({seat,count:s.hands[seat].length,out:s.out.includes(seat)})),hand:structuredClone(s.hands[owner]),drawnCard:s.turn===owner?s.drawnCard:null,options:s.turn===owner?lastcardActions(s):{plays:[],canDraw:false,canPass:false,pending:s.penalty?.count||0}};}
export const lastcardView=s=>projection(s,1);
export function lastcardContext(s){const v=projection(s,2);v.events=(v.events||[]).map(lastcardPersonaText);for(const k of ['delivery','conversation','pendingUserNotes','timeline','publicActions'])delete v[k];return {...v,session_id:s.id,room_id:s.roomId,legal_actions:v.options,instructions:(s.rulesConfig.multiPlay?'まとめ出しON。同じ数字札を複数出す場合はJSON文字列 {"action":"play","card_ids":["最初の札ID","最後の札ID"]}。最初はlegal_actions.playsの札、最後の札の色が次の色。特殊札は不可。ドロー後は引いた1枚だけ。':'')+lastcardPrivacy+' あなたはseat=2、ユーザーはseat=1、ボットはseat=3。自分の手札と公開情報だけを見て選ぶ。gameapps_play_moveのmoveにはJSON文字列 {"action":"play","card_id":"自分の札ID"}、または{"action":"draw"}、引いた札を残す時は{"action":"pass"}。色変更時はcolorにred/blue/green/yellowの1つを追加。出した後に残り1枚ならdeclare_last:trueも追加。全引数はinput_args内。drawnCardがある時はその札だけ出せる。ドロー4は通常、現在の色の手札がない時だけ。重ね中は同種ドローだけを色不問で返せる。返せる時も引いてよい。3人戦はボットが先に上がっても続行。ユーザーと自分の先上がりが勝利。自分の連続手番や引いた札の判断は同じ要求中に続け、ユーザーの番または終了後に発話。会話で他人の手札を創作しない。'};}
