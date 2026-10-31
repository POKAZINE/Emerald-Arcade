import test from 'node:test';import assert from 'node:assert/strict';
import {initialNineflags,applyNineflags,nineflagsView,nineflagsContext,nineflagsLegal,nineflagsBotMove,nfFormation,nfClaim} from '../lib/nineflags.mjs';
import {NF_TROOPS,NF_TACTICS,nfCard} from '../public/nineflags-cards.js';
import {resultCardData} from '../public/result-card-data.js';import {gameNotification} from '../lib/game-notification.mjs';import {gameOutcome} from '../lib/game-outcome.mjs';
const fresh=(tactics=true)=>({id:'nf-test',mode:'nexus',roomId:'example_room',personaName:'模擬相手',status:'playing',version:0,conversation:[],delivery:{status:'idle'},...initialNineflags(tactics,'user')});
const act=(s,m)=>applyNineflags(s,m,s.turn===1?'human':'persona');
function fixture(h1,h2=[]){const s=fresh();s.hands={1:h1,2:h2};return rebuild(s);}
function rebuild(s){const used=new Set([...s.hands[1],...s.hands[2],...s.flags.flatMap(f=>[...f.rows[1],...f.rows[2],...f.terrain].map(t=>t.id)),...s.discard]);s.troopDeck=NF_TROOPS.map(c=>c.id).filter(id=>!used.has(id));s.tacticDeck=s.rulesConfig.tactics?NF_TACTICS.map(c=>c.id).filter(id=>!used.has(id)):[];return s;}
const tokens=(ids,at=1)=>ids.map(id=>({id,at}));
function conserved(s){const ids=[...s.hands[1],...s.hands[2],...s.troopDeck,...s.tacticDeck,...s.discard,...s.flags.flatMap(f=>[...f.rows[1],...f.rows[2],...f.terrain].map(t=>t.id))];assert.equal(ids.length,s.rulesConfig.tactics?70:60);assert.equal(new Set(ids).size,ids.length);}

