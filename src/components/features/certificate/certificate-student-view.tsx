'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Download, Eye, FileText, ShieldCheck } from 'lucide-react';
import { useCertificateStore } from '@/store/certificate-store';
import { CERTIFICATE_TYPES } from '@/lib/certificate-utils/types';
import { useAppStore } from '@/store/app-store';

export function StudentCertificatesView() {
  const { issuedCertificates } = useCertificateStore();
  const { currentUser } = useAppStore();
  const [search, setSearch] = useState('');

  const myCerts = issuedCertificates.filter(c =>
    c.studentName.toLowerCase().includes(currentUser.name.toLowerCase()) ||
    c.admissionNo === currentUser.id
  );

  const filtered = myCerts.filter(c =>
    c.studentName.toLowerCase().includes(search.toLowerCase()) ||
    c.certificateNumber.toLowerCase().includes(search.toLowerCase())
  );

  if (myCerts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
        <FileText className="h-20 w-20 mb-4 opacity-10" />
        <h3 className="text-xl font-semibold">No Certificates Yet</h3>
        <p className="text-sm mt-1">Certificates issued to you will appear here</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-6 max-w-4xl mx-auto w-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold">My Certificates</h2>
          <p className="text-sm text-muted-foreground">{myCerts.length} certificate{myCerts.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="relative w-64">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8" />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="grid gap-3">
          {filtered.map(cert => (
            <Card key={cert.id} className="hover:shadow-md transition-shadow">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="rounded-full bg-primary/10 p-3">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold">{CERTIFICATE_TYPES[cert.type]}</p>
                  <p className="text-sm text-muted-foreground">
                    {cert.certificateNumber} &middot; {cert.issueDate}
                  </p>
                  <p className="text-xs text-muted-foreground">{cert.className}</p>
                </div>
                <Badge variant={cert.status === 'ACTIVE' ? 'default' : 'destructive'}>
                  {cert.status}
                </Badge>
                {cert.status === 'ACTIVE' && (
                  <Button variant="outline" size="sm">
                    <Eye className="h-4 w-4 mr-1" /> View
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
