'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Star, Plus, Pencil, Trash2, Check, X, MessageSquare, ArrowUp, ArrowDown, Quote, RefreshCw, XCircle } from 'lucide-react';
import { handleSilentError } from '@/lib/error-handler';
import { useConfirm } from '@/components/confirm-dialog';

interface Testimonial {
  id: string;
  name: string;
  role: string | null;
  schoolName: string | null;
  content: string;
  rating: number;
  avatar: string | null;
  isApproved: boolean;
  sortOrder: number;
  createdAt: string;
}

function StarPicker({ value, onChange, size = 'sm' }: { value: number; onChange: (v: number) => void; size?: 'sm' | 'lg' }) {
  const cls = size === 'lg' ? 'h-7 w-7' : 'h-4 w-4';
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button key={star} type="button" onClick={() => onChange(star)} className="p-0.5">
          <Star className={`${cls} ${star <= value ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} />
        </button>
      ))}
    </div>
  );
}

function StarsDisplay({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star key={star} className={`h-3 w-3 ${star <= rating ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} />
      ))}
    </div>
  );
}

const emptyForm = {
  name: '', role: '', schoolName: '', content: '', rating: 5, avatar: '',
};

export function TestimonialsManager() {
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('pending');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const confirm = useConfirm();

  const fetchTestimonials = useCallback(async () => {
    try {
      setFetchError(null);
      const res = await fetch('/api/testimonials?all=true');
      if (!res.ok) throw new Error('Failed to load testimonials');
      const json = await res.json();
      setTestimonials(json.data || []);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      setFetchError(msg);
      handleSilentError(error);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchTestimonials(); }, [fetchTestimonials]);

  const pending = testimonials.filter((t) => !t.isApproved);
  const approved = testimonials.filter((t) => t.isApproved);

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (t: Testimonial) => {
    setEditingId(t.id);
    setForm({ name: t.name, role: t.role || '', schoolName: t.schoolName || '', content: t.content, rating: t.rating, avatar: t.avatar || '' });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.content.trim()) {
      toast.error('Name and review content are required');
      return;
    }
    setSaving(true);
    try {
      const url = editingId ? `/api/testimonials?id=${editingId}` : '/api/testimonials';
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          role: form.role || null,
          schoolName: form.schoolName || null,
          avatar: form.avatar || null,
          isApproved: true,
        }),
      });
      if (res.ok) {
        toast.success(editingId ? 'Testimonial updated' : 'Testimonial created');
        setDialogOpen(false);
        fetchTestimonials();
      } else {
        const json = await res.json();
        toast.error(json.error || 'Failed to save');
      }
    } catch { toast.error('Failed to save'); } finally { setSaving(false); }
  };

  const handleApprove = async (id: string) => {
    try {
      const res = await fetch(`/api/testimonials?id=${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isApproved: true }),
      });
      if (res.ok) { toast.success('Review approved'); fetchTestimonials(); }
      else { const j = await res.json(); toast.error(j.error || 'Failed'); }
    } catch { toast.error('Failed to approve'); }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm('Delete this review?', 'This action cannot be undone.');
    if (!ok) return;
    try {
      const res = await fetch(`/api/testimonials?id=${id}`, { method: 'DELETE' });
      if (res.ok) { toast.success('Deleted'); fetchTestimonials(); }
      else { const j = await res.json(); toast.error(j.error || 'Failed'); }
    } catch { toast.error('Failed to delete'); }
  };

  const moveOrder = async (id: string, dir: 'up' | 'down') => {
    const idx = approved.findIndex((t) => t.id === id);
    if (idx === -1) return;
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= approved.length) return;
    const current = approved[idx];
    const swap = approved[swapIdx];
    try {
      await Promise.all([
        fetch(`/api/testimonials?id=${current.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sortOrder: swap.sortOrder }) }),
        fetch(`/api/testimonials?id=${swap.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sortOrder: current.sortOrder }) }),
      ]);
      fetchTestimonials();
    } catch { toast.error('Failed to reorder'); }
  };

  const renderTable = (items: Testimonial[], showApprove = false) => (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="py-3 px-4 text-left font-medium text-muted-foreground text-xs">Reviewer</th>
            <th className="py-3 px-4 text-left font-medium text-muted-foreground text-xs hidden md:table-cell">Content</th>
            <th className="py-3 px-4 text-center font-medium text-muted-foreground text-xs">Rating</th>
            <th className="py-3 px-4 text-center font-medium text-muted-foreground text-xs hidden sm:table-cell">Date</th>
            <th className="py-3 px-4 text-right font-medium text-muted-foreground text-xs">Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 && (
            <tr><td colSpan={5} className="py-12 text-center text-muted-foreground">No reviews yet</td></tr>
          )}
          {items.map((t) => (
            <tr key={t.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
              <td className="py-3 px-4">
                <div className="flex items-center gap-3">
                  <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs shrink-0">
                    {t.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium truncate max-w-[160px]">{t.name}</p>
                    {(t.role || t.schoolName) && (
                      <p className="text-[11px] text-muted-foreground truncate max-w-[160px]">{t.role || t.schoolName}</p>
                    )}
                  </div>
                </div>
              </td>
              <td className="py-3 px-4 hidden md:table-cell">
                <p className="text-muted-foreground truncate max-w-[280px]">{t.content}</p>
              </td>
              <td className="py-3 px-4 text-center"><StarsDisplay rating={t.rating} /></td>
              <td className="py-3 px-4 text-center hidden sm:table-cell text-xs text-muted-foreground">
                {new Date(t.createdAt).toLocaleDateString()}
              </td>
              <td className="py-3 px-4 text-right">
                <div className="flex items-center justify-end gap-1">
                  {showApprove && (
                    <Button size="icon" variant="ghost" className="size-7" onClick={() => handleApprove(t.id)} title="Approve">
                      <Check className="size-3.5 text-emerald-500" />
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" className="size-7" onClick={() => openEdit(t)} title="Edit">
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="size-7 text-red-500" onClick={() => handleDelete(t.id)} title="Delete">
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-amber-100">
              <MessageSquare className="size-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Testimonials Manager</h2>
              <p className="text-sm text-muted-foreground">Manage reviews displayed on the landing page</p>
            </div>
          </div>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <div className="size-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <XCircle className="size-6 text-red-600" />
            </div>
            <p className="text-sm font-medium text-red-600 mb-1">Failed to load testimonials</p>
            <p className="text-xs text-muted-foreground mb-4">{fetchError}</p>
            <Button variant="outline" size="sm" onClick={() => { setLoading(true); setFetchError(null); fetchTestimonials(); }}>
              <RefreshCw className="size-3.5 mr-1.5" /> Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-amber-100">
            <MessageSquare className="size-5 text-amber-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Testimonials Manager</h2>
            <p className="text-sm text-muted-foreground">Manage reviews displayed on the landing page</p>
          </div>
        </div>
        <Button onClick={openAdd} className="gap-2">
          <Plus className="size-4" /> Add Review
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="pending" className="gap-2">
            Pending
            {pending.length > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5">{pending.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="approved">Approved ({approved.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="pending" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Pending Reviews</CardTitle>
              <CardDescription>Reviews submitted by users waiting for approval</CardDescription>
            </CardHeader>
            <CardContent>
              {renderTable(pending, true)}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="approved" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Approved Reviews</CardTitle>
              <CardDescription>Active reviews shown on the landing page. Drag or use arrows to reorder.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="py-3 px-4 text-left font-medium text-muted-foreground text-xs w-10">Order</th>
                      <th className="py-3 px-4 text-left font-medium text-muted-foreground text-xs">Reviewer</th>
                      <th className="py-3 px-4 text-left font-medium text-muted-foreground text-xs hidden md:table-cell">Content</th>
                      <th className="py-3 px-4 text-center font-medium text-muted-foreground text-xs">Rating</th>
                      <th className="py-3 px-4 text-center font-medium text-muted-foreground text-xs hidden sm:table-cell">Date</th>
                      <th className="py-3 px-4 text-right font-medium text-muted-foreground text-xs">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {approved.length === 0 && (
                      <tr><td colSpan={6} className="py-12 text-center text-muted-foreground">No approved reviews yet</td></tr>
                    )}
                    {approved.map((t, i) => (
                      <tr key={t.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-0.5">
                            <Button size="icon" variant="ghost" className="size-6" disabled={i === 0} onClick={() => moveOrder(t.id, 'up')}>
                              <ArrowUp className="size-3" />
                            </Button>
                            <Button size="icon" variant="ghost" className="size-6" disabled={i === approved.length - 1} onClick={() => moveOrder(t.id, 'down')}>
                              <ArrowDown className="size-3" />
                            </Button>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs shrink-0">
                              {t.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium truncate max-w-[160px]">{t.name}</p>
                              {(t.role || t.schoolName) && (
                                <p className="text-[11px] text-muted-foreground truncate max-w-[160px]">{t.role || t.schoolName}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 hidden md:table-cell">
                          <p className="text-muted-foreground truncate max-w-[280px]">&ldquo;{t.content}&rdquo;</p>
                        </td>
                        <td className="py-3 px-4 text-center"><StarsDisplay rating={t.rating} /></td>
                        <td className="py-3 px-4 text-center hidden sm:table-cell text-xs text-muted-foreground">
                          {new Date(t.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button size="icon" variant="ghost" className="size-7" onClick={() => openEdit(t)} title="Edit">
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="size-7 text-red-500" onClick={() => handleDelete(t.id)} title="Delete">
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Review' : 'Add Review'}</DialogTitle>
            <DialogDescription>
              {editingId ? 'Update the review details below.' : 'Enter the review details. Admin-added reviews are auto-approved.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="name">Name *</Label>
                <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Reviewer name" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="role">Role</Label>
                <Input id="role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="e.g. Principal" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="school">School Name</Label>
                <Input id="school" value={form.schoolName} onChange={(e) => setForm({ ...form, schoolName: e.target.value })} placeholder="e.g. Greenwood School" />
              </div>
              <div className="space-y-1">
                <Label>Rating</Label>
                <StarPicker value={form.rating} onChange={(v) => setForm({ ...form, rating: v })} size="lg" />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="content">Review *</Label>
              <Textarea id="content" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="Write the review content..." rows={3} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="avatar">Avatar URL (optional)</Label>
              <Input id="avatar" value={form.avatar} onChange={(e) => setForm({ ...form, avatar: e.target.value })} placeholder="https://example.com/photo.jpg" />
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
