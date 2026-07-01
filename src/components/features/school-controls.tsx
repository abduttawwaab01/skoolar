'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Search, Building2, Shield, Save, Loader2, CheckCircle2, Globe, Settings,
  SearchX, UserCheck, ChevronRight, AlertTriangle,
} from 'lucide-react';
import { PLATFORM_FEATURES, USER_ROLES } from '@/lib/feature-registry';
import { toast } from 'sonner';

// ─── Types ──────────────────────────────────────────────────────────────────

interface School {
  id: string;
  name: string;
  slug: string;
  plan: string;
  isActive: boolean;
  primaryColor: string;
  _count: { students: number; teachers: number; classes: number };
}

interface SchoolControlsData {
  schoolId: string;
  schoolName: string;
  disabledFeatures: string[];
  disabledUserRoles: string[];
  globallyDisabledFeatures: string[];
  globallyDisabledRoles: string[];
  globalDisabledOverrides: string[];
  schoolSpecificDisabledFeatures: string[];
  schoolSpecificDisabledRoles: string[];
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function SchoolControlsPanel() {
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Detail dialog
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [controls, setControls] = useState<SchoolControlsData | null>(null);
  const [localDisabledFeatures, setLocalDisabledFeatures] = useState<Set<string>>(new Set());
  const [localDisabledRoles, setLocalDisabledRoles] = useState<Set<string>>(new Set());
  const [localOverrides, setLocalOverrides] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [loadingControls, setLoadingControls] = useState(false);

  // Fetch schools
  useEffect(() => {
    const fetchSchools = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/schools?limit=100');
        if (!res.ok) throw new Error('Failed');
        const json = await res.json();
        setSchools(json.data || []);
      } catch {
        toast.error('Failed to load schools');
      } finally {
        setLoading(false);
      }
    };
    fetchSchools();
  }, []);

  // Filtered schools
  const filteredSchools = schools.filter(s =>
    !searchQuery || s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Open school controls dialog
  const openSchoolControls = async (school: School) => {
    setSelectedSchool(school);
    setDialogOpen(true);
    setLoadingControls(true);
    setLocalDisabledFeatures(new Set());
    setLocalDisabledRoles(new Set());
    setLocalOverrides(new Set());

    try {
      const res = await fetch(`/api/schools/${school.id}/controls`);
      if (res.ok) {
        const json = await res.json();
        const data = json.data as SchoolControlsData;
        setControls(data);
        setLocalDisabledFeatures(new Set(data.disabledFeatures || []));
        setLocalDisabledRoles(new Set(data.disabledUserRoles || []));
        setLocalOverrides(new Set(data.globalDisabledOverrides || []));
      } else {
        setControls({
          schoolId: school.id, schoolName: school.name,
          disabledFeatures: [], disabledUserRoles: [],
          globallyDisabledFeatures: [], globallyDisabledRoles: [],
          globalDisabledOverrides: [], schoolSpecificDisabledFeatures: [],
          schoolSpecificDisabledRoles: [],
        });
      }
    } catch {
      setControls({
        schoolId: school.id, schoolName: school.name,
        disabledFeatures: [], disabledUserRoles: [],
        globallyDisabledFeatures: [], globallyDisabledRoles: [],
        globalDisabledOverrides: [], schoolSpecificDisabledFeatures: [],
        schoolSpecificDisabledRoles: [],
      });
    } finally {
      setLoadingControls(false);
    }
  };

  // Compute if a feature is globally disabled (and not overridden)
  const isGloballyDisabled = (featureId: string): boolean => {
    if (!controls) return false;
    return controls.globallyDisabledFeatures.includes(featureId) && !localOverrides.has(featureId);
  };

  const isRoleGloballyDisabled = (roleId: string): boolean => {
    if (!controls) return false;
    return controls.globallyDisabledRoles.includes(roleId) && !localOverrides.has(roleId);
  };

  // Toggle feature
  const toggleFeature = (featureId: string) => {
    const isGloballyDis = controls?.globallyDisabledFeatures.includes(featureId) || false;

    if (isGloballyDis) {
      // Toggle override for globally disabled feature
      setLocalOverrides(prev => {
        const next = new Set(prev);
        if (next.has(featureId)) {
          next.delete(featureId);
          // Also ensure it appears in disabled features
          setLocalDisabledFeatures(d => new Set(d).add(featureId));
        } else {
          next.add(featureId);
          // Remove from effective disabled
          setLocalDisabledFeatures(d => {
            const nd = new Set(d);
            nd.delete(featureId);
            return nd;
          });
        }
        return next;
      });
    } else {
      // Normal toggle (not globally disabled)
      setLocalDisabledFeatures(prev => {
        const next = new Set(prev);
        if (next.has(featureId)) {
          next.delete(featureId);
        } else {
          next.add(featureId);
        }
        return next;
      });
    }
  };

  // Toggle role
  const toggleRole = (roleId: string) => {
    const isGloballyDis = controls?.globallyDisabledRoles.includes(roleId) || false;

    if (isGloballyDis) {
      setLocalOverrides(prev => {
        const next = new Set(prev);
        if (next.has(roleId)) {
          next.delete(roleId);
          setLocalDisabledRoles(d => new Set(d).add(roleId));
        } else {
          next.add(roleId);
          setLocalDisabledRoles(d => {
            const nd = new Set(d);
            nd.delete(roleId);
            return nd;
          });
        }
        return next;
      });
    } else {
      setLocalDisabledRoles(prev => {
        const next = new Set(prev);
        if (next.has(roleId)) {
          next.delete(roleId);
        } else {
          next.add(roleId);
        }
        return next;
      });
    }
  };

  // Save controls
  const handleSave = async () => {
    if (!selectedSchool) return;
    try {
      setSaving(true);

      const globallyDisabled = controls?.globallyDisabledFeatures || [];
      const globallyDisabledR = controls?.globallyDisabledRoles || [];

      // School-specific disabled features = effective disabled minus globally disabled (that are not overridden)
      const schoolFeatures: string[] = [];
      for (const f of localDisabledFeatures) {
        if (globallyDisabled.includes(f) && !localOverrides.has(f)) continue;
        schoolFeatures.push(f);
      }

      const schoolRoles: string[] = [];
      for (const r of localDisabledRoles) {
        if (globallyDisabledR.includes(r) && !localOverrides.has(r)) continue;
        schoolRoles.push(r);
      }

      const res = await fetch(`/api/schools/${selectedSchool.id}/controls`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          disabledFeatures: schoolFeatures,
          disabledUserRoles: schoolRoles,
          globalDisabledOverrides: Array.from(localOverrides),
        }),
      });
      if (!res.ok) throw new Error('Failed to save');
      toast.success(`Controls updated for ${selectedSchool.name}`);
      setDialogOpen(false);
    } catch {
      toast.error('Failed to save controls');
    } finally {
      setSaving(false);
    }
  };

  const planBadge = (plan: string) => {
    const colors: Record<string, string> = {
      enterprise: 'bg-emerald-100 text-emerald-700',
      pro: 'bg-blue-100 text-blue-700',
      basic: 'bg-gray-100 text-gray-600',
    };
    return <Badge variant="outline" className={colors[plan] || colors.basic}>{plan}</Badge>;
  };

  // Count actually disabled features (not disabled due to global)
  const effectiveFeatureCount = [...localDisabledFeatures].filter(f => {
    if (!controls) return true;
    return !(controls.globallyDisabledFeatures.includes(f) && !localOverrides.has(f));
  }).length;

  const effectiveRoleCount = [...localDisabledRoles].filter(r => {
    if (!controls) return true;
    return !(controls.globallyDisabledRoles.includes(r) && !localOverrides.has(r));
  }).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">School Feature Controls</h1>
        <p className="text-muted-foreground">Enable or disable features and user roles per school</p>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search schools..."
            className="pl-9"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <Badge variant="outline">{filteredSchools.length} schools</Badge>
      </div>

      {/* Schools Grid */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : filteredSchools.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-8 flex flex-col items-center justify-center text-center gap-3">
            <SearchX className="size-12 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No schools found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredSchools.map(school => {
            const data = controls?.schoolId === school.id ? controls : null;
            const disabledCount = data?.schoolSpecificDisabledFeatures.length || 0;
            const roleCount = data?.schoolSpecificDisabledRoles.length || 0;
            const globalCount = data?.globallyDisabledFeatures.length || 0;

            return (
              <Card
                key={school.id}
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => openSchoolControls(school)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div
                      className="size-10 rounded-lg flex items-center justify-center text-white font-bold text-xs shrink-0"
                      style={{ backgroundColor: school.primaryColor || '#059669' }}
                    >
                      {school.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{school.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {planBadge(school.plan)}
                        <span className="text-xs text-muted-foreground">
                          {(school._count?.students || 0)} students
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {globalCount > 0 && (
                          <Badge variant="outline" className="text-[10px] text-blue-600 border-blue-200 bg-blue-50">
                            🌐 {globalCount} globally off
                          </Badge>
                        )}
                        {disabledCount > 0 && (
                          <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-200 bg-amber-50">
                            {disabledCount} school-off
                          </Badge>
                        )}
                        {roleCount > 0 && (
                          <Badge variant="outline" className="text-[10px] text-red-600 border-red-200 bg-red-50">
                            {roleCount} roles off
                          </Badge>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="size-4 text-muted-foreground shrink-0 mt-1" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Controls Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[95vh] sm:max-h-[90vh] flex flex-col p-0 overflow-hidden gap-0">
          <DialogHeader className="p-6 border-b shrink-0 bg-background/95 backdrop-blur-xs">
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <Building2 className="size-5 text-emerald-600" />
              {selectedSchool?.name} — Feature Controls
            </DialogTitle>
            <DialogDescription className="mt-1 text-xs">
              Features disabled globally (via the <strong>Features</strong> panel) are marked with 🌐.
              Toggle them ON for this school to override the global setting.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {loadingControls ? (
              <div className="space-y-4 py-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-5 w-10" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-6">
                {/* Features Section */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <Settings className="size-4 text-emerald-600" />
                      Platform Features
                      {localDisabledFeatures.size > 0 && (
                        <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-200 bg-amber-50">
                          {effectiveFeatureCount} disabled
                        </Badge>
                      )}
                    </h3>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs h-7 hover:bg-muted"
                        onClick={() => setLocalDisabledFeatures(new Set(PLATFORM_FEATURES.map(f => f.id)))}
                      >
                        Disable All
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs h-7 hover:bg-muted"
                        onClick={() => {
                          setLocalDisabledFeatures(new Set());
                          setLocalOverrides(new Set());
                        }}
                      >
                        Enable All
                      </Button>
                    </div>
                  </div>
                  <div className="border border-muted/80 rounded-lg shadow-2xs overflow-hidden">
                    <div className="divide-y divide-muted/50 max-h-[350px] overflow-y-auto">
                      {PLATFORM_FEATURES.map(feature => {
                        const isGloballyDis = isGloballyDisabled(feature.id);
                        const isDisabled = localDisabledFeatures.has(feature.id);
                        const isOverridden = localOverrides.has(feature.id);
                        const Icon = feature.icon;
                        return (
                          <div
                            key={feature.id}
                            className={`flex items-center justify-between p-3 hover:bg-muted/30 transition-colors ${isDisabled && !isOverridden ? 'opacity-50 bg-muted/10' : ''}`}
                          >
                            <div className="flex items-center gap-3 min-w-0 mr-4">
                              <div className={`size-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${isGloballyDis ? 'bg-blue-100/80 text-blue-600' : isDisabled ? 'bg-muted text-muted-foreground' : 'bg-emerald-100/80 text-emerald-600'}`}>
                                {isGloballyDis ? <Globe className="size-4" /> : <Icon className="size-4" />}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-foreground/90 leading-none mb-1 flex items-center gap-1.5">
                                  {feature.label}
                                  {isGloballyDis && !isOverridden && (
                                    <Badge variant="outline" className="text-[9px] text-blue-600 border-blue-200 bg-blue-50 leading-none">
                                      🌐 Globally OFF
                                    </Badge>
                                  )}
                                  {isGloballyDis && isOverridden && (
                                    <Badge variant="outline" className="text-[9px] text-emerald-600 border-emerald-200 bg-emerald-50 leading-none">
                                      ↺ Override ON
                                    </Badge>
                                  )}
                                </p>
                                <p className="text-[11px] text-muted-foreground line-clamp-1">{feature.description}</p>
                              </div>
                            </div>
                            <Switch
                              checked={isOverridden || (!isGloballyDis && !isDisabled)}
                              onCheckedChange={() => toggleFeature(feature.id)}
                              className="data-[state=checked]:bg-emerald-600 shrink-0"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <Separator className="bg-muted/60" />

                {/* User Roles Section */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <UserCheck className="size-4 text-blue-600" />
                      User Roles
                      {localDisabledRoles.size > 0 && (
                        <Badge variant="outline" className="text-[10px] text-red-600 border-red-200 bg-red-50">
                          {effectiveRoleCount} disabled
                        </Badge>
                      )}
                    </h3>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs h-7 hover:bg-muted"
                        onClick={() => setLocalDisabledRoles(new Set(USER_ROLES.map(r => r.id)))}
                      >
                        Disable All
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs h-7 hover:bg-muted"
                        onClick={() => {
                          setLocalDisabledRoles(new Set());
                          setLocalOverrides(new Set());
                        }}
                      >
                        Enable All
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {USER_ROLES.map(role => {
                      const isGloballyDis = isRoleGloballyDisabled(role.id);
                      const isDisabled = localDisabledRoles.has(role.id);
                      const isOverridden = localOverrides.has(role.id);
                      const Icon = role.icon;
                      return (
                        <Card key={role.id} className={`border border-muted/80 shadow-2xs transition-all hover:shadow-2xs ${isDisabled && !isOverridden ? 'opacity-50 bg-muted/10' : ''}`}>
                          <CardContent className="p-3.5 flex items-center justify-between">
                            <div className="flex items-center gap-3 mr-4 min-w-0">
                              <div className={`size-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${isGloballyDis ? 'bg-blue-100/80 text-blue-600' : isDisabled ? 'bg-muted text-muted-foreground' : 'bg-blue-100/80 text-blue-600'}`}>
                                {isGloballyDis ? <Globe className="size-4" /> : <Icon className="size-4" />}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-foreground/90 leading-none mb-1 flex items-center gap-1.5">
                                  {role.label}
                                  {isGloballyDis && !isOverridden && (
                                    <Badge variant="outline" className="text-[9px] text-blue-600 border-blue-200 bg-blue-50 leading-none">
                                      🌐 Globally OFF
                                    </Badge>
                                  )}
                                  {isGloballyDis && isOverridden && (
                                    <Badge variant="outline" className="text-[9px] text-emerald-600 border-emerald-200 bg-emerald-50 leading-none">
                                      ↺ Override ON
                                    </Badge>
                                  )}
                                </p>
                                <p className="text-[11px] text-muted-foreground line-clamp-1">{role.description}</p>
                              </div>
                            </div>
                            <Switch
                              checked={isOverridden || (!isGloballyDis && !isDisabled)}
                              onCheckedChange={() => toggleRole(role.id)}
                              className="data-[state=checked]:bg-blue-600 shrink-0"
                            />
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>

                {localOverrides.size > 0 && (
                  <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50/70 p-4 shadow-2xs">
                    <Globe className="size-5 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-blue-800">Global Overrides Active</p>
                      <p className="text-[11px] text-blue-700 leading-relaxed mt-1">
                        This school has <strong>{localOverrides.size} override(s)</strong> that re-enable
                        globally disabled features/roles. The school will be able to use these features
                        even though they are turned off globally.
                      </p>
                    </div>
                  </div>
                )}

                {(localDisabledFeatures.size > 0 || localDisabledRoles.size > 0) && (
                  <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/70 p-4 shadow-2xs">
                    <AlertTriangle className="size-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-amber-800">Warning</p>
                      <p className="text-[11px] text-amber-700 leading-relaxed mt-1">
                        You have disabled features and/or user roles for this school.
                        Disabled features will be hidden from the school&apos;s navigation and UI.
                        Users with disabled roles will not be able to log in.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="p-4 border-t bg-muted/30 shrink-0 flex justify-end gap-3 sticky bottom-0 z-10 flex-row">
            <Button variant="outline" className="rounded-xl px-5" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-6">
              {saving ? <><Loader2 className="size-4 mr-2 animate-spin" /> Saving...</> : <><Save className="size-4 mr-2" /> Save Controls</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
