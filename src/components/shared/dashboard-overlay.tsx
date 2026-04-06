'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, ExternalLink, Image as ImageIcon, Video, Type, Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/store/app-store';
import { useConfirm } from '@/components/confirm-dialog';

interface OverlayData {
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
  priority: number;
  isActive: boolean;
  startsAt: string;
  expiresAt: string | null;
  targetSchools: string | null;
  targetRoles: string | null;
  targetUsers: string | null;
}

interface OverlayFormData {
  title: string;
  content: string;
  imageUrl: string;
  videoUrl: string;
  mediaType: string;
  overlayStyle: string;
  backgroundColor: string;
  textColor: string;
  position: string;
  dismissible: boolean;
  showOnce: boolean;
  linkUrl: string;
  linkText: string;
  priority: number;
  startsAt: string;
  expiresAt: string;
  targetSchools: string[];
  targetRoles: string[];
  targetUsers: string;
  isActive: boolean;
}

export function DashboardOverlay() {
  const { currentUser, currentRole } = useAppStore();
  const [overlays, setOverlays] = useState<OverlayData[]>([]);
  const [currentOverlay, setCurrentOverlay] = useState<OverlayData | null>(null);
  const [isVisible, setIsVisible] = useState(false);
   const [isVideoPlaying, setIsVideoPlaying] = useState(false);
   const confirm = useConfirm();

  useEffect(() => {
    if (!currentUser) return;

    const loadOverlays = async () => {
      try {
        const params = new URLSearchParams();
        if (currentUser.schoolId) params.set('schoolId', currentUser.schoolId);
        params.set('userId', currentUser.id);
        params.set('role', currentRole || '');
        const res = await fetch(`/api/platform/overlays?${params.toString()}`);
        if (res.ok) {
          const json = await res.json();
          const items = json.data || [];
          setOverlays(items);

          const dismissed = JSON.parse(localStorage.getItem('skoolar-dismissed-overlays') || '{}');

          for (const overlay of items) {
            if (overlay.showOnce && dismissed[overlay.id]) continue;
            setCurrentOverlay(overlay);
            setIsVisible(true);
            break;
          }
        }
      } catch {
        // Silently fail
      }
    };

    loadOverlays();
  }, [currentUser, currentRole]);

  const handleDismiss = () => {
    if (currentOverlay) {
      if (currentOverlay.showOnce) {
        const dismissed = JSON.parse(localStorage.getItem('skoolar-dismissed-overlays') || '{}');
        dismissed[currentOverlay.id] = true;
        localStorage.setItem('skoolar-dismissed-overlays', JSON.stringify(dismissed));
      }
    }
    setIsVisible(false);
    setIsVideoPlaying(false);
  };

  const handleLinkClick = () => {
    if (currentOverlay?.linkUrl) {
      window.open(currentOverlay.linkUrl, '_blank');
    }
  };

  if (!isVisible || !currentOverlay) return null;

  const isVideo = currentOverlay.mediaType === 'video' && currentOverlay.videoUrl;
  const isImage = currentOverlay.mediaType === 'image' && currentOverlay.imageUrl;
  const isText = currentOverlay.mediaType === 'text';

  // For banner style
  if (currentOverlay.overlayStyle === 'banner') {
    return (
      <div
        className="relative z-[9998] w-full"
        style={{ backgroundColor: currentOverlay.backgroundColor || 'rgba(0,0,0,0.8)' }}
      >
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {currentOverlay.imageUrl && (
              <img src={currentOverlay.imageUrl} alt="" className="h-8 w-8 rounded object-cover shrink-0" />
            )}
            <p className="text-sm truncate" style={{ color: currentOverlay.textColor || '#fff' }}>
              {currentOverlay.title || ''} {currentOverlay.content || ''}
            </p>
            {currentOverlay.linkUrl && (
              <Button
                size="sm"
                variant="ghost"
                className="shrink-0 text-xs hover:bg-white/20"
                style={{ color: currentOverlay.textColor || '#fff' }}
                onClick={handleLinkClick}
              >
                {currentOverlay.linkText || 'Learn More'} <ExternalLink className="size-3 ml-1" />
              </Button>
            )}
          </div>
          {currentOverlay.dismissible && (
            <button
              onClick={handleDismiss}
              className="shrink-0 rounded-full p-1 hover:bg-white/20 transition-colors"
              style={{ color: currentOverlay.textColor || '#fff' }}
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>
    );
  }

  // Modal / fullscreen style
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ backgroundColor: currentOverlay.backgroundColor || 'rgba(0,0,0,0.8)' }}
    >
      {currentOverlay.dismissible && (
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 z-10 rounded-full p-2 bg-white/10 hover:bg-white/20 transition-colors text-white"
        >
          <X className="size-5" />
        </button>
      )}

      <div className="max-w-lg w-full bg-white rounded-2xl overflow-hidden shadow-2xl">
        {/* Image */}
        {isImage && (
          <div className="w-full">
            <img src={currentOverlay.imageUrl || undefined} alt={currentOverlay.title || ''} className="w-full h-auto max-h-64 object-cover" />
          </div>
        )}

        {/* Video */}
        {isVideo && (
          <div className="w-full aspect-video bg-black">
            {isVideoPlaying ? (
              <iframe
                src={currentOverlay.videoUrl ? `${currentOverlay.videoUrl}${currentOverlay.videoUrl.includes('?') ? '&' : '?'}autoplay=1` : ''}
                className="w-full h-full"
                allow="autoplay; encrypted-media"
                allowFullScreen
                title={currentOverlay.title || 'Overlay Video'}
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center cursor-pointer"
                onClick={() => setIsVideoPlaying(true)}
              >
                <div className="text-center text-white">
                  <Video className="size-12 mx-auto mb-2 opacity-80" />
                  <p className="text-sm opacity-60">Click to play</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Text Content */}
        <div className="p-6">
          {currentOverlay.title && (
            <h2 className="text-lg font-bold text-gray-900 mb-2">{currentOverlay.title}</h2>
          )}
          {currentOverlay.content && (
            <p className="text-sm text-gray-600 whitespace-pre-line">{currentOverlay.content}</p>
          )}

          {/* Action Button */}
          {currentOverlay.linkUrl && (
            <Button
              className="mt-4 w-full"
              onClick={handleLinkClick}
            >
              {currentOverlay.linkText || 'Learn More'} <ExternalLink className="size-4 ml-2" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Admin Overlay Manager (for Super Admin) ────────────────────────────

interface OverlayManagerProps {
  onClose?: () => void;
}

export function OverlayManager({ onClose }: OverlayManagerProps) {
  const [overlays, setOverlays] = useState<OverlayData[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [schools, setSchools] = useState<{id: string; name: string}[]>([]);
  const ROLES = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STUDENT', 'PARENT', 'ACCOUNTANT', 'LIBRARIAN', 'DIRECTOR'];
  const [formData, setFormData] = useState<OverlayFormData>({
    title: '',
    content: '',
    imageUrl: '',
    videoUrl: '',
    mediaType: 'text',
    overlayStyle: 'modal',
    backgroundColor: 'rgba(0,0,0,0.8)',
    textColor: '#FFFFFF',
    position: 'center',
    dismissible: true,
    showOnce: false,
    linkUrl: '',
    linkText: '',
    priority: 0,
    startsAt: new Date().toISOString().slice(0, 16),
    expiresAt: '',
    targetSchools: [],
    targetRoles: [],
    targetUsers: '',
    isActive: true,
  });

  const fetchOverlays = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/platform/overlays');
      if (res.ok) {
        const json = await res.json();
        setOverlays(json.data || []);
      }
    } catch {
      // Silent
    } finally {
      setLoading(false);
    }
  };

   useEffect(() => { fetchOverlays(); }, []);

   // Fetch schools for targeting
   useEffect(() => {
     const fetchSchools = async () => {
       try {
         const res = await fetch('/api/schools?limit=100');
         if (res.ok) {
           const json = await res.json();
           setSchools((json.data || []).map((s: {id: string; name: string}) => ({ id: s.id, name: s.name })));
         }
       } catch {
         // ignore
       }
     };
     fetchSchools();
   }, []);

   const toggleTargetRole = (role: string) => {
     setFormData((prev: OverlayFormData) => ({
       ...prev,
       targetRoles: prev.targetRoles.includes(role)
         ? prev.targetRoles.filter(r => r !== role)
         : [...prev.targetRoles, role],
     }));
   };

   const toggleTargetSchool = (schoolId: string) => {
     setFormData((prev: OverlayFormData) => ({
       ...prev,
       targetSchools: prev.targetSchools.includes(schoolId)
         ? prev.targetSchools.filter(s => s !== schoolId)
         : [...prev.targetSchools, schoolId],
     }));
   };

   const handleSave = async () => {
     try {
       setSaving(true);
       const payload = {
         ...formData,
         expiresAt: formData.expiresAt ? new Date(formData.expiresAt).toISOString() : null,
         targetSchools: formData.targetSchools.length > 0 ? formData.targetSchools : null,
         targetRoles: formData.targetRoles.length > 0 ? formData.targetRoles : null,
         targetUsers: formData.targetUsers ? formData.targetUsers.split(',').map(u => u.trim()).filter(Boolean) : null,
       };

      const url = editingId ? `/api/platform/overlays/${editingId}` : '/api/platform/overlays';
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setDialogOpen(false);
        resetForm();
        fetchOverlays();
      }
    } catch {
      // Silent
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm('Delete Overlay', 'Are you sure you want to delete this overlay? This action cannot be undone.');
    if (!ok) return;
    try {
      await fetch(`/api/platform/overlays/${id}`, { method: 'DELETE' });
      fetchOverlays();
    } catch {
      // Silent
    }
  };

   const handleEdit = (overlay: OverlayData) => {
     setEditingId(overlay.id);
     const parseArray = (val: string | null): string[] => {
       if (!val) return [];
       try {
         const parsed = JSON.parse(val);
         if (Array.isArray(parsed)) return parsed;
       } catch {
         // Not JSON
       }
       return [];
     };
     const parseUsers = (val: string | null): string => {
       if (!val) return '';
       try {
         const parsed = JSON.parse(val);
         if (Array.isArray(parsed)) return parsed.join(', ');
       } catch {
         // Not JSON, might be comma string already? not likely
       }
       return typeof val === 'string' ? val : '';
     };
     setFormData({
       title: overlay.title || '',
       content: overlay.content || '',
       imageUrl: overlay.imageUrl || '',
       videoUrl: overlay.videoUrl || '',
       mediaType: overlay.mediaType,
       overlayStyle: overlay.overlayStyle,
       backgroundColor: overlay.backgroundColor,
       textColor: overlay.textColor,
       position: overlay.position,
       dismissible: overlay.dismissible,
       showOnce: overlay.showOnce,
       linkUrl: overlay.linkUrl || '',
       linkText: overlay.linkText || '',
       priority: overlay.priority,
       startsAt: overlay.startsAt ? overlay.startsAt.slice(0, 16) : '',
       expiresAt: overlay.expiresAt ? overlay.expiresAt.slice(0, 16) : '',
       targetSchools: parseArray(overlay.targetSchools),
       targetRoles: parseArray(overlay.targetRoles),
       targetUsers: parseUsers(overlay.targetUsers),
       isActive: overlay.isActive,
     });
     setDialogOpen(true);
   };

   const resetForm = () => {
     setEditingId(null);
     setFormData({
       title: '', content: '', imageUrl: '', videoUrl: '', mediaType: 'text',
       overlayStyle: 'modal', backgroundColor: 'rgba(0,0,0,0.8)', textColor: '#FFFFFF',
       position: 'center', dismissible: true, showOnce: false,
       linkUrl: '', linkText: '', priority: 0,
       startsAt: new Date().toISOString().slice(0, 16), expiresAt: '',
       targetSchools: [], targetRoles: [], targetUsers: '', isActive: true,
     });
   };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Dashboard Overlays</h2>
          <p className="text-xs text-muted-foreground">Create targeted overlays for schools and users</p>
        </div>
        <div className="flex items-center gap-2">
          {onClose && <Button variant="outline" size="sm" onClick={onClose}>Back</Button>}
          <Button size="sm" onClick={() => { resetForm(); setDialogOpen(true); }}>
            <Plus className="size-4 mr-1" /> Create Overlay
          </Button>
        </div>
      </div>

      {/* Overlay List */}
      {loading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />)}</div>
      ) : overlays.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No overlays created yet</p>
      ) : (
        <div className="space-y-2">
          {overlays.map(o => (
            <div key={o.id} className="flex items-center gap-3 rounded-lg border p-3">
              <div className={`size-10 rounded-lg flex items-center justify-center shrink-0 ${o.mediaType === 'image' ? 'bg-blue-100 text-blue-600' : o.mediaType === 'video' ? 'bg-red-100 text-red-600' : 'bg-purple-100 text-purple-600'}`}>
                {o.mediaType === 'image' ? <ImageIcon className="size-4" /> : o.mediaType === 'video' ? <Video className="size-4" /> : <Type className="size-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{o.title || 'Untitled'}</p>
                <p className="text-xs text-muted-foreground">{o.overlayStyle} · {o.position} · {o.dismissible ? 'Dismissible' : 'Mandatory'}</p>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${o.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                {o.isActive ? 'Active' : 'Inactive'}
              </span>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleEdit(o)}>Edit</Button>
                <Button variant="outline" size="sm" className="h-7 text-xs text-red-600 border-red-200" onClick={() => handleDelete(o.id)}>Del</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Overlay' : 'Create Overlay'}</DialogTitle>
            <DialogDescription>Configure a dashboard overlay for targeted users</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={formData.title} onChange={e => setFormData(p => ({ ...p, title: e.target.value }))} placeholder="Overlay title" />
            </div>
            <div className="space-y-2">
              <Label>Content</Label>
              <Textarea value={formData.content} onChange={e => setFormData(p => ({ ...p, content: e.target.value }))} placeholder="Message content..." rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Media Type</Label>
                <Select value={formData.mediaType} onValueChange={v => setFormData(p => ({ ...p, mediaType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Text Only</SelectItem>
                    <SelectItem value="image">Image</SelectItem>
                    <SelectItem value="video">Video</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Style</Label>
                <Select value={formData.overlayStyle} onValueChange={v => setFormData(p => ({ ...p, overlayStyle: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="modal">Modal Popup</SelectItem>
                    <SelectItem value="banner">Top Banner</SelectItem>
                    <SelectItem value="fullscreen">Fullscreen</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {formData.mediaType === 'image' && (
              <div className="space-y-2">
                <Label>Image URL</Label>
                <Input value={formData.imageUrl} onChange={e => setFormData(p => ({ ...p, imageUrl: e.target.value }))} placeholder="https://..." />
              </div>
            )}
            {formData.mediaType === 'video' && (
              <div className="space-y-2">
                <Label>Video URL (YouTube or R2)</Label>
                <Input value={formData.videoUrl} onChange={e => setFormData(p => ({ ...p, videoUrl: e.target.value }))} placeholder="https://youtube.com/..." />
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Background Color</Label>
                <Input value={formData.backgroundColor} onChange={e => setFormData(p => ({ ...p, backgroundColor: e.target.value }))} placeholder="rgba(0,0,0,0.8)" />
              </div>
              <div className="space-y-2">
                <Label>Text Color</Label>
                <Input value={formData.textColor} onChange={e => setFormData(p => ({ ...p, textColor: e.target.value }))} placeholder="#FFFFFF" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Position</Label>
              <Select value={formData.position} onValueChange={v => setFormData(p => ({ ...p, position: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="center">Center</SelectItem>
                  <SelectItem value="top">Top</SelectItem>
                  <SelectItem value="bottom">Bottom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <Switch checked={formData.dismissible} onCheckedChange={v => setFormData(p => ({ ...p, dismissible: v }))} />
                <Label className="text-sm">Dismissible</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={formData.showOnce} onCheckedChange={v => setFormData(p => ({ ...p, showOnce: v }))} />
                <Label className="text-sm">Show Once Only</Label>
              </div>
            </div>
            {formData.linkUrl && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Link URL</Label>
                  <Input value={formData.linkUrl} onChange={e => setFormData(p => ({ ...p, linkUrl: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Button Text</Label>
                  <Input value={formData.linkText} onChange={e => setFormData(p => ({ ...p, linkText: e.target.value }))} />
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label>Link URL</Label>
              <Input value={formData.linkUrl} onChange={e => setFormData(p => ({ ...p, linkUrl: e.target.value }))} placeholder="https://..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Priority (higher = shown first)</Label>
                <Input type="number" value={formData.priority} onChange={e => setFormData(p => ({ ...p, priority: parseInt(e.target.value) || 0 }))} />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Switch checked={formData.isActive} onCheckedChange={v => setFormData(p => ({ ...p, isActive: v }))} />
                <Label className="text-sm">Active</Label>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input type="datetime-local" value={formData.startsAt} onChange={e => setFormData(p => ({ ...p, startsAt: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Expires At</Label>
                <Input type="datetime-local" value={formData.expiresAt} onChange={e => setFormData(p => ({ ...p, expiresAt: e.target.value }))} />
              </div>
             </div>
             {/* Targeting */}
             <div className="space-y-4">
               <div>
                 <Label className="text-xs text-muted-foreground mb-2 block">Target Roles ({formData.targetRoles.length} selected)</Label>
                 <div className="flex flex-wrap gap-2">
                   {ROLES.map(role => (
                     <Badge
                       key={role}
                       variant={formData.targetRoles.includes(role) ? 'default' : 'outline'}
                       className="cursor-pointer text-xs"
                       onClick={() => toggleTargetRole(role)}
                     >
                       {role}
                     </Badge>
                   ))}
                 </div>
               </div>
               <div>
                 <Label className="text-xs text-muted-foreground mb-2 block">Target Schools ({formData.targetSchools.length} selected)</Label>
                 <ScrollArea className="max-h-32">
                   <div className="space-y-1">
                     {schools.map(school => (
                       <div key={school.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/50">
                         <input
                           type="checkbox"
                           checked={formData.targetSchools.includes(school.id)}
                           onChange={() => toggleTargetSchool(school.id)}
                           className="rounded border-gray-300"
                         />
                         <span className="text-sm">{school.name}</span>
                       </div>
                     ))}
                   </div>
                 </ScrollArea>
               </div>
             </div>
             <div className="space-y-2">
              <Label>Target User IDs (comma-separated)</Label>
              <Input value={formData.targetUsers} onChange={e => setFormData(p => ({ ...p, targetUsers: e.target.value }))} placeholder="Leave empty for all" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : editingId ? 'Update' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
