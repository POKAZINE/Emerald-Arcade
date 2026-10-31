// Shared by preview and server. A whole forbidden run always has the same mask.
export const maskExplanation=value=>String(value).normalize('NFKC').replace(/[\p{Script=Katakana}\p{Script=Latin}][\p{Script=Katakana}\p{Script=Latin}ー]*/gu,'＊＊＊');
export const explanationLength=value=>Array.from(String(value)).length;
export const normalizeAnswer=value=>String(value).normalize('NFKC').toLocaleLowerCase('ja').replace(/[ァ-ヶ]/g,c=>String.fromCharCode(c.charCodeAt(0)-0x60)).replace(/[\s\p{P}\p{Z}]/gu,'');
