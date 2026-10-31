export const NF_COLORS=[{id:'jade',name:'翠',symbol:'●',hex:'#438d79'},{id:'blue',name:'藍',symbol:'◆',hex:'#518bb2'},{id:'rose',name:'紅',symbol:'♥',hex:'#bb657a'},{id:'gold',name:'金',symbol:'★',hex:'#c59a3e'},{id:'violet',name:'紫',symbol:'✦',hex:'#9374a7'},{id:'clay',name:'朱',symbol:'▲',hex:'#c17f50'}];
export const NF_TACTICS=[
 {id:'leader_a',name:'旗手',type:'wild',symbol:'⚑',help:'好きな色・1〜10の数字。もう一方の万能札と合わせ、一人1枚まで使用。'},
 {id:'leader_b',name:'導き手',type:'wild',symbol:'⚑',help:'好きな色・1〜10の数字。もう一方の万能札と合わせ、一人1枚まで使用。'},
 {id:'cavalry',name:'疾駆',type:'wild',symbol:'➶',help:'好きな色の8として置く。'},
 {id:'shield',name:'小さな盾',type:'wild',symbol:'◇',help:'好きな色・1〜3の数字として置く。'},
 {id:'fog',name:'霧の帳',type:'terrain',symbol:'≋',help:'この旗では役を使わず、数字の合計だけで比較する。'},
 {id:'mud',name:'ぬかるみ',type:'terrain',symbol:'≈',help:'この旗は双方4枚で役を作る。外れたときは各自が残す3枚を選ぶ。'},
 {id:'scout',name:'見晴らし',type:'scout',symbol:'⌕',help:'山札を選びながら合計3枚引き、2枚をそれぞれの山札の上へ戻す。通常の補充も含む。'},
 {id:'redeploy',name:'布陣替え',type:'redeploy',symbol:'↗',help:'自分が置いた未確保の部隊・万能札・地形を移す、または捨てる。'},
 {id:'deserter',name:'退場',type:'deserter',symbol:'−',help:'相手が置いた未確保の部隊・万能札・地形1枚を捨てる。'},
 {id:'traitor',name:'引き抜き',type:'traitor',symbol:'⇄',help:'未確保の相手の通常部隊1枚を、自分の空き枠へ移す。万能札・地形は対象外。'}
];
export const NF_TROOPS=NF_COLORS.flatMap(c=>Array.from({length:10},(_,i)=>({id:c.id+'_'+(i+1),color:c.id,value:i+1,type:'troop'})));
const byId=new Map([...NF_TROOPS,...NF_TACTICS].map(c=>[c.id,Object.freeze(c)]));
export const nfCard=id=>byId.get(typeof id==='object'?id?.id:id);
export const nfColor=id=>NF_COLORS.find(c=>c.id===id);
export const nfLabel=id=>{const c=nfCard(id);return c?.type==='troop'?nfColor(c.color).name+c.value:c?.name||'不明な札';};
export const nfValues=id=>id==='cavalry'?[8]:id==='shield'?[1,2,3]:[1,2,3,4,5,6,7,8,9,10];
export const nfTokenStats=t=>{const c=nfCard(t.id);return {color:t.color??c.color,value:t.value??c.value};};
export function nfRank(tokens,fog=false){const a=tokens.map(nfTokenStats),v=a.map(c=>c.value).sort((a,b)=>a-b),same=a.every(c=>c.color===a[0]?.color),equal=v.every(n=>n===v[0]),run=v.every((n,i)=>!i||n===v[i-1]+1),rank=fog?0:same&&run?4:equal?3:same?2:run?1:0;return {rank,sum:v.reduce((a,b)=>a+b,0),name:fog?'合計で比較':['合計で勝負','連番','同じ色','同じ数字','同色の連番'][rank]};}
