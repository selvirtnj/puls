/* Optional Gemini meal estimates in the existing photo tab. Drafts never enter storage. */
(function(){
'use strict';
const text=(de,en)=>state.language==='en'?en:de;
let draft=null,request=null;
const owner=()=>typeof cloudSession!=='undefined'?cloudSession?.user?.id:null;
function clear(){request?.abort();request=null;draft=null}
modal.addEventListener('close',clear);
window.addEventListener('pagehide',clear);
const basePhoto=photoFoodPanel;
photoFoodPanel=function(...args){clear();basePhoto.apply(this,args);$('foodbody')?.insertAdjacentHTML('afterbegin',`<button type="button" class="btn secondary full ffsubmit" onclick="foodPhotoOpen()">${text('Foto schätzen (KI)','Estimate photo (AI)')}</button><p class="ffprivacy">${text('Für Gerichte: KI-Schätzung. Für Nährwerttabellen: Texterkennung unten.','For meals: AI estimate. For nutrition labels: text recognition below.')}</p>`)};
const baseTab=foodTab;
foodTab=function(...args){clear();return baseTab.apply(this,args)};
const baseValid=validData;
validData=function(s){return baseValid(s)&&['foods','custom'].every(key=>s[key].every(x=>x.aiEstimate===undefined||x.aiEstimate===true&&typeof x.source==='string'&&x.source.startsWith('KI-Schätzung')&&(!x.nutrients||Object.keys(x.nutrients).length===0)))};
// Keep the final existing snapshot/provenance/custom-product chain, including later reuse.
const baseAdd=addFood;
addFood=function(event){let selected=foodSelection,before=state.foods.length;baseAdd(event);if(selected?.aiEstimate===true&&state.foods.length>before){state.foods.at(-1).aiEstimate=true;save()}};
function unavailable(){
 if(navigator.onLine===false)return text('Für die KI-Schätzung brauchst du eine Internetverbindung.','AI estimation requires an internet connection.');
 if(!owner()||!cloudConfigured||firstRunPreview)return text('Für die KI-Schätzung bitte mit deinem PULS-Konto anmelden.','Sign in to your PULS account to estimate a photo.');
 return '';
}
function current(d){return draft===d&&owner()===d.owner&&state===d.profile&&date===d.date&&!!$('food-photo-root')&&modal.open}
function status(message){let el=$('food-photo-status');if(el)el.textContent=message}
window.foodPhotoOpen=function(){
 clear();stopBarcode();stopLabelOCR();cancelLookup();
 draft={owner:owner(),profile:state,date,image:'',description:'',estimate:null};
 $('foodbody').innerHTML=`<div id="food-photo-root" class="ffphoto">${ffHead(text('Foto schätzen (KI)','Estimate photo (AI)'),'',"foodTab('photo')")}
 <div class="dsgroup ffphotoactions"><label class="dsrow dsiconrow dsphotorow"><span class="dsrowicon" aria-hidden="true">${ffIcon('camera')}</span><span class="dsrowtext">${text('Foto aufnehmen','Take photo')}</span><input type="file" accept="image/*" capture="environment" data-ds-file="1" onchange="foodPhotoRead(this.files[0])"></label><label class="dsrow dsiconrow dsphotorow"><span class="dsrowicon" aria-hidden="true">${ffIcon('image')}</span><span class="dsrowtext">${text('Aus Fotos wählen','Choose from photos')}</span><input type="file" accept="image/*" data-ds-file="1" onchange="foodPhotoRead(this.files[0])"></label></div>
 <img id="food-photo-preview" class="labelpreview" hidden alt="${text('Dein Essen','Your meal')}">
 <label class="fffield">${text('Was ist drin? (optional)','What is in it? (optional)')}<textarea id="food-photo-text" maxlength="1200" rows="3" placeholder="${text('Reis, Hähnchen, etwas Öl, ca. 400 g','Rice, chicken, some oil, about 400 g')}"></textarea></label>
 <p class="ffprivacy">${text('Foto und Beschreibung gehen erst beim Senden an Google Gemini. Im Gratis-Tarif können sie zur Verbesserung von Google-Produkten genutzt werden. PULS speichert das Foto nicht.','Your photo and description are sent to Google Gemini when you submit. On the free tier they may be used to improve Google products. PULS does not store the photo.')}</p>
 <button id="food-photo-send" type="button" class="btn full ffsubmit" onclick="foodPhotoSend()">${text('Senden & schätzen','Send & estimate')}</button>
 <p id="food-photo-status" class="ffstatus" role="status" aria-live="polite"></p><div id="food-photo-review"></div></div>`;
 status(unavailable());ffTop();
};
window.foodPhotoRead=async function(file){
 const d=draft;if(!d||!current(d)||!file)return;
 request?.abort();request=null;d.image='';d.estimate=null;$('food-photo-review').innerHTML='';$('food-photo-preview').hidden=true;
 if(!file.type.startsWith('image/')||file.size>20*1024*1024){status(text('Bitte ein Bild bis 20 MB auswählen.','Choose an image up to 20 MB.'));return}
 const ticket={};d.loading=ticket;status(text('Foto wird vorbereitet …','Preparing photo …'));
 const url=URL.createObjectURL(file);
 try{
  const img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=url});
  if(!img.naturalWidth||!img.naturalHeight)throw Error();
  const scale=Math.min(1,1024/Math.max(img.naturalWidth,img.naturalHeight)),canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
  const context=canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(img,0,0,canvas.width,canvas.height);
  // Canvas re-encoding removes EXIF/location metadata and bounds the upload.
  // Server accepts at most 1 MiB JPEG (1398104 base64 chars); step quality down if needed.
  let image='';for(const quality of [.82,.7,.55]){image=canvas.toDataURL('image/jpeg',quality);if(image.length-23<=1398000)break}
  if(!image.startsWith('data:image/jpeg;base64,')||image.length-23>1398000)throw Error();
  if(!current(d)||d.loading!==ticket)return;
  d.image=image;$('food-photo-preview').src=image;$('food-photo-preview').hidden=false;status(unavailable());
 }catch{if(current(d)&&d.loading===ticket)status(text('Bild konnte nicht gelesen werden. Bitte ein JPEG oder ein kleineres Bild wählen.','Could not read the image. Choose a JPEG or a smaller image.'))}
 finally{URL.revokeObjectURL(url)}
};
function valid(x){
 const finite=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max,nonempty=(v,max)=>typeof v==='string'&&v.trim().length>0&&v.length<=max;
 return x&&nonempty(x.name,100)&&finite(x.grams,.1,10000)&&finite(x.kcal,0,100000)&&x.kcal<=x.grams*10&&['p','c','f'].every(k=>finite(x[k],0,x.grams))&&x.p+x.c+x.f<=x.grams*1.05&&Array.isArray(x.components)&&x.components.length>=1&&x.components.length<=20&&x.components.every(v=>nonempty(v,120))&&['low','medium','high'].includes(x.uncertainty)&&finite(x.kcalMin,0,x.kcal)&&finite(x.kcalMax,x.kcal,100000)&&finite(x.gramsMin,.1,x.grams)&&finite(x.gramsMax,x.grams,10000)&&nonempty(x.note,1000);
}
window.foodPhotoSend=async function(){
 const d=draft;if(!d||!current(d)||request)return;
 let reason=unavailable();if(reason){status(reason);return}
 if(!d.image){status(text('Bitte zuerst ein Foto auswählen.','Choose a photo first.'));return}
 const description=$('food-photo-text').value.trim();if(description.length>1200)return;
 const controller=new AbortController();request=controller;let timer=setTimeout(()=>controller.abort(),55000),button=$('food-photo-send');button.disabled=true;
 d.estimate=null;$('food-photo-review').innerHTML='';status(text('KI schätzt dein Essen …','AI is estimating your meal …'));
 try{
  await cloudFreshSession();if(!current(d)||controller.signal.aborted)return;
  // Use the existing Auth session/refresh path. No keys or photos in profile/storage.
  const response=await fetch(cloudConfig.url+'/functions/v1/food-photo',{method:'POST',headers:{'Content-Type':'application/json',apikey:cloudConfig.publicKey,Authorization:'Bearer '+cloudSession.access_token},body:JSON.stringify({image:d.image.split(',')[1],mimeType:'image/jpeg',text:description,language:state.language==='en'?'en':'de'}),credentials:'omit',referrerPolicy:'no-referrer',signal:controller.signal});
  if(!current(d)||controller.signal.aborted)return;
  if(!response.ok){const error=Error();error.status=response.status;throw error}
  const data=await response.json();if(!valid(data?.estimate))throw Error('invalid');
  if(!current(d)||controller.signal.aborted)return;
  d.estimate=data.estimate;d.description=description;review(d.estimate);status('');
 }catch(error){if(current(d))status(error.status===429?text('Limit erreicht. Bitte später erneut versuchen.','Limit reached. Please try again later.'):error.status===401?text('Anmeldung abgelaufen. Bitte erneut anmelden.','Session expired. Please sign in again.'):error.status===503||error.status===404?text('Die KI-Schätzung ist noch nicht eingerichtet oder gerade nicht verfügbar.','AI estimation is not configured yet or is currently unavailable.'):error.status===422?text('Kein Essen erkannt oder die Schätzung war unplausibel. Bitte Foto oder Beschreibung ergänzen und erneut senden.','No food recognised or the estimate was implausible. Refine the photo or description and send again.'):text('Keine gültige Schätzung erhalten. Bitte Verbindung prüfen, Foto oder Beschreibung ergänzen und erneut versuchen.','No valid estimate received. Check your connection, refine the photo or description and try again.'))}
 finally{clearTimeout(timer);if(request===controller)request=null;if(current(d))button.disabled=false}
};
function review(x){
 const uncertainty={low:text('gering','low'),medium:text('mittel','medium'),high:text('hoch','high')}[x.uncertainty];
 $('food-photo-review').innerHTML=`<form class="ffform ffreview" onsubmit="foodPhotoConfirm(event)"><h3>${text('KI-Schätzung prüfen','Review AI estimate')}</h3><p class="ffstatus" data-no-translate>${esc(x.components.join(' · '))}</p><p class="ffstatus">${text('Unsicherheit','Uncertainty')}: ${uncertainty} · ${x.kcalMin}–${x.kcalMax} kcal · ${x.gramsMin}–${x.gramsMax} g</p><p class="ffstatus" data-no-translate>${esc(x.note)}</p><p class="ffstatus">${text('Alle Werte gelten für das ganze fotografierte Essen. Menge und Werte vor dem Speichern korrigieren.','All values refer to the whole photographed meal. Correct the amount and values before saving.')}</p>
 <label class="fffield">${text('Name','Name')}<input id="food-photo-name" maxlength="100" required value="${esc(x.name)}"></label><label class="fffield">${text('Geschätzte Menge · g','Estimated amount · g')}<input id="food-photo-grams" type="number" inputmode="decimal" min="0.1" max="10000" step="any" required value="${x.grams}"></label>
 ${ffNutrientGrid('food-photo-',x,false)}<input id="grams" type="hidden">
 <label class="foodack"><input id="food-photo-confirm" type="checkbox" required>${text('Ich habe Menge und Werte geprüft. Es bleibt eine KI-Schätzung.','I checked the amount and values. This remains an AI estimate.')}</label><button class="btn full ffsubmit">${text('Bestätigen & eintragen','Confirm & log')}</button><p class="ffprivacy">${text('Beschreibung oben ergänzen und erneut senden, um neu zu schätzen. Die erneute Schätzung ersetzt dieses Formular.','Refine the description above and send again to re-estimate. A new estimate replaces this form.')}</p></form>`;
 $('food-photo-send').textContent=text('Erneut schätzen','Estimate again');
}
window.foodPhotoConfirm=function(event){
 event.preventDefault();const d=draft;if(!d?.estimate||!current(d)||!$('food-photo-confirm')?.checked)return;
 const values=Object.fromEntries(['grams','kcal','p','c','f'].map(k=>[k,ffParse($('food-photo-'+k).value)])),name=$('food-photo-name').value.trim();
 if(!name||name.length>100||!valid({...d.estimate,...values,name,kcalMin:Math.min(d.estimate.kcalMin,values.kcal),kcalMax:Math.max(d.estimate.kcalMax,values.kcal),gramsMin:Math.min(d.estimate.gramsMin,values.grams),gramsMax:Math.max(d.estimate.gramsMax,values.grams)})){status(text('Bitte gültige Mengen und Werte eintragen.','Enter valid amounts and values.'));return}
 // Existing addFood converts per-100-g values into the diary snapshot. No micro values.
 foodSelection={id:uid(),name,unit:'g',source:'KI-Schätzung · Google Gemini',aiEstimate:true,...Object.fromEntries(['kcal','p','c','f'].map(k=>[k,values[k]*100/values.grams]))};
 $('grams').value=values.grams;addFood(event);
};
})();
