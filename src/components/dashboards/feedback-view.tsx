'use client';

import * as React from 'react';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { KpiCard } from '@/components/shared/kpi-card';
import { MessageSquare, Star, Reply, BarChart3, AlertTriangle, Send, Loader2 } from 'lucide-react';
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface FeedbackItem {
  id: string;
  schoolId: string;
  userId: string | null;
  category: string;
  rating: number | null;
  title: string;
  description: string | null;
  isAnonymous: boolean;
  status: string;
  response: string | null;
  respondedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

const statusColors: Record<string, string> = {
  open: 'bg-blue-100 text-blue-700 border-blue-200',
  reviewed: 'bg-amber-100 text-amber-700 border-amber-200',
  resolved: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

const categoryColors: Record<string, string> = {
  Academic: 'bg-violet-100 text-violet-700 border-violet-200',
  Facility: 'bg-amber-100 text-amber-700 border-amber-200',
  Staff: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            'size-3.5',
            i < rating ? 'text-amber-400 fill-amber-400' : 'text-gray-300'
          )}
        />
      ))}
    </div>
  );
}

export function FeedbackView() {
  const { selectedSchoolId, currentUser, currentRole } = useAppStore();
  const schoolId = currentUser.schoolId || selectedSchoolId || '';
  const isAdmin = currentRole === 'SCHOOL_ADMIN' || currentRole === 'DIRECTOR';
  const isSuperAdmin = currentRole === 'SUPER_ADMIN';

  // Admin state
  const [statusFilter, setStatusFilter] = useState('all');
  const [replyOpen, setReplyOpen] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackItem | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replyStatus, setReplyStatus] = useState('open');
  const [submitting, setSubmitting] = useState(false);
  const [feedbackData, setFeedbackData] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Non-admin feedback history state
  const [myFeedback, setMyFeedback] = useState<FeedbackItem[]>([]);
  const [myFeedbackLoading, setMyFeedbackLoading] = useState(false);

  // Submission state
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [submitTitle, setSubmitTitle] = useState('');
  const [submitCategory, setSubmitCategory] = useState('Academic');
  const [submitRating, setSubmitRating] = useState(5);
  const [submitDescription, setSubmitDescription] = useState('');
  const [submitAnonymous, setSubmitAnonymous] = useState(false);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Fetch feedback data (admin only)
  useEffect(() => {
    if (!schoolId || !isAdmin) return;

    const fetchFeedback = async () => {
      const statusParam = statusFilter !== 'all' ? `&status=${statusFilter}` : '';
      try {
        const res = await fetch(`/api/feedback?schoolId=${schoolId}${statusParam}&limit=100`);
        const json = await res.json();
        setFeedbackData(json.data || []);
      } catch {
        toast.error('Failed to load feedback');
      } finally {
        setLoading(false);
      }
    };

    setLoading(true);
    fetchFeedback();
  }, [schoolId, statusFilter, isAdmin]);

  // Fetch own feedback (non-admin)
  useEffect(() => {
    if (!schoolId || isAdmin || !currentUser.id) return;

    const fetchMyFeedback = async () => {
      setMyFeedbackLoading(true);
      try {
        const res = await fetch(`/api/feedback?schoolId=${schoolId}&userId=${currentUser.id}&limit=50`);
        const json = await res.json();
        setMyFeedback(json.data || []);
      } catch {
        // silent
      } finally {
        setMyFeedbackLoading(false);
      }
    };

    fetchMyFeedback();
  }, [schoolId, isAdmin, currentUser.id]);

  // Submit feedback (any role)
  const handleSubmitFeedback = async () => {
    if (!schoolId) {
      toast.error('No school selected');
      return;
    }
    if (!submitTitle.trim()) {
      toast.error('Please enter a title');
      return;
    }

    setSubmittingFeedback(true);
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId,
          userId: currentUser.id,
          category: submitCategory,
          rating: submitRating,
          title: submitTitle,
          description: submitDescription || null,
          isAnonymous: submitAnonymous,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to submit feedback');

      toast.success('Feedback submitted successfully');
      setSubmitTitle('');
      setSubmitCategory('Academic');
      setSubmitRating(5);
      setSubmitDescription('');
      setSubmitAnonymous(false);
      // Refresh feedback history
      const refreshRes = await fetch(`/api/feedback?schoolId=${schoolId}&userId=${currentUser.id}&limit=50`);
      if (refreshRes.ok) {
        const refreshJson = await refreshRes.json();
        setMyFeedback(refreshJson.data || []);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit feedback');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const totalRating = feedbackData.reduce((sum, f) => sum + (f.rating || 0), 0);
  const ratedCount = feedbackData.filter(f => f.rating !== null).length;
  const avgRating = ratedCount > 0 ? (totalRating / ratedCount).toFixed(1) : '0.0';
  const openCount = feedbackData.filter(f => f.status === 'open').length;
  const resolvedCount = feedbackData.filter(f => f.status === 'resolved').length;

  const handleReply = () => {
    if (!selectedFeedback) return;
    setSubmitting(true);
    fetch('/api/feedback', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: selectedFeedback.id,
        response: replyText,
        status: replyStatus,
        respondedBy: currentUser.id,
      }),
    })
      .then(async (response) => {
        if (response.ok) {
          toast.success('Reply sent successfully');
          setReplyOpen(false);
          setReplyText('');
          setReplyStatus('open');
          const refreshRes = await fetch(`/api/feedback?schoolId=${schoolId}${statusFilter !== 'all' ? `&status=${statusFilter}` : ''}&limit=100`);
          const refreshJson = await refreshRes.json();
          if (refreshJson.data) setFeedbackData(refreshJson.data);
        } else {
          const json = await response.json();
          toast.error(json.error || 'Failed to send reply');
        }
      })
      .catch(() => toast.error('Failed to send reply'))
      .finally(() => setSubmitting(false));
  };

  if (!schoolId) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <AlertTriangle className="size-10 opacity-40 mb-3" />
        <p className="text-sm">Please select a school to manage feedback</p>
      </div>
    );
  }

  // Non-admin view: submission form + feedback history
  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Send Feedback</h2>
          <p className="text-sm text-muted-foreground">Share your thoughts, suggestions, or concerns with the school</p>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input
                placeholder="Brief summary of your feedback"
                value={submitTitle}
                onChange={e => setSubmitTitle(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={submitCategory} onValueChange={setSubmitCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Academic">Academic</SelectItem>
                    <SelectItem value="Facility">Facility</SelectItem>
                    <SelectItem value="Staff">Staff</SelectItem>
                    <SelectItem value="General">General</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Rating</Label>
                <div className="flex items-center gap-1 pt-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      className="p-0.5"
                      onClick={() => setSubmitRating(i + 1)}
                    >
                      <Star
                        className={cn(
                          'size-6 transition-colors',
                          i < submitRating ? 'text-amber-400 fill-amber-400' : 'text-gray-300'
                        )}
                      />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description (Optional)</Label>
              <Textarea
                placeholder="Provide more details about your feedback..."
                rows={4}
                value={submitDescription}
                onChange={e => setSubmitDescription(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="anonymous"
                checked={submitAnonymous}
                onChange={e => setSubmitAnonymous(e.target.checked)}
                className="rounded border-input"
              />
              <Label htmlFor="anonymous" className="text-sm cursor-pointer">Submit anonymously</Label>
            </div>

            <Button
              onClick={handleSubmitFeedback}
              disabled={submittingFeedback || !submitTitle.trim()}
              className="gap-2"
            >
              {submittingFeedback ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              Submit Feedback
            </Button>
          </CardContent>
        </Card>

        {/* Feedback History */}
        <div>
          <h3 className="text-lg font-semibold mb-1">Your Feedback History</h3>
          <p className="text-sm text-muted-foreground mb-4">Track the status and replies to your submissions</p>

          {myFeedbackLoading ? (
            <div className="space-y-3">
              {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-28 rounded-lg" />)}
            </div>
          ) : myFeedback.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <MessageSquare className="size-8 opacity-40 mb-2" />
              <p className="text-sm">No feedback submitted yet</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {myFeedback.map((item) => (
                <Card key={item.id} className="hover:shadow-sm transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h4 className="font-semibold text-sm">{item.title}</h4>
                      <Badge className={cn('text-[10px] border capitalize', statusColors[item.status] || 'bg-gray-100 text-gray-700 border-gray-200')}>
                        {item.status}
                      </Badge>
                      <Badge className={cn('text-[10px] border', categoryColors[item.category] || 'bg-gray-100 text-gray-700 border-gray-200')}>
                        {item.category}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{item.description || 'No description'}</p>
                    <div className="flex items-center gap-3 mt-1.5">
                      {item.rating && <StarRating rating={item.rating} />}
                      <span className="text-xs text-muted-foreground">{mounted ? new Date(item.createdAt).toLocaleDateString() : ''}</span>
                    </div>

                    {/* Admin Reply */}
                    {item.response && (
                      <div className="mt-3 pl-3 border-l-2 border-emerald-300 bg-emerald-50/50 rounded-r-lg p-2.5">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 mb-1">
                          <Reply className="size-3" />
                          Admin Response
                        </div>
                        <p className="text-sm text-muted-foreground">{item.response}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Admin view
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-12 w-48" />
          <Skeleton className="h-10 w-36" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28 rounded-lg" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Feedback</h2>
          <p className="text-sm text-muted-foreground">Manage feedback from parents, students, and staff</p>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="reviewed">Reviewed</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="Total" value={feedbackData.length} icon={MessageSquare} iconColor="text-blue-600" iconBgColor="bg-blue-100" />
        <KpiCard title="Open" value={openCount} icon={BarChart3} iconColor="text-amber-600" iconBgColor="bg-amber-100" />
        <KpiCard title="Resolved" value={resolvedCount} icon={MessageSquare} iconColor="text-emerald-600" iconBgColor="bg-emerald-100" />
        <KpiCard title="Avg Rating" value={avgRating} icon={Star} iconColor="text-amber-500" iconBgColor="bg-amber-100" />
      </div>

      <div className="space-y-3 max-h-[500px] overflow-y-auto">
        {feedbackData.map((item) => (
          <Card key={item.id} className="hover:shadow-sm transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-sm">{item.title}</h3>
                    <Badge className={cn('text-[10px] border capitalize', statusColors[item.status] || 'bg-gray-100 text-gray-700 border-gray-200')}>
                      {item.status}
                    </Badge>
                    <Badge className={cn('text-[10px] border', categoryColors[item.category] || 'bg-gray-100 text-gray-700 border-gray-200')}>
                      {item.category}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{item.description || 'No description'}</p>
                  <div className="flex items-center gap-3 mt-2">
                    {item.rating && <StarRating rating={item.rating} />}
                    <span className="text-xs text-muted-foreground">{item.isAnonymous ? 'Anonymous' : `User ${item.userId?.slice(0, 8) || 'Unknown'}`} &middot; {mounted ? new Date(item.createdAt).toLocaleDateString() : ''}</span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 gap-1.5"
                  onClick={() => {
                    setSelectedFeedback(item);
                    setReplyStatus(item.status);
                    setReplyText(item.response || '');
                    setReplyOpen(true);
                  }}
                >
                  <Reply className="size-3.5" />
                  Reply
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {feedbackData.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <MessageSquare className="size-10 opacity-40" />
          <p className="mt-2 text-sm">No feedback found</p>
        </div>
      )}

      <Dialog open={replyOpen} onOpenChange={setReplyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reply to Feedback</DialogTitle>
            <DialogDescription>
              {selectedFeedback && `Replying to: "${selectedFeedback.title}"`}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select value={replyStatus} onValueChange={setReplyStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="reviewed">Reviewed</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Reply</Label>
              <Textarea
                placeholder="Type your response..."
                rows={4}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReplyOpen(false)}>Cancel</Button>
            <Button onClick={handleReply} disabled={submitting}>
              {submitting ? 'Sending...' : 'Send Reply'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
