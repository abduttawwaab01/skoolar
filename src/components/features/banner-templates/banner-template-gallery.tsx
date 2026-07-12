'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Layout, Image as ImageIcon, Sparkles } from 'lucide-react';
import { useBannerTemplatesStore } from '@/store/banner-templates-store';
import { BANNER_TEMPLATE_PRESETS } from '@/lib/banner-templates/templates';
import { getSizeDimensions } from '@/lib/banner-templates/types';

const CATEGORIES = ['All', ...Array.from(new Set(BANNER_TEMPLATE_PRESETS.map(t => t.category)))];

export function BannerTemplateGallery() {
  const { loadDesign } = useBannerTemplatesStore();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');

  const filtered = useMemo(() => {
    return BANNER_TEMPLATE_PRESETS.filter(t => {
      const matchCat = category === 'All' || t.category === category;
      const matchSearch = !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.description.toLowerCase().includes(search.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [search, category]);

  const handleSelectTemplate = (template: typeof BANNER_TEMPLATE_PRESETS[0]) => {
    const { width, height } = getSizeDimensions(template.defaultSize);
    const design = {
      ...template.design,
      name: template.name,
      size: template.defaultSize,
      customWidth: width,
      customHeight: height,
    };
    loadDesign(design as any);
  };

  const handleStartBlank = () => {
    loadDesign({
      name: 'Custom Banner',
      size: 'website-hero',
      customWidth: 1920,
      customHeight: 1080,
      title: 'Your Title Here',
      subtitle: 'Your subtitle here',
      schoolName: 'Your School Name',
      description: '',
      shapes: [],
    } as any);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map(cat => (
          <Button
            key={cat}
            variant={category === cat ? 'default' : 'outline'}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setCategory(cat)}
          >
            {cat}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        <Card
          className="cursor-pointer hover:border-primary transition-colors group overflow-hidden"
          onClick={handleStartBlank}
        >
          <div className="aspect-[16/10] bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 flex items-center justify-center">
            <div className="text-center">
              <Layout className="h-10 w-10 mx-auto text-muted-foreground group-hover:text-primary transition-colors" />
              <p className="text-xs text-muted-foreground mt-2">Start from scratch</p>
            </div>
          </div>
          <CardContent className="p-3">
            <p className="text-sm font-medium">Blank Canvas</p>
            <p className="text-xs text-muted-foreground">Start with an empty design</p>
          </CardContent>
        </Card>

        {filtered.map((template, i) => {
          const { width, height } = getSizeDimensions(template.defaultSize);
          const colors = template.design.colors;
          const bg = colors?.gradientStart && colors?.gradientEnd
            ? `linear-gradient(135deg, ${colors.gradientStart}, ${colors.gradientEnd})`
            : colors?.bg || '#1d4ed8';

          return (
            <Card
              key={`${template.name}-${i}`}
              className="cursor-pointer hover:border-primary transition-colors group overflow-hidden"
              onClick={() => handleSelectTemplate(template)}
            >
              <div className="aspect-[16/10] relative overflow-hidden" style={{ background: bg }}>
                {template.design.title && (
                  <div className="absolute inset-0 flex items-center justify-center p-3">
                    <div className="text-center" style={{ color: template.design.colors?.text || '#fff' }}>
                      <p className="font-bold text-sm leading-tight drop-shadow-md">{template.design.title}</p>
                      {template.design.subtitle && (
                        <p className="text-xs mt-1 opacity-80 drop-shadow-sm">{template.design.subtitle}</p>
                      )}
                    </div>
                  </div>
                )}
                {template.design.shapes && template.design.shapes.length > 0 && (
                  <div className="absolute top-0 left-0 right-0 h-1.5" style={{ background: template.design.shapes[0]?.color, opacity: 0.9 }} />
                )}
              </div>
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium leading-tight">{template.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{template.description}</p>
                  </div>
                  <Badge variant="secondary" className="text-[10px] shrink-0 px-1.5 py-0">
                    {template.category}
                  </Badge>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {width} × {height}px
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground mt-3">No templates found</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => { setSearch(''); setCategory('All'); }}>
            Clear filters
          </Button>
        </div>
      )}
    </div>
  );
}
