export const QUARTET_TRAITS=[['tone','明暗'],['shape','形'],['hole','穴'],['pattern','模様']];
export const QUARTET_PIECES=Object.freeze(Array.from({length:16},(_,i)=>Object.freeze({id:'q'+String(i).padStart(2,'0'),tone:i&1?'dark':'light',shape:i&2?'square':'round',hole:i&4?'hollow':'solid',pattern:i&8?'striped':'plain'})));
const byId=new Map(QUARTET_PIECES.map(p=>[p.id,p]));
export const quartetPiece=id=>byId.get(id);
export const quartetWords=p=>p?[p.tone==='light'?'明るい':'暗い',p.shape==='round'?'丸':'四角',p.hole==='hollow'?'穴あり':'穴なし',p.pattern==='striped'?'しま模様':'無地']:[];
export const quartetLabel=id=>quartetWords(typeof id==='string'?quartetPiece(id):id).join('・');
export const quartetTraitWord=(key,value)=>({light:'明るい',dark:'暗い',round:'丸',square:'四角',hollow:'穴あり',solid:'穴なし',striped:'しま模様',plain:'無地'})[value];
let svgId=0;
export function quartetPieceSvg(id,extra=''){
 const p=quartetPiece(id);if(!p)return '';const light=p.tone==='light',fill=light?'#efe7cb':'#356054',shade=light?'#b9a47c':'#193e36',stripe=light?'#ac9464':'#96b6a3',clip='quartet-cap-'+(++svgId);
 const cap=p.shape==='round'?'<ellipse cx="50" cy="35" rx="31" ry="25"/>':'<rect x="19" y="10" width="62" height="50" rx="5"/>';
 return `<svg class="qt-piece ${extra}" viewBox="0 0 100 86" aria-hidden="true" focusable="false"><defs><clipPath id="${clip}">${cap}</clipPath></defs><ellipse cx="50" cy="69" rx="34" ry="9" fill="#10251b26"/><g fill="${shade}">${p.shape==='round'?'<path d="M19 35V47a31 25 0 0 0 62 0V35Z"/>':'<rect x="19" y="24" width="62" height="49" rx="5"/>'}</g><g fill="${fill}" stroke="${light?'#877658':'#acc3ac'}" stroke-opacity=".55" stroke-width="1.4">${cap}</g>${p.pattern==='striped'?`<g clip-path="url(#${clip})" stroke="${stripe}" stroke-width="7" opacity=".92">${[-50,-23,4,31,58,85].map(x=>`<path d="M${x} 68L${x+75} -7"/>`).join('')}</g>`:''}${p.hole==='hollow'?`<ellipse cx="50" cy="35" rx="12" ry="10" fill="#122e27" stroke="${light?'#baa57a':'#adc6ad'}" stroke-width="3"/><path d="M40 37Q50 30 60 37" stroke="#0005" stroke-width="3" fill="none"/>`:''}<path d="M25 19Q48 5 73 19" stroke="#fff" stroke-opacity=".16" stroke-width="2" fill="none"/></svg>`;
}
export function drawQuartetPiece(c,id,x,y,size){
 const p=quartetPiece(id);if(!p)return;c.save();c.translate(x-size/2,y-size*.43);c.scale(size/100,size/100);const light=p.tone==='light';
 const cap=()=>{c.beginPath();if(p.shape==='round')c.ellipse(50,35,31,25,0,0,Math.PI*2);else c.rect(19,10,62,50);};
 c.fillStyle=light?'#b9a47c':'#193e36';if(p.shape==='round'){c.beginPath();c.ellipse(50,47,31,25,0,0,Math.PI*2);c.fill();}else c.fillRect(19,23,62,49);
 cap();c.fillStyle=light?'#efe7cb':'#356054';c.fill();c.strokeStyle=light?'#877658':'#acc3ac';c.lineWidth=1.4;c.stroke();
 if(p.pattern==='striped'){c.save();cap();c.clip();c.strokeStyle=light?'#ac9464':'#96b6a3';c.lineWidth=7;for(const n of [-50,-23,4,31,58,85]){c.beginPath();c.moveTo(n,68);c.lineTo(n+75,-7);c.stroke();}c.restore();}
 if(p.hole==='hollow'){c.beginPath();c.ellipse(50,35,12,10,0,0,Math.PI*2);c.fillStyle='#122e27';c.fill();c.strokeStyle=light?'#baa57a':'#adc6ad';c.lineWidth=3;c.stroke();}c.restore();
}
