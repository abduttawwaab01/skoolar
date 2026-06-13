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
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Plus, Pencil, Trash2, Eye, EyeOff, Megaphone, Quote,
  FileText, BookOpen, Inbox, Settings, Shield, Loader2, ExternalLink,
  Star, ThumbsUp, ThumbsDown, Image as ImageIcon, Headphones, Film,
  CreditCard, Search, X, School, Users, GraduationCap, Crown, ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { handleSilentError } from '@/lib/error-handler';
import { SafeFormattedDate } from '@/components/shared/safe-formatted-date';
import { cn } from '@/lib/utils';

const formatDate = (date: string | Date) => new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(date));
import { FileUploader } from '@/components/ui/file-uploader';
import { useConfirm } from '@/components/confirm-dialog';

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

interface AnnouncementForm {
  title: string;
  message: string;
  type: string;
  linkUrl: string;
  targetRoles: string[];
  targetSchools: string[];
  isActive: boolean;
  startsAt: string;
  expiresAt: string;
}

interface AdvertForm {
  title: string;
  description: string;
  contentType: string;
  mediaUrl: string;
  mediaType: string;
  imageUrl: string;
  linkUrl: string;
  linkText: string;
  ctaType: string;
  htmlContent: string;
  buttonColor: string;
  targetRoles: string[];
  targetSchools: string[];
  position: number;
  autoSwipeMs: number;
  isActive: boolean;
  startsAt: string;
  expiresAt: string;
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
  audioUrl: string | null; audioDuration: number | null; audioPlatform: string | null;
  videoUrl: string | null; videoDuration: number | null; videoPlatform: string | null;
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
  paymentBankName: string | null; paymentBankAccount: string | null; paymentBankAccountName: string | null;
  createdAt: string; updatedAt: string;
}



function generateSlug(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now().toString(36);
}

