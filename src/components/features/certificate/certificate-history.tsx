'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Search, Download, XCircle, RotateCcw, Trash2, FileText, Eye } from 'lucide-react';
import { useCertificateStore } from '@/store/certificate-store';
import { CERTIFICATE_TYPES } from '@/lib/certificate-utils/types';
export function CertificateHistory() {
  const { issuedCertificates, revokeCertificate, clearHistory } = useCertificateStore();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'REVOKED'>('ALL');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = issuedCertificates.filter(c => {
    if (statusFilter !== 'ALL' && c.status !== statusFilter) return false;
    if (search && !c.studentName.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleDownload = async (cert: typeof issuedCertificates[0]) => {
    if (!cert.qrCodeDataUrl) return;
    const { buildCertificateRenderData, renderCertificateHTML } = await import('@/lib/certificate-utils/render-certificate');
    const data = buildCertificateRenderData({
      studentName: cert.studentName,
      className: cert.className,
      admissionNo: cert.admissionNo,
      academicSession: cert.academicSession,
      termName: cert.termName,
      grade: cert.grade,
      attendance: cert.attendance,
      subjects: cert.subjects || [],
      schoolName: 'School Name',
      schoolAddress: '',
      schoolMotto: '',
      principalName: 'Principal',
      design: cert.design,
      certificateNumber: cert.certificateNumber,
      verificationCode: cert.verificationCode,
      issueDate: cert.issueDate,
      qrCodeDataUrl: cert.qrCodeDataUrl,
    });
    const html = renderCertificateHTML(data);

    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(html);
    win.document.close();
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 p-4 border-b flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by student name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <div className="flex gap-1">
          {(['ALL', 'ACTIVE', 'REVOKED'] as const).map(s => (
            <Button key={s} variant={statusFilter === s ? 'default' : 'outline'} size="sm" onClick={() => setStatusFilter(s)}>
              {s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
            </Button>
          ))}
        </div>
        {issuedCertificates.length > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" className="ml-auto">
                <Trash2 className="h-4 w-4 mr-1" /> Clear All
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear all certificate history?</AlertDialogTitle>
                <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={clearHistory}>Clear</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      <ScrollArea className="flex-1">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
            <FileText className="h-16 w-16 mb-4 opacity-20" />
            <p className="text-lg font-medium">No Certificates Issued</p>
            <p className="text-sm">Generated certificates will appear here</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Certificate No.</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(cert => (
                <TableRow key={cert.id}>
                  <TableCell className="font-mono text-xs">{cert.certificateNumber}</TableCell>
                  <TableCell className="font-medium">{cert.studentName}</TableCell>
                  <TableCell>{CERTIFICATE_TYPES[cert.type]}</TableCell>
                  <TableCell>{cert.className}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{cert.issueDate}</TableCell>
                  <TableCell>
                    <Badge variant={cert.status === 'ACTIVE' ? 'default' : 'destructive'}>
                      {cert.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => handleDownload(cert)} title="View">
                        <Eye className="h-4 w-4" />
                      </Button>
                      {cert.status === 'ACTIVE' ? (
                        <Button variant="ghost" size="sm" onClick={() => revokeCertificate(cert.id)} title="Revoke">
                          <XCircle className="h-4 w-4 text-destructive" />
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </ScrollArea>

      <div className="p-3 border-t text-xs text-muted-foreground">
        {issuedCertificates.length} total certificate{issuedCertificates.length !== 1 ? 's' : ''} issued
        {issuedCertificates.filter(c => c.status === 'ACTIVE').length > 0 && (
          <> &middot; {issuedCertificates.filter(c => c.status === 'ACTIVE').length} active</>
        )}
      </div>
    </div>
  );
}
