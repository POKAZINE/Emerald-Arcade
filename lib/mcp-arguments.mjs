// NexusArk's StructuredTool wrapper exposes input_args instead of forwarding
// arbitrary top-level fields. Keep ordinary MCP clients working as well.
export function normalizeArguments(raw) {
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('引数はオブジェクトで指定してください。');
  const result={...raw};
  for(const wrapper of ['input_args','kwargs']){
    const nested=raw[wrapper];
    if(nested===undefined||nested===null)continue;
    if(typeof nested!=='object'||Array.isArray(nested))throw Error(`${wrapper} は辞書で指定してください。`);
    for(const [key,value] of Object.entries(nested)){
      if(key==='input_args'||key==='kwargs')throw Error('引数の入れ子が深すぎます。input_args 内へ直接指定してください。');
      if(Object.hasOwn(result,key)&&JSON.stringify(result[key])!==JSON.stringify(value))throw Error(`引数 ${key} が重複し、値が異なります。`);
      result[key]=value;
    }
  }
  delete result.input_args;delete result.kwargs;
  return result;
}
export function requireArguments(args,keys){
  const missing=keys.filter(k=>args[k]===undefined||args[k]===null||args[k]==='');
  if(missing.length)throw Error(`必須引数が届いていません: ${missing.join(', ')}。NexusArkからは input_args 辞書の中に引数をまとめて呼び出してください。例: {"input_args":{"session_id":"対局ID","room_id":"example_room","expected_version":1,"move":"C3"}}。対局IDを推測せず、最新の対局情報を使用してください。`);
}
