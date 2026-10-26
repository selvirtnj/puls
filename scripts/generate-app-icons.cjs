/* Dependency-free, deterministic SVG/PNG assets. Run from the repository root. */
const fs=require('node:fs'),zlib=require('node:zlib');
const variants={light:{background:'#F2F2F7',ink:'#007AFF'},dark:{background:'#1C1C1E',ink:'#0A84FF'}};
// Every visible point lies within the central maskable safe circle (radius 40%).
const points=[[100,256],[184,256],[220,176],[272,336],[308,256],[412,256]],width=24;
function crc(buffer){let c=0xffffffff;for(const b of buffer){c^=b;for(let j=0;j<8;j++)c=(c>>>1)^((c&1)?0xedb88320:0)}return (c^0xffffffff)>>>0}
function chunk(type,data){const name=Buffer.from(type),length=Buffer.alloc(4),sum=Buffer.alloc(4);length.writeUInt32BE(data.length);sum.writeUInt32BE(crc(Buffer.concat([name,data])));return Buffer.concat([length,name,data,sum])}
function rgb(hex){return hex.slice(1).match(/../g).map(x=>parseInt(x,16))}
function distance(x,y,a,b){let dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy)));return Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy)}
function png(size,{background,ink}){
 const bg=rgb(background),fg=rgb(ink),raw=Buffer.alloc((size*3+1)*size);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  let covered=0;for(let sy=0;sy<4;sy++)for(let sx=0;sx<4;sx++){
   let px=(x+(sx+.5)/4)*512/size,py=(y+(sy+.5)/4)*512/size;
   if(points.slice(1).some((b,i)=>distance(px,py,points[i],b)<=width/2))covered++;
  }
  let offset=y*(size*3+1)+1+x*3;for(let c=0;c<3;c++)raw[offset+c]=Math.round(bg[c]+(fg[c]-bg[c])*covered/16);
 }
 const header=Buffer.alloc(13);header.writeUInt32BE(size);header.writeUInt32BE(size,4);header[8]=8;header[9]=2;
 return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',header),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
}
for(const [key,colors] of Object.entries(variants)){
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="${colors.background}"/><path d="M${points.map(p=>p.join(' ')).join(' L')}" fill="none" stroke="${colors.ink}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/></svg>\n`;
 fs.writeFileSync(`icons/${key}.svg`,svg);
 for(const size of [180,512])fs.writeFileSync(`icons/${key}-${size}.png`,png(size,colors));
 fs.writeFileSync(`icons/${key}.webmanifest`,JSON.stringify({id:'../',name:'PULS',short_name:'PULS',start_url:`../?icon=${key}`,scope:'../',display:'standalone',background_color:colors.background,theme_color:colors.background,icons:[{src:`${key}-512.png`,sizes:'512x512',type:'image/png',purpose:'any maskable'}]})+'\n');
 if(key==='dark'){
  fs.writeFileSync('icon.svg',svg);
  fs.writeFileSync('ios/PULS/Assets.xcassets/AppIcon.appiconset/AppIcon.png',png(1024,colors));
  fs.writeFileSync('manifest.webmanifest',JSON.stringify({id:'./',name:'PULS',short_name:'PULS',start_url:'./',scope:'./',display:'standalone',background_color:colors.background,theme_color:colors.background,icons:[{src:'icons/dark-512.png',sizes:'512x512',type:'image/png',purpose:'any maskable'}]})+'\n');
 }
}
