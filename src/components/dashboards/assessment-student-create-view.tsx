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

const DOMAINS = [
  'SUBJECT_KNOWLEDGE', 'COGNITIVE_SKILLS', 'LEARNING_STYLE',
  'AFFECTIVE_BEHAVIORAL', 'PSYCHOMOTOR', '21ST_CENTURY_SKILLS',
];

interface Section {
  title: string; description: string; domain: string; order: number; questions: Question[];
}

interface Question {
  questionText: string; questionType: string; maxMarks: number; order: number;
  options?: { text: string; isCorrect: boolean }[];
}

export function AssessmentStudentCreateView() {
  const { currentUser, setCurrentView } = useAppStore();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('DIAGNOSTIC');
  const [classId, setClassId] = useState('');
  const [sections, setSections] = useState<Section[]>([]);
  const [saving, setSaving] = useState(false);

  const addSection = () => {
    setSections([...sections, { title: '', description: '', domain: 'SUBJECT_KNOWLEDGE', order: sections.length + 1, questions: [] }]);
  };

  const removeSection = (idx: number) => {
    setSections(sections.filter((_, i) => i !== idx));
  };

  const updateSection = (idx: number, field: string, value: string) => {
    const updated = [...sections];
    (updated[idx] as any)[field] = value;
    setSections(updated);
  };

  const addQuestion = (sectionIdx: number) => {
    const updated = [...sections];
    updated[sectionIdx].questions.push({
      questionText: '', questionType: 'MULTIPLE_CHOICE', maxMarks: 1, order: updated[sectionIdx].questions.length + 1,
      options: [{ text: '', isCorrect: false }, { text: '', isCorrect: false }],
    });
    setSections(updated);
  };

  const removeQuestion = (sectionIdx: number, qIdx: number) => {
    const updated = [...sections];
    updated[sectionIdx].questions = updated[sectionIdx].questions.filter((_, i) => i !== qIdx);
    setSections(updated);
  };

  const updateQuestion = (sectionIdx: number, qIdx: number, field: string, value: any) => {
    const updated = [...sections];
    (updated[sectionIdx].questions[qIdx] as any)[field] = value;
    setSections(updated);
  };

  const addOption = (sectionIdx: number, qIdx: number) => {
    const updated = [...sections];
    updated[sectionIdx].questions[qIdx].options = [
      ...(updated[sectionIdx].questions[qIdx].options || []),
      { text: '', isCorrect: false },
    ];
    setSections(updated);
  };

  const updateOption = (sectionIdx: number, qIdx: number, oIdx: number, field: string, value: any) => {
    const updated = [...sections];
    if (updated[sectionIdx].questions[qIdx].options) {
      (updated[sectionIdx].questions[qIdx].options![oIdx] as any)[field] = value;
    }
    setSections(updated);
  };

  const handleSave = async () => {
    if (!title.trim()) { toast.error('Title is required'); return; }
    if (sections.length === 0) { toast.error('Add at least one section'); return; }
    try {
      setSaving(true);
      const res = await fetch('/api/assessment-hub/student', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: currentUser.schoolId,
          title, description, type, classId,
          sections: sections.map((s) => ({
            ...s,
            questions: s.questions.map((q) => ({
              ...q,
              options: q.questionType === 'MULTIPLE_CHOICE' || q.questionType === 'MULTIPLE_ANSWER' ? q.options : undefined,
            })),
          })),
        }),
      });
      if (res.ok) {
        toast.success('Assessment created successfully');
        setCurrentView('assessment-student-list');
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to create');
      }
    } catch { toast.error('Failed to create assessment'); } finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setCurrentView('assessment-student-list')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Create Student Assessment</h1>
            <p className="text-muted-foreground">Build diagnostic assessment with sections and questions</p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-2" /> {saving ? 'Saving...' : 'Save Assessment'}
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Assessment Details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Mid-Term Diagnostic" />
            </div>
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
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description..." />
          </div>
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
              <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => removeSection(sIdx)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Title</Label>
                  <Input value={section.title} onChange={(e) => updateSection(sIdx, 'title', e.target.value)} placeholder="Section title" className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Domain</Label>
                  <Select value={section.domain} onValueChange={(v) => updateSection(sIdx, 'domain', v)}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DOMAINS.map((d) => <SelectItem key={d} value={d}>{d.replace(/_/g, ' ')}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Description</Label>
                  <Input value={section.description} onChange={(e) => updateSection(sIdx, 'description', e.target.value)} placeholder="Optional" className="h-8 text-sm" />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Questions ({section.questions.length})</span>
                  <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => addQuestion(sIdx)}>
                    <Plus className="h-3 w-3 mr-1" /> Add Question
                  </Button>
                </div>
                {section.questions.map((q, qIdx) => (
                  <Card key={qIdx} className="border-dashed">
                    <CardContent className="pt-3 space-y-2">
                      <div className="flex items-start justify-between">
                        <span className="text-xs font-medium">Q{qIdx + 1}</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400" onClick={() => removeQuestion(sIdx, qIdx)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="col-span-2 space-y-1">
                          <Label className="text-[10px]">Question Text</Label>
                          <Input value={q.questionText} onChange={(e) => updateQuestion(sIdx, qIdx, 'questionText', e.target.value)} placeholder="Question text" className="h-7 text-xs" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px]">Type</Label>
                          <Select value={q.questionType} onValueChange={(v) => updateQuestion(sIdx, qIdx, 'questionType', v)}>
                            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="MULTIPLE_CHOICE">Multiple Choice</SelectItem>
                              <SelectItem value="MULTIPLE_ANSWER">Multiple Answer</SelectItem>
                              <SelectItem value="TRUE_FALSE">True/False</SelectItem>
                              <SelectItem value="SHORT_ANSWER">Short Answer</SelectItem>
                              <SelectItem value="ESSAY">Essay</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      {(q.questionType === 'MULTIPLE_CHOICE' || q.questionType === 'MULTIPLE_ANSWER') && (
                        <div className="space-y-1 pl-2 border-l-2 border-muted">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-muted-foreground">Options</span>
                            <Button variant="ghost" size="sm" className="h-5 text-[10px]" onClick={() => addOption(sIdx, qIdx)}>
                              <Plus className="h-2.5 w-2.5 mr-1" /> Add Option
                            </Button>
                          </div>
                          {(q.options || []).map((opt, oIdx) => (
                            <div key={oIdx} className="flex items-center gap-2">
                              <Input
                                value={opt.text}
                                onChange={(e) => updateOption(sIdx, qIdx, oIdx, 'text', e.target.value)}
                                placeholder={`Option ${oIdx + 1}`}
                                className="h-7 text-xs flex-1"
                              />
                              <label className="flex items-center gap-1 text-[10px] whitespace-nowrap">
                                <input
                                  type="checkbox"
                                  checked={opt.isCorrect}
                                  onChange={(e) => updateOption(sIdx, qIdx, oIdx, 'isCorrect', e.target.checked)}
                                />
                                Correct
                              </label>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Label className="text-[10px]">Max Marks:</Label>
                        <Input
                          type="number"
                          value={q.maxMarks}
                          onChange={(e) => updateQuestion(sIdx, qIdx, 'maxMarks', parseInt(e.target.value) || 1)}
                          className="h-7 w-20 text-xs"
                          min={1}
                        />
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
