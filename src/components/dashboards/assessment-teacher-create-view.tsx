'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';
import { ArrowLeft, Save, Plus, Trash2 } from 'lucide-react';

const TEACHER_DOMAINS = [
  'LEADERSHIP_ADMIN', 'PEDAGOGICAL_COMPETENCY', 'CLASSROOM_MANAGEMENT',
  'SUBJECT_EXPERTISE', 'PROFESSIONAL_DEVELOPMENT', 'INTERPERSONAL_COMMUNICATION', '360_FEEDBACK',
];

interface Section { title: string; description: string; domain: string; order: number; questions: Question[]; }
interface Question { questionText: string; questionType: string; maxMarks: number; order: number; options?: { text: string; isCorrect: boolean }[]; }

export function AssessmentTeacherCreateView() {
  const { currentUser, setCurrentView } = useAppStore();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('DIAGNOSTIC');
  const [sections, setSections] = useState<Section[]>([]);
  const [saving, setSaving] = useState(false);

  const addSection = () => setSections([...sections, { title: '', description: '', domain: 'PEDAGOGICAL_COMPETENCY', order: sections.length + 1, questions: [] }]);
  const removeSection = (idx: number) => setSections(sections.filter((_, i) => i !== idx));
  const updateSection = (idx: number, field: string, value: string) => {
    const updated = [...sections]; (updated[idx] as any)[field] = value; setSections(updated);
  };

  const addQuestion = (sIdx: number) => {
    const updated = [...sections];
    updated[sIdx].questions.push({ questionText: '', questionType: 'MULTIPLE_CHOICE', maxMarks: 1, order: updated[sIdx].questions.length + 1, options: [{ text: '', isCorrect: false }, { text: '', isCorrect: false }] });
    setSections(updated);
  };
  const removeQuestion = (sIdx: number, qIdx: number) => {
    const updated = [...sections]; updated[sIdx].questions = updated[sIdx].questions.filter((_, i) => i !== qIdx); setSections(updated);
  };
  const updateQuestion = (sIdx: number, qIdx: number, field: string, value: any) => {
    const updated = [...sections]; (updated[sIdx].questions[qIdx] as any)[field] = value; setSections(updated);
  };

  const handleSave = async () => {
    if (!title.trim()) { toast.error('Title is required'); return; }
    try {
      setSaving(true);
      const res = await fetch('/api/assessment-hub/teacher', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolId: currentUser.schoolId, title, description, type, sections }),
      });
      if (res.ok) { toast.success('Created'); setCurrentView('assessment-teacher-list'); }
      else { const err = await res.json(); toast.error(err.error || 'Failed'); }
    } catch { toast.error('Failed'); } finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setCurrentView('assessment-teacher-list')}><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Create Teacher Assessment</h1>
            <p className="text-muted-foreground">Build teacher competency assessment</p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving}><Save className="h-4 w-4 mr-2" /> {saving ? 'Saving...' : 'Save'}</Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="DIAGNOSTIC">Diagnostic</SelectItem>
                  <SelectItem value="FORMATIVE">Formative</SelectItem>
                  <SelectItem value="SUMMATIVE">Summative</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2"><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Sections</h2>
          <Button variant="outline" size="sm" onClick={addSection}><Plus className="h-4 w-4 mr-2" /> Add Section</Button>
        </div>
        {sections.map((section, sIdx) => (
          <Card key={sIdx}>
            <CardHeader className="pb-2 flex flex-row items-start justify-between">
              <CardTitle className="text-sm">Section {sIdx + 1}</CardTitle>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => removeSection(sIdx)}><Trash2 className="h-4 w-4" /></Button>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1"><Label className="text-xs">Title</Label><Input value={section.title} onChange={(e) => updateSection(sIdx, 'title', e.target.value)} className="h-8 text-sm" /></div>
                <div className="space-y-1">
                  <Label className="text-xs">Domain</Label>
                  <Select value={section.domain} onValueChange={(v) => updateSection(sIdx, 'domain', v)}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TEACHER_DOMAINS.map((d) => <SelectItem key={d} value={d}>{d.replace(/_/g, ' ')}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label className="text-xs">Description</Label><Input value={section.description} onChange={(e) => updateSection(sIdx, 'description', e.target.value)} className="h-8 text-sm" /></div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Questions ({section.questions.length})</span>
                  <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => addQuestion(sIdx)}><Plus className="h-3 w-3 mr-1" /> Add</Button>
                </div>
                {section.questions.map((q, qIdx) => (
                  <Card key={qIdx} className="border-dashed">
                    <CardContent className="pt-3 space-y-2">
                      <div className="flex items-start justify-between">
                        <span className="text-xs font-medium">Q{qIdx + 1}</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400" onClick={() => removeQuestion(sIdx, qIdx)}><Trash2 className="h-3 w-3" /></Button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1"><Label className="text-[10px]">Question</Label><Input value={q.questionText} onChange={(e) => updateQuestion(sIdx, qIdx, 'questionText', e.target.value)} className="h-7 text-xs" /></div>
                        <div className="space-y-1">
                          <Label className="text-[10px]">Type</Label>
                          <Select value={q.questionType} onValueChange={(v) => updateQuestion(sIdx, qIdx, 'questionType', v)}>
                            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="MULTIPLE_CHOICE">Multiple Choice</SelectItem>
                              <SelectItem value="TRUE_FALSE">True/False</SelectItem>
                              <SelectItem value="SHORT_ANSWER">Short Answer</SelectItem>
                              <SelectItem value="ESSAY">Essay</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
