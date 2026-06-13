import QRCode from 'qrcode';
import { Resvg } from '@resvg/resvg-wasm';
import { db } from '@/lib/db';
import { GEIST_REGULAR_BASE64, GEIST_FONT_FAMILY } from './geist-font-data';
import { ARABIC_FONT_BASE64, ARABIC_FONT_FAMILY } from './arabic-font-data';
import { ensureResvgInit } from './init-resvg';
import https from 'node:https';
import http from 'node:http';
import sharp from 'sharp';

const MM = (mm: number) => Math.round((mm / 25.4) * 600);
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
const hasArabic = (text: string): boolean => /[\u0600-\u06FF]/.test(text);
function rtlAttr(text: string): string {
  return hasArabic(text) ? ' direction="rtl" unicode-bidi="bidi-override"' : '';
}
function wrapToLines(text: string, maxChars: number): string[] {
  if (!text || text.length <= maxChars) return [text];
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? line + ' ' + word : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.flatMap(l => l.length > maxChars ? (l.match(new RegExp(`.{1,${maxChars}}`,'g')) || [l]) : [l]);
}
function renderWrapped(x: number, y: number, fontSize: number, color: string, lines: string[], anchor: string, rtl: string, lineGap: number): string {
  return lines.map((l, i) =>
    `<text x="${n(x)}" y="${n(y + i * (fontSize + lineGap))}" font-size="${n(fontSize)}" font-weight="700" fill="${color}" text-anchor="${anchor}"${rtl}>${l}</text>`
  ).join('\n');
}
function fitName(text: string, maxWidthChars: number, baseFs: number, minFs: number): { lines: string[], fontSize: number } {
  if (!text) return { lines: ['Unknown'], fontSize: baseFs };
  for (let fs = baseFs; fs >= minFs; fs -= 2) {
    const charsPerLine = Math.max(Math.round(maxWidthChars * (baseFs / fs)), 8);
    const lines = wrapToLines(text, charsPerLine);
    if (lines.length <= 2) return { lines, fontSize: fs };
  }
  const charsPerLine = Math.max(Math.round(maxWidthChars * (baseFs / minFs)), 8);
  return { lines: wrapToLines(text, charsPerLine), fontSize: minFs };
}

