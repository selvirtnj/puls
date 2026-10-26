const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('js/comfort.js','utf8');
function fixture(value,search=''){
 const links=new Map(),profile={language:'de',...(value===undefined?{}:{iconColor:value})};let saves=0;
 const ctx={state:profile,location:{search},Object,document:{querySelector(selector){if(!links.has(selector))links.set(selector,{getAttribute(){return this.href}});return links.get(selector)}},
  validData:s=>Array.isArray(s.foods),save(){saves++},openModal(){},resolveColorScheme:(mode,dark)=>mode==='system'?(dark?'dark':'light'):mode,getColorScheme:()=>ctx.mode,pulsSchemeMedia:{matches:false},mode:'system'};
 vm.createContext(ctx);const run=s=>vm.runInContext(s,ctx);
 // Actual selection functions + actual validation/startup; unrelated diary/drag wrappers omitted.
 run(source.split('/* Pointer sorting')[0]+'\n'+source.slice(source.indexOf('const comfortValid=')));
 return {ctx,run,links,profile,saves:()=>saves};
}
for(const old of ['amber','blue','green','mint','purple','rose','light','dark',undefined]){
 const f=fixture(old),before=JSON.stringify(f.profile);
 assert.equal(f.run('currentAppIcon()'),old==='light'||old===undefined?'light':'dark');
 assert(f.run('validData({...state,foods:[]})'),'Old backups accepted');
 f.run('applyAppIcon();applyAppIcon()');assert.equal(JSON.stringify(f.profile),before);assert.equal(f.saves(),0,'No startup save/sync dirtiness');
 f.run('chooseAppIcon("light")');assert.equal(f.profile.iconColor,'light');assert.equal(f.saves(),1);
 f.run('chooseAppIcon("dark")');assert.equal(f.profile.iconColor,'dark');assert.equal(f.saves(),2);
 assert.equal(f.links.get('link[rel="manifest"]').href,'icons/dark.webmanifest');
 assert(!f.run('validData({...state,foods:[],iconColor:"invalid"})'));
}
for(const requested of ['light','dark','purple','invalid']){
 const f=fixture('blue','?icon='+requested);assert.equal(f.run('currentAppIcon()'),requested==='light'?'light':'dark');
 assert.equal(f.profile.iconColor,'blue');assert.equal(f.saves(),0,'Installation URL is read-only');
 f.run('chooseAppIcon("light")');assert.equal(f.run('currentAppIcon()'),'light');
}
const f=fixture();f.ctx.pulsSchemeMedia.matches=true;f.run('applyAppIcon()');assert.equal(f.run('currentAppIcon()'),'dark');
f.ctx.mode='light';f.run('applyAppIcon()');assert.equal(f.run('currentAppIcon()'),'light');assert.equal(f.saves(),0);assert.equal(f.profile.iconColor,undefined);
for(const key of ['light','dark'])for(const size of [180,512]){
 const png=fs.readFileSync(`icons/${key}-${size}.png`);assert.equal(png.readUInt32BE(16),size);assert.equal(png.readUInt32BE(20),size);assert.equal(png[25],2,'Opaque RGB, no alpha');
}
for(const key of ['light','dark']){
 const manifest=JSON.parse(fs.readFileSync(`icons/${key}.webmanifest`));assert.equal(manifest.id,'../');assert.equal(manifest.scope,'../');
 assert(fs.existsSync('icons/'+manifest.icons[0].src));assert.equal(manifest.start_url,'../?icon='+key);
}
// Native PNG is generated/ignored, not part of a clean checkout.
assert(fs.readFileSync('.github/workflows/ios-app.yml','utf8').includes('"icons/dark.svg"'));
if(fs.existsSync('ios/PULS/Assets.xcassets/AppIcon.appiconset/AppIcon.png')){const native=fs.readFileSync('ios/PULS/Assets.xcassets/AppIcon.appiconset/AppIcon.png');assert.equal(native.readUInt32BE(16),1024);assert.equal(native.readUInt32BE(20),1024)}
const sw=fs.readFileSync('sw.js','utf8');for(const key of ['light','dark'])for(const ext of ['.svg','-180.png','-512.png','.webmanifest'])assert(sw.includes('icons/'+key+ext));
for(const path of ['index.html','sw.js','icon-install.html','manifest.webmanifest','.github/workflows/ios-app.yml'])assert(!/icons\/(amber|blue|green|mint|purple|rose)[-.]/.test(fs.readFileSync(path,'utf8')),path);
console.log('PASS: legacy icon backups/read-only mapping, no startup or URL save, explicit choices, system fallback, manifest/cache references and opaque PNG dimensions');
