const schema=(properties,required=[])=>({type:'object',properties,required,additionalProperties:false});
const identity={session_id:{type:'string',description:'対局ID'},room_id:{type:'string',description:'対戦中のNexusArkルームID'}};
export const toolDefinitions=[
 {name:'gameapps_list_games',description:'遊べるゲームの一覧を取得。',inputSchema:schema({})},
 {name:'gameapps_list_sessions',description:'指定ルームの進行中の対局と現在の状態を取得。',inputSchema:schema({room_id:identity.room_id},['room_id'])},
 {name:'gameapps_get_state',description:'今の対局の状態・操作形式・合法手・versionを取得。最初または状態不明・更新エラー時に使用。操作結果も最新状態なので、連続手番では再取得不要。',inputSchema:schema(identity,['session_id','room_id'])},
 {name:'gameapps_play_move',description:'あなたの手番に操作。最初にgameapps_get_stateで確認し、そのゲームのinstructionsと合法手に従う。発話だけでは着手になりません。action_appliedで成功を確認し、action_requiredなら返された最新versionで操作を続けてから会話。',inputSchema:schema({...identity,expected_version:{type:'integer',description:'最新状態のversion'},move:{type:'string',description:'その対局のinstructionsで指定された操作文字列。JSON指定もJSON文字列。'}},['session_id','room_id','expected_version','move'])}
];
for(const tool of toolDefinitions)tool.description+=' NexusArkでは全引数をinput_args辞書内に指定。';
