'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, Layers, Save } from 'lucide-react';
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';

const RATING_OPTIONS = [5, 4, 3, 2, 1];

const COGNITIVE_FIELDS = [
  { key: 'cognitiveReasoning', label: 'Reasoning' },
  { key: 'cognitiveMemory', label: 'Memory' },
  { key: 'cognitiveConcentration', label: 'Concentration' },
  { key: 'cognitiveProblemSolving', label: 'Problem Solving' },
  { key: 'cognitiveInitiative', label: 'Initiative' },
];

const PSYCHOMOTOR_FIELDS = [
  { key: 'psychomotorHandwriting', label: 'Handwriting' },
  { key: 'psychomotorSports', label: 'Sports' },
  { key: 'psychomotorDrawing', label: 'Drawing' },
  { key: 'psychomotorPractical', label: 'Practical Skills' },
];

const AFFECTIVE_FIELDS = [
  { key: 'affectivePunctuality', label: 'Punctuality' },
  { key: 'affectiveNeatness', label: 'Neatness' },
  { key: 'affectiveHonesty', label: 'Honesty' },
  { key: 'affectiveLeadership', label: 'Leadership' },
  { key: 'affectiveCooperation', label: 'Cooperation' },
  { key: 'affectiveAttentiveness', label: 'Attentiveness' },
  { key: 'affectiveObedience', label: 'Obedience' },
  { key: 'affectiveSelfControl', label: 'Self Control' },
  { key: 'affectivePoliteness', label: 'Politeness' },
];

