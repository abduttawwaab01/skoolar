'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useBannerTemplatesStore } from '@/store/banner-templates-store';
import { renderBannerHTML } from '@/lib/banner-templates/render-banner';
import { captureHTMLInIframe } from '@/lib/capture-utils';
import { SOCIAL_FRAMES, renderSocialFrame } from '@/lib/banner-templates/social-preview-frames';
import { Smartphone, Monitor, Loader2, Download } from 'lucide-react';
import { toast } from 'sonner';

export function BannerSocialPreview() {
  const { design } = useBannerTemplatesStore();
  const [activeFrame, setActiveFrame] = useState('instagram-post');
  const [bannerDataUrl, setBannerDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [frameHtml, setFrameHtml] = useState('');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const generate = async () => {
      setLoading(true);
      try {
        const html = renderBannerHTML(design);
        const dataUrl = await captureHTMLInIframe(html, 1);
        setBannerDataUrl(dataUrl);
      } catch {
        setLoading(false);
      }
    };
    generate();
  }, [design]);

  useEffect(() => {
    if (!bannerDataUrl) return;
    const html = renderSocialFrame(activeFrame, bannerDataUrl, design.schoolName || 'School');
    setFrameHtml(html);
  }, [activeFrame, bannerDataUrl, design.schoolName]);

  const handleDownloadFrame = async () => {
    if (!frameHtml) return;
    try {
      const iframe = document.createElement('iframe');
      iframe.style.cssText = 'position:absolute;left:-9999px;top:0;width:600px;height:800px;border:none;';
      document.body.appendChild(iframe);

      await new Promise<void>((resolve) => {
        iframe.onload = () => resolve();
        iframe.srcdoc = frameHtml;
      });

      await new Promise(r => setTimeout(r, 500));
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(iframe.contentDocument!.body, { quality: 1, pixelRatio: 2, backgroundColor: '#ffffff' });
      document.body.removeChild(iframe);

      const link = document.createElement('a');
      link.download = `${design.name || 'banner'}-social-preview.png`;
      link.href = dataUrl;
      link.click();
      toast.success('Preview downloaded!');
    } catch {
      toast.error('Failed to download preview');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {SOCIAL_FRAMES.map(frame => (
          <Button
            key={frame.id}
            variant={activeFrame === frame.id ? 'default' : 'outline'}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setActiveFrame(frame.id)}
          >
            {frame.platform === 'Instagram' || frame.platform === 'Twitter' ? (
              <Smartphone className="h-3 w-3 mr-1" />
            ) : (
              <Monitor className="h-3 w-3 mr-1" />
            )}
            {frame.name}
          </Button>
        ))}
      </div>

      <Card className="overflow-hidden">
        {loading && !bannerDataUrl ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground ml-2">Generating preview...</span>
          </div>
        ) : (
          <div className="relative">
            <iframe
              ref={iframeRef}
              srcDoc={frameHtml}
              className="w-full border-0"
              style={{ height: activeFrame === 'instagram-story' ? '600px' : '500px' }}
              title="Social Media Preview"
            />
          </div>
        )}
      </Card>

      <div className="flex justify-center">
        <Button onClick={handleDownloadFrame} disabled={!frameHtml || loading} variant="outline" size="sm" className="h-8 text-xs">
          <Download className="h-3 w-3 mr-1" /> Download Preview Image
        </Button>
      </div>
    </div>
  );
}