test('九旗：60部隊と10戦術・各7枚・戦術と先手の選択・色以外の記号',()=>{
 for(const tactics of [false,true]){const s=fresh(tactics);assert.equal(s.flags.length,9);assert.equal(s.hands[1].length,7);assert.equal(s.tacticDeck.length,tactics?10:0);conserved(s);}assert.equal(initialNineflags(true,'persona').turn,2);assert.throws(()=>initialNineflags('yes'));assert.throws(()=>initialNineflags(true,'invalid'));
});
test('役：3枚／泥の4枚、同色連番＞同数＞同色＞連番＞合計、霧は合計のみ',()=>{
 for(const n of [3,4]){const sample=[Array.from({length:n},(_,i)=>'jade_'+(i+1)),['jade_8','blue_8','rose_8','gold_8'].slice(0,n),['jade_1','jade_4','jade_8','jade_10'].slice(0,n),['jade_1','blue_2','rose_3','gold_4'].slice(0,n),['jade_1','blue_4','rose_8','gold_10'].slice(0,n)];assert.deepEqual(sample.map(x=>nfFormation(tokens(x)).rank),[4,3,2,1,0]);for(const a of sample)assert.equal(nfFormation(tokens(a),true).rank,0);}
});
test('証明：手札・山札の秘密を使わず、公開された札だけ。未完成側は同点では逆転できない',()=>{
 let s=fresh();s.flags[0].rows[1]=tokens(['jade_2','blue_2','rose_2'],1);s.flags[0].rows[2]=tokens(['jade_7','blue_6'],2);rebuild(s);assert.ok(nfClaim(s,1,1));const before=nfClaim(s,1,1);s.hands[2]=s.hands[2].slice().reverse();s.troopDeck.reverse();assert.deepEqual(nfClaim(s,1,1),before);
 s=fresh();s.flags[0].rows[1]=tokens(['jade_8','jade_9','jade_10'],1);s.flags[0].rows[2]=tokens(['blue_8','blue_9'],2);rebuild(s);assert.ok(nfClaim(s,1,1));
 s=fresh();s.flags[0].rows[1]=tokens(['jade_1','jade_2','jade_3'],1);s.flags[0].rows[2]=tokens(['blue_8'],2);rebuild(s);assert.equal(nfClaim(s,1,1),null);s.hands[1]=['blue_7','blue_9','blue_10'];rebuild(s);assert.equal(nfClaim(s,1,1),null);
});
test('旗の獲得は開始時だけ、役と合計が同じなら先に完成。隣接3旗で即終了',()=>{
 let s=fixture(['jade_1'],['blue_1']);for(let n=0;n<3;n++){s.flags[n].rows[2]=tokens(['jade_8','jade_9','jade_10'],1);s.flags[n].rows[1]=tokens(['blue_1','blue_4','blue_8'],2);}s.phase='draw';rebuild(s);s=act(s,{action:'draw',pile:'troop'});assert.equal(s.status,'finished');assert.equal(s.result,'loss');assert.deepEqual(s.winningFlags,[1,2,3]);assert.match(gameOutcome(s).message,/旗1・2・3/);assert.doesNotMatch(gameNotification(s),/あなたの番|補充や割り込み/);
 s=fresh();s.flags[0].rows[1]=tokens(['jade_4','jade_5','jade_6'],3);s.flags[0].rows[2]=tokens(['blue_4','blue_5','blue_6'],2);rebuild(s);assert.equal(nfClaim(s,1,1),null);assert.ok(nfClaim(s,1,2));
});
test('配置後に山札選択、1つしかなければ自動補充、確保済みと古い操作・他人の手札を拒否',()=>{
 let s=fixture(['jade_1'],['blue_1']);const old=structuredClone(s);assert.throws(()=>act(s,{action:'place',card_id:'blue_1',flag:1}));assert.deepEqual(s,old);s=act(s,{action:'place',card_id:'jade_1',flag:1});assert.equal(s.phase,'draw');assert.equal(s.turn,1);assert.throws(()=>applyNineflags(s,{action:'draw',pile:'troop'},'persona'));s=act(s,{action:'draw',pile:'troop'});assert.equal(s.turn,2);conserved(s);
 s=fresh(false);const id=s.hands[1][0];s=act(s,{action:'place',card_id:id,flag:1});assert.equal(s.turn,2);assert.equal(s.hands[1].length,7);s.flags[0].owner=1;assert.throws(()=>act(s,{action:'place',card_id:s.hands[2][0],flag:1}));assert.throws(()=>act(s,{action:'pass'}));
});
test('万能札4種：本人の色数字指定・手番開始に保存と判定・万能2枚目と戦術連打の制限',()=>{
 for(const [id,value]of [['leader_a',10],['leader_b',1],['cavalry',8],['shield',3]]){let s=fixture([id,'leader_b'],['blue_1']);if(id==='leader_b')s=fixture([id],['blue_1']);s=act(s,{action:'tactic',card_id:id,flag:4,color:'rose',value});assert.equal(s.flags[3].rows[1][0].value,value);assert.equal(s.tacticCounts[1],1);assert.ok(s.leaderUsed[1]===id.startsWith('leader'));s=act(s,{action:'draw',pile:'troop'});s=act(s,{action:'place',card_id:'blue_1',flag:1});s=act(s,{action:'draw',pile:'troop'});assert.equal(s.phase,'assign');s=act(s,{action:'assign',flag:4,card_id:id,color:'blue',value});assert.equal(s.flags[3].rows[1][0].color,'blue');s=act(s,{action:'begin'});assert.equal(s.phase,'play');assert.ok(!nineflagsLegal(s).tactics.length);conserved(s);}
 let s=fixture(['cavalry']);assert.throws(()=>act(s,{action:'tactic',card_id:'cavalry',flag:1,color:'jade',value:9}));s=fixture(['leader_b']);s.leaderUsed[1]=true;assert.throws(()=>act(s,{action:'tactic',card_id:'leader_b',flag:1,color:'jade',value:10}));
});
test('霧・泥：比較条件、4枚枠、獲得した旗は効果の対象外',()=>{
 for(const id of ['fog','mud']){let s=fixture([id]);s=act(s,{action:'tactic',card_id:id,flag:2});assert.equal(s.flags[1].terrain[0].id,id);assert.equal(nineflagsView(s).flags[1].terrain[0].by,1);conserved(s);}let s=fixture(['fog']);s.flags[1].owner=2;assert.throws(()=>act(s,{action:'tactic',card_id:'fog',flag:2}));
});
test('布陣替え・退場・引き抜き：部隊と地形の合法対象、相手側から同じ旗への引き抜き',()=>{
 let s=fixture(['redeploy']);s.flags[0].rows[1]=tokens(['jade_6']);rebuild(s);s=act(s,{action:'tactic',card_id:'redeploy',target_id:'jade_6',to_flag:4});assert.equal(s.flags[0].rows[1].length,0);assert.equal(s.flags[3].rows[1][0].id,'jade_6');conserved(s);
 s=fixture(['deserter']);s.flags[1].terrain=[{id:'fog',by:2}];rebuild(s);s=act(s,{action:'tactic',card_id:'deserter',target_id:'fog'});assert.ok(s.discard.includes('fog'));assert.ok(s.discard.includes('deserter'));conserved(s);
 s=fixture(['traitor']);s.flags[0].rows[2]=tokens(['rose_7']);rebuild(s);s=act(s,{action:'tactic',card_id:'traitor',target_id:'rose_7',to_flag:1});assert.equal(s.flags[0].rows[1][0].id,'rose_7');assert.equal(s.flags[0].rows[2].length,0);conserved(s);
 s=fixture(['redeploy']);s.flags[0].terrain=[{id:'fog',by:1}];rebuild(s);s=act(s,{action:'tactic',card_id:'redeploy',target_id:'fog',to_flag:null});assert.ok(s.discard.includes('fog'));conserved(s);
});
test('泥を外す：各自が残す3枚を選び、元の補充手順へ戻る。途中は再起動可能な純粋状態',()=>{
 let s=fixture(['deserter']);s.flags[0].terrain=[{id:'mud',by:2}];s.flags[0].rows[1]=tokens(['jade_1','jade_2','jade_3','jade_4']);s.flags[0].rows[2]=tokens(['blue_1','blue_2','blue_3','blue_4']);rebuild(s);s=act(s,{action:'tactic',card_id:'deserter',target_id:'mud'});assert.equal(s.phase,'trim');assert.equal(s.turn,1);assert.throws(()=>act(s,{action:'trim',keep_ids:['jade_1']}));s=act(s,{action:'trim',keep_ids:['jade_1','jade_2','jade_3']});assert.equal(s.turn,2);s=structuredClone(s);s=act(s,{action:'trim',keep_ids:['blue_1','blue_2','blue_3']});assert.equal(s.turn,1);assert.equal(s.phase,'draw');assert.ok(s.discard.includes('jade_4'));assert.ok(s.discard.includes('blue_4'));conserved(s);
});
test('見晴らし：3枚を山札選択で引き、2枚を上から順に戻す。内容は相手に漏れない',()=>{
 let s=fixture(['scout','jade_1','jade_2','jade_3','jade_4','jade_5','jade_6']);s=act(s,{action:'tactic',card_id:'scout'});for(const pile of ['troop','tactic','troop'])s=act(s,{action:'scout_draw',pile});assert.equal(s.phase,'scout_return');assert.equal(s.hands[1].length,9);assert.equal(nineflagsContext(s).own_hand.length,0);assert.throws(()=>act(s,{action:'scout_return',card_ids:['jade_1','jade_1']}));s=act(s,{action:'scout_return',card_ids:['jade_2','jade_1']});assert.equal(s.troopDeck[0],'jade_2');assert.equal(s.troopDeck[1],'jade_1');assert.equal(s.hands[1].length,7);assert.equal(s.turn,2);assert.doesNotMatch(JSON.stringify(s.events.at(-1)),/jade_/);conserved(s);
});
test('秘匿：相手の手札と山札の並びが変わっても投影は同じ。共有は公開盤面だけ',()=>{
 let s=fresh(),v=nineflagsView(s),c=nineflagsContext(s),alter=structuredClone(s);[alter.hands[2][0],alter.troopDeck[0]]=[alter.troopDeck[0],alter.hands[2][0]];alter.tacticDeck.reverse();assert.deepEqual(nineflagsView(alter),v);alter=structuredClone(s);[alter.hands[1][0],alter.troopDeck[0]]=[alter.troopDeck[0],alter.hands[1][0]];assert.deepEqual(nineflagsContext(alter),c);assert.ok(!('hands'in v)&&!('troopDeck'in v)&&!('tacticDeck'in v));assert.throws(()=>resultCardData(v));s.status='finished';s.result='win';s.winningFlags=[1,2,3];s.winReason='adjacent';s.conversation=[{text:'共有しない会話'}];const data=resultCardData(nineflagsView(s));assert.equal(data.name,'九旗のかけひき');assert.doesNotMatch(JSON.stringify(data),/共有しない|own_hand|roomId|troopDeck|"hand"/);data.flags[0].owner=2;assert.equal(s.flags[0].owner,0);
});
test('練習ボット同士の完走：両モード・全札の保存則・合法手のみ・勝利条件',()=>{
 for(const tactics of [false,true]){let s=fresh(tactics),steps=0;while(s.status==='playing'&&steps++<240){s=act(s,nineflagsBotMove(s));conserved(s);}assert.equal(s.status,'finished','steps '+steps);assert.ok(['five','adjacent'].includes(s.winReason));assert.ok(s.winningFlags.length>=3);}
});


