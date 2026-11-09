/* PULS v87 · Lebensmittel hinzufügen als Vollseite: Kopf mit Suche, Filter und Scan, wischbare Reiter,
   Filterblatt (Sortierung, Datenbanken), Detailseite mit Portionsgröße, Energie-Ring und Zielen,
   Vollbild-Scanner (Web) und eigene Kombis (Vorlagen aus mehreren Lebensmitteln, keine Kategorie).
   Umschließt food-flow.js. Alle bestehenden IDs (#search, #results, #ff-online, #food-quantity,
   #food-quantity-unit, #grams, #barcode-input, #ff-torch, #barcode-camera …) und Speicherwege bleiben.
   Die Seite ist weiterhin der #modal-Dialog (damit nativer Scanner, Foto-KI und Abbruchlogik unverändert greifen). */

let fpPane='all',fpLists={},fpPick=null,fpMealDraft=null,fpPaneFrame=0,fpRefreshTimer=null;
const fpPanes=[['all','Alle','All'],['frequent','Häufig','Frequent'],['recent','Zuletzt','Recent'],['favorites','Favoriten','Favourites'],['own','Eigene','Custom'],['recipes','Rezepte','Recipes'],['meals','Kombis','Combos'],['products','Produkte','Products'],['drinks','Getränke','Drinks']];
const fpSourceNames=[['bls','BLS 4.0'],['usda','USDA'],['ciqual','Ciqual'],['off','Open Food Facts'],['own',['Eigene','Custom']],['puls',['PULS-Richtwerte','PULS reference values']]];
const fpSorts=[['best',['Beste Treffer','Best match']],['az',['A bis Z','A to Z']],['za',['Z bis A','Z to A']],['recent',['Zuletzt','Most recent']],['frequent',['Häufigste','Most frequent']]];
function fpActive(){return typeof modal!=='undefined'&&modal.classList.contains('fpage')&&modal.open}
function fpL(x){return Array.isArray(x)?fdT(x[0],x[1]):x}
function fpSearchPrefs(){let s=fdField('foodSearch'),all=fdDefaults.foodSearch.sources;return {sort:fpSorts.some(([k])=>k===s.sort)?s.sort:'best',sources:Array.isArray(s.sources)?s.sources.filter(k=>all.includes(k)):[...all]}}
function fpFilterActive(){let p=fpSearchPrefs();return p.sort!=='best'||p.sources.length<fdDefaults.foodSearch.sources.length}

/* ---------- Seite öffnen und schließen ---------- */
const fpOpenModalBase=openModal;openModal=function(title,...rest){modal.classList.toggle('fpage',title==='Essen hinzufügen');return fpOpenModalBase.call(this,title,...rest)};
modal.addEventListener('close',()=>{modal.classList.remove('fpage');fpPick=null;$('fp-sheet')?.remove()});
// In der Vollseite gibt es kein Herunterziehen zum Schließen (würde das Scrollen in den Listen stören).
modal.addEventListener('pointerdown',()=>{if(fpActive()&&typeof dragSheet!=='undefined')dragSheet=null});
function fpClose(){fdSound('sheetClose');if(typeof dismissSheet==='function')dismissSheet();else modal.close()}
const fpFoodFormBase=foodForm;foodForm=function(...args){if(!fpPick)fpPane='all';return fpFoodFormBase.apply(this,args)};

/* Kleine Kopfleiste für Ansichten ohne eigene Navigation (Eigene Werte, Foto, Rezepte). */
function fpBar(title,back="foodTab('search')",extra=''){return `<div class="fpbar"><button type="button" class="fdicon" aria-label="${fdT('Zurück','Back')}" onclick="${back}">${phIcon('caret-left')}</button><h3>${esc(title)}</h3>${extra||`<button type="button" class="fdicon" aria-label="${fdT('Schließen','Close')}" onclick="fpClose()">${phIcon('x')}</button>`}</div>`}
const fpFoodTabBase=foodTab;foodTab=function(tab,...args){
  let result=fpFoodTabBase.call(this,tab,...args);
  if(fpActive()){let body=$('foodbody'),titles={custom:['Eigene Werte','Custom values'],photo:['Foto','Photo'],recipes:['Rezepte','Recipes']};
    if(body&&titles[tab]&&!body.querySelector(':scope > .fpbar'))body.insertAdjacentHTML('afterbegin',fpBar(fpL(titles[tab])));
    if(body)body.scrollTop=0}
  return result;
};

