/**
 * Skoolar PWA Splash Screen Generator
 *
 * Usage: node scripts/generate-splash.js
 *
 * Generates splash screen images for iOS PWA.
 * iOS 16.4+ auto-generates splash screens from manifest icons,
 * but for older devices or custom branding, use this script.
 *
 * Recommended: Use a tool like PWABuilder.com or Appsco.pe
 * to generate properly sized splash images.
 */

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const SPLASH_DIR = path.join(__dirname, '..', 'public', 'splash');
const LOGO_PATH = path.join(__dirname, '..', 'public', 'logo.svg');
const ICON_PATH = path.join(__dirname, '..', 'public', 'icon-512.png');

// Splash screen sizes for different iOS devices
const SPLASH_SIZES = [
  // iPhone
  { name: 'iphone5_splash', width: 640, height: 1136, device: 'iPhone 5/SE' },
  { name: 'iphone6_splash', width: 750, height: 1334, device: 'iPhone 6/7/8' },
  { name: 'iphoneplus_splash', width: 1242, height: 2208, device: 'iPhone 6+/7+/8+' },
  { name: 'iphonex_splash', width: 1125, height: 2436, device: 'iPhone X/XS/11 Pro' },
  { name: 'iphonexr_splash', width: 828, height: 1792, device: 'iPhone XR/11' },
  { name: 'iphone12_splash', width: 1170, height: 2532, device: 'iPhone 12/13/14' },
  { name: 'iphone14pro_splash', width: 1179, height: 2556, device: 'iPhone 14 Pro' },
  { name: 'iphone15_splash', width: 1290, height: 2796, device: 'iPhone 15 Pro Max' },
  // iPad
  { name: 'ipad_splash', width: 1536, height: 2048, device: 'iPad Mini/Air' },
  { name: 'ipadpro11_splash', width: 1668, height: 2388, device: 'iPad Pro 11"' },
  { name: 'ipadpro12_splash', width: 2048, height: 2732, device: 'iPad Pro 12.9"' },
  // Universal fallback
  { name: 'apple_splash', width: 2048, height: 2732, device: 'Fallback (largest)' },
];

function getFileSize(filePath) {
  try {
    return fs.statSync(filePath).size;
  } catch {
    return 0;
  }
}

async function generateSplash() {
  console.log('=== Skoolar PWA Splash Generator ===\n');

  // Create splash directory
  if (!fs.existsSync(SPLASH_DIR)) {
    fs.mkdirSync(SPLASH_DIR, { recursive: true });
  }

  // Check if icon exists
  if (!fs.existsSync(ICON_PATH)) {
    console.warn(`⚠  Icon not found: ${ICON_PATH}`);
    console.warn('   Generate one manually or skip splash generation.\n');
  }

  // Check if we have the logo
  const hasLogo = fs.existsSync(LOGO_PATH);

  for (const size of SPLASH_SIZES) {
    const outputPath = path.join(SPLASH_DIR, `${size.name}.png`);

    console.log(`Generating ${size.name}.png (${size.width}×${size.height}) — ${size.device}`);

    try {
      // Create a gradient background with Skoolar branding colors
      const svgGradient = `
        <svg width="${size.width}" height="${size.height}" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style="stop-color:#059669;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#0D9488;stop-opacity:1" />
            </linearGradient>
          </defs>
          <rect width="100%" height="100%" fill="url(#bg)"/>
        </svg>
      `;

      const background = await sharp(Buffer.from(svgGradient))
        .resize(size.width, size.height)
        .png()
        .toBuffer();

      // Overlay the logo if available
      if (hasLogo) {
        try {
          const logoSize = Math.min(size.width, size.height) * 0.25;
          const logo = await sharp(LOGO_PATH)
            .resize(Math.round(logoSize), Math.round(logoSize))
            .png()
            .toBuffer();

          const logoOffsetX = Math.round((size.width - logoSize) / 2);
          const logoOffsetY = Math.round((size.height - logoSize) / 3);

          await sharp(background)
            .composite([{ input: logo, top: logoOffsetY, left: logoOffsetX }])
            .png()
            .toFile(outputPath);
        } catch (logoErr) {
          // Fallback: just use the background
          await sharp(background).toFile(outputPath);
        }
      } else if (fs.existsSync(ICON_PATH)) {
        // Overlay the icon
        try {
          const iconSize = Math.min(size.width, size.height) * 0.3;
          const icon = await sharp(ICON_PATH)
            .resize(Math.round(iconSize), Math.round(iconSize))
            .png()
            .toBuffer();

          const iconOffsetX = Math.round((size.width - iconSize) / 2);
          const iconOffsetY = Math.round((size.height - iconSize) / 3);

          await sharp(background)
            .composite([{ input: icon, top: iconOffsetY, left: iconOffsetX }])
            .png()
            .toFile(outputPath);
        } catch (iconErr) {
          await sharp(background).toFile(outputPath);
        }
      } else {
        await sharp(background).toFile(outputPath);
      }

      const fileSize = getFileSize(outputPath);
      console.log(`   ✓ ${(fileSize / 1024).toFixed(1)} KB`);
    } catch (err) {
      console.error(`   ✗ Failed: ${err.message}`);
    }
  }

  // Generate a simple universal splash too
  console.log(`\n✓ Done! ${SPLASH_DIR}`);
  console.log('\nNext steps:');
  console.log('  1. The splash screens are in /public/splash/');
  console.log('  2. iOS 16.4+ auto-generates splash from manifest icons,');
  console.log('     so these are a fallback/optional enhancement.');
  console.log('  3. For best results, upload icon-512.png with a solid');
  console.log('     teal (#0E5D52) background to PWABuilder.com for');
  console.log('     professionally generated splash screens.');
}

generateSplash().catch(console.error);
