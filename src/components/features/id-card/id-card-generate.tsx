'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useAppStore } from '@/store/app-store';
import { Loader2, Search, Download, CheckCircle, XCircle, UserCheck, GraduationCap, DownloadCloud } from 'lucide-react';

interface Person {
  id: string;
  name: string;
  code: string;
  className?: string;
  section?: string;
  department?: string;
}

interface GeneratedCard {
  personId: string;
  personName: string;
  cardId: string;
  status: string;
}

export function IDCardGenerate() {
  const { currentUser } = useAppStore();
  const [personType, setPersonType] = useState<'student' | 'teacher'>('student');
  const [persons, setPersons] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [generatedCards, setGeneratedCards] = useState<GeneratedCard[]>([]);
  const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set());
  const [exportingAll, setExportingAll] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadPersons();
  }, [personType, currentUser?.schoolId]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      loadPersons();
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchQuery]);

  async function loadPersons() {
    if (!currentUser?.schoolId) return;
    setLoading(true);
    try {
      const endpoint = personType === 'student' ? 'students' : 'teachers';
      const params = new URLSearchParams({
        schoolId: currentUser.schoolId,
        limit: '50',
      });
      if (searchQuery) params.set('search', searchQuery);
      const res = await fetch(`/api/${endpoint}?${params}`);
      const data = await res.json();
      const items = (data.data || data || []).map((p: any) => ({
        id: p.id,
        name: p.user?.name || p.name || '',
        code: p.admissionNo || p.employeeNo || '',
        className: p.class?.name || undefined,
        section: p.class?.section || undefined,
        department: p.specialization || p.department || undefined,
      }));
      setPersons(items);
      setTotalCount(data.total || items.length);
    } catch {
      setPersons([]);
    } finally {
      setLoading(false);
    }
  }

  const selectAll = useCallback(() => {
    if (selected.size === persons.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(persons.map(p => p.id)));
    }
  }, [persons, selected]);

  const generateCard = useCallback(async (person: Person) => {
    setGeneratingIds(prev => new Set(prev).add(person.id));
    try {
      const res = await fetch('/api/id-cards/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: currentUser?.schoolId || '',
          personType,
          studentIds: [person.id],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const cardId = data.data?.[0]?.id || '';
        setGeneratedCards(prev => [...prev.filter(c => c.personId !== person.id), {
          personId: person.id,
          personName: person.name,
          cardId,
          status: 'active',
        }]);
        toast.success(`Card generated for ${person.name}`);
      } else {
        toast.error(`Failed to generate card for ${person.name}`);
      }
    } catch {
      toast.error(`Generation failed for ${person.name}`);
    } finally {
      setGeneratingIds(prev => {
        const next = new Set(prev);
        next.delete(person.id);
        return next;
      });
    }
  }, [personType, currentUser?.schoolId]);

  const generateSelected = useCallback(async () => {
    const selectedPersons = persons.filter(p => selected.has(p.id));
    for (const person of selectedPersons) {
      await generateCard(person);
    }
    toast.success(`Generated cards for ${selectedPersons.length} people`);
  }, [persons, selected, generateCard]);

  const downloadCard = useCallback(async (cardId: string, personName: string) => {
    try {
      const res = await fetch(`/api/id-cards/${cardId}/pdf`);
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ID-Card-${personName.replace(/\s+/g, '-')}.html`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Download failed');
    }
  }, []);

  const downloadAll = useCallback(async () => {
    const cardIds = generatedCards.map(c => c.cardId);
    if (cardIds.length === 0) {
      toast.error('No cards to download');
      return;
    }
    setExportingAll(true);
    try {
      const res = await fetch('/api/id-cards/export/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: currentUser?.schoolId || '',
          personType,
          personIds: generatedCards.map(c => c.personId),
        }),
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ID-Cards-${personType === 'student' ? 'Students' : 'Staff'}.html`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Downloaded all cards');
    } catch {
      toast.error('Export failed');
    } finally {
      setExportingAll(false);
    }
  }, [generatedCards, personType, currentUser?.schoolId]);

  const downloadAllPersons = useCallback(async () => {
    setExportingAll(true);
    try {
      const res = await fetch('/api/id-cards/export/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: currentUser?.schoolId || '',
          personType,
        }),
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `All-ID-Cards-${personType === 'student' ? 'Students' : 'Staff'}.html`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Downloading all cards');
    } catch {
      toast.error('Export failed');
    } finally {
      setExportingAll(false);
    }
  }, [personType, currentUser?.schoolId]);

  const generatedPersonIds = new Set(generatedCards.map(c => c.personId));

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {(['student', 'teacher'] as const).map(t => (
            <Button
              key={t}
              variant={personType === t ? 'default' : 'outline'}
              size="sm" onClick={() => { setPersonType(t); setGeneratedCards([]); setSelected(new Set()); }}
              className="h-8 text-xs"
            >
              {t === 'student' ? <GraduationCap className="size-3.5 mr-1.5" /> : <UserCheck className="size-3.5 mr-1.5" />}
              {t === 'student' ? 'Students' : 'Staff'}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:min-w-[240px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-gray-400" />
            <Input
              placeholder={`Search ${personType === 'student' ? 'students' : 'staff'}...`}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="h-8 pl-8 text-xs"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={downloadAllPersons}
            disabled={exportingAll || loading}
          >
            {exportingAll ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : <DownloadCloud className="size-3.5 mr-1.5" />}
            Export All
          </Button>
        </div>
      </div>

      {generatedCards.length > 0 && (
        <div className="flex items-center gap-2 p-2.5 bg-emerald-50 rounded-lg border border-emerald-200">
          <CheckCircle className="size-4 text-emerald-600 flex-shrink-0" />
          <span className="text-xs text-emerald-800 flex-1">{generatedCards.length} card{generatedCards.length > 1 ? 's' : ''} generated</span>
          <div className="flex gap-1.5">
            <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={downloadAll} disabled={exportingAll}>
              <Download className="size-3 mr-1" /> Download Generated
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-[10px] text-red-500" onClick={() => setGeneratedCards([])}>
              <XCircle className="size-3 mr-1" /> Clear
            </Button>
          </div>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-gray-50/80">
                  <th className="text-left p-3 w-10">
                    <input
                      type="checkbox"
                      checked={persons.length > 0 && selected.size === persons.length}
                      onChange={selectAll}
                      className="rounded"
                    />
                  </th>
                  <th className="text-left p-3 font-semibold text-gray-600">Name</th>
                  <th className="text-left p-3 font-semibold text-gray-600">ID</th>
                  <th className="text-left p-3 font-semibold text-gray-600">{personType === 'student' ? 'Class' : 'Department'}</th>
                  <th className="text-left p-3 font-semibold text-gray-600">Status</th>
                  <th className="text-right p-3 font-semibold text-gray-600">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-gray-400">
                      <Loader2 className="size-5 animate-spin mx-auto mb-2" />
                      Loading {personType === 'student' ? 'students' : 'staff'}...
                    </td>
                  </tr>
                ) : persons.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-gray-400">
                      {searchQuery ? 'No results found' : `No ${personType === 'student' ? 'students' : 'staff'} available`}
                    </td>
                  </tr>
                ) : (
                  persons.map(person => {
                    const isGenerated = generatedPersonIds.has(person.id);
                    const isGenerating = generatingIds.has(person.id);
                    const isSelected = selected.has(person.id);
                    return (
                      <tr key={person.id} className={`border-b border-gray-100 hover:bg-gray-50/50 transition-colors ${isGenerated ? 'bg-emerald-50/40' : ''}`}>
                        <td className="p-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              const next = new Set(selected);
                              isSelected ? next.delete(person.id) : next.add(person.id);
                              setSelected(next);
                            }}
                            className="rounded"
                          />
                        </td>
                        <td className="p-3 font-medium">{person.name}</td>
                        <td className="p-3 text-gray-500">{person.code}</td>
                        <td className="p-3 text-gray-500">{person.className || person.department || '-'}</td>
                        <td className="p-3">
                          {isGenerated ? (
                            <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                              <CheckCircle className="size-3 mr-0.5" /> Generated
                            </Badge>
                          ) : (
                            <span className="text-gray-300 text-[10px]">Pending</span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          {isGenerated ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm" variant="ghost"
                                className="h-7 text-[10px] text-indigo-600"
                                onClick={() => {
                                  const card = generatedCards.find(c => c.personId === person.id);
                                  if (card) downloadCard(card.cardId, person.name);
                                }}
                              >
                                <Download className="size-3 mr-1" /> Download
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-[10px]"
                              onClick={() => generateCard(person)}
                              disabled={isGenerating}
                            >
                              {isGenerating ? <Loader2 className="size-3 animate-spin mr-1" /> : null}
                              {isGenerating ? 'Generating...' : 'Generate'}
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {selected.size > 0 && persons.length > 0 && (
        <div className="sticky bottom-0 bg-white border rounded-lg shadow-lg p-3 flex items-center justify-between">
          <span className="text-xs font-medium">
            {selected.size} of {persons.length} selected
          </span>
          <div className="flex gap-2">
            <Button size="sm" className="h-8 text-xs" onClick={generateSelected} disabled={generatingIds.size > 0}>
              {generatingIds.size > 0 ? (
                <Loader2 className="size-3.5 animate-spin mr-1.5" />
              ) : (
                <CheckCircle className="size-3.5 mr-1.5" />
              )}
              Generate {selected.size} Card{selected.size > 1 ? 's' : ''}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