/* ---------- Suche: Kopf, Reiter, wischbare Bereiche ---------- */
const fpShowSearchBase=showSearch;showSearch=function(...args){let result=fpShowSearchBase.apply(this,args);if(fpActive())fpBuildSearch();return result};
function fpBuildSearch(){
  let body=$('foodbody'),wrap=body?.querySelector('.ffsearch');if(!wrap)return;
  if(wrap.classList.contains('fpsearch')){fpRefreshPanes();return}
  let bar=wrap.querySelector('.ffsearchbar');if(!bar)return;
  let keep=['ff-shortcuts','catalogue-status','results','ff-online'].map(id=>$(id)).filter(Boolean),privacy=wrap.querySelector('.ffprivacy');
  let head=document.createElement('div');head.className='fphead';
  head.innerHTML=`<button type="button" class="fdicon" aria-label="${fdT('Schließen','Close')}" onclick="fpClose()">${phIcon('x')}</button>`;
  head.append(bar);let input=bar.querySelector('#search');if(input)input.placeholder=fdT('Lebensmittel suchen','Search foods');
  head.insertAdjacentHTML('beforeend',`<button type="button" class="fdicon fpfilterbtn" id="fp-filter" aria-label="${fdT('Filter und Sortierung','Filter and sort')}" onclick="fpFilterSheet()">${phIcon('funnel-simple')}<i class="fpdot" ${fpFilterActive()?'':'hidden'}></i></button><button type="button" class="fdicon" aria-label="${fdT('Barcode scannen','Scan barcode')}" onclick="foodTab('barcode')">${phIcon('barcode')}</button>`);
  let tabs=document.createElement('div');tabs.className='fptabs';tabs.setAttribute('role','tablist');tabs.id='fp-tabs';
  tabs.innerHTML=fpPanes.map(([key,de,en])=>`<button type="button" role="tab" class="fptab" data-pane="${key}" aria-selected="${key===fpPane}" aria-controls="fp-pane-${key}" onclick="fpGoPane('${key}')">${fdT(de,en)}</button>`).join('')+'<i class="fpindicator" aria-hidden="true"></i>';
  let track=document.createElement('div');track.className='fptrack';track.id='fp-track';
  track.innerHTML=fpPanes.map(([key,de,en])=>`<section class="fppane" id="fp-pane-${key}" data-pane="${key}" role="tabpanel" aria-label="${fdT(de,en)}">${key==='all'?'':`<div class="fplist" id="fp-list-${key}"></div>`}</section>`).join('');
  let all=track.querySelector('[data-pane=all]');
  all.insertAdjacentHTML('afterbegin',`<div class="fpquick" id="fp-quick"><button type="button" onclick="foodTab('barcode')">${phIcon('barcode')}<span>${fdT('Barcode','Barcode')}</span></button><button type="button" onclick="foodTab('photo')">${phIcon('camera')}<span>${fdT('Foto','Photo')}</span></button><button type="button" onclick="foodTab('custom')">${phIcon('pencil-simple')}<span>${fdT('Eigene Werte','Custom values')}</span></button></div>`);
  all.append(...keep);if(privacy)all.append(privacy);
  wrap.innerHTML='';wrap.classList.add('fpsearch');
  if(fpPick)wrap.insertAdjacentHTML('afterbegin',`<div class="fppickbanner"><span>${fdT('Lebensmittel für die Kombi wählen','Choose a food for the combo')}</span><button type="button" class="textbtn" onclick="fpPickCancel()">${fdT('Abbrechen','Cancel')}</button></div>`);
  wrap.append(head,tabs,track);
  track.addEventListener('scroll',()=>{cancelAnimationFrame(fpPaneFrame);fpPaneFrame=requestAnimationFrame(fpPaneChanged)},{passive:true});
  $('search')?.addEventListener('input',()=>{clearTimeout(fpRefreshTimer);fpRefreshTimer=setTimeout(fpRefreshPanes,120)});
  fpRefreshPanes();
  let index=fpPanes.findIndex(([k])=>k===fpPane);
  requestAnimationFrame(()=>{track.scrollTo({left:index*track.clientWidth,behavior:'auto'});fpMarkTab(false)});
}
function fpGoPane(key){let track=$('fp-track'),index=fpPanes.findIndex(([k])=>k===key);if(!track||index<0)return;fpPane=key;fpMarkTab(true);track.scrollTo({left:index*track.clientWidth,behavior:fdReduced()?'auto':'smooth'});fdSound('tap')}
function fpPaneChanged(){let track=$('fp-track');if(!track)return;let index=Math.max(0,Math.min(fpPanes.length-1,Math.round(track.scrollLeft/Math.max(1,track.clientWidth))));if(fpPanes[index][0]!==fpPane){fpPane=fpPanes[index][0];fpMarkTab(true)}}
function fpMarkTab(scroll){
  let tabs=$('fp-tabs');if(!tabs)return;let active=null;
  tabs.querySelectorAll('.fptab').forEach(b=>{let on=b.dataset.pane===fpPane;b.setAttribute('aria-selected',String(on));if(on)active=b});
  let line=tabs.querySelector('.fpindicator');if(active&&line){line.style.width=active.offsetWidth+'px';line.style.transform=`translateX(${active.offsetLeft}px)`}
  if(active&&scroll){let left=active.offsetLeft-(tabs.clientWidth-active.offsetWidth)/2;tabs.scrollTo({left:Math.max(0,left),behavior:fdReduced()?'auto':'smooth'})}
}

