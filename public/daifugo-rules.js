export const DF_SUITS={s:['spades','♠'],h:['hearts','♥'],d:['diamonds','♦'],c:['clubs','♣']};
export const dfRank=id=>id==='jk'?16:Number(id.slice(1))===1?14:Number(id.slice(1))===2?15:Number(id.slice(1));
export const dfCard=id=>id==='jk'?{joker:true}:{rank:Number(id.slice(1)),suit:DF_SUITS[id[0]][0]};
export const dfLabel=id=>id==='jk'?'ジョーカー':DF_SUITS[id[0]][1]+({1:'A',11:'J',12:'Q',13:'K'}[id.slice(1)]||id.slice(1));
export const dfSort=cards=>[...cards].sort((a,b)=>dfRank(a)-dfRank(b)||a.localeCompare(b));
const suitKey=ids=>ids.filter(id=>id!=='jk').map(id=>id[0]).sort().join('');
export function dfPatterns(ids,{stairs=false}={}){
 if(!ids.length||new Set(ids).size!==ids.length)return [];
 const real=ids.filter(id=>id!=='jk'),count=ids.length,rank=dfRank(real[0]||'jk'),patterns=[];
 const move='play:'+dfSort(ids).join(',');
 if(real.every(id=>dfRank(id)===rank)&&count<=5)patterns.push({kind:'group',count,value:rank,suits:suitKey(ids),joker:ids.includes('jk'),ids:dfSort(ids),move,label:count===1?dfLabel(ids[0]):dfLabel(real[0])+'の'+count+'枚組'});
 if(stairs&&count>=3&&count<=13&&real.length&&real.every(id=>id[0]===real[0][0])&&new Set(real.map(dfRank)).size===real.length){
  for(let start=3;start+count-1<=15;start++)if(real.every(id=>dfRank(id)>=start&&dfRank(id)<start+count))patterns.push({kind:'stairs',count,value:start,suits:real[0][0].repeat(count),joker:ids.includes('jk'),ids:dfSort(ids),move:move+':'+start,label:DF_SUITS[real[0][0]][1]+' '+Array.from({length:count},(_,i)=>({14:'A',15:'2',11:'J',12:'Q',13:'K'}[start+i]||start+i)).join('・')+'の階段'});
 }
 return patterns;
}
function reason(p,s,hand){
 if(p.joker&&p.count===hand.length)return 'ジョーカーを含む札では上がれません。別の札を残してください。';
 if(hand.length===p.count+1&&hand.includes('jk')&&!p.joker)return 'ジョーカーだけを残すと上がれなくなります。ジョーカーを先に出すか、ほかの札も残してください。';
 const t=s.table;if(!t)return '';
 const sp3=p.count===1&&p.ids[0]==='s3'&&t.count===1&&t.ids[0]==='jk';if(sp3)return '';
 if(p.count!==t.count)return '場は'+t.count+'枚です。同じ枚数を選んでください。';
 if(p.kind!==t.kind)return t.kind==='stairs'?'場は階段です。同じ枚数の階段を選んでください。':'場は同じ数字の組です。同じ形で出してください。';
 if(s.binding){const expected=s.binding.split(''),actual=p.kind==='stairs'?p.suits.split(''):p.ids.filter(id=>id!=='jk').map(id=>id[0]);for(const suit of actual){const i=expected.indexOf(suit);if(i<0)return 'しばり中です。表示されたスート構成に合わせてください。';expected.splice(i,1);}}
 const stronger=p.value===16?t.value!==16:t.value!==16&&(s.revolution?p.value<t.value:p.value>t.value);
 return stronger?'':'場より'+(s.revolution?'小さい':'大きい')+'数字が必要です。';
}
export function dfSelection(s,ids,hand){
 if(!ids.length)return {choices:[],error:'手札を選んでください。'};
 if(new Set(ids).size!==ids.length||ids.some(id=>!hand.includes(id)))return {choices:[],error:'自分の手札から選んでください。'};
 const patterns=dfPatterns(ids,s.rulesConfig),choices=patterns.filter(p=>!reason(p,s,hand));
 return {choices,error:choices.length?'':patterns.length?reason(patterns[0],s,hand):'同じ数字の組'+(s.rulesConfig.stairs?'、または同じスートの連番3枚以上':'')+'を選んでください。'};
}
function subsets(a){let out=[[]];for(const x of a)out=[...out,...out.map(v=>[...v,x])];return out.filter(v=>v.length);}
export function dfChoices(s,hand){
 const picks=new Map(),add=ids=>{for(const p of dfSelection(s,ids,hand).choices)picks.set(p.move,p);};
 for(const id of hand)add([id]);
 for(let rank=3;rank<=15;rank++){const group=hand.filter(id=>id!=='jk'&&dfRank(id)===rank);for(const ids of subsets(group)){add(ids);if(hand.includes('jk'))add([...ids,'jk']);}}
 if(s.rulesConfig.stairs)for(const suit of Object.keys(DF_SUITS))for(let count=3;count<=13;count++)for(let start=3;start+count<=16;start++){
  const ids=Array.from({length:count},(_,i)=>suit+({14:1,15:2}[start+i]||start+i)),missing=ids.filter(id=>!hand.includes(id));if(!missing.length)add(ids);else if(missing.length===1&&hand.includes('jk'))add([...ids.filter(id=>hand.includes(id)),'jk']);
 }
 return [...picks.values()];
}
