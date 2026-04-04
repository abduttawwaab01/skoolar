/**
 * Generate PNG icons from SVG using sharp
 * Run with: node scripts/generate-pwa-icons.js
 */
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const sizes = [192, 512];
const publicDir = path.join(__dirname, '..', 'public');

async function generateIcons() {
  // Create a beautiful green graduation cap icon with Skoolar name
  const svgBuffer = (size) => {
    const fontSize = size * 0.14;
    const capY = size * 0.35;
    const capWidth = size * 0.55;
    const capHeight = size * 0.18;
    const tasselX = size * 0.72;
    const tasselY = size * 0.28;
    const textY = size * 0.78;
    
    return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#047857;stop-opacity:1" />
          <stop offset="50%" style="stop-color:#059669;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#10B981;stop-opacity:1" />
        </linearGradient>
        <linearGradient id="capGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:#ffffff;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#f0fdf4;stop-opacity:1" />
        </linearGradient>
        <linearGradient id="tasselGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:#fbbf24;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#f59e0b;stop-opacity:1" />
        </linearGradient>
        <filter id="shadow" x="-10%" y="-10%" width="120%" height="130%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000" flood-opacity="0.2"/>
        </filter>
      </defs>
      
      <!-- Background -->
      <rect width="${size}" height="${size}" fill="url(#bg)" rx="${size * 0.15}"/>
      
      <!-- Subtle inner glow -->
      <rect x="${size * 0.05}" y="${size * 0.05}" width="${size * 0.9}" height="${size * 0.9}" fill="none" stroke="#34d399" stroke-width="2" rx="${size * 0.12}" opacity="0.3"/>
      
      <!-- Graduation Cap Group -->
      <g filter="url(#shadow)">
        <!-- Cap top (diamond shape) -->
        <polygon 
          points="${size/2},${capY - capHeight * 0.5} ${size/2 - capWidth/2},${capY} ${size/2},${capY + capHeight * 0.4} ${size/2 + capWidth/2},${capY}"
          fill="url(#capGrad)"
        />
        
        <!-- Cap base/skull -->
        <path 
          d="M${size/2 - capWidth * 0.35},${capY + capHeight * 0.35} 
             L${size/2 - capWidth * 0.35},${capY + capHeight * 1.2} 
             Q${size/2 - capWidth * 0.35},${capY + capHeight * 1.5} ${size/2},${capY + capHeight * 1.5} 
             Q${size/2 + capWidth * 0.35},${capY + capHeight * 1.5} ${size/2 + capWidth * 0.35},${capY + capHeight * 1.2} 
             L${size/2 + capWidth * 0.35},${capY + capHeight * 0.35}"
          fill="url(#capGrad)"
        />
        
        <!-- Cap band -->
        <rect 
          x="${size/2 - capWidth * 0.35}" 
          y="${capY + capHeight * 0.85}" 
          width="${capWidth * 0.7}" 
          height="${capHeight * 0.3}" 
          fill="#059669"
          opacity="0.8"
        />
        
        <!-- Tassel string -->
        <line 
          x1="${size/2}" 
          y1="${capY}" 
          x2="${tasselX}" 
          y2="${tasselY}" 
          stroke="#fbbf24" 
          stroke-width="${size * 0.015}"
        />
        
        <!-- Tassel fringe -->
        <ellipse 
          cx="${tasselX}" 
          cy="${tasselY + size * 0.04}" 
          rx="${size * 0.025}" 
          ry="${size * 0.05}" 
          fill="url(#tasselGrad)"
        />
        
        <!-- Tassel button -->
        <circle 
          cx="${size/2}" 
          cy="${capY}" 
          r="${size * 0.02}" 
          fill="#fbbf24"
        />
      </g>
      
      <!-- Skoolar Text -->
      <text 
        x="${size / 2}" 
        y="${textY}" 
        text-anchor="middle" 
        font-size="${fontSize}" 
        fill="white" 
        font-family="Arial, Helvetica, sans-serif" 
        font-weight="bold"
        letter-spacing="${size * 0.02}"
      >SKOOLAR</text>
    </svg>
  `);
  };

  for (const size of sizes) {
    const outputPath = path.join(publicDir, `icon-${size}.png`);
    
    await sharp(svgBuffer(size))
      .resize(size, size)
      .png()
      .toFile(outputPath);
    
    console.log(`✓ Generated icon-${size}.png (${size}x${size})`);
  }
  
  console.log('\nDone! Beautiful green graduation cap icons generated in public/');
}

generateIcons().catch(console.error);