/* ---------- Datenmengen je Reiter ---------- */
function fpQuery(){return String($('search')?.value||'').trim()}
function fpMatch(x,q){if(!q)return true;let alternatives=typeof catalogueAlternatives==='function'?catalogueAlternatives(q):[[normalizeSearch(q)]],text=normalizeSearch((x.name||'')+' '+(x.alias||'')+' '+(x.brand||''));return alternatives.every(terms=>terms.some(t=>text.includes(t)))}
function fpProducts(){return [...(state.custom||[]),...(typeof foods!=='undefined'&&Array.isArray(foods)?foods:[])]}
// Zählung und letzte Nutzung je Produkt aus dem Tagebuch (abgeleitet, nichts wird gespeichert).
function fpUsage(days=90){
  let byId=new Map(),byCode=new Map(),byName=new Map();
  for(let p of fpProducts()){if(!p?.id)continue;byId.set(p.id,p);if(p.barcode&&!byCode.has(String(p.barcode)))byCode.set(String(p.barcode),p);if(!byName.has(p.name))byName.set(p.name,p)}
  let since=new Date(today()+'T12:00:00');since.setDate(since.getDate()-days);since=localISO(since);
  let usage=new Map();
  (state.foods||[]).forEach((e,index)=>{if(fdIsWater(e)||e.aiEstimate)return;let p=byId.get(e.foodRef)||(e.barcode&&byCode.get(String(e.barcode)))||byName.get(e.name);if(!p)return;let u=usage.get(p.id)||{food:p,count:0,last:0};if(e.date>=since)u.count++;u.last=Math.max(u.last,Number(e.loggedAt)||Date.parse(e.date+'T12:00:00')||0,index);usage.set(p.id,u)});
  return usage;
}
function fpSourceKeys(x){
  let keys=new Set();if(x.kind==='recipe'||x.kind==='meal'||x.recipeId)keys.add('own');
  for(let s of (x.combinedSources||[x.source]).map(v=>String(v||''))){if(/^BLS/i.test(s))keys.add('bls');else if(/^USDA/i.test(s))keys.add('usda');else if(/^Ciqual/i.test(s))keys.add('ciqual');else if(/Open Food Facts/i.test(s))keys.add('off');else if(/Richtwert|PULS Basis/i.test(s))keys.add('puls')}
  if(x.barcode)keys.add('off');if(!keys.size)keys.add(String(x.id||'').startsWith('base')?'puls':'own');
  return keys;
}
function fpFilterSources(items){let allowed=new Set(fpSearchPrefs().sources);return items.filter(x=>[...fpSourceKeys(x)].some(k=>allowed.has(k)))}
function fpFilterSort(items,usage){
  let prefs=fpSearchPrefs(),list=fpFilterSources(items);
  if(prefs.sort==='best')return list;
  usage??=fpUsage(3650);let u=x=>usage.get(x.id)||{count:0,last:0},name=x=>String(x.name||'');
  let cmp={az:(a,b)=>name(a).localeCompare(name(b),'de'),za:(a,b)=>name(b).localeCompare(name(a),'de'),recent:(a,b)=>u(b).last-u(a).last,frequent:(a,b)=>u(b).count-u(a).count}[prefs.sort];
  return list.map((x,i)=>[x,i]).sort((a,b)=>cmp(a[0],b[0])||a[1]-b[1]).map(([x])=>x);
}
function fpPaneItems(key,q,usage){
  let products=fpProducts(),uniq=list=>typeof uniqueFoods==='function'?uniqueFoods(list):list;
  if(key==='frequent')return [...usage.values()].filter(u=>u.count>0&&fpMatch(u.food,q)).sort((a,b)=>b.count-a.count||b.last-a.last).slice(0,60).map(u=>({...u.food,fpCount:u.count}));
  if(key==='recent')return [...usage.values()].filter(u=>fpMatch(u.food,q)).sort((a,b)=>b.last-a.last).slice(0,40).map(u=>u.food);
  if(key==='favorites')return (state.custom||[]).filter(x=>x.favorite&&fpMatch(x,q));
  if(key==='own')return (state.custom||[]).filter(x=>!x.barcode&&!x.catalogKey&&x.source!=='Open Food Facts'&&fpMatch(x,q));
  if(key==='products')return (state.custom||[]).filter(x=>(x.barcode||x.source==='Open Food Facts')&&fpMatch(x,q));
  if(key==='drinks')return uniq(products.filter(x=>x.unit==='ml'&&fpMatch(x,q)));
  if(key==='recipes')return (state.recipes||[]).filter(r=>fpMatch(r,q)).map(r=>({...(typeof recipeNutrients==='function'&&r.yield>0?recipeNutrients(r):{}),id:r.id,recipeId:r.id,name:r.name,unit:'g',kind:'recipe',fpRecipe:r}));
  if(key==='meals')return fdField('meals').filter(m=>fpMatch(m,q)).map(m=>({id:m.id,name:m.name,kind:'meal',fpMeal:m}));
  return [];
}
function fpRefreshPanes(){
  if(!$('fp-track'))return;let q=fpQuery(),usage=fpUsage();
  $('fp-quick')?.toggleAttribute('hidden',!!q);
  $('ff-online')?.classList.toggle('fpoffhidden',!fpSearchPrefs().sources.includes('off'));
  for(let [key] of fpPanes){if(key==='all')continue;let box=$('fp-list-'+key);if(!box)continue;let items=fpPaneItems(key,q,usage);if(key==='frequent')items=fpFilterSources(items);else if(key!=='meals')items=fpFilterSort(items,usage);fpLists[key]=items;box.innerHTML=fpPaneHTML(key,items,q)}
  let filter=document.querySelector('#fp-filter .fpdot');if(filter)filter.hidden=!fpFilterActive();
}
const fpEmpty={frequent:['Hier erscheint, was du in den letzten 90 Tagen oft einträgst.','Foods you log often in the last 90 days appear here.'],recent:['Noch nichts eingetragen.','Nothing logged yet.'],favorites:['Noch keine Favoriten. Im Lebensmittel auf den Stern tippen.','No favourites yet. Tap the star on a food.'],own:['Noch keine eigenen Lebensmittel.','No custom foods yet.'],products:['Noch keine gescannten Produkte.','No scanned products yet.'],drinks:['Keine Getränke mit Angabe je 100 ml.','No drinks with values per 100 ml.'],recipes:['Noch keine Rezepte.','No recipes yet.'],meals:['Kombis sind Vorlagen aus mehreren Lebensmitteln, die du mit einem Tippen einträgst.','Combos are templates of several foods you log with one tap.']};
function fpPaneHTML(key,items,q){
  let rows=items.map((x,i)=>x.kind==='meal'?fpMealRow(x.fpMeal,i):fpRow(x,`fpOpen('${key}',${i})`,`fpQuick('${key}',${i})`)).join('');
  let actions='';
  if(key==='recipes')actions=`<div class="fpactions"><button type="button" class="btn" onclick="recipeEditor()">${phIcon('plus')} ${fdT('Neues Rezept','New recipe')}</button><button type="button" class="btn secondary" onclick="recipeImportForm()">${fdT('Importieren','Import')}</button></div>`;
  if(key==='meals')actions=`<div class="fpactions"><button type="button" class="btn" onclick="fpMealEdit(null)">${phIcon('plus')} ${fdT('Neue Kombi','New combo')}</button><button type="button" class="btn secondary" onclick="fpMealEdit(null,true)">${fdT('Aus heutigen Einträgen','From today’s entries')}</button></div>`;
  if(key==='own')actions=`<div class="fpactions fpsingle"><button type="button" class="btn secondary" onclick="foodTab('custom')">${phIcon('plus')} ${fdT('Eigenes Lebensmittel','Custom food')}</button></div>`;
  return actions+(rows?`<div class="fprows">${rows}</div>`:`<p class="fpempty">${q?fdT('Keine Treffer in diesem Bereich.','No matches here.'):fdT(...fpEmpty[key])}</p>`);
}
// Dieselbe Standardmenge wie die Detailseite (zuletzt eingetragen, sonst 100 g/ml); das Plus bucht genau diese.
function fpDefaultAmount(x){let last=typeof ffLastAmount==='function'?ffLastAmount(x):null;return last>0?last:100}
function fpAmountLine(x){
  let base=typeof ffBase==='function'?ffBase(x):(x.unit==='ml'?'ml':'g'),amount=fpDefaultAmount(x);
  let kcal=Number.isFinite(x.kcal)?fdNum(x.kcal*amount/100)+' kcal':fdT('kcal unbekannt','kcal unknown');
  let label=amount!==100?`${fdT('Zuletzt','Last')} · ${n(amount)} ${base}`:`100 ${base}`;
  return (x.fpCount?x.fpCount+'× · ':'')+label+' · '+kcal;
}
function fpRow(x,open,add){
  let source=x.kind==='recipe'?fdT('Rezept','Recipe'):typeof ffSourceShort==='function'?ffSourceShort(x):'';
  let meta=x.kind==='recipe'?`${n(x.fpRecipe.ingredients.length)} ${fdT('Zutaten','ingredients')} · ${Number.isFinite(x.kcal)?fdNum(x.kcal)+' kcal / 100 g':''}`:fpAmountLine(x);
  return `<div class="fprow ffrow"><button type="button" class="fprowmain" onclick="${open}"><span class="fprowtext"><strong data-no-translate>${x.favorite?'<span class="fpstar" aria-label="Favorit">★</span> ':''}${esc(x.name)}</strong><small>${esc(meta)}</small></span><span class="fprowsrc" data-no-translate>${esc(source)}</span></button><button type="button" class="fprowadd" aria-label="${esc(x.name)} ${fpPick?fdT('zur Kombi hinzufügen','add to combo'):fdT('sofort eintragen','log now')}" onclick="${add}">${phIcon('plus')}</button></div>`;
}
// „Alle“: bestehende Suche (lokal, Katalog, Open Food Facts) mit Filter, Sortierung und eigener Zeile.
const fpResultBase=foodResultHTML;foodResultHTML=function(items){
  if(!fpActive())return fpResultBase(items);
  items=fpFilterSort(items||[]);foodResultList=items;
  return items.map((x,i)=>fpRow(x,`chooseFoodResult(${i})`,`fpQuickResult(${i})`)).join('');
};
if(typeof ffAutoOnline==='function'){const fpAutoBase=ffAutoOnline;ffAutoOnline=function(...args){if(fpActive()&&!fpSearchPrefs().sources.includes('off'))return;return fpAutoBase.apply(this,args)}}

