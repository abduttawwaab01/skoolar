'use client';

import { useState } from 'react';
import { useAppStore } from '@/store/app-store';
import { useBannerTemplatesStore } from '@/store/banner-templates-store';
import { BannerTemplateGallery } from '@/components/features/banner-templates/banner-template-gallery';
import { BannerDesigner } from '@/components/features/banner-templates/banner-designer';
import { BannerPreview } from '@/components/features/banner-templates/banner-preview';
import { BannerSavedDesigns } from '@/components/features/banner-templates/banner-saved-designs';
import { BannerSocialPreview } from '@/components/features/banner-templates/banner-social-preview';
import { BannerShareToWebsite } from '@/components/features/banner-templates/banner-share-to-website';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  LayoutGrid, Palette, Image as ImageIcon, Bookmark, ArrowLeft, Save,
  Globe, Sparkles,
} from 'lucide-react';

export function BannerTemplatesManager() {
  const { currentRole } = useAppStore();
  const { design, setDesign, activeTab, setActiveTab, previewTab, setPreviewTab, saveDesign } = useBannerTemplatesStore();
  const [saveName, setSaveName] = useState(design.name);

  const handleQuickSave = () => {
    if (saveName.trim()) saveDesign(saveName.trim());
  };

  if (activeTab === 'templates') {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Banner Templates
          </h2>
          <p className="text-sm text-muted-foreground">Choose a template to get started or start from scratch.</p>
        </div>
        <BannerTemplateGallery />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => setActiveTab('templates')}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Templates
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <div className="flex items-center gap-1.5">
            <Input
              value={saveName}
              onChange={e => setSaveName(e.target.value)}
              className="h-7 text-xs w-40"
              placeholder="Design name"
              onBlur={handleQuickSave}
            />
            <Button variant="outline" size="sm" className="h-7 px-2" onClick={handleQuickSave}>
              <Save className="h-3 w-3" />
            </Button>
          </div>
        </div>
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setActiveTab('saved')}>
          <Bookmark className="h-3 w-3 mr-1" /> Saved
        </Button>
      </div>

      <Tabs value={previewTab} onValueChange={v => setPreviewTab(v as 'design' | 'social')}>
        <TabsList className="h-8 w-auto">
          <TabsTrigger value="design" className="text-xs h-6 px-3"><ImageIcon className="h-3 w-3 mr-1" />Design</TabsTrigger>
          <TabsTrigger value="social" className="text-xs h-6 px-3"><Globe className="h-3 w-3 mr-1" />Social Preview</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex flex-col lg:flex-row gap-4">
        <Card className="lg:w-[380px] shrink-0">
          <CardContent className="p-4">
            <ScrollArea className="h-[calc(100vh-340px)] pr-2">
              <BannerDesigner />
            </ScrollArea>
          </CardContent>
        </Card>

        <div className="flex-1 flex flex-col gap-4 min-w-0">
          <Card className="flex-1 min-h-[400px]">
            <CardContent className="p-0 h-full">
              {previewTab === 'design' ? <BannerPreview /> : <BannerSocialPreview />}
            </CardContent>
          </Card>

          {currentRole === 'SCHOOL_ADMIN' && (
            <BannerShareToWebsite />
          )}
        </div>
      </div>
    </div>
  );
}
