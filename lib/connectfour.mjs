import {cfPieceColors,cfColor} from '../public/connectfour-colors.js';
export const CF_RULES='横7列・縦6段の立体四目ならべ。先手から交互に1個ずつ、1〜7の列を選んでコマを落とします。コマはその列の一番下の空きに入ります。満杯の列には置けません。縦・横・斜めに自分のコマが4個以上つながれば即勝利。42マスが埋まっても誰もそろわなければ引き分け。';
export function initialConnectFour(){return {game:'connectfour',board:Array(42).fill(0),turn:1,winningLine:[],moveCount:0};}
export function connectFourColumns(board){return Array.from({length:7},(_,i)=>i+1).filter(c=>!board[c-1]);}
export function connectFourLanding(board,column){for(let row=5;row>=0;row--)if(!board[row*7+column-1])return row*7+column-1;return -1;}
export function connectFourLine(board,index){
 const color=board[index];if(!color)return [];const row=Math.floor(index/7),col=index%7;
 for(const [dr,dc] of [[0,1],[1,0],[1,1],[1,-1]]){const line=[index];for(const sign of [-1,1]){let r=row+dr*sign,c=col+dc*sign;while(r>=0&&r<6&&c>=0&&c<7&&board[r*7+c]===color){sign===-1?line.unshift(r*7+c):line.push(r*7+c);r+=dr*sign;c+=dc*sign;}}if(line.length>=4)return line;}
 return [];
}
export function applyConnectFour(s,move,actor){
 if(s.status!=='playing')throw Error('この対局は終了しています。');
 if(actor!==(s.turn===s.humanColor?'human':'persona'))throw Error('まだあなたの手番ではありません。');
 const column=typeof move==='number'?move:typeof move==='string'&&/^(?:drop:)?[1-7]$/.test(move)?Number(move.replace('drop:','')):NaN;
 if(!Number.isInteger(column)||column<1||column>7)throw Error('1〜7の列を選んでください（例：drop:4）。');
 const index=connectFourLanding(s.board,column);if(index<0)throw Error('この列は満杯です。別の列を選んでください。');
 const next=structuredClone(s),color=s.turn;next.board[index]=color;next.moveCount=(s.moveCount||0)+1;next.version=s.version+1;
 next.lastMove={actor,color,column,row:Math.floor(index/7)+1,index,at:new Date().toISOString()};next.winningLine=connectFourLine(next.board,index);
 if(next.winningLine.length||next.board.every(Boolean)){next.status='finished';next.result=next.winningLine.length?(color===s.humanColor?'win':'loss'):'draw';next.endedAt=next.lastMove.at;}
 else next.turn=3-color;
 return next;
}
export function connectFourView(s){return {...s,pieceColors:cfPieceColors(s),legalColumns:s.status==='playing'?connectFourColumns(s.board):[]};}
export function connectFourContext(s){const colors=cfPieceColors(s),pieces=Object.fromEntries([1,2].map(seat=>[seat,{color_id:colors[seat],color_name:cfColor(colors[seat]).label,symbol:seat===1?'●':'◎',player:seat===s.humanColor?'user':'persona'}]));return {piece_colors:pieces,session_id:s.id,room_id:s.roomId,game:s.game,version:s.version,status:s.status,turn:s.status==='playing'?(s.turn===s.humanColor?'user':'persona'):null,persona_piece:3-s.humanColor,user_piece:s.humanColor,board:s.board.reduce((rows,_,i)=>{if(i%7===0)rows.push(s.board.slice(i,i+7).join(''));return rows;},[]),board_orientation:'上から下へ6行、左から右へ7列。0=空き、1='+pieces[1].color_name+' ●（先手）、2='+pieces[2].color_name+' ◎（後手）。列番号は左から1〜7。',legal_columns:s.status==='playing'?connectFourColumns(s.board):[],last_move:s.lastMove,winning_line:s.winningLine,rules:CF_RULES,instructions:'あなたはユーザーとの対局者です。customカテゴリのgameapps_get_stateで盤面を確認し、自分の手番にgameapps_play_moveを実行します。全引数はinput_args辞書にsession_id・room_id・expected_version・moveを指定。moveはdrop:4のように列番号を指定します。落下先と勝敗はサーバーが確定します。成功結果を確認してから、着手やユーザーの一手について自然に会話してください。色名は現在のpiece_colorsに従ってください。見た目の色が変わっても盤面の1・2、先手・後手、手番は変わりません。仮説と確定事項を区別してください。ユーザーの手番や終了後には操作しません。'};}
export function connectFourBotMove(s){
 const columns=connectFourColumns(s.board).sort((a,b)=>Math.abs(a-4)-Math.abs(b-4));
 const wins=(board,col,color)=>{const b=[...board],i=connectFourLanding(b,col);b[i]=color;return connectFourLine(b,i).length>0;};
 const win=columns.find(c=>wins(s.board,c,s.turn));if(win)return 'drop:'+win;
 const block=columns.find(c=>wins(s.board,c,3-s.turn));if(block)return 'drop:'+block;
 const safe=columns.filter(c=>{const b=[...s.board];b[connectFourLanding(b,c)]=s.turn;return !connectFourColumns(b).some(n=>wins(b,n,3-s.turn));});
 return 'drop:'+(safe[0]??columns[0]);
}
