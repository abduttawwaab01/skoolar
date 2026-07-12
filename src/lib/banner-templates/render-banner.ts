import {
  type BannerDesignState,
  type BackgroundPattern,
  getSizeDimensions,
} from './types';
import { renderAllShapes } from './shapes';

function esc(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function getPatternSVG(pattern: BackgroundPattern, color: string, opacity: number): string {
  const id = 'banner-bg-pattern';
  const patterns: Record<string, string> = {
    damask: `<pattern id="${id}" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse"><path d="M30 5 Q35 10 30 15 Q25 10 30 5Z" fill="${esc(color)}" opacity="${opacity * 0.3}"/><circle cx="30" cy="40" r="2" fill="${esc(color)}" opacity="${opacity * 0.15}"/><circle cx="15" cy="30" r="1.5" fill="${esc(color)}" opacity="${opacity * 0.1}"/></pattern>`,
    shield: `<pattern id="${id}" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse"><path d="M40 5 L55 20 L55 35 L40 50 L25 35 L25 20 Z" fill="none" stroke="${esc(color)}" stroke-width="0.5" opacity="${opacity * 0.2}"/></pattern>`,
    geometric: `<pattern id="${id}" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse"><rect x="0" y="0" width="20" height="20" fill="none" stroke="${esc(color)}" stroke-width="0.3" opacity="${opacity * 0.15}"/><rect x="20" y="20" width="20" height="20" fill="none" stroke="${esc(color)}" stroke-width="0.3" opacity="${opacity * 0.15}"/></pattern>`,
    confetti: `<pattern id="${id}" x="0" y="0" width="50" height="50" patternUnits="userSpaceOnUse"><rect x="5" y="5" width="3" height="3" rx="0.5" fill="${esc(color)}" opacity="${opacity * 0.25}" transform="rotate(30 6.5 6.5)"/><circle cx="20" cy="15" r="1.5" fill="${esc(color)}" opacity="${opacity * 0.2}"/><circle cx="42" cy="32" r="1.5" fill="${esc(color)}" opacity="${opacity * 0.15}"/></pattern>`,
    parchment: `<pattern id="${id}" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse"><circle cx="15" cy="20" r="8" fill="${esc(color)}" opacity="${opacity * 0.04}"/><circle cx="50" cy="45" r="12" fill="${esc(color)}" opacity="${opacity * 0.03}"/></pattern>`,
    diagonal: `<pattern id="${id}" x="0" y="0" width="30" height="30" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="30" stroke="${esc(color)}" stroke-width="0.4" opacity="${opacity * 0.12}"/></pattern>`,
  };
  return patterns[pattern] || '';
}

function getFontImport(fontFamily: string): string {
  const fontMap: Record<string, string> = {
    'Montserrat': 'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800&display=swap',
    'Open Sans': 'https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600;700&display=swap',
    'Lato': 'https://fonts.googleapis.com/css2?family=Lato:wght@400;700;900&display=swap',
    'Playfair Display': 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&display=swap',
    'Raleway': 'https://fonts.googleapis.com/css2?family=Raleway:wght@400;600;700&display=swap',
    'Poppins': 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700;800&display=swap',
    'Oswald': 'https://fonts.googleapis.com/css2?family=Oswald:wght@400;600;700&display=swap',
    'Great Vibes': 'https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap',
  };
  for (const [name, url] of Object.entries(fontMap)) {
    if (fontFamily.includes(name)) return url;
  }
  return '';
}

export function renderBannerHTML(design: BannerDesignState): string {
  const { width, height } = getSizeDimensions(design.size, design.customWidth, design.customHeight);
  const c = design.colors || {
    primary: '#6366f1',
    secondary: '#818cf8',
    accent: '#fbbf24',
    text: '#ffffff',
    textSecondary: '#e0e7ff',
    bg: '#1e1b4b',
    gradientStart: '#6366f1',
    gradientEnd: '#1e1b4b',
  };

  let bgStyle = '';
  switch (design.backgroundStyle) {
    case 'solid':
      bgStyle = `background-color:${esc(c.bg)};`;
      break;
    case 'gradient':
      bgStyle = `background:linear-gradient(135deg, ${esc(c.gradientStart)}, ${esc(c.gradientEnd)});`;
      break;
    case 'pattern':
      bgStyle = `background-color:${esc(c.bg)};`;
      break;
    case 'image':
      bgStyle = design.backgroundImage
        ? `background-image:url(${design.backgroundImage});background-size:cover;background-position:center;`
        : `background-color:${esc(c.bg)};`;
      break;
  }

  const fontImport = getFontImport(design.fontFamily);

  const shapesHtml = renderAllShapes(design.shapes || [], width, height);

  let patternOverlay = '';
  if (design.backgroundStyle === 'pattern' && design.backgroundPattern !== 'none') {
    const patternSvg = getPatternSVG(design.backgroundPattern, c.primary, 1);
    if (patternSvg) {
      patternOverlay = `<svg style="position:absolute;top:0;left:0;width:100%;height:100%;z-index:0;" xmlns="http://www.w3.org/2000/svg"><defs>${patternSvg}</defs><rect width="100%" height="100%" fill="url(#banner-bg-pattern)"/></svg>`;
    }
  }

  const imageOverlay = design.backgroundStyle === 'image' && design.backgroundImage
    ? `<div style="position:absolute;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,${design.overlayOpacity / 100});z-index:1;"></div>`
    : '';

  const borderHtml = design.showBorder && design.borderStyle !== 'none'
    ? `<svg style="position:absolute;top:0;left:0;width:100%;height:100%;z-index:99;pointer-events:none;" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="4" width="${width - 8}" height="${height - 8}" fill="none" stroke="${esc(c.accent)}" stroke-width="${design.borderWidth * 2}" rx="4" /></svg>`
    : '';

  const fontSize = design.titleFontSize;
  const subFontSize = design.subtitleFontSize;
  const contentAlign = design.textAlign;

  const logoHtml = design.showLogo && design.logoUrl
    ? `<div style="text-align:${contentAlign};margin-bottom:8px;z-index:10;position:relative;"><img src="${esc(design.logoUrl)}" style="max-height:${Math.round(height * 0.12)}px;max-width:${Math.round(width * 0.3)}px;object-fit:contain;" /></div>`
    : '';

  const schoolNameHtml = design.showSchoolName && design.schoolName
    ? `<div style="font-family:${esc(design.fontFamily)};font-size:${Math.round(height * 0.028 * subFontSize)}px;color:${esc(c.textSecondary)};text-transform:uppercase;letter-spacing:2px;margin-bottom:${Math.round(height * 0.015)}px;z-index:10;position:relative;">${esc(design.schoolName)}</div>`
    : '';

  const titleHtml = design.showTitle && design.title
    ? `<div style="font-family:${esc(design.fontFamily)};font-size:${Math.round(height * 0.06 * fontSize)}px;font-weight:800;color:${esc(c.text)};line-height:1.1;margin-bottom:${Math.round(height * 0.015)}px;z-index:10;position:relative;text-shadow:0 2px 8px rgba(0,0,0,0.3);">${esc(design.title)}</div>`
    : '';

  const subtitleHtml = design.showSubtitle && design.subtitle
    ? `<div style="font-family:${esc(design.fontFamily)};font-size:${Math.round(height * 0.032 * subFontSize)}px;color:${esc(c.textSecondary)};margin-bottom:${Math.round(height * 0.01)}px;z-index:10;position:relative;">${esc(design.subtitle)}</div>`
    : '';

  const descHtml = design.showDescription && design.description
    ? `<div style="font-family:${esc(design.fontFamily)};font-size:${Math.round(height * 0.024)}px;color:${esc(c.textSecondary)};max-width:${Math.round(width * 0.7)}px;margin:0 auto ${Math.round(height * 0.015)}px;z-index:10;position:relative;line-height:1.4;">${esc(design.description)}</div>`
    : '';

  const detailsHtml = [
    design.showDate && design.eventDate ? `<span style="margin-right:16px;">📅 ${esc(design.eventDate)}</span>` : '',
    design.showTime && design.eventTime ? `<span style="margin-right:16px;">🕐 ${esc(design.eventTime)}</span>` : '',
    design.showVenue && design.venue ? `<span>📍 ${esc(design.venue)}</span>` : '',
  ].filter(Boolean).join('');

  const detailsBlock = detailsHtml
    ? `<div style="font-family:${esc(design.fontFamily)};font-size:${Math.round(height * 0.022)}px;color:${esc(c.textSecondary)};z-index:10;position:relative;margin-bottom:${Math.round(height * 0.01)}px;">${detailsHtml}</div>`
    : '';

  const contactHtml = design.showContact && design.contactInfo
    ? `<div style="font-family:${esc(design.fontFamily)};font-size:${Math.round(height * 0.02)}px;color:${esc(c.accent)};z-index:10;position:relative;">${esc(design.contactInfo)}</div>`
    : '';

  const customHtml = design.customText
    ? `<div style="font-family:${esc(design.fontFamily)};font-size:${Math.round(height * 0.02)}px;color:${esc(c.textSecondary)};margin-top:${Math.round(height * 0.01)}px;z-index:10;position:relative;">${esc(design.customText)}</div>`
    : '';

  let verticalAlign = 'center';
  if (design.contentPosition === 'top') verticalAlign = 'flex-start';
  if (design.contentPosition === 'bottom') verticalAlign = 'flex-end';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
${fontImport ? `<link rel="stylesheet" href="${fontImport}" />` : ''}
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { width:${width}px; height:${height}px; overflow:hidden; }
</style>
</head>
<body>
<div style="position:relative;width:${width}px;height:${height}px;overflow:hidden;${bgStyle}">
  ${patternOverlay}
  ${imageOverlay}
  ${shapesHtml}
  ${borderHtml}
  <div style="position:absolute;top:0;left:0;width:100%;height:100%;display:flex;flex-direction:column;align-items:${contentAlign === 'left' ? 'flex-start' : contentAlign === 'right' ? 'flex-end' : 'center'};justify-content:${verticalAlign};padding:${Math.round(height * 0.06)}px ${Math.round(width * 0.08)}px;z-index:10;">
    ${logoHtml}
    ${schoolNameHtml}
    ${titleHtml}
    ${subtitleHtml}
    ${descHtml}
    ${detailsBlock}
    ${contactHtml}
    ${customHtml}
  </div>
</div>
</body>
</html>`;
}