test('お気軽版：5旗・戦術なし固定・7枚、旗6を拒否・配置後は自動補充',()=>{
 let s={...fresh(),...initialNineflags(true,'user',true)};assert.equal(s.playStyle,'quick');assert.equal(s.flags.length,5);assert.equal(s.rulesConfig.tactics,false);assert.equal(s.tacticDeck.length,0);assert.equal(s.hands[1].length,7);assert.equal(s.hands[2].length,7);assert.equal(nineflagsView(s).playStyle,'quick');assert.throws(()=>act(s,{action:'place',card_id:s.hands[1][0],flag:6}));s=act(s,{action:'place',card_id:s.hands[1][0],flag:1});assert.equal(s.turn,2);assert.equal(s.phase,'play');assert.equal(s.hands[1].length,7);conserved(s);const c=nineflagsContext(s);assert.equal(c.play_style,'quick');assert.equal(c.flags.length,5);assert.match(c.rules,/先に3旗/);assert.match(c.rules,/隣接勝利なし/);assert.doesNotMatch(c.instructions,/scout_return|tactic/);
});
test('お気軽版：離れた1・3・5旗でも3旗で決着。通常版と旧対局は9旗のまま',()=>{
 let s={...fresh(),...initialNineflags(false,'persona',true)};s.hands={1:['jade_1'],2:['gold_2']};for(const [i,n]of [1,3,5].entries()){s.flags[n-1].rows[1]=tokens([8,9,10].map(v=>['jade','blue','rose'][i]+'_'+v),1);s.flags[n-1].rows[2]=tokens([1,4,8].map(v=>['gold','violet','clay'][i]+'_'+v),2);}rebuild(s);s=act(s,{action:'place',card_id:'gold_2',flag:2});assert.equal(s.status,'finished');assert.equal(s.winReason,'three');assert.deepEqual(s.winningFlags,[1,3,5]);assert.match(gameOutcome(s).message,/合計3旗/);assert.doesNotMatch(gameOutcome(s).message,/合計5旗/);assert.match(gameNotification(s),/お気軽版/);const d=resultCardData(nineflagsView(s));assert.equal(d.playStyle,'quick');assert.equal(d.flags.length,5);const old=fresh();delete old.playStyle;assert.equal(nineflagsView(old).playStyle,'standard');assert.equal(old.flags.length,9);
});
test('お気軽版：両先手のボット完走と札の保存・3旗決着',()=>{
 for(const first of ['user','persona']){let s={...fresh(),...initialNineflags(false,first,true)},n=0;while(s.status==='playing'&&n++<80){s=act(s,nineflagsBotMove(s));conserved(s);}assert.equal(s.status,'finished');assert.equal(s.winReason,'three');assert.equal(s.flags.filter(f=>f.owner===s.winner).length,3);assert.equal(s.flags.length,5);}
});
