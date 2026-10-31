import {totals} from './yacht.mjs';
export function gameOutcome(s){
 if(s.game==='liars')return s.status==='finished'?{winner:s.result==='draw'?'draw':s.result==='win'?'user':'persona',user_result:s.result,stacks:{user:s.stacks[1],persona:s.stacks[2]},message:'ライアーズダイスの対局終了。ユーザー'+s.stacks[1]+'枚／あなた'+s.stacks[2]+'枚。'+(s.result==='draw'?'引き分け。':(s.result==='win'?'ユーザー':'あなた')+'の勝利。')+'操作不要。公開された出目・チップで振り返り、次の開始は案内しない。'}:null;
 if(s.game==='nineflags')return s.status==='finished'?{winner:s.result==='draw'?'draw':s.result==='win'?'user':'persona',user_result:s.result,winning_flags:s.winningFlags,flags:{user:s.flags.filter(f=>f.owner===1).length,persona:s.flags.filter(f=>f.owner===2).length},message:'九旗のかけひき終了。'+(s.result==='draw'?'引き分け。':(s.result==='win'?'ユーザー':'あなた')+'の勝利。'+(s.winReason==='adjacent'?'旗'+s.winningFlags.join('・')+'を連続獲得。':'合計'+(s.playStyle==='quick'?3:5)+'旗を獲得。'))+'操作不要。公開された旗と決着理由で振り返り、未公開の手札・山札は明かさない。'}:null;
 if(s.game==='quartet')return s.status==='finished'?{winner:s.result==='draw'?'draw':s.result==='win'?'user':'persona',user_result:s.result,winning_groups:s.winningGroups,message:'しるしの四重奏が終了しました。'+(s.result==='draw'?'16マスが埋まり、引き分けです。':(s.result==='win'?'ユーザー':'あなた')+'の勝利です。共通点：'+[...new Set(s.winningGroups.flatMap(g=>g.attributes.map(a=>a.label)))].join('・')+'。')+'操作は不要。確定盤面と共通点を受けて会話してください。'}:null;if(s.game==='paraphrase')return s.status==='finished'?{cooperative:true,result:'clear',message:'ことばの言いかえが終了しました。'+s.roundLimit+'問中'+s.rounds.filter(r=>r.reason==='solved').length+'回通じ合いました。勝敗ではありません。公開された答えと説明を振り返ってください。操作不要。'}:null;if(s.game==='bestfive')return s.status==='finished'?{cooperative:true,result:'clear',message:'ふたりのベスト5が終了しました。総合勝敗はありません。全ラウンドの順位・好きな理由・予想を振り返ってください。操作は不要です。'}:null;if(s.game==='geister')return s.status==='finished'?{winner:s.winner===1?'user':'persona',user_result:s.result,reason:s.winReason,message:(s.winner===1?'ユーザー':'あなた')+'の勝利。'+({escape:(s.winner===1?'ユーザー':'あなた')+'のよいおばけが出口から脱出しました。',capture_good:(s.winner===1?'ユーザーがあなた':'あなたがユーザー')+'のよいおばけを4体とも捕獲しました。',lose_bad:(s.winner===1?'あなたがユーザー':'ユーザーがあなた')+'のわるいおばけを4体とも捕獲したため決着しました。'}[s.winReason])+'対局終了。未公開の正体は明かさずに結果を受けて会話してください。'}:null;
if(s.game==='lateral')return s.status==='finished'?{cooperative:true,result:s.result,message:s.result==='clear'?'ユーザーが真相を解き明かしました。確定した答えを振り返ってください。':'ユーザーが答えを公開して終了しました。勝敗ではありません。'}:null;
if(s.game==='lastcard')return s.status==='finished'?{winner:s.result==='draw'?'draw':s.result==='win'?'user':'persona',user_result:s.result,message:s.result==='draw'?'双方が動けないため引き分けです。これ以上の操作は不要です。':(s.result==='win'?'ユーザー':'あなた')+'が先に上がり、勝利しました。これ以上の操作は不要です。結果を受けて会話してください。'}:null;
 if(s.game==='wordscale')return s.status==='finished'?{cooperative:true,result:s.result,cleared_stages:s.clearedStages,message:s.result==='clear'?'ふたりで全ステージをクリアしました。':(s.stageLimit===1?'順番がつながらず、チャレンジ終了です。':'共有ライフがなくなり終了しました。')+'対戦の勝ち負けではありません。'}:null;
  if(s.game==='hitblow'){
    if(!s.matchDecided)return null;const winner=s.result==='draw'?'draw':s.result==='win'?'user':'persona';
    return {winner,user_result:s.result,persona_result:winner==='draw'?'draw':winner==='user'?'loss':'win',solved_at:{user:s.players[s.humanColor].solvedAt,persona:s.players[3-s.humanColor].solvedAt},message:('ヒット＆ブローの勝敗が確定しました。'+(winner==='draw'?'引き分けです。':winner==='user'?'ユーザーの勝利です。':'あなたの勝利です。')+(s.status==='finished'?'両者の挑戦も終了しました。':'未正解の側は、続けるか終えるかを選び、通算8回まで挑戦できます。勝敗は変わりません。'))};
  }
  if(s.status!=='finished')return null;
  if(s.game==='mancala'){
    const user=s.cups[s.humanColor===1?6:13],persona=s.cups[s.humanColor===1?13:6],winner=s.result==='draw'?'draw':s.result==='win'?'user':'persona';
    if(s.rulesConfig.winCondition==='empty'){const remaining={user:s.cups.slice(s.humanColor===1?0:7,s.humanColor===1?6:13).reduce((a,b)=>a+b,0),persona:s.cups.slice(s.humanColor===1?7:0,s.humanColor===1?13:6).reduce((a,b)=>a+b,0)};return {winner,user_result:s.result,persona_result:winner==='draw'?'draw':winner==='user'?'loss':'win',win_condition:'empty',remaining,message:'マンカラ（自分の小皿6つを先に空にした側が勝ち）が終了しました。'+(winner==='draw'?'同時に両側が空になり、引き分けです。':winner==='user'?'ユーザーの小皿が先に空になり、ユーザーの勝利です。':'あなたの小皿が先に空になり、あなたの勝利です。')+'ゴールの石数は勝敗に使いません。残り石の回収もありません。これ以上の操作は不要です。確定結果を受けて会話してください。'};}
    return {winner,user_result:s.result,persona_result:winner==='draw'?'draw':winner==='user'?'loss':'win',scores:{user,persona},message:'マンカラが終了しました。残り石を回収した最終得点はユーザー'+user+'個・あなた'+persona+'個。'+(winner==='draw'?'引き分けです。':winner==='user'?'ユーザーの勝利です。':'あなたの勝利です。')+'これ以上の操作は不要です。最終結果を受けて会話してください。'};
  }
  if(s.game==='daifugo'){

    const winner=s.result==='win'?'user':'persona';
    return {winner,user_result:s.result,persona_result:s.result==='win'?'loss':'win',rounds:s.rounds.map(r=>({round:r.number,winner:r.winner===s.humanColor?'user':'persona'})),message:'大富豪'+(s.playStyle==='quick'?'お気軽版（1ラウンド）':'')+'の対局が終了しました。'+(s.playStyle==='quick'?'この1回の勝者である':'第3ラウンドの勝者である')+(s.result==='win'?'ユーザー':'あなた')+'が総合優勝です。勝利数の合計ではありません。これ以上の操作は不要です。未公開の手札・交換札は明かさず対局後の言葉を伝えてください。'};
  }
  if(s.game==='indian'){const winner=s.result==='draw'?'draw':s.result==='win'?'user':'persona';return {winner,user_result:s.result,stacks:{user:s.stacks[1],persona:s.stacks[2]},message:'インディアンポーカーの対局終了。ユーザー'+s.stacks[1]+'枚、あなた'+s.stacks[2]+'枚。'+(winner==='draw'?'引き分け。':winner==='user'?'ユーザーの勝利。':'あなたの勝利。')+'双方の札は公開済み。操作は不要、確定結果を受けて会話してください。'};}
  if(s.game==='texas'){
    const winner=s.result==='draw'?'draw':s.result==='win'?'user':'persona';
    return {winner,user_result:s.result,persona_result:winner==='draw'?'draw':winner==='user'?'loss':'win',stacks:{user:s.stacks[s.humanColor],persona:s.stacks[3-s.humanColor]},message:'テキサスポーカーの対局が終了しました。ユーザー'+s.stacks[s.humanColor]+'枚・あなた'+s.stacks[3-s.humanColor]+'枚。'+(winner==='draw'?'引き分けです。':winner==='user'?'ユーザーの勝利です。':'あなたの勝利です。')+'これ以上の操作は不要です。フォールドで隠れた手札は明かさず、結果を受けて会話してください。'};
  }
  if(s.game==='connectfour'){
    const winner=s.result==='draw'?'draw':s.result==='win'?'user':'persona';
    return {winner,user_result:s.result,persona_result:winner==='draw'?'draw':winner==='user'?'loss':'win',winning_line:s.winningLine,message:'四目並べの対局が終了しました。'+(winner==='draw'?'盤面が埋まり、引き分けです。':winner==='user'?'ユーザーのコマが4個以上つながり、ユーザーの勝利です。':'あなたのコマが4個以上つながり、あなたの勝利です。')+'これ以上の着手は不要です。最終盤面と結果を受けて会話してください。'};
  }
  if(s.game==='blackjack'&&s.playStyle==='quick'){
    const winner=s.result==='draw'?'draw':s.result==='win'?'user':'persona';const r=s.rounds.at(-1);
    return {winner,user_result:s.result,persona_result:s.result==='draw'?'draw':s.result==='win'?'loss':'win',message:'ブラックジャックお気軽版の1ラウンドが終了しました。ユーザー'+r.playerTotal+'・ディーラー'+r.dealerTotal+'。'+(winner==='draw'?'引き分けです。':winner==='user'?'ユーザーの勝利です。':'あなた（ディーラー）の勝利です。')+'チップ・120枚目標はありません。これ以上の操作は不要です。結果を受けて会話してください。'};
  }
  if(s.game==='blackjack'){
    const winner=s.result==='draw'?'draw':s.result==='win'?'user':'persona';
    return {chips:s.chips,starting_chips:100,target_chips:s.targetChips??null,net:s.chips-100,winner,user_result:s.result,persona_result:winner==='draw'?'draw':winner==='persona'?'win':'loss',message:`ブラックジャックの対局が終了しました。ユーザーの最終所持チップは${s.chips}枚、開始時100枚から${s.chips-100}枚。${s.targetChips?`勝利目標は${s.targetChips}枚以上。`:''}${winner==='draw'?'引き分けです。':winner==='user'?'ユーザーの勝利です。':'あなた（ディーラー）の勝利です。'}これ以上の操作は不要です。結果を踏まえて対局後の言葉を伝えてください。`};
  }
  if(s.game==='yacht'){
    const user=totals(s.sheets[s.humanColor]).total,persona=totals(s.sheets[3-s.humanColor]).total;
    const winner=user===persona?'draw':user>persona?'user':'persona';
    return {scores:{user,persona},winner,persona_result:winner==='draw'?'draw':winner==='persona'?'win':'loss',user_result:s.result,message:`ヨットの対局が終了しました。ユーザー${user}点・あなた${persona}点。${winner==='draw'?'引き分けです。':winner==='persona'?'あなたの勝利です。':'ユーザーの勝利です。'}これ以上の操作は不要です。結果を踏まえて対局後の言葉を伝えてください。`};
  }
  const black=s.board.filter(v=>v===1).length,white=s.board.filter(v=>v===2).length;
  const winnerColor=black===white?null:black>white?'black':'white';
  const humanColor=s.humanColor===1?'black':'white';
  const winner=winnerColor===null?'draw':winnerColor===humanColor?'user':'persona';
  return {counts:{black,white},winner_color:winnerColor,winner,persona_result:winner==='draw'?'draw':winner==='persona'?'win':'loss',user_result:winner==='draw'?'draw':winner==='user'?'win':'loss',
    message:`リバーシの対局が終了しました。最終石数は黒${black}枚・白${white}枚。${winner==='draw'?'引き分けです。':winner==='persona'?'あなたの勝利、ユーザーの敗北です。':'ユーザーの勝利、あなたの敗北です。'}これ以上の着手は不要です。確定した結果を踏まえてユーザーへ対局後の言葉を伝えてください。`};
}
