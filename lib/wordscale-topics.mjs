import {randomInt} from 'node:crypto';

// Independently written topics, scales and practice examples for Emerald Arcade.
export const scaleTopics=[
 {id:'pause',category:'daily',title:'ひと休みにしたいこと',low:'ほんのひと息',high:'とびきりのご褒美',examples:['窓を少し開ける','温かいお茶をいれる','好きな音楽でのんびり','日帰りの温泉旅行','何も気にせず長い休暇']},
 {id:'parcel',category:'daily',title:'突然届いたらうれしいもの',low:'小さなうれしさ',high:'忘れられない喜び',examples:['かわいい付箋','お気に入りのお菓子','大切な人からの手紙','ずっと欲しかった道具','夢への招待状']},
 {id:'room',category:'daily',title:'部屋にあったら落ち着くもの',low:'ちょっと落ち着く',high:'ここから離れたくない',examples:['小さな鉢植え','柔らかい照明','読み慣れた本の棚','窓辺の大きなソファ','理想を全部詰めたくつろぎ部屋']},
 {id:'outing',category:'together',title:'ふたりで過ごす休日の予定',low:'ささやかな寄り道',high:'一生の思い出',examples:['近所を散歩','喫茶店でおしゃべり','一日かけて街を探検','憧れの場所への旅行','ふたりの夢をかなえる旅']},
 {id:'surprise',category:'wonder',title:'物語の中で出会う不思議',low:'少し不思議',high:'世界観がひっくり返る',examples:['花が一輪だけ光る','猫が道を教える','空に浮かぶ図書館','昨日と明日が入れ替わる','世界そのものが誰かの夢だった']},
 {id:'welcome',category:'daily',title:'旅先で迎えてくれるもの',low:'ほっとする',high:'帰りたくなくなる',examples:['道案内の看板','冷たい飲み物','地元の人の笑顔','名前を覚えてくれた宿の人','もうひとつの故郷と呼べる居場所']},
 {id:'curtain',category:'daily',title:'朝、カーテンを開けた先に見えた景色',low:'いつも通り',high:'思わず見とれる',examples:['向かいの家の屋根','庭先に咲いた新しい花','朝日に透ける並木道','霧の海に浮かぶ山々','空いっぱいの光の帯と満開の花畑']},
 {id:'rainy-day',category:'daily',title:'雨の日、家の中で楽しみたいこと',low:'少し気が晴れる',high:'雨の日が待ち遠しくなる',examples:['湯気の立つお茶を飲む','積んでいた漫画を読む','手作りのお菓子で映画会','窓辺に小さな室内キャンプを作る','雨音に合わせて開くふたりだけの秘密の喫茶店']},
 {id:'evening-sound',category:'daily',title:'一日の終わりに聞こえてきた音',low:'少し気がゆるむ',high:'心から安らぐ',examples:['お湯が沸いた合図','窓の外の葉擦れ','好きな曲の静かなイントロ','隣で眠る大切な相手の寝息','懐かしい声で迎えてくれる、おかえりの一言']},
 {id:'walk-discovery',category:'daily',title:'散歩中、つい足を止めるもの',low:'ちらっと気になる',high:'時間を忘れて眺める',examples:['道端の小さな芽','塀の上で昼寝する猫','職人が作業する店の窓','夕暮れに色を変える湖','星空を映しながら光る、誰も知らない泉']},
 {id:'room-device',category:'daily',title:'いつもの部屋に足してみたい仕掛け',low:'少し便利になる',high:'暮らしが一変する',examples:['鍵を掛ける小さなフック','座ったまま届く可動棚','気分に合わせて変わる窓の景色','考えただけで家事を済ませる壁','扉を開けるたび好きな場所につながる部屋']},
 {id:'tomorrow-self',category:'daily',title:'明日の自分に用意しておくもの',low:'ちょっと助かる',high:'心から感謝したくなる',examples:['充電したイヤホン','すぐ食べられる朝ごはん','気がかりを片付けたメモ','忙しい一日を丸ごと休める段取り','ずっと抱えていた悩みへの解決策と、支えてくれる仲間']},
 {id:'craft-together',category:'together',title:'ふたりで挑戦する、小さなものづくり',low:'気軽に作れる',high:'完成したら大きな達成感',examples:['紙を折ったしおり','色違いのビーズ飾り','小さな木製の本棚','思い出の風景を再現した模型','何年も直しながら完成させた、ふたりの小さな家']},
 {id:'secret-place',category:'together',title:'相手に案内してみたい、自分だけの場所',low:'ちょっと見せたい',high:'とっておきとして紹介したい',examples:['よく立ち寄る売店','木陰で休めるベンチ','夕日がきれいな裏道','子どもの頃から大事にしてきた隠れ家','人生の節目にだけ訪れる、誰にも教えたことのない場所']},
 {id:'ordinary-promise',category:'together',title:'何でもない日に、ふたりで決める約束',low:'軽い思いつき',high:'ずっと大切にしたい',examples:['次のお茶は違う味にする','週末に同じ映画を見る','毎年同じ木の写真を撮る','離れていても季節の便りを送り合う','どんな日にも、互いの居場所をひとつ残しておく']},
 {id:'found-name',category:'together',title:'一緒に見つけたものに付ける名前',low:'その場で忘れそう',high:'何年後も覚えていそう',examples:['丸い石に、まるちゃん','曲がった枝に、おじぎ棒','雨宿りした軒先に、ふたりの雨宿り駅','迷子の末に見つけた星に、帰り道の灯り','夢をかなえた日に植えた木に、はじまりの約束']},
 {id:'meeting-event',category:'together',title:'ふたりの待ち合わせ場所で起きたこと',low:'少し意外',high:'到着早々、大騒ぎ',examples:['同じ色の服を着てきた','噴水に小さな虹が出た','街の楽団が突然演奏を始めた','建物の屋上に巨大な鳥が降りてきた','広場ごと空へ浮かび、街中が救出作戦を始めた']},
 {id:'way-home-gift',category:'together',title:'帰り道、相手が差し出してくれたもの',low:'ちょっとうれしい',high:'胸がいっぱいになる',examples:['個包装の飴','冷えた手を温めるカイロ','前に好きだと話した花','ふたりの何気ない日々を描いた手帳','諦めていた再会をかなえる切符と、付き添う約束']},
 {id:'unknown-tool',category:'wonder',title:'引き出しの奥から見つかった、見知らぬ道具',low:'用途がすぐ想像できる',high:'何に使うか見当もつかない',examples:['先が丸まった封筒開け','歯が入れ替わる小さなブラシ','影だけを挟む洗濯ばさみ','持ち主の夢で形を変える輪','触れると昨日と明日の区別がなくなる、穴のない鍵']},
 {id:'dream-ride',category:'wonder',title:'一晩だけ使える、夢の中の乗り物',low:'少し乗ってみたい',high:'朝まで降りたくない',examples:['静かに走る小さな手押し車','花の道を進む自転車','雲の上をすべる寝台列車','見たい星を巡る透明な帆船','大切な思い出の続きを旅できる、夜明けを待つ飛行艇']},
 {id:'spirit-helper',category:'wonder',title:'小さな精霊が引き受けてくれるお手伝い',low:'ささやかな助け',high:'毎日が大きく変わる',examples:['本のしおりを挟む','落とし物を光らせる','眠る間に家を掃除する','必要なときに休む時間を作る','誰も無理をせず暮らせるよう、街の困り事を解いて回る']},
 {id:'imaginary-festival',category:'wonder',title:'架空の街で、毎年開かれるお祭り',low:'ご近所の催し',high:'世界中から見に来る',examples:['路地のお茶と交換市','町内の光る風車大会','街全体を彩る空中灯籠流し','大陸を渡る巨獣と並んで歩く祝祭','世界の夜空が一度だけつながる、星の橋の開通祭']},
 {id:'book-invitation',category:'wonder',title:'古い本に挟まれていた招待状の行き先',low:'少し興味がある',high:'すべてを置いて向かいたい',examples:['近所の小さな展示室','閉店した喫茶店の一日開店','海底の図書館の夜間見学','昔なくした思い出に会える庭','もう一度だけ大切な相手と続きを話せる場所']},
 {id:'midnight-window',category:'wonder',title:'夜中、窓の外を通り過ぎたもの',low:'見間違いで済みそう',high:'誰かに話さずにはいられない',examples:['風に舞う白い袋','遠くを横切る淡い光','傘を差して空を歩く人','屋根より大きな透明の魚群','街の空を静かに運んでいく、もうひとつの月']},
 {id:'house-rules',category:'wonder',title:'留守番を頼まれた家の、変わった決まり',low:'すぐ慣れそう',high:'一晩守るだけで大変',examples:['入るとき観葉植物に挨拶する','時計が鳴ったら窓を少し開ける','部屋を移るたび家具としりとりする','眠る月を起こさず屋根に水をやる','夜明けまで、部屋ごとに違う季節を見張り続ける']},
 {id:'shop-notice',category:'wonder',title:'小さな店の入口に書かれていた注意書き',low:'ほとんど気にならない',high:'入る前に覚悟がいる',examples:['入口の鈴は一度だけ鳴らす','靴の影も一緒に脱ぐ','注文は棚の本にささやく','お代として昨日の夢をひとつ頂きます','出口がどの時代につながるかは保証できません']},
 {id:'bag-stranger',category:'wonder',title:'鞄に紛れ込んでいた、心当たりのないもの',low:'少し気になる',high:'持ち主を探さずにはいられない',examples:['見覚えのないレシート','小さな刺繍入りのハンカチ','誰かの名前を呼び続ける貝殻','大切な約束が刻まれた、温かい懐中時計','帰る場所を失った小さな星と、消えかけた救助の手紙']},
 {id:'library-event',category:'wonder',title:'静かな図書館で、突然起きた出来事',low:'一瞬顔を上げる',high:'館内が騒然とする',examples:['本が一冊、床に落ちた','机の花が小さく歌った','本棚がひとりで場所を入れ替えた','物語の登場人物が読者を探し始めた','すべての本から海があふれ、館内に船が迎えに来た']},
 {id:'imaginary-job',category:'wonder',title:'一日だけ任された、架空の仕事',low:'気楽に引き受けられる',high:'責任の重さに身が引き締まる',examples:['昼寝する雲に名札を付ける','虹の端の色を整える','街の夢の忘れ物を届ける','季節が入れ替わる扉を開ける','世界が明日へ進む最後の時計を守る']},
 {id:'inn-key',category:'wonder',title:'旅の宿で渡された、追加の鍵',low:'普通の用途に見える',high:'何が開くのか想像もつかない',examples:['部屋番号の付いた小さな鍵','庭の温室と書かれた木の鍵','月明かりにだけ鍵穴を映す鍵','差す場所より先に扉を生み出す鍵','持つたびに、自分が知らない記憶の奥から音がする鍵']}
];

