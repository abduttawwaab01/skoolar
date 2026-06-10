'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface ScoreEntryExam {
  id: string;
  name: string;
  totalMarks: number;
  passingMarks: number;
  classId: string;
}

interface ExamScoreEntryProps {
  exam: ScoreEntryExam | null;
  onClose: () => void;
  schoolId: string;
  onSaved: () => void;
}

export function ExamScoreEntry({ exam, onClose, schoolId, onSaved }: ExamScoreEntryProps) {
  const [students, setStudents] = useState<{ id: string; name: string; admissionNo: string }[]>([]);
  const [existingScores, setExistingScores] = useState<Record<string, number>>({});
  const [savingScores, setSavingScores] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!exam) return;
    setLoading(true);
    setStudents([]);
    setExistingScores({});
    const classFilter = exam.classId ? `&classId=${exam.classId}` : '';
    Promise.all([
      fetch(`/api/students?schoolId=${schoolId}&limit=500${classFilter}`),
      fetch(`/api/exams/${exam.id}/scores`),
    ])
      .then(async ([studentsRes, scoresRes]) => {
        const studentsJson = await studentsRes.json();
        const scoresJson = await scoresRes.json();
        const studentList = (studentsJson.data || studentsJson || []).map((s: Record<string, unknown>) => ({
          id: s.id as string,
          name: ((s.user as Record<string, unknown>)?.name as string) || 'Unknown',
          admissionNo: (s.admissionNo as string) || '',
        }));
        setStudents(studentList);
        if (scoresJson.data?.scores) {
          const scoreMap: Record<string, number> = {};
          (scoresJson.data.scores as Array<Record<string, unknown>>).forEach((s: Record<string, unknown>) => {
            scoreMap[s.studentId as string] = s.score as number;
          });
          setExistingScores(scoreMap);
        }
      })
      .catch(() => toast.error('Failed to load students and scores'))
      .finally(() => setLoading(false));
  }, [exam, schoolId]);

  const saveScores = async () => {
    if (!exam) return;
    setSavingScores(true);
    try {
      const scores = Object.entries(existingScores).map(([studentId, score]) => ({
        studentId,
        score: parseFloat(score.toString()),
      }));
      const res = await fetch(`/api/exams/${exam.id}/scores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scores }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to save scores');
      toast.success('Scores saved successfully');
      onClose();
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save scores');
    } finally {
      setSavingScores(false);
    }
  };

  return (
    <Dialog open={!!exam} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] w-[95vw]">
        <DialogHeader>
          <DialogTitle>Enter Scores - {exam?.name}</DialogTitle>
          <DialogDescription>
            Total Marks: {exam?.totalMarks} | Passing: {exam?.passingMarks}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="size-8 animate-spin" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-0 sm:min-w-[500px]">
                <thead className="sticky top-0 bg-white border-b">
                  <tr>
                    <th className="text-left p-2 font-medium whitespace-nowrap">Admission No</th>
                    <th className="text-left p-2 font-medium whitespace-nowrap">Student Name</th>
                    <th className="text-left p-2 font-medium whitespace-nowrap">Score (0-{exam?.totalMarks || 100})</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map(student => (
                    <tr key={student.id} className="border-b hover:bg-gray-50">
                      <td className="p-2 font-mono text-xs whitespace-nowrap">{student.admissionNo}</td>
                      <td className="p-2 whitespace-nowrap">{student.name}</td>
                      <td className="p-2">
                        <Input
                          type="number"
                          min={0}
                          max={exam?.totalMarks || 100}
                          className="w-20 sm:w-24"
                          value={existingScores[student.id] || ''}
                          onChange={(e) => setExistingScores(prev => ({
                            ...prev,
                            [student.id]: parseFloat(e.target.value) || 0,
                          }))}
                          placeholder="—"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {students.length === 0 && !loading && (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No students found for this exam&apos;s class</p>
                </div>
              )}
            </div>
          )}
        </div>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={saveScores} disabled={savingScores || students.length === 0 || loading}>
            {savingScores && <Loader2 className="size-4 animate-spin mr-1" />}
            Save Scores
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