/* ---------- Öffnen und sofort eintragen ---------- */
function fpOpenItem(x){
  if(!x)return false;ffNav.from='search';
  if(x.kind==='recipe'){chooseRecipe(x.recipeId);ffNav.from='search';return true}
  if(String(x.id||'').startsWith('catalog_'))chooseCatalogueFood(x.id);else selectFood(x.id);
  return !!$('ff-detail');
}
function fpOpen(key,i){let x=fpLists[key]?.[i];if(x)fpOpenItem(x)}
function fpQuick(key,i){let x=fpLists[key]?.[i];if(x)fpQuickAdd(()=>fpOpenItem(x),x)}
function fpQuickResult(i){let x=foodResultList[i];if(x)fpQuickAdd(()=>{ffNav.from='search';chooseFoodResult(i)},x)}
// Öffnet das Lebensmittel und trägt genau die in der Zeile angezeigte Menge über den normalen addFood-Weg ein.
function fpQuickAdd(open,item){
  let before=state.foods.length,mealBefore=fpMealDraft?.items.length??0,picking=!!fpPick;open();
  let form=$('ff-detail')?.querySelector('form.ffform');
  if(!form)return;
  if(item&&foodSelection&&item.kind!=='recipe'&&typeof ffSetQuantity==='function'){let amount=fpDefaultAmount(item);if(Math.abs(Number($('grams')?.value)-amount)>1e-9)ffSetQuantity(ffBase(foodSelection),amount)}
  if(!(Number($('grams')?.value)>0))return;
  let name=foodSelection?.name||'';
  modal.close=function(){};
  try{form.requestSubmit?form.requestSubmit():form.dispatchEvent(new Event('submit',{cancelable:true,bubbles:true}))}finally{delete modal.close}
  if(picking){if((fpMealDraft?.items.length??0)>mealBefore)fdSound('tap');return}
  if(state.foods.length>before){
    let ids=state.foods.slice(before).map(x=>x.id);
    foodTab('search');fdSound('save');
    fdUndoToast(`${name} ${fdT('eingetragen','logged')}`,()=>{state.foods=state.foods.filter(x=>!ids.includes(x.id));save();render();if(fpActive())fpRefreshPanes()});
  }
}

/* ---------- Filterblatt ---------- */
function fpFilterSheet(){
  $('fp-sheet')?.remove();let prefs=fpSearchPrefs();
  let sheet=document.createElement('div');sheet.id='fp-sheet';sheet.className='fpsheetwrap';
  sheet.innerHTML=`<button type="button" class="fpscrim" aria-label="${fdT('Schließen','Close')}" onclick="fpSheetClose()"></button><div class="fpsheet" role="dialog" aria-modal="true" aria-label="${fdT('Filter','Filter')}"><div class="fpsheethead"><h3>${fdT('Suchoptionen','Search options')}</h3><button type="button" class="textbtn" onclick="fpSheetClose()">${fdT('Fertig','Done')}</button></div><h4>${fdT('Sortierung','Sort')}</h4><div class="dsgroup fpoptions">${fpSorts.map(([k,l])=>`<button type="button" class="fpoption" role="radio" aria-checked="${prefs.sort===k}" onclick="fpSetSort('${k}')"><span>${fpL(l)}</span>${phIcon('check')}</button>`).join('')}</div><h4>${fdT('Datenbanken','Databases')}</h4><div class="dsgroup fpoptions">${fpSourceNames.map(([k,l])=>`<button type="button" class="fpoption" role="checkbox" aria-checked="${prefs.sources.includes(k)}" onclick="fpToggleSource('${k}')"><span>${fpL(l)}</span>${phIcon('check')}</button>`).join('')}</div><button type="button" class="textbtn fpreset" onclick="fpResetFilter()">${fdT('Zurücksetzen','Reset')}</button><p class="fdnote">${fdT('Weitere freie Datenbanken folgen nach Lizenzprüfung. Online-Suche nur mit Open Food Facts.','More open databases follow after licence review. Online search uses Open Food Facts only.')}</p></div>`;
  $('mb').append(sheet);fdSound('sheetOpen');sheet.querySelector('.fpoption')?.focus({preventScroll:true});
}
function fpSheetClose(){let sheet=$('fp-sheet');if(!sheet)return;fdSound('sheetClose');if(fdReduced()){sheet.remove();return}sheet.classList.add('fpclosing');setTimeout(()=>sheet.remove(),180)}
function fpStoreSearch(sort,sources){let s=fdEnsure('foodSearch');s.sort=sort;s.sources=sources;save();fpApplyFilter()}
function fpSetSort(key){let p=fpSearchPrefs();fpStoreSearch(key,p.sources);document.querySelectorAll('#fp-sheet [role=radio]').forEach((b,i)=>b.setAttribute('aria-checked',String(fpSorts[i][0]===key)));fdSound('toggle')}
function fpToggleSource(key){let p=fpSearchPrefs(),list=p.sources.includes(key)?p.sources.filter(k=>k!==key):[...p.sources,key];if(!list.length){toast(fdT('Mindestens eine Datenbank wählen','Choose at least one database'));return}list=fdDefaults.foodSearch.sources.filter(k=>list.includes(k));fpStoreSearch(p.sort,list);document.querySelectorAll('#fp-sheet [role=checkbox]').forEach((b,i)=>b.setAttribute('aria-checked',String(list.includes(fpSourceNames[i][0]))));fdSound('toggle')}
function fpResetFilter(){fpStoreSearch('best',[...fdDefaults.foodSearch.sources]);fpFilterSheet()}
function fpApplyFilter(){
  let results=$('results'),q=fpQuery();
  if(results){if(results.dataset.collection&&!q)showFoodCollection(results.dataset.collection);else searchFoods($('search')?.value||'')}
  fpRefreshPanes();
}

