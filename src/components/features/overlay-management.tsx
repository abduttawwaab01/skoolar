'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Plus, Edit, Trash2, Save, Loader2, Image, Video, Type, Monitor,
  Eye, EyeOff, Calendar, Flag, Building2, Users, X, Search,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Overlay {
  id: string;
  title: string | null;
  content: string | null;
  imageUrl: string | null;
  videoUrl: string | null;
  mediaType: string;
  overlayStyle: string;
  backgroundColor: string;
  textColor: string;
  position: string;
  dismissible: boolean;
  showOnce: boolean;
  linkUrl: string | null;
  linkText: string | null;
  isActive: boolean;
  startsAt: string;
  expiresAt: string | null;
  targetSchools: string | null;
  targetRoles: string | null;
  targetUsers: string | null;
  priority: number;
  createdAt: string;
}

interface School {
  id: string;
  name: string;
}

const MEDIA_TYPES = [
  { value: 'text', label: 'Text', icon: Type },
  { value: 'image', label: 'Image', icon: Image },
  { value: 'video', label: 'Video', icon: Video },
];

const OVERLAY_STYLES = [
  { value: 'modal', label: 'Modal (Center Popup)', icon: Monitor },
  { value: 'banner', label: 'Banner (Top/Bottom Bar)', icon: Monitor },
  { value: 'fullscreen', label: 'Fullscreen', icon: Monitor },
];

const POSITIONS = [
  { value: 'center', label: 'Center' },
  { value: 'top', label: 'Top' },
  { value: 'bottom', label: 'Bottom' },
];

const ROLES = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STUDENT', 'PARENT', 'ACCOUNTANT', 'LIBRARIAN', 'DIRECTOR'];

const DEFAULT_FORM = {
  title: '',
  mediaType: 'text',
  content: '',
  imageUrl: '',
  videoUrl: '',
  overlayStyle: 'modal',
  backgroundColor: 'rgba(0,0,0,0.8)',
  textColor: '#FFFFFF',
  position: 'center',
  dismissible: true,
  showOnce: false,
  linkUrl: '',
  linkText: '',
  isActive: true,
  startsAt: new Date().toISOString().split('T')[0],
  expiresAt: '',
  priority: 0,
  targetSchools: [] as string[],
  targetRoles: [] as string[],
  targetUsers: '',
};

// ─── Main Component ─────────────────────────────────────────────────────────

