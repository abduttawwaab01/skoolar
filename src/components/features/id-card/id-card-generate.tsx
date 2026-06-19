'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useAppStore } from '@/store/app-store';
import { useIDCardStore } from '@/store/id-card-store';
import { IDCardPreview } from './id-card-preview';
import { Loader2, Search, UserCheck, GraduationCap, CheckCircle, AlertCircle } from 'lucide-react';

export function IDCardGenerate() {
  const { currentUser } = useAppStore();
  const { design, previewSide } = useIDCardStore();
  const [personType, setPersonType] = useState<'student' | 'teacher'>('student');
  const [searchQuery, setSearchQuery] = useState('');
  const [persons, setPersons] = useState<Array<{ id: string; name: string; code: string; className?: string }>>([]);
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generatedId, setGeneratedId] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (searchQuery.length < 1) { setPersons([]); return; }
    const timer = setTimeout(async () => {
      try {
        const endpoint = personType === 'student' ? 'students' : 'teachers';
        const res = await fetch(`/api/${endpoint}?schoolId=${currentUser?.schoolId || ''}&search=${encodeURIComponent(searchQuery)}&limit=8`);
        const data = await res.json();
        const items = (data.data || data || []).map((p: any) => ({
          id: p.id,
          name: p.user?.name || p.name || '',
          code: p.admissionNo || p.employeeNo || '',
          className: p.class?.name || undefined,
        }));
        setPersons(items);
        setShowResults(true);
      } catch { setPersons([]); }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, personType, currentUser?.schoolId]);

  useEffect(() => {
    if (!selectedPerson) { setPreviewHtml(null); return; }
    loadPreview();
  }, [selectedPerson, previewSide, design]);

  const loadPreview = useCallback(async () => {
    if (!selectedPerson) return;
    setPreviewLoading(true);
    try {
      const endpoint = personType === 'student' ? 'studentId' : 'teacherId';
      const res = await fetch('/api/id-cards/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: currentUser?.schoolId || '',
          [endpoint]: selectedPerson,
          side: previewSide,
          design: {
            name: design.name,
            type: design.type,
            orientation: design.orientation,
            colors: design.colors,
            backgroundType: design.backgroundType,
            fontFamily: design.fontFamily,
            fontSize: design.fontSize,
            showPhoto: design.showPhoto,
            showLogo: design.showLogo,
            showQRCode: design.showQRCode,
            showBarcode: design.showBarcode,
            showSignature: design.showSignature,
            showWatermark: design.showWatermark,
            showExpiryDate: design.showExpiryDate,
            showIssueDate: design.showIssueDate,
            showMotto: design.showMotto,
            showAddress: design.showAddress,
            showEmergencyInfo: design.showEmergencyInfo,
            showMedicalInfo: design.showMedicalInfo,
            showTerms: design.showTerms,
            watermarkText: design.watermarkText,
            backText: design.backText,
          },
        }),
      });
      if (res.ok) {
        const html = await res.text();
        setPreviewHtml(html);
      }
    } catch { /* ignore */ }
    finally { setPreviewLoading(false); }
  }, [selectedPerson, previewSide, design, currentUser?.schoolId, personType]);

  const handleGenerate = useCallback(async () => {
    if (!selectedPerson) return;
    setGenerating(true);
    try {
      const res = await fetch('/api/id-cards/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: currentUser?.schoolId || '',
          personType,
          studentIds: [selectedPerson],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setGeneratedId(data.data?.[0]?.id || 'done');
        toast.success('ID card generated successfully');
      } else {
        toast.error('Generation failed');
      }
    } catch {
      toast.error('Generation failed');
    } finally {
      setGenerating(false);
    }
  }, [selectedPerson, personType, currentUser?.schoolId]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Generate Single ID Card</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs font-medium">Person Type</Label>
            <div className="flex gap-2">
              {(['student', 'teacher'] as const).map(t => (
                <Button
                  key={t}
                  variant={personType === t ? 'default' : 'outline'}
                  size="sm" onClick={() => { setPersonType(t); setSelectedPerson(null); setSearchQuery(''); setPreviewHtml(null); }}
                  className="flex-1 h-8 text-xs"
                >
                  {t === 'student' ? <GraduationCap className="size-3.5 mr-1.5" /> : <UserCheck className="size-3.5 mr-1.5" />}
                  {t === 'student' ? 'Student' : 'Staff'}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2" ref={searchRef}>
            <Label className="text-xs font-medium">Search {personType === 'student' ? 'Student' : 'Staff'}</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-gray-400" />
              <input
                type="text"
                placeholder={`Type name or ID to search...`}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onFocus={() => persons.length > 0 && setShowResults(true)}
                className="flex h-8 w-full rounded-md border border-input bg-background pl-8 pr-3 text-xs ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              {showResults && persons.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {persons.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 transition-colors flex items-center justify-between ${selectedPerson === p.id ? 'bg-indigo-50' : ''}`}
                      onClick={() => {
                        setSelectedPerson(p.id);
                        setSearchQuery(`${p.name} (${p.code})`);
                        setShowResults(false);
                      }}
                    >
                      <div>
                        <span className="font-medium">{p.name}</span>
                        <span className="text-gray-400 ml-2 text-[10px]">{p.code}</span>
                        {p.className && <span className="text-gray-400 ml-1 text-[10px]">- {p.className}</span>}
                      </div>
                      {selectedPerson === p.id && <CheckCircle className="size-3.5 text-indigo-600" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {selectedPerson && (
            <div className="flex items-center gap-2 p-2 bg-emerald-50 rounded-md border border-emerald-200">
              <CheckCircle className="size-4 text-emerald-600 flex-shrink-0" />
              <span className="text-xs text-emerald-800 flex-1">Person selected — preview available below</span>
              <button
                onClick={() => { setSelectedPerson(null); setSearchQuery(''); setPreviewHtml(null); }}
                className="text-[10px] text-red-500 hover:text-red-700"
              >
                Clear
              </button>
            </div>
          )}

          {selectedPerson && generatedId ? (
            <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-md border border-blue-200">
              <CheckCircle className="size-4 text-blue-600 flex-shrink-0" />
              <span className="text-xs text-blue-800 flex-1">Card generated successfully</span>
            </div>
          ) : selectedPerson ? (
            <Button onClick={handleGenerate} disabled={generating} size="sm" className="w-full h-8 text-xs">
              {generating ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : <CheckCircle className="size-3.5 mr-1.5" />}
              {generating ? 'Generating...' : 'Generate ID Card'}
            </Button>
          ) : (
            <div className="flex items-center gap-2 p-2 bg-amber-50 rounded-md border border-amber-200">
              <AlertCircle className="size-4 text-amber-600 flex-shrink-0" />
              <span className="text-xs text-amber-800">Search and select a person first</span>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedPerson && (
        <div className="pt-2">
          <IDCardPreview previewHtml={previewHtml} loading={previewLoading} />
        </div>
      )}
    </div>
  );
}
