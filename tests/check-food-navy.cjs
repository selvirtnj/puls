const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const node=()=>({innerHTML:'',textContent:'',value:'',hidden:true,dataset:{},blur(){},querySelectorAll:()=>[],insertAdjacentHTML(where,html){this.innerHTML+=html}});
async function searchCases(){
 const nodes=Object.fromEntries(['results','search','ff-online','food-online-status','food-online-results','ff-clear','ff-shortcuts','foodbody'].map(id=>[id,node()]));
 let timers=new Map(),seq=0,calls=[],listeners={},now=Date.now();
 const c={console,URLSearchParams,AbortController,Date:class extends Date{static now(){return now}},Map,Set,navigator:{onLine:true},englishUI:{},
  state:{custom:[{id:'saved',name:'Skyr',brand:'Brand',barcode:'123',kcal:60}],foods:[]},foods:[],localCatalogue:[],foodResultList:[],
  foodTypingTimer:null,catalogueQuerySerial:0,foodSearchRequest:null,foodSearchResults:[],foodSearchCache:new Map(),foodSearchTimes:[],
  quickActionPaths:{},modal:{addEventListener:(name,fn)=>listeners[name]=fn},document:{querySelectorAll:()=>[]},$:(id)=>nodes[id]||null,
  setTimeout(fn,ms){timers.set(++seq,{fn,ms});return seq},clearTimeout:id=>timers.delete(id),
  normalizeSearch:s=>String(s).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim(),esc:String,n:String,
  savedFoodMatches:()=>c.state.custom,foodPriority:()=>0,foodRelevance:()=>0,catalogueAlternatives:()=>[],uniqueFoods:x=>x,
  fetch:(url,opts)=>new Promise(resolve=>calls.push({url,opts,resolve})),
  mapOffProduct:(p,barcode)=>({name:p.product_name,brand:p.brands||'',barcode,kcal:p.nutriments?.kcal??null,p:null,c:null,f:null})};
 for(const name of ['openModal','foodForm','foodTab','searchFoodDatabase','applyFoodQuantity','syncFoodQuantity','changeFoodQuantityUnit','setFoodDensity','previewFood','attachFoodExtras','saveHouseholdPortion','selectFood','chooseCatalogueFood','stopBarcode','startBarcodeCamera','confirmProduct','addCustom'])c[name]=()=>{};
 vm.createContext(c);vm.runInContext(fs.readFileSync('js/food-flow.js','utf8'),c);
 const search=q=>{nodes.search.value=q;c.searchFoods(q)},tick=async ms=>{for(const [id,t] of [...timers])if(t.ms===ms){timers.delete(id);await t.fn()}},reply=async(i,products)=>{calls[i].resolve({ok:true,json:async()=>({products})});await new Promise(setImmediate)};
 search('Sk');assert.match(nodes.results.innerHTML,/Skyr/);assert.equal(timers.size,0);
 search('Sky');search('Skyr');assert.equal([...timers.values()].filter(t=>t.ms===450).length,1);assert.equal(calls.length,0);
 // Start without awaiting the network response.
 let first=[...timers].find(([,t])=>t.ms===450);timers.delete(first[0]);const pending=first[1].fn();await Promise.resolve();assert.equal(calls.length,1);
 c.ffSearchNow();c.showSearch();c.searchFoods('Skyr');assert(!calls[0].opts.signal.aborted);assert.equal(calls.length,1,'Enter, showSearch and catalogue refresh reuse the current query');
 assert.match(calls[0].url,/app_name=PULS/);assert.match(calls[0].url,/fields=/);assert.equal(calls[0].opts.credentials,'omit');
 search('Skyrs');assert(calls[0].opts.signal.aborted);await reply(0,[{code:'stale',product_name:'Stale'}]);await pending;assert.doesNotMatch(nodes['food-online-results'].innerHTML,/Stale/);
 let second=[...timers].find(([,t])=>t.ms===450);timers.delete(second[0]);const pending2=second[1].fn();await Promise.resolve();
 await reply(1,[{code:'123',product_name:'Different barcode duplicate'},{code:'456',product_name:'Skyr',brands:'Brand'},
  {code:'789',product_name:'Unique',brands:'Other'},{code:'790',product_name:'Unique',brands:'Other'},
  {code:'789',product_name:'Same code'},{code:'999',product_name:'No nutrients'}]);await pending2;
 const html=nodes['food-online-results'].innerHTML;assert.doesNotMatch(html,/Different|Same code|>Skyr</);assert.equal((html.match(/>Unique</g)||[]).length,1);assert.match(html,/No nutrients/);assert.match(html,/Werte unvollständig/);assert.equal(nodes['ff-online'].hidden,false);
 c.navigator.onLine=false;search('Offline');await tick(450);assert.equal(calls.length,2);assert.equal(nodes['ff-online'].hidden,true);
 c.navigator.onLine=true;search('Closed');listeners.close();await tick(450);assert.equal(calls.length,2);
 search('Failure');let failure=[...timers].find(([,t])=>t.ms===450);timers.delete(failure[0]);const failed=failure[1].fn();await Promise.resolve();calls[2].resolve({ok:false});await failed;assert.equal(nodes['food-online-status'].textContent,'Gerade nicht verfügbar');assert.equal(timers.size,0);
 // An abort before fetch dispatch consumes no request quota; an abort after dispatch does.
 let used=c.foodSearchTimes.length;search('Unsent');const unsent=c.ffAutoOnline('Unsent');search('Replacement');await unsent;assert.equal(c.foodSearchTimes.length,used);assert.equal(calls.length,3);
 c.foodSearchTimes=Array(10).fill(now);search('Limited');await tick(450);assert.equal(calls.length,3);assert.match(nodes['food-online-status'].textContent,/automatisch/);
 let retry=[...timers].find(([,t])=>t.ms>450);assert(retry);search('Latest');await tick(450);retry=[...timers].find(([,t])=>t.ms>450);now+=retry[1].ms;timers.delete(retry[0]);const resumed=retry[1].fn();await Promise.resolve();assert.equal(calls.length,4);assert.match(calls[3].url,/search_terms=Latest/);await reply(3,[]);await resumed;
 c.state.language='en';search('Timeout');let timeoutDebounce=[...timers].find(([,t])=>t.ms===450);timers.delete(timeoutDebounce[0]);let timeoutPending=timeoutDebounce[1].fn();await Promise.resolve();await tick(20000);assert(calls[4].opts.signal.aborted);assert.equal(nodes['food-online-status'].textContent,'Search timed out. Please try again.');await reply(4,[]);await timeoutPending;
 c.ffOnlineHint('Gerade nicht verfügbar');assert.equal(nodes['food-online-status'].textContent,'Currently unavailable');
 // A catalogue-load refresh must preserve the selected empty-query collection.
 nodes.search.value='';nodes.results.dataset.collection='favorites';nodes.results.innerHTML='Favorite fixture';c.document.activeElement=null;c.searchFoods('');assert.equal(nodes.results.innerHTML,'Favorite fixture');
 delete nodes.results.dataset.collection;
 c.localCatalogue.push({});c.queryCatalogueAsync=async()=>({indices:[]});nodes.search.value='different';c.showSearch();assert.doesNotMatch(nodes.foodbody.innerHTML,/food-online-button|nutritionInputForm/);assert(nodes.foodbody.innerHTML.indexOf('id="results"')<nodes.foodbody.innerHTML.indexOf('id="ff-online"'));
 console.log('PASS: immediate local search, 450ms debounce, abort/stale reply, OFF merge/deduplication, unknown nutrients, offline, close, errors and request cap (mock fetch).');
}
function navyCases(){
 const c={state:{measurements:[],profile:{sex:'male',height:180}},englishUI:{},measurementFields:{},profileForm(){},updatePlanPreview(){},dataSettings(){},measurementsForm(){},weeklyWeightCard(){return '<span>Körperfett ≈ <strong>20 %</strong></span><p>Körperfett grob aus BMI und Alter geschätzt, keine Messung.</p>'},today:()=> '2026-10-26',n:String,round:x=>Math.round(x*10)/10,esc:String,fmtDate:String};
 c.translatedUI=text=>c.englishUI[text]||text;
 vm.createContext(c);vm.runInContext(fs.readFileSync('js/profile-refresh.js','utf8'),c);
 const m={sex:'male',height:69*2.54},f={sex:'female',height:64*2.54};
 // Full-precision log10 results; published worked examples round intermediate logs.
 assert(Math.abs(c.navyBodyFat(m,{neck:16*2.54,waist:49*2.54})-38.57255480456903)<1e-9);
 assert.equal(c.navyBodyFat(f,{neck:15*2.54,waist:42*2.54,hip:44*2.54}),null,'legacy female field remains data only');
 assert.equal(c.navyBodyFat(m,{neck:40,waist:90}),c.navyBodyFat(m,{neck:40,waist:90,hip:NaN}),'hip is irrelevant to the male estimate');
 for(const [p,row] of [[null,{}],[m,{}],[f,{neck:38,waist:80}],[{...m,sex:'unknown'},{neck:38,waist:80}],
  [m,{neck:40,waist:40}],[m,{neck:60,waist:30}],[m,{neck:NaN,waist:80}],[m,{neck:'40',waist:80}],[m,{neck:15,waist:250}],[{...m,height:0},{neck:40,waist:80}]])assert.equal(c.navyBodyFat(p,row),null);
 const rows=[{date:'2026-10-25',neck:40,waist:90},{date:'2026-10-27',bodyfat:25}];
 let before=JSON.stringify(rows),value=c.currentBodyFat(m,rows);assert(value.estimated);assert.equal(value.date,'2026-10-25');assert.equal(JSON.stringify(rows),before);
 rows.push({date:'2026-10-20',bodyfat:18});assert.equal(c.currentBodyFat(m,rows).estimated,true,'newer Navy wins over old manual KFA');
 rows.push({date:'2026-10-26',bodyfat:19});assert.equal(c.currentBodyFat(m,rows).value,19);assert.equal(c.currentBodyFat(m,rows).estimated,false,'newer manual wins');
 assert.equal(c.currentBodyFat(m,[{date:'2026-10-25',neck:40,waist:90},{date:'2026-10-25',bodyfat:18}]).value,18,'manual wins on the same day even in a separate record');
 assert.equal(c.currentBodyFat(m,[{date:'2026-10-24',neck:40},{date:'2026-10-25',waist:90}]),null);
 c.state.measurements=[{date:'2026-10-25',neck:40,waist:90}];assert.match(c.weeklyWeightCard(),/geschätzt/);assert.doesNotMatch(c.weeklyWeightCard(),/BMI und Alter/);
 assert.deepEqual(Array.from(c.measurementFields.neck),['Hals','cm',15,80]);
 c.state.language='en';assert.match(c.bodyFatMarkup({value:20,estimated:true,date:'2026-10-25'}),/Estimated body fat \(US Navy\)/);assert.match(c.weeklyWeightCard(),/US Navy estimate/);assert.equal(c.englishUI.Hals,'Neck');
 const languageSource=fs.readFileSync('js/i18n.js','utf8');vm.runInContext(languageSource.slice(languageSource.indexOf('function translatedUI('),languageSource.indexOf('function protectedUIText(')),c);
 assert.equal(c.translatedUI('Hals · cm'),'Neck · cm');assert.equal(c.translatedUI('Hals 40 cm'),'Neck 40 cm');
 // CSV preserves existing column order and keeps missing neck values empty.
 vm.runInContext(fs.readFileSync('js/tracker-tools.js','utf8').split('\n').slice(0,7).join('\n'),c);
 let csv;c.downloadText=(name,text)=>{csv=text};c.state.measurements=[{date:'2026-10-25',neck:40},{date:'2026-10-26',waist:90}];c.csvExport('measurements');
 const csvLines=csv.split('\r\n');assert(csvLines[0].endsWith('"resting_heart_rate","neck_cm"'));assert(csvLines[1].endsWith(',"40"'));assert(csvLines[2].endsWith(',""'));
 // Online saves remain silent; offline status stays accessible and out of flow.
 const designSource=fs.readFileSync('js/design-system.js','utf8');
 vm.runInContext(designSource.slice(designSource.indexOf('function dsConnectivityText('),designSource.indexOf('function dsRenderConnectivity(')),c);
 c.window={};c.dsText=(de,en)=>c.state.language==='en'?en:de;c.cloudSession={user:{id:'fixture'}};
 assert.equal(c.dsConnectivityText({online:true,pendingSync:true}),'');assert.equal(c.dsConnectivityText({online:false}).text,'Offline, will sync later');
 // Account markup reuses the existing handlers and escapes the signed-in email.
 c.cloudConfigured=true;c.firstRunPreview=false;c.cloudMessage='Synchronisiert · 12:00';c.localStorage={getItem:()=>null};c.uiIcon=()=>'';c.esc=s=>String(s).replaceAll('<','&lt;');
 const accountSource=fs.readFileSync('js/account-refresh.js','utf8');
 vm.runInContext(accountSource.slice(accountSource.indexOf('function accountManageBody('),accountSource.indexOf('function accountSectionNode(')),c);
 vm.runInContext(accountSource.split('\n').find(line=>line.startsWith('function accountListRow(')),c);
 c.cloudSession.user.email='<fixture@example.com>';let account=c.accountManageBody({querySelector:()=>null});
 assert(account.includes('&lt;fixture@example.com>'));assert(!account.includes('<fixture@example.com>'));assert(account.includes('id="cloud-status"'));assert(account.includes('signOutCloud()'));assert(account.includes('importData(this.files[0])'));assert(account.includes("accountActionForm('delete')"));assert(account.indexOf("accountActionForm('delete')")>account.indexOf("accountActionForm('reset')"));
 c.cloudSession=null;account=c.accountManageBody({querySelector:()=>null});assert(account.includes("cloudAuthForm('signin')"));assert(!account.includes('signOutCloud()'));
 console.log('PASS: Navy male inch-reference example, legacy female rejection, missing/invalid/extreme inputs, no cross-day mixing or future values, manual priority, no persistence, current display.');
 console.log('PASS: neck CSV with missing values, silent online sync, offline text, account sign-in/out/import/delete handlers and email escaping (VM, no layout).');
}
searchCases().then(navyCases).catch(e=>{console.error(e);process.exitCode=1});
