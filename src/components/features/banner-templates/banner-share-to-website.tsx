'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useBannerTemplatesStore } from '@/store/banner-templates-store';
import { renderBannerHTML } from '@/lib/banner-templates/render-banner';
import { captureHTMLInIframe } from '@/lib/capture-utils';
import { Globe, Loader2, CheckCircle2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

export function BannerShareToWebsite() {
  const { design } = useBannerTemplatesStore();
  const [status, setStatus] = useState<'idle' | 'capturing' | 'uploading' | 'setting' | 'done' | 'error'>('idle');
  const [websiteUrl, setWebsiteUrl] = useState('');

  const handleSetHero = async () => {
    try {
      setStatus('capturing');
      const html = renderBannerHTML(design);
      const dataUrl = await captureHTMLInIframe(html, 2);

      setStatus('uploading');
      const blob = await fetch(dataUrl).then(r => r.blob());
      const file = new File([blob], `${design.name || 'banner'}-hero.png`, { type: 'image/png' });

      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', 'schools');

      const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
      if (!uploadRes.ok) throw new Error('Upload failed');
      const uploadData = await uploadRes.json();
      const imageUrl = uploadData.data?.url || uploadData.url;
      if (!imageUrl) throw new Error('No URL returned');

      setStatus('setting');
      const saveRes = await fetch('/api/school/website', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ heroImageUrl: imageUrl }),
      });

      if (!saveRes.ok) throw new Error('Failed to update website');

      setStatus('done');
      toast.success('Banner set as school website hero!');
    } catch (err) {
      setStatus('error');
      toast.error('Failed to set as hero. Make sure you are a School Admin.');
    }
  };

  if (status === 'done') {
    return (
      <Card>
        <CardContent className="p-4 text-center">
          <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto mb-2" />
          <p className="text-sm font-medium">Banner set as hero image!</p>
          <p className="text-xs text-muted-foreground mt-1">Your school website has been updated.</p>
          <div className="flex gap-2 mt-3 justify-center">
            <Button size="sm" variant="outline" onClick={() => setStatus('idle')}>
              Set Another
            </Button>
            <Button size="sm" onClick={() => window.open('/s', '_blank')}>
              <ExternalLink className="h-3 w-3 mr-1" /> View Website
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="p-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Globe className="h-4 w-4" /> Set as School Website Hero
        </CardTitle>
        <CardDescription className="text-xs">
          Upload this banner as your school website&apos;s hero background image.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-3 pt-0">
        <Button
          onClick={handleSetHero}
          disabled={status !== 'idle' && status !== 'error'}
          className="w-full h-9 text-xs"
          size="sm"
        >
          {status === 'idle' ? (
            <>
              <Globe className="h-3.5 w-3.5 mr-1.5" /> Set as Website Hero
            </>
          ) : status === 'error' ? (
            'Retry'
          ) : (
            <>
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              {status === 'capturing' && 'Capturing banner...'}
              {status === 'uploading' && 'Uploading to server...'}
              {status === 'setting' && 'Updating school website...'}
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
