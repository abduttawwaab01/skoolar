'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Building2, Search, X, School, Check, Loader2 } from 'lucide-react';
import { handleSilentError } from '@/lib/error-handler';

interface School {
  id: string;
  name: string;
  email: string | null;
  logo: string | null;
  primaryColor: string;
  region: string | null;
  plan: string;
  isActive: boolean;
  isTrusted: boolean;
  trustedOrder: number;
  _count: { students: number; teachers: number };
}

export function TrustedSchoolsManager() {
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const fetchSchools = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/schools?limit=200');
      const json = await res.json();
      setSchools(json.data || []);
    } catch (error: unknown) { handleSilentError(error); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchSchools(); }, [fetchSchools]);

  const filtered = React.useMemo(() => {
    if (!search.trim()) return schools;
    const q = search.toLowerCase();
    return schools.filter((s) => s.name.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q) || s.region?.toLowerCase().includes(q));
  }, [schools, search]);

  const trusted = schools.filter((s) => s.isTrusted).sort((a, b) => a.trustedOrder - b.trustedOrder);

  const toggleTrusted = async (school: School) => {
    setSavingId(school.id);
    const newTrusted = !school.isTrusted;
    const order = newTrusted ? schools.filter(s => s.isTrusted && s.id !== school.id).length : 0;

    // Optimistic update
    setSchools(prev => prev.map(s => s.id === school.id ? { ...s, isTrusted: newTrusted, trustedOrder: order } : s));

    try {
      const res = await fetch('/api/trusted-schools', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolId: school.id, isTrusted: newTrusted, trustedOrder: order }),
      });
      if (res.ok) {
        toast.success(newTrusted ? `"${school.name}" added to Trusted Schools` : `"${school.name}" removed from Trusted Schools`);
      } else {
        const j = await res.json();
        toast.error(j.error || 'Failed to update');
        setSchools(prev => prev.map(s => s.id === school.id ? { ...s, isTrusted: !newTrusted, trustedOrder: s.id === school.id ? school.trustedOrder : s.trustedOrder } : s));
      }
    } catch {
      toast.error('Failed to update');
      setSchools(prev => prev.map(s => s.id === school.id ? { ...s, isTrusted: !newTrusted } : s));
    } finally { setSavingId(null); }
  };

  const updateLogo = async (schoolId: string, logo: string) => {
    setSavingId(schoolId);
    setSchools(prev => prev.map(s => s.id === schoolId ? { ...s, logo } : s));
    try {
      const res = await fetch('/api/trusted-schools', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolId, logo }),
      });
      if (res.ok) {
        toast.success('Logo updated');
      } else {
        const j = await res.json();
        toast.error(j.error || 'Failed to update logo');
      }
    } catch { toast.error('Failed to update logo'); } finally { setSavingId(null); }
  };

  const updateOrder = async (schoolId: string, trustedOrder: number) => {
    setSchools(prev => prev.map(s => s.id === schoolId ? { ...s, trustedOrder } : s));
    try {
      await fetch('/api/trusted-schools', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolId, trustedOrder }),
      });
    } catch { /* silent */ }
  };

  const promoteFirstFive = async () => {
    if (savingId !== null) return; // Prevent multiple simultaneous promotions
    
    setSavingId('promote-all');
    try {
      const response = await fetch('/api/schools?limit=5');
      const data = await response.json();
      
      if (!data.data || data.data.length === 0) {
        toast.error('No schools available to promote');
        return;
      }
      
      await Promise.all(
        data.data.map((school: School, index: number) => 
          fetch('/api/trusted-schools', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              schoolId: school.id,
              isTrusted: true,
              trustedOrder: index
            })
          })
        )
      );
      
      toast.success(`Promoted ${data.data.length} schools to trusted!`);
      fetchSchools(); // Refresh the list
    } catch (error) {
      toast.error('Failed to promote schools');
    } finally {
      setSavingId(null);
    }
  };

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
            <p className="text-sm text-muted-foreground">Select schools to feature in the &ldquo;Trusted by&rdquo; marquee on the landing page</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs gap-1">
            <Check className="size-3 text-emerald-500" />
            {trusted.length} featured
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={promoteFirstFive}
            disabled={savingId !== null}
            className="text-xs gap-1"
          >
            {savingId === 'promote-all' ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <School className="size-3" />
            )}
            {savingId === 'promote-all' ? 'Promoting...' : 'Promote First 5'}
          </Button>
        </div>
      </div>

      {/* Marquee Preview */}
      {trusted.length > 0 && (
        <Card className="border-emerald-200 bg-gradient-to-r from-emerald-50/50 to-teal-50/50 overflow-hidden">
          <CardContent className="p-3 sm:p-4">
            <p className="text-xs font-medium text-muted-foreground mb-3">Landing Page Preview</p>
            <div className="relative overflow-hidden -mx-1">
              <div className="flex animate-marquee gap-4 sm:gap-8 whitespace-nowrap py-2">
                {[...trusted, ...trusted].map((s, i) => (
                  <span
                    key={`${s.id}-${i}`}
                    className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-[11px] sm:text-sm font-semibold shrink-0"
                    style={{
                      backgroundColor: s.primaryColor ? `${s.primaryColor}15` : '#f0fdf4',
                      color: s.primaryColor || '#059669',
                      border: `1px solid ${s.primaryColor ? `${s.primaryColor}30` : '#bbf7d0'}`,
                    }}
                  >
                    {s.logo ? (
                      <img src={s.logo} alt="" className="h-4 w-4 sm:h-5 sm:w-5 rounded-full object-cover" />
                    ) : (
                      <School className="size-3.5 sm:size-4" />
                    )}
                    <span className="truncate max-w-[80px] sm:max-w-none">{s.name}</span>
                  </span>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {trusted.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="size-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">No schools featured yet</p>
            <p className="text-xs text-muted-foreground mt-1">Toggle schools below to feature them on the landing page</p>
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <div className="relative w-full max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Search schools..."
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

      {/* Schools Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">All Schools</CardTitle>
          <CardDescription>{filtered.length} school{filtered.length !== 1 ? 's' : ''}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="py-3 px-4 text-left font-medium text-muted-foreground text-xs">School</th>
                  <th className="py-3 px-4 text-center font-medium text-muted-foreground text-xs hidden sm:table-cell">Students</th>
                  <th className="py-3 px-4 text-center font-medium text-muted-foreground text-xs hidden sm:table-cell">Plan</th>
                  <th className="py-3 px-4 text-center font-medium text-muted-foreground text-xs">Trusted</th>
                  <th className="py-3 px-4 text-center font-medium text-muted-foreground text-xs hidden md:table-cell">Order</th>
                  <th className="py-3 px-4 text-left font-medium text-muted-foreground text-xs hidden lg:table-cell">Logo URL</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={6} className="py-12 text-center text-muted-foreground">No schools found</td></tr>
                )}
                {filtered.map((s) => (
                  <tr key={s.id} className={`border-b last:border-0 hover:bg-muted/30 transition-colors ${s.isTrusted ? 'bg-emerald-50/30' : ''}`}>
                    <td className="py-3 px-2 sm:px-4">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className="flex size-8 sm:size-9 items-center justify-center rounded-lg shrink-0" style={{ backgroundColor: s.primaryColor ? `${s.primaryColor}20` : '#f0fdf4' }}>
                          {s.logo ? (
                            <img src={s.logo} alt="" className="h-6 w-6 sm:h-7 sm:w-7 rounded object-cover" />
                          ) : (
                            <School className="size-3.5 sm:size-4" style={{ color: s.primaryColor || '#059669' }} />
                          )}
                        </div>
                        <div className="min-w-0 max-w-[120px] sm:max-w-[180px]">
                          <p className="font-medium truncate text-xs sm:text-sm">{s.name}</p>
                          <p className="text-[10px] sm:text-[11px] text-muted-foreground truncate">{s.region || s.email || ''}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-2 sm:px-4 text-center hidden sm:table-cell text-xs sm:text-sm">{s._count?.students || 0}</td>
                    <td className="py-3 px-2 sm:px-4 text-center hidden sm:table-cell">
                      <Badge variant="outline" className="text-[10px]">{s.plan}</Badge>
                    </td>
                    <td className="py-3 px-2 sm:px-4 text-center">
                      <div className="flex justify-center">
                        <Switch
                          checked={s.isTrusted}
                          onCheckedChange={() => toggleTrusted(s)}
                          disabled={savingId === s.id}
                        />
                      </div>
                    </td>
                    <td className="py-3 px-2 sm:px-4 text-center hidden md:table-cell">
                      {s.isTrusted ? (
                        <Input
                          type="number"
                          min={0}
                          value={s.trustedOrder}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0;
                            updateOrder(s.id, val);
                          }}
                          className="w-14 sm:w-16 h-7 sm:h-8 text-xs text-center mx-auto"
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-3 px-2 sm:px-4 hidden lg:table-cell">
                      {s.isTrusted ? (
                        <div className="flex items-center gap-2">
                          <Input
                            value={s.logo || ''}
                            onChange={(e) => {
                              if (savingId === s.id) return;
                              updateLogo(s.id, e.target.value);
                            }}
                            placeholder="Logo URL"
                            className="h-7 sm:h-8 text-xs"
                          />
                          {savingId === s.id && <Loader2 className="size-3.5 animate-spin shrink-0 text-muted-foreground" />}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
