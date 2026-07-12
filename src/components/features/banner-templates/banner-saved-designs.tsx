'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { useBannerTemplatesStore } from '@/store/banner-templates-store';
import { getSizeDimensions } from '@/lib/banner-templates/types';
import { Save, Trash2, Upload, Clock } from 'lucide-react';
import { toast } from 'sonner';

export function BannerSavedDesigns() {
  const { savedDesigns, loadDesign, deleteSavedDesign, saveDesign, design } = useBannerTemplatesStore();
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveName, setSaveName] = useState(design.name || '');

  const handleSave = () => {
    if (!saveName.trim()) {
      toast.error('Please enter a name');
      return;
    }
    saveDesign(saveName.trim());
    setSaveDialogOpen(false);
    toast.success(`Design "${saveName.trim()}" saved!`);
  };

  const handleDelete = (name: string) => {
    deleteSavedDesign(name);
    toast.success('Design deleted');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Saved Designs</h3>
        <Button size="sm" className="h-7 text-xs" onClick={() => setSaveDialogOpen(true)}>
          <Save className="h-3 w-3 mr-1" /> Save Current
        </Button>
      </div>

      {savedDesigns.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Clock className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No saved designs yet</p>
          <p className="text-xs mt-1">Design a banner and save it for later</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {savedDesigns.map((saved, i) => {
            const { width, height } = getSizeDimensions(saved.size, saved.customWidth, saved.customHeight);
            const bg = saved.colors.gradientStart && saved.colors.gradientEnd
              ? `linear-gradient(135deg, ${saved.colors.gradientStart}, ${saved.colors.gradientEnd})`
              : saved.colors.bg;

            return (
              <Card key={`${saved.name}-${i}`} className="overflow-hidden">
                <div className="aspect-[16/8] relative" style={{ background: bg }}>
                  {saved.title && (
                    <div className="absolute inset-0 flex items-center justify-center p-4">
                      <div className="text-center" style={{ color: saved.colors.text }}>
                        <p className="font-bold text-sm drop-shadow-md">{saved.title}</p>
                      </div>
                    </div>
                  )}
                </div>
                <CardContent className="p-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium">{saved.name}</p>
                      <p className="text-[10px] text-muted-foreground">{width}×{height}px · {saved.size}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { loadDesign(saved); toast.success('Design loaded!'); }}>
                        <Upload className="h-3 w-3 mr-1" /> Load
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleDelete(saved.name)}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save Design</DialogTitle>
            <DialogDescription>Give your banner design a name to save it.</DialogDescription>
          </DialogHeader>
          <Input
            value={saveName}
            onChange={e => setSaveName(e.target.value)}
            placeholder="Design name..."
            onKeyDown={e => e.key === 'Enter' && handleSave()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