export function OverlayManagement() {
  const [overlays, setOverlays] = useState<Overlay[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingOverlay, setEditingOverlay] = useState<Overlay | null>(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Fetch overlays and schools
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [overlaysRes, schoolsRes] = await Promise.all([
        fetch('/api/platform/overlays?limit=50'),
        fetch('/api/schools?limit=100'),
      ]);

      if (overlaysRes.ok) {
        const json = await overlaysRes.json();
        setOverlays(json.data || []);
      }
      if (schoolsRes.ok) {
        const json = await schoolsRes.json();
        setSchools(json.data || []);
      }
    } catch {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Open create dialog
  const openCreate = () => {
    setEditingOverlay(null);
    setForm(DEFAULT_FORM);
    setDialogOpen(true);
  };

  // Open edit dialog
  const openEdit = async (overlay: Overlay) => {
    setEditingOverlay(overlay);
    setForm({
      title: overlay.title || '',
      mediaType: overlay.mediaType || 'text',
      content: overlay.content || '',
      imageUrl: overlay.imageUrl || '',
      videoUrl: overlay.videoUrl || '',
      overlayStyle: overlay.overlayStyle || 'modal',
      backgroundColor: overlay.backgroundColor || 'rgba(0,0,0,0.8)',
      textColor: overlay.textColor || '#FFFFFF',
      position: overlay.position || 'center',
      dismissible: overlay.dismissible,
      showOnce: overlay.showOnce,
      linkUrl: overlay.linkUrl || '',
      linkText: overlay.linkText || '',
      isActive: overlay.isActive,
      startsAt: overlay.startsAt ? overlay.startsAt.split('T')[0] : new Date().toISOString().split('T')[0],
      expiresAt: overlay.expiresAt ? overlay.expiresAt.split('T')[0] : '',
      priority: overlay.priority || 0,
      targetSchools: overlay.targetSchools ? JSON.parse(overlay.targetSchools) : [],
      targetRoles: overlay.targetRoles ? JSON.parse(overlay.targetRoles) : [],
      targetUsers: overlay.targetUsers ? JSON.parse(overlay.targetUsers).join(', ') : '',
    });
    setDialogOpen(true);
  };

  // Save overlay
  const handleSave = async () => {
    if (!form.title.trim()) {
      toast.error('Title is required');
      return;
    }

    try {
      setSaving(true);
      const parsedTargetUsers = form.targetUsers
        ? form.targetUsers.split(',').map(s => s.trim()).filter(Boolean)
        : [];

      const body = {
        title: form.title,
        mediaType: form.mediaType,
        content: form.content || null,
        imageUrl: form.imageUrl || null,
        videoUrl: form.videoUrl || null,
        overlayStyle: form.overlayStyle,
        backgroundColor: form.backgroundColor,
        textColor: form.textColor,
        position: form.position,
        dismissible: form.dismissible,
        showOnce: form.showOnce,
        linkUrl: form.linkUrl || null,
        linkText: form.linkText || null,
        isActive: form.isActive,
        startsAt: form.startsAt || new Date().toISOString(),
        expiresAt: form.expiresAt || null,
        priority: form.priority,
        targetSchools: form.targetSchools,
        targetRoles: form.targetRoles,
        targetUsers: parsedTargetUsers,
      };

      let res: Response;
      if (editingOverlay) {
        res = await fetch(`/api/platform/overlays/${editingOverlay.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch('/api/platform/overlays', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || err.error || 'Failed to save');
      }

      toast.success(editingOverlay ? 'Overlay updated' : 'Overlay created');
      setDialogOpen(false);
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save overlay');
    } finally {
      setSaving(false);
    }
  };

  // Delete overlay
  const handleDelete = async (id: string) => {
    try {
      setDeleting(id);
      const res = await fetch(`/api/platform/overlays/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed');
      toast.success('Overlay deleted');
      fetchData();
    } catch {
      toast.error('Failed to delete overlay');
    } finally {
      setDeleting(null);
    }
  };

  // Toggle active
  const handleToggleActive = async (overlay: Overlay) => {
    try {
      const res = await fetch(`/api/platform/overlays/${overlay.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !overlay.isActive }),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success(overlay.isActive ? 'Overlay deactivated' : 'Overlay activated');
      fetchData();
    } catch {
      toast.error('Failed to toggle overlay');
    }
  };

  // Helpers
  const toggleTargetSchool = (schoolId: string) => {
    setForm(prev => ({
      ...prev,
      targetSchools: prev.targetSchools.includes(schoolId)
        ? prev.targetSchools.filter(s => s !== schoolId)
        : [...prev.targetSchools, schoolId],
    }));
  };

  const toggleTargetRole = (role: string) => {
    setForm(prev => ({
      ...prev,
      targetRoles: prev.targetRoles.includes(role)
        ? prev.targetRoles.filter(r => r !== role)
        : [...prev.targetRoles, role],
    }));
  };

  const filteredOverlays = overlays.filter(o =>
    !searchQuery || (o.title || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getMediaTypeIcon = (type: string) => {
    if (type === 'image') return Image;
    if (type === 'video') return Video;
    return Type;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Overlay Management</h1>
          <p className="text-muted-foreground">Create and manage login overlays for schools and users</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4 mr-2" /> Create Overlay
        </Button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input placeholder="Search overlays..." className="pl-9" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>
        <Badge variant="outline">{filteredOverlays.length} overlays</Badge>
      </div>

      {/* Overlay List */}
      {loading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
      ) : filteredOverlays.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-8 flex flex-col items-center justify-center text-center gap-3">
            <Monitor className="size-12 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No overlays found. Create your first overlay.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredOverlays.map(overlay => {
            const MediaIcon = getMediaTypeIcon(overlay.mediaType);
            const targetSchools = overlay.targetSchools ? JSON.parse(overlay.targetSchools) : [];
            const targetRoles = overlay.targetRoles ? JSON.parse(overlay.targetRoles) : [];

            return (
              <Card key={overlay.id} className={cn(!overlay.isActive && 'opacity-60')}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className={cn(
                      'size-10 rounded-lg flex items-center justify-center shrink-0',
                      overlay.mediaType === 'image' ? 'bg-violet-100 text-violet-600' :
                      overlay.mediaType === 'video' ? 'bg-rose-100 text-rose-600' :
                      'bg-blue-100 text-blue-600',
                    )}>
                      <MediaIcon className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-medium">{overlay.title || 'Untitled'}</h3>
                        <Badge variant={overlay.isActive ? 'default' : 'secondary'} className={cn('text-[10px]', overlay.isActive && 'bg-emerald-600')}>
                          {overlay.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">{overlay.overlayStyle}</Badge>
                        <Badge variant="outline" className="text-[10px]">{overlay.mediaType}</Badge>
                        <Badge variant="outline" className="text-[10px]">Priority: {overlay.priority}</Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Calendar className="size-3" /> {overlay.startsAt?.split('T')[0]}</span>
                        {overlay.expiresAt && <span>→ {overlay.expiresAt.split('T')[0]}</span>}
                        {targetSchools.length > 0 && <span className="flex items-center gap-1"><Building2 className="size-3" /> {targetSchools.length} schools</span>}
                        {targetRoles.length > 0 && <span className="flex items-center gap-1"><Users className="size-3" /> {targetRoles.length} roles</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleToggleActive(overlay)} title={overlay.isActive ? 'Deactivate' : 'Activate'}>
                        {overlay.isActive ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEdit(overlay)}>
                        <Edit className="size-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500" onClick={() => handleDelete(overlay.id)} disabled={deleting === overlay.id}>
                        {deleting === overlay.id ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingOverlay ? 'Edit Overlay' : 'Create New Overlay'}</DialogTitle>
            <DialogDescription>Configure a login overlay to display to targeted users</DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-2">
            {/* Basic Info */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="ov-title">Title *</Label>
                <Input id="ov-title" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Overlay title" />
              </div>
              <div>
                <Label>Content Type</Label>
                <Select value={form.mediaType} onValueChange={v => setForm(p => ({ ...p, mediaType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MEDIA_TYPES.map(mt => (
                      <SelectItem key={mt.value} value={mt.value}>{mt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Overlay Style</Label>
                <Select value={form.overlayStyle} onValueChange={v => setForm(p => ({ ...p, overlayStyle: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {OVERLAY_STYLES.map(os => (
                      <SelectItem key={os.value} value={os.value}>{os.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Position</Label>
                <Select value={form.position} onValueChange={v => setForm(p => ({ ...p, position: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {POSITIONS.map(pos => (
                      <SelectItem key={pos.value} value={pos.value}>{pos.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="ov-priority">Priority</Label>
                <Input id="ov-priority" type="number" value={form.priority} onChange={e => setForm(p => ({ ...p, priority: parseInt(e.target.value) || 0 }))} />
              </div>
            </div>

            {/* Content */}
            {form.mediaType === 'text' && (
              <div>
                <Label htmlFor="ov-content">Content (HTML supported)</Label>
                <Textarea id="ov-content" rows={4} value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))} placeholder="Enter text content or HTML..." />
              </div>
            )}
            {form.mediaType === 'image' && (
              <div>
                <Label htmlFor="ov-image">Image URL</Label>
                <Input id="ov-image" value={form.imageUrl} onChange={e => setForm(p => ({ ...p, imageUrl: e.target.value }))} placeholder="https://..." />
              </div>
            )}
            {form.mediaType === 'video' && (
              <div>
                <Label htmlFor="ov-video">Video URL (YouTube or direct link)</Label>
                <Input id="ov-video" value={form.videoUrl} onChange={e => setForm(p => ({ ...p, videoUrl: e.target.value }))} placeholder="https://youtube.com/..." />
              </div>
            )}

            {/* Appearance */}
            <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
              <div>
                <Label htmlFor="ov-bg">Background</Label>
                <div className="flex gap-2">
                  <input type="color" value={form.backgroundColor.startsWith('#') ? form.backgroundColor : '#000000'} onChange={e => setForm(p => ({ ...p, backgroundColor: e.target.value }))} className="size-8 rounded cursor-pointer" />
                  <Input id="ov-bg" value={form.backgroundColor} onChange={e => setForm(p => ({ ...p, backgroundColor: e.target.value }))} className="flex-1" />
                </div>
              </div>
              <div>
                <Label htmlFor="ov-text">Text Color</Label>
                <div className="flex gap-2">
                  <input type="color" value={form.textColor} onChange={e => setForm(p => ({ ...p, textColor: e.target.value }))} className="size-8 rounded cursor-pointer" />
                  <Input id="ov-text" value={form.textColor} onChange={e => setForm(p => ({ ...p, textColor: e.target.value }))} className="flex-1" />
                </div>
              </div>
            </div>

            {/* Link */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="ov-link">Link URL (optional)</Label>
                <Input id="ov-link" value={form.linkUrl} onChange={e => setForm(p => ({ ...p, linkUrl: e.target.value }))} placeholder="https://..." />
              </div>
              <div>
                <Label htmlFor="ov-link-text">Link Text (optional)</Label>
                <Input id="ov-link-text" value={form.linkText} onChange={e => setForm(p => ({ ...p, linkText: e.target.value }))} placeholder="Click here" />
              </div>
            </div>

            {/* Dates */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="ov-start">Start Date</Label>
                <Input id="ov-start" type="date" value={form.startsAt} onChange={e => setForm(p => ({ ...p, startsAt: e.target.value }))} />
              </div>
              <div>
                <Label htmlFor="ov-expire">Expiry Date (optional)</Label>
                <Input id="ov-expire" type="date" value={form.expiresAt} onChange={e => setForm(p => ({ ...p, expiresAt: e.target.value }))} />
              </div>
            </div>

            {/* Toggles */}
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Active</Label>
                <Switch checked={form.isActive} onCheckedChange={v => setForm(p => ({ ...p, isActive: v }))} />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm">Dismissible</Label>
                <Switch checked={form.dismissible} onCheckedChange={v => setForm(p => ({ ...p, dismissible: v }))} />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm">Show Once</Label>
                <Switch checked={form.showOnce} onCheckedChange={v => setForm(p => ({ ...p, showOnce: v }))} />
              </div>
            </div>

            <Separator />

            {/* Targeting */}
            <div>
              <h3 className="text-sm font-semibold mb-3">Targeting</h3>

              {/* Target Schools */}
              <div className="mb-4">
                <Label className="text-xs text-muted-foreground mb-2 block">Target Schools ({form.targetSchools.length} selected)</Label>
                <ScrollArea className="max-h-32">
                  <div className="space-y-1">
                    {schools.map(school => (
                      <div key={school.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/50">
                        <input
                          type="checkbox"
                          checked={form.targetSchools.includes(school.id)}
                          onChange={() => toggleTargetSchool(school.id)}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm">{school.name}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              {/* Target Roles */}
              <div className="mb-4">
                <Label className="text-xs text-muted-foreground mb-2 block">Target Roles ({form.targetRoles.length} selected)</Label>
                <div className="flex flex-wrap gap-2">
                  {ROLES.map(role => (
                    <Badge
                      key={role}
                      variant={form.targetRoles.includes(role) ? 'default' : 'outline'}
                      className="cursor-pointer text-xs"
                      onClick={() => toggleTargetRole(role)}
                    >
                      {role}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Target Users */}
              <div>
                <Label htmlFor="ov-users" className="text-xs text-muted-foreground">Target User IDs (comma separated, optional)</Label>
                <Input id="ov-users" value={form.targetUsers} onChange={e => setForm(p => ({ ...p, targetUsers: e.target.value }))} placeholder="user-id-1, user-id-2" />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <><Loader2 className="size-4 mr-2 animate-spin" /> Saving...</> : <><Save className="size-4 mr-2" /> Save Overlay</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
