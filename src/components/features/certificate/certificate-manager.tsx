'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Palette, Image, Sparkles, History, Loader2, Eye, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCertificateStore } from '@/store/certificate-store';
import { CertificateDesigner } from './certificate-designer';
import { CertificatePreview } from './certificate-preview';
import { CertificateGenerate } from './certificate-generate';
import { CertificateTemplates } from './certificate-templates';
import { CertificateHistory } from './certificate-history';
import { useIsMobile } from '@/hooks/use-mobile';

export function CertificateManager() {
  const { design, setPreview } = useCertificateStore();
  const [activeTab, setActiveTab] = useState('designer');
  const [designerView, setDesignerView] = useState<'designer' | 'preview'>('designer');
  const isMobile = useIsMobile();
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

  const tabs = [
    { id: 'templates', label: 'Templates', icon: Image },
    { id: 'designer', label: 'Designer', icon: Palette },
    { id: 'generate', label: 'Generate', icon: Sparkles },
    { id: 'history', label: 'History', icon: History },
  ];

  return (
    <div className="h-full flex flex-col min-h-0">
      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setDesignerView('designer'); }} className="flex-1 flex flex-col min-h-0">
        <div className="border-b bg-card sticky top-0 z-10 px-2 sm:px-4">
          <TabsList className="bg-transparent h-12 gap-1 w-full flex-nowrap overflow-x-auto">
            {tabs.map(tab => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary px-2.5 sm:px-3 py-2 text-xs font-medium shrink-0"
              >
                <tab.icon className="h-4 w-4 mr-1 sm:mr-1.5 shrink-0" />
                <span className="text-[11px] sm:text-xs whitespace-nowrap">{tab.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="templates" className="flex-1 min-h-0 m-0 overflow-y-auto">
          <CertificateTemplates />
        </TabsContent>

        <TabsContent value="designer" className="flex-1 min-h-0 m-0 flex flex-col">
          {isMobile && (
            <div className="flex items-center gap-1 px-2 py-1.5 border-b bg-muted/20">
              <Button
                variant={designerView === 'designer' ? 'default' : 'outline'}
                size="sm"
                className="h-7 text-xs flex-1"
                onClick={() => setDesignerView('designer')}
              >
                <Pencil className="size-3 mr-1" /> Designer
              </Button>
              <Button
                variant={designerView === 'preview' ? 'default' : 'outline'}
                size="sm"
                className="h-7 text-xs flex-1"
                onClick={() => setDesignerView('preview')}
              >
                <Eye className="size-3 mr-1" /> Preview
              </Button>
            </div>
          )}
          <div className="flex-1 min-h-0 lg:flex lg:flex-row lg:gap-2 xl:gap-4 p-0 lg:p-2 xl:p-4">
            <div className={`${isMobile ? (designerView === 'designer' ? 'block h-full' : 'hidden') : 'block'} w-full lg:w-80 lg:border-r lg:flex-shrink-0 overflow-y-auto`}>
              <CertificateDesigner />
            </div>
            <div className={`${isMobile ? (designerView === 'preview' ? 'block h-full' : 'hidden') : 'block'} flex-1 min-h-0 border-t lg:border-t-0 overflow-hidden`}>
              <CertificatePreview />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="generate" className="flex-1 min-h-0 m-0 overflow-y-auto">
          <CertificateGenerate />
        </TabsContent>

        <TabsContent value="history" className="flex-1 min-h-0 m-0 overflow-y-auto">
          <CertificateHistory />
        </TabsContent>
      </Tabs>
    </div>
  );
}
