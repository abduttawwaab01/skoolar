'use client';

import { useCallback, useEffect, useRef } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Palette, Image, Sparkles, History, Users, Loader2 } from 'lucide-react';
import { useCertificateStore } from '@/store/certificate-store';
import { CertificateDesigner } from './certificate-designer';
import { CertificatePreview } from './certificate-preview';
import { CertificateGenerate } from './certificate-generate';
import { CertificateTemplates } from './certificate-templates';
import { CertificateHistory } from './certificate-history';

export function CertificateManager() {
  const { activeTab, setActiveTab, design, setPreview } = useCertificateStore();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updatePreview = useCallback(async () => {
    setPreview({ loading: true });
    try {
      const { generateQRDataUrl } = await import('@/lib/certificate-utils/verification');
      const { buildCertificateRenderData, renderCertificateHTML } = await import('@/lib/certificate-utils/render-certificate');
      const { generateCertificateNumber, generateVerificationCode } = await import('@/lib/certificate-utils/types');

      const certNum = generateCertificateNumber();
      const verCode = generateVerificationCode();
      const qrUrl = await generateQRDataUrl(`https://skoolar.app/verify/${verCode}`);

      const data = buildCertificateRenderData({
        studentName: 'Abdut Tawwab',
        studentPhoto: undefined,
        className: 'SS 2A',
        admissionNo: 'SKL-2024-001',
        academicSession: '2024/2025',
        termName: 'Third Term',
        grade: 'A+',
        attendance: '96%',
        subjects: [
          { name: 'Mathematics', score: '98', grade: 'A+' },
          { name: 'English', score: '95', grade: 'A+' },
          { name: 'Physics', score: '92', grade: 'A' },
          { name: 'Chemistry', score: '89', grade: 'A' },
          { name: 'Biology', score: '94', grade: 'A' },
        ],
        schoolName: 'Skoolar International School',
        schoolLogo: undefined,
        schoolAddress: '123 Education Avenue',
        schoolMotto: 'Excellence in Education',
        principalName: 'Dr. Principal',
        design,
        certificateNumber: certNum,
        verificationCode: verCode,
        issueDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
        qrCodeDataUrl: qrUrl,
      });

      const html = renderCertificateHTML(data);
      setPreview({ html, loading: false });
    } catch (err) {
      console.error('Preview generation failed:', err);
      setPreview({ loading: false });
    }
  }, [design, setPreview]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(updatePreview, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [updatePreview]);

  return (
    <div className="h-full flex flex-col">
      <div className="border-b px-4 py-2 bg-background">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">Certificate Generator</h2>
            <p className="text-xs text-muted-foreground">
              Design, preview, and generate beautiful certificates
            </p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <TabsList className="mx-4 mt-2 grid grid-cols-4 w-[500px]">
          <TabsTrigger value="designer"><Palette className="h-4 w-4 mr-1.5" /> Designer</TabsTrigger>
          <TabsTrigger value="templates"><Sparkles className="h-4 w-4 mr-1.5" /> Templates</TabsTrigger>
          <TabsTrigger value="generate"><Users className="h-4 w-4 mr-1.5" /> Generate</TabsTrigger>
          <TabsTrigger value="history"><History className="h-4 w-4 mr-1.5" /> History</TabsTrigger>
        </TabsList>

        <TabsContent value="designer" className="flex-1 flex min-h-0 p-0 m-0">
          <CertificateDesigner />
          <CertificatePreview />
        </TabsContent>

        <TabsContent value="templates" className="flex-1 min-h-0 p-0 m-0">
          <CertificateTemplates />
        </TabsContent>

        <TabsContent value="generate" className="flex-1 min-h-0 p-0 m-0">
          <CertificateGenerate />
        </TabsContent>

        <TabsContent value="history" className="flex-1 min-h-0 p-0 m-0">
          <CertificateHistory />
        </TabsContent>
      </Tabs>
    </div>
  );
}