// ============================================
// Component
// ============================================
export function PlatformAdminPanel() {
  const [activeTab, setActiveTab] = useState('announcements');
  const confirm = useConfirm();

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
        <TabsList className="w-full justify-start overflow-x-auto flex-nowrap h-auto gap-1 bg-gray-100 p-1">
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
          <TabsTrigger value="schools" className="text-xs gap-1.5 data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
            <School className="h-3.5 w-3.5" /> Schools
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
        <TabsContent value="schools"><SchoolsTab /></TabsContent>
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
   const [tabMounted, setTabMounted] = useState(false);
   useEffect(() => setTabMounted(true), []);
   const ROLES = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STUDENT', 'PARENT', 'ACCOUNTANT', 'LIBRARIAN', 'DIRECTOR'];
    const [form, setForm] = useState<AnnouncementForm>({ 
      title: '', 
      message: '', 
      type: 'info', 
      linkUrl: '', 
      targetRoles: [], 
      targetSchools: [], 
      isActive: true, 
      startsAt: '', 
      expiresAt: '' 
    });
    const confirm = useConfirm();

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch('/api/platform/announcements');
      const json = await res.json();
      if (json.success) setItems(json.data);
    } catch (error: unknown) { handleSilentError(error, 'Failed to load data'); } finally { setLoading(false); }
  }, []);

   useEffect(() => { fetchItems(); }, [fetchItems]);

   // Fetch schools for targeting
   useEffect(() => {
     const fetchSchools = async () => {
       try {
         const res = await fetch('/api/schools?limit=100');
         if (res.ok) {
           const json = await res.json();
           setSchools((json.data || []).map((s: {id: string; name: string}) => ({ id: s.id, name: s.name })));
         }
       } catch (error) {
         // Schools list is optional, continue without it
       }
     };
     fetchSchools();
   }, []);

   const resetForm = () => {
     setForm({ 
       title: '', 
       message: '', 
       type: 'info', 
       linkUrl: '', 
       targetRoles: [], 
       targetSchools: [], 
       isActive: true, 
       startsAt: '', 
       expiresAt: '' 
     });
     setEditing(null);
   };

   const toggleTargetRole = (role: string) => {
     setForm(prev => ({
       ...prev,
       targetRoles: prev.targetRoles.includes(role)
         ? prev.targetRoles.filter(r => r !== role)
         : [...prev.targetRoles, role],
     }));
   };

   const toggleTargetSchool = (schoolId: string) => {
     setForm(prev => ({
       ...prev,
       targetSchools: prev.targetSchools.includes(schoolId)
         ? prev.targetSchools.filter(s => s !== schoolId)
         : [...prev.targetSchools, schoolId],
     }));
   };

   const handleSave = async () => {
     if (!form.message) return toast.error('Message is required');
     try {
       const payload = {
         ...form,
         targetRoles: [...new Set(form.targetRoles.map(r => r.toUpperCase()))],
         targetSchools: [...new Set(form.targetSchools)],
       };
       const url = editing ? `/api/platform/announcements/${editing.id}` : '/api/platform/announcements';
       const method = editing ? 'PUT' : 'POST';
       const res = await fetch(url, {
         method,
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify(payload),
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
     const ok = await confirm('Delete Announcement', 'Are you sure you want to delete this announcement? This action cannot be undone.');
     if (!ok) return;
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
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div>
          <CardTitle className="text-lg">Announcements</CardTitle>
          <CardDescription>Platform-wide announcements shown to all users</CardDescription>
        </div>
        <Button size="sm" onClick={() => { resetForm(); setDialogOpen(true); }} className="bg-emerald-600 hover:bg-emerald-700 shrink-0">
          <Plus className="h-4 w-4 mr-1" /> Add
        </Button>
       </CardHeader>
       <CardContent>
         {loading ? (
           <div className="space-y-3"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>
         ) : items.length === 0 ? (
           <div className="text-center py-8 text-gray-400"><Megaphone className="h-10 w-10 mx-auto mb-2 opacity-50" /> No announcements yet</div>
         ) : (
           <div className="space-y-2 max-h-[calc(100vh-200px)] overflow-y-auto overflow-x-auto">
            {items.map((item) => (
              <div key={item.id} className="flex items-start gap-3 p-3 rounded-lg border hover:bg-gray-50 transition-colors">
                <Badge variant="secondary" className={typeColors[item.type] || ''}>{item.type}</Badge>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.message}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                    <span>{tabMounted ? formatDate(item.createdAt) : ''}</span>
                    {item.linkUrl && <ExternalLink className="h-3 w-3" />}
                    <Badge variant={item.isActive ? 'default' : 'secondary'} className="text-[10px]">
                      {item.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                   <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                     const parseToArray = (val: string | null): string[] => {
                       if (!val) return [];
                       try {
                         const parsed = JSON.parse(val);
                         if (Array.isArray(parsed)) return parsed;
                       } catch {
                         // not JSON, treat as CSV
                       }
                       // If it's a CSV string
                       return val.split(',').map(s => s.trim()).filter(Boolean);
                     };
                     setEditing(item);
                     setForm({
                       title: item.title || '',
                       message: item.message,
                       type: item.type,
                       linkUrl: item.linkUrl || '',
                       targetRoles: parseToArray(item.targetRoles),
                       targetSchools: parseToArray(item.targetSchools),
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
          <DialogContent className="max-w-[90vw] w-full max-w-lg max-h-[calc(100vh-180px)] overflow-y-auto">
           <DialogHeader>
             <DialogTitle>{editing ? 'Edit Announcement' : 'New Announcement'}</DialogTitle>
             <DialogDescription>Create and manage platform announcements</DialogDescription>
           </DialogHeader>
           <div className="space-y-4">
             <div>
               <Label>Title (optional)</Label>
               <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Announcement title" />
             </div>
             <div>
               <Label>Message *</Label>
               <Textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} rows={4} placeholder="Announcement message..." />
             </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Type</Label>
                  <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['info', 'warning', 'urgent', 'success'].map((t) => (
                        <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Link URL</Label>
                  <Input value={form.linkUrl} onChange={(e) => setForm({ ...form, linkUrl: e.target.value })} placeholder="https://..." />
                </div>
              </div>
              <div>
                <Label>Target Roles</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                 {ROLES.map((role) => (
                   <Badge key={role} variant={form.targetRoles.includes(role) ? 'default' : 'outline'} className="cursor-pointer" onClick={() => toggleTargetRole(role)}>
                     {role}
                   </Badge>
                 ))}
               </div>
             </div>
             {schools.length > 0 && (
               <div>
                 <Label>Target Schools (optional — empty = all schools)</Label>
                 <div className="flex flex-wrap gap-2 mt-1 max-h-32 overflow-y-auto">
                   {schools.map((school) => (
                     <Badge key={school.id} variant={form.targetSchools.includes(school.id) ? 'default' : 'outline'} className="cursor-pointer" onClick={() => toggleTargetSchool(school.id)}>
                       {school.name}
                     </Badge>
                   ))}
                 </div>
               </div>
             )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Starts At</Label>
                  <Input type="date" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} />
                </div>
                <div>
                  <Label>Expires At</Label>
                  <Input type="date" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} />
                </div>
              </div>
             <div className="flex items-center gap-2">
               <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
               <Label>Active</Label>
             </div>
           </div>
           <DialogFooter>
             <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancel</Button>
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
  const [tabMounted, setTabMounted] = useState(false);
  useEffect(() => setTabMounted(true), []);
    const [form, setForm] = useState({
      title: '', excerpt: '', content: '', coverImage: '', level: '', grade: '',
      category: 'General', tags: '', authorName: '', authorBio: '',
      isFeatured: false, isPublished: false,
      audioUrl: '', audioDuration: '', audioPlatform: 'auto',
      videoUrl: '', videoDuration: '', videoPlatform: 'auto',
    });
   const confirm = useConfirm();

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch('/api/platform/stories?all=true');
      const json = await res.json();
      if (json.success) setStories(json.data);
    } catch (error: unknown) { handleSilentError(error, 'Failed to load data'); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const resetForm = () => {
    setForm({ title: '', excerpt: '', content: '', coverImage: '', level: '', grade: '', category: 'General', tags: '', authorName: '', authorBio: '', isFeatured: false, isPublished: false, audioUrl: '', audioDuration: '', audioPlatform: 'auto', videoUrl: '', videoDuration: '', videoPlatform: 'auto' });
    setEditing(null);
  };

  const handleSave = async () => {
    if (!form.title || !form.content) return toast.error('Title and content are required');
    try {
      const url = editing ? `/api/platform/stories/${editing.id}` : '/api/platform/stories';
      const payload = {
        ...form,
        audioDuration: form.audioDuration ? Number(form.audioDuration) : undefined,
        videoDuration: form.videoDuration ? Number(form.videoDuration) : undefined,
        audioPlatform: form.audioPlatform || undefined,
        videoPlatform: form.videoPlatform || undefined,
      };
      const res = await fetch(url, { method: editing ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const json = await res.json();
      if (json.success) { toast.success(editing ? 'Updated' : 'Created'); setDialogOpen(false); resetForm(); fetchItems(); }
      else toast.error(json.message);
    } catch { toast.error('Failed'); }
  };

   const handleDelete = async (id: string) => {
     const ok = await confirm('Delete Story', 'Are you sure you want to delete this story? This action cannot be undone.');
     if (!ok) return;
     try {
       const res = await fetch(`/api/platform/stories/${id}`, { method: 'DELETE' });
       const json = await res.json();
       if (json.success) { toast.success('Deleted'); fetchItems(); } else toast.error(json.message);
     } catch { toast.error('Failed'); }
   };

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div>
          <CardTitle className="text-lg">Stories</CardTitle>
          <CardDescription>Manage published stories and articles</CardDescription>
        </div>
        <Button size="sm" onClick={() => { resetForm(); setDialogOpen(true); }} className="bg-emerald-600 hover:bg-emerald-700 shrink-0">
          <Plus className="h-4 w-4 mr-1" /> New Story
        </Button>
       </CardHeader>
       <CardContent>
         {loading ? (
           <div className="space-y-3"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>
         ) : stories.length === 0 ? (
           <div className="text-center py-8 text-gray-400"><BookOpen className="h-10 w-10 mx-auto mb-2 opacity-50" /> No stories yet</div>
         ) : (
           <div className="space-y-2 max-h-[calc(100vh-200px)] overflow-y-auto overflow-x-auto">
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
                      audioUrl: story.audioUrl || '', audioDuration: story.audioDuration?.toString() || '', audioPlatform: story.audioPlatform || '',
                      videoUrl: story.videoUrl || '', videoDuration: story.videoDuration?.toString() || '', videoPlatform: story.videoPlatform || '',
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
         <DialogContent className="max-w-[90vw] w-full max-w-3xl max-h-[calc(100vh-180px)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Story' : 'New Story'}</DialogTitle>
            <DialogDescription>Create and manage platform stories</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                    {['General', 'Adventure', 'Fantasy', 'Science Fiction', 'Mystery', 'Non-Fiction', 'Historical', 'Motivational', 'Educational', 'Comedy', 'Drama', 'Poetry', 'Other'].map((c) => (
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><Label>Author Name</Label><Input value={form.authorName} onChange={(e) => setForm({ ...form, authorName: e.target.value })} /></div>
              <div><Label>Author Bio</Label><Input value={form.authorBio} onChange={(e) => setForm({ ...form, authorBio: e.target.value })} /></div>
            </div>
            <div><Label>Tags (comma-separated)</Label><Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} /></div>
            <Separator />
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <Headphones className="h-4 w-4 text-emerald-600" /> Audiobook Settings
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <Label className="text-xs text-gray-500">Audio URL (Spotify, SoundCloud, or direct MP3)</Label>
                  <Input value={form.audioUrl} onChange={(e) => setForm({ ...form, audioUrl: e.target.value })} placeholder="https://open.spotify.com/track/..." className="text-xs" />
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Platform</Label>
                  <Select value={form.audioPlatform} onValueChange={(v) => setForm({ ...form, audioPlatform: v })}>
                    <SelectTrigger className="text-xs"><SelectValue placeholder="Auto" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto-detect</SelectItem>
                      <SelectItem value="spotify">Spotify</SelectItem>
                      <SelectItem value="soundcloud">SoundCloud</SelectItem>
                      <SelectItem value="direct">Direct MP3</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="mt-2">
                <Label className="text-xs text-gray-500">Duration (seconds, optional)</Label>
                <Input type="number" min="0" value={form.audioDuration} onChange={(e) => setForm({ ...form, audioDuration: e.target.value })} placeholder="e.g., 3600" className="text-xs w-40" />
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <Film className="h-4 w-4 text-purple-600" /> Videobook Settings
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <Label className="text-xs text-gray-500">Video URL (YouTube, Vimeo, or direct MP4)</Label>
                  <Input value={form.videoUrl} onChange={(e) => setForm({ ...form, videoUrl: e.target.value })} placeholder="https://www.youtube.com/watch?v=..." className="text-xs" />
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Platform</Label>
                  <Select value={form.videoPlatform} onValueChange={(v) => setForm({ ...form, videoPlatform: v })}>
                    <SelectTrigger className="text-xs"><SelectValue placeholder="Auto" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto-detect</SelectItem>
                      <SelectItem value="youtube">YouTube</SelectItem>
                      <SelectItem value="vimeo">Vimeo</SelectItem>
                      <SelectItem value="dailymotion">Dailymotion</SelectItem>
                      <SelectItem value="direct">Direct MP4</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="mt-2">
                <Label className="text-xs text-gray-500">Duration (seconds, optional)</Label>
                <Input type="number" min="0" value={form.videoDuration} onChange={(e) => setForm({ ...form, videoDuration: e.target.value })} placeholder="e.g., 600" className="text-xs w-40" />
              </div>
            </div>
            <Separator />
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
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
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [tabMounted, setTabMounted] = useState(false);
  useEffect(() => setTabMounted(true), []);
  const limit = 10;

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      params.set('page', String(page));
      params.set('limit', String(limit));
      const res = await fetch(`/api/platform/story-submissions?${params}`);
      const json = await res.json();
      if (json.success) {
        setItems(json.data);
        setTotalPages(json.totalPages || 1);
      }
    } catch (error: unknown) { handleSilentError(error, 'Failed to load data'); } finally { setLoading(false); }
  }, [statusFilter, page]);

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
          <div className="space-y-2 max-h-[calc(100vh-200px)] overflow-y-auto overflow-x-auto">
            {items.map((item) => (
              <div key={item.id} className="flex items-start gap-3 p-3 rounded-lg border hover:bg-gray-50 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.title}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                    <span>by {item.authorName}</span>
                    <span>{item.authorEmail}</span>
                    <span>{tabMounted ? formatDate(item.createdAt) : ''}</span>
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
        <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review Story Submission</DialogTitle>
            <DialogDescription>{selectedItem?.title} by {selectedItem?.authorName}</DialogDescription>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div><span className="text-gray-500">Author:</span> <span className="font-medium">{selectedItem.authorName}</span></div>
                <div><span className="text-gray-500">Email:</span> <span className="font-medium">{selectedItem.authorEmail}</span></div>
                <div><span className="text-gray-500">Category:</span> <Badge variant="outline">{selectedItem.category}</Badge></div>
                <div><span className="text-gray-500">Submitted:</span> <span className="font-medium">{tabMounted ? formatDate(selectedItem.createdAt) : ''}</span></div>
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
    paymentBankName: '', paymentBankAccount: '', paymentBankAccountName: '',
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
           paymentBankName: d.paymentBankName || '', paymentBankAccount: d.paymentBankAccount || '', 
           paymentBankAccountName: d.paymentBankAccountName || '',
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><Label>Site Name</Label><Input value={form.siteName} onChange={(e) => setForm({ ...form, siteName: e.target.value })} /></div>
            <div><Label>Site Description</Label><Input value={form.siteDescription} onChange={(e) => setForm({ ...form, siteDescription: e.target.value })} /></div>
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-gray-700">Branding & Colors</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div><Label>Contact Email</Label><Input value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} /></div>
            <div><Label>Contact Phone</Label><Input value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} /></div>
            <div><Label>Contact Address</Label><Input value={form.contactAddress} onChange={(e) => setForm({ ...form, contactAddress: e.target.value })} /></div>
          </div>
          <div><Label>Social Links (JSON)</Label><Textarea value={form.socialLinks} onChange={(e) => setForm({ ...form, socialLinks: e.target.value })} rows={3} placeholder='{"facebook": "...", "twitter": "..."}' /></div>
        </div>

        <Separator />

        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-gray-700">Feature Toggles</h4>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex items-center gap-2"><Switch checked={form.enablePreloader} onCheckedChange={(v) => setForm({ ...form, enablePreloader: v })} /><Label>Enable Preloader</Label></div>
            <div className="flex items-center gap-2"><Switch checked={form.enableAdverts} onCheckedChange={(v) => setForm({ ...form, enableAdverts: v })} /><Label>Enable Adverts</Label></div>
            <div className="flex items-center gap-2"><Switch checked={form.enableAnnouncements} onCheckedChange={(v) => setForm({ ...form, enableAnnouncements: v })} /><Label>Enable Announcements</Label></div>
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-gray-700">Hero Section</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
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

         <Separator />

         <div className="space-y-4">
           <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
             <CreditCard className="size-4" /> Bank Transfer Settings
           </h4>
           <p className="text-xs text-gray-500">These bank details are shown to schools when they subscribe via bank transfer.</p>
           <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div><Label>Bank Name</Label><Input value={form.paymentBankName} onChange={(e) => setForm({ ...form, paymentBankName: e.target.value })} placeholder="e.g. PalmPay" /></div>
              <div><Label>Account Number</Label><Input value={form.paymentBankAccount} onChange={(e) => setForm({ ...form, paymentBankAccount: e.target.value })} placeholder="e.g. 9033460322" /></div>
              <div><Label>Account Name</Label><Input value={form.paymentBankAccountName} onChange={(e) => setForm({ ...form, paymentBankAccountName: e.target.value })} placeholder="e.g. Skoolar" /></div>
            </div>
         </div>

         <Separator />

         <div className="space-y-4">
           <h4 className="text-sm font-semibold text-gray-700">Platform Assets</h4>
          <p className="text-xs text-gray-500">Download platform assets for use in school documents and branding.</p>
          <div className="grid grid-cols-1 gap-4">
            <div className="flex items-center justify-between flex-wrap gap-4 p-4 rounded-lg border bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-white border flex items-center justify-center">
                  <svg className="w-8 h-8 text-teal-600" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" fill="none" stroke="currentColor" strokeWidth="2"/>
                    <polyline points="14 2 14 8 20 8" fill="none" stroke="currentColor" strokeWidth="2"/>
                    <line x1="16" y1="13" x2="8" y2="13" stroke="currentColor" strokeWidth="2"/>
                    <line x1="16" y1="17" x2="8" y2="17" stroke="currentColor" strokeWidth="2"/>
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-gray-900">Letterhead</p>
                  <p className="text-xs text-gray-500">Official letterhead template</p>
                </div>
              </div>
              <Button variant="outline" onClick={() => window.open('/Letterhead.png', '_blank')}>
                Download
              </Button>
            </div>
            <div className="flex items-center justify-between flex-wrap gap-4 p-4 rounded-lg border bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-white border flex items-center justify-center">
                  <svg className="w-8 h-8 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                    <path d="M2 17l10 5 10-5"/>
                    <path d="M2 12l10 5 10-5"/>
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-gray-900">Platform Logo</p>
                  <p className="text-xs text-gray-500">Skoolar official logo</p>
                </div>
              </div>
              {form.siteLogo && (
                <Button variant="outline" onClick={() => window.open(form.siteLogo, '_blank')}>
                  Download
                </Button>
              )}
            </div>
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

// ============================================
// Adverts Tab
// ============================================
function AdvertsTab() {
  const [items, setItems] = useState<PlatformAdvert[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PlatformAdvert | null>(null);
  const ROLES = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STUDENT', 'PARENT', 'ACCOUNTANT', 'LIBRARIAN', 'DIRECTOR'];
  const [form, setForm] = useState({
    title: '', description: '', contentType: 'banner', mediaUrl: '', mediaType: '',
    imageUrl: '', linkUrl: '', linkText: '', ctaType: 'learn_more', htmlContent: '',
    buttonColor: '#059669', targetRoles: [] as string[], targetSchools: [] as string[],
    position: 0, autoSwipeMs: 5000, isActive: true, startsAt: '', expiresAt: '',
  });
  const confirm = useConfirm();

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
      title: '', description: '', contentType: 'banner', mediaUrl: '', mediaType: '',
      imageUrl: '', linkUrl: '', linkText: '', ctaType: 'learn_more', htmlContent: '',
      buttonColor: '#059669', targetRoles: [], targetSchools: [],
      position: 0, autoSwipeMs: 5000, isActive: true, startsAt: '', expiresAt: '',
    });
    setEditing(null);
  };

  const handleSave = async () => {
    if (!form.title) return toast.error('Title is required');
    try {
      const url = editing ? `/api/platform/adverts/${editing.id}` : '/api/platform/adverts';
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(editing ? 'Advert updated' : 'Advert created');
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
    const ok = await confirm('Delete Advert', 'Are you sure you want to delete this advert? This action cannot be undone.');
    if (!ok) return;
    try {
      const res = await fetch(`/api/platform/adverts/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) { toast.success('Deleted'); fetchItems(); } else toast.error(json.message);
    } catch { toast.error('Failed to delete'); }
  };

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div>
          <CardTitle className="text-lg">Adverts</CardTitle>
          <CardDescription>Manage platform advertisements</CardDescription>
        </div>
        <Button size="sm" onClick={() => { resetForm(); setDialogOpen(true); }} className="bg-emerald-600 hover:bg-emerald-700 shrink-0">
          <Plus className="h-4 w-4 mr-1" /> Add
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>
        ) : items.length === 0 ? (
          <div className="text-center py-8 text-gray-400"><ImageIcon className="h-10 w-10 mx-auto mb-2 opacity-50" /> No adverts yet</div>
        ) : (
          <div className="space-y-2 overflow-x-auto">
            {items.map((item) => (
              <div key={item.id} className="flex items-start gap-3 p-3 rounded-lg border hover:bg-gray-50 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.title}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                    <span>{item.contentType}</span>
                    <span>Pos: {item.position}</span>
                    <Badge variant={item.isActive ? 'default' : 'secondary'} className="text-[10px]">
                      {item.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                    setEditing(item);
                    setForm({
                      title: item.title, description: item.description || '',
                      contentType: item.contentType, mediaUrl: item.mediaUrl || '',
                      mediaType: item.mediaType || '', imageUrl: item.imageUrl || '',
                      linkUrl: item.linkUrl || '', linkText: item.linkText || '',
                      ctaType: item.ctaType, htmlContent: item.htmlContent || '',
                      buttonColor: item.buttonColor, targetRoles: item.targetRoles ? JSON.parse(item.targetRoles) : [],
                      targetSchools: item.targetSchools ? JSON.parse(item.targetSchools) : [],
                      position: item.position, autoSwipeMs: item.autoSwipeMs,
                      isActive: item.isActive,
                      startsAt: item.startsAt?.split('T')[0] || '',
                      expiresAt: item.expiresAt?.split('T')[0] || '',
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
        <DialogContent className="max-w-[90vw] w-full max-w-2xl max-h-[calc(100vh-180px)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Advert' : 'New Advert'}</DialogTitle>
            <DialogDescription>Create and manage platform advertisements</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><Label>Title *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
              <div>
                <Label>Content Type</Label>
                <Select value={form.contentType} onValueChange={(v) => setForm({ ...form, contentType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['banner', 'card', 'full_width', 'popup', 'sidebar'].map((t) => (
                      <SelectItem key={t} value={t}>{t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><Label>Image URL</Label><Input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} placeholder="https://..." /></div>
              <div><Label>Link URL</Label><Input value={form.linkUrl} onChange={(e) => setForm({ ...form, linkUrl: e.target.value })} placeholder="https://..." /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div><Label>Link Text</Label><Input value={form.linkText} onChange={(e) => setForm({ ...form, linkText: e.target.value })} /></div>
              <div>
                <Label>CTA Type</Label>
                <Select value={form.ctaType} onValueChange={(v) => setForm({ ...form, ctaType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['learn_more', 'sign_up', 'get_started', 'book_now', 'contact_us', 'custom'].map((t) => (
                      <SelectItem key={t} value={t}>{t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Button Color</Label><div className="flex gap-2"><Input type="color" value={form.buttonColor} onChange={(e) => setForm({ ...form, buttonColor: e.target.value })} className="w-12 h-9 p-1" /><Input value={form.buttonColor} onChange={(e) => setForm({ ...form, buttonColor: e.target.value })} /></div></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><Label>Position</Label><Input type="number" value={form.position} onChange={(e) => setForm({ ...form, position: parseInt(e.target.value) || 0 })} /></div>
              <div><Label>Auto-Swipe (ms)</Label><Input type="number" value={form.autoSwipeMs} onChange={(e) => setForm({ ...form, autoSwipeMs: parseInt(e.target.value) || 5000 })} /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><Label>Starts At</Label><Input type="date" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} /></div>
              <div><Label>Expires At</Label><Input type="date" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} /></div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
              <Label>Active</Label>
            </div>
            <div>
              <Label>HTML Content (optional, advanced)</Label>
              <Textarea value={form.htmlContent} onChange={(e) => setForm({ ...form, htmlContent: e.target.value })} rows={3} placeholder="<div>Custom HTML...</div>" />
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
// Schools Tab — Plan Management for Super Admin
// ============================================
interface SchoolRecord {
  id: string;
  name: string;
  email: string | null;
  plan: string;
  planId: string | null;
  maxStudents: number;
  maxTeachers: number;
  liveClassMaxParticipants: number;
  liveClassMaxDuration: number;
  liveClassMaxConcurrent: number;
  liveClassMaxMeetingsPerMonth: number;
  isActive: boolean;
  createdAt: string;
  _count: { students: number; teachers: number; classes: number };
}

function SchoolsTab() {
  const [schools, setSchools] = useState<SchoolRecord[]>([]);
  const [plans, setPlans] = useState<{ id: string; name: string; displayName: string; price: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [schoolsRes, plansRes] = await Promise.all([
        fetch('/api/schools?limit=200'),
        fetch('/api/plans'),
      ]);
      const schoolsJson = await schoolsRes.json();
      const plansJson = await plansRes.json();
      if (schoolsRes.ok) setSchools(schoolsJson.data || []);
      if (plansRes.ok) setPlans(plansJson.data || []);
    } catch { toast.error('Failed to load data'); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const filtered = schools.filter(
    s => !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.email?.toLowerCase().includes(search.toLowerCase())
  );

  const handlePlanChange = async (schoolId: string, newPlanId: string) => {
    setSavingId(schoolId);
    try {
      const res = await fetch(`/api/schools/${schoolId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: newPlanId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      toast.success('School plan updated');
      fetchAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update plan');
    } finally { setSavingId(null); }
  };

  const handleUpdateLimits = async (schoolId: string, field: 'maxStudents' | 'maxTeachers' | 'liveClassMaxParticipants' | 'liveClassMaxDuration' | 'liveClassMaxConcurrent' | 'liveClassMaxMeetingsPerMonth', value: number) => {
    try {
      const res = await fetch(`/api/schools/${schoolId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      const label: Record<string, string> = {
        maxStudents: 'Student', maxTeachers: 'Teacher',
        liveClassMaxParticipants: 'Live class participants',
        liveClassMaxDuration: 'Live class duration',
        liveClassMaxConcurrent: 'Live class concurrent',
        liveClassMaxMeetingsPerMonth: 'Live classes/month',
      };
      toast.success(`${label[field] || field} limit updated`);
      fetchAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update');
    }
  };

  const handleToggleActive = async (schoolId: string, isActive: boolean) => {
    try {
      const res = await fetch(`/api/schools/${schoolId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      toast.success(`School ${isActive ? 'deactivated' : 'activated'}`);
      fetchAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    }
  };

  const planBadgeColor = (planName: string) => {
    const colors: Record<string, string> = {
      free: 'bg-gray-100 text-gray-600',
      pro: 'bg-emerald-100 text-emerald-700',
      custom: 'bg-blue-100 text-blue-700',
    };
    return colors[planName?.toLowerCase()] || 'bg-gray-100 text-gray-600';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-100">
              <School className="size-5 text-emerald-600" />
            </div>
            <div>
              <CardTitle className="text-lg">Schools</CardTitle>
              <CardDescription>View and manage all registered schools</CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="text-xs w-fit">{schools.length} school{schools.length !== 1 ? 's' : ''}</Badge>
        </div>
        <div className="relative max-w-sm mt-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            type="text" placeholder="Search schools..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full h-9 rounded-md border border-input bg-background pl-9 pr-8 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <School className="size-10 opacity-30 mb-3" />
            <p className="text-sm font-medium">{search ? 'No schools match your search' : 'No schools registered yet'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border" style={{ WebkitOverflowScrolling: 'touch' }}>
            <table className="w-full text-sm min-w-[600px] sm:min-w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left py-3 px-3 font-medium text-muted-foreground text-xs">School</th>
                  <th className="text-left py-3 px-3 font-medium text-muted-foreground text-xs hidden md:table-cell">Plan</th>
                  <th className="text-center py-3 px-3 font-medium text-muted-foreground text-xs">Students</th>
                  <th className="text-center py-3 px-3 font-medium text-muted-foreground text-xs hidden sm:table-cell">Teachers</th>
                  <th className="text-center py-3 px-3 font-medium text-muted-foreground text-xs hidden xl:table-cell">L.Part.</th>
                  <th className="text-center py-3 px-3 font-medium text-muted-foreground text-xs hidden xl:table-cell">Dur.</th>
                  <th className="text-center py-3 px-3 font-medium text-muted-foreground text-xs hidden xl:table-cell">Conc.</th>
                  <th className="text-center py-3 px-3 font-medium text-muted-foreground text-xs hidden xl:table-cell">Mth</th>
                  <th className="text-center py-3 px-3 font-medium text-muted-foreground text-xs hidden lg:table-cell">Status</th>
                  <th className="text-right py-3 px-3 font-medium text-muted-foreground text-xs">Upgrade</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => {
                  const isSaving = savingId === s.id;
                  return (
                    <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-3">
                          <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-100 shrink-0">
                            <School className="size-4 text-emerald-600" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-xs sm:text-sm truncate max-w-[120px] sm:max-w-[200px]">{s.name}</p>
                            <p className="text-[10px] sm:text-[11px] text-muted-foreground truncate max-w-[120px] sm:max-w-[200px]">{s.email || s.id.slice(0,12)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 hidden md:table-cell">
                        <Badge className={cn('text-[10px] border-0', planBadgeColor(s.plan))}>
                          {(s.plan || 'free').charAt(0).toUpperCase() + (s.plan || 'free').slice(1)}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="font-medium text-xs">{s._count.students}</span>
                          <div className="flex items-center gap-1">
                            <Input
                              type="number" min={-1}
                              defaultValue={s.maxStudents || ''}
                              className="w-14 h-6 text-[10px] text-center p-0"
                              onBlur={e => {
                                const val = parseInt(e.target.value);
                                if (!isNaN(val) && val !== s.maxStudents) handleUpdateLimits(s.id, 'maxStudents', val);
                              }}
                              placeholder="Limit"
                            />
                            <span className="text-[9px] text-muted-foreground">max</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center hidden sm:table-cell">
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="font-medium text-xs">{s._count.teachers}</span>
                          <div className="flex items-center gap-1">
                            <Input
                              type="number" min={-1}
                              defaultValue={s.maxTeachers || ''}
                              className="w-14 h-6 text-[10px] text-center p-0"
                              onBlur={e => {
                                const val = parseInt(e.target.value);
                                if (!isNaN(val) && val !== s.maxTeachers) handleUpdateLimits(s.id, 'maxTeachers', val);
                              }}
                              placeholder="Limit"
                            />
                            <span className="text-[9px] text-muted-foreground">max</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center hidden xl:table-cell">
                        <Input
                          type="number" min={0}
                          defaultValue={s.liveClassMaxParticipants ?? 50}
                          className="w-14 h-6 text-[10px] text-center p-0"
                          onBlur={e => {
                            const val = parseInt(e.target.value);
                            if (!isNaN(val) && val !== s.liveClassMaxParticipants) handleUpdateLimits(s.id, 'liveClassMaxParticipants', val);
                          }}
                        />
                      </td>
                      <td className="py-3 px-3 text-center hidden xl:table-cell">
                        <Input
                          type="number" min={0}
                          defaultValue={s.liveClassMaxDuration ?? 60}
                          className="w-14 h-6 text-[10px] text-center p-0"
                          onBlur={e => {
                            const val = parseInt(e.target.value);
                            if (!isNaN(val) && val !== s.liveClassMaxDuration) handleUpdateLimits(s.id, 'liveClassMaxDuration', val);
                          }}
                        />
                      </td>
                      <td className="py-3 px-3 text-center hidden xl:table-cell">
                        <Input
                          type="number" min={0}
                          defaultValue={s.liveClassMaxConcurrent ?? 5}
                          className="w-14 h-6 text-[10px] text-center p-0"
                          onBlur={e => {
                            const val = parseInt(e.target.value);
                            if (!isNaN(val) && val !== s.liveClassMaxConcurrent) handleUpdateLimits(s.id, 'liveClassMaxConcurrent', val);
                          }}
                        />
                      </td>
                      <td className="py-3 px-3 text-center hidden xl:table-cell">
                        <Input
                          type="number" min={0}
                          defaultValue={s.liveClassMaxMeetingsPerMonth ?? 100}
                          className="w-14 h-6 text-[10px] text-center p-0"
                          onBlur={e => {
                            const val = parseInt(e.target.value);
                            if (!isNaN(val) && val !== s.liveClassMaxMeetingsPerMonth) handleUpdateLimits(s.id, 'liveClassMaxMeetingsPerMonth', val);
                          }}
                        />
                      </td>
                      <td className="py-3 px-3 text-center hidden lg:table-cell">
                        <button
                          onClick={() => handleToggleActive(s.id, s.isActive)}
                          className={cn(
                            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border transition-colors',
                            s.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-red-50 hover:text-red-700 hover:border-red-200' : 'bg-red-50 text-red-700 border-red-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200'
                          )}
                        >
                          {s.isActive ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Select
                            value={s.planId || ''}
                            onValueChange={val => handlePlanChange(s.id, val)}
                            disabled={isSaving}
                          >
                            <SelectTrigger className="w-full sm:w-[130px] h-8 text-xs">
                              {isSaving ? (
                                <span className="flex items-center gap-1.5">
                                  <Loader2 className="size-3 animate-spin" /> Updating...
                                </span>
                              ) : (
                                <SelectValue placeholder="Plan" />
                              )}
                            </SelectTrigger>
                            <SelectContent>
                              {plans.length === 0 && (
                                <SelectItem value="none" disabled>No plans available</SelectItem>
                              )}
                              {plans.map(p => (
                                <SelectItem key={p.id} value={p.id} className="text-xs">
                                  {p.displayName}{p.price > 0 ? ` (${formatCurrency(p.price)}/mo)` : ' (Free)'}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}

// ============================================
// Preloader Quotes Tab
// ============================================
function PreloaderTab() {
  const [items, setItems] = useState<PreloaderQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PreloaderQuote | null>(null);
  const [form, setForm] = useState({ quote: '', author: '', isActive: true });
  const confirm = useConfirm();

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch('/api/platform/quotes');
      const json = await res.json();
      if (json.success) setItems(json.data);
    } catch (error: unknown) { handleSilentError(error, 'Failed to load data'); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const resetForm = () => { setForm({ quote: '', author: '', isActive: true }); setEditing(null); };

  const handleSave = async () => {
    if (!form.quote) return toast.error('Quote text is required');
    try {
      const url = editing ? `/api/platform/quotes/${editing.id}` : '/api/platform/quotes';
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(editing ? 'Quote updated' : 'Quote created');
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
    const ok = await confirm('Delete Quote', 'Are you sure you want to delete this quote?');
    if (!ok) return;
    try {
      const res = await fetch(`/api/platform/quotes/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) { toast.success('Deleted'); fetchItems(); } else toast.error(json.message);
    } catch { toast.error('Failed to delete'); }
  };

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div>
          <CardTitle className="text-lg">Preloader Quotes</CardTitle>
          <CardDescription>Inspirational quotes shown on the preloader screen</CardDescription>
        </div>
        <Button size="sm" onClick={() => { resetForm(); setDialogOpen(true); }} className="bg-emerald-600 hover:bg-emerald-700 shrink-0">
          <Plus className="h-4 w-4 mr-1" /> Add Quote
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>
        ) : items.length === 0 ? (
          <div className="text-center py-8 text-gray-400"><Quote className="h-10 w-10 mx-auto mb-2 opacity-50" /> No quotes yet</div>
        ) : (
          <div className="space-y-2 overflow-x-auto">
            {items.map((item) => (
              <div key={item.id} className="flex items-start gap-3 p-3 rounded-lg border hover:bg-gray-50 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">&quot;{item.quote}&quot;</p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                    <span>&mdash; {item.author || 'Unknown'}</span>
                    <Badge variant={item.isActive ? 'default' : 'secondary'} className="text-[10px]">
                      {item.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditing(item); setForm({ quote: item.quote, author: item.author || '', isActive: item.isActive }); setDialogOpen(true); }}>
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
        <DialogContent className="max-w-[90vw] w-full max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Quote' : 'New Quote'}</DialogTitle>
            <DialogDescription>Add an inspirational quote for the preloader</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Quote *</Label><Textarea value={form.quote} onChange={(e) => setForm({ ...form, quote: e.target.value })} rows={3} placeholder="Enter inspirational quote..." /></div>
            <div><Label>Author</Label><Input value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} placeholder="Quote author" /></div>
            <div className="flex items-center gap-2">
              <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
              <Label>Active</Label>
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
// Blog Tab
// ============================================
function BlogTab() {
  const [items, setItems] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BlogPost | null>(null);
  const [form, setForm] = useState({
    title: '', slug: '', excerpt: '', content: '', coverImage: '',
    category: 'General', tags: '', authorName: '', authorAvatar: '',
    isPublished: false, featured: false, readTime: 5,
  });
  const confirm = useConfirm();

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch('/api/platform/blog');
      const json = await res.json();
      if (json.success) setItems(json.data);
    } catch (error: unknown) { handleSilentError(error, 'Failed to load data'); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const resetForm = () => {
    setForm({
      title: '', slug: '', excerpt: '', content: '', coverImage: '',
      category: 'General', tags: '', authorName: '', authorAvatar: '',
      isPublished: false, featured: false, readTime: 5,
    });
    setEditing(null);
  };

  const handleSave = async () => {
    if (!form.title || !form.content) return toast.error('Title and content are required');
    try {
      const url = editing ? `/api/platform/blog/${editing.id}` : '/api/platform/blog';
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(editing ? 'Post updated' : 'Post created');
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
    const ok = await confirm('Delete Post', 'Are you sure you want to delete this blog post?');
    if (!ok) return;
    try {
      const res = await fetch(`/api/platform/blog/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) { toast.success('Deleted'); fetchItems(); } else toast.error(json.message);
    } catch { toast.error('Failed to delete'); }
  };

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div>
          <CardTitle className="text-lg">Blog Posts</CardTitle>
          <CardDescription>Manage platform blog content</CardDescription>
        </div>
        <Button size="sm" onClick={() => { resetForm(); setDialogOpen(true); }} className="bg-emerald-600 hover:bg-emerald-700 shrink-0">
          <Plus className="h-4 w-4 mr-1" /> New Post
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>
        ) : items.length === 0 ? (
          <div className="text-center py-8 text-gray-400"><FileText className="h-10 w-10 mx-auto mb-2 opacity-50" /> No blog posts yet</div>
        ) : (
          <div className="space-y-2 overflow-x-auto">
            {items.map((item) => (
              <div key={item.id} className="flex items-start gap-3 p-3 rounded-lg border hover:bg-gray-50 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{item.title}</p>
                    {item.featured && <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500 shrink-0" />}
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-400 flex-wrap">
                    <Badge variant="outline">{item.category}</Badge>
                    <span>{item.readTime} min read</span>
                    <span>{item.viewCount} views</span>
                    <Badge variant={item.isPublished ? 'default' : 'secondary'} className="text-[10px]">
                      {item.isPublished ? 'Published' : 'Draft'}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                    setEditing(item);
                    setForm({
                      title: item.title, slug: item.slug,
                      excerpt: item.excerpt || '', content: item.content,
                      coverImage: item.coverImage || '',
                      category: item.category, tags: item.tags || '',
                      authorName: item.authorName, authorAvatar: item.authorAvatar || '',
                      isPublished: item.isPublished, featured: item.featured,
                      readTime: item.readTime,
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
        <DialogContent className="max-w-[90vw] w-full max-w-3xl max-h-[calc(100vh-100px)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Post' : 'New Post'}</DialogTitle>
            <DialogDescription>Create and manage blog posts</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2"><Label>Title *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value, slug: editing ? form.slug || generateSlug(e.target.value) : generateSlug(e.target.value) })} /></div>
              <div><Label>Slug</Label><Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
              <div>
                <Label>Author</Label>
                <Input value={form.authorName} onChange={(e) => setForm({ ...form, authorName: e.target.value })} />
              </div>
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
            <div className="flex items-center gap-2"><span className="text-xs text-gray-400">&mdash; or paste URL &mdash;</span><Input value={form.coverImage} onChange={(e) => setForm({ ...form, coverImage: e.target.value })} placeholder="https://..." className="text-xs" /></div>
            <div><Label>Content *</Label><Textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={10} placeholder="Blog post content..." /></div>
            <div><Label>Tags (comma-separated)</Label><Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="education, tips, technology" /></div>
            <div className="flex flex-wrap items-center gap-6">
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
