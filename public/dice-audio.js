// Locally generated plastic-dice impacts; no external recordings or assets.
export function createDiceRollBuffer(context,diceCount=5){
 const rate=context.sampleRate;
 const buffer=context.createBuffer(1,Math.ceil(rate*.7),rate);
 const samples=buffer.getChannelData(0);
 const count=Math.max(1,Math.min(5,diceCount));
 for(let die=0;die<count;die++){
  let time=.012+Math.random()*.065,gap=.095+Math.random()*.035;
  const pitch=.85+Math.random()*.3;
  for(let bounce=0;bounce<7;bounce++){
   const strength=(.7+Math.random()*.3)*Math.pow(.66,bounce);
   const start=Math.floor(time*rate),length=Math.ceil(rate*.045);
   for(let i=0;i<length&&start+i<samples.length;i++){
    const t=i/rate,attack=1-Math.exp(-t/.00016);
    const tick=(Math.random()*2-1)*Math.exp(-t/.0013)*.42;
    const body=Math.sin(2*Math.PI*920*pitch*t)*Math.exp(-t/.008)*.48
     +Math.sin(2*Math.PI*1730*pitch*t)*Math.exp(-t/.0045)*.28
     +Math.sin(2*Math.PI*2870*pitch*t)*Math.exp(-t/.0025)*.13;
    samples[start+i]+=strength*attack*(body+tick);
   }
   time+=gap;gap*=.72;
  }
 }
 let peak=0;for(const sample of samples)peak=Math.max(peak,Math.abs(sample));
 const scale=.82/Math.max(1.8,peak);
 for(let i=0;i<samples.length;i++)samples[i]*=scale;
 return buffer;
}