/* ---------- Detailseite ---------- */
const fpDetailBase=ffRenderDetail;ffRenderDetail=function(...args){let result=fpDetailBase.apply(this,args);if(fpActive())fpDecorateDetail();return result};
function fpDecorateDetail(){
  let detail=$('ff-detail'),food=foodSelection,form=detail?.querySelector('form.ffform');if(!detail||!food||!form)return;
  let base=ffBase(food),head=detail.querySelector('.ffdetailhead');
  if(head&&$('ff-more'))head.insertAdjacentHTML('beforeend',`<button type="button" class="fficonbtn fpmorebtn" aria-label="${fdT('Weitere Optionen','More options')}" onclick="fpDetailMore()">${phIcon('dots-three')}</button>`);
  // Menge und Portionsgröße als zwei Zeilen; Einheit automatisch (Basiseinheit), andere nur mit Dichte.
  let amount=form.querySelector('.ffamount'),select=$('food-quantity-unit'),rows=null;
  if(amount&&select){
    rows=document.createElement('div');rows.className='dsgroup fpfields';
    rows.innerHTML=`<div class="fpfield"><span>${fdT('Menge','Amount')}</span><div class="fpamountslot"></div></div><label class="fpfield"><span>${fdT('Portionsgröße','Serving size')}</span><div class="fpunitslot"></div></label>`;
    let anchor=$('ff-portion-chips')||amount;anchor.before(rows);rows.querySelector('.fpamountslot').append(amount);rows.querySelector('.fpunitslot').append(select);
    fpUnitOptions(food,select);
  }
  let chips=$('ff-portion-chips');if(chips&&chips.children.length){chips.insertAdjacentHTML('beforebegin',`<p class="fplabel">${fdT('Vorschläge','Suggestions')}</p>`)}
  if(!food.recipeId&&!(Number(food.density)>0)&&$('ff-more'))rows?.insertAdjacentHTML('afterend',`<p class="fpunitnote">${fdT('Für','For')} ${base==='g'?'ml':'g'} <button type="button" class="textbtn" onclick="fpDensity()">${fdT('Dichte angeben','add density')}</button></p>`);
  let known=['kcal','p','c','f'].filter(k=>Number.isFinite(food[k])).length+Object.values(food.nutrients||{}).filter(Number.isFinite).length;
  let submit=form.querySelector('.ffsubmit');
  let info=document.createElement('div');info.className='fpinfo';
  info.innerHTML=`<p class="fpsource" data-no-translate>${esc([food.recipeId?fdT('Eigenes Rezept','Own recipe'):ffSourceShort(food),known+' '+fdT('Nährwerte bekannt','nutrient values known'),fdT('Werte je 100 ','Values per 100 ')+base].join(' · '))}</p><section class="fpsection" id="fp-energy" aria-live="polite"></section><section class="fpsection" id="fp-targets"></section><section class="fpsection" id="fp-highlights"></section>`;
  form.insertBefore(info,submit);
  if(submit&&fpPick)submit.textContent=fdT('Zur Kombi hinzufügen','Add to combo');
  fpDetailUpdate();
}
function fpUnitOptions(food,select){
  let base=ffBase(food),units=ffUnits(food),value=select.value,option=u=>`<option value="${esc(u.key)}">${esc(u.label)}${/^p\d+$/.test(u.key)?' · '+n(u.factor)+' '+base:''}</option>`;
  let portions=units.filter(u=>u.portion),main=units.find(u=>u.key===base),more=units.filter(u=>!u.portion&&u.key!==base);
  select.innerHTML=(portions.length?`<optgroup label="${fdT('Portionen','Servings')}">${portions.map(option).join('')}</optgroup>`:'')+(main?`<option value="${base}">${base==='ml'?fdT('Milliliter (ml)','Millilitres (ml)'):fdT('Gramm (g)','Grams (g)')}</option>`:'')+(more.length?`<optgroup label="${fdT('Weitere Einheiten','More units')}">${more.map(option).join('')}</optgroup>`:'');
  select.value=units.some(u=>u.key===value)?value:base;
}
function fpDetailMore(){let more=$('ff-more');if(!more)return;more.open=true;more.scrollIntoView({block:'start',behavior:fdReduced()?'auto':'smooth'});fdSound('tap')}
function fpDensity(){fpDetailMore();setTimeout(()=>$('food-density')?.focus({preventScroll:true}),fdReduced()?0:250)}
const fpPreviewBase=previewFood;previewFood=function(...args){let result=fpPreviewBase.apply(this,args);if($('fp-energy'))fpDetailUpdate();return result};
function fpArc(value,offset,cls){return value>0?`<circle class="fparc ${cls}" cx="50" cy="50" r="42" pathLength="100" stroke-dasharray="${Math.max(0,value-.6)} ${100-Math.max(0,value-.6)}" stroke-dashoffset="${-offset}" transform="rotate(-90 50 50)"/>`:''}
function fpDetailUpdate(){
  let food=foodSelection,energy=$('fp-energy');if(!food||!energy)return;
  let raw=$('grams')?.value,amount=Number(raw),valid=raw!==''&&Number.isFinite(amount)&&amount>0,f=valid?amount/100:0,val=k=>Number.isFinite(food[k])?food[k]*f:null;
  let kcal=val('kcal'),p=val('p'),c=val('c'),fat=val('f'),macroKcal=p!==null&&c!==null&&fat!==null?p*4+c*4+fat*9:0;
  let ring='';
  if(macroKcal>0){let sp=p*4/macroKcal*100,sc=c*4/macroKcal*100,sf=fat*9/macroKcal*100;
    ring=`<div class="fpring"><svg viewBox="0 0 100 100" aria-hidden="true"><circle class="fparctrack" cx="50" cy="50" r="42"/>${fpArc(sp,0,'fpp')}${fpArc(sc,sp,'fpc')}${fpArc(sf,sp+sc,'fpf')}</svg><div class="fpringval"><strong>${kcal===null?'–':fdNum(kcal)}</strong><small>kcal</small></div></div><ul class="fplegend">${[['fpp','Protein',p,sp],['fpc',fdT('Kohlenhydrate','Carbohydrates'),c,sc],['fpf',fdT('Fett','Fat'),fat,sf]].map(([cls,l,g,s])=>`<li class="${cls}"><i aria-hidden="true"></i><span>${l}</span><strong>${Math.round(s)} % · ${fdNum(g,1)} g</strong></li>`).join('')}</ul>`}
  else ring=`<div class="fpkcalonly"><strong>${kcal===null?'–':fdNum(kcal)}</strong><small>kcal</small></div><p class="fdnote">${fdT('Ohne vollständige Makros kein Energie-Ring.','No energy ring without complete macros.')}</p>`;
  let first=!energy.dataset.drawn;energy.dataset.drawn='1';energy.innerHTML=`<h4>${fdT('Energie','Energy')}</h4><div class="fpenergy${first?' fpfirst':''}">${ring}</div>`;
  let t=totals(),g=(typeof dayGoals==='function'?dayGoals(date):state.goals)||{};
  let bar=(label,key,add,unit,cls)=>{let goal=Number(g[key])||0,now=Number(t[key])||0,sum=now+(add||0),over=goal>0&&sum>goal,a=goal>0?Math.min(100,now/goal*100):0,b=goal>0?Math.max(0,Math.min(100,sum/goal*100)-a):0,d=unit==='kcal'?0:1;
    return `<div class="fdbar ${cls}${over?' fdover':''}"><div class="fdbarline"><span>${label}</span><strong>${fdNum(sum,d)}${goal>0?' / '+fdNum(goal,d):''} ${unit}</strong></div><div class="fdmeter fpstack"><i style="--w:${a}%"></i><b style="--w:${b}%"></b></div></div>`};
  $('fp-targets').innerHTML=`<h4>${fdT('Makro-Ziele heute','Macro targets today')}</h4>${bar(fdT('Energie','Energy'),'kcal',kcal,'kcal','fdkcal')}${bar('Protein','p',p,'g','fdp')}${bar(fdT('Kohlenhydrate','Carbohydrates'),'c',c,'g','fdc')}${bar(fdT('Fett','Fat'),'f',fat,'g','fdf')}<p class="fdnote">${fdT('Heller Anteil: dieses Lebensmittel.','Lighter part: this food.')}</p>`;
  let keys=fdHighlighted();
  $('fp-highlights').innerHTML=keys.length?`<h4>${fdT('Hervorgehobene Nährstoffe','Highlighted nutrients')}</h4><div class="fdmicros">${keys.map(k=>{let [label,unit]=nutrientLabels[k],v=Number.isFinite(food.nutrients?.[k])?food.nutrients[k]*f:null,goal=fdMicroGoal(k),pct=v!==null&&goal>0?v/goal*100:0;return `<div class="fdmicro${v===null?' fdunknown':''}"><div class="fdbarline"><span>${label}</span><strong>${v===null?fdT('keine Angabe','no data'):goal>0?Math.round(pct)+' %':fdNum(v,1)+' '+unit}</strong></div><div class="fdmeter"><i style="--w:${Math.min(100,pct)}%"></i></div></div>`}).join('')}</div>`:'';
}

