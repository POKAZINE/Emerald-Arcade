export const MANCALA_RULES='各自6穴、各穴2個（計24個）で開始。石の色は飾り。自分の穴を1つ選び、全ての石を次の穴から1個ずつ配る。自分のゴールにも配り、相手のゴールは飛ばす。最後が自分のゴールなら追加手番。横取りは一切なし。どちらかの列が空になると終了し、残った石はその列の持ち主のゴールへ回収。最終ゴール数が多い側の勝ち。12対12なら引き分け。先に列を空にしただけでは勝ちではない。';
export const mancalaPits=seat=>Array.from({length:6},(_,i)=>(seat===1?0:7)+i);
export const mancalaStore=seat=>seat===1?6:13;
export function mancalaRules(s){let text=MANCALA_RULES;if(s?.rulesConfig?.capture)text=text.replace('横取りは一切なし。','最後の石が自分の空の穴に入り、向かいに石があれば、最後の1個と向かいの石を全て自分のゴールへ回収（横取り）。向かいが空なら横取りなし。');if(s?.rulesConfig?.winCondition==='empty')text=text.replace('どちらかの列が空になると終了し、残った石はその列の持ち主のゴールへ回収。最終ゴール数が多い側の勝ち。12対12なら引き分け。先に列を空にしただけでは勝ちではない。','自分の小皿6つを先に空にした側が勝ち。石の多さは勝敗に使わず、終了後の残り石も回収しない。同時に両側が空なら引き分け。横取りで相手側だけを空にした場合は相手が勝つ。');return text;}
export function initialMancala(capture=false,winCondition='score'){return {game:'mancala',cups:Array.from({length:14},(_,i)=>i===6||i===13?0:2),turn:1,moveCount:0,rulesConfig:{stones:2,capture,winCondition},lastHumanTurn:[]};}
export function mancalaActions(s){return s.status==='playing'?mancalaPits(s.turn).flatMap((p,i)=>s.cups[p]?['sow:'+(i+1)]:[]):[];}
export function applyMancala(s,move,actor){
 if(s.status!=='playing')throw Error('この対局は終了しています。');
 if(actor!==(s.turn===s.humanColor?'human':'persona'))throw Error('まだあなたの手番ではありません。');
 if(typeof move!=='string'||!/^sow:[1-6]$/.test(move))throw Error('sow:1〜sow:6で、自分の穴を選んでください。');
 const seat=s.turn,pit=Number(move.slice(4)),source=mancalaPits(seat)[pit-1],count=s.cups[source];if(!count)throw Error('空の穴は選べません。');
 const n=structuredClone(s),before=[...s.cups],steps=[];n.cups[source]=0;steps.push({cups:[...n.cups],target:source,kind:'pickup'});let at=source;
 for(let i=0;i<count;i++){do{at=(at+1)%14;}while(at===mancalaStore(3-seat));n.cups[at]++;steps.push({cups:[...n.cups],target:at,kind:'drop'});}
 let captured=0;
 if(s.rulesConfig.capture&&mancalaPits(seat).includes(at)&&n.cups[at]===1&&n.cups[12-at]>0){captured=1+n.cups[12-at];n.cups[at]=n.cups[12-at]=0;n.cups[mancalaStore(seat)]+=captured;steps.push({cups:[...n.cups],target:mancalaStore(seat),kind:'capture',count:captured});}
 const extraTurn=at===mancalaStore(seat),collected={1:0,2:0};
 if([1,2].some(w=>mancalaPits(w).every(p=>!n.cups[p]))){
  if(s.rulesConfig.winCondition==='empty'){const emptySeats=[1,2].filter(w=>mancalaPits(w).every(p=>!n.cups[p]));n.status='finished';n.result=emptySeats.length===2?'draw':emptySeats[0]===s.humanColor?'win':'loss';n.endedAt=new Date().toISOString();}
  else{for(const w of [1,2]){collected[w]=mancalaPits(w).reduce((sum,p)=>sum+n.cups[p],0);for(const p of mancalaPits(w))n.cups[p]=0;n.cups[mancalaStore(w)]+=collected[w];if(collected[w])steps.push({cups:[...n.cups],target:mancalaStore(w),kind:'collect',count:collected[w]});}
  n.status='finished';const a=n.cups[mancalaStore(s.humanColor)],b=n.cups[mancalaStore(3-s.humanColor)];n.result=a===b?'draw':a>b?'win':'loss';n.endedAt=new Date().toISOString();}
 }
 n.turn=extraTurn?seat:3-seat;n.version=s.version+1;n.moveCount=(s.moveCount||0)+1;n.lastMove={actor,seat,pit,count,captured,landing:at,extraTurn:n.status==='playing'&&extraTurn,collected,before,steps,at:new Date().toISOString()};
 if(actor==='human'){const summary={pit,count,captured,landing:at,extraTurn:n.lastMove.extraTurn};n.lastHumanTurn=s.lastMove?.actor==='human'?[...(s.lastHumanTurn||[]),summary]:[summary];}
 return n;
}
export function mancalaView(s){return {...s,legalActions:mancalaActions(s)};}
export function mancalaContext(s){const last=s.lastMove;return {session_id:s.id,room_id:s.roomId,game:s.game,version:s.version,status:s.status,turn:s.status==='playing'?(s.turn===s.humanColor?'user':'persona'):null,user_seat:s.humanColor,persona_seat:3-s.humanColor,board:{user_pits:mancalaPits(s.humanColor).map(p=>s.cups[p]),persona_pits:mancalaPits(3-s.humanColor).map(p=>s.cups[p]),user_store:s.cups[mancalaStore(s.humanColor)],persona_store:s.cups[mancalaStore(3-s.humanColor)]},orientation:'各側のpits配列は本人から見て左から1〜6。自分の穴1→2→…→6→自分のゴール→相手の穴1→…→6と配る。相手のゴールは飛ばす。',legal_actions:mancalaActions(s),last_move:last?{actor:last.actor,pit:last.pit,count:last.count,captured:last.captured,extra_turn:last.extraTurn,collected:last.collected}:null,last_user_turn:s.lastHumanTurn,capture:s.rulesConfig.capture,win_condition:s.rulesConfig.winCondition||'score',rules:mancalaRules(s),instructions:'あなたは対局者です。customカテゴリのgameapps_get_stateで公開盤面を確認しgameapps_play_moveを実行。全引数をinput_args辞書にsession_id,room_id,expected_version,moveとして指定。moveはsow:1〜sow:6（自分から見た穴番号）。配石と勝敗はサーバーが計算します。追加手番なら最新versionとlegal_actionsで続けて自分で選択してください。ユーザーの番または終了まで操作し、成功結果に沿って会話してください。横取りの有無は現在のrulesを確認してください。'};}
export function mancalaBotMove(s){return mancalaActions(s).map(move=>{const n=applyMancala(s,move,s.turn===s.humanColor?'human':'persona');const seat=s.turn,other=3-seat;return {move,value:n.status==='finished'?(n.result==='draw'?0:(n.result==='win')===(seat===s.humanColor)?1000:-1000):s.rulesConfig.winCondition==='empty'?-mancalaPits(seat).reduce((sum,p)=>sum+n.cups[p],0)+(n.lastMove.extraTurn?3:0):n.cups[mancalaStore(seat)]-s.cups[mancalaStore(seat)]+(n.lastMove.extraTurn?3:0)};}).sort((a,b)=>b.value-a.value)[0]?.move;}
