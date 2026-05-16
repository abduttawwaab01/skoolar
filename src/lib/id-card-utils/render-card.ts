import QRCode from 'qrcode';
import sharp from 'sharp';
import { db } from '@/lib/db';
import { getFontFaceCSS } from './font-loader';

const MM = (mm: number) => Math.round((mm / 25.4) * 300);
const PW = MM(53.98); const PH = MM(85.6);
const LW = MM(85.6);  const LH = MM(53.98);

function esc(s: unknown): string {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function n(v: number): string { return String(Math.round(v)); }
function adj(c: string, a: number): string {
  const h = c.replace('#','');
  const cl = (x: number) => Math.max(0,Math.min(255,x));
  const rv = cl(parseInt(h.slice(0,2),16)+a);
  const gv = cl(parseInt(h.slice(2,4),16)+a);
  const bv = cl(parseInt(h.slice(4,6),16)+a);
  return `#${rv.toString(16).padStart(2,'0')}${gv.toString(16).padStart(2,'0')}${bv.toString(16).padStart(2,'0')}`;
}
function contrast(bg: string): string {
  const h=bg.replace('#','');
  const lum=(0.299*parseInt(h.slice(0,2),16)+0.587*parseInt(h.slice(2,4),16)+0.114*parseInt(h.slice(4,6),16))/255;
  return lum>0.55?'#1a1a1a':'#ffffff';
}
function trunc(s: string, max: number): string {
  return s.length>max ? s.slice(0,max-1)+'…' : s;
}

export async function renderIDCard(
  person: any, colors:{primary:string;secondary:string}, backText:string,
  showPhoto:boolean, _sb:boolean, showQR:boolean, orientation:string,
  photoUrl:string|null, role:string, isBack=false
): Promise<Buffer> {
  const port = orientation==='portrait';
  const W = port?PW:LW, H = port?PH:LH;
  const pType = person.type||(role==='STUDENT'?'student':'staff');
  const prim  = colors.primary||'#059669';
  const sec   = colors.secondary||'#FFFFFF';
  const dark  = '#1e293b', muted='#64748b';
  const primD = adj(prim,-25), primL=adj(prim,35);
  const border= adj(sec,-25);
  const hdrTxt= contrast(prim);

  let qrB64='';
  if(showQR&&!isBack){
    try{
      const buf=await QRCode.toBuffer(JSON.stringify({
        type:pType, id:esc(person.displayId||person.admissionNo||person.employeeNo||'N/A'),
        userId:person.userId||'', personId:person.id||person.personId||'',
        schoolId:person.schoolId||'', name:esc(person.name||''), role, ts:Date.now()
      }),{width:port?440:520,margin:1,color:{dark:prim,light:'#ffffff'},errorCorrectionLevel:'H'});
      qrB64=buf.toString('base64');
    }catch(_){}
  }

  let sName='School',sAddr='',sPh='',sEm='';
  if(person.schoolId){
    try{
      const s=await db.school.findUnique({where:{id:person.schoolId},select:{name:true,address:true,phone:true,email:true}});
      if(s){sName=s.name||'School';sAddr=s.address||'';sPh=s.phone||'';sEm=s.email||'';}
    }catch(_){}
  }

  const pName  = trunc(esc(person.name||'Unknown'), port?20:28);
  const pId    = esc(person.displayId||person.admissionNo||person.employeeNo||'N/A');
  const pClass = esc(person.class||'N/A');
  const pGend  = esc(person.gender||'');
  const pPhone = esc(person.phone||'');
  const pRole  = esc(role);
  const schN   = trunc(esc(sName), port?24:32);
  const schA   = trunc(esc(sAddr),50);
  const inits  = esc((person.name||'NA').split(' ').map((x:string)=>x[0]||'').join('').slice(0,2).toUpperCase());

  let phB64='', phMime='image/jpeg';
  if(showPhoto&&photoUrl){
    try{
      const url=photoUrl.startsWith('//')?`https:${photoUrl}`:photoUrl.startsWith('http')?photoUrl:`https://skoolar.org${photoUrl}`;
      const ctrl=new AbortController(); const tid=setTimeout(()=>ctrl.abort(),8000);
      const res=await fetch(url,{signal:ctrl.signal,headers:{'User-Agent':'Skoolar-IDCard/2.0'}});
      clearTimeout(tid);
      if(res.ok){
        const ct=res.headers.get('content-type')||'';
        if(ct.startsWith('image/')){
          const ab=await res.arrayBuffer();
          const b=Buffer.from(new Uint8Array(ab));
          if(b.length>0 && b.length<=5*1024*1024){
            phB64=b.toString('base64');
            phMime=ct;
          }
        }
      }
    }catch(phErr){
      console.warn('Photo fetch failed:', phErr);
    }
  }

  // Get embedded font CSS to prevent rendering boxes
  const fontCSS = getFontFaceCSS();
  const FF = fontCSS ? "'SkoolarCard', sans-serif" : "'Segoe UI', 'Helvetica Neue', Arial, sans-serif";
  
  const style = `<style>
    ${fontCSS}
    * { font-family: ${FF}; }
    text { font-family: ${FF}; }
    .text-light { fill: ${hdrTxt}; }
    .text-dark { fill: ${dark}; }
    .text-muted { fill: ${muted}; }
    .text-primary { fill: ${prim}; }
    .name-text { font-weight: 700; font-family: ${FF}; }
    .label-text { font-weight: 400; font-family: ${FF}; }
    .value-text { font-weight: 600; font-family: ${FF}; }
  </style>`;
  
  const defs  = `<defs>
    <linearGradient id="hg" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${primD}"/>
      <stop offset="50%" stop-color="${prim}"/>
      <stop offset="100%" stop-color="${primL}"/>
    </linearGradient>
    <linearGradient id="hg-vert" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${primD}"/>
      <stop offset="100%" stop-color="${prim}"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000" flood-opacity="0.15"/>
    </filter>
    <filter id="softshadow" x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="${prim}" flood-opacity="0.2"/>
    </filter>
  </defs>`;

  const svg = port 
    ? buildPortraitModern({W,H,prim,primD,primL,sec,dark,muted,border,hdrTxt,pName,pId,pClass,pGend,pPhone,pRole,schN,schA,sPh,sEm,inits,phB64,phMime,qrB64,showQR,showPhoto,pType,isBack,backText,style,defs})
    : buildLandscapeModern({W,H,prim,primD,primL,sec,dark,muted,border,hdrTxt,pName,pId,pClass,pGend,pPhone,pRole,schN,schA,sPh,sEm,inits,phB64,phMime,qrB64,showQR,showPhoto,pType,isBack,backText,style,defs});

  try {
    const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();
    return pngBuffer;
  } catch (sharpErr) {
    console.error('Sharp rendering error:', sharpErr);
    throw new Error(`Failed to render ID card: ${sharpErr instanceof Error ? sharpErr.message : 'Unknown error'}`);
  }
}

function photoCircleModern(cx:number,cy:number,r:number,prim:string,muted:string,phB64:string,phMime:string,inits:string,id:string):string {
  const outerRing = `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r+10)}" fill="${prim}" opacity="0.15"/>`;
  const whiteBorder = `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r+4)}" fill="#ffffff"/>`;
  const thinBorder = `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r+2)}" fill="none" stroke="${prim}" stroke-width="2.5" opacity="0.6"/>`;
  
  if(phB64&&phB64.length>100){
    return `<defs><clipPath id="${id}"><circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}"/></clipPath></defs>
      ${outerRing}${whiteBorder}${thinBorder}
      <image x="${n(cx-r)}" y="${n(cy-r)}" width="${n(r*2)}" height="${n(r*2)}" 
        href="data:${phMime};base64,${phB64}" 
        preserveAspectRatio="xMidYMid slice" 
        clip-path="url(#${id})"/>`;
  }
  
  return `${outerRing}${whiteBorder}${thinBorder}
    <circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="${prim}" opacity="0.08"/>
    <text x="${n(cx)}" y="${n(cy)}" font-size="${n(r*0.75)}" font-weight="700" fill="${prim}" opacity="0.6" 
      text-anchor="middle" dominant-baseline="middle">${inits}</text>
    <text x="${n(cx)}" y="${n(cy+r*0.72)}" font-size="${n(r*0.18)}" fill="${muted}" 
      text-anchor="middle" dominant-baseline="middle">NO PHOTO</text>`;
}

function infoCard(x:number,y:number,w:number,h:number,sec:string,border:string,content:string):string {
  return `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="12" 
    fill="${adj(sec,-5)}" stroke="${border}" stroke-width="1" opacity="0.5"/>
  ${content}`;
}

function buildPortraitModern(o:any):string {
  const {W,H,prim,primD,primL,sec,dark,muted,border,hdrTxt,pName,pId,pClass,pGend,pPhone,pRole,schN,schA,sPh,sEm,inits,phB64,phMime,qrB64,showQR,showPhoto,pType,isBack,backText,style,defs} = o;
  
  const hH = Math.round(H * 0.12); // Slightly taller header
  const mg = Math.round(W * 0.06);

  if(isBack){
    const bLines=(backText||'').split('\n').filter((l:string)=>l.trim());
    let secY=Math.round(H*0.20);
    const lh=Math.round(H*0.032);
    const sections=[
      {title:'CONTACT',lines:[schA,sPh,sEm].filter(Boolean)},
      {title:'IMPORTANT',lines:bLines}
    ].filter(s=>s.lines.length>0);
    
    const sHtml=sections.map((sec:any)=>{
      const t=`<text x="${n(mg)}" y="${n(secY)}" font-size="${n(H*0.018)}" font-weight="700" fill="${prim}" letter-spacing="2" class="name-text">${sec.title}</text>
        <line x1="${n(mg)}" y1="${n(secY+10)}" x2="${n(W-mg)}" y2="${n(secY+10)}" stroke="${prim}" stroke-width="1.5" opacity="0.25"/>`;
      secY+=38;
      const lHtml=sec.lines.map((l:string)=>{
        const e=`<text x="${n(mg+15)}" y="${n(secY)}" font-size="${n(H*0.017)}" fill="${dark}" class="label-text">${esc(l)}</text>`;
        secY+=lh;
        return e;
      }).join('\n');
      secY+=15; 
      return t+'\n'+lHtml;
    }).join('\n');

    return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
      ${style}${defs}
      <rect width="${W}" height="${H}" fill="${sec}"/>
      <circle cx="${n(W*.06)}" cy="${n(H*.10)}" r="${n(W*.45)}" fill="${prim}" opacity="0.03"/>
      <circle cx="${n(W*.94)}" cy="${n(H*.88)}" r="${n(W*.30)}" fill="${prim}" opacity="0.025"/>
      <rect x="0" y="0" width="${W}" height="${n(hH)}" fill="url(#hg)"/>
      <text x="${n(W/2)}" y="${n(hH*.58)}" font-size="${n(H*.026)}" font-weight="700" fill="${hdrTxt}" text-anchor="middle" class="name-text">${schN}</text>
      <text x="${n(W/2)}" y="${n(hH*.88)}" font-size="${n(H*.014)}" fill="${hdrTxt}" text-anchor="middle" opacity="0.8" letter-spacing="2" class="label-text">IDENTIFICATION CARD — REVERSE</text>
      ${sHtml}
      <text x="${n(W/2)}" y="${n(H*.92)}" font-size="${n(H*.014)}" fill="${muted}" text-anchor="middle" opacity="0.7" class="label-text">If found, please return to the school office.</text>
      <rect x="0" y="${n(H-30)}" width="${W}" height="30" fill="${prim}" opacity="0.08"/>
      <text x="${n(W/2)}" y="${n(H-12)}" font-size="${n(H*.011)}" fill="${muted}" text-anchor="middle" opacity="0.6" class="label-text">Skoolar • School Management Platform</text>
    </svg>`;
  }

  const photoR = Math.round(W * 0.23); // Slightly larger photo
  const photoCX = Math.round(W * 0.50);
  const photoCY = Math.round(hH + (H * 0.14));
  
  const txtX = Math.round(W * 0.50);
  const nameY = Math.round(photoCY + photoR + Math.round(H * 0.04));
  const nameFs = Math.round(H * 0.036); // Slightly larger name
  
  const badgeY = Math.round(nameY + Math.round(H * 0.02));
  const badgeW = Math.round(W * 0.42);
  const badgeH = Math.round(H * 0.032);
  const badgeX = Math.round((W - badgeW) / 2);
  
   const infoCardX = mg;
   const infoCardY = Math.round(badgeY + badgeH + Math.round(H * 0.025));
   const infoCardW = W - mg * 2;
   const infoCardH = Math.round(H * 0.13);
   
   const divY = Math.round(infoCardY + infoCardH + Math.round(H * 0.015));
  
   const qrSz = Math.round(W * 0.46);
   const qrPad = 12;
   const qrBW = qrSz + qrPad * 2;
   const qrBX = Math.round((W - qrBW) / 2);
   const qrBY = Math.round(divY + Math.round(H * 0.018));
   const qrIX = qrBX + qrPad;
   const qrIY = qrBY + qrPad;
   const qrBH = qrSz + qrPad * 2 + Math.round(H * 0.032);
   const scanY = Math.round(qrIY + qrSz + Math.round(H * 0.024));
  
  const ctcY = Math.round(qrBY + qrBH + Math.round(H * 0.02));

  const rows:any[]=[];
  if(pType==='student'){
    rows.push({l:'Student ID',v:pId});
    rows.push({l:'Class',v:pClass});
    if(pGend)rows.push({l:'Gender',v:pGend});
  }else{
    rows.push({l:'Staff ID',v:pId});
    if(pRole)rows.push({l:'Role',v:pRole});
    if(pPhone)rows.push({l:'Phone',v:pPhone});
  }

  const rowStartY = infoCardY + Math.round(H * 0.032);
  const rowLH = Math.round(H * 0.035);
  const labelX = infoCardX + Math.round(infoCardW * 0.08);
  const valueX = infoCardX + Math.round(infoCardW * 0.44);
  const rowFs = Math.round(H * 0.018);
  
  const infoRowsHtml = rows.map((row,i)=>`
    <text x="${n(labelX)}" y="${n(rowStartY + i * rowLH)}" font-size="${n(rowFs)}" fill="${muted}" class="label-text">${row.l}</text>
    <text x="${n(valueX)}" y="${n(rowStartY + i * rowLH)}" font-size="${n(rowFs)}" font-weight="600" fill="${dark}" class="value-text">${row.v}</text>
  `).join('');

  const phEl = showPhoto ? photoCircleModern(photoCX, photoCY, photoR, prim, muted, phB64, phMime, inits, 'pc1') : '';
  
  let qrEl = '';
  if(showQR && qrB64){
    qrEl = `<g filter="url(#softshadow)">
      <rect x="${n(qrBX)}" y="${n(qrBY)}" width="${n(qrBW)}" height="${n(qrBH)}" rx="16" fill="#ffffff" stroke="${border}" stroke-width="1.5"/>
    </g>
    <rect x="${n(qrBX + 3)}" y="${n(qrBY + 3)}" width="${n(qrBW - 6)}" height="${n(qrBH - 6)}" rx="13" fill="#fafafa"/>
    <image x="${n(qrIX)}" y="${n(qrIY)}" width="${n(qrSz)}" height="${n(qrSz)}" href="data:image/png;base64,${qrB64}"/>
    <text x="${n(W/2)}" y="${n(scanY)}" font-size="${n(H*.022)}" font-weight="700" fill="${prim}" text-anchor="middle" letter-spacing="4" class="name-text">SCAN TO VERIFY</text>`;
  }

  let ctcEl = '';
  const ctcBaseY = showQR && qrB64 ? ctcY : Math.round(divY + H * 0.05);
  if(schA || sPh){
    const iconFs = Math.round(H * 0.014);
    if(schA){
      ctcEl += `<text x="${n(W/2)}" y="${n(ctcBaseY)}" font-size="${n(iconFs)}" fill="${muted}" text-anchor="middle" class="label-text">📍 ${schA}</text>`;
    }
    if(sPh){
      const phoneY = schA ? ctcBaseY + Math.round(H * 0.02) : ctcBaseY;
      ctcEl += `<text x="${n(W/2)}" y="${n(phoneY)}" font-size="${n(iconFs)}" fill="${muted}" text-anchor="middle" class="label-text">📞 ${sPh}</text>`;
    }
  }

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    ${style}${defs}
    
    <rect width="${W}" height="${H}" fill="${sec}"/>
    
    <circle cx="${n(W*.04)}" cy="${n(H*.08)}" r="${n(W*.42)}" fill="${prim}" opacity="0.025"/>
    <circle cx="${n(W*.95)}" cy="${n(H*.86)}" r="${n(W*.28)}" fill="${prim}" opacity="0.02"/>
    
    <rect x="2" y="2" width="${n(W-4)}" height="${n(H-4)}" rx="16" fill="none" stroke="${border}" stroke-width="2" opacity="0.3"/>
    
    <rect x="0" y="0" width="${W}" height="${n(hH)}" fill="url(#hg)"/>
    
    <path d="M0 ${n(hH)} Q${n(W*.20)} ${n(hH+12)} ${n(W*.50)} ${n(hH+4)} Q${n(W*.80)} ${n(hH-5)} ${W} ${n(hH)}" fill="${prim}" opacity="0.4"/>
    
    <text x="${n(mg)}" y="${n(hH*.58)}" font-size="${n(H*.026)}" font-weight="700" fill="${hdrTxt}" class="name-text">${schN}</text>
    <text x="${n(W-mg)}" y="${n(hH*.58)}" font-size="${n(H*.017)}" font-weight="600" fill="${hdrTxt}" text-anchor="end" opacity="0.9" letter-spacing="2" class="value-text">ID CARD</text>
    
    ${phEl}
    
    <text x="${n(txtX)}" y="${n(nameY)}" font-size="${n(nameFs)}" font-weight="700" fill="${dark}" text-anchor="middle" class="name-text">${pName}</text>
    
    <g filter="url(#shadow)">
      <rect x="${n(badgeX)}" y="${n(badgeY)}" width="${n(badgeW)}" height="${n(badgeH)}" rx="${n(badgeH/2)}" fill="${prim}" opacity="0.14"/>
    </g>
    <text x="${n(badgeX + badgeW/2)}" y="${n(badgeY + badgeH*0.68)}" font-size="${n(H*.020)}" font-weight="700" fill="${prim}" text-anchor="middle" letter-spacing="1" class="name-text">${pRole}</text>
    
    ${infoCard(infoCardX, infoCardY, infoCardW, infoCardH, sec, border, infoRowsHtml)}
    
    <line x1="${n(mg)}" y1="${n(divY)}" x2="${n(W-mg)}" y2="${n(divY)}" stroke="${border}" stroke-width="1.2" opacity="0.35"/>
    
    ${qrEl}
    
    ${ctcEl}
    
    <rect x="0" y="${n(H-30)}" width="${W}" height="30" fill="${prim}" opacity="0.06"/>
    <text x="${n(W/2)}" y="${n(H-12)}" font-size="${n(H*.011)}" fill="${muted}" text-anchor="middle" opacity="0.55" class="label-text">Skoolar • School Management Platform</text>
  </svg>`;
}

function buildLandscapeModern(o:any):string {
  const {W,H,prim,primD,primL,sec,dark,muted,border,hdrTxt,pName,pId,pClass,pGend,pPhone,pRole,schN,schA,sPh,sEm,inits,phB64,phMime,qrB64,showQR,showPhoto,pType,isBack,backText,style,defs} = o;
  
  const hH = Math.round(H * 0.16); // Slightly taller header
  const mg = Math.round(H * 0.07);

  if(isBack){
    const bLines=(backText||'').split('\n').filter((l:string)=>l.trim());
    let secY=Math.round(H*0.28);
    const lh=Math.round(H*0.082);
    const sections=[
      {title:'CONTACT',lines:[schA,sPh,sEm].filter(Boolean)},
      {title:'IMPORTANT',lines:bLines}
    ].filter((s:any)=>s.lines.length>0);
    
    const sHtml=sections.map((sec:any)=>{
      const t=`<text x="${n(mg)}" y="${n(secY)}" font-size="${n(H*0.045)}" font-weight="700" fill="${prim}" letter-spacing="2" class="name-text">${sec.title}</text>
        <line x1="${n(mg)}" y1="${n(secY+12)}" x2="${n(W-mg)}" y2="${n(secY+12)}" stroke="${prim}" stroke-width="1.5" opacity="0.25"/>`;
      secY+=48;
      const lHtml=sec.lines.map((l:string)=>{
        const e=`<text x="${n(mg+18)}" y="${n(secY)}" font-size="${n(H*0.040)}" fill="${dark}" class="label-text">${esc(l)}</text>`;
        secY+=lh;
        return e;
      }).join('\n');
      secY+=18; 
      return t+'\n'+lHtml;
    }).join('\n');

    return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
      ${style}${defs}
      <rect width="${W}" height="${H}" fill="${sec}"/>
      <rect x="0" y="0" width="${W}" height="${n(hH)}" fill="url(#hg)"/>
      <text x="${n(W/2)}" y="${n(hH*.58)}" font-size="${n(H*.060)}" font-weight="700" fill="${hdrTxt}" text-anchor="middle" class="name-text">${schN}</text>
      <text x="${n(W/2)}" y="${n(hH*.88)}" font-size="${n(H*.034)}" fill="${hdrTxt}" text-anchor="middle" opacity="0.8" letter-spacing="2" class="label-text">IDENTIFICATION CARD — REVERSE</text>
      ${sHtml}
      <text x="${n(W/2)}" y="${n(H*.92)}" font-size="${n(H*.034)}" fill="${muted}" text-anchor="middle" opacity="0.7" class="label-text">If found, please return to the school office.</text>
      <rect x="0" y="${n(H-38)}" width="${W}" height="38" fill="${prim}" opacity="0.08"/>
      <text x="${n(W/2)}" y="${n(H-14)}" font-size="${n(H*.026)}" fill="${muted}" text-anchor="middle" opacity="0.55" class="label-text">Skoolar • School Management Platform</text>
    </svg>`;
  }

  const colQ = Math.round(W * 0.60);
  
  const photoR = Math.round(H * 0.24); // Larger photo
  const photoCX = Math.round(W * 0.10);
  const availableH = H - hH - Math.round(H * 0.08);
  const photoCY = Math.round(hH + Math.round(H * 0.04) + availableH / 2);
  
  const txtX = Math.round(W * 0.23);
  
  const nameY = Math.round(hH + Math.round(H * 0.05) + Math.round(availableH * 0.18));
  const nameFs = Math.round(H * 0.065); // Larger name
  
  const badgeY = Math.round(nameY + nameFs + Math.round(H * 0.015));
  const badgeW = Math.round((colQ - txtX - mg) * 0.55);
  const badgeH = Math.round(H * 0.060);
  
  const infoCardX = txtX;
  const infoCardY = Math.round(badgeY + badgeH + Math.round(H * 0.020));
  const infoCardW = colQ - txtX - mg;
  const infoCardH = Math.round(H * 0.28);
  
   const qrZW = W - colQ - mg;
   const qrSz = Math.round(Math.min(qrZW - Math.round(H * 0.02), availableH - Math.round(H * 0.06)));
   const qrX = Math.round(colQ + (qrZW - qrSz) / 2);
   const qrY = Math.round(hH + Math.round(H * 0.04) + (availableH - qrSz) / 2);
   const scanY = Math.round(qrY + qrSz + Math.round(H * 0.018));

  const rows:any[]=[];
  if(pType==='student'){
    rows.push({l:'Student ID:',v:pId});
    rows.push({l:'Class:',v:pClass});
    if(pGend)rows.push({l:'Gender:',v:pGend});
  }else{
    rows.push({l:'Staff ID:',v:pId});
    if(pRole)rows.push({l:'Role:',v:pRole});
    if(pPhone)rows.push({l:'Phone:',v:pPhone});
  }

  const rowStartY = infoCardY + Math.round(H * 0.035);
  const rowLH = Math.round(H * 0.065);
  const labelX = infoCardX + Math.round(infoCardW * 0.06);
  const valueX = infoCardX + Math.round(infoCardW * 0.44);
  const rowFs = Math.round(H * 0.032);
  
  const infoRowsHtml = rows.map((row,i)=>`
    <text x="${n(labelX)}" y="${n(rowStartY + i * rowLH)}" font-size="${n(rowFs)}" fill="${muted}" class="label-text">${row.l}</text>
    <text x="${n(valueX)}" y="${n(rowStartY + i * rowLH)}" font-size="${n(rowFs)}" font-weight="600" fill="${dark}" class="value-text">${row.v}</text>
  `).join('');

  const phEl = showPhoto ? photoCircleModern(photoCX, photoCY, photoR, prim, muted, phB64, phMime, inits, 'pc2') : '';
  
  let qrEl = '';
  if(showQR && qrB64){
    const qrPad = Math.round(H * 0.025);
    qrEl = `<g filter="url(#softshadow)">
      <rect x="${n(qrX - qrPad + 2)}" y="${n(qrY - qrPad + 2)}" width="${n(qrSz + qrPad * 2 - 4)}" height="${n(qrSz + qrPad * 2 + Math.round(H * 0.04) - 4)}" rx="12" fill="#ffffff" stroke="${border}" stroke-width="1.5"/>
    </g>
    <rect x="${n(qrX - qrPad + 6)}" y="${n(qrY - qrPad + 6)}" width="${n(qrSz + qrPad * 2 - 12)}" height="${n(qrSz + qrPad * 2 + Math.round(H * 0.04) - 12)}" rx="8" fill="#fafafa"/>
    <image x="${n(qrX)}" y="${n(qrY)}" width="${n(qrSz)}" height="${n(qrSz)}" href="data:image/png;base64,${qrB64}"/>
    <text x="${n(colQ + qrZW/2)}" y="${n(scanY)}" font-size="${n(H*.032)}" font-weight="700" fill="${prim}" text-anchor="middle" letter-spacing="2" class="name-text">SCAN TO VERIFY</text>`;
  }

  const sepEl = `<line x1="${n(colQ - mg/2)}" y1="${n(hH + Math.round(H * 0.03))}" x2="${n(colQ - mg/2)}" y2="${n(H - Math.round(H * 0.04))}" stroke="${border}" stroke-width="1.2" opacity="0.3"/>`;

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    ${style}${defs}
    
    <rect width="${W}" height="${H}" fill="${sec}"/>
    
    <circle cx="${n(W*.04)}" cy="${n(H*.28)}" r="${n(H*.52)}" fill="${prim}" opacity="0.022"/>
    
    <rect x="2" y="2" width="${n(W-4)}" height="${n(H-4)}" rx="16" fill="none" stroke="${border}" stroke-width="2" opacity="0.3"/>
    
    <rect x="0" y="0" width="${W}" height="${n(hH)}" fill="url(#hg)"/>
    
    <path d="M0 ${n(hH)} Q${n(W*.20)} ${n(hH+12)} ${n(W*.50)} ${n(hH+4)} Q${n(W*.80)} ${n(hH-5)} ${W} ${n(hH)}" fill="${prim}" opacity="0.4"/>
    
    <text x="${n(mg)}" y="${n(hH*.58)}" font-size="${n(H*.060)}" font-weight="700" fill="${hdrTxt}" class="name-text">${schN}</text>
    <text x="${n(W-mg)}" y="${n(hH*.58)}" font-size="${n(H*.038)}" font-weight="600" fill="${hdrTxt}" text-anchor="end" opacity="0.9" letter-spacing="2" class="value-text">ID CARD</text>
    
    ${phEl}
    
    ${sepEl}
    
    <text x="${n(txtX)}" y="${n(nameY)}" font-size="${n(nameFs)}" font-weight="700" fill="${dark}" class="name-text">${pName}</text>
    
    <g filter="url(#shadow)">
      <rect x="${n(txtX)}" y="${n(badgeY)}" width="${n(badgeW)}" height="${n(badgeH)}" rx="${n(badgeH/2)}" fill="${prim}" opacity="0.14"/>
    </g>
    <text x="${n(txtX + badgeW/2)}" y="${n(badgeY + badgeH*0.68)}" font-size="${n(H*.036)}" font-weight="700" fill="${prim}" text-anchor="middle" letter-spacing="1" class="name-text">${pRole}</text>
    
    ${infoCard(infoCardX, infoCardY, infoCardW, infoCardH, sec, border, infoRowsHtml)}
    
    ${qrEl}
    
    <rect x="0" y="${n(H-38)}" width="${W}" height="38" fill="${prim}" opacity="0.06"/>
    <text x="${n(W/2)}" y="${n(H-14)}" font-size="${n(H*.026)}" fill="${muted}" text-anchor="middle" opacity="0.55" class="label-text">Skoolar • School Management Platform</text>
  </svg>`;
}
