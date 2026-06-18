'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useAppStore } from '@/store/app-store';
import { useIDCardStore } from '@/store/id-card-store';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Loader2, Download, FileSpreadsheet, FileImage, FileText,
  Check, ChevronDown, ChevronRight, Search, Users, X,
} from 'lucide-react';

type ExportFormat = 'pdf' | 'png' | 'csv';

export function IDCardBulk() {
  const { currentUser } = useAppStore();
  const bulkOrientation = useIDCardStore((s) => s.bulkOrientation);
  const setBulkOrientation = useIDCardStore((s) => s.setBulkOrientation);
  const bulkExporting = useIDCardStore((s) => s.bulkExporting);
  const setBulkExporting = useIDCardStore((s) => s.setBulkExporting);

  const [personType, setPersonType] = useState<'student' | 'teacher' | 'staff'>('student');
  const [people, setPeople] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [designs, setDesigns] = useState<any[]>([]);
  const [selectedDesignId, setSelectedDesignId] = useState('');
  const [exportFormat, setExportFormat] = useState<ExportFormat>('pdf');
  const [showSideBySide, setShowSideBySide] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/id-cards?type=${personType}&limit=500`);
        if (res.ok) {
          const json = await res.json();
          setPeople(json.data || []);
        }
      } catch { /* ignore */ }
      finally { setLoading(false); }
    }
    load();
  }, [personType]);

  useEffect(() => {
    async function loadDesigns() {
      try {
        const res = await fetch('/api/id-card-designs?scope=saved');
        if (res.ok) {
          const json = await res.json();
          setDesigns(json.data || []);
          if (json.data?.length > 0 && !selectedDesignId) {
            setSelectedDesignId(json.data[0].id);
          }
        }
      } catch { /* ignore */ }
    }
    loadDesigns();
  }, []);

  const filtered = people.filter(
    (p) =>
      (p.name || p.user?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.admissionNo || p.employeeNo || p.displayId || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleToggleAll = () => {
    if (selectAll) {
      setSelectedIds(new Set());
      setSelectAll(false);
    } else {
      setSelectedIds(new Set(filtered.map((p) => p.id || p.userId)));
      setSelectAll(true);
    }
  };

  const handleToggle = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
    setSelectAll(next.size === filtered.length && filtered.length > 0);
  };

  const handleGenerate = useCallback(async () => {
    if (selectedIds.size === 0) {
      toast.error('Select at least one person');
      return;
    }
    setBulkExporting(true);
    try {
      const res = await fetch('/api/id-cards/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: personType,
          personIds: Array.from(selectedIds),
          designId: selectedDesignId || undefined,
          orientation: bulkOrientation,
        }),
      });
      if (!res.ok) throw new Error('Generation failed');
      const json = await res.json();
      toast.success(`Generated ${json.count || selectedIds.size} card(s)`);
    } catch {
      toast.error('Failed to generate cards');
    } finally {
      setBulkExporting(false);
    }
  }, [selectedIds, personType, selectedDesignId, bulkOrientation, showSideBySide, setBulkExporting]);

  const handleExport = useCallback(async () => {
    if (selectedIds.size === 0) {
      toast.error('Select at least one person');
      return;
    }
    setBulkExporting(true);
    try {
      const selectedPeople = people.filter(p => selectedIds.has(p.id || p.userId));
      const cards = selectedPeople.map(p => ({
        type: personType,
        personId: p.id || p.userId,
        userId: p.userId,
        name: p.name || p.user?.name || 'Unknown',
        displayId: p.admissionNo || p.employeeNo || p.displayId || 'N/A',
        role: p.role,
        class: p.class?.name || p.department,
        photo: p.photo || null,
      }));
      const res = await fetch('/api/id-cards/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          format: exportFormat,
          type: personType,
          cards,
          scope: 'both',
          orientation: bulkOrientation,
        }),
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const ext = exportFormat === 'pdf' ? 'pdf' : exportFormat === 'csv' ? 'csv' : 'zip';
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `ID-Cards-Bulk-${personType}-${Date.now()}.${ext}`;
      link.click();
      toast.success(`${exportFormat.toUpperCase()} downloaded`);
    } catch {
      toast.error('Export failed');
    } finally {
      setBulkExporting(false);
    }
  }, [selectedIds, personType, selectedDesignId, bulkOrientation, showSideBySide, exportFormat, setBulkExporting]);

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="p-3 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            {(['student', 'teacher', 'staff'] as const).map((t) => (
              <Button
                key={t}
                variant={personType === t ? 'default' : 'outline'}
                size="sm"
                onClick={() => { setPersonType(t); setSelectedIds(new Set()); setSelectAll(false); }}
                className="h-7 text-xs capitalize"
              >
                {t}s
              </Button>
            ))}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[160px]">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search people..."
                className="h-7 pl-7 text-xs"
              />
            </div>
            <select
              value={selectedDesignId}
              onChange={(e) => setSelectedDesignId(e.target.value)}
              className="h-7 text-xs rounded-md border border-input bg-background px-2"
            >
              <option value="">-- Default Design --</option>
              {designs.map((d: any) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Label className="text-xs flex items-center gap-1.5">
              <input type="checkbox" checked={showSideBySide} onChange={() => setShowSideBySide(!showSideBySide)} className="size-3" />
              Side-by-side
            </Label>
            <div className="flex border rounded-md">
              {(['pdf', 'png', 'csv'] as const).map((f) => (
                <Button
                  key={f}
                  variant={exportFormat === f ? 'default' : 'ghost'}
                  size="sm"
                  className="h-6 text-[10px] px-2 rounded-none first:rounded-l-md last:rounded-r-md"
                  onClick={() => setExportFormat(f)}
                >
                  {f.toUpperCase()}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              <Users className="size-3 inline mr-1" />
              {filtered.length} people ({selectedIds.size} selected)
            </p>
            <div className="flex gap-1.5">
              <Button size="sm" onClick={handleGenerate} disabled={bulkExporting} className="h-7 text-xs">
                {bulkExporting ? <Loader2 className="size-3 animate-spin mr-1" /> : <FileText className="size-3 mr-1" />}
                Generate
              </Button>
              <Button size="sm" onClick={handleExport} disabled={bulkExporting} variant="outline" className="h-7 text-xs">
                {bulkExporting ? <Loader2 className="size-3 animate-spin mr-1" /> : <Download className="size-3 mr-1" />}
                Export {exportFormat.toUpperCase()}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-between px-3 py-1.5 border-b bg-muted/30">
            <button onClick={handleToggleAll} className="flex items-center gap-1.5 text-xs font-medium">
              <input type="checkbox" checked={selectAll} onChange={handleToggleAll} className="size-3" />
              Name / ID
            </button>
            <span className="text-[10px] text-muted-foreground">Type</span>
          </div>

          <div className="max-h-[400px] overflow-y-auto scrollbar-thin">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-8 text-xs text-muted-foreground">
                <Users className="size-6 mx-auto mb-1 opacity-40" />
                No people found
              </div>
            ) : (
              filtered.map((p) => {
                const id = p.id || p.userId;
                const name = p.name || p.user?.name || 'Unknown';
                const displayId = p.admissionNo || p.employeeNo || p.displayId || 'N/A';
                return (
                  <div
                    key={id}
                    className={cn(
                      'flex items-center justify-between px-3 py-1.5 border-b last:border-b-0 hover:bg-muted/20 cursor-pointer transition-colors',
                      selectedIds.has(id) && 'bg-primary/5'
                    )}
                    onClick={() => handleToggle(id)}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <input type="checkbox" checked={selectedIds.has(id)} onChange={() => handleToggle(id)} className="size-3 shrink-0" />
                      <div className="size-6 rounded-full bg-muted flex items-center justify-center text-[9px] font-bold text-muted-foreground shrink-0 overflow-hidden">
                        {p.photo || p.user?.avatar ? (
                          <img src={p.photo || p.user?.avatar} className="w-full h-full object-cover" alt="" />
                        ) : (
                          name.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{displayId}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[9px] capitalize shrink-0">
                      {personType}
                    </Badge>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
