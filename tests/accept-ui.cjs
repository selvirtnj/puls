// Gemeinsamer Modus `--accept-ui` der *-order-Tests (Golden-Dateien in tests/fixtures/).
// Nach einer gewollten Änderung der Oberfläche übernimmt er nur die vom HTML abgeleiteten Werte (Länge, Hash, Inhalt) in die Golden-Datei.
// Bricht ab, sobald sich etwas anderes ändert (Ablauf, Glieder, Laden, Rückgabe, Variablen, Zustand, Schlüssel).
// Zeilenenden der Datei bleiben erhalten, geschrieben wird wie die Aufzeichnung (JSON, Einzug 1).
const fs=require('node:fs');
// html: Schlüssel, deren Wert aus dem HTML stammt. mask: Muster für HTML-Prüfsummen innerhalb anderer Texte (Wirkungen, Ladeprotokoll).
module.exports=function acceptUi(file,golden,now,{html,mask=/(?!)/g}){
 const out=structuredClone(golden),bad=[],norm=s=>s.replace(mask,'#');
 (function walk(g,n,o,path){
  for(const key of new Set([...Object.keys(g),...Object.keys(n)])){
   const p=path+'/'+key;
   if(!(key in g)||!(key in n))bad.push(p+' (nur auf einer Seite)');
   else if(g[key]&&typeof g[key]==='object'&&n[key]&&typeof n[key]==='object')walk(g[key],n[key],o[key],p);
   else if(g[key]!==n[key]){
    if(html.includes(key)||(typeof g[key]==='string'&&typeof n[key]==='string'&&norm(g[key])===norm(n[key])))o[key]=n[key];
    else bad.push(p);
   }
  }
 })(golden,now,out,'');
 if(bad.length)throw Error(`--accept-ui abgebrochen: ${bad.length} Werte ändern sich, die nicht vom HTML stammen, z. B. ${bad.slice(0,5).join(', ')}`);
 const eol=fs.readFileSync(file,'utf8').includes('\r\n')?'\r\n':'\n';
 fs.writeFileSync(file,(JSON.stringify(out,null,1)+'\n').replace(/\n/g,eol));
 console.log(`--accept-ui: ${file} aktualisiert.`);
};
