'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '@/store/app-store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { 
  Award, TrendingUp, Users, BookOpen, 
  Download, Printer, FileText
} from 'lucide-react';

interface TermResult {
  termId: string;
  termName: string;
  average: number;
  position: number;
  totalStudents: number;
}

interface YearResult {
  studentId: string;
  studentName: string;
  term1: number | null;
  term2: number | null;
  term3: number | null;
  cumulative: number;
  rank: number;
  promoted: boolean;
}

interface TermData {
  id: string;
  name: string;
  order: number;
}

export function YearResultsView() {
  const { currentUser, selectedSchoolId, currentRole } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<YearResult[]>([]);
  const [terms, setTerms] = useState<TermData[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [classes, setClasses] = useState<Array<{ id: string; name: string; section: string }>>([]);

  const fetchClasses = useCallback(async () => {
    if (!selectedSchoolId) return;
    try {
      const res = await fetch(`/api/classes?schoolId=${selectedSchoolId}`);
      const json = await res.json();
      setClasses(json.data || []);
    } catch { toast.error('Failed to load classes'); }
  }, [selectedSchoolId]);

  const fetchTerms = useCallback(async () => {
    if (!selectedSchoolId) return;
    try {
      const res = await fetch(`/api/terms?schoolId=${selectedSchoolId}&limit=10`);
      const json = await res.json();
      setTerms(json.data || []);
    } catch { toast.error('Failed to load terms'); }
  }, [selectedSchoolId]);

  const fetchYearResults = useCallback(async () => {
    if (!selectedSchoolId || !selectedClassId) return;
    setLoading(true);
    try {
      const [term1Term, term2Term, term3Term] = terms;
      
      // Fetch scores for all 3 terms
      const fetchTermScores = async (termId: string) => {
        if (!termId) return [];
        const res = await fetch(`/api/results?schoolId=${selectedSchoolId}&termId=${termId}&classId=${selectedClassId}`);
        const json = await res.json();
        return json.data || [];
      };

      const [term1Scores, term2Scores, term3Scores] = await Promise.all([
        term1Term ? fetchTermScores(term1Term.id) : Promise.resolve([]),
        term2Term ? fetchTermScores(term2Term.id) : Promise.resolve([]),
        term3Term ? fetchTermScores(term3Term.id) : Promise.resolve([]),
      ]);

      // Aggregate student scores
      const studentMap = new Map<string, { name: string; scores: (number | null)[] }>();
      
      [...term1Scores, ...term2Scores, ...term3Scores].forEach((score: { studentId: string; studentName: string; totalScore: number; termId: string }) => {
        if (!studentMap.has(score.studentId)) {
          studentMap.set(score.studentId, { name: score.studentName, scores: [null, null, null] });
        }
        const student = studentMap.get(score.studentId)!;
        const termIndex = terms.findIndex(t => t.id === score.termId);
        student.scores[termIndex] = score.totalScore;
      });

      // Calculate cumulative and rank
      const yearResults: YearResult[] = Array.from(studentMap.entries()).map(([studentId, data]) => {
        const [t1, t2, t3] = data.scores;
        const validScores = [t1, t2, t3].filter(s => s !== null) as number[];
        const cumulative = validScores.length > 0 
          ? validScores.reduce((a, b) => a + b, 0) / validScores.length 
          : 0;
        
        return {
          studentId,
          studentName: data.name,
          term1: t1,
          term2: t2,
          term3: t3,
          cumulative: Math.round(cumulative * 10) / 10,
          rank: 0,
          promoted: cumulative >= 40,
        };
      });

      // Sort by cumulative and assign ranks
      yearResults.sort((a, b) => b.cumulative - a.cumulative);
      yearResults.forEach((r, i) => r.rank = i + 1);

      setResults(yearResults);
    } catch { toast.error('Failed to load year results'); }
    finally { setLoading(false); }
  }, [selectedSchoolId, selectedClassId, terms]);

  useEffect(() => {
    fetchClasses();
    fetchTerms();
  }, [fetchClasses, fetchTerms]);

  useEffect(() => {
    if (selectedClassId && terms.length >= 2) {
      fetchYearResults();
    }
  }, [selectedClassId, terms.length, fetchYearResults]);

  const stats = {
    totalStudents: results.length,
    averageScore: results.length > 0 
      ? Math.round(results.reduce((a, r) => a + r.cumulative, 0) / results.length) 
      : 0,
    promotedCount: results.filter(r => r.promoted).length,
    topPerformer: results.find(r => r.rank === 1)?.studentName || 'N/A',
  };

  const chartData = results.slice(0, 10).map(r => ({
    name: r.studentName.split(' ')[0],
    score: r.cumulative,
    rank: r.rank,
  }));

  if (!selectedSchoolId) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <p className="text-gray-500">Please select a school first</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            📊 Year Results
          </h2>
          <p className="text-sm text-muted-foreground">Comprehensive academic year analysis (Term 1-3)</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-2" /> Print
          </Button>
          <Button variant="outline" onClick={() => {
            const csv = results.map(r => 
              `${r.studentName},${r.term1 || ''},${r.term2 || ''},${r.term3 || ''},${r.cumulative},${r.rank},${r.promoted ? 'Promoted' : 'Retained'}`
            ).join('\n');
            const blob = new Blob([`Name,Term 1,Term 2,Term 3,Cumulative,Rank,Status\n${csv}`], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'year-results.csv';
            a.click();
            toast.success('Results exported');
          }}>
            <Download className="h-4 w-4 mr-2" /> Export
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Total Students</p>
                <p className="text-xl font-bold">{stats.totalStudents}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Average Score</p>
                <p className="text-xl font-bold">{stats.averageScore}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                <Award className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Promoted</p>
                <p className="text-xl font-bold">{stats.promotedCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <BookOpen className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Top Performer</p>
                <p className="text-lg font-bold truncate">{stats.topPerformer}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Class Selector */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Select Class</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedClassId} onValueChange={setSelectedClassId}>
            <SelectTrigger className="w-full md:w-64">
              <SelectValue placeholder="Select a class" />
            </SelectTrigger>
            <SelectContent>
              {classes.map(c => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name} {c.section && `- ${c.section}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
        </div>
      )}

      {!loading && selectedClassId && results.length === 0 && (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-gray-500">No results data for this class yet.</p>
            <p className="text-sm text-gray-400 mt-1">Generate term results first to see year analysis.</p>
          </CardContent>
        </Card>
      )}

      {!loading && results.length > 0 && (
        <div className="space-y-4">
          {/* Performance Table - Top 10 */}
          <Card>
            <CardHeader>
              <CardTitle>Top 10 Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2 text-sm font-medium text-gray-500">Rank</th>
                      <th className="text-left py-2 px-2 text-sm font-medium text-gray-500">Student</th>
                      <th className="text-center py-2 px-2 text-sm font-medium text-gray-500">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chartData.map((student, i) => (
                      <tr key={i} className="border-b hover:bg-gray-50">
                        <td className="py-2 px-2 font-medium">#{student.rank}</td>
                        <td className="py-2 px-2">{student.name}</td>
                        <td className="py-2 px-2 text-center font-bold">{student.score}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Results Table */}
          <Card>
            <CardHeader>
              <CardTitle>Complete Year Results</CardTitle>
              <CardDescription>Term 1, 2, 3 scores with cumulative average and promotion status</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-2 text-sm font-medium text-gray-500">Rank</th>
                      <th className="text-left py-3 px-2 text-sm font-medium text-gray-500">Student</th>
                      <th className="text-center py-3 px-2 text-sm font-medium text-gray-500">Term 1</th>
                      <th className="text-center py-3 px-2 text-sm font-medium text-gray-500">Term 2</th>
                      <th className="text-center py-3 px-2 text-sm font-medium text-gray-500">Term 3</th>
                      <th className="text-center py-3 px-2 text-sm font-medium text-gray-500">Cumul.</th>
                      <th className="text-center py-3 px-2 text-sm font-medium text-gray-500">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r, i) => (
                      <tr key={r.studentId} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-2">#{r.rank}</td>
                        <td className="py-3 px-2 font-medium">{r.studentName}</td>
                        <td className="py-3 px-2 text-center">{r.term1 ?? '-'}</td>
                        <td className="py-3 px-2 text-center">{r.term2 ?? '-'}</td>
                        <td className="py-3 px-2 text-center">{r.term3 ?? '-'}</td>
                        <td className="py-3 px-2 text-center font-bold">{r.cumulative}%</td>
                        <td className="py-3 px-2 text-center">
                          <Badge className={r.promoted ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}>
                            {r.promoted ? 'Promoted' : 'Retained'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}