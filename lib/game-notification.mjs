import {liarsFacts} from './liars.mjs';
import {indianHandFacts,INDIAN_REVIEW_INSTRUCTION} from './indian.mjs';
import {personaActionRequired} from './mcp-progress.mjs';
import {lastcardPersonaText,lastcardPrivacy} from './lastcard.mjs';
import {wordscaleTopicChooser,wordscaleReferencePrivacy} from './wordscale.mjs';
import {cfPieceColors,cfColor} from '../public/connectfour-colors.js';
import {blackjackPublicFacts} from './blackjack.mjs';
import {gameOutcome} from './game-outcome.mjs';
export const NOTIFICATION_FORMAT='compact-v2';
export function commentaryInstruction(s){
 return s.testCommentary?'【テスト用・一手のひとこと】盤面を確認して着手し、成功後に「今回そのマスを選んだ理由」と「ユーザーの直前の手への感想」をそれぞれ短く話してください。座標や実際に裏返った石など、確認できる盤面上の事実に基づいて1〜3文で説明してください。ユーザーがまだ指していない場合は感想を省いてください。理由がはっきりしない場合は無理に作らず、その旨を伝えてください。':'';
}
export function gameNotification(s){
 const text=baseGameNotification(s);
 if(!['liars','nineflags','quartet','paraphrase','bestfive','geister','lateral','lastcard','wordscale'].includes(s.game)||!personaActionRequired(s)||s.operationRepair?.version!==s.version||!s.operationRepair.count)return text;
 const notice='【操作未実行の訂正通知】前の返答では操作が完了していません。request_capability(category=custom)→gameapps_get_stateで最新状態とinstructionsを確認し、gameapps_play_moveを必ず実行。成功結果を確認してから会話。全引数はinput_args内。';
 return text.replace('\n','\n'+notice+'\n');
}
function baseGameNotification(s){
 if(s.game==='liars')return '【Emerald Arcade自動通知／本人の直接入力ではありません】\nライアーズダイス '+s.roundNumber+'/'+s.roundLimit+'ラウンド。あなた=seat 2、ユーザー=seat 1。\n対局ID: '+s.id+' ／ ルームID: '+s.roomId+' ／ 盤面の版番号: '+s.version+'\n'+(s.phase==='round_over'?liarsFacts(s)+(s.status==='finished'?gameOutcome(s).message:''):('直前：'+(s.lastMove?.actor==='human'?'ユーザー':'あなた')+'が'+(s.bid?s.bid.face+'の目が'+s.bid.count+'個以上と宣言。賭け合計'+s.currentBet+'枚。':'開始。')+'gameapps_get_stateで自分の出目・宣言・legal_actionsを確認→gameapps_play_moveで宣言と金額をまとめて実行し、成功後に会話。'))+(s.phase==='bidding'?'\n未公開の出目の内訳は話さず、公開の宣言と駆け引きで表現。':'')+'\ncustom／全引数input_args内。'+(s.userNote?.version===s.version&&s.userNote.text?'\n【ユーザー本人の一言】\n'+s.userNote.text:'');

 if(s.game==='nineflags')return '【Emerald Arcade自動通知／本人の直接入力ではありません】\n九旗のかけひき'+(s.playStyle==='quick'?'・お気軽版（5旗・戦術なし・先に3旗）':'')+'。あなた＝seat 2、ユーザー＝seat 1。\n対局ID: '+s.id+' ／ ルームID: '+s.roomId+' ／ 盤面の版番号: '+s.version+'\n'+(s.status==='finished'?gameOutcome(s).message:'gameapps_get_stateで自分の手札・公開された'+s.flags.length+'旗・phase・legal_actionsを確認→gameapps_play_move。補充や割り込みの選択も、自分の操作が終わるまで最新versionで続け、成功後に会話。')+'\n未公開の手札・戻した札・山札は発話しない。custom／全引数input_args内。'+(s.userNote?.version===s.version&&s.userNote.text?'\n【ユーザー本人の一言】\n'+s.userNote.text:'');
 if(s.game==='quartet')return '【Emerald Arcade自動通知／本人の直接入力ではありません】\nしるしの四重奏。あなた＝AI、ユーザー＝人間。すべての駒は共有です。\n対局ID: '+s.id+' ／ ルームID: '+s.roomId+' ／ 盤面の版番号: '+s.version+'\n'+(s.status==='finished'?gameOutcome(s).message:'gameapps_get_stateで受け取った駒・公開盤面・phase・legal_actionsを確認→gameapps_play_move。place後も自分の番なら、同じ応答内でgiveまで続ける。成功結果を確認して会話。')+'\ncustom／全引数はinput_args内。'+(s.lastMove?'\n直前：'+(s.lastMove.actor==='human'?'ユーザー':'あなた')+'が'+(s.lastMove.action==='place'?s.lastMove.cell+'に配置。':'相手へ駒を渡しました。'):'')+(s.userNote?.version===s.version&&s.userNote.text?'\n【ユーザー本人の一言】\n'+s.userNote.text:'');
 if(s.game==='paraphrase')return '【Emerald Arcade自動通知／本人の直接入力ではありません】\nことばの言いかえ '+s.roundNumber+'/'+s.roundLimit+'問。あなた＝AI、ユーザー＝人間。あなたは'+(s.explainer===2?'説明役':'回答役')+'。\n対局ID: '+s.id+' ／ ルームID: '+s.roomId+' ／ 盤面の版番号: '+s.version+'\n'+(s.status==='finished'?'終了。gameapps_get_stateで公開結果を確認して振り返る。操作不要。':s.phase==='review'?'答え合わせ。gameapps_get_stateで公開された答えと説明を確認。操作不要。次の開始はユーザー。':'request_capability(category=custom)→gameapps_get_stateで役割・公開説明・legal_actionsを確認→gameapps_play_moveで必ず操作。説明は専用欄だけに登録し、会話に追加ヒントや秘密の答えを含めない。')+'\ncustom／全引数input_args内。';
 if(s.game==='bestfive')return '【Emerald Arcade自動通知／本人の直接入力ではありません】\nふたりのベスト5 '+s.roundNumber+'/'+s.roundLimit+'ラウンド。あなた＝AI、ユーザー＝人間。あなたは'+(s.setter===2?'出題者':'回答者')+'。\n対局ID: '+s.id+' ／ ルームID: '+s.roomId+' ／ 盤面の版番号: '+s.version+'\n'+(s.status==='finished'?gameOutcome(s).message:s.phase==='review'?'このラウンドは答え合わせ。gameapps_get_stateで公開順位と理由を確認し、振り返りを話してください。操作不要。次の開始はユーザー。':'request_capability(category=custom)→gameapps_get_stateで役割・質問・過去の予想とlegal_actionsを確認→gameapps_play_moveで必ず操作。出題者は固定した秘密の順位を直接明かさず、価値観を話す。回答者は順位を知っているように断定しない。')+'\ncustom／全引数input_args内。成功結果を確認してから会話。';
 if(s.game==='geister')return '【Emerald Arcade自動通知／本人の直接入力ではありません】\nおばけのかくしごと。あなたは上側、ユーザーは下側の対局者です。\n対局ID: '+s.id+' ／ ルームID: '+s.roomId+' ／ 盤面の版番号: '+s.version+'\n'+(s.status==='finished'?gameOutcome(s).message:s.phase==='setup'?'ユーザーが配置を確定しました。gameapps_get_stateで自分の駒を確認し、gameapps_play_moveでsetup。続けて自分の手番なら着手。':'gameapps_get_stateで自分の駒と公開盤面・legal_actionsを確認し、gameapps_play_moveで1手を実行。成功後に会話。')+'\n自分の未公開の正体や、おとりの駒は発話しない。custom／全引数はinput_args内。'+(s.userNote?.text?'\n【ユーザー本人の一言】\n'+s.userNote.text:'');

 if(s.game==='lateral')return '【Emerald Arcade自動通知／本人の直接入力ではありません】\n水平思考クイズ。あなたが出題者、ユーザーが解答者です。\n対局ID: '+s.id+' ／ ルームID: '+s.roomId+' ／ 盤面の版番号: '+s.version+'\n'+(s.status==='finished'?'終了。gameapps_get_stateで確定した真相を確認し、振り返ってください。操作不要。':'gameapps_get_stateで最新のpendingとinstructionsを確認し、gameapps_play_moveで'+(s.phase==='choose'?'choose':'respond')+'。真相・未公開ヒントを会話で明かさず、成功結果の公開内容だけを話してください。')+'\ncustom／全引数はinput_args内。';

 if(s.game==='lastcard')return '【Emerald Arcade自動通知／本人の直接入力ではありません】\nラストカード '+s.rulesConfig.playerCount+'人戦・ドロー重ね'+(s.rulesConfig.stacking?'あり':'なし')+'。\n対局ID: '+s.id+' ／ ルームID: '+s.roomId+' ／ 盤面の版番号: '+s.version+'\n'+(s.pendingPublicEvents?.length?s.pendingPublicEvents:s.events||[]).map(lastcardPersonaText).join('\n')+'\n'+(s.status==='finished'?gameOutcome(s).message:'gameapps_get_stateで自分の手札・公開情報・legal_actionsを確認し、gameapps_play_moveを実行。連続手番は同じ要求内で続け、成功後に発話。')+'\n'+lastcardPrivacy+'\ncustom／全引数はinput_args内。'+(s.userNote?.text?'\n【ユーザー本人の一言】\n'+s.userNote.text:'');
 if(s.game==='wordscale'){return '【Emerald Arcade自動通知／本人の直接入力ではありません】\nことばのものさし・協力ゲーム '+s.stage+'/'+s.stageLimit+'ステージ'+(s.stageLimit===1?'・お試し版。並べる順番を間違えたら終了。':'、共有ライフ'+s.lives+'。')+'\n対局ID: '+s.id+' ／ ルームID: '+s.roomId+' ／ 盤面の版番号: '+s.version+'\n'+(s.status==='finished'?'ふたりの結果：'+(s.result==='clear'?'クリア':'今回は未クリア')+'。request_capability(category=custom)→gameapps_get_stateで確定結果とたとえを確認し、振り返りを話してください。操作は不要です。':s.phase==='topic'?'request_capability(category=custom)→gameapps_get_stateのtopicChoicesからお題を選び、gameapps_play_moveでchoose_topicと短い理由を登録してください。':s.phase==='review'&&s.stage<s.stageLimit&&wordscaleTopicChooser(s,s.stage+1)==='persona'&&!s.nextTopicChoice?'request_capability(category=custom)→gameapps_get_stateで結果とnextTopicChoicesを確認し、振り返りと一緒にgameapps_play_moveでrespond・next_topic・topic_reasonを登録してください。次の開始はユーザーです。':s.phase==='review'&&s.turn!==s.humanColor?'request_capability(category=custom)→gameapps_get_stateでユーザーの相談と公開済みの札を確認し、gameapps_play_moveでrespondと短い返事を登録してください。既に選んだ次のお題は維持します。':s.phase==='review'?'request_capability(category=custom)→gameapps_get_stateで公開済みの札とたとえを確認。ステージ終了の振り返りを話してください。次はユーザーが進めます。':'request_capability(category=custom)→gameapps_get_stateで自分の札・お題・両者のたとえ・ユーザーの相談を確認→gameapps_play_moveでrespond。自分の全札のたとえと提案を、あなたらしい表現でまとめて返してください。')+(s.status==='playing'&&['clues','table'].includes(s.phase)&&s.reference?'\n'+wordscaleReferencePrivacy(s.reference):'')+'\ncustom／全引数はinput_args内。最新の状態で確認した事実に基づいて会話。'+((s.lastMove?.action==='discuss'||s.lastMove?.hasUserText)?'\n【ユーザー本人の相談／本人が入力した言葉】\n'+s.dialogue.filter(d=>d.role==='human').at(-1).text:'')+(s.status==='finished'?'\n'+JSON.stringify({result:s.result,cleared_stages:s.clearedStages,...(s.stageLimit===1?{}:{lives:s.lives})}):'');}

 const lines=['【Emerald Arcade自動通知／本人の直接入力ではありません】'],who=seat=>seat===s.humanColor?'ユーザー':'あなた';
 const repair=s.operationRepair?.version===s.version&&s.operationRepair.count>0;
 const finished=s.status==='finished',action=s.status==='playing'&&s.turn!==s.humanColor&&!['round_over','hand_over'].includes(s.phase);
 if(s.playStyle==='quick')lines.push('【お気軽版】');
 if(s.game==='indian'){
  lines.push('インディアンポーカー '+s.handNumber+'/'+s.handLimit+'ハンド。あなたはseat 2、ユーザーはseat 1。');
  if(s.lastMove)lines.push((s.lastMove.actor==='human'?'ユーザー':'あなた')+'の操作：'+s.lastMove.action+(s.lastMove.amount?'（追加'+s.lastMove.amount+'枚）':'')+'。');
  if(s.phase==='hand_over')lines.push(indianHandFacts(s)+(finished?'':'次はユーザーが開始。'),INDIAN_REVIEW_INSTRUCTION);
  else if(s.phase==='betting')lines.push('相手の札だけが見え、自分の札は不明。具体的な数字・スート・分類・数値範囲は明かさず、強弱の評価は本当・誇張・嘘いずれも自由。決着前の種明かしはしない。');
  else lines.push('未配札。次の開始はユーザー。');
 }else if(s.game==='mancala'){
  lines.push('マンカラ／横取り'+(s.rulesConfig.capture?'あり':'なし')+'。勝利条件：'+(s.rulesConfig.winCondition==='empty'?'小皿6つを先に空にする。ゴールの石数は勝敗に使いません。':'集めた石の数（最後に残り石を回収）。'));
  if(s.lastHumanTurn?.length)lines.push('ユーザーの直近の手番：'+s.lastHumanTurn.map(m=>'穴'+m.pit+'から'+m.count+'個'+(m.captured?'（横取り'+m.captured+'個）':'')+(m.extraTurn?'（追加手番）':'')).join(' → '));
 }else if(s.game==='daifugo'){
  lines.push('大富豪 '+s.roundNumber+'/'+(s.roundLimit||3)+'ラウンド。'+(s.playStyle==='quick'?'この1回の勝者が優勝。':'最終ラウンドの勝者が優勝。')+'ユーザー残り'+s.hands[s.humanColor].length+'枚／あなた'+s.hands[3-s.humanColor].length+'枚。しばり'+(s.rulesConfig.binding?'ON':'OFF')+'・階段'+(s.rulesConfig.stairs?'ON':'OFF')+'。');
  if(s.lastMove)lines.push(who(s.lastMove.actor==='human'?s.humanColor:3-s.humanColor)+'の操作：'+(s.lastMove.label||s.lastMove.action)+'。'+(s.lastMove.events||[]).join('／'));
  if(!finished&&s.phase==='round_over')lines.push('このラウンドは'+who(s.rounds.at(-1).winner)+'の勝ち。次はユーザーが開始。');
 }else if(s.game==='texas'){
  lines.push('テキサスポーカー '+s.handNumber+'/'+s.handLimit+'ハンド。ユーザー'+s.stacks[s.humanColor]+'枚／あなた'+s.stacks[3-s.humanColor]+'枚。');
  if(s.lastMove)lines.push((s.lastMove.actor==='human'?'ユーザー':'あなた')+'の操作：'+s.lastMove.action+(s.lastMove.amount?'（追加'+s.lastMove.amount+'枚）':'')+'。');
  const last=s.hands.at(-1);if(s.phase==='hand_over'&&last)lines.push('このハンドは'+(last.winner?who(last.winner)+'の勝ち':'引き分け')+'。'+(last.reason==='fold'?'フォールド。手札は伏せたまま。':'ショーダウン。')+(finished?'':'次はユーザーが開始。'));
 }else if(s.game==='connectfour'){
  const colors=cfPieceColors(s),name=seat=>cfColor(colors[seat]).label;
  lines.push('四目並べ。ユーザーは'+name(s.humanColor)+(s.humanColor===1?' ●':' ◎')+'、あなたは'+name(3-s.humanColor)+(s.humanColor===1?' ◎':' ●')+'。');
  if(s.lastMove)lines.push((s.lastMove.actor==='human'?'ユーザー':'あなた')+'が'+s.lastMove.column+'列目に着手。');
 }else if(s.game==='hitblow'){
  lines.push('ヒット＆ブロー。答えは同色'+(s.rulesConfig.allowDuplicates?'あり':'なし')+'。双方別の問題。');
  const last=s.lastMove;if(last?.action==='guess')lines.push((last.actor==='human'?'ユーザー':'あなた')+'の予想：'+last.code.join(', ')+' → '+last.hits+' HIT / '+last.blows+' BLOW（'+last.attempt+'回目）。');
  if(s.matchDecided&&!finished)lines.push(gameOutcome(s).message);
 }else if(s.game==='blackjack'){
  const last=s.rounds.at(-1);lines.push('ブラックジャック '+s.round+'/'+(s.roundLimit||5)+'ラウンド。'+(s.playStyle==='quick'?'チップなし。':'ユーザー所持'+s.chips+'枚。'));
  if(s.phase==='dealer')lines.push('ユーザーの手番終了。あなた（ディーラー）の番：hit / stand。');
  else if(s.phase==='round_over'&&last)lines.push((last.split?'ラウンド終了：'+last.hands.map((h,i)=>'手札'+(i+1)+'は'+h.outcome+'（'+h.playerTotal+'）').join('／')+'、ディーラー'+last.dealerTotal+'。':'ラウンド終了：ユーザー'+last.playerTotal+'／ディーラー'+last.dealerTotal+'。')+(s.playStyle==='quick'?'':'ユーザー増減'+last.net+'枚。'));
  lines.push(blackjackPublicFacts(s));
  lines.push((s.phase==='deal'?'未配札。互換用のdealを実行。':'配札済み。')+'手札を創作せず、確定した公開情報だけで話す。');
 }else if(s.game==='yacht'){
  if(s.lastMove?.action==='score')lines.push((s.lastMove.actor==='human'?'ユーザー':'あなた')+'がヨットの'+s.lastMove.categoryName+'に'+s.lastMove.points+'点を記録。');
  else lines.push('ヨット '+s.round+'ラウンド。');
 }else{
  lines.push(s.lastMove?(s.lastMove.actor==='human'?'ユーザー':'あなた')+'がリバーシで'+s.lastMove.coordinate+'に着手。':'リバーシ開始。あなたは'+(s.humanColor===1?'白（後手）':'黒（先手）')+'。');
  if(s.passed)lines.push((s.passed===1?'黒':'白')+'は自動でパス。');
 }
 lines.push('対局ID: '+s.id+' ／ ルームID: '+s.roomId+' ／ 盤面の版番号: '+s.version);
 if(finished)lines.push(gameOutcome(s).message);
 else if(action){
  lines.push('あなたの番。まずrequest_capability(category=custom)→gameapps_get_stateで最新状態・合法手を確認→gameapps_play_moveで必ず操作。ツールの成功を確認するまで「出した・パスした」と断定せず、成功後に会話。');
  if(!['reversi','connectfour'].includes(s.game))lines.push('自分の番が続けば操作を続行。');
  lines.push('custom／引数はinput_args内。');
  if(!s.lastMove)lines.push('操作引数：session_id・room_id・expected_version・move。操作と勝敗はサーバーが確定。');
  if(s.game==='yacht'&&(!s.lastMove||repair))lines.push('最大3投。キープ・振り直しを検討し、役の確定まで操作。');
  if(repair){
   lines.push('【操作未実行の訂正通知】前の返答で操作が未実行です。発話だけで進めず、最新状態を取得して必ずツール操作してください。');
   const move=s.game==='blackjack'?(s.phase==='deal'?'deal':'stand'):'合法手';lines.push('gameapps_play_move呼び出し例：'+JSON.stringify({input_args:{session_id:s.id,room_id:s.roomId,expected_version:s.version,move}}));
   lines.push('例のmoveは現在の合法手から自分で選択。引数をトップレベルに置かず、全てinput_args辞書へ。成功結果を確認。');
  }
 }else lines.push('ユーザーの番です。操作せず、確定した結果を受けて会話。');
 if(['texas','daifugo'].includes(s.game))lines.push('非公開の手札・役・交換札は発話や思考表示で明かさず、ツール結果を転載しない。');
 if(s.game==='hitblow')lines.push('秘密の答えを推測で事実として話さない。');
 if(s.status==='playing'&&s.turn!==s.humanColor&&s.testCommentary)lines.push(commentaryInstruction(s));
 if(s.userNote?.version===s.version&&s.userNote.text)lines.push('','【ユーザー本人の入力／Emerald Arcadeの一言欄】',s.userNote.text);
 return lines.join('\n');
}
