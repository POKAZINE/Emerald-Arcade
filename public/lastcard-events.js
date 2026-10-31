const colors={red:'赤',blue:'青',green:'緑',yellow:'黄'},kinds={skip:'スキップ',reverse:'リバース',draw2:'ドロー2',wild:'色変更',wild4:'ドロー4'};
const cardName=c=>c?(colors[c.color]||'')+(c.kind==='number'?c.number:kinds[c.kind]):'ドロー札';
export function unseenLastcardActions(actions,cursor){return (actions||[]).filter(e=>Number.isSafeInteger(e.seq)&&e.seq>cursor).sort((a,b)=>a.seq-b.seq);}
export function lastcardPresentation(e,personaName='ペルソナ'){
 const actor=e.seat===1?'あなた':e.seat===2?personaName:'ボット';
 if(e.type==='play'&&e.cards?.length>1)return {actor,title:e.card.number+'を'+e.cards.length+'枚まとめて出しました',detail:e.cards.map(cardName).join('・')+'。次の色：'+colors[e.color]+'。'+(e.last?'ラスト！ 残り1枚です。':'残り'+e.countAfter+'枚。'),card:e.card};
 if(e.type==='play')return {actor,title:cardName(e.card)+'を出しました',detail:(e.card?.color?'':('次の色：'+colors[e.color]+'。'))+(e.last?'ラスト！ 残り1枚です。':'残り'+e.countAfter+'枚。'),card:e.card};
 if(e.type==='draw')return {actor,title:e.count+'枚引きました',detail:(e.reason==='penalty'?cardName(e.source)+'の効果で。':e.reason==='no_play'?'出せる札がないため、自動で1枚引きました。':'「1枚引く」を選びました。')+' 手札 '+e.countBefore+'枚 → '+e.countAfter+'枚。'+(e.turnEnded?'この手番は終了です。':'引いた札を出すか、残すか選べます。'),count:e.count};
 if(e.type==='pass')return {actor,title:'パスしました',detail:'引いた札を手札に残して、手番を終えました。'};
 if(e.type==='skip')return {actor,title:'手番をスキップ',detail:e.source==='reverse'?'2人のリバースはスキップと同じ効果です。':'スキップの効果で、この手番はお休みです。'};
 if(e.type==='reverse')return {actor,title:'順番が逆になりました',detail:'リバースの効果で、反対回りに進みます。'};
 if(e.type==='out')return {actor,title:'ボットが上がりました',detail:'最後の札の効果を引き継いで退出。ここから、あなたと'+personaName+'の勝負です。'};
 return {actor:'対局終了',title:e.result==='win'?'あなたの勝ち':e.result==='loss'?personaName+'の勝ち':'引き分け',detail:'おつかれさまでした。結果を振り返れます。'};
}
