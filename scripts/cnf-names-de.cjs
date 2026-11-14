/* CNF 2026: deutsche Anzeigenamen (Feld 1). Die Tabelle scripts/lib/cnf-names-de.json ({"CNF_<id>": "Name"})
 * ist KI-übersetzt und nicht amtlich. Fehlt eine ID, bleibt der englische Name.
 * Usage: node scripts/cnf-names-de.cjs list    -> "CNF_<id>\t<englischer Name>" je Zeile auf stdout
 *        node scripts/cnf-names-de.cjs check   -> zählt übersetzt/englisch, ohne zu schreiben
 *        node scripts/cnf-names-de.cjs apply   -> setzt Feld 1 der CNF-Einträge aus der Tabelle
 */
'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const TABLE_FILE=path.join(__dirname,'lib','cnf-names-de.json');
function loadTable(){return fs.existsSync(TABLE_FILE)?JSON.parse(fs.readFileSync(TABLE_FILE,'utf8')):{}}
function validTable(table){
 for(const [id,name] of Object.entries(table)){
  if(!/^CNF_\d+$/.test(id))throw Error('Unbekannte ID in Tabelle: '+id);
  if(typeof name!=='string'||!name.trim()||/[<>]/.test(name)||name!==name.trim())throw Error('Ungültiger Name für '+id+': '+JSON.stringify(name));
 }
 return table;
}
function catalogFiles(){return JSON.parse(fs.readFileSync(path.join(root,'catalog/manifest.json'),'utf8')).files}
// Setzt Feld 1 je CNF-Eintrag. Gibt Zahl der Übersetzungen und der englisch gelassenen Einträge zurück.
function applyNames(rows,table){
 let translated=0,kept=0;
 for(const r of rows){if(table[r[0]]!==undefined){r[1]=table[r[0]];translated++}else kept++}
 return {translated,kept};
}
module.exports={validTable,applyNames,loadTable};
if(require.main===module){
 const mode=process.argv[2];
 try{
  if(mode==='list'){
   for(const file of catalogFiles())for(const r of JSON.parse(fs.readFileSync(path.join(root,file),'utf8')))if(r[7]==='CNF 2026')process.stdout.write(r[0]+'\t'+r[2]+'\n');
  }else if(mode==='apply'||mode==='check'){
   const table=validTable(loadTable());
   const ids=new Set();let translated=0,kept=0;
   for(const file of catalogFiles()){
    const full=path.join(root,file),all=JSON.parse(fs.readFileSync(full,'utf8'));
    const rows=all.filter(r=>r[7]==='CNF 2026');
    if(!rows.length)continue;
    for(const r of rows)ids.add(r[0]);
    const res=applyNames(rows,table);translated+=res.translated;kept+=res.kept;
    if(mode==='apply'){const text=JSON.stringify(all);if(fs.readFileSync(full,'utf8')!==text)fs.writeFileSync(full,text)}
   }
   const unknown=Object.keys(table).filter(id=>!ids.has(id));
   if(unknown.length)throw Error('Tabelle enthält IDs ohne CNF-Eintrag: '+unknown.slice(0,5).join(', '));
   console.log(JSON.stringify({mode,cnf:ids.size,translated,kept}));
  }else throw Error('Usage: list | check | apply');
 }catch(error){console.error(error.message);process.exitCode=1}
}
