'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, MessageSquare, Send } from 'lucide-react';
import { toast } from 'sonner';

export function ReportCardComments() {
  const [reportCardId, setReportCardId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [comment, setComment] = useState('');
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fetched, setFetched] = useState(false);

  const fetchComments = async () => {
    if (!reportCardId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/report-cards/${reportCardId}/comments`);
      const json = await res.json();
      setComments(json.data || []);
      setFetched(true);
    } catch { setComments([]); }
    finally { setLoading(false); }
  };

  const handleAddComment = async () => {
    if (!reportCardId || !subjectId || !comment) { toast.error('All fields required'); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/report-cards/${reportCardId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subjectId, comment }),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success('Comment added');
      setComment('');
      await fetchComments();
    } catch { toast.error('Failed to add comment'); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <MessageSquare className="size-4" />Teacher Comments
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Report Card ID</Label>
              <Input className="h-8 text-xs" value={reportCardId} onChange={(e) => setReportCardId(e.target.value)}
                placeholder="Enter report card ID" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Subject ID</Label>
              <Input className="h-8 text-xs" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}
                placeholder="Enter subject ID" />
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={fetchComments} disabled={!reportCardId}>
            {loading ? <Loader2 className="size-3.5 animate-spin mr-1" /> : <MessageSquare className="size-3.5 mr-1" />}
            Load Comments
          </Button>

          {fetched && (
            <div className="max-h-48 overflow-y-auto space-y-1">
              {comments.length === 0 ? (
                <p className="text-xs text-muted-foreground">No comments yet</p>
              ) : comments.map((c: any, i: number) => (
                <div key={i} className="border rounded p-2 text-xs">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-[9px]">{c.subjectId || c.subject?.name}</Badge>
                    <span className="text-[10px] text-muted-foreground">{new Date(c.createdAt).toLocaleString()}</span>
                  </div>
                  <p>{c.comment}</p>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-1">
            <Label className="text-xs">Add Comment</Label>
            <Textarea className="h-20 text-xs" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Enter subject comment..." />
          </div>

          <Button size="sm" onClick={handleAddComment} disabled={saving || !reportCardId || !subjectId || !comment}>
            {saving ? <Loader2 className="size-3.5 animate-spin mr-1" /> : <Send className="size-3.5 mr-1" />}
            {saving ? 'Saving...' : 'Add Comment'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
