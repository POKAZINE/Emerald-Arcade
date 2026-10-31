export const DIRECTIONS = [-1,0,1].flatMap(r => [-1,0,1].map(c=>[r,c])).filter(([r,c])=>r||c);
export function initialBoard() {
  const b=Array(64).fill(0); b[27]=b[36]=2; b[28]=b[35]=1; return b;
}
export function flips(board, index, color) {
  if (!Number.isInteger(index)||index<0||index>63||board[index]) return [];
  const result=[], row=Math.floor(index/8),col=index%8;
  for(const [dr,dc] of DIRECTIONS) {
    let r=row+dr,c=col+dc, chain=[];
    while(r>=0&&r<8&&c>=0&&c<8&&board[r*8+c]===3-color){chain.push(r*8+c);r+=dr;c+=dc;}
    if(chain.length&&r>=0&&r<8&&c>=0&&c<8&&board[r*8+c]===color) result.push(...chain);
  }
  return result;
}
export const legalMoves=(board,color)=>board.flatMap((_,i)=>flips(board,i,color).length?[i]:[]);
export const coordinate=i=>`${'ABCDEFGH'[i%8]}${Math.floor(i/8)+1}`;
export function parseMove(move) {
  if(typeof move!=='string'||!/^[a-h][1-8]$/i.test(move)) throw Error('手は D3 のような座標で指定してください。');
  return (Number(move[1])-1)*8+move.toUpperCase().charCodeAt(0)-65;
}
export function applyMove(state, index, actor) {
  if(state.status!=='playing') throw Error('この対局は終了しています。');
  const expected=state.turn===state.humanColor?'human':'persona';
  if(actor!==expected) throw Error('まだあなたの手番ではありません。');
  const changed=flips(state.board,index,state.turn);
  if(!changed.length) throw Error('そこには置けません。目印のあるマスを選んでください。');
  const color=state.turn, board=[...state.board]; board[index]=color;for(const i of changed)board[i]=color;
  let turn=3-color,passed=null,status='playing';
  if(!legalMoves(board,turn).length) { passed=turn;turn=color;if(!legalMoves(board,turn).length){status='finished';passed=null;} }
  const black=board.filter(x=>x===1).length,white=board.filter(x=>x===2).length;
  const winner=black===white?0:black>white?1:2;
  return {...state,board,turn,status,passed,version:state.version+1,
    result:status==='finished'?(winner===0?'draw':winner===state.humanColor?'win':'loss'):null,
    lastMove:{index,color,actor,flips:changed,coordinate:coordinate(index),at:new Date().toISOString()},
    endedAt:status==='finished'?new Date().toISOString():null};
}
export function view(state) {
  return {...state,legal:state.status==='playing'?legalMoves(state.board,state.turn):[],
    counts:{black:state.board.filter(x=>x===1).length,white:state.board.filter(x=>x===2).length}};
}
