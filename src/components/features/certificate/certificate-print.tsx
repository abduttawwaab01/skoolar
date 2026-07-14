'use client';

import { useEffect, useRef } from 'react';
import { useCertificateStore } from '@/store/certificate-store';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';

export function CertificatePrintView({ certificateId }: { certificateId?: string }) {
  const { issuedCertificates, design } = useCertificateStore();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const cert = certificateId
    ? issuedCertificates.find(c => c.id === certificateId)
    : issuedCertificates[0];

  useEffect(() => {
    if (!cert || !iframeRef.current) return;

    const loadHtml = async () => {
      const { generateQRDataUrl } = await import('@/lib/certificate-utils/verification');
      const { buildCertificateRenderData, renderCertificateHTML } = await import('@/lib/certificate-utils/render-certificate');

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
        schoolName: (cert.design || design).schoolName || 'School Name',
        schoolLogo: (cert.design || design).schoolLogoUrl || undefined,
        schoolAddress: (cert.design || design).schoolAddress || '',
        schoolMotto: (cert.design || design).schoolMotto || '',
        principalName: (cert.design || design).principalName || 'Principal',
        design: cert.design || design,
        certificateNumber: cert.certificateNumber,
        verificationCode: cert.verificationCode,
        issueDate: cert.issueDate,
        qrCodeDataUrl: qrUrl,
      });
      const html = renderCertificateHTML(data);

      if (iframeRef.current) {
        iframeRef.current.srcdoc = html;
      }
    };

    loadHtml();
  }, [cert, design]);

  if (!cert) {
    return <div className="p-8 text-center text-muted-foreground">No certificate found</div>;
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-3 border-b bg-background">
        <div>
          <span className="font-medium">{cert.studentName}</span>
          <span className="text-sm text-muted-foreground ml-2">- {cert.certificateNumber}</span>
        </div>
        <Button onClick={() => iframeRef.current?.contentWindow?.print()}>
          <Printer className="h-4 w-4 mr-2" /> Print
        </Button>
      </div>
      <iframe
        ref={iframeRef}
        className="flex-1 w-full border-0"
        title="Certificate Print View"
      />
    </div>
  );
}