/* ---------- Produkt prüfen und eigene Werte: Einheit vorausgewählt, andere optional ---------- */
function fpUnitLine(kind){
  let input=kind==='off'?$('off-unit'):$('ff-custom-unit-value'),segment=kind==='off'?$('ff-off-unit'):$('ff-custom-unit');if(!input||!segment)return;
  let unit=input.value==='ml'?'ml':'g',other=unit==='g'?'ml':'g';
  segment.hidden=true;let line=segment.parentElement.querySelector('.fpunitline');
  if(!line){line=document.createElement('p');line.className='fpunitline';segment.after(line)}
  line.innerHTML=`<span>${fdT('je 100','per 100')} ${unit}</span><button type="button" class="textbtn" onclick="fpSwapUnit('${kind}')">${fdT('Werte je 100','Values per 100')} ${other}</button>`;
}
function fpSwapUnit(kind){let input=kind==='off'?$('off-unit'):$('ff-custom-unit-value');if(!input)return;let next=input.value==='ml'?'g':'ml';if(kind==='off')ffSetOffUnit(next);else ffSetCustomUnit(next);fpUnitLine(kind);fdSound('toggle')}
const fpReviewBase=productReview;productReview=function(product,...rest){
  let result=fpReviewBase.call(this,product,...rest);
  if($('off-unit')&&$('off-unit').value===''){let text=[product?.quantity,product?.packageUnit,product?.servingSize].filter(Boolean).join(' ');ffSetOffUnit(/\b(ml|cl|dl|l)\b/i.test(text)?'ml':'g')}
  fpUnitLine('off');return result;
};
const fpCustomBase=customFood;customFood=function(...args){let result=fpCustomBase.apply(this,args);fpUnitLine('custom');return result};

/* ---------- Scanner (Web-Ersatz; in der iOS-Hülle startet der native Scanner) ---------- */
const fpBarcodeBase=barcodePanel;barcodePanel=function(...args){let result=fpBarcodeBase.apply(this,args);if(fpActive())fpDecorateScanner();return result};
function fpDecorateScanner(){
  let box=$('foodbody')?.querySelector('.ffbarcode'),camera=$('barcode-camera');if(!box||box.classList.contains('fpscanner'))return;
  box.classList.add('fpscanner');
  box.insertAdjacentHTML('afterbegin',`<div class="fpscanhead"><button type="button" class="fdicon" aria-label="${fdT('Zurück','Back')}" onclick="foodTab('search')">${phIcon('x')}</button><h3>${fdT('Barcode scannen','Scan barcode')}</h3><span></span></div>`);
  if(camera){camera.insertAdjacentHTML('beforeend',`<span class="fpscanline" aria-hidden="true"></span><p class="fpscanhint">${fdT('Barcode in den Rahmen halten','Hold the barcode inside the frame')}</p>`)}
  let bar=document.createElement('div');bar.className='fpscanbar';
  let torch=$('ff-torch');if(torch){torch.textContent='';torch.insertAdjacentHTML('afterbegin',`${phIcon('lightning')}<span>${fdT('Blitz','Flash')}</span>`);bar.append(torch)}
  bar.insertAdjacentHTML('beforeend',`<button type="button" class="fptypebtn" aria-expanded="false" onclick="fpTypeBarcode(this)">${phIcon('keyboard')}<span>${fdT('Barcode eintippen','Type barcode')}</span></button>`);
  box.querySelector('.ffbarcodeform')?.before(bar);
}
function fpTypeBarcode(button){let box=button.closest('.fpscanner');if(!box)return;let open=!box.classList.contains('fptyping');box.classList.toggle('fptyping',open);button.setAttribute('aria-expanded',String(open));if(open)setTimeout(()=>$('barcode-input')?.focus(),0);fdSound('tap')}
if(typeof lookupBarcode==='function'){const fpLookupBase=lookupBarcode;lookupBarcode=function(event,scannedCode,...rest){if(scannedCode)fdSound('scan');return fpLookupBase.call(this,event,scannedCode,...rest)}}

