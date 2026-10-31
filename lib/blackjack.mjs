import {randomInt} from 'node:crypto';

export const BLACKJACK_RULES='100チップ開始、最大5ラウンド。最低10チップ、10未満なら残り全額。所持分までオールベット可能。借り入れ・追加購入なし。Aは1または11、絵札は10。21超えは即敗北。初手の2枚でAと10点札はブラックジャック。通常勝利は賭け金込み2倍、ブラックジャック勝利は2.5倍（小数点以下切り捨て）、同点は賭け金返却。双方ブラックジャックは引き分け。ダブルダウンは最初の2枚・初回の選択時のみ、同額追加して1枚だけ引き終了。追加分不足では不可。スプリットなし。ディーラーはユーザーの手番終了後、公開された双方の手札を見て自由にヒット／スタンドを判断。21以上では自動決着。0チップなら敗北、5ラウンド終了時に120チップ以上ならユーザーの勝ち、120未満ならディーラーの勝ち。途中で120に到達しても5ラウンドまで続行。初期配札はベット確定時にサーバーが実行。毎ラウンド52枚をサーバーでシャッフルし、公開前の伏せ札と山札は配信しない。';
export function shuffledDeck(){
 const cards=['spades','hearts','diamonds','clubs'].flatMap(suit=>Array.from({length:13},(_,i)=>({rank:i+1,suit})));
 for(let i=cards.length-1;i>0;i--){const j=randomInt(i+1);[cards[i],cards[j]]=[cards[j],cards[i]];}
 return cards;
}
export function handValue(cards){let total=0,aces=0;for(const c of cards){total+=c.rank===1?11:Math.min(c.rank,10);if(c.rank===1)aces++;}while(total>21&&aces){total-=10;aces--;}return {total,soft:aces>0,blackjack:cards.length===2&&total===21,bust:total>21};}
export function initialBlackjack(quick=false,splitEnabled=false){const s={splitEnabled:!quick&&splitEnabled===true,game:'blackjack',playStyle:quick?'quick':'standard',humanColor:1,turn:1,phase:'betting',round:1,roundLimit:quick?1:5,chips:100,bet:0,initialBet:0,doubled:false,playerHand:[],dealerHand:[],deck:[],rounds:[],targetChips:120,pendingUserNotes:[],ruleVersion:!quick&&splitEnabled===true?'blackjack-split-v3':'blackjack-persona-v2'};if(quick)for(const k of ['chips','bet','initialBet','doubled','targetChips'])delete s[k];return s;}
export const blackjackRulesText=s=>s.playStyle==='quick'?'お気軽版：チップ・ベット・ダブルダウンなし、1ラウンドのみ。開始時にシステムが即配札。ヒット／スタンドで21を超えずディーラーより強い手を目指す。Aは1または11、絵札は10。最初の2枚のA＋10点札はブラックジャック。同点は引き分け。双方ブラックジャックも引き分け。相手の伏せ札はユーザー手番終了まで非公開。ディーラーは公開後に自由にヒット／スタンドを判断。21以上は自動決着。この1回の手札の勝敗が総合結果で、120枚の目標は使わない。':BLACKJACK_RULES.replace('スプリットなし。',s.splitEnabled?'スプリットあり：最初の同ランク2枚を同額追加で最大2組に分割。再分割なし。各組の初回はダブル可能。Aの分割は各1枚追加で終了。分割後の21は通常の21で割増なし。両組は共通のディーラー手札と比較し、合わせて1ラウンド。':'スプリットなし。');
export function prepareQuickBlackjack(s,makeDeck=shuffledDeck){if(s.playStyle!=='quick'||s.phase!=='betting')throw Error('お気軽版の初期配札です。');const a=structuredClone(s),deck=makeDeck();validateDeck(deck);a.deck=structuredClone(deck);a.playerHand=[draw(a)];a.dealerHand=[draw(a)];a.playerHand.push(draw(a));a.dealerHand.push(draw(a));a.phase='deal';a.turn=2;return a;}
function validateDeck(deck){if(!Array.isArray(deck)||deck.length!==52||new Set(deck.map(c=>c.suit+':'+c.rank)).size!==52||!deck.every(c=>Number.isInteger(c.rank)&&c.rank>=1&&c.rank<=13&&['spades','hearts','diamonds','clubs'].includes(c.suit)))throw Error('山札の生成に失敗しました。');}
function draw(s){if(!s.deck.length)throw Error('山札がありません。対局の復旧を確認してください。');return s.deck.shift();}
function dealerTurn(s){s.phase='dealer';s.turn=2;if(s.playerHands?.every(h=>handValue(h.cards).bust)||handValue(s.dealerHand).total>=21)settle(s);}
function finishSplitHand(s){const h=s.playerHands[s.activeHand];h.state=handValue(h.cards).bust?'bust':'stood';const next=s.playerHands.findIndex(h=>h.state==='playing');if(next<0){s.playerHand=s.playerHands[0].cards;dealerTurn(s);}else{s.activeHand=next;s.playerHand=s.playerHands[next].cards;}}
function splitValue(cards){return {...handValue(cards),blackjack:false};}
function settle(s){
 if(s.playerHands){const d=handValue(s.dealerHand);const hands=s.playerHands.map(h=>{const p=splitValue(h.cards),outcome=p.bust?'loss':d.blackjack?'loss':d.bust?'win':p.total===d.total?'draw':p.total>d.total?'win':'loss',reason=p.bust?'player_bust':d.blackjack?'dealer_blackjack':d.bust?'dealer_bust':'compare',payout=outcome==='win'?h.bet*2:outcome==='draw'?h.bet:0;return {playerCards:structuredClone(h.cards),playerTotal:p.total,bet:h.bet,doubled:h.doubled,outcome,reason,payout,net:payout-h.bet};});const payout=hands.reduce((n,h)=>n+h.payout,0),net=payout-s.bet;s.chips+=payout;s.rounds.push({round:s.round,split:true,hands,bet:s.bet,initialBet:s.initialBet,doubled:hands.some(h=>h.doubled),playerCards:structuredClone(s.playerHands[0].cards),dealerCards:structuredClone(s.dealerHand),playerTotal:null,dealerTotal:d.total,outcome:net>0?'win':net<0?'loss':'draw',reason:'split',payout,net,chipsAfter:s.chips});s.phase='round_over';s.turn=1;for(const h of s.playerHands)h.state=handValue(h.cards).bust?'bust':'stood';if(s.chips===0||s.round===(s.roundLimit||5)){s.status='finished';s.endedAt=new Date().toISOString();s.result=s.chips>=(s.targetChips??120)?'win':'loss';}return;}
 const p=handValue(s.playerHand),d=handValue(s.dealerHand);
 let outcome,reason;
 if(p.bust){outcome='loss';reason='player_bust';}
 else if(p.blackjack&&d.blackjack){outcome='draw';reason='both_blackjack';}
 else if(d.blackjack){outcome='loss';reason='dealer_blackjack';}
 else if(p.blackjack){outcome='win';reason='blackjack';}
 else if(d.bust){outcome='win';reason='dealer_bust';}
 else{outcome=p.total===d.total?'draw':p.total>d.total?'win':'loss';reason='compare';}
 if(s.playStyle==='quick'){s.rounds.push({round:1,playerCards:structuredClone(s.playerHand),dealerCards:structuredClone(s.dealerHand),playerTotal:p.total,dealerTotal:d.total,outcome,reason});s.phase='round_over';s.turn=1;s.status='finished';s.result=outcome;s.endedAt=new Date().toISOString();return;}
 const payout=outcome==='draw'?s.bet:outcome==='loss'?0:Math.floor(s.bet*(reason==='blackjack'?2.5:2));
 s.chips+=payout;
 s.rounds.push({round:s.round,bet:s.bet,initialBet:s.initialBet,doubled:s.doubled,playerCards:structuredClone(s.playerHand),dealerCards:structuredClone(s.dealerHand),playerTotal:p.total,dealerTotal:d.total,outcome,reason,payout,net:payout-s.bet,chipsAfter:s.chips});
 s.phase='round_over';s.turn=1;
 if(s.chips===0||s.round===5){s.status='finished';s.endedAt=new Date().toISOString();s.result=s.chips>=(s.targetChips??120)?'win':'loss';}
}
export function blackjackActions(s,actor=s.turn===s.humanColor?'human':'persona'){
 if(s.status!=='playing'||actor!==(s.turn===s.humanColor?'human':'persona'))return [];
 if(s.phase==='betting')return s.playStyle==='quick'?[]:['bet'];
 if(s.phase==='deal')return ['deal'];
 if(s.phase==='round_over')return ['next'];
 const actions=['hit','stand'];
 if(s.playStyle!=='quick'&&s.phase==='player'&&s.playerHand.length===2&&s.chips>=(s.playerHands?.[s.activeHand]?.bet??s.bet))actions.push('double');
 if(s.splitEnabled&&s.playStyle!=='quick'&&s.phase==='player'&&!s.playerHands&&!s.doubled&&s.playerHand.length===2&&s.playerHand[0].rank===s.playerHand[1].rank&&s.chips>=s.bet)actions.push('split');
 return actions;
}
export function applyBlackjack(s,move,actor,makeDeck=shuffledDeck){
 if(s.status!=='playing')throw Error('この対局は終了しています。');
 if(actor!==(s.turn===s.humanColor?'human':'persona'))throw Error('まだあなたの手番ではありません。');
 if(typeof move!=='string')throw Error('操作を指定してください。');
 const action=move.split(':')[0];if(!blackjackActions(s,actor).includes(action))throw Error('この段階ではその操作を選べません。');
 const a=structuredClone(s);
 if(action==='bet'){
  if(!/^bet:\d+$/.test(move))throw Error('bet:10 のように整数で指定してください。');
  const amount=Number(move.slice(4)),minimum=Math.min(10,s.chips);
  if(!Number.isSafeInteger(amount)||amount<minimum||amount>s.chips)throw Error(`ベットは${minimum}〜${s.chips}チップです。`);
  const deck=makeDeck();const valid=Array.isArray(deck)&&deck.length===52&&new Set(deck.map(c=>c.suit+':'+c.rank)).size===52&&deck.every(c=>Number.isInteger(c.rank)&&c.rank>=1&&c.rank<=13&&['spades','hearts','diamonds','clubs'].includes(c.suit));
  if(!valid)throw Error('山札の生成に失敗しました。');
  a.deck=structuredClone(deck);a.chips-=amount;a.bet=amount;a.initialBet=amount;a.doubled=false;
  a.playerHand=[draw(a)];a.dealerHand=[draw(a)];a.playerHand.push(draw(a));a.dealerHand.push(draw(a));a.phase='deal';a.turn=2;
 }else{
  if(move!==action)throw Error('操作に余分な引数を指定しないでください。');
  if(action==='deal'){
   if(handValue(a.playerHand).blackjack||handValue(a.dealerHand).blackjack)settle(a);
   else{a.phase='player';a.turn=1;}
  }else if(action==='next'){
   delete a.playerHands;delete a.activeHand;a.round++;a.phase='betting';a.turn=1;a.playerHand=[];a.dealerHand=[];a.deck=[];a.bet=0;a.initialBet=0;a.doubled=false;
  }else if(action==='split'){
   const bet=a.bet;a.chips-=bet;a.bet+=bet;a.playerHands=a.playerHand.map(c=>({cards:[c,draw(a)],bet,doubled:false,state:'playing'}));a.activeHand=0;for(const h of a.playerHands)if(a.playerHand[0].rank===1||handValue(h.cards).total===21)h.state='stood';const active=a.playerHands.findIndex(h=>h.state==='playing');if(active<0){a.playerHand=a.playerHands[0].cards;dealerTurn(a);}else{a.activeHand=active;a.playerHand=a.playerHands[active].cards;}
  }else if(action==='stand'){
   if(a.phase==='player'&&a.playerHands)finishSplitHand(a);else if(a.phase==='player')dealerTurn(a);else settle(a);
  }else{
   if(action==='double'){if(a.playerHands){const h=a.playerHands[a.activeHand];a.chips-=h.bet;a.bet+=h.bet;h.bet*=2;h.doubled=true;}else{a.chips-=a.bet;a.bet*=2;a.doubled=true;}} 
   if(a.phase==='player'){
    a.playerHand.push(draw(a));const p=handValue(a.playerHand);
    if(a.playerHands){a.playerHands[a.activeHand].cards=a.playerHand;if(p.bust||action==='double'||p.total===21)finishSplitHand(a);}else if(p.bust)settle(a);else if(action==='double'||p.total===21)dealerTurn(a);
   }else{
    a.dealerHand.push(draw(a));if(handValue(a.dealerHand).total>=21)settle(a);
   }
  }
 }
 a.version=s.version+1;a.lastMove={actor,action,round:a.round,at:new Date().toISOString(),...(action==='bet'?{amount:a.bet}:{}),...(s.playerHands&&s.phase==='player'?{hand:s.activeHand+1}:{})};return a;
}
// Use an explicit projection. Private hands/deck must never reach HTTP, MCP, or replay views.
export function blackjackView(s){
 const revealed=['dealer','round_over'].includes(s.phase),dealt=s.phase!=='deal';
 const v=Object.fromEntries(['id','game','mode','roomId','personaName','nexusUrl','humanColor','turn','status','version','createdAt','endedAt','lastMove','result','delivery','conversation','userNote','resultNotified','ruleVersion','playStyle','roundLimit','targetChips','pendingUserNotes','phase','round','chips','bet','initialBet','doubled','rounds'].map(k=>[k,s[k]]));
 return {...v,splitEnabled:s.splitEnabled===true,activeHand:s.activeHand??null,...(s.playerHands?{playerHands:s.playerHands.map(h=>({cards:structuredClone(h.cards),bet:h.bet,doubled:h.doubled,state:h.state,value:splitValue(h.cards)}))}:{}),playerCards:dealt?s.playerHand:[],dealerCards:!dealt?[]:revealed?s.dealerHand:s.dealerHand.map((c,i)=>i?{hidden:true}:c),playerValue:dealt&&s.playerHand.length?(s.playerHands?splitValue(s.playerHand):handValue(s.playerHand)):null,dealerValue:revealed?handValue(s.dealerHand):null,legalActions:blackjackActions(s),...(s.playStyle==='quick'?{}:{minimumBet:Math.min(10,s.chips),maximumBet:s.chips})};
}
export function blackjackContext(s){const v=blackjackView(s);return {session_id:s.id,room_id:s.roomId,game:s.game,version:s.version,status:s.status,turn:s.status==='playing'?(s.turn===1?'user':'persona'):null,phase:s.phase,play_style:s.playStyle||'standard',round:s.round,round_limit:s.roundLimit||5,chips:s.chips,target_chips:s.targetChips??null,bet:s.bet,player_cards:v.playerCards,...(v.playerHands?{player_hands:v.playerHands}:{}),dealer_cards:v.dealerCards,player_value:v.playerValue,dealer_value:v.dealerValue,last_action:s.lastMove,last_round:s.rounds.at(-1)||null,legal_actions:s.turn===2?v.legalActions:[],rules:blackjackRulesText(s),instructions:'あなたはディーラーです。customカテゴリのツールを使い、全引数をinput_args辞書にまとめます。gameapps_get_stateで最新状態を確認し、gameapps_play_moveにsession_id、room_id、expected_version、moveを渡します。初期配札はサーバーがベット確定時に完了させます。phase=playerはユーザーの手番です。公開情報の手札だけを事実として話してください。互換用のphase=dealでのみmove="deal"を使えます。スプリット時はplayer_handsの2組を確認し、共通のディーラー手札で両方に対して勝負します。バストした組は既に敗北です。phase=dealerでは公開された双方の手札を見てmove="hit"または"stand"を自分で判断します。追加ドロー後も自分の手番なら判断を続け、手番を終えてから会話します。17固定の制約はありません。カードはサーバーが決め、選べません。ユーザーの手番には操作せず待ちます。伏せ札は公開前には取得できません。'};}
export function blackjackBotMove(s){return s.phase==='deal'?'deal':handValue(s.dealerHand).total<17?'hit':'stand';}
// Finish the already prepared deal without shuffling or drawing additional cards.
export function completePreparedDeal(s){
 if(s.game!=='blackjack'||s.status!=='playing'||s.phase!=='deal')return s;
 const dealt=applyBlackjack(s,'deal','persona');
 dealt.lastMove={...dealt.lastMove,actor:'system',automatic:true,amount:dealt.bet};
 if(dealt.userNote?.version===s.version)dealt.userNote.version=dealt.version;
 return dealt;
}
export function blackjackPublicFacts(s){
 const v=blackjackView(s),symbols={spades:'♠',hearts:'♥',diamonds:'♦',clubs:'♣'};
 const cards=hand=>hand.map(c=>c.hidden?'伏せ札':`${symbols[c.suit]}${({1:'A',11:'J',12:'Q',13:'K'})[c.rank]||c.rank}`).join('・');
 if(v.playerHands)return `【サーバー確定の公開情報】ユーザーはスプリット：${v.playerHands.map((h,i)=>`手札${i+1}：${cards(h.cards)}（合計${h.value.total}、賭け金${h.bet}枚${h.value.bust?'、バスト':''}）`).join('／')}。ディーラーの手札：${cards(v.dealerCards)}${v.dealerValue?`（合計${v.dealerValue.total}）`:''}。`;
 return `【サーバー確定の公開情報】ユーザーの手札：${cards(v.playerCards)||'未配札'}${v.playerValue?`（合計${v.playerValue.total}）`:''}。ディーラーの手札：${cards(v.dealerCards)||'未配札'}${v.dealerValue?`（合計${v.dealerValue.total}）`:''}。`;
}

export function collectBlackjackNote(s,note=''){
 if(s.lastMove?.action==='next'){s.pendingUserNotes=[];s.userNote={text:'',version:s.version};return s;}
 const pending=s.pendingUserNotes||[];
 if(note.trim())pending.push(note.trim());
 const notify=s.phase==='dealer'||s.phase==='round_over'||s.status==='finished';
 s.userNote={text:notify?pending.join('\n'):'',version:s.version};s.pendingUserNotes=notify?[]:pending;
 return s;
}
