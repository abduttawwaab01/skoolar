import QRCode from 'qrcode';
import { Resvg } from '@resvg/resvg-wasm';
import { db } from '@/lib/db';
import { GEIST_REGULAR_BASE64, GEIST_FONT_FAMILY } from './geist-font-data';
import { ensureResvgInit } from './init-resvg';
import https from 'node:https';
import http from 'node:http';
import sharp from 'sharp';

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
  await ensureResvgInit();
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
        type:pType, id:person.displayId||person.admissionNo||person.employeeNo||'N/A',
        userId:person.userId||'', personId:person.id||person.personId||'',
        schoolId:person.schoolId||'', name:person.name||'', role, ts:Date.now()
      }),{width:port?360:480,margin:1,color:{dark:prim,light:'#ffffff'},errorCorrectionLevel:'H'});
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

  const pName  = trunc(esc(person.name||'Unknown'), port?22:30);
  const pId    = esc(person.displayId||person.admissionNo||person.employeeNo||'N/A');
  const pClass = esc(person.class||'N/A');
  const pGend  = esc(person.gender||'');
  const pPhone = esc(person.phone||'');
  const pRole  = esc(role);
  const schN   = trunc(esc(sName), port?26:34);
  const schA   = trunc(esc(sAddr),50);
  const inits  = esc((person.name||'NA').split(' ').map((x:string)=>x[0]||'').join('').slice(0,2).toUpperCase());

  let phBuf: Buffer | null = null;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://skoolar.org';
  const pUrl = photoUrl || '';
  console.log(`renderIDCard: showPhoto=${showPhoto} photoUrl=${pUrl.substring(0,100)}`);
  if(showPhoto&&photoUrl){
    try{
      const url=photoUrl.startsWith('//')?`https:${photoUrl}`:photoUrl.startsWith('http')?photoUrl:`${baseUrl}${photoUrl}`;
      const mod = url.startsWith('https') ? https : http;
      const buf = await new Promise<{data:Buffer;ct:string}>((resolve,reject)=>{
        const req=mod.get(url,{timeout:8000,headers:{'Accept':'image/*'}},(res)=>{
          const ct=res.headers['content-type']||'image/jpeg';
          if(!res.statusCode||res.statusCode<200||res.statusCode>=300){
            reject(new Error(`HTTP ${res.statusCode}`)); return;
          }
          const chunks:Buffer[]=[];
          res.on('data',(c:Buffer)=>chunks.push(c));
          res.on('end',()=>resolve({data:Buffer.concat(chunks),ct}));
        });
        req.on('timeout',()=>{req.destroy(); reject(new Error('timeout'));});
        req.on('error',reject);
      });
      if(buf.ct.startsWith('image/') && buf.data.length>0 && buf.data.length<=5*1024*1024){
        phBuf = buf.data;
      }else{
        console.warn(`ID card photo invalid: ct=${buf.ct} size=${buf.data.length} for ${url.substring(0,100)}`);
      }
    }catch(phErr){
      console.warn(`ID card photo fetch exception for ${pUrl.substring(0,100)}:`, phErr);
    }
  }

  const phB64=''; const phMime='image/jpeg';

  const FF = `'${GEIST_FONT_FAMILY}', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif`;
  
  const style = `<style>
    * { font-family: ${FF}; }
    text { font-family: ${FF}; }
    .text-light { fill: ${hdrTxt}; }
    .text-dark { fill: ${dark}; }
    .text-muted { fill: ${muted}; }
    .text-primary { fill: ${prim}; }
    .name-text { font-weight: 700; }
    .label-text { font-weight: 400; }
    .value-text { font-weight: 600; }
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
    <filter id="watermark-shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="1" dy="1" stdDeviation="1" flood-color="#000" flood-opacity="0.08"/>
    </filter>
  </defs>`;

  const svg = port 
    ? buildPortrait({W,H,prim,primD,primL,sec,dark,muted,border,hdrTxt,pName,pId,pClass,pGend,pPhone,pRole,schN,schA,sPh,sEm,inits,phB64,phMime,qrB64,showQR,showPhoto,pType,isBack,backText,style,defs})
    : buildLandscape({W,H,prim,primD,primL,sec,dark,muted,border,hdrTxt,pName,pId,pClass,pGend,pPhone,pRole,schN,schA,sPh,sEm,inits,phB64,phMime,qrB64,showQR,showPhoto,pType,isBack,backText,style,defs});

  const geistBuffer = Buffer.from(GEIST_REGULAR_BASE64, 'base64');

  try {
    const resvg = new Resvg(svg, {
      background: 'white',
      fitTo: { mode: 'width', value: W },
      font: {
        fontBuffers: [new Uint8Array(geistBuffer)],
        defaultFontFamily: GEIST_FONT_FAMILY,
      },
    });

    let png: Buffer = Buffer.from(resvg.render().asPng());

    // Composite photo onto card using sharp (resvg doesn't reliably render data URIs)
    if (phBuf && showPhoto) {
      try {
        const r = port ? 114 : 94;
        const cx = port ? Math.round(W / 2) : 44 + r + 2;
        const cy = port ? 258 : 351;
        const d = r * 2;
        const circle = await sharp(Buffer.from(`<svg><circle cx="${d/2}" cy="${d/2}" r="${r}" fill="white"/></svg>`))
          .resize(d, d).png().toBuffer();
        const photo = await sharp(phBuf).resize(d, d, { fit: 'cover' }).png().toBuffer();
        const masked = await sharp(photo).composite([{ input: circle, blend: 'dest-in' }]).png().toBuffer();
        png = Buffer.from(await sharp(png).composite([{ input: masked, top: cy - r, left: cx - r }]).png().toBuffer());
      } catch (ce) {
        console.warn('Photo compositing failed:', ce);
      }
    }

    return png;
  } catch (err) {
    console.error('Resvg rendering error:', err);
    throw new Error(`Failed to render ID card: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
}

function photoCircle(cx:number,cy:number,r:number,prim:string,muted:string,inits:string,id:string):string {
  return `<defs><clipPath id="${id}"><circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}"/></clipPath></defs>
    <circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r+12)}" fill="${prim}" opacity="0.12"/>
    <circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r+4)}" fill="#ffffff"/>
    <circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r+2)}" fill="none" stroke="${prim}" stroke-width="3" opacity="0.5"/>
    <circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="${prim}" opacity="0.04"/>
    <text x="${n(cx)}" y="${n(cy)}" font-size="${n(r*0.7)}" font-weight="700" fill="${prim}" opacity="0.35" 
      text-anchor="middle" dominant-baseline="middle">${inits}</text>`;
}

function dataCard(x:number,y:number,w:number,h:number,sec:string,border:string,content:string):string {
  return `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="14" 
    fill="${adj(sec,-5)}" stroke="${border}" stroke-width="1" opacity="0.45"/>
  ${content}`;
}

// ─── WATERMARK ──────────────────────────────────────────────────────────────
function watermarkBack(W:number,H:number,prim:string):string {
  const angle = Math.atan2(H,W)*(180/Math.PI);
  const size = Math.min(W,H)*0.032;
  return `
    <g opacity="0.12" pointer-events="none" filter="url(#watermark-shadow)">
      <text x="${n(W/2)}" y="${n(H/2)}" font-size="${n(size)}" font-weight="700"
        fill="${prim}" text-anchor="middle" dominant-baseline="middle"
        transform="rotate(${n(-angle)}, ${n(W/2)}, ${n(H/2)})"
        letter-spacing="4">Odebunmi Tawwab</text>
      <text x="${n(W/2)}" y="${n(H/2+size*1.4)}" font-size="${n(size*0.55)}" font-weight="400"
        fill="${prim}" text-anchor="middle" dominant-baseline="middle"
        transform="rotate(${n(-angle)}, ${n(W/2)}, ${n(H/2+size*1.4)})"
        letter-spacing="6">SKOOLAR</text>
    </g>`;
}

// ─── PORTRAIT LAYOUT (53.98×85.6mm @300dpi = 638×1011px) ──────────────────
function buildPortrait(o:any):string {
  const {W,H,prim,primD,primL,sec,dark,muted,border,hdrTxt,pName,pId,pClass,pGend,pPhone,pRole,schN,schA,sPh,sEm,inits,phB64,phMime,qrB64,showQR,showPhoto,pType,isBack,backText,style,defs} = o;

  const hH = 132;
  const mg = 38;
  const footerH = 34;

  if(isBack){
    const bLines=(backText||'').split('\n').filter((l:string)=>l.trim());
    let secY=Math.round(H*0.22);
    const lh=Math.round(H*0.028);
    const sections=[
      {title:'CONTACT',lines:[schA,sPh,sEm].filter(Boolean)},
      {title:'IMPORTANT',lines:bLines}
    ].filter(s=>s.lines.length>0);

    const sHtml=sections.map((sec:any)=>{
      const t=`<text x="${n(mg)}" y="${n(secY)}" font-size="${n(H*0.020)}" font-weight="700" fill="${prim}" letter-spacing="2">${sec.title}</text>
        <line x1="${n(mg)}" y1="${n(secY+12)}" x2="${n(W-mg)}" y2="${n(secY+12)}" stroke="${prim}" stroke-width="1.5" opacity="0.2"/>`;
      secY+=40;
      const lHtml=sec.lines.map((l:string)=>{
        const e=`<text x="${n(mg+15)}" y="${n(secY)}" font-size="${n(H*0.016)}" fill="${dark}">${esc(l)}</text>`;
        secY+=lh;
        return e;
      }).join('\n');
      secY+=12; 
      return t+'\n'+lHtml;
    }).join('\n');

    return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
      ${style}${defs}
      <rect width="${W}" height="${H}" fill="${sec}"/>
      <rect x="0" y="0" width="${W}" height="${n(hH)}" fill="url(#hg)"/>
      <path d="M0 ${n(hH)} Q${n(W*.20)} ${n(hH+10)} ${n(W*.50)} ${n(hH+4)} Q${n(W*.80)} ${n(hH-4)} ${W} ${n(hH)}" fill="${prim}" opacity="0.35"/>
      <circle cx="${n(W*.06)}" cy="${n(H*.12)}" r="${n(W*.40)}" fill="${prim}" opacity="0.025"/>
      <circle cx="${n(W*.94)}" cy="${n(H*.85)}" r="${n(W*.25)}" fill="${prim}" opacity="0.02"/>
      <text x="${n(W/2)}" y="${n(hH*0.54)}" font-size="${n(H*.028)}" font-weight="700" fill="${hdrTxt}" text-anchor="middle">${schN}</text>
      <text x="${n(W/2)}" y="${n(hH*0.84)}" font-size="${n(H*.015)}" fill="${hdrTxt}" text-anchor="middle" opacity="0.8" letter-spacing="2">IDENTIFICATION CARD — REVERSE</text>
      ${watermarkBack(W,H,prim)}
      ${sHtml}
      <text x="${n(W/2)}" y="${n(H*0.94)}" font-size="${n(H*.013)}" fill="${muted}" text-anchor="middle" opacity="0.65">If found, please return to the school office.</text>
      <rect x="0" y="${n(H-footerH)}" width="${W}" height="${footerH}" fill="${prim}" opacity="0.06"/>
      <text x="${n(W/2)}" y="${n(H-footerH+20)}" font-size="${n(H*.010)}" fill="${muted}" text-anchor="middle" opacity="0.5">Skoolar • School Management Platform</text>
    </svg>`;
  }

  // Front - Portrait
  const photoR = 114;
  const photoCX = Math.round(W/2);
  const photoCY = hH + 126;
  const txtX = Math.round(W/2);

  const nameY = photoCY + photoR + 40;
  const nameFs = 38;

  const badgeY = nameY + 22;
  const badgeW = 268;
  const badgeH = 34;
  const badgeX = Math.round((W - badgeW) / 2);

  const infoCardX = mg;
  const infoCardY = badgeY + badgeH + 24;
  const infoCardW = W - mg * 2;
  const infoCardH = 182;

  // QR positioned closer to info card, slightly larger
  const qrSz = 216;
  const qrPad = 10;
  const qrBW = qrSz + qrPad * 2;
  const qrBX = Math.round((W - qrBW) / 2);
  const qrBY = infoCardY + infoCardH + 24;
  const qrIX = qrBX + qrPad;
  const qrIY = qrBY + qrPad;
  const qrBH = qrSz + qrPad * 2 + 30;
  const scanY = qrIY + qrSz + 26;

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

  const rowStartY = infoCardY + 36;
  const rowLH = 38;
  const labelX = infoCardX + Math.round(infoCardW * 0.08);
  const valueX = infoCardX + Math.round(infoCardW * 0.46);
  const rowFs = 18;

  const infoRowsHtml = rows.map((row,i)=>`
    <text x="${n(labelX)}" y="${n(rowStartY + i * rowLH)}" font-size="${n(rowFs)}" fill="${muted}">${row.l}</text>
    <text x="${n(valueX)}" y="${n(rowStartY + i * rowLH)}" font-size="${n(rowFs)}" font-weight="600" fill="${dark}">${row.v}</text>
  `).join('');

  const phEl = showPhoto ? photoCircle(photoCX, photoCY, photoR, prim, muted, inits, 'pc1') : '';

  let qrEl = '';
  if(showQR && qrB64){
    qrEl = `<g filter="url(#softshadow)">
      <rect x="${n(qrBX)}" y="${n(qrBY)}" width="${n(qrBW)}" height="${n(qrBH)}" rx="18" fill="#ffffff" stroke="${border}" stroke-width="1.5"/>
    </g>
    <rect x="${n(qrBX+4)}" y="${n(qrBY+4)}" width="${n(qrBW-8)}" height="${n(qrBH-8)}" rx="14" fill="#fafafa"/>
    <image x="${n(qrIX)}" y="${n(qrIY)}" width="${n(qrSz)}" height="${n(qrSz)}" href="data:image/png;base64,${qrB64}"/>
    <text x="${n(W/2)}" y="${n(scanY)}" font-size="${n(22)}" font-weight="700" fill="${prim}" text-anchor="middle" letter-spacing="3">SCAN TO VERIFY</text>`;
  }

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    ${style}${defs}
    
    <rect width="${W}" height="${H}" fill="${sec}"/>
    
    <circle cx="${n(30)}" cy="${n(80)}" r="${n(270)}" fill="${prim}" opacity="0.03"/>
    <circle cx="${n(W-30)}" cy="${n(H-80)}" r="${n(180)}" fill="${prim}" opacity="0.025"/>
    
    <rect x="2" y="2" width="${n(W-4)}" height="${n(H-4)}" rx="20" fill="none" stroke="${border}" stroke-width="2.5" opacity="0.35"/>
    
    <rect x="0" y="0" width="${W}" height="${n(hH)}" fill="url(#hg)"/>
    
    <path d="M0 ${n(hH)} Q${n(W*.20)} ${n(hH+10)} ${n(W*.50)} ${n(hH+4)} Q${n(W*.80)} ${n(hH-4)} ${W} ${n(hH)}" fill="${prim}" opacity="0.4"/>
    
    <text x="${n(mg)}" y="${n(hH*0.54)}" font-size="${n(H*.028)}" font-weight="700" fill="${hdrTxt}">${schN}</text>
    <text x="${n(W-mg)}" y="${n(hH*0.54)}" font-size="${n(H*.017)}" font-weight="600" fill="${hdrTxt}" text-anchor="end" opacity="0.9" letter-spacing="2">ID CARD</text>
    
    ${phEl}
    
    <text x="${n(txtX)}" y="${n(nameY)}" font-size="${n(nameFs)}" font-weight="700" fill="${dark}" text-anchor="middle">${pName}</text>
    
    <g filter="url(#shadow)">
      <rect x="${n(badgeX)}" y="${n(badgeY)}" width="${n(badgeW)}" height="${n(badgeH)}" rx="${n(badgeH/2)}" fill="${prim}" opacity="0.12"/>
    </g>
    <text x="${n(badgeX + badgeW/2)}" y="${n(badgeY + badgeH*0.68)}" font-size="${n(20)}" font-weight="700" fill="${prim}" text-anchor="middle" letter-spacing="1">${pRole}</text>
    
    ${dataCard(infoCardX, infoCardY, infoCardW, infoCardH, sec, border, infoRowsHtml)}
    
    ${qrEl}
    
    <rect x="0" y="${n(H-footerH)}" width="${W}" height="${footerH}" fill="${prim}" opacity="0.05"/>
    <text x="${n(W/2)}" y="${n(H-footerH+20)}" font-size="${n(H*.010)}" fill="${muted}" text-anchor="middle" opacity="0.5">Skoolar • School Management Platform</text>
  </svg>`;
}

// ─── LANDSCAPE LAYOUT (85.6×53.98mm @300dpi = 1011×638px) ─────────────────
function buildLandscape(o:any):string {
  const {W,H,prim,primD,primL,sec,dark,muted,border,hdrTxt,pName,pId,pClass,pGend,pPhone,pRole,schN,schA,sPh,sEm,inits,phB64,phMime,qrB64,showQR,showPhoto,pType,isBack,backText,style,defs} = o;

  const hH = 102;
  const mg = 44;
  const footerH = 36;

  if(isBack){
    const bLines=(backText||'').split('\n').filter((l:string)=>l.trim());
    let secY=Math.round(H*0.26);
    const lh=Math.round(H*0.075);
    const sections=[
      {title:'CONTACT',lines:[schA,sPh,sEm].filter(Boolean)},
      {title:'IMPORTANT',lines:bLines}
    ].filter((s:any)=>s.lines.length>0);

    const sHtml=sections.map((sec:any)=>{
      const t=`<text x="${n(mg)}" y="${n(secY)}" font-size="${n(H*0.048)}" font-weight="700" fill="${prim}" letter-spacing="2">${sec.title}</text>
        <line x1="${n(mg)}" y1="${n(secY+12)}" x2="${n(W-mg)}" y2="${n(secY+12)}" stroke="${prim}" stroke-width="1.5" opacity="0.2"/>`;
      secY+=44;
      const lHtml=sec.lines.map((l:string)=>{
        const e=`<text x="${n(mg+18)}" y="${n(secY)}" font-size="${n(H*0.038)}" fill="${dark}">${esc(l)}</text>`;
        secY+=lh;
        return e;
      }).join('\n');
      secY+=14; 
      return t+'\n'+lHtml;
    }).join('\n');

    return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
      ${style}${defs}
      <rect width="${W}" height="${H}" fill="${sec}"/>
      <rect x="0" y="0" width="${W}" height="${n(hH)}" fill="url(#hg)"/>
      <path d="M0 ${n(hH)} Q${n(W*.15)} ${n(hH+8)} ${n(W*.50)} ${n(hH+3)} Q${n(W*.85)} ${n(hH-3)} ${W} ${n(hH)}" fill="${prim}" opacity="0.3"/>
      <circle cx="${n(W*.06)}" cy="${n(H*.30)}" r="${n(H*.45)}" fill="${prim}" opacity="0.02"/>
      <text x="${n(W/2)}" y="${n(hH*0.54)}" font-size="${n(H*.065)}" font-weight="700" fill="${hdrTxt}" text-anchor="middle">${schN}</text>
      <text x="${n(W/2)}" y="${n(hH*0.84)}" font-size="${n(H*.036)}" fill="${hdrTxt}" text-anchor="middle" opacity="0.8" letter-spacing="2">IDENTIFICATION CARD — REVERSE</text>
      ${watermarkBack(W,H,prim)}
      ${sHtml}
      <text x="${n(W/2)}" y="${n(H*0.93)}" font-size="${n(H*.032)}" fill="${muted}" text-anchor="middle" opacity="0.65">If found, please return to the school office.</text>
      <rect x="0" y="${n(H-footerH)}" width="${W}" height="${footerH}" fill="${prim}" opacity="0.06"/>
      <text x="${n(W/2)}" y="${n(H-footerH+22)}" font-size="${n(H*.024)}" fill="${muted}" text-anchor="middle" opacity="0.5">Skoolar • School Management Platform</text>
    </svg>`;
  }

  // Front - Landscape — 2 columns: photo+details (L), QR code (R)
  const colSep = Math.round(W * 0.62);    // left column ~62%, right ~38%

  const contentPadT = hH + 16;           // top of content below header
  const contentH = H - contentPadT - footerH - 18;

  // ═══ Left column: photo + name + details ═══
  const photoR = 94;
  const photoCX = mg + photoR + 2;
  const photoCY = contentPadT + Math.round(contentH / 2);

  // Text block positioned to the right of photo
  const textX = photoCX + photoR + 16;

  const nameY = photoCY - 62;             // above photo center
  const nameFs = 30;

  const badgeY = nameY + nameFs + 4;
  const badgeH = 26;
  const badgeW = Math.min(220, colSep - textX - mg);

  // Info rows below badge
  const infoY = badgeY + badgeH + 12;
  const rowLH = 34;
  const rowFs = 17;

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

  const infoRowsHtml = rows.map((row,i)=>`
    <text x="${n(textX)}" y="${n(infoY + i * rowLH)}" font-size="${n(rowFs)}" fill="${muted}">${row.l}</text>
    <text x="${n(textX + Math.round(colSep * 0.18))}" y="${n(infoY + i * rowLH)}" font-size="${n(rowFs)}" font-weight="600" fill="${dark}">${row.v}</text>
  `).join('');

  const phEl = showPhoto ? photoCircle(photoCX, photoCY, photoR, prim, muted, inits, 'pc2') : '';

  // ═══ Right column: QR code ═══
  const qrZW = W - colSep - mg;
  const qrSz = Math.min(qrZW - 28, contentH - 60);
  const qrX = colSep + Math.round((qrZW - qrSz) / 2);
  const qrY = contentPadT + Math.round((contentH - qrSz) / 2) - 8;
  const scanY = qrY + qrSz + 22;

  let qrEl = '';
  if(showQR && qrB64){
    const qrPadL = 12;
    qrEl = `<g filter="url(#softshadow)">
      <rect x="${n(qrX - qrPadL + 2)}" y="${n(qrY - qrPadL + 2)}" width="${n(qrSz + qrPadL * 2 - 4)}" height="${n(qrSz + qrPadL * 2 + 32 - 4)}" rx="16" fill="#ffffff" stroke="${border}" stroke-width="1.5"/>
    </g>
    <rect x="${n(qrX - qrPadL + 6)}" y="${n(qrY - qrPadL + 6)}" width="${n(qrSz + qrPadL * 2 - 12)}" height="${n(qrSz + qrPadL * 2 + 32 - 12)}" rx="12" fill="#fafafa"/>
    <image x="${n(qrX)}" y="${n(qrY)}" width="${n(qrSz)}" height="${n(qrSz)}" href="data:image/png;base64,${qrB64}"/>
    <text x="${n(colSep + Math.round(qrZW/2))}" y="${n(scanY)}" font-size="${n(18)}" font-weight="700" fill="${prim}" text-anchor="middle" letter-spacing="1">SCAN TO VERIFY</text>`;
  }

  // Vertical divider between columns
  const sepEl = `<line x1="${n(colSep)}" y1="${n(contentPadT + 4)}" x2="${n(colSep)}" y2="${n(H - footerH - 6)}" stroke="${border}" stroke-width="1.2" opacity="0.25"/>`;

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    ${style}${defs}
    
    <rect width="${W}" height="${H}" fill="${sec}"/>
    
    <circle cx="${n(40)}" cy="${n(H*0.28)}" r="${n(H*0.48)}" fill="${prim}" opacity="0.022"/>
    
    <rect x="2" y="2" width="${n(W-4)}" height="${n(H-4)}" rx="20" fill="none" stroke="${border}" stroke-width="2.5" opacity="0.35"/>
    
    <rect x="0" y="0" width="${W}" height="${n(hH)}" fill="url(#hg)"/>
    
    <path d="M0 ${n(hH)} Q${n(W*.15)} ${n(hH+8)} ${n(W*.50)} ${n(hH+3)} Q${n(W*.85)} ${n(hH-3)} ${W} ${n(hH)}" fill="${prim}" opacity="0.3"/>
    
    <text x="${n(mg)}" y="${n(hH*0.54)}" font-size="${n(H*.060)}" font-weight="700" fill="${hdrTxt}">${schN}</text>
    <text x="${n(W-mg)}" y="${n(hH*0.54)}" font-size="${n(H*.040)}" font-weight="600" fill="${hdrTxt}" text-anchor="end" opacity="0.9" letter-spacing="2">ID CARD</text>
    
    ${sepEl}
    
    ${phEl}
    
    <!-- Name -->
    <text x="${n(textX)}" y="${n(nameY)}" font-size="${n(nameFs)}" font-weight="700" fill="${dark}">${pName}</text>
    
    <!-- Role badge -->
    <g filter="url(#shadow)">
      <rect x="${n(textX)}" y="${n(badgeY)}" width="${n(badgeW)}" height="${n(badgeH)}" rx="${n(badgeH/2)}" fill="${prim}" opacity="0.12"/>
    </g>
    <text x="${n(textX + badgeW/2)}" y="${n(badgeY + badgeH*0.66)}" font-size="${n(16)}" font-weight="700" fill="${prim}" text-anchor="middle" letter-spacing="1">${pRole}</text>
    
    <!-- Info rows -->
    ${infoRowsHtml}
    
    ${qrEl}
    
    <rect x="0" y="${n(H-footerH)}" width="${W}" height="${footerH}" fill="${prim}" opacity="0.05"/>
    <text x="${n(W/2)}" y="${n(H-footerH+22)}" font-size="${n(H*.024)}" fill="${muted}" text-anchor="middle" opacity="0.5">Skoolar • School Management Platform</text>
  </svg>`;
}
