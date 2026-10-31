import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
export class Store {
  constructor(dir){
    fs.mkdirSync(dir,{recursive:true});this.db=new DatabaseSync(path.join(dir,'games.sqlite'));
    this.db.exec(`PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY, body TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS games (id TEXT PRIMARY KEY, body TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS turns (game_id TEXT NOT NULL, version INTEGER NOT NULL, body TEXT NOT NULL, PRIMARY KEY(game_id,version));`);
  }
  settings(){return JSON.parse(this.db.prepare('SELECT body FROM settings WHERE id=1').get()?.body||'{}');}
  saveSettings(s){this.db.prepare('INSERT OR REPLACE INTO settings VALUES(1,?)').run(JSON.stringify(s));}
  get(id){const row=this.db.prepare('SELECT body FROM games WHERE id=?').get(id);if(!row)throw Error('対局が見つかりません。');return JSON.parse(row.body);}
  all(){return this.db.prepare('SELECT body FROM games ORDER BY rowid DESC').all().map(x=>JSON.parse(x.body));}
  create(s){this.db.prepare('INSERT INTO games VALUES(?,?)').run(s.id,JSON.stringify(s));}
  update(s,previousVersion=null){
    return this.updateMany([s],previousVersion);
  }
  updateMany(states,previousVersion=null){
    if(!states.length||states.some(s=>s.id!==states[0].id))throw Error('同じ対局の状態を指定してください。');
    const s=states.at(-1);
    this.db.exec('BEGIN IMMEDIATE');
    try {
      if(previousVersion!==null&&this.get(s.id).version!==previousVersion)throw Error('盤面が更新されています。最新の盤面を確認してください。');
      this.db.prepare('UPDATE games SET body=? WHERE id=?').run(JSON.stringify(s),s.id);
      for(const snapshot of states)this.db.prepare('INSERT OR REPLACE INTO turns VALUES(?,?,?)').run(snapshot.id,snapshot.version,JSON.stringify(snapshot));
      this.db.exec('COMMIT');
    }catch(e){this.db.exec('ROLLBACK');throw e;}
  }
  history(id){this.get(id);return this.db.prepare('SELECT body FROM turns WHERE game_id=? AND version>0 ORDER BY version').all(id).map(x=>JSON.parse(x.body));}
}
