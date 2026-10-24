const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert'),{spawnSync}=require('node:child_process');
require('./check-handoff.cjs');
for(let file of fs.readdirSync('.').filter(x=>x.endsWith('.js')))new vm.Script(fs.readFileSync(file,'utf8'),{filename:file});
let html=fs.readFileSync('index.html','utf8');for(let match of html.matchAll(/(?:src|href)="([^"?#]+\.(?:js|css))(?:\?[^\"]*)?"/g))assert(fs.existsSync(match[1]),'Missing '+match[1]);
for(let file of ['check-food32.cjs','check-account33.cjs','check-onboarding.cjs','check-cloud.cjs','check-preview.cjs','check-refinement34.cjs','check-machines35.cjs']){let result=spawnSync(process.execPath,['tests/'+file],{stdio:'inherit'});if(result.status!==0)process.exit(result.status||1)}
console.log('PASS: JavaScript syntax, index references and regression suite');
