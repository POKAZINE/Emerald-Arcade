export const CF_COLORS=[
 {id:'amber',label:'琥珀',light:'#f3ce78',dark:'#c68c35',ink:'#805923'},
 {id:'teal',label:'青緑',light:'#83c9c8',dark:'#397c80',ink:'#204f56'},
 {id:'red',label:'赤',light:'#ed9290',dark:'#b34451',ink:'#702837'},
 {id:'blue',label:'青',light:'#8cbde7',dark:'#3d71ae',ink:'#224772'},
 {id:'green',label:'緑',light:'#a5ce92',dark:'#548856',ink:'#305534'},
 {id:'purple',label:'紫',light:'#c9a5df',dark:'#885aa6',ink:'#53356c'},
 {id:'pink',label:'ピンク',light:'#f3b5cc',dark:'#ca789e',ink:'#824561'},
 {id:'ivory',label:'アイボリー',light:'#fffbed',dark:'#d1cbb7',ink:'#6a6555'}
];
export const CF_DEFAULT_COLORS={1:'amber',2:'teal'};
export const cfColor=id=>CF_COLORS.find(c=>c.id===id);
export function cfPieceColors(s){return s.pieceColors||CF_DEFAULT_COLORS;}
export function cfValidateColors(userColor,personaColor){if(!cfColor(userColor)||!cfColor(personaColor))throw Error('用意されたコマの色から選んでください。');if(userColor===personaColor)throw Error('見分けられるように、ふたりで異なる色を選んでください。');}
