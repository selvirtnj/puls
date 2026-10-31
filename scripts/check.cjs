const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert'),{spawnSync}=require('node:child_process');
require('./check-handoff.cjs');
for(let file of ['sw.js',...fs.readdirSync('js').filter(x=>x.endsWith('.js')).map(x=>'js/'+x)])new vm.Script(fs.readFileSync(file,'utf8'),{filename:file});
let html=fs.readFileSync('index.html','utf8');for(let match of html.matchAll(/(?:src|href)="([^"?#]+\.(?:js|css))(?:\?[^\"]*)?"/g))assert(fs.existsSync(match[1]),'Missing '+match[1]);
for(let file of ['check-app-icons.cjs','check-color-offline.cjs','check-food32.cjs','check-account33.cjs','check-onboarding.cjs','check-profile-planning.cjs','check-cloud.cjs','check-cloud-robustness.cjs','check-preview.cjs','check-refinement34.cjs','check-machines35.cjs','check-exercise-muscles.cjs','check-small-polish.cjs','check-running.cjs','check-run-metrics.cjs','check-native-scanner.cjs','check-native-state.cjs','check-native-training.cjs','check-audit-ui.cjs','check-edge-back.cjs']){let result=spawnSync(process.execPath,['tests/'+file],{stdio:'inherit'});if(result.status!==0)process.exit(result.status||1)}
let foodNavy=spawnSync(process.execPath,['tests/check-food-navy.cjs'],{stdio:'inherit'});if(foodNavy.status!==0)process.exit(foodNavy.status||1);
console.log('PASS: JavaScript syntax, index references and regression suite');
