'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Building2, Search, X, School, Check, Loader2, Plus, Trash2, ChevronUp, ChevronDown, ArrowUpDown } from 'lucide-react';

interface SchoolInfo {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  primaryColor: string;
  secondaryColor: string;
  website: string | null;
  region: string | null;
}

interface TrustedSchoolRecord {
  id: string;
  schoolId: string;
  trustedOrder: number;
  school: SchoolInfo;
}

export function TrustedSchoolsManager() {
  const [trusted, setTrusted] = useState<TrustedSchoolRecord[]>([]);
  const [allSchools, setAllSchools] = useState<SchoolInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addSearch, setAddSearch] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [trustedRes, schoolsRes] = await Promise.all([
        fetch('/api/trusted-schools'),
        fetch('/api/schools?limit=500'),
      ]);
      const trustedJson = await trustedRes.json();
      const schoolsJson = await schoolsRes.json();
      setTrusted(trustedJson.data || []);
      setAllSchools(schoolsJson.data || []);
    } catch {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const trustedIds = new Set(trusted.map(t => t.schoolId));

  const addSchool = async (schoolId: string) => {
    setSaving(true);
    try {
      const res = await fetch('/api/trusted-schools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolId }),
      });
      if (!res.ok) {
        const j = await res.json();
        toast.error(j.error || 'Failed to add school');
        return;
      }
      toast.success('School added to trusted list');
      fetchData();
      setAddDialogOpen(false);
      setAddSearch('');
    } catch {
      toast.error('Failed to add school');
    } finally {
      setSaving(false);
    }
  };

  const removeSchool = async (schoolId: string, name: string) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/trusted-schools?schoolId=${schoolId}`, { method: 'DELETE' });
      if (!res.ok) {
        const j = await res.json();
        toast.error(j.error || 'Failed to remove');
        return;
      }
      toast.success(`"${name}" removed from trusted list`);
      fetchData();
    } catch {
      toast.error('Failed to remove school');
    } finally {
      setSaving(false);
    }
  };

  const moveOrder = async (schoolId: string, direction: 'up' | 'down') => {
    const idx = trusted.findIndex(t => t.schoolId === schoolId);
    if (idx === -1) return;
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === trusted.length - 1) return;

    const newOrder = [...trusted];
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    [newOrder[idx], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[idx]];

    const reordered = newOrder.map((t, i) => ({ ...t, trustedOrder: i }));
    setTrusted(reordered);

    try {
      await fetch('/api/trusted-schools/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reorder',
          order: reordered.map(t => t.schoolId),
        }),
      });
    } catch {
      toast.error('Failed to update order');
      fetchData();
    }
  };

  const promoteFirstFive = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/trusted-schools/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'promote-first', count: 5 }),
      });
      if (!res.ok) {
        const j = await res.json();
        toast.error(j.error || 'Failed to promote');
        return;
      }
      const j = await res.json();
      toast.success(`Promoted ${j.count} schools`);
      fetchData();
    } catch {
      toast.error('Failed to promote schools');
    } finally {
      setSaving(false);
    }
  };

  const filteredTrusted = trusted.filter(t =>
    t.school.name.toLowerCase().includes(search.toLowerCase()) ||
    t.school.region?.toLowerCase().includes(search.toLowerCase())
  );

  const availableSchools = allSchools.filter(s => !trustedIds.has(s.id));

  const filteredAvailable = availableSchools.filter(s =>
    s.name.toLowerCase().includes(addSearch.toLowerCase()) ||
    s.region?.toLowerCase().includes(addSearch.toLowerCase())
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-10 w-full max-w-sm" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-100">
            <Building2 className="size-5 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Trusted Schools</h2>
            <p className="text-sm text-muted-foreground">Schools featured in the landing page marquee</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs gap-1">
            <Check className="size-3 text-emerald-500" />
            {trusted.length} featured
          </Badge>
          <Button variant="outline" size="sm" onClick={promoteFirstFive} disabled={saving} className="text-xs gap-1">
            {saving ? <Loader2 className="size-3 animate-spin" /> : <ArrowUpDown className="size-3" />}
            {saving ? 'Working...' : <><span className="sm:hidden">Promote</span><span className="hidden sm:inline">Promote First 5</span></>}
          </Button>
          <Button size="sm" onClick={() => setAddDialogOpen(true)} className="text-xs gap-1">
            <Plus className="size-3" /> <span className="hidden sm:inline">Add School</span>
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative w-full max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Search trusted schools..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 pr-8"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {/* Empty State */}
      {trusted.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="size-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">No schools featured yet</p>
            <p className="text-xs text-muted-foreground mt-1 mb-4">
              Add schools to feature them on the landing page
            </p>
            <Button size="sm" onClick={() => setAddDialogOpen(true)}>
              <Plus className="size-3 mr-1" /> Add Your First School
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Desktop: Table view */}
      {trusted.length > 0 && (
        <Card className="hidden sm:block">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Featured Schools</CardTitle>
            <CardDescription>{filteredTrusted.length} school{filteredTrusted.length !== 1 ? 's' : ''}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="py-3 px-4 text-left font-medium text-muted-foreground text-xs w-20">Order</th>
                    <th className="py-3 px-4 text-left font-medium text-muted-foreground text-xs">School</th>
                    <th className="py-3 px-4 text-center font-medium text-muted-foreground text-xs hidden md:table-cell">Region</th>
                    <th className="py-3 px-4 text-center font-medium text-muted-foreground text-xs w-24">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTrusted.length === 0 && (
                    <tr><td colSpan={4} className="py-12 text-center text-muted-foreground">No matches found</td></tr>
                  )}
                  {filteredTrusted.map((t, i) => (
                    <tr key={t.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-muted-foreground w-4">{i + 1}</span>
                          <div className="flex flex-col">
                            <button
                              onClick={() => moveOrder(t.schoolId, 'up')}
                              disabled={i === 0 || saving}
                              className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                            >
                              <ChevronUp className="size-3" />
                            </button>
                            <button
                              onClick={() => moveOrder(t.schoolId, 'down')}
                              disabled={i === filteredTrusted.length - 1 || saving}
                              className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                            >
                              <ChevronDown className="size-3" />
                            </button>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="flex size-9 items-center justify-center rounded-lg shrink-0"
                            style={{ backgroundColor: t.school.primaryColor ? `${t.school.primaryColor}20` : '#f0fdf4' }}
                          >
                            {t.school.logo ? (
                              <img src={t.school.logo} alt="" className="h-7 w-7 rounded object-cover" />
                            ) : (
                              <School className="size-4" style={{ color: t.school.primaryColor || '#059669' }} />
                            )}
                          </div>
                          <div className="min-w-0 max-w-[200px]">
                            <p className="font-medium truncate text-sm">{t.school.name}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center hidden md:table-cell">
                        <span className="text-xs text-muted-foreground">{t.school.region || '—'}</span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeSchool(t.schoolId, t.school.name)}
                          disabled={saving}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 size-8"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Mobile: Card view */}
      {trusted.length > 0 && (
        <div className="sm:hidden space-y-3">
          {filteredTrusted.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">No matches found</p>
          )}
          {filteredTrusted.map((t, i) => (
            <Card key={t.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="flex items-center justify-center size-5 rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-700 shrink-0">
                      {i + 1}
                    </div>
                    <div
                      className="flex size-10 items-center justify-center rounded-lg shrink-0"
                      style={{ backgroundColor: t.school.primaryColor ? `${t.school.primaryColor}20` : '#f0fdf4' }}
                    >
                      {t.school.logo ? (
                        <img src={t.school.logo} alt="" className="h-8 w-8 rounded object-cover" />
                      ) : (
                        <School className="size-5" style={{ color: t.school.primaryColor || '#059669' }} />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{t.school.name}</p>
                      {t.school.region && (
                        <p className="text-[11px] text-muted-foreground truncate">{t.school.region}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => moveOrder(t.schoolId, 'up')}
                      disabled={i === 0 || saving}
                      className="size-8"
                    >
                      <ChevronUp className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => moveOrder(t.schoolId, 'down')}
                      disabled={i === filteredTrusted.length - 1 || saving}
                      className="size-8"
                    >
                      <ChevronDown className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeSchool(t.schoolId, t.school.name)}
                      disabled={saving}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 size-8"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add School Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={(open) => { setAddDialogOpen(open); if (!open) setAddSearch(''); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Trusted School</DialogTitle>
          </DialogHeader>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search schools..."
              value={addSearch}
              onChange={(e) => setAddSearch(e.target.value)}
              className="pl-9"
              autoFocus
            />
          </div>
          <div className="max-h-64 overflow-y-auto space-y-1">
            {filteredAvailable.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-6">
                {addSearch ? 'No schools match your search' : 'All schools are already trusted'}
              </p>
            )}
            {filteredAvailable.map((s) => (
              <button
                key={s.id}
                onClick={() => addSchool(s.id)}
                disabled={saving}
                className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors text-left disabled:opacity-50"
              >
                <div
                  className="flex size-8 items-center justify-center rounded-lg shrink-0"
                  style={{ backgroundColor: s.primaryColor ? `${s.primaryColor}20` : '#f0fdf4' }}
                >
                  {s.logo ? (
                    <img src={s.logo} alt="" className="h-6 w-6 rounded object-cover" />
                  ) : (
                    <School className="size-4" style={{ color: s.primaryColor || '#059669' }} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{s.name}</p>
                  {s.region && <p className="text-[11px] text-muted-foreground truncate">{s.region}</p>}
                </div>
                <Plus className="size-4 text-muted-foreground shrink-0" />
              </button>
            ))}
          </div>
          <DialogFooter className="sm:justify-start">
            <Button variant="outline" size="sm" onClick={() => setAddDialogOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
