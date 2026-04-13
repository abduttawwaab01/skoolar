'use client';

import * as React from 'react';
import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
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
import { MessageSquare, Star, Reply, BarChart3, AlertTriangle } from 'lucide-react';
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
  const { selectedSchoolId, currentUser } = useAppStore();
  const [statusFilter, setStatusFilter] = useState('all');
  const [replyOpen, setReplyOpen] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackItem | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replyStatus, setReplyStatus] = useState('open');
  const [submitting, setSubmitting] = useState(false);

  const [feedbackData, setFeedbackData] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch feedback data
  useEffect(() => {
    if (!selectedSchoolId) return;

    const fetchFeedback = async () => {
      const statusParam = statusFilter !== 'all' ? `&status=${statusFilter}` : '';
      try {
        const res = await fetch(`/api/feedback?schoolId=${selectedSchoolId}${statusParam}&limit=100`);
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
  }, [selectedSchoolId, statusFilter]);

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
          // Refresh data
          const refreshRes = await fetch(`/api/feedback?schoolId=${selectedSchoolId}${statusFilter !== 'all' ? `&status=${statusFilter}` : ''}&limit=100`);
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

  if (!selectedSchoolId) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <AlertTriangle className="size-10 opacity-40 mb-3" />
        <p className="text-sm">Please select a school to view feedback</p>
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
                    <span className="text-xs text-muted-foreground">{item.isAnonymous ? 'Anonymous' : `User ${item.userId?.slice(0, 8) || 'Unknown'}`} &middot; {new Date(item.createdAt).toLocaleDateString()}</span>
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
