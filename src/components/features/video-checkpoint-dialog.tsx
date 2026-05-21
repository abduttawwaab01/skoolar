'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import {
  Plus, Clock, Pencil, Trash2, CheckCircle2, ListChecks,
} from 'lucide-react';
import { toast } from 'sonner';

interface Checkpoint {
  id: string;
  lessonId: string;
  timestamp: number;
  question: string;
  questionType: 'MCQ' | 'TRUE_FALSE';
  options: string | null;
  correctAnswer: string | null;
  explanation: string | null;
  order: number;
  isRequired: boolean;
  _count?: { progress: number };
}

interface Props {
  lessonId: string;
  lessonTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VideoCheckpointDialog({ lessonId, lessonTitle, open, onOpenChange }: Props) {
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCheckpoint, setEditingCheckpoint] = useState<Checkpoint | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    timestamp: '',
    question: '',
    questionType: 'MCQ' as 'MCQ' | 'TRUE_FALSE',
    options: '',
    correctAnswer: '',
    explanation: '',
    isRequired: true,
  });

  const fetchCheckpoints = useCallback(async () => {
    if (!lessonId) { setCheckpoints([]); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/video-checkpoints?lessonId=${lessonId}`);
      if (res.ok) {
        const json = await res.json();
        setCheckpoints(json.data || []);
      }
    } catch { toast.error('Failed to load checkpoints'); }
    finally { setLoading(false); }
  }, [lessonId]);

  useEffect(() => { if (open) fetchCheckpoints(); }, [open, fetchCheckpoints]);

  const resetForm = () => {
    setFormData({ timestamp: '', question: '', questionType: 'MCQ', options: '', correctAnswer: '', explanation: '', isRequired: true });
    setEditingCheckpoint(null);
  };

  const openCreate = () => { resetForm(); setDialogOpen(true); };

  const openEdit = (cp: Checkpoint) => {
    setEditingCheckpoint(cp);
    setFormData({
      timestamp: cp.timestamp.toString(),
      question: cp.question,
      questionType: cp.questionType,
      options: cp.options || '',
      correctAnswer: cp.correctAnswer || '',
      explanation: cp.explanation || '',
      isRequired: cp.isRequired,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!lessonId || !formData.question) { toast.error('Question is required'); return; }
    if (formData.questionType === 'MCQ' && !formData.options) { toast.error('Options are required for MCQ'); return; }
    setSaving(true);
    try {
      const rawOptions = formData.options;
      const optionsArray = formData.questionType === 'MCQ'
        ? (typeof rawOptions === 'string' ? rawOptions.split('\n').filter(Boolean) : rawOptions)
        : null;

      const body = {
        lessonId,
        timestamp: parseInt(formData.timestamp) || 0,
        question: formData.question,
        questionType: formData.questionType,
        options: optionsArray,
        correctAnswer: formData.correctAnswer || null,
        explanation: formData.explanation || null,
        isRequired: formData.isRequired,
      };

      if (editingCheckpoint) {
        const res = await fetch('/api/video-checkpoints', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingCheckpoint.id, ...body }),
        });
        if (!res.ok) throw new Error('Failed to update');
        toast.success('Checkpoint updated');
      } else {
        const res = await fetch('/api/video-checkpoints', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error('Failed to create');
        toast.success('Checkpoint created');
      }
      setDialogOpen(false);
      resetForm();
      fetchCheckpoints();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/video-checkpoints?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      setCheckpoints(prev => prev.filter(c => c.id !== id));
      toast.success('Checkpoint deleted');
    } catch { toast.error('Failed to delete checkpoint'); }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const parsedOptions = formData.questionType === 'MCQ' ? formData.options.split('\n').filter(Boolean) : [];

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ListChecks className="h-5 w-5" />
              Checkpoints — {lessonTitle}
            </DialogTitle>
            <DialogDescription>
              Manage in-video questions. Students must answer required checkpoints to continue watching.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="gap-1">
                <ListChecks className="h-3 w-3" />
                {checkpoints.length} checkpoint{checkpoints.length !== 1 ? 's' : ''}
              </Badge>
              <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> Add Checkpoint</Button>
            </div>

            {loading ? (
              <div className="space-y-3">
                {[1,2,3].map(i => <Skeleton key={i} className="h-20" />)}
              </div>
            ) : checkpoints.length === 0 ? (
              <Card className="py-10 text-center">
                <ListChecks className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-sm font-medium">No checkpoints yet</p>
                <p className="text-xs text-muted-foreground mt-1">Add questions that pause the video at specific timestamps</p>
                <Button variant="outline" size="sm" className="mt-4" onClick={openCreate}>
                  <Plus className="h-4 w-4 mr-1" /> Add First Checkpoint
                </Button>
              </Card>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {checkpoints.sort((a, b) => a.timestamp - b.timestamp).map((cp, idx) => (
                  <Card key={cp.id} className="hover:shadow-sm transition-shadow">
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded flex items-center gap-1">
                              <Clock className="h-3 w-3" /> {formatTime(cp.timestamp)}
                            </span>
                            <Badge variant="outline" className="text-[10px]">
                              {cp.questionType === 'MCQ' ? 'Multiple Choice' : 'True/False'}
                            </Badge>
                            {cp.isRequired && <Badge variant="secondary" className="text-[10px]">Required</Badge>}
                            <span className="text-xs text-muted-foreground">#{idx + 1}</span>
                          </div>
                          <p className="text-sm font-medium">{cp.question}</p>
                          {cp.correctAnswer && (
                            <div className="flex items-center gap-1 text-xs text-emerald-600">
                              <CheckCircle2 className="h-3 w-3" />
                              Answer: {cp.correctAnswer}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button variant="ghost" size="icon" className="size-7" onClick={() => openEdit(cp)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="size-7 text-red-500" onClick={() => handleDelete(cp.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Checkpoint Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingCheckpoint ? 'Edit Checkpoint' : 'Add Checkpoint'}</DialogTitle>
            <DialogDescription>
              {editingCheckpoint ? 'Update the checkpoint question and settings' : 'Create a question that appears at a specific timestamp in the video'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Timestamp (seconds)</Label>
                <Input type="number" min="0" placeholder="e.g. 120" value={formData.timestamp} onChange={e => setFormData(p => ({ ...p, timestamp: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Question Type</Label>
                <Select value={formData.questionType} onValueChange={v => setFormData(p => ({ ...p, questionType: v as 'MCQ' | 'TRUE_FALSE', correctAnswer: '', options: '' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MCQ">Multiple Choice</SelectItem>
                    <SelectItem value="TRUE_FALSE">True / False</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Question</Label>
              <Textarea placeholder="Enter the checkpoint question..." rows={2} value={formData.question} onChange={e => setFormData(p => ({ ...p, question: e.target.value }))} />
            </div>
            {formData.questionType === 'MCQ' && (
              <div className="space-y-2">
                <Label>Options (one per line)</Label>
                <Textarea placeholder={`Option A\nOption B\nOption C\nOption D`} rows={4} value={formData.options} onChange={e => setFormData(p => ({ ...p, options: e.target.value }))} />
                <p className="text-xs text-muted-foreground">Enter the index (0-based) in Correct Answer, e.g. &quot;0&quot; for first option</p>
              </div>
            )}
            <div className="space-y-2">
              <Label>Correct Answer</Label>
              {formData.questionType === 'MCQ' ? (
                <Select value={formData.correctAnswer} onValueChange={v => setFormData(p => ({ ...p, correctAnswer: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select correct answer" /></SelectTrigger>
                  <SelectContent>
                    {parsedOptions.map((opt, i) => (
                      <SelectItem key={i} value={i.toString()}>{i} - {opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Select value={formData.correctAnswer} onValueChange={v => setFormData(p => ({ ...p, correctAnswer: v }))}>
                  <SelectTrigger><SelectValue placeholder="Is it true or false?" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">True</SelectItem>
                    <SelectItem value="false">False</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-2">
              <Label>Explanation (shown after answering)</Label>
              <Textarea placeholder="Explain the correct answer..." rows={2} value={formData.explanation} onChange={e => setFormData(p => ({ ...p, explanation: e.target.value }))} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={formData.isRequired} onCheckedChange={v => setFormData(p => ({ ...p, isRequired: v }))} />
              <Label className="text-sm">Required (must answer to continue watching)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !formData.question}>
              {saving ? 'Saving...' : editingCheckpoint ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
