'use client';

import { useState, useEffect, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Plus, Pencil, Trash2, Eye, EyeOff, Megaphone, Quote,
  FileText, BookOpen, Inbox, Settings, Shield, Loader2, ExternalLink,
  Star, ThumbsUp, ThumbsDown, Image as ImageIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { handleSilentError } from '@/lib/error-handler';
import { SafeFormattedDate } from '@/components/shared/safe-formatted-date';
import { FileUploader } from '@/components/ui/file-uploader';

// ============================================
// Types
// ============================================
interface PlatformAnnouncement {
  id: string; title: string | null; message: string; type: string; targetRoles: string | null;
  targetSchools: string | null; linkUrl: string | null; isActive: boolean;
  startsAt: string; expiresAt: string | null; createdBy: string | null;
  createdAt: string; updatedAt: string;
}

interface PlatformAdvert {
  id: string; title: string; description: string | null; contentType: string;
  mediaUrl: string | null; mediaType: string | null; imageUrl: string | null;
  linkUrl: string | null; linkText: string | null; ctaType: string;
  htmlContent: string | null; buttonColor: string; targetRoles: string | null;
  targetSchools: string | null; position: number; autoSwipeMs: number;
  isActive: boolean; startsAt: string; expiresAt: string | null;
  impressions: number; clicks: number; createdBy: string | null;
  createdAt: string; updatedAt: string;
}

interface PreloaderQuote {
  id: string; quote: string; author: string; isActive: boolean;
  createdAt: string; updatedAt: string;
}

interface BlogPost {
  id: string; title: string; slug: string; excerpt: string | null;
  content: string; coverImage: string | null; authorName: string;
  authorAvatar: string | null; category: string; tags: string | null;
  isPublished: boolean; publishedAt: string | null; featured: boolean;
  readTime: number; viewCount: number; createdBy: string | null;
  createdAt: string; updatedAt: string;
}

interface PlatformStory {
  id: string; title: string; excerpt: string | null; content: string;
  coverImage: string | null; level: string | null; grade: string | null;
  category: string; tags: string | null; authorName: string | null;
  authorBio: string | null; submittedBy: string | null; isFeatured: boolean;
  isPublished: boolean; publishedAt: string | null; readTime: number;
  viewCount: number; likeCount: number; approvedBy: string | null;
  approvedAt: string | null; rejectedAt: string | null;
  rejectionReason: string | null; createdBy: string | null;
  createdAt: string; updatedAt: string;
}

interface StorySubmission {
  id: string; title: string; content: string; authorName: string;
  authorEmail: string; authorPhone: string | null; level: string | null;
  grade: string | null; category: string; coverImage: string | null;
  status: string; adminNotes: string | null; reviewedBy: string | null;
  reviewedAt: string | null; storyId: string | null; createdAt: string; updatedAt: string;
}

interface PlatformSettingsData {
  id: string; siteName: string; siteDescription: string | null;
  siteLogo: string | null; siteFavicon: string | null;
  primaryColor: string; secondaryColor: string; accentColor: string;
  contactEmail: string | null; contactPhone: string | null;
  contactAddress: string | null; socialLinks: string | null;
  enablePreloader: boolean; enableAdverts: boolean; enableAnnouncements: boolean;
  heroTitle: string | null; heroSubtitle: string | null; heroImageUrl: string | null;
  createdAt: string; updatedAt: string;
}

// ============================================
// Helper
// ============================================
function formatDate(dateStr: string) {
  if (!dateStr) return '—';
  return <SafeFormattedDate date={dateStr} options={{ year: 'numeric', month: 'short', day: 'numeric' }} mode="toLocaleDateString" />;
}

function generateSlug(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now().toString(36);
}

// ============================================
// Component
// ============================================
export function PlatformAdminPanel() {
  const [activeTab, setActiveTab] = useState('announcements');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
          <Shield className="h-5 w-5 text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Platform Management</h2>
          <p className="text-sm text-gray-500">Manage platform-wide content, settings, and features</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="flex flex-wrap h-auto gap-1 bg-gray-100 p-1">
          <TabsTrigger value="announcements" className="text-xs gap-1.5 data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
            <Megaphone className="h-3.5 w-3.5" /> Announcements
          </TabsTrigger>
          <TabsTrigger value="adverts" className="text-xs gap-1.5 data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
            <ImageIcon className="h-3.5 w-3.5" /> Adverts
          </TabsTrigger>
          <TabsTrigger value="preloader" className="text-xs gap-1.5 data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
            <Quote className="h-3.5 w-3.5" /> Preloader
          </TabsTrigger>
          <TabsTrigger value="blog" className="text-xs gap-1.5 data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
            <FileText className="h-3.5 w-3.5" /> Blog
          </TabsTrigger>
          <TabsTrigger value="stories" className="text-xs gap-1.5 data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
            <BookOpen className="h-3.5 w-3.5" /> Stories
          </TabsTrigger>
          <TabsTrigger value="submissions" className="text-xs gap-1.5 data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
            <Inbox className="h-3.5 w-3.5" /> Submissions
          </TabsTrigger>
          <TabsTrigger value="settings" className="text-xs gap-1.5 data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
            <Settings className="h-3.5 w-3.5" /> Settings
          </TabsTrigger>
          <TabsTrigger value="privacy" className="text-xs gap-1.5 data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
            <Shield className="h-3.5 w-3.5" /> Privacy
          </TabsTrigger>
        </TabsList>

        <TabsContent value="announcements"><AnnouncementsTab /></TabsContent>
        <TabsContent value="adverts"><AdvertsTab /></TabsContent>
        <TabsContent value="preloader"><PreloaderTab /></TabsContent>
        <TabsContent value="blog"><BlogTab /></TabsContent>
        <TabsContent value="stories"><StoriesTab /></TabsContent>
        <TabsContent value="submissions"><SubmissionsTab /></TabsContent>
        <TabsContent value="settings"><SettingsTab /></TabsContent>
        <TabsContent value="privacy"><PrivacyTab /></TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================
// Announcements Tab
// ============================================
function AnnouncementsTab() {
  const [items, setItems] = useState<PlatformAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PlatformAnnouncement | null>(null);
  const [schools, setSchools] = useState<{id: string; name: string}[]>([]);
  const [form, setForm] = useState({ 
    title: '', message: '', type: 'info', linkUrl: '', 
    targetRoles: [] as string[], targetSchools: [] as string[], 
    isActive: true, startsAt: '', expiresAt: '' 
  });

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch('/api/platform/announcements');
      const json = await res.json();
      if (json.success) setItems(json.data);
    } catch (error: unknown) { handleSilentError(error, 'Failed to load data'); } finally { setLoading(false); }
  }, []);

  // Fetch schools for selector
  useEffect(() => {
    const fetchSchools = async () => {
      try {
        const res = await fetch('/api/schools?limit=500');
        const json = await res.json();
        if (json.data) setSchools(json.data);
      } catch (error: unknown) { handleSilentError(error, 'Failed to load schools'); }
    };
    fetchSchools();
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const resetForm = () => {
    setForm({ title: '', message: '', type: 'info', linkUrl: '', targetRoles: [], targetSchools: [], isActive: true, startsAt: '', expiresAt: '' });
    setEditing(null);
  };

  const handleSave = async () => {
    if (!form.message) return toast.error('Message is required');
    try {
      const url = editing ? `/api/platform/announcements/${editing.id}` : '/api/platform/announcements';
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(editing ? 'Announcement updated' : 'Announcement created');
        setDialogOpen(false);
        resetForm();
        fetchItems();
      } else {
        toast.error(json.message || 'Error');
      }
    } catch {
      toast.error('Failed to save');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this announcement?')) return;
    try {
      const res = await fetch(`/api/platform/announcements/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) { toast.success('Deleted'); fetchItems(); } else toast.error(json.message);
    } catch { toast.error('Failed to delete'); }
  };

  const typeColors: Record<string, string> = {
    info: 'bg-blue-100 text-blue-800', warning: 'bg-amber-100 text-amber-800',
    urgent: 'bg-red-100 text-red-800', success: 'bg-emerald-100 text-emerald-800',
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg">Announcements</CardTitle>
          <CardDescription>Platform-wide announcements shown to all users</CardDescription>
        </div>
        <Button size="sm" onClick={() => { resetForm(); setDialogOpen(true); }} className="bg-emerald-600 hover:bg-emerald-700">
          <Plus className="h-4 w-4 mr-1" /> Add
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>
        ) : items.length === 0 ? (
          <div className="text-center py-8 text-gray-400"><Megaphone className="h-10 w-10 mx-auto mb-2 opacity-50" /> No announcements yet</div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {items.map((item) => (
              <div key={item.id} className="flex items-start gap-3 p-3 rounded-lg border hover:bg-gray-50 transition-colors">
                <Badge variant="secondary" className={typeColors[item.type] || ''}>{item.type}</Badge>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.message}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                    <span>{formatDate(item.createdAt)}</span>
                    {item.linkUrl && <ExternalLink className="h-3 w-3" />}
                    <Badge variant={item.isActive ? 'default' : 'secondary'} className="text-[10px]">
                      {item.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { 
                    const parseJson = (val: string | null) => {
                      if (!val) return [];
                      try { return JSON.parse(val); } catch { return []; }
                    };
                    setEditing(item); 
                    setForm({ 
                      title: item.title || '', 
                      message: item.message, 
                      type: item.type, 
                      linkUrl: item.linkUrl || '', 
                      targetRoles: parseJson(item.targetRoles), 
                      targetSchools: parseJson(item.targetSchools), 
                      isActive: item.isActive, 
                      startsAt: item.startsAt?.split('T')[0] || '', 
                      expiresAt: item.expiresAt?.split('T')[0] || '' 
                    }); 
                    setDialogOpen(true); 
                  }}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => handleDelete(item.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Announcement' : 'New Announcement'}</DialogTitle>
            <DialogDescription>Set the message, type, and visibility</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Title</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Announcement title..." />
            </div>
            <div>
              <Label>Message</Label>
              <Textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Announcement message..." rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">Info</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                    <SelectItem value="success">Success</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Link URL</Label>
                <Input value={form.linkUrl} onChange={(e) => setForm({ ...form, linkUrl: e.target.value })} placeholder="https://..." />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Target Roles</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {['STUDENT', 'TEACHER', 'PARENT', 'SCHOOL_ADMIN', 'DIRECTOR', 'LIBRARIAN', 'ACCOUNTANT'].map(role => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setForm(prev => ({
                        ...prev,
                        targetRoles: prev.targetRoles.includes(role) 
                          ? prev.targetRoles.filter(r => r !== role)
                          : [...prev.targetRoles, role]
                      }))}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                        form.targetRoles.includes(role)
                          ? 'bg-emerald-100 border-emerald-300 text-emerald-800'
                          : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      {role.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label>Target Schools</Label>
                <div className="flex flex-wrap gap-2 mt-2 max-h-32 overflow-y-auto">
                  {schools.map(school => (
                    <button
                      key={school.id}
                      type="button"
                      onClick={() => setForm(prev => ({
                        ...prev,
                        targetSchools: prev.targetSchools.includes(school.id)
                          ? prev.targetSchools.filter(s => s !== school.id)
                          : [...prev.targetSchools, school.id]
                      }))}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                        form.targetSchools.includes(school.id)
                          ? 'bg-blue-100 border-blue-300 text-blue-800'
                          : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      {school.name}
                    </button>
                  ))}
                </div>
                {form.targetSchools.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">{form.targetSchools.length} selected</p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Starts At</Label>
                <Input type="date" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} />
              </div>
              <div>
                <Label>Expires At</Label>
                <Input type="date" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Label>Active</Label>
              <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ============================================
// Adverts Tab
// ============================================
function AdvertsTab() {
  const [items, setItems] = useState<PlatformAdvert[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PlatformAdvert | null>(null);
  const [form, setForm] = useState({
    title: '', description: '', contentType: 'text', mediaUrl: '', mediaType: '', imageUrl: '',
    linkUrl: '', linkText: '', ctaType: 'link', htmlContent: '', buttonColor: '#059669',
    position: 0, autoSwipeMs: 5000, isActive: true, startsAt: '', expiresAt: '',
  });

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch('/api/platform/adverts');
      const json = await res.json();
      if (json.success) setItems(json.data);
    } catch (error: unknown) { handleSilentError(error, 'Failed to load data'); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const resetForm = () => {
    setForm({
      title: '', description: '', contentType: 'text', mediaUrl: '', mediaType: '', imageUrl: '',
      linkUrl: '', linkText: '', ctaType: 'link', htmlContent: '', buttonColor: '#059669',
      position: 0, autoSwipeMs: 5000, isActive: true, startsAt: '', expiresAt: '',
    });
    setEditing(null);
  };

  const handleSave = async () => {
    if (!form.title) return toast.error('Title is required');
    try {
      const url = editing ? `/api/platform/adverts/${editing.id}` : '/api/platform/adverts';
      const res = await fetch(url, { method: editing ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const json = await res.json();
      if (json.success) { toast.success(editing ? 'Updated' : 'Created'); setDialogOpen(false); resetForm(); fetchItems(); }
      else toast.error(json.message);
    } catch { toast.error('Failed'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this advert?')) return;
    try {
      const res = await fetch(`/api/platform/adverts/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) { toast.success('Deleted'); fetchItems(); } else toast.error(json.message);
    } catch { toast.error('Failed'); }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg">Adverts</CardTitle>
          <CardDescription>Manage advertisements displayed to users</CardDescription>
        </div>
        <Button size="sm" onClick={() => { resetForm(); setDialogOpen(true); }} className="bg-emerald-600 hover:bg-emerald-700">
          <Plus className="h-4 w-4 mr-1" /> Add
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>
        ) : items.length === 0 ? (
          <div className="text-center py-8 text-gray-400"><ImageIcon className="h-10 w-10 mx-auto mb-2 opacity-50" /> No adverts yet</div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {items.map((item) => (
              <div key={item.id} className="flex items-start gap-3 p-3 rounded-lg border hover:bg-gray-50 transition-colors">
                <Badge variant="secondary">{item.contentType}</Badge>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.title}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                    <span>Pos: {item.position}</span>
                    <span>{item.impressions} views</span>
                    <span>{item.clicks} clicks</span>
                    <Badge variant={item.isActive ? 'default' : 'secondary'} className="text-[10px]">
                      {item.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                    setEditing(item);
                    setForm({
                      title: item.title, description: item.description || '', contentType: item.contentType,
                      mediaUrl: item.mediaUrl || '', mediaType: item.mediaType || '', imageUrl: item.imageUrl || '',
                      linkUrl: item.linkUrl || '', linkText: item.linkText || '', ctaType: item.ctaType,
                      htmlContent: item.htmlContent || '', buttonColor: item.buttonColor,
                      position: item.position, autoSwipeMs: item.autoSwipeMs, isActive: item.isActive,
                      startsAt: item.startsAt?.split('T')[0] || '', expiresAt: item.expiresAt?.split('T')[0] || '',
                    });
                    setDialogOpen(true);
                  }}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => handleDelete(item.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Advert' : 'New Advert'}</DialogTitle>
            <DialogDescription>Configure advert content, media, and display settings</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
              <div>
                <Label>Content Type</Label>
                <Select value={form.contentType} onValueChange={(v) => setForm({ ...form, contentType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Text</SelectItem>
                    <SelectItem value="image">Image</SelectItem>
                    <SelectItem value="video">Video</SelectItem>
                    <SelectItem value="audio">Audio</SelectItem>
                    <SelectItem value="mixed">Mixed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} /></div>
            <div className="grid grid-cols-2 gap-4">
              <FileUploader
                value={form.imageUrl}
                onChange={(url) => setForm({ ...form, imageUrl: url })}
                folder="adverts"
                accept="image/*"
                label="Cover Image"
                placeholder="Upload advert cover image"
                previewAspect="16/9"
              />
              <div className="space-y-1">
                <FileUploader
                  value={form.mediaUrl}
                  onChange={(url) => setForm({ ...form, mediaUrl: url })}
                  folder="adverts"
                  accept="video/*,audio/*,image/*"
                  label="Media File"
                  placeholder="Upload video, audio, or image"
                />
                <span className="text-xs text-gray-400">— or paste URL below —</span>
                <Input value={form.mediaUrl} onChange={(e) => setForm({ ...form, mediaUrl: e.target.value })} placeholder="https://..." className="text-xs" />
              </div>
            </div>
            <Separator />
            <div className="grid grid-cols-3 gap-4">
              <div><Label>Link URL</Label><Input value={form.linkUrl} onChange={(e) => setForm({ ...form, linkUrl: e.target.value })} /></div>
              <div><Label>Link Text</Label><Input value={form.linkText} onChange={(e) => setForm({ ...form, linkText: e.target.value })} placeholder="Learn More" /></div>
              <div><Label>Button Color</Label><div className="flex gap-2"><Input type="color" value={form.buttonColor} onChange={(e) => setForm({ ...form, buttonColor: e.target.value })} className="w-12 h-9 p-1" /><Input value={form.buttonColor} onChange={(e) => setForm({ ...form, buttonColor: e.target.value })} /></div></div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div><Label>Position</Label><Input type="number" value={form.position} onChange={(e) => setForm({ ...form, position: parseInt(e.target.value) || 0 })} /></div>
              <div><Label>Auto-swipe (ms)</Label><Input type="number" value={form.autoSwipeMs} onChange={(e) => setForm({ ...form, autoSwipeMs: parseInt(e.target.value) || 0 })} /></div>
              <div className="flex items-end gap-2 pb-0.5">
                <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
                <Label>Active</Label>
              </div>
            </div>
            {(form.contentType === 'mixed') && (
              <div><Label>HTML Content</Label><Textarea value={form.htmlContent} onChange={(e) => setForm({ ...form, htmlContent: e.target.value })} rows={4} placeholder="<p>Custom HTML content...</p>" /></div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Starts At</Label><Input type="date" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} /></div>
              <div><Label>Expires At</Label><Input type="date" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ============================================
// Preloader Quotes Tab
// ============================================
function PreloaderTab() {
  const [quotes, setQuotes] = useState<PreloaderQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PreloaderQuote | null>(null);
  const [form, setForm] = useState({ quote: '', author: '', isActive: true });

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch('/api/platform/preloader');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) setQuotes(json.data);
    } catch (error: unknown) { handleSilentError(error, 'Failed to load data'); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const resetForm = () => { setForm({ quote: '', author: '', isActive: true }); setEditing(null); };

  const handleSave = async () => {
    if (!form.quote || !form.author) return toast.error('Quote and author are required');
    try {
      const url = editing ? `/api/platform/preloader/${editing.id}` : '/api/platform/preloader';
      const res = await fetch(url, { method: editing ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const json = await res.json();
      if (json.success) { toast.success(editing ? 'Updated' : 'Created'); setDialogOpen(false); resetForm(); fetchItems(); }
      else toast.error(json.message);
    } catch { toast.error('Failed'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this quote?')) return;
    try {
      const res = await fetch(`/api/platform/preloader/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) { toast.success('Deleted'); fetchItems(); } else toast.error(json.message);
    } catch { toast.error('Failed'); }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg">Preloader Quotes</CardTitle>
          <CardDescription>Quotes shown on the loading screen</CardDescription>
        </div>
        <Button size="sm" onClick={() => { resetForm(); setDialogOpen(true); }} className="bg-emerald-600 hover:bg-emerald-700">
          <Plus className="h-4 w-4 mr-1" /> Add Quote
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3"><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div>
        ) : quotes.length === 0 ? (
          <div className="text-center py-8 text-gray-400"><Quote className="h-10 w-10 mx-auto mb-2 opacity-50" /> No quotes yet</div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {quotes.map((q) => (
              <div key={q.id} className="flex items-start gap-3 p-3 rounded-lg border hover:bg-gray-50 transition-colors">
                <Quote className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm italic text-gray-600">&ldquo;{q.quote}&rdquo;</p>
                  <p className="text-xs text-gray-400 mt-1">— {q.author}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Badge variant={q.isActive ? 'default' : 'secondary'} className="text-[10px]">{q.isActive ? 'Active' : 'Inactive'}</Badge>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditing(q); setForm({ quote: q.quote, author: q.author, isActive: q.isActive }); setDialogOpen(true); }}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => handleDelete(q.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Edit Quote' : 'New Quote'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Quote</Label><Textarea value={form.quote} onChange={(e) => setForm({ ...form, quote: e.target.value })} rows={3} /></div>
            <div><Label>Author</Label><Input value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} /></div>
            <div className="flex items-center gap-3"><Label>Active</Label><Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ============================================
// Blog Tab
// ============================================
function BlogTab() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BlogPost | null>(null);
  const [form, setForm] = useState({
    title: '', slug: '', excerpt: '', content: '', coverImage: '',
    authorName: 'Skoolar Team', category: 'General', tags: '',
    isPublished: false, featured: false, readTime: 5,
  });

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch('/api/platform/blog?all=true');
      const json = await res.json();
      if (json.success) setPosts(json.data);
    } catch (error: unknown) { handleSilentError(error, 'Failed to load data'); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const resetForm = () => {
    setForm({ title: '', slug: '', excerpt: '', content: '', coverImage: '', authorName: 'Skoolar Team', category: 'General', tags: '', isPublished: false, featured: false, readTime: 5 });
    setEditing(null);
  };

  const handleSave = async () => {
    if (!form.title || !form.content) return toast.error('Title and content are required');
    try {
      const url = editing ? `/api/platform/blog/${editing.id}` : '/api/platform/blog';
      const res = await fetch(url, { method: editing ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const json = await res.json();
      if (json.success) { toast.success(editing ? 'Updated' : 'Created'); setDialogOpen(false); resetForm(); fetchItems(); }
      else toast.error(json.message);
    } catch { toast.error('Failed'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this post?')) return;
    try {
      const res = await fetch(`/api/platform/blog/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) { toast.success('Deleted'); fetchItems(); } else toast.error(json.message);
    } catch { toast.error('Failed'); }
  };

  const togglePublish = async (post: BlogPost) => {
    try {
      const res = await fetch(`/api/platform/blog/${post.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublished: !post.isPublished }),
      });
      const json = await res.json();
      if (json.success) { toast.success(post.isPublished ? 'Unpublished' : 'Published'); fetchItems(); }
    } catch { toast.error('Failed'); }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg">Blog Posts</CardTitle>
          <CardDescription>Manage platform blog content</CardDescription>
        </div>
        <Button size="sm" onClick={() => { resetForm(); setDialogOpen(true); }} className="bg-emerald-600 hover:bg-emerald-700">
          <Plus className="h-4 w-4 mr-1" /> New Post
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>
        ) : posts.length === 0 ? (
          <div className="text-center py-8 text-gray-400"><FileText className="h-10 w-10 mx-auto mb-2 opacity-50" /> No blog posts yet</div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {posts.map((post) => (
              <div key={post.id} className="flex items-start gap-3 p-3 rounded-lg border hover:bg-gray-50 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{post.title}</p>
                    {post.featured && <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500 shrink-0" />}
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                    <Badge variant="outline">{post.category}</Badge>
                    <span>{formatDate(post.createdAt)}</span>
                    <span>{post.viewCount} views</span>
                    <span>{post.readTime} min read</span>
                    <Badge variant={post.isPublished ? 'default' : 'secondary'} className="text-[10px]">
                      {post.isPublished ? 'Published' : 'Draft'}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => togglePublish(post)} title={post.isPublished ? 'Unpublish' : 'Publish'}>
                    {post.isPublished ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                    setEditing(post);
                    setForm({
                      title: post.title, slug: post.slug, excerpt: post.excerpt || '', content: post.content,
                      coverImage: post.coverImage || '', authorName: post.authorName, category: post.category,
                      tags: (() => { try { const t = JSON.parse(post.tags || '[]'); return Array.isArray(t) ? (t as string[]).join(', ') : ''; } catch { return ''; } })(), isPublished: post.isPublished, featured: post.featured, readTime: post.readTime,
                    });
                    setDialogOpen(true);
                  }}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => handleDelete(post.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Post' : 'New Post'}</DialogTitle>
            <DialogDescription>Create and manage blog posts</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value, slug: editing ? form.slug : generateSlug(e.target.value) })} /></div>
            <div className="grid grid-cols-3 gap-4">
              <div><Label>Slug</Label><Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} /></div>
              <div>
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['General', 'Education', 'Technology', 'Parenting', 'Teaching', 'News', 'Tips', 'Updates'].map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Read Time (min)</Label><Input type="number" value={form.readTime} onChange={(e) => setForm({ ...form, readTime: parseInt(e.target.value) || 5 })} /></div>
            </div>
            <div><Label>Excerpt</Label><Textarea value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} rows={2} placeholder="Brief summary..." /></div>
            <FileUploader
              value={form.coverImage}
              onChange={(url) => setForm({ ...form, coverImage: url })}
              folder="covers"
              accept="image/*"
              label="Cover Image"
              placeholder="Upload a cover image for this blog post"
              previewAspect="16/9"
            />
            <div className="flex items-center gap-2"><span className="text-xs text-gray-400">— or paste URL —</span><Input value={form.coverImage} onChange={(e) => setForm({ ...form, coverImage: e.target.value })} placeholder="https://..." className="text-xs" /></div>
            <div><Label>Content</Label><Textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={10} placeholder="Blog post content..." /></div>
            <div><Label>Tags (comma-separated)</Label><Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="education, tips, technology" /></div>
            <div><Label>Author</Label><Input value={form.authorName} onChange={(e) => setForm({ ...form, authorName: e.target.value })} /></div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2"><Switch checked={form.isPublished} onCheckedChange={(v) => setForm({ ...form, isPublished: v })} /><Label>Published</Label></div>
              <div className="flex items-center gap-2"><Switch checked={form.featured} onCheckedChange={(v) => setForm({ ...form, featured: v })} /><Label>Featured</Label></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ============================================
// Stories Tab
// ============================================
function StoriesTab() {
  const [stories, setStories] = useState<PlatformStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PlatformStory | null>(null);
  const [form, setForm] = useState({
    title: '', excerpt: '', content: '', coverImage: '', level: '', grade: '',
    category: 'General', tags: '', authorName: '', authorBio: '',
    isFeatured: false, isPublished: false,
  });

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch('/api/platform/stories');
      const json = await res.json();
      if (json.success) setStories(json.data);
    } catch (error: unknown) { handleSilentError(error, 'Failed to load data'); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const resetForm = () => {
    setForm({ title: '', excerpt: '', content: '', coverImage: '', level: '', grade: '', category: 'General', tags: '', authorName: '', authorBio: '', isFeatured: false, isPublished: false });
    setEditing(null);
  };

  const handleSave = async () => {
    if (!form.title || !form.content) return toast.error('Title and content are required');
    try {
      const url = editing ? `/api/platform/stories/${editing.id}` : '/api/platform/stories';
      const res = await fetch(url, { method: editing ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const json = await res.json();
      if (json.success) { toast.success(editing ? 'Updated' : 'Created'); setDialogOpen(false); resetForm(); fetchItems(); }
      else toast.error(json.message);
    } catch { toast.error('Failed'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this story?')) return;
    try {
      const res = await fetch(`/api/platform/stories/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) { toast.success('Deleted'); fetchItems(); } else toast.error(json.message);
    } catch { toast.error('Failed'); }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg">Stories</CardTitle>
          <CardDescription>Manage published stories and articles</CardDescription>
        </div>
        <Button size="sm" onClick={() => { resetForm(); setDialogOpen(true); }} className="bg-emerald-600 hover:bg-emerald-700">
          <Plus className="h-4 w-4 mr-1" /> New Story
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>
        ) : stories.length === 0 ? (
          <div className="text-center py-8 text-gray-400"><BookOpen className="h-10 w-10 mx-auto mb-2 opacity-50" /> No stories yet</div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {stories.map((story) => (
              <div key={story.id} className="flex items-start gap-3 p-3 rounded-lg border hover:bg-gray-50 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{story.title}</p>
                    {story.isFeatured && <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500 shrink-0" />}
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-400 flex-wrap">
                    {story.level && <Badge variant="outline">{story.level}</Badge>}
                    {story.grade && <Badge variant="outline">{story.grade}</Badge>}
                    <Badge variant="outline">{story.category}</Badge>
                    <span>{story.viewCount} views</span>
                    <Badge variant={story.isPublished ? 'default' : 'secondary'} className="text-[10px]">
                      {story.isPublished ? 'Published' : 'Draft'}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                    setEditing(story);
                    setForm({
                      title: story.title, excerpt: story.excerpt || '', content: story.content,
                      coverImage: story.coverImage || '', level: story.level || '', grade: story.grade || '',
                      category: story.category, tags: '', authorName: story.authorName || '',
                      authorBio: story.authorBio || '', isFeatured: story.isFeatured, isPublished: story.isPublished,
                    });
                    setDialogOpen(true);
                  }}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => handleDelete(story.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Story' : 'New Story'}</DialogTitle>
            <DialogDescription>Create and manage platform stories</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Level</Label>
                <Select value={form.level} onValueChange={(v) => setForm({ ...form, level: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Beginner">Beginner</SelectItem>
                    <SelectItem value="Intermediate">Intermediate</SelectItem>
                    <SelectItem value="Advanced">Advanced</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Grade</Label>
                <Input value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} placeholder="e.g., JSS 1" />
              </div>
              <div>
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['General', 'Fiction', 'Non-Fiction', 'Science', 'History', 'Culture', 'Adventure', 'Moral', 'Biography'].map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Excerpt</Label><Textarea value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} rows={2} /></div>
            <FileUploader
              value={form.coverImage}
              onChange={(url) => setForm({ ...form, coverImage: url })}
              folder="stories"
              accept="image/*"
              label="Cover Image"
              placeholder="Upload a cover image for this story"
              previewAspect="16/9"
            />
            <div className="flex items-center gap-2"><span className="text-xs text-gray-400">— or paste URL —</span><Input value={form.coverImage} onChange={(e) => setForm({ ...form, coverImage: e.target.value })} placeholder="https://..." className="text-xs" /></div>
            <div><Label>Content</Label><Textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={12} placeholder="Story content..." /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Author Name</Label><Input value={form.authorName} onChange={(e) => setForm({ ...form, authorName: e.target.value })} /></div>
              <div><Label>Author Bio</Label><Input value={form.authorBio} onChange={(e) => setForm({ ...form, authorBio: e.target.value })} /></div>
            </div>
            <div><Label>Tags (comma-separated)</Label><Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} /></div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2"><Switch checked={form.isPublished} onCheckedChange={(v) => setForm({ ...form, isPublished: v })} /><Label>Published</Label></div>
              <div className="flex items-center gap-2"><Switch checked={form.isFeatured} onCheckedChange={(v) => setForm({ ...form, isFeatured: v })} /><Label>Featured</Label></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ============================================
// Story Submissions Tab
// ============================================
function SubmissionsTab() {
  const [items, setItems] = useState<StorySubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [selectedItem, setSelectedItem] = useState<StorySubmission | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [reviewOpen, setReviewOpen] = useState(false);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/platform/story-submissions?${params}`);
      const json = await res.json();
      if (json.success) setItems(json.data);
    } catch (error: unknown) { handleSilentError(error, 'Failed to load data'); } finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    try {
      const res = await fetch(`/api/platform/story-submissions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, rejectionReason: action === 'reject' ? rejectReason : undefined }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(action === 'approve' ? 'Story approved and published!' : 'Submission rejected');
        setReviewOpen(false);
        setSelectedItem(null);
        setRejectReason('');
        fetchItems();
      } else toast.error(json.message);
    } catch { toast.error('Failed'); }
  };

  const statusBadge: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-800',
    approved: 'bg-emerald-100 text-emerald-800',
    rejected: 'bg-red-100 text-red-800',
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Story Submissions</CardTitle>
        <CardDescription>Review and manage user-submitted stories</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 mb-4">
          {['pending', 'approved', 'rejected'].map((s) => (
            <Badge
              key={s}
              variant={statusFilter === s ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => setStatusFilter(s)}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
              {items.filter((i) => i.status === s).length > 0 && (
                <span className="ml-1 text-[10px]">({items.filter((i) => i.status === s).length})</span>
              )}
            </Badge>
          ))}
        </div>

        {loading ? (
          <div className="space-y-3"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>
        ) : items.length === 0 ? (
          <div className="text-center py-8 text-gray-400"><Inbox className="h-10 w-10 mx-auto mb-2 opacity-50" /> No {statusFilter} submissions</div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {items.map((item) => (
              <div key={item.id} className="flex items-start gap-3 p-3 rounded-lg border hover:bg-gray-50 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.title}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                    <span>by {item.authorName}</span>
                    <span>{item.authorEmail}</span>
                    <span>{formatDate(item.createdAt)}</span>
                    <Badge className={`text-[10px] ${statusBadge[item.status] || ''}`}>{item.status}</Badge>
                  </div>
                </div>
                {item.status === 'pending' && (
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="sm" className="h-7 text-emerald-600 hover:text-emerald-700" onClick={() => { setSelectedItem(item); setReviewOpen(true); }}>
                      <ThumbsUp className="h-3.5 w-3.5 mr-1" /> Approve
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 text-red-500" onClick={() => { setSelectedItem(item); setReviewOpen(true); }}>
                      <ThumbsDown className="h-3.5 w-3.5 mr-1" /> Reject
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={reviewOpen} onOpenChange={(open) => { setReviewOpen(open); if (!open) { setSelectedItem(null); setRejectReason(''); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review Story Submission</DialogTitle>
            <DialogDescription>{selectedItem?.title} by {selectedItem?.authorName}</DialogDescription>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-gray-500">Author:</span> <span className="font-medium">{selectedItem.authorName}</span></div>
                <div><span className="text-gray-500">Email:</span> <span className="font-medium">{selectedItem.authorEmail}</span></div>
                <div><span className="text-gray-500">Category:</span> <Badge variant="outline">{selectedItem.category}</Badge></div>
                <div><span className="text-gray-500">Submitted:</span> <span className="font-medium">{formatDate(selectedItem.createdAt)}</span></div>
              </div>
              <Separator />
              <div>
                <Label className="text-gray-500 text-xs">Story Content</Label>
                <div className="mt-1 p-4 bg-gray-50 rounded-lg text-sm whitespace-pre-wrap max-h-64 overflow-y-auto">
                  {selectedItem.content}
                </div>
              </div>
              <div>
                <Label>Rejection Reason (if rejecting)</Label>
                <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={2} placeholder="Reason for rejection..." />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewOpen(false)}>Cancel</Button>
            {selectedItem?.status === 'pending' && (
              <>
                <Button variant="destructive" onClick={() => handleAction(selectedItem.id, 'reject')}>
                  <ThumbsDown className="h-4 w-4 mr-1" /> Reject
                </Button>
                <Button onClick={() => handleAction(selectedItem.id, 'approve')} className="bg-emerald-600 hover:bg-emerald-700">
                  <ThumbsUp className="h-4 w-4 mr-1" /> Approve & Publish
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ============================================
// Settings Tab
// ============================================
function SettingsTab() {
  const [settings, setSettings] = useState<PlatformSettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    siteName: '', siteDescription: '', siteLogo: '', siteFavicon: '',
    primaryColor: '#059669', secondaryColor: '#10B981', accentColor: '#F59E0B',
    contactEmail: '', contactPhone: '', contactAddress: '',
    socialLinks: '', enablePreloader: true, enableAdverts: true, enableAnnouncements: true,
    heroTitle: '', heroSubtitle: '', heroImageUrl: '',
  });

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/platform/settings');
      const json = await res.json();
      if (json.success && json.data) {
        setSettings(json.data);
        const d = json.data;
        setForm({
          siteName: d.siteName || '', siteDescription: d.siteDescription || '',
          siteLogo: d.siteLogo || '', siteFavicon: d.siteFavicon || '',
          primaryColor: d.primaryColor || '#059669', secondaryColor: d.secondaryColor || '#10B981',
          accentColor: d.accentColor || '#F59E0B', contactEmail: d.contactEmail || '',
          contactPhone: d.contactPhone || '', contactAddress: d.contactAddress || '',
          socialLinks: d.socialLinks || '',
          enablePreloader: d.enablePreloader !== false, enableAdverts: d.enableAdverts !== false,
          enableAnnouncements: d.enableAnnouncements !== false,
          heroTitle: d.heroTitle || '', heroSubtitle: d.heroSubtitle || '', heroImageUrl: d.heroImageUrl || '',
        });
      }
    } catch (error: unknown) { handleSilentError(error, 'Failed to load data'); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/platform/settings', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      });
      const json = await res.json();
      if (json.success) { toast.success('Settings saved'); fetchSettings(); }
      else toast.error(json.message);
    } catch { toast.error('Failed to save'); } finally { setSaving(false); }
  };

  if (loading) return <Card><CardContent className="p-6"><Skeleton className="h-96 w-full" /></CardContent></Card>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Platform Settings</CardTitle>
        <CardDescription>Configure global platform settings and features</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-gray-700">General</h4>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Site Name</Label><Input value={form.siteName} onChange={(e) => setForm({ ...form, siteName: e.target.value })} /></div>
            <div><Label>Site Description</Label><Input value={form.siteDescription} onChange={(e) => setForm({ ...form, siteDescription: e.target.value })} /></div>
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-gray-700">Branding & Colors</h4>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Primary Color</Label>
              <div className="flex gap-2 mt-1">
                <Input type="color" value={form.primaryColor} onChange={(e) => setForm({ ...form, primaryColor: e.target.value })} className="w-12 h-9 p-1" />
                <Input value={form.primaryColor} onChange={(e) => setForm({ ...form, primaryColor: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Secondary Color</Label>
              <div className="flex gap-2 mt-1">
                <Input type="color" value={form.secondaryColor} onChange={(e) => setForm({ ...form, secondaryColor: e.target.value })} className="w-12 h-9 p-1" />
                <Input value={form.secondaryColor} onChange={(e) => setForm({ ...form, secondaryColor: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Accent Color</Label>
              <div className="flex gap-2 mt-1">
                <Input type="color" value={form.accentColor} onChange={(e) => setForm({ ...form, accentColor: e.target.value })} className="w-12 h-9 p-1" />
                <Input value={form.accentColor} onChange={(e) => setForm({ ...form, accentColor: e.target.value })} />
              </div>
            </div>
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-gray-700">Contact Information</h4>
          <div className="grid grid-cols-3 gap-4">
            <div><Label>Contact Email</Label><Input value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} /></div>
            <div><Label>Contact Phone</Label><Input value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} /></div>
            <div><Label>Contact Address</Label><Input value={form.contactAddress} onChange={(e) => setForm({ ...form, contactAddress: e.target.value })} /></div>
          </div>
          <div><Label>Social Links (JSON)</Label><Textarea value={form.socialLinks} onChange={(e) => setForm({ ...form, socialLinks: e.target.value })} rows={3} placeholder='{"facebook": "...", "twitter": "..."}' /></div>
        </div>

        <Separator />

        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-gray-700">Feature Toggles</h4>
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2"><Switch checked={form.enablePreloader} onCheckedChange={(v) => setForm({ ...form, enablePreloader: v })} /><Label>Enable Preloader</Label></div>
            <div className="flex items-center gap-2"><Switch checked={form.enableAdverts} onCheckedChange={(v) => setForm({ ...form, enableAdverts: v })} /><Label>Enable Adverts</Label></div>
            <div className="flex items-center gap-2"><Switch checked={form.enableAnnouncements} onCheckedChange={(v) => setForm({ ...form, enableAnnouncements: v })} /><Label>Enable Announcements</Label></div>
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-gray-700">Hero Section</h4>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Hero Title</Label><Input value={form.heroTitle} onChange={(e) => setForm({ ...form, heroTitle: e.target.value })} /></div>
            <div><Label>Hero Subtitle</Label><Input value={form.heroSubtitle} onChange={(e) => setForm({ ...form, heroSubtitle: e.target.value })} /></div>
          </div>
          <FileUploader
            value={form.heroImageUrl}
            onChange={(url) => setForm({ ...form, heroImageUrl: url })}
            folder="hero"
            accept="image/*"
            label="Hero Image"
            placeholder="Upload a hero section image"
            previewAspect="21/9"
          />
          <div className="flex items-center gap-2"><span className="text-xs text-gray-400">— or paste URL —</span><Input value={form.heroImageUrl} onChange={(e) => setForm({ ...form, heroImageUrl: e.target.value })} placeholder="https://..." className="text-xs" /></div>
        </div>

        <Separator />

        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-gray-700">Branding</h4>
          <div className="grid grid-cols-2 gap-6">
            <FileUploader
              value={form.siteLogo}
              onChange={(url) => setForm({ ...form, siteLogo: url })}
              folder="logos"
              accept="image/*"
              label="Site Logo"
              placeholder="Upload the platform logo"
              previewAspect="2/1"
            />
            <FileUploader
              value={form.siteFavicon}
              onChange={(url) => setForm({ ...form, siteFavicon: url })}
              folder="favicons"
              accept="image/png,image/x-icon,image/svg+xml"
              label="Site Favicon"
              placeholder="Upload favicon (PNG, ICO, or SVG)"
              previewAspect="1/1"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={handleSave} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Settings
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// Privacy Tab
// ============================================
function PrivacyTab() {
  const [privacyPolicy, setPrivacyPolicy] = useState('');
  const [cookiePolicy, setCookiePolicy] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadPrivacy = async () => {
      try {
        const res = await fetch('/api/platform/privacy');
        const json = await res.json();
        if (json.success) {
          setPrivacyPolicy(json.data.privacyPolicy || '');
          setCookiePolicy(json.data.cookiePolicy || '');
        }
    } catch (error: unknown) { handleSilentError(error, 'Failed to load announcements'); } finally { setLoading(false); }
    };
    loadPrivacy();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/platform/privacy', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ privacyPolicy, cookiePolicy }),
      });
      const json = await res.json();
      if (json.success) toast.success('Privacy policies saved');
      else toast.error(json.message);
    } catch { toast.error('Failed'); } finally { setSaving(false); }
  };

  if (loading) return <Card><CardContent className="p-6"><Skeleton className="h-96 w-full" /></CardContent></Card>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Privacy Policy & Cookies</CardTitle>
        <CardDescription>Manage privacy policy and cookie policy content</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label className="text-base font-semibold">Privacy Policy</Label>
          <p className="text-xs text-gray-400">This content is displayed on the privacy policy page</p>
          <Textarea
            value={privacyPolicy}
            onChange={(e) => setPrivacyPolicy(e.target.value)}
            rows={16}
            placeholder="Enter your privacy policy content here..."
            className="font-mono text-sm"
          />
        </div>
        <Separator />
        <div className="space-y-2">
          <Label className="text-base font-semibold">Cookie Policy</Label>
          <p className="text-xs text-gray-400">This content is displayed on the cookie policy page</p>
          <Textarea
            value={cookiePolicy}
            onChange={(e) => setCookiePolicy(e.target.value)}
            rows={12}
            placeholder="Enter your cookie policy content here..."
            className="font-mono text-sm"
          />
        </div>
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Policies
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
