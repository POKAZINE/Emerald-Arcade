export function failureMessage(error,s){
 const timeout=error.name==='TimeoutError'||/timeout|timed out/i.test(error.message);
 const cause=timeout?'NexusArkの応答待ちがタイムアウトしました。':'NexusArkとの通信を完了できませんでした。';
 const progress=s.status==='finished'?'対局結果は保存済みです。':s.turn===s.humanColor?'相手の操作は反映済みで、あなたの手番です。':s.game==='daifugo'?'手札・交換・ラウンド進行は保存済みです。':['liars','indian','texas'].includes(s.game)?(s.game==='liars'?'出目・チップ・宣言は保存済みです。':'手札・チップ・進行は保存済みです。'):s.game==='blackjack'?'カード・ベット・チップは保存済みです。':'サイコロ・得点・盤面は保存済みです。';
 return `${cause} ${progress} 本体の起動を確認して「接続を確認して復旧」を押してください。`;
}
export function recoveryMessage(s){
 return s.status==='finished'?'NexusArkへの接続を確認しました。対局結果は保存されています。必要なら終了通知を再開できます。':s.turn===s.humanColor?'NexusArkへの接続を確認しました。相手の操作は保存済みです。返答が届かなかった場合も、あなたの手番から続けられます。':'NexusArkへの接続を確認しました。保存済みの対局の状態から、相手の手番を再開できます。';
}
