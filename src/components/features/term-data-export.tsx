'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Download, FileSpreadsheet, Calendar, School, Loader2, Database } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/store/app-store';
import { handleSilentError } from '@/lib/error-handler';

interface Term { id: string; name: string; order: number; academicYearId: string; isCurrent: boolean; }
interface AcademicYear { id: string; name: string; isCurrent: boolean; terms: Term[]; }

const DATA_TYPES = [
  { value: 'all', label: 'Full Summary', icon: Database },
  { value: 'students', label: 'Students', icon: FileSpreadsheet },
  { value: 'teachers', label: 'Teachers', icon: FileSpreadsheet },
  { value: 'attendance', label: 'Attendance', icon: Calendar },
  { value: 'exams', label: 'Exams', icon: FileSpreadsheet },
  { value: 'exam_results', label: 'Exam Results', icon: FileSpreadsheet },
  { value: 'homework', label: 'Homework', icon: FileSpreadsheet },
  { value: 'payments', label: 'Payments', icon: FileSpreadsheet },
];

export function TermDataExport() {
  const { currentUser, selectedSchoolId } = useAppStore();
  const schoolId = currentUser?.schoolId || selectedSchoolId || '';
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [downloading, setDownloading] = useState(false);

  const fetchAcademicYears = useCallback(async () => {
    try {
      const res = await fetch(`/api/academic-years?schoolId=${schoolId}`);
      if (res.ok) {
        const json = await res.json();
        setAcademicYears(json.data || []);
        if (json.data?.length > 0) {
          const current = json.data.find((y: AcademicYear) => y.isCurrent) || json.data[0];
          setSelectedYear(current.id);
        }
      }
    } catch (error: unknown) { handleSilentError(error); }
  }, [schoolId]);

  useEffect(() => { fetchAcademicYears(); }, [fetchAcademicYears]);

  const selectedYearData = academicYears.find(y => y.id === selectedYear);
  const availableTerms = selectedYearData?.terms || [];

  useEffect(() => {
    if (availableTerms.length > 0 && !selectedTerm) {
      setSelectedTerm(availableTerms[0].id);
    }
  }, [availableTerms, selectedTerm]);

  const handleDownload = async () => {
    if (!schoolId) { toast.error('No school selected'); return; }
    setDownloading(true);
    try {
      const params = new URLSearchParams({
        schoolId,
        type: selectedType,
        format: 'csv',
      });
      if (selectedTerm) params.set('termId', selectedTerm);
      if (selectedYear) params.set('academicYearId', selectedYear);

      const res = await fetch(`/api/export-term-data?${params.toString()}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Download failed');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const contentDisposition = res.headers.get('Content-Disposition');
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      a.download = filenameMatch ? filenameMatch[1] : `skoolar-export-${selectedType}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Data exported successfully!');
    } catch (e: any) {
      toast.error(e.message || 'Download failed');
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadSession = async () => {
    if (!schoolId || !selectedYear) { toast.error('Select an academic year'); return; }
    setDownloading(true);
    try {
      // Download all terms in the selected year
      for (const type of ['students', 'teachers', 'attendance', 'exams', 'exam_results', 'homework', 'payments']) {
        const params = new URLSearchParams({
          schoolId,
          type,
          format: 'csv',
          academicYearId: selectedYear,
        });
        const res = await fetch(`/api/export-term-data?${params.toString()}`);
        if (res.ok) {
          const blob = await res.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `skoolar-${selectedYearData?.name}-${type}.csv`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
        }
      }
      toast.success('All session data exported!');
    } catch (e: any) {
      toast.error(e.message || 'Download failed');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-emerald-100">
          <Download className="h-6 w-6 text-emerald-700" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Export Data</h1>
          <p className="text-sm text-muted-foreground">Download school data by term or session</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Per Term Export */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-5 w-5 text-emerald-600" />
              Export by Term
            </CardTitle>
            <CardDescription>Select a year, term, and data type to download</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Academic Year</Label>
              <Select value={selectedYear} onValueChange={v => { setSelectedYear(v); setSelectedTerm(''); }}>
                <SelectTrigger><SelectValue placeholder="Select year" /></SelectTrigger>
                <SelectContent>
                  {academicYears.map(y => (
                    <SelectItem key={y.id} value={y.id}>{y.name} {y.isCurrent && <Badge className="ml-2 text-xs">Current</Badge>}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {availableTerms.length > 0 && (
              <div className="space-y-2">
                <Label>Term</Label>
                <Select value={selectedTerm} onValueChange={setSelectedTerm}>
                  <SelectTrigger><SelectValue placeholder="Select term" /></SelectTrigger>
                  <SelectContent>
                    {availableTerms.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.name} {t.isCurrent && <Badge className="ml-2 text-xs">Current</Badge>}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Data Type</Label>
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DATA_TYPES.map(dt => (
                    <SelectItem key={dt.value} value={dt.value} className="flex items-center gap-2">
                      <dt.icon className="h-4 w-4 mr-2" /> {dt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button onClick={handleDownload} disabled={downloading || !schoolId} className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
              {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Download CSV
            </Button>
          </CardContent>
        </Card>

        {/* Full Session Export */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <School className="h-5 w-5 text-blue-600" />
              Export Full Session
            </CardTitle>
            <CardDescription>Download all data types for the entire academic year</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Academic Year</Label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger><SelectValue placeholder="Select year" /></SelectTrigger>
                <SelectContent>
                  {academicYears.map(y => (
                    <SelectItem key={y.id} value={y.id}>{y.name} {y.isCurrent && <Badge className="ml-2 text-xs">Current</Badge>}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm font-medium text-blue-700 mb-1">This will download:</p>
              <ul className="text-xs text-blue-600 space-y-1">
                {DATA_TYPES.filter(dt => dt.value !== 'all').map(dt => (
                  <li key={dt.value} className="flex items-center gap-2">
                    <dt.icon className="h-3 w-3" /> {dt.label}
                  </li>
                ))}
              </ul>
            </div>

            <Button onClick={handleDownloadSession} disabled={downloading || !selectedYear || !schoolId} className="w-full gap-2 bg-blue-600 hover:bg-blue-700 text-white">
              {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Download All Session Data
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