export function ReportCardDomainEditor() {
  const { currentUser } = useAppStore();
  const schoolId = currentUser?.schoolId || '';

  const [classes, setClasses] = useState<any[]>([]);
  const [terms, setTerms] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedTermId, setSelectedTermId] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [scores, setScores] = useState<Record<string, number>>({});
  const [classTeacherComment, setClassTeacherComment] = useState('');
  const [classTeacherName, setClassTeacherName] = useState('');
  const [principalComment, setPrincipalComment] = useState('');
  const [principalName, setPrincipalName] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingDomain, setLoadingDomain] = useState(false);

  useEffect(() => {
    if (!schoolId) return;
    Promise.all([
      fetch(`/api/classes?schoolId=${schoolId}`).then(r => r.json()),
      fetch(`/api/terms?schoolId=${schoolId}`).then(r => r.json()),
    ]).then(([clsRes, termRes]) => {
      setClasses(clsRes.data || clsRes.classes || []);
      setTerms(termRes.data || termRes.terms || []);
    });
  }, [schoolId]);

  useEffect(() => {
    if (!selectedClassId) { setStudents([]); return; }
    fetch(`/api/students?classId=${selectedClassId}`).then(r => r.json())
      .then(res => setStudents(res.data || res.students || []));
  }, [selectedClassId]);

  useEffect(() => {
    if (!selectedStudentId || !selectedTermId) return;
    setLoadingDomain(true);
    fetch(`/api/domain-grades?studentId=${selectedStudentId}&termId=${selectedTermId}&schoolId=${schoolId}`)
      .then(r => r.json())
      .then(res => {
        const dg = res.data?.[0];
        if (dg) {
          const vals: Record<string, number> = {};
          [...COGNITIVE_FIELDS, ...PSYCHOMOTOR_FIELDS, ...AFFECTIVE_FIELDS].forEach(({ key }) => {
            if ((dg as any)[key] !== null && (dg as any)[key] !== undefined) vals[key] = (dg as any)[key];
          });
          setScores(vals);
          setClassTeacherComment(dg.classTeacherComment || '');
          setClassTeacherName(dg.classTeacherName || '');
          setPrincipalComment(dg.principalComment || '');
          setPrincipalName(dg.principalName || '');
        } else {
          setScores({});
          setClassTeacherComment('');
          setClassTeacherName('');
          setPrincipalComment('');
          setPrincipalName('');
        }
      })
      .catch(() => { setScores({}); })
      .finally(() => setLoadingDomain(false));
  }, [selectedStudentId, selectedTermId, schoolId]);

  const handleSave = async () => {
    if (!selectedStudentId || !selectedTermId) return;
    setSaving(true);
    try {
      const body: any = {
        schoolId,
        studentId: selectedStudentId,
        termId: selectedTermId,
        classId: selectedClassId,
        ...scores,
        classTeacherComment,
        classTeacherName,
        principalComment,
        principalName,
      };
      const res = await fetch('/api/domain-grades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Save failed');
      toast.success('Domain grades saved');
    } catch { toast.error('Save failed'); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Layers className="size-4" />Domain Grade Editor
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Class</Label>
              <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {classes.map((c: any) => (<SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Term</Label>
              <Select value={selectedTermId} onValueChange={setSelectedTermId}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {terms.map((t: any) => (<SelectItem key={t.id} value={t.id} className="text-xs">{t.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Student</Label>
              <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {students.map((s: any) => (<SelectItem key={s.id} value={s.id} className="text-xs">{s.name || s.user?.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {loadingDomain ? <div className="flex justify-center py-4"><Loader2 className="size-5 animate-spin" /></div> : selectedStudentId && (
            <>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <h4 className="text-xs font-medium text-blue-600">Cognitive</h4>
                  {COGNITIVE_FIELDS.map(({ key, label }) => (
                    <div key={key} className="flex items-center justify-between">
                      <span className="text-[10px]">{label}</span>
                      <Select value={String(scores[key] ?? '')} onValueChange={(v) => setScores((s) => ({ ...s, [key]: Number(v) }))}>
                        <SelectTrigger className="h-7 w-16 text-[10px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {RATING_OPTIONS.map((r) => (<SelectItem key={r} value={String(r)} className="text-[10px]">{r}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>

                <div className="space-y-1.5">
                  <h4 className="text-xs font-medium text-green-600">Psychomotor</h4>
                  {PSYCHOMOTOR_FIELDS.map(({ key, label }) => (
                    <div key={key} className="flex items-center justify-between">
                      <span className="text-[10px]">{label}</span>
                      <Select value={String(scores[key] ?? '')} onValueChange={(v) => setScores((s) => ({ ...s, [key]: Number(v) }))}>
                        <SelectTrigger className="h-7 w-16 text-[10px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {RATING_OPTIONS.map((r) => (<SelectItem key={r} value={String(r)} className="text-[10px]">{r}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>

                <div className="space-y-1.5">
                  <h4 className="text-xs font-medium text-purple-600">Affective</h4>
                  {AFFECTIVE_FIELDS.map(({ key, label }) => (
                    <div key={key} className="flex items-center justify-between">
                      <span className="text-[10px]">{label}</span>
                      <Select value={String(scores[key] ?? '')} onValueChange={(v) => setScores((s) => ({ ...s, [key]: Number(v) }))}>
                        <SelectTrigger className="h-7 w-16 text-[10px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {RATING_OPTIONS.map((r) => (<SelectItem key={r} value={String(r)} className="text-[10px]">{r}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Class Teacher Comment</Label>
                  <Textarea className="h-16 text-xs" value={classTeacherComment} onChange={(e) => setClassTeacherComment(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Principal Comment</Label>
                  <Textarea className="h-16 text-xs" value={principalComment} onChange={(e) => setPrincipalComment(e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Class Teacher Name</Label>
                  <Input className="h-8 text-xs" value={classTeacherName} onChange={(e) => setClassTeacherName(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Principal Name</Label>
                  <Input className="h-8 text-xs" value={principalName} onChange={(e) => setPrincipalName(e.target.value)} />
                </div>
              </div>

              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="size-3.5 animate-spin mr-1" /> : <Save className="size-3.5 mr-1" />}
                {saving ? 'Saving...' : 'Save Domain Grades'}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
