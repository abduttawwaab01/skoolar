import { type BannerShape, type ShapeType } from './types';

function esc(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function renderShape(shape: BannerShape, bannerW: number, bannerH: number): string {
  if (!shape.enabled) return '';
  const color = esc(shape.color);
  const opacity = shape.opacity / 100;
  const s = shape.size;

  switch (shape.type) {
    case 'header-band':
      return `<div style="position:absolute;top:0;left:0;width:100%;height:${s * 100}%;background:${color};opacity:${opacity};z-index:1;"></div>`;

    case 'footer-band':
      return `<div style="position:absolute;bottom:0;left:0;width:100%;height:${s * 100}%;background:${color};opacity:${opacity};z-index:1;"></div>`;

    case 'side-stripe-left':
      return `<div style="position:absolute;top:0;left:0;width:${s * 100}%;height:100%;background:${color};opacity:${opacity};z-index:1;"></div>`;

    case 'side-stripe-right':
      return `<div style="position:absolute;top:0;right:0;width:${s * 100}%;height:100%;background:${color};opacity:${opacity};z-index:1;"></div>`;

    case 'center-box': {
      const padX = (1 - s) * 50;
      const padY = (1 - s) * 30;
      return `<div style="position:absolute;top:${padY}%;left:${padX}%;width:${s * 100}%;height:${s * 100}%;background:${color};opacity:${opacity};z-index:1;border-radius:8px;"></div>`;
    }

    case 'corner-top-left':
      return `<div style="position:absolute;top:0;left:0;width:${s * 100}%;height:${s * 100}%;background:${color};opacity:${opacity};z-index:1;"></div>`;

    case 'corner-top-right':
      return `<div style="position:absolute;top:0;right:0;width:${s * 100}%;height:${s * 100}%;background:${color};opacity:${opacity};z-index:1;"></div>`;

    case 'corner-bottom-left':
      return `<div style="position:absolute;bottom:0;left:0;width:${s * 100}%;height:${s * 100}%;background:${color};opacity:${opacity};z-index:1;"></div>`;

    case 'corner-bottom-right':
      return `<div style="position:absolute;bottom:0;right:0;width:${s * 100}%;height:${s * 100}%;background:${color};opacity:${opacity};z-index:1;"></div>`;

    case 'diagonal-band': {
      const rot = shape.rotation ?? -5;
      return `<div style="position:absolute;top:-10%;left:-10%;width:120%;height:${s * 100}%;background:${color};opacity:${opacity};transform:rotate(${rot}deg);z-index:1;"></div>`;
    }

    case 'circle': {
      const diameter = s * Math.min(bannerW, bannerH);
      const px = (diameter / bannerW) * 100;
      const py = (diameter / bannerH) * 100;
      return `<div style="position:absolute;top:50%;left:50%;width:${px}%;height:${py}%;transform:translate(-50%,-50%);background:${color};opacity:${opacity};border-radius:50%;z-index:1;"></div>`;
    }

    case 'divider-line':
      return `<div style="position:absolute;top:50%;left:5%;width:90%;height:2px;background:${color};opacity:${opacity};z-index:1;transform:translateY(-50%);"></div>`;

    default:
      return '';
  }
}

export function renderAllShapes(shapes: BannerShape[], bannerW: number, bannerH: number): string {
  return shapes.filter(s => s.enabled).map(s => renderShape(s, bannerW, bannerH)).join('\n');
}