export async function renderIDCard(
  person: any,
  colors:{primary:string;secondary:string},
  backText:string,
  showPhoto:boolean,
  showQR:boolean,
  orientation:string,
  photoUrl:string|null,
  role:string,
  isBack=false,
  // optional flags from client preview
  showBarcode = true,
  showSignature = false,
  showLogo = true,
  issueDate: string | null = null,
  expiryDate: string | null = null,
  watermarkText: string | null = null,
  signatureUrl: string | null = null
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

  let sName='School',sAddr='',sPh='',sEm='', sLogo: string | null = null;
  if(person.schoolId){
    try{
      const s=await db.school.findUnique({where:{id:person.schoolId},select:{name:true,address:true,phone:true,email:true,logo:true}});
      if(s){
        sName=s.name||'School';
        sAddr=s.address||'';
        sPh=s.phone||'';
        sEm=s.email||'';
        if ((s as any).logo) sLogo = (s as any).logo;
      }
    }catch(_){}
  }

  const rawName = person.name||'Unknown';
  const rawId = person.displayId||person.admissionNo||person.employeeNo||'N/A';
  const pName  = esc(rawName);
  const pId    = esc(rawId);
  const pClass = esc(person.class||'N/A');
  const pGend  = esc(person.gender||'');
  const pPhone = esc(person.phone||'');
  const pRole  = esc(role);
  const schN   = esc(sName);
  const schA   = esc(sAddr);
  const inits  = esc(rawName.split(' ').map((x:string)=>x[0]||'').join('').slice(0,2).toUpperCase());

  // Replace placeholders in backText to match client-side behavior
  if (backText) {
    backText = backText
      .replace(/\{name\}/gi, rawName)
      .replace(/\{id\}/gi, rawId)
      .replace(/\{company\}/gi, sName);
  }

  let phBuf: Buffer | null = null;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://skoolar.org';
  const pUrl = photoUrl || '';
  console.log(`renderIDCard: showPhoto=${showPhoto} photoUrl=${pUrl.substring(0,100)}`);
  if(showPhoto&&photoUrl){
    try{
      if (photoUrl.startsWith('data:')) {
        const match = /^data:([^;]+);base64,(.+)$/i.exec(photoUrl);
        if (match) {
          phBuf = Buffer.from(match[2], 'base64');
        }
      } else {
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
      }
    }catch(phErr){
      console.warn(`ID card photo fetch exception for ${pUrl.substring(0,100)}:`, phErr);
    }
  }

  const FF = `'${ARABIC_FONT_FAMILY}', '${GEIST_FONT_FAMILY}', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif`;
  
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
    .rtl { direction: rtl; unicode-bidi: bidi-override; }
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
    ? buildPortrait({
        W,H,prim,primD,primL,sec,dark,muted,border,hdrTxt,pName,pId,pClass,pGend,pPhone,pRole,schN,schA,sPh,sEm,inits,qrB64,showQR,showPhoto,pType,isBack,backText,style,defs,
        showBarcode, showSignature, showLogo, issueDate, expiryDate, watermarkText, signatureUrl, sLogo
      })
    : buildLandscape({
        W,H,prim,primD,primL,sec,dark,muted,border,hdrTxt,pName,pId,pClass,pGend,pPhone,pRole,schN,schA,sPh,sEm,inits,qrB64,showQR,showPhoto,pType,isBack,backText,style,defs,
        showBarcode, showSignature, showLogo, issueDate, expiryDate, watermarkText, signatureUrl, sLogo
      });

  const geistBuffer = Buffer.from(GEIST_REGULAR_BASE64, 'base64');
  const arabicBuffer = Buffer.from(ARABIC_FONT_BASE64, 'base64');

  try {
    const resvg = new Resvg(svg, {
      background: 'white',
      fitTo: { mode: 'width', value: W },
      font: {
        fontBuffers: [new Uint8Array(arabicBuffer), new Uint8Array(geistBuffer)],
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
function watermarkBack(W:number,H:number,prim:string,schN:string):string {
  const size = Math.min(W,H)*0.028;
  return `
    <g opacity="0.06" pointer-events="none">
      <text x="${n(W/2)}" y="${n(H*0.35)}" font-size="${n(size)}" font-weight="300"
        fill="${prim}" text-anchor="middle" dominant-baseline="middle"
        letter-spacing="4">${schN}</text>
      <text x="${n(W/2)}" y="${n(H*0.65)}" font-size="${n(size*0.55)}" font-weight="300"
        fill="${prim}" text-anchor="middle" dominant-baseline="middle"
        letter-spacing="6">SKOOLAR</text>
    </g>`;
}

// ─── PORTRAIT LAYOUT (53.98×85.6mm @300dpi = 638×1011px) ──────────────────
function buildPortrait(o:any):string {
  const {W,H,prim,primD,primL,sec,dark,muted,border,hdrTxt,pName,pId,pClass,pGend,pPhone,pRole,schN,schA,sPh,sEm,inits,qrB64,showQR,showPhoto,pType,isBack,backText,style,defs,
    showBarcode, showSignature, showLogo, issueDate, expiryDate, watermarkText, signatureUrl, sLogo } = o;

  const hH = 132;
  const mg = 38;
  const footerH = 34;

  if(isBack){
    const bLines=(backText||'').split('\n').filter((l:string)=>l.trim());
    const wrapL = (lines: string[], max: number) => lines.flatMap(l => wrapToLines(esc(l), max));
    const contactParts = [schA, sPh, sEm].filter(Boolean);
    const impLines = wrapL(bLines, 36);
    const conLines = wrapL(contactParts, 36);

    // ── Layout zones ──
    // Header zone:       0 → hH
    // Decorative ribbon: hH → hH+18
    // Editable info:     hH+42 → H*0.58
    // School info:       H*0.64 → H*0.84
    // "If found":        H*0.88 → H*0.93
    // Footer:            H-footerH → H

    const ribbonH = 18;
    const ribbonY = hH;

    const infoStartY = hH + 42;
    const infoEndY = Math.round(H * 0.56);
    const infoAvailY = infoEndY - infoStartY - 8;
    const impTitleFs = Math.round(H * 0.016);
    const impLh = impLines.length ? Math.max(20, Math.min(Math.round(infoAvailY / Math.max(impLines.length, 1)), Math.round(H * 0.028))) : 22;
    const impLineFs = Math.min(Math.round(H * 0.015), Math.round(impLh * 0.62));

    // School info (bottom using secondary)
    const secBgY = Math.round(H * 0.60);
    const secBgH = Math.round(H * 0.28);
    const conTitleY = secBgY + 14;
    const conTitleFs = Math.round(H * 0.014);
    const conLineYStart = conTitleY + 20;
    const conLh = conLines.length ? Math.max(18, Math.min(Math.round((secBgH - 34) / Math.max(conLines.length, 1)), Math.round(H * 0.022))) : 20;
    const conLineFs = Math.min(Math.round(H * 0.012), Math.round(conLh * 0.58));
    const ifFoundY = secBgY + secBgH - 10;

    const ribbonPrim = adj(prim, 15);
    const ribbonPrimD = primD;

    return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
      ${style}${defs}
      <rect width="${W}" height="${H}" fill="${sec}"/>

      <!-- Subtle background decoration -->
      <circle cx="${n(W*0.10)}" cy="${n(H*0.15)}" r="${n(W*0.35)}" fill="${prim}" opacity="0.015"/>
      <circle cx="${n(W*0.90)}" cy="${n(H*0.80)}" r="${n(W*0.28)}" fill="${prim}" opacity="0.012"/>

      <!-- Outer border -->
      <rect x="3" y="3" width="${n(W-6)}" height="${n(H-6)}" rx="18" fill="none" stroke="${border}" stroke-width="1.8" opacity="0.25"/>

      <!-- Header gradient bar -->
      <rect x="0" y="0" width="${W}" height="${n(hH)}" fill="url(#hg)"/>
      <path d="M0 ${n(hH)} Q${n(W*.20)} ${n(hH+8)} ${n(W*.50)} ${n(hH+4)} Q${n(W*.80)} ${n(hH)} ${W} ${n(hH)}" fill="${ribbonPrim}" opacity="0.15"/>

      <!-- Decorative accent dots on header -->
      <circle cx="${n(mg+12)}" cy="${n(hH*0.30)}" r="3" fill="${hdrTxt}" opacity="0.15"/>
      <circle cx="${n(W-mg-12)}" cy="${n(hH*0.30)}" r="3" fill="${hdrTxt}" opacity="0.15"/>
      <circle cx="${n(mg+12)}" cy="${n(hH*0.70)}" r="2" fill="${hdrTxt}" opacity="0.10"/>
      <circle cx="${n(W-mg-12)}" cy="${n(hH*0.70)}" r="2" fill="${hdrTxt}" opacity="0.10"/>

      <!-- School logo + name in header -->
      ${showLogo && sLogo ? `<image x="${n(18)}" y="${n(12)}" width="${n(72)}" height="${n(72)}" href="${esc(sLogo)}" preserveAspectRatio="xMidYMid slice"/>` : ''}
      ${renderWrapped(showLogo && sLogo ? W/2 + 12 : W/2, hH*0.38, H*0.028, hdrTxt, wrapToLines(schN, 30), 'middle', rtlAttr(schN), 2)}
      <!-- ID CARD subtitle under school name -->
      <text x="${n(W/2)}" y="${n(hH*0.78)}" font-size="${n(H*.011)}" fill="${hdrTxt}" text-anchor="middle" opacity="0.55" letter-spacing="3">OFFICIAL IDENTIFICATION CARD</text>

      <!-- Watermark -->
      ${watermarkBack(W,H,prim,schN)}

      <!-- Editable Information Section (middle) -->
      ${impLines.length > 0 ? `
      <g>
        <text x="${n(mg)}" y="${n(infoStartY)}" font-size="${n(impTitleFs)}" font-weight="700" fill="${prim}" letter-spacing="2">IMPORTANT INFORMATION</text>
        <line x1="${n(mg)}" y1="${n(infoStartY+8)}" x2="${n(W-mg)}" y2="${n(infoStartY+8)}" stroke="${prim}" stroke-width="1.2" opacity="0.15"/>
        ${impLines.map((l:string, i:number) => {
          const y = infoStartY + 20 + i * impLh;
          return `<text x="${n(mg+6)}" y="${n(y)}" font-size="${n(impLineFs)}" fill="${dark}"${rtlAttr(l)}>${l}</text>`;
        }).join('\n')}
      </g>` : ''}

      <!-- School Info Section (bottom, using secondary color) -->
      <g>
        <rect x="${n(mg-4)}" y="${n(secBgY)}" width="${n(W-(mg-4)*2)}" height="${n(secBgH)}" rx="12" fill="${adj(sec,-8)}" stroke="${border}" stroke-width="1" opacity="0.5"/>
        <rect x="${n(mg-4)}" y="${n(secBgY)}" width="${n(W-(mg-4)*2)}" height="6" rx="3" fill="${prim}" opacity="0.6"/>

        ${contactParts.length > 0 ? `
        <text x="${n(W/2)}" y="${n(conTitleY)}" font-size="${n(conTitleFs)}" font-weight="700" fill="${prim}" text-anchor="middle" letter-spacing="3">CONTACT INFORMATION</text>
        <line x1="${n(W*0.35)}" y1="${n(conTitleY+10)}" x2="${n(W*0.65)}" y2="${n(conTitleY+10)}" stroke="${prim}" stroke-width="1" opacity="0.15"/>
        ${contactParts.map((l:string, i:number) => {
          const y = conLineYStart + i * conLh;
          const isEmail = l.includes('@');
          const isPhone = l.match(/[\d\s\+\-\(\)]{7,}/);
          const label = isEmail ? 'Email:' : isPhone ? 'Phone:' : 'Address:';
          return `<text x="${n(W/2)}" y="${n(y)}" font-size="${n(conLineFs)}" fill="${dark}" text-anchor="middle" opacity="0.85"${rtlAttr(l)}><tspan font-weight="600" fill="${muted}">${label}</tspan> ${l}</text>`;
        }).join('\n')}` : ''}

        <!-- "If found" text -->
        <text x="${n(W/2)}" y="${n(ifFoundY)}" font-size="${n(H*.026)}" fill="${muted}" text-anchor="middle" opacity="0.7" letter-spacing="1">If found, please return to the school office.</text>
      </g>
    </svg>`;
  }

  // Front - Portrait
  const photoR = 114;
  const photoCX = Math.round(W/2);
  const photoCY = hH + 126;
  const txtX = Math.round(W/2);

  const nameBaseY = photoCY + photoR + 40;
  const nameFitResult = fitName(pName, 22, 38, 22);
  const nameLines = nameFitResult.lines;
  const nameFs = nameFitResult.fontSize;
  const nameLineGap = 4;

  const badgeY = nameBaseY + 22 + (nameLines.length - 1) * (nameFs + nameLineGap);
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
    <text x="${n(valueX)}" y="${n(rowStartY + i * rowLH)}" font-size="${n(rowFs)}" font-weight="600" fill="${dark}"${rtlAttr(row.v)}>${row.v}</text>
  `).join('');

  // Add issue/expiry rows if provided
  const dateRowsHtml = [] as string[];
  if (issueDate) dateRowsHtml.push(`<text x="${n(labelX)}" y="${n(rowStartY + rows.length * rowLH)}" font-size="${n(rowFs)}" fill="${muted}">Issued</text><text x="${n(valueX)}" y="${n(rowStartY + rows.length * rowLH)}" font-size="${n(rowFs)}" font-weight="600" fill="${dark}">${esc(issueDate)}</text>`);
  if (expiryDate) dateRowsHtml.push(`<text x="${n(labelX)}" y="${n(rowStartY + (rows.length + (issueDate?1:0)) * rowLH)}" font-size="${n(rowFs)}" fill="${muted}">Expires</text><text x="${n(valueX)}" y="${n(rowStartY + (rows.length + (issueDate?1:0)) * rowLH)}" font-size="${n(rowFs)}" font-weight="600" fill="${dark}">${esc(expiryDate)}</text>`);

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
    
    ${renderWrapped(W/2, hH*0.42, H*0.028, hdrTxt, wrapToLines(schN, 28), 'middle', rtlAttr(schN), 3)}
    <text x="${n(W/2)}" y="${n(hH*0.74)}" font-size="${n(H*.014)}" font-weight="600" fill="${hdrTxt}" text-anchor="middle" opacity="0.8" letter-spacing="2">ID CARD</text>
    
    ${phEl}
    
    ${renderWrapped(txtX, nameBaseY, nameFs, dark, nameLines, 'middle', rtlAttr(pName), nameLineGap)}
    
    <g filter="url(#shadow)">
      <rect x="${n(badgeX)}" y="${n(badgeY)}" width="${n(badgeW)}" height="${n(badgeH)}" rx="${n(badgeH/2)}" fill="${prim}" opacity="0.12"/>
    </g>
    <text x="${n(badgeX + badgeW/2)}" y="${n(badgeY + badgeH*0.68)}" font-size="${n(20)}" font-weight="700" fill="${prim}" text-anchor="middle" letter-spacing="1">${pRole}</text>
    
    ${dataCard(infoCardX, infoCardY, infoCardW, infoCardH, sec, border, infoRowsHtml + dateRowsHtml.join(''))}
    
    ${qrEl}
    <!-- Optional signature -->
    ${showSignature && signatureUrl ? `<image x="${n(infoCardX + infoCardW - 120)}" y="${n(infoCardY + infoCardH - 60)}" width="100" height="40" href="${esc(signatureUrl)}" preserveAspectRatio="xMidYMid slice" opacity="0.9"/>` : ''}
    <!-- Optional barcode (simple stripes) -->
    ${showBarcode ? `<g transform="translate(${n(W*0.06)}, ${n(H - 28)})"><rect width="${n(W*0.88)}" height="10" fill="#fff"/><g fill="#111">${Array.from({length:40}).map((_,i)=>`<rect x="${n(i*(W*0.88/40))}" y="0" width="${n(W*0.88/80)}" height="10"/>`).join('')}</g><text x="${n(W/2)}" y="22" font-size="14" fill="${muted}" text-anchor="middle">${pId}</text></g>` : ''}
    
  </svg>`;
}

// ─── LANDSCAPE LAYOUT (85.6×53.98mm @300dpi = 1011×638px) ─────────────────
function buildLandscape(o:any):string {
  const {W,H,prim,primD,primL,sec,dark,muted,border,hdrTxt,pName,pId,pClass,pGend,pPhone,pRole,schN,schA,sPh,sEm,inits,qrB64,showQR,showPhoto,pType,isBack,backText,style,defs,
    showBarcode, showSignature, showLogo, issueDate, expiryDate, watermarkText, signatureUrl, sLogo } = o;

  const hH = 102;
  const mg = 44;
  const footerH = 36;

  if(isBack){
    const bLines=(backText||'').split('\n').filter((l:string)=>l.trim());
    const wrapL = (lines: string[], max: number) => lines.flatMap(l => wrapToLines(esc(l), max));
    const contactParts = [schA, sPh, sEm].filter(Boolean);
    const impLines = wrapL(bLines, 50);
    const conLines = wrapL(contactParts, 50);

    // ── Layout zones (landscape) ──
    // Header zone:      0 → hH (102)
    // Decorative ribbon:hH → hH+14
    // Editable info:    hH+36 → H*0.60
    // School info:      H*0.63 → H*0.86 (bottom section)
    // "If found":       within school info section
    // Footer:           H-footerH → H

    const ribbonH = 14;
    const ribbonY = hH;

    const infoStartY = hH + 36;
    const infoEndY = Math.round(H * 0.58);
    const infoAvailY = infoEndY - infoStartY - 6;
    const impTitleFs = Math.round(H * 0.034);
    const impLh = impLines.length ? Math.max(20, Math.min(Math.round(infoAvailY / Math.max(impLines.length, 1)), Math.round(H * 0.056))) : 22;
    const impLineFs = Math.min(Math.round(H * 0.030), Math.round(impLh * 0.62));

    // School info (bottom using secondary color)
    const secBgY = Math.round(H * 0.62);
    const secBgH = Math.round(H * 0.26);
    const conTitleY = secBgY + 12;
    const conTitleFs = Math.round(H * 0.030);
    const conLineYStart = conTitleY + 18;
    const conLh = conLines.length ? Math.max(18, Math.min(Math.round((secBgH - 28) / Math.max(conLines.length, 1)), Math.round(H * 0.045))) : 20;
    const conLineFs = Math.min(Math.round(H * 0.026), Math.round(conLh * 0.58));
    const ifFoundY = secBgY + secBgH - 10;

    const ribbonPrim = adj(prim, 15);

    return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
      ${style}${defs}
      <rect width="${W}" height="${H}" fill="${sec}"/>

      <!-- Subtle background decoration -->
      <circle cx="${n(W*0.06)}" cy="${n(H*0.30)}" r="${n(H*0.40)}" fill="${prim}" opacity="0.015"/>
      <circle cx="${n(W*0.94)}" cy="${n(H*0.75)}" r="${n(H*0.30)}" fill="${prim}" opacity="0.012"/>

      <!-- Outer border -->
      <rect x="3" y="3" width="${n(W-6)}" height="${n(H-6)}" rx="14" fill="none" stroke="${border}" stroke-width="1.8" opacity="0.25"/>

      <!-- Header gradient bar -->
      <rect x="0" y="0" width="${W}" height="${n(hH)}" fill="url(#hg)"/>
      <path d="M0 ${n(hH)} Q${n(W*.15)} ${n(hH+6)} ${n(W*.50)} ${n(hH+3)} Q${n(W*.85)} ${n(hH-2)} ${W} ${n(hH)}" fill="${ribbonPrim}" opacity="0.12"/>

      <!-- Decorative accent dots on header -->
      <circle cx="${n(mg+10)}" cy="${n(hH*0.28)}" r="2.5" fill="${hdrTxt}" opacity="0.15"/>
      <circle cx="${n(W-mg-10)}" cy="${n(hH*0.28)}" r="2.5" fill="${hdrTxt}" opacity="0.15"/>
      <circle cx="${n(mg+10)}" cy="${n(hH*0.72)}" r="2" fill="${hdrTxt}" opacity="0.10"/>
      <circle cx="${n(W-mg-10)}" cy="${n(hH*0.72)}" r="2" fill="${hdrTxt}" opacity="0.10"/>

      <!-- School logo + name in header -->
      ${showLogo && sLogo ? `<image x="${n(mg)}" y="${n(8)}" width="${n(96)}" height="${n(72)}" href="${esc(sLogo)}" preserveAspectRatio="xMidYMid slice"/>` : ''}
      ${renderWrapped(W/2, hH*0.38, H*0.052, hdrTxt, wrapToLines(schN, 22).slice(0,2), 'middle', rtlAttr(schN), 3)}
      <text x="${n(W/2)}" y="${n(hH*0.76)}" font-size="${n(H*.030)}" fill="${hdrTxt}" text-anchor="middle" opacity="0.6" letter-spacing="4">OFFICIAL IDENTIFICATION CARD</text>

      <!-- Watermark -->
      ${watermarkBack(W,H,prim,schN)}

      <!-- Editable Information Section (middle) -->
      ${impLines.length > 0 ? `
      <g>
        <text x="${n(mg)}" y="${n(infoStartY)}" font-size="${n(impTitleFs)}" font-weight="700" fill="${prim}" letter-spacing="2">IMPORTANT INFORMATION</text>
        <line x1="${n(mg)}" y1="${n(infoStartY+6)}" x2="${n(W-mg)}" y2="${n(infoStartY+6)}" stroke="${prim}" stroke-width="1.2" opacity="0.15"/>
        ${impLines.map((l:string, i:number) => {
          const y = infoStartY + 16 + i * impLh;
          return `<text x="${n(mg+6)}" y="${n(y)}" font-size="${n(impLineFs)}" fill="${dark}"${rtlAttr(l)}>${l}</text>`;
        }).join('\n')}
      </g>` : ''}

      <!-- School Info Section (bottom, using secondary color) -->
      <g>
        <rect x="${n(mg-4)}" y="${n(secBgY)}" width="${n(W-(mg-4)*2)}" height="${n(secBgH)}" rx="10" fill="${adj(sec,-8)}" stroke="${border}" stroke-width="1" opacity="0.5"/>
        <rect x="${n(mg-4)}" y="${n(secBgY)}" width="${n(W-(mg-4)*2)}" height="5" rx="2.5" fill="${prim}" opacity="0.6"/>

        ${contactParts.length > 0 ? `
        <text x="${n(W/2)}" y="${n(conTitleY)}" font-size="${n(conTitleFs)}" font-weight="700" fill="${prim}" text-anchor="middle" letter-spacing="3">CONTACT INFORMATION</text>
        <line x1="${n(W*0.35)}" y1="${n(conTitleY+8)}" x2="${n(W*0.65)}" y2="${n(conTitleY+8)}" stroke="${prim}" stroke-width="1" opacity="0.15"/>
        ${contactParts.map((l:string, i:number) => {
          const y = conLineYStart + i * conLh;
          const isEmail = l.includes('@');
          const isPhone = l.match(/[\d\s\+\-\(\)]{7,}/);
          const icon = isEmail ? '✉' : isPhone ? '📞' : '📍';
          return `<text x="${n(W/2)}" y="${n(y)}" font-size="${n(conLineFs)}" fill="${dark}" text-anchor="middle" opacity="0.85"${rtlAttr(l)}>${icon} ${l}</text>`;
        }).join('\n')}` : ''}

        <!-- "If found" text -->
        <text x="${n(W/2)}" y="${n(ifFoundY)}" font-size="${n(H*.026)}" fill="${muted}" text-anchor="middle" opacity="0.7" letter-spacing="1">⚠ If found, please return to the school office.</text>
      </g>

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

  const nameBaseY = photoCY - 62;             // above photo center
  const nameFitResult = fitName(pName, 30, 30, 18);
  const nameLines = nameFitResult.lines;
  const nameFs = nameFitResult.fontSize;
  const nameLineGap = 4;

  const badgeY = nameBaseY + nameFs + 4 + (nameLines.length - 1) * (nameFs + nameLineGap);
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
    <text x="${n(textX + Math.round(colSep * 0.18))}" y="${n(infoY + i * rowLH)}" font-size="${n(rowFs)}" font-weight="600" fill="${dark}"${rtlAttr(row.v)}>${row.v}</text>
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
    
    ${renderWrapped(mg, hH*0.42, H*0.060, hdrTxt, wrapToLines(schN, 20).slice(0,2), 'start', rtlAttr(schN), 4)}
    <text x="${n(W-mg)}" y="${n(hH*0.54)}" font-size="${n(H*.040)}" font-weight="600" fill="${hdrTxt}" text-anchor="end" opacity="0.9" letter-spacing="2">ID CARD</text>
    
    ${sepEl}
    
    ${phEl}
    
    ${renderWrapped(textX, nameBaseY, nameFs, dark, nameLines, 'start', rtlAttr(pName), nameLineGap)}
    
    <!-- Role badge -->
    <g filter="url(#shadow)">
      <rect x="${n(textX)}" y="${n(badgeY)}" width="${n(badgeW)}" height="${n(badgeH)}" rx="${n(badgeH/2)}" fill="${prim}" opacity="0.12"/>
    </g>
    <text x="${n(textX + badgeW/2)}" y="${n(badgeY + badgeH*0.66)}" font-size="${n(16)}" font-weight="700" fill="${prim}" text-anchor="middle" letter-spacing="1">${pRole}</text>
    
    <!-- Info rows -->
    ${infoRowsHtml}
    
    ${qrEl}
    
  </svg>`;
}
