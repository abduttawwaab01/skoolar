'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Sparkles, Check } from 'lucide-react';
import { CERTIFICATE_TEMPLATES } from '@/lib/certificate-utils/templates';
import { CERTIFICATE_TYPES } from '@/lib/certificate-utils/types';
import { useCertificateStore } from '@/store/certificate-store';

export function CertificateTemplates() {
  const { loadDesign } = useCertificateStore();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string | null>(null);

  const categories = [...new Set(CERTIFICATE_TEMPLATES.map(t => t.category))];
  const types = [...new Set(CERTIFICATE_TEMPLATES.map(t => t.type))];

  const filtered = CERTIFICATE_TEMPLATES.filter(t => {
    if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (category && t.category !== category) return false;
    return true;
  });

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 p-4 border-b">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          <Button
            variant={category === null ? 'default' : 'outline'}
            size="sm"
            onClick={() => setCategory(null)}
          >
            All
          </Button>
          {categories.map(cat => (
            <Button
              key={cat}
              variant={category === cat ? 'default' : 'outline'}
              size="sm"
              onClick={() => setCategory(category === cat ? null : cat)}
            >
              {cat}
            </Button>
          ))}
        </div>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((template, idx) => (
            <Card key={idx} className="group hover:shadow-lg transition-shadow cursor-pointer" onClick={() => loadDesign(template.design)}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{template.name}</CardTitle>
                    <CardDescription className="text-xs mt-1">{template.description}</CardDescription>
                  </div>
                  <Badge variant="secondary" className="text-[10px]">{template.category}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                  <Sparkles className="h-3 w-3" />
                  <span>{CERTIFICATE_TYPES[template.type]}</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Badge variant="outline" className="text-[10px]">{template.design.fontFamily.split(',')[0].replace(/"/g, '')}</Badge>
                  <Badge variant="outline" className="text-[10px]">{template.design.foilStyle !== 'none' ? template.design.foilStyle + ' foil' : 'no foil'}</Badge>
                  <Badge variant="outline" className="text-[10px]">{template.design.borderStyle} border</Badge>
                </div>
                <Button size="sm" className="w-full mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Check className="h-3 w-3 mr-1" />
                  Apply Template
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
