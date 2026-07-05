'use client';

import { useState, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useAppStore } from '@/store/app-store';
import { useCertificateStore } from '@/store/certificate-store';
import {
  CERTIFICATE_TYPES,
  generateCertificateNumber,
  generateVerificationCode,
  type IssuedCertificate,
} from '@/lib/certificate-utils/types';
import { generateQRDataUrl } from '@/lib/certificate-utils/verification';
import { buildCertificateRenderData, renderCertificateHTML } from '@/lib/certificate-utils/render-certificate';
import { captureHTMLInIframe } from '@/lib/capture-utils';
import { toast } from 'sonner';
import {
  Loader2, Download, FileText, CheckCircle2, Users, Search, Sparkles,
} from 'lucide-react';

interface StudentEntry {
  id: string;
  name: string;
  admissionNo: string;
  className: string;
  photo?: string;
  gender?: string;
  grade?: string;
  attendance?: string;
}

export function CertificateGenerate() {
  const { currentUser, selectedSchoolId, selectedClassId } = useAppStore();
  const { design, setPreview, addIssuedCertificate } = useCertificateStore();
  const [students, setStudents] = useState<StudentEntry[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [generatedCerts, setGeneratedCerts] = useState<IssuedCertificate[]>([]);
  const [search, setSearch] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewStudent, setPreviewStudent] = useState<StudentEntry | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  const schoolId = selectedSchoolId || currentUser.schoolId;

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '200' });
      if (selectedClassId) params.set('classId', selectedClassId);
      if (schoolId) params.set('schoolId', schoolId);
      const res = await fetch(`/api/students?${params}`);
      const data = await res.json();
      const mapped: StudentEntry[] = (data.students || data || []).map((s: any) => ({
        id: s.id,
        name: s.user?.name || s.fullName || 'Unknown',
        admissionNo: s.admissionNo || '',
        className: s.class?.name || s.className || '',
        photo: s.user?.image || s.photo || undefined,
        gender: s.gender || undefined,
        grade: s.grade || undefined,
        attendance: s.attendance ? `${s.attendance}%` : undefined,
      }));
      setStudents(mapped);
      if (mapped.length === 0) toast.info('No students found for the selected class');
    } catch {
      toast.error('Failed to load students');
    } finally {
      setLoading(false);
    }
  }, [schoolId, selectedClassId]);

  const filteredStudents = students.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.admissionNo.toLowerCase().includes(search.toLowerCase())
  );

  const toggleAll = () => {
    if (selectedIds.size === filteredStudents.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredStudents.map(s => s.id)));
    }
  };

  const toggleOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handlePreview = useCallback(async (student: StudentEntry) => {
    setPreviewStudent(student);
    setShowPreview(true);
    setPreviewLoading(true);

    const certNum = generateCertificateNumber();
    const verCode = generateVerificationCode();
    const qrUrl = await generateQRDataUrl(`https://skoolar.app/verify/${verCode}`);

    const data = buildCertificateRenderData({
      studentName: student.name,
      studentPhoto: student.photo,
      className: student.className,
      admissionNo: student.admissionNo,
      academicSession: new Date().getFullYear().toString(),
      termName: 'Current Term',
      grade: student.grade || 'A',
      attendance: student.attendance || '',
      subjects: [],
      schoolName: currentUser.schoolName || 'School Name',
      schoolAddress: '',
      schoolMotto: '',
      principalName: 'Principal',
      design,
      certificateNumber: certNum,
      verificationCode: verCode,
      issueDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      qrCodeDataUrl: qrUrl,
    });
    const html = renderCertificateHTML(data);
    setPreviewHtml(html);
    setPreviewLoading(false);
  }, [design, currentUser.schoolName]);

  const handleGenerate = useCallback(async () => {
    if (selectedIds.size === 0) {
      toast.error('Select at least one student');
      return;
    }
    setGenerating(true);
    setProgress(0);
    const selected = students.filter(s => selectedIds.has(s.id));
    const certs: IssuedCertificate[] = [];
    let idx = 0;

    for (const student of selected) {
      const certNum = generateCertificateNumber(idx);
      const verCode = generateVerificationCode();
      const qrUrl = await generateQRDataUrl(`https://skoolar.app/verify/${verCode}`);

      const data = buildCertificateRenderData({
        studentName: student.name,
        studentPhoto: student.photo,
        className: student.className,
        admissionNo: student.admissionNo,
        academicSession: new Date().getFullYear().toString(),
        termName: 'Current Term',
        grade: student.grade || 'A',
        attendance: student.attendance || '',
        subjects: [],
        schoolName: currentUser.schoolName || 'School Name',
        schoolAddress: '',
        schoolMotto: '',
        principalName: 'Principal',
        design,
        certificateNumber: certNum,
        verificationCode: verCode,
        issueDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
        qrCodeDataUrl: qrUrl,
      });

      const cert: IssuedCertificate = {
        id: `cert-${Date.now()}-${idx}`,
        certificateNumber: certNum,
        verificationCode: verCode,
        type: design.type,
        studentName: student.name,
        className: student.className,
        admissionNo: student.admissionNo,
        academicSession: new Date().getFullYear().toString(),
        termName: 'Current Term',
        grade: student.grade || 'A',
        issueDate: data.issueDate,
        issuedBy: currentUser.name,
        status: 'ACTIVE',
        design: { ...design },
        fullName: student.name,
        attendance: student.attendance || '',
        subjects: [],
        qrCodeDataUrl: qrUrl,
      };

      certs.push(cert);
      addIssuedCertificate(cert);
      idx++;
      setProgress(Math.round((idx / selected.length) * 100));
    }

    setGeneratedCerts(certs);
    setGenerating(false);
    setSelectedIds(new Set());
    toast.success(`${certs.length} certificate${certs.length !== 1 ? 's' : ''} generated successfully!`);
  }, [selectedIds, students, design, currentUser, addIssuedCertificate]);

  const handleDownloadBatch = useCallback(async () => {
    if (generatedCerts.length === 0) return;
    const { jsPDF: JsPDF } = await import('jspdf');
    const pdf = new JsPDF(design.orientation === 'portrait' ? 'p' : 'l', 'mm', 'a4');

    for (let i = 0; i < generatedCerts.length; i++) {
      const cert = generatedCerts[i];
      const qrUrl = await generateQRDataUrl(`https://skoolar.app/verify/${cert.verificationCode}`);
      const data = buildCertificateRenderData({
        studentName: cert.studentName,
        className: cert.className,
        admissionNo: cert.admissionNo,
        academicSession: cert.academicSession,
        termName: cert.termName,
        grade: cert.grade,
        attendance: cert.attendance,
        subjects: cert.subjects || [],
        schoolName: currentUser.schoolName || 'School Name',
        schoolAddress: '',
        schoolMotto: '',
        principalName: 'Principal',
        design,
        certificateNumber: cert.certificateNumber,
        verificationCode: cert.verificationCode,
        issueDate: cert.issueDate,
        qrCodeDataUrl: qrUrl,
      });
      const html = renderCertificateHTML(data);

      if (i > 0) pdf.addPage();
      const imgData = await captureHTMLInIframe(html, 2);

      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = pdf.internal.pageSize.getHeight();

      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = imgData;
      });

      const imgW = img.naturalWidth;
      const imgH = img.naturalHeight;
      const cssW = imgW / 2;
      const cssH = imgH / 2;
      const mmW = (cssW / 96) * 25.4;
      const mmH = (cssH / 96) * 25.4;

      const scale = Math.min(pdfW / mmW, pdfH / mmH);
      const finalW = mmW * scale;
      const finalH = mmH * scale;
      pdf.addImage(imgData, 'PNG', (pdfW - finalW) / 2, (pdfH - finalH) / 2, finalW, finalH, undefined, 'FAST');
    }

    pdf.save(`certificates-batch-${Date.now()}.pdf`);
    toast.success('Batch PDF downloaded');
  }, [generatedCerts, design, currentUser.schoolName]);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 border-b bg-card sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm">Generate Certificates</h3>
          {!students.length && !loading && (
            <Button variant="outline" size="sm" onClick={fetchStudents}>
              <Users className="h-4 w-4 mr-1" /> Load Students
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{selectedIds.size} selected</Badge>
          <Badge>{design.type ? CERTIFICATE_TYPES[design.type] : '—'}</Badge>
          {generatedCerts.length > 0 && (
            <Button variant="default" size="sm" onClick={handleDownloadBatch}>
              <Download className="h-4 w-4 mr-1" /> Download Batch
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-full lg:w-80 border-r flex flex-col lg:flex-shrink-0">
          <div className="p-2 border-b bg-muted/30">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search students..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 h-8 text-sm"
              />
            </div>
          </div>
          {loading ? (
            <div className="flex items-center justify-center flex-1">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : students.length > 0 ? (
            <>
              <div className="flex items-center gap-2 px-3 py-1.5 border-b text-xs text-muted-foreground">
                <Checkbox checked={selectedIds.size === filteredStudents.length && filteredStudents.length > 0} onCheckedChange={toggleAll} />
                <span>Select All ({filteredStudents.length})</span>
              </div>
              <ScrollArea className="flex-1">
                {filteredStudents.map(student => (
                  <div
                    key={student.id}
                    className={`flex items-center gap-2 px-3 py-2 border-b text-sm hover:bg-muted/50 cursor-pointer transition-colors ${selectedIds.has(student.id) ? 'bg-primary/5' : ''}`}
                    onClick={() => toggleOne(student.id)}
                  >
                    <Checkbox checked={selectedIds.has(student.id)} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{student.name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {student.admissionNo} &middot; {student.className}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 opacity-0 hover:opacity-100"
                      onClick={e => { e.stopPropagation(); handlePreview(student); }}
                      title="Preview"
                    >
                      <FileText className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </ScrollArea>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center flex-1 p-4 text-center text-muted-foreground">
              <Users className="h-12 w-12 mb-3 opacity-20" />
              <p className="text-sm font-medium">No students loaded</p>
              <p className="text-xs mt-1">Click "Load Students" to fetch from your school</p>
            </div>
          )}
        </div>

        <div className="flex-1 flex flex-col min-h-0">
          {generating ? (
            <div className="flex flex-col items-center justify-center flex-1 gap-4 p-8">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-lg font-medium">Generating Certificates...</p>
              <Progress value={progress} className="w-64" />
              <p className="text-sm text-muted-foreground">{progress}% complete</p>
            </div>
          ) : showPreview && previewHtml ? (
            <div className="flex-1 overflow-auto bg-muted/30 p-4">
              {previewStudent && (
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="font-medium">{previewStudent.name}</span>
                    <span className="text-sm text-muted-foreground ml-2">
                      {previewStudent.admissionNo} &middot; {previewStudent.className}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setShowPreview(false)}>
                      Close Preview
                    </Button>
                  </div>
                </div>
              )}
              <div
                ref={previewRef}
                className="mx-auto"
                style={{ width: design.orientation === 'portrait' ? '210mm' : '297mm', maxWidth: '100%' }}
              >
                <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
              </div>
            </div>
          ) : generatedCerts.length > 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 gap-3 p-8">
              <div className="rounded-full bg-primary/10 p-4">
                <CheckCircle2 className="h-10 w-10 text-primary" />
              </div>
              <p className="text-xl font-bold">{generatedCerts.length} Certificate{generatedCerts.length !== 1 ? 's' : ''} Generated</p>
              <p className="text-sm text-muted-foreground">All certificates saved to history</p>
              <div className="flex gap-2 mt-2">
                <Button onClick={handleDownloadBatch}>
                  <Download className="h-4 w-4 mr-2" /> Download All as PDF
                </Button>
                <Button variant="outline" onClick={() => setGeneratedCerts([])}>
                  Generate More
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center flex-1 p-8 text-center text-muted-foreground">
              <Sparkles className="h-16 w-16 mb-4 opacity-20" />
              <p className="text-lg font-medium">Ready to Generate</p>
              <p className="text-sm max-w-md mt-1">
                Select students from the list, then click Generate to create certificates
              </p>
              {selectedIds.size > 0 && (
                <Button size="lg" className="mt-6" onClick={handleGenerate} disabled={generating}>
                  {generating ? (
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  ) : (
                    <Sparkles className="h-5 w-5 mr-2" />
                  )}
                  Generate {selectedIds.size} Certificate{selectedIds.size !== 1 ? 's' : ''}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