const publicTopic=({id,title,low,high})=>({id,title,low,high});
const shuffled=values=>{const a=[...values];for(let i=a.length-1;i>0;i--){const j=randomInt(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;};
// Persist the offer plan once per game. Reads/retries never reroll candidates.
export function createWordscaleTopicOptions(){
 const groups=['daily','together','wonder'].map(category=>shuffled(scaleTopics.filter(t=>t.category===category)));
 return Object.fromEntries([1,2,3].map(stage=>[stage,shuffled(groups.map(group=>group[stage-1].id))]));
}
export function wordscaleTopicChoices(stage,s){
 const used=new Set((s?.stages||[]).filter(t=>t.stage<stage).map(t=>t.topic?.id));
 const usedTitles=new Set((s?.stages||[]).filter(t=>t.stage<stage).map(t=>t.topic?.title));
 const allowed=t=>!used.has(t.id)&&!usedTitles.has(t.title);
 // Existing games keep their original offers; future offers omit played topics.
 const ids=s?.topicOptions?.[stage]||Array.from({length:3},(_,i)=>scaleTopics[((stage-1)*2+i)%6].id);
 const candidates=ids.map(id=>scaleTopics.find(t=>t.id===id)).filter(t=>t&&allowed(t));
 for(const category of ['daily','together','wonder'])if(candidates.length<3&&!candidates.some(t=>t.category===category)){
  const extra=scaleTopics.find(t=>t.category===category&&allowed(t)&&!candidates.includes(t));if(extra)candidates.push(extra);
 }
 for(const t of scaleTopics)if(candidates.length<3&&allowed(t)&&!candidates.includes(t))candidates.push(t);
 return candidates.slice(0,3).map(publicTopic);
}
