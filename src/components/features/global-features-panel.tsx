'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Save, Loader2, Globe } from 'lucide-react';
import { PLATFORM_FEATURES, USER_ROLES, type FeatureDef } from '@/lib/feature-registry';
import { toast } from 'sonner';

export function GlobalFeaturesPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [disabledFeatures, setDisabledFeatures] = useState<Set<string>>(new Set());
  const [disabledRoles, setDisabledRoles] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchGlobals = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/admin/global-features');
        if (res.ok) {
          const json = await res.json();
          setDisabledFeatures(new Set(json.data?.globallyDisabledFeatures || []));
          setDisabledRoles(new Set(json.data?.globallyDisabledRoles || []));
        }
      } catch {
        toast.error('Failed to load global features');
      } finally {
        setLoading(false);
      }
    };
    fetchGlobals();
  }, []);

  const toggleFeature = (id: string) => {
    setDisabledFeatures(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  const toggleRole = (id: string) => {
    setDisabledRoles(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const res = await fetch('/api/admin/global-features', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          globallyDisabledFeatures: Array.from(disabledFeatures),
          globallyDisabledRoles: Array.from(disabledRoles),
        }),
      });
      if (!res.ok) throw new Error('Failed to save');
      toast.success('Global features updated successfully');
    } catch {
      toast.error('Failed to save global features');
    } finally {
      setSaving(false);
    }
  };

  const filteredFeatures = PLATFORM_FEATURES.filter(f =>
    !searchQuery || f.label.toLowerCase().includes(searchQuery.toLowerCase()) || f.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Global Features</h1>
          <p className="text-muted-foreground">Manage features and portals across all schools</p>
        </div>
        <div className="space-y-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Global Features</h1>
          <p className="text-muted-foreground mt-1">
            Globally disable features and portals across <strong>all schools</strong>.
            Disabled items will be hidden from every school until you manually re-enable them per school in School Controls.
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-6 shrink-0"
        >
          {saving ? <><Loader2 className="size-4 mr-2 animate-spin" /> Saving...</> : <><Save className="size-4 mr-2" /> Save Changes</>}
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <input
          placeholder="Search features..."
          className="w-full pl-9 pr-4 py-2 rounded-lg border border-muted/80 bg-background text-sm"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-muted/80 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe className="size-5 text-emerald-600" />
                <CardTitle className="text-lg">Platform Features</CardTitle>
              </div>
              {disabledFeatures.size > 0 && (
                <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-200 bg-amber-50">
                  {disabledFeatures.size} disabled
                </Badge>
              )}
            </div>
            <CardDescription>Toggle features ON/OFF globally. OFF means hidden from all schools.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="space-y-0 max-h-[500px] overflow-y-auto">
              <div className="flex items-center justify-end gap-2 px-4 pt-1 pb-3">
                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setDisabledFeatures(new Set(PLATFORM_FEATURES.map(f => f.id)))}>
                  Disable All
                </Button>
                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setDisabledFeatures(new Set())}>
                  Enable All
                </Button>
              </div>
              <div className="divide-y divide-muted/50 border-t border-muted/50">
                {filteredFeatures.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">No features match your search</div>
                ) : (
                  filteredFeatures.map(feature => {
                    const isDisabled = disabledFeatures.has(feature.id);
                    const Icon = feature.icon;
                    return (
                      <div key={feature.id} className={`flex items-center justify-between p-3 hover:bg-muted/30 transition-colors ${isDisabled ? 'opacity-50 bg-muted/10' : ''}`}>
                        <div className="flex items-center gap-3 min-w-0 mr-4">
                          <div className={`size-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${isDisabled ? 'bg-muted text-muted-foreground' : 'bg-emerald-100/80 text-emerald-600'}`}>
                            <Icon className="size-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground/90 leading-none mb-1">{feature.label}</p>
                            <p className="text-[11px] text-muted-foreground line-clamp-1">{feature.description}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {isDisabled && (
                            <Badge variant="outline" className="text-[10px] text-red-500 border-red-200 bg-red-50">OFF</Badge>
                          )}
                          <Switch
                            checked={!isDisabled}
                            onCheckedChange={() => toggleFeature(feature.id)}
                            className="data-[state=checked]:bg-emerald-600"
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-muted/80 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe className="size-5 text-blue-600" />
                <CardTitle className="text-lg">User Roles / Portals</CardTitle>
              </div>
              {disabledRoles.size > 0 && (
                <Badge variant="outline" className="text-[10px] text-red-600 border-red-200 bg-red-50">
                  {disabledRoles.size} disabled
                </Badge>
              )}
            </div>
            <CardDescription>Disabling a role prevents all users of that role from accessing the platform across all schools.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="flex items-center justify-end gap-2 px-4 pt-1 pb-3">
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setDisabledRoles(new Set(USER_ROLES.map(r => r.id)))}>
                Disable All
              </Button>
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setDisabledRoles(new Set())}>
                Enable All
              </Button>
            </div>
            <div className="divide-y divide-muted/50 border-t border-muted/50">
              {USER_ROLES.map(role => {
                const isDisabled = disabledRoles.has(role.id);
                const Icon = role.icon;
                return (
                  <div key={role.id} className={`flex items-center justify-between p-3.5 hover:bg-muted/30 transition-colors ${isDisabled ? 'opacity-50 bg-muted/10' : ''}`}>
                    <div className="flex items-center gap-3 min-w-0 mr-4">
                      <div className={`size-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${isDisabled ? 'bg-muted text-muted-foreground' : 'bg-blue-100/80 text-blue-600'}`}>
                        <Icon className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground/90 leading-none mb-1">{role.label}</p>
                        <p className="text-[11px] text-muted-foreground line-clamp-1">{role.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {isDisabled && (
                        <Badge variant="outline" className="text-[10px] text-red-500 border-red-200 bg-red-50">OFF</Badge>
                      )}
                      <Switch
                        checked={!isDisabled}
                        onCheckedChange={() => toggleRole(role.id)}
                        className="data-[state=checked]:bg-blue-600"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <Globe className="size-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-amber-800">How Global Toggles Work</p>
            <p className="text-[11px] text-amber-700 leading-relaxed mt-1">
              Features and roles disabled here are turned OFF for every school by default. Schools will not see
              or be able to use them. However, you can <strong>override</strong> this per school via the School Controls
              panel — simply enable the feature for a specific school there. This means global settings act as a
              master switch, and school-level controls can fine-tune exceptions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
