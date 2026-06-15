'use client';

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { DEFAULT_TEMPLATES, type TemplatePreset } from '@/lib/id-card-utils/default-templates';
import { useIDCardStore } from '@/store/id-card-store';
import { Search, Check, Grid3X3, List, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Props {
  onSelect?: () => void;
}

export function IDCardTemplateLibrary({ onSelect }: Props) {
  const applyTemplate = useIDCardStore((s) => s.applyTemplate);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const categories = [...new Set(DEFAULT_TEMPLATES.map((t) => t.category))];

  const filtered = DEFAULT_TEMPLATES.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase()) ||
      t.category.toLowerCase().includes(search.toLowerCase())
  );

  const handleApply = (template: TemplatePreset) => {
    applyTemplate(template);
    setSelectedId(template.id);
    toast.success(`"${template.name}" applied`);
    setTimeout(() => onSelect?.(), 600);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates..."
            className="h-8 pl-8 text-xs"
          />
        </div>
        <div className="flex border rounded-md">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'ghost'}
            size="sm"
            className="h-7 w-7 p-0 rounded-r-none"
            onClick={() => setViewMode('grid')}
          >
            <Grid3X3 className="size-3" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'ghost'}
            size="sm"
            className="h-7 w-7 p-0 rounded-l-none"
            onClick={() => setViewMode('list')}
          >
            <List className="size-3" />
          </Button>
        </div>
      </div>

      {categories.map((category) => {
        const catTemplates = filtered.filter((t) => t.category === category);
        if (catTemplates.length === 0) return null;
        return (
          <div key={category}>
            <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
              <Sparkles className="size-3" /> {category}
            </h4>
            <div
              className={cn(
                viewMode === 'grid'
                  ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2'
                  : 'space-y-1.5'
              )}
            >
              {catTemplates.map((template) => (
                <Card
                  key={template.id}
                  className={cn(
                    'cursor-pointer transition-all hover:shadow-md border-2',
                    selectedId === template.id ? 'border-primary ring-1 ring-primary' : 'border-transparent'
                  )}
                  onClick={() => handleApply(template)}
                >
                  {viewMode === 'grid' ? (
                    <CardContent className="p-2 space-y-1.5">
                      <div
                        className="w-full h-16 rounded-md flex items-center justify-center relative overflow-hidden"
                        style={{
                          background:
                            template.backgroundType === 'gradient' && template.colors.gradientFrom
                              ? `linear-gradient(135deg, ${template.colors.gradientFrom}, ${template.colors.gradientTo || template.colors.primary})`
                              : template.colors.bg,
                        }}
                      >
                        <div
                          className="absolute top-0 left-0 right-0 h-5"
                          style={{ background: template.colors.headerBg }}
                        />
                        <div
                          className="size-6 rounded-full border-2 z-10"
                          style={{
                            borderColor: template.colors.accent,
                            background: template.colors.secondary,
                          }}
                        />
                        {selectedId === template.id && (
                          <div className="absolute top-1 right-1 bg-primary rounded-full p-0.5">
                            <Check className="size-2.5 text-white" />
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-[10px] font-medium leading-tight truncate">{template.name}</p>
                        <p className="text-[8px] text-muted-foreground leading-tight line-clamp-2 mt-0.5">
                          {template.description}
                        </p>
                      </div>
                      <div className="flex gap-0.5">
                        <Badge variant="outline" className="text-[7px] px-1 py-0 h-3.5">
                          {template.orientation}
                        </Badge>
                        <Badge variant="outline" className="text-[7px] px-1 py-0 h-3.5">
                          {template.fontSize}
                        </Badge>
                      </div>
                    </CardContent>
                  ) : (
                    <CardContent className="p-2 flex items-center gap-3">
                      <div
                        className="w-10 h-8 rounded shrink-0"
                        style={{ background: template.colors.primary }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium">{template.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{template.description}</p>
                      </div>
                      <Badge variant="outline" className="text-[9px]">
                        {template.category}
                      </Badge>
                      <Badge variant="outline" className="text-[9px]">
                        {template.orientation}
                      </Badge>
                      {selectedId === template.id && <Check className="size-3.5 text-primary shrink-0" />}
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          </div>
        );
      })}

      {filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Sparkles className="size-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No templates found</p>
          <p className="text-xs">Try a different search term</p>
        </div>
      )}

      <p className="text-[10px] text-muted-foreground text-center">
        {DEFAULT_TEMPLATES.length} preset templates available
      </p>
    </div>
  );
}