/* ---------- Kombis ---------- */
function fpMealTotals(meal){return (meal.items||[]).reduce((a,x)=>{for(let k of ['kcal','p','c','f'])a[k]+=Number(x[k])||0;return a},{kcal:0,p:0,c:0,f:0})}
// Kombi-IDs können aus importierten Sicherungen stammen: nur als data-Attribut, nie in Inline-JavaScript.
document.addEventListener('click',event=>{let el=event.target.closest?.('[data-fp-meal]');if(el)fpMealView(el.dataset.fpMeal)});
let fpViewMealId=null;
function fpMealRow(meal,i){let t=fpMealTotals(meal);return `<div class="fprow ffrow"><button type="button" class="fprowmain" data-fp-meal="${esc(meal.id)}"><span class="fprowtext"><strong data-no-translate>${esc(meal.name)}</strong><small>${meal.items.length} ${meal.items.length===1?fdT('Position','item'):fdT('Positionen','items')} · ${fdNum(t.kcal)} kcal</small></span><span class="fprowsrc">${fdT('Kombi','Combo')}</span></button><button type="button" class="fprowadd" aria-label="${esc(meal.name)} ${fdT('eintragen','log')}" data-fp-meal="${esc(meal.id)}">${phIcon('plus')}</button></div>`}
function fpScaled(item,amount){let f=amount/item.grams,out={};for(let k of ['kcal','p','c','f'])out[k]=round(item[k]*f);let nutrients={};for(let [k,v] of Object.entries(item.nutrients||{}))if(Number.isFinite(v))nutrients[k]=v*f;return {...out,nutrients}}
function fpMealView(id){
  let meal=fdField('meals').find(m=>m.id===id);if(!meal||!$('foodbody'))return;fpViewMealId=meal.id;
  $('foodbody').innerHTML=`<div class="fpview">${fpBar(meal.name,"fpBackTo('meals')",`<button type="button" class="fdicon" aria-label="${fdT('Kombi bearbeiten','Edit combo')}" onclick="fpMealEdit(fpViewMealId)">${phIcon('pencil-simple')}</button>`)}<form class="ffform" onsubmit="fpLogMeal(event,fpViewMealId)"><p class="fdnote">${fdT('Mengen bei Bedarf anpassen. Jede Position wird ein eigener Eintrag mit gespeicherten Nährwerten.','Adjust amounts if needed. Each item becomes its own entry with stored nutrients.')}</p><div class="dsgroup fpitems">${meal.items.map((x,i)=>`<div class="fpitem"><div class="fpitemname"><strong data-no-translate>${esc(x.name)}</strong><small id="fp-item-kcal-${i}">${fdNum(x.kcal)} kcal</small></div><span class="ffunitinput fpitemamount"><input id="fp-item-${i}" type="text" inputmode="decimal" autocomplete="off" aria-label="${fdT('Menge','Amount')} ${esc(x.name)}" value="${esc(ffNum(x.grams))}" oninput="fpMealPreview(fpViewMealId)"><span>${x.unit}</span></span></div>`).join('')}</div><p class="fpmealtotal" id="fp-meal-total"></p><button class="btn full ffsubmit">${fdT('Alle eintragen','Log all')}</button></form></div>`;
  $('foodbody').scrollTop=0;fpMealPreview(id);
}
function fpMealAmounts(meal){return meal.items.map((x,i)=>ffParse($('fp-item-'+i)?.value))}
function fpMealPreview(id){let meal=fdField('meals').find(m=>m.id===id);if(!meal)return;let amounts=fpMealAmounts(meal),sum=0;meal.items.forEach((x,i)=>{let a=amounts[i],ok=a>=.1&&a<=10000,el=$('fp-item-kcal-'+i);if(ok)sum+=x.kcal*a/x.grams;if(el)el.textContent=ok?fdNum(x.kcal*a/x.grams)+' kcal':fdT('Menge prüfen','Check amount')});let total=$('fp-meal-total');if(total)total.textContent=fdT('Zusammen','Total')+' '+fdNum(sum)+' kcal'}
function fpLogMeal(event,id){
  event.preventDefault();let meal=fdField('meals').find(m=>m.id===id);if(!meal)return;
  let amounts=fpMealAmounts(meal);if(amounts.some(a=>!(a>=.1&&a<=10000))){toast(fdT('Bitte Mengen zwischen 0,1 und 10.000 eingeben','Please enter amounts between 0.1 and 10,000'));return}
  let now=Date.now(),added=meal.items.map((x,i)=>{let v=fpScaled(x,amounts[i]),entry={id:uid(),date,meal:'Snacks',name:x.name,grams:amounts[i],unit:x.unit,kcal:v.kcal,p:v.p,c:v.c,f:v.f,loggedAt:now+i};if(Object.keys(v.nutrients).length)entry.nutrients=v.nutrients;return fpCopyProvenance(x,entry)});
  if(!added.every(e=>['kcal','p','c','f'].every(k=>Number.isFinite(e[k])&&e[k]>=0)&&validNutrients(e.nutrients))){toast(fdT('Kombi konnte nicht eingetragen werden','Combo could not be logged'));return}
  state.foods.push(...added);
  let ids=added.map(x=>x.id);save();modal.close();render();fdSound('save');
  fdUndoToast(`${meal.name} ${fdT('eingetragen','logged')} · ${added.length}`,()=>{state.foods=state.foods.filter(x=>!ids.includes(x.id));save();render()});
}
// Gleiche Regeln wie der validData-Wrapper in puls-data-v87.js; prüft nur die Kombis, nicht den übrigen Zustand.
function fpMealsOK(list){let text=(x,max)=>typeof x==='string'&&x.trim().length>=1&&x.length<=max,num=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0;return Array.isArray(list)&&list.length<=200&&list.every(m=>text(m.id,60)&&text(m.name,100)&&Array.isArray(m.items)&&m.items.length>=1&&m.items.length<=50&&m.items.every(x=>text(x.name,120)&&num(x.grams)&&x.grams>0&&x.grams<=5000&&['g','ml'].includes(x.unit)&&['kcal','p','c','f'].every(k=>num(x[k]))&&(x.nutrients===undefined||x.nutrients&&typeof x.nutrients==='object'&&Object.values(x.nutrients).every(num))&&fpProvenanceText.every(k=>x[k]===undefined||typeof x[k]==='string')&&(x.aiEstimate===undefined||typeof x.aiEstimate==='boolean')))}
function fpBackTo(pane){fpPane=pane;foodTab('search')}
function fpMealEdit(id,fromToday=false){
  if(!$('foodbody'))return;let meal=id?fdField('meals').find(m=>m.id===id):null;
  fpMealDraft=meal?JSON.parse(JSON.stringify(meal)):{id:'combo-'+uid(),name:'',items:[]};fpMealDraft.isNew=!meal;
  if(fromToday)fpMealFromToday();else fpMealRender();
}
function fpMealRender(){
  let d=fpMealDraft,body=$('foodbody');if(!d||!body)return;let t=fpMealTotals(d);
  body.innerHTML=`<div class="fpview">${fpBar(d.isNew?fdT('Neue Kombi','New combo'):fdT('Kombi bearbeiten','Edit combo'),"fpMealLeave()")}<form class="ffform" onsubmit="fpSaveMeal(event)"><label class="fffield">${fdT('Name','Name')}<input id="fp-meal-name" maxlength="100" required autocomplete="off" placeholder="${fdT('z. B. Frühstück Standard','e.g. usual breakfast')}" value="${esc(d.name)}" oninput="fpMealDraft.name=this.value"></label><div class="ffsectionhead"><span>${fdT('Positionen','Items')}</span><span>${d.items.length}/50</span></div><div class="dsgroup fpitems">${d.items.map((x,i)=>`<div class="fpitem"><div class="fpitemname"><strong data-no-translate>${esc(x.name)}</strong><small>${fdNum(x.kcal)} kcal · P ${fdNum(x.p,1)} · KH ${fdNum(x.c,1)} · F ${fdNum(x.f,1)} g</small></div><span class="ffunitinput fpitemamount"><input type="text" inputmode="decimal" autocomplete="off" aria-label="${fdT('Menge','Amount')} ${esc(x.name)}" value="${esc(ffNum(x.grams))}" onchange="fpMealAmount(${i},this.value)"><span>${x.unit}</span></span><button type="button" class="fficonbtn" aria-label="${esc(x.name)} ${fdT('entfernen','remove')}" onclick="fpMealDraft.items.splice(${i},1);fpMealRender()">${phIcon('x')}</button></div>`).join('')||`<p class="fpempty">${fdT('Noch keine Positionen.','No items yet.')}</p>`}</div><div class="fpactions"><button type="button" class="btn secondary" onclick="fpMealPick()">${phIcon('magnifying-glass')} ${fdT('Lebensmittel suchen','Search food')}</button><button type="button" class="btn secondary" onclick="fpMealFromToday()">${fdT('Aus heutigen Einträgen','From today')}</button></div><p class="fpmealtotal">${fdT('Zusammen','Total')} ${fdNum(t.kcal)} kcal · P ${fdNum(t.p,1)} · KH ${fdNum(t.c,1)} · F ${fdNum(t.f,1)} g</p><button class="btn full ffsubmit">${fdT('Kombi speichern','Save combo')}</button>${d.isNew?'':`<div class="ffsecondary"><button type="button" class="textbtn ffdanger" onclick="fpDeleteMeal(fpMealDraft.id)">${fdT('Kombi löschen','Delete combo')}</button></div>`}</form></div>`;
  body.scrollTop=0;
}
function fpMealLeave(){fpMealDraft=null;fpPick=null;fpBackTo('meals')}
function fpMealAmount(i,raw){let x=fpMealDraft?.items[i],a=ffParse(raw);if(!x)return;if(!(a>=.1&&a<=5000)){toast(fdT('Menge 0,1 bis 5.000','Amount 0.1 to 5,000'));fpMealRender();return}let v=fpScaled(x,a);Object.assign(x,{grams:a,kcal:x.kcal*a/x.grams,p:x.p*a/x.grams,c:x.c*a/x.grams,f:x.f*a/x.grams});if(x.nutrients)x.nutrients=v.nutrients;fpMealRender()}
// Herkunft bleibt vollständig erhalten (Quelle, Barcode, Lebensmittel-/Rezeptbezug, KI-Schätzung).
const fpProvenanceText=['source','barcode','foodRef','recipeId'];
function fpCopyProvenance(src,out){for(let k of fpProvenanceText)if(typeof src[k]==='string'&&src[k])out[k]=src[k].slice(0,150);if(src.aiEstimate===true)out.aiEstimate=true;return out}
function fpSnapshot(src,amount){
  let item={name:String(src.name||'').slice(0,120),grams:amount,unit:src.unit==='ml'?'ml':'g'};
  for(let k of ['kcal','p','c','f'])item[k]=src[k];
  if(src.nutrients&&typeof src.nutrients==='object'){let nu={};for(let [k,v] of Object.entries(src.nutrients))if(Number.isFinite(v)&&v>=0)nu[k]=v;if(Object.keys(nu).length)item.nutrients=nu}
  fpCopyProvenance(src,item);
  return item;
}
function fpMealPick(){if(!fpMealDraft)return;fpMealDraft.name=$('fp-meal-name')?.value??fpMealDraft.name;if(fpMealDraft.items.length>=50){toast(fdT('Höchstens 50 Positionen','At most 50 items'));return}fpPick={meal:true};fpPane='all';foodTab('search')}
function fpPickCancel(){fpPick=null;fpMealRender()}
// Im Auswahlmodus landet „Hinzufügen“ in der Kombi statt im Tagebuch.
const fpAddFoodBase=addFood;addFood=function(event,...rest){
  if(fpPick&&fpMealDraft&&$('ff-detail')){
    event?.preventDefault?.();let food=foodSelection,amount=Number($('grams')?.value);
    if(!food||!(amount>=.1&&amount<=5000)){toast(fdT('Menge 0,1 bis 5.000','Amount 0.1 to 5,000'));return}
    if(!['kcal','p','c','f'].every(k=>Number.isFinite(food[k])&&food[k]>=0)){toast(fdT('Werte unvollständig. Bitte eigene Werte eingeben.','Values incomplete. Please enter custom values.'));return}
    let per={name:food.name,unit:ffBase(food),source:food.source,barcode:food.barcode,foodRef:food.id,recipeId:food.recipeId,aiEstimate:food.aiEstimate,nutrients:{}};
    for(let k of ['kcal','p','c','f'])per[k]=food[k]*amount/100;
    for(let [k,v] of Object.entries(food.nutrients||{}))if(Number.isFinite(v))per.nutrients[k]=v*amount/100;
    if(food.barcode)per.barcode=String(food.barcode);
    fpMealDraft.items.push(fpSnapshot(per,amount));fpPick=null;fpMealRender();fdSound('save');return;
  }
  return fpAddFoodBase.call(this,event,...rest);
};
function fpMealFromToday(){
  let body=$('foodbody');if(!body||!fpMealDraft)return;fpMealDraft.name=$('fp-meal-name')?.value??fpMealDraft.name;
  let items=fdDayFoods().filter(x=>!fdIsWater(x));
  body.innerHTML=`<div class="fpview">${fpBar(fdT('Aus heutigen Einträgen','From today’s entries'),'fpMealRender()')}<form class="ffform" onsubmit="fpTakeToday(event)">${items.length?`<div class="dsgroup fpitems">${items.map(x=>`<label class="fppick"><input type="checkbox" value="${esc(x.id)}" ${Number(x.grams)>5000?'disabled':''}><span class="fpitemname"><strong data-no-translate>${esc(x.name)}</strong><small>${fdNum(x.grams,1)} ${x.unit==='ml'?'ml':'g'} · ${fdNum(x.kcal)} kcal</small></span></label>`).join('')}</div><button class="btn full ffsubmit">${fdT('Übernehmen','Add selected')}</button>`:`<p class="fpempty">${fdT('An diesem Tag gibt es noch keine Einträge.','No entries on this day yet.')}</p>`}</form></div>`;
  body.scrollTop=0;
}
function fpTakeToday(event){
  event.preventDefault();let ids=[...document.querySelectorAll('.fppick input:checked')].map(x=>x.value);
  for(let id of ids){let x=state.foods.find(e=>e.id===id);if(!x||!(x.grams>0&&x.grams<=5000)||!['kcal','p','c','f'].every(k=>Number.isFinite(x[k])))continue;if(fpMealDraft.items.length>=50)break;fpMealDraft.items.push(fpSnapshot(x,x.grams))}
  fpMealRender();
}
function fpSaveMeal(event){
  event.preventDefault();let d=fpMealDraft;if(!d)return;d.name=String($('fp-meal-name')?.value||'').trim().slice(0,100);
  if(!d.name){toast(fdT('Bitte einen Namen eingeben','Please enter a name'));return}
  if(!d.items.length){toast(fdT('Mindestens ein Lebensmittel hinzufügen','Add at least one food'));return}
  let clean={id:String(d.id).slice(0,60),name:d.name,items:d.items.map(x=>fpSnapshot(x,x.grams))};
  let list=fdField('meals').filter(m=>m.id!==clean.id);if(d.isNew&&list.length>=200){toast(fdT('Höchstens 200 Kombis','At most 200 combos'));return}
  let index=fdField('meals').findIndex(m=>m.id===clean.id),next=[...fdField('meals')];if(index>=0)next[index]=clean;else next.push(clean);
  if(!fpMealsOK(next)){toast(fdT('Kombi enthält ungültige Werte','Combo contains invalid values'));return}
  state.meals=next;save();fpMealDraft=null;fdSound('save');toast(fdT('Kombi gespeichert','Combo saved'));fpBackTo('meals');
}
function fpDeleteMeal(id){if(!confirm(fdT('Kombi löschen? Eingetragene Einträge bleiben im Tagebuch.','Delete combo? Logged entries stay in the diary.')))return;state.meals=fdField('meals').filter(m=>m.id!==id);save();fpMealDraft=null;fdSound('delete');fpBackTo('meals')}

if(typeof englishUI==='object')for(let [k,v] of Object.entries({'Alle':'All','Häufig':'Frequent','Eigene':'Custom','Rezepte':'Recipes','Kombis':'Combos','Produkte':'Products','Getränke':'Drinks','Vorschläge':'Suggestions','Menge':'Amount','Portionsgröße':'Serving size','Suchoptionen':'Search options','Sortierung':'Sort','Datenbanken':'Databases','Barcode scannen':'Scan barcode','Barcode eintippen':'Type barcode','Blitz':'Flash'}))if(!(k in englishUI))englishUI[k]=v;
