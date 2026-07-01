'use client';

import { useCallback, useEffect, useRef } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Palette, Image, Sparkles, History, Users, Loader2, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCertificateStore } from '@/store/certificate-store';
import { CertificateDesigner } from './certificate-designer';
import { CertificatePreview } from './certificate-preview';
import { CertificateGenerate } from './certificate-generate';
import { CertificateTemplates } from './certificate-templates';
import { CertificateHistory } from './certificate-history';
import { useIsMobile } from '@/hooks/use-mobile';

export function CertificateManager() {
  const { activeTab, setActiveTab, design, setPreview } = useCertificateStore();
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
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
    <div className="h-full flex flex-col relative">
      {isMobile && (
        <div className="flex items-center justify-between px-4 py-2 border-b bg-card sticky top-0 z-10">
          <h2 className="text-lg font-bold">Certificate Generator</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>
        </div>
      )}

      <div className="flex-1 flex min-h-0 p-0 m-0 relative">
        {(!isMobile || sidebarOpen) && (
          <div className={`${isMobile ? 'absolute inset-0 z-20 bg-background transform transition-transform duration-300 ' + (sidebarOpen ? 'translate-x-0' : '-translate-x-full') : ''} w-80 h-full flex flex-col bg-background border-r`}>          
            <Tabs value="designer" className="flex-1 flex flex-col min-h-0 p-0 m-0">
              <TabsContent value="designer" className="flex-1 flex min-h-0 p-0 m-0">
                <CertificateDesigner />
              </TabsContent>
            </Tabs>
          </div>
        )}
        
        {isMobile && !sidebarOpen && (
          <div className="absolute top-20 left-0 right-0 px-4 py-2 bg-blue-50 border-b text-xs text-blue-600 z-10 flex items-center gap-2">
            <Menu className="h-3 w-3" />
            Swipe right to open designer, preview shows certificate only
          </div>
        )}
        
        <div className={`flex-1 flex flex-col bg-card min-h-0 p-0 m-0 ${isMobile && !sidebarOpen ? 'w-full' : ''}`}>
          {!isMobile || (isMobile && !sidebarOpen) ? (
            <>
              <Tabs value="preview" className="flex-1 flex flex-col min-h-0 p-0 m-0">
                <TabsContent value="preview" className="flex-1 flex min-h-0 p-0 m-0">
                  <CertificatePreview />
                </TabsContent>
              </Tabs>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground p-8">
              <Menu className="h-8 w-8 mb-2" />
              <div>Open the Designer panel to configure certificates</div>
              <Button 
                className="mt-4" 
                size="sm" 
                onClick={() => setSidebarOpen(true)}
              >
                Open Designer
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
