'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';
import { Download, FileText, GraduationCap, CalendarCheck, CreditCard } from 'lucide-react';

interface ApiStudent {
  id: string;
  admissionNo: string;
  user: { name: string };
  class: { id: string; name: string } | null;
}

export default function ParentDownloadReports() {
  const { currentUser, selectedSchoolId } = useAppStore();
  const schoolId = currentUser.schoolId || selectedSchoolId || '';

  const [loading, setLoading] = useState(true);
  const [children, setChildren] = useState<ApiStudent[]>([]);

  useEffect(() => {
    const fetchChildren = async () => {
      try {
        const res = await fetch(`/api/parent/children?schoolId=${schoolId}`);
        if (res.ok) {
          const json = await res.json();
          setChildren(json.data || []);
        }
      } catch {
        toast.error('Failed to load children');
      } finally {
        setLoading(false);
      }
    };
    fetchChildren();
  }, [currentUser.id, schoolId]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div><Skeleton className="h-8 w-48" /><Skeleton className="h-4 w-32 mt-2" /></div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Download Reports</h1>
        <p className="text-muted-foreground">Download reports for your children</p>
      </div>

      {children.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No children found
          </CardContent>
        </Card>
      ) : (
        children.map(child => (
          <Card key={child.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <GraduationCap className="size-4 text-emerald-600" />
                    {child.user.name}
                  </CardTitle>
                  <CardDescription>
                    {child.class?.name || 'Unassigned'} &middot; {child.admissionNo}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-3">
                <Button
                  variant="outline"
                  className="h-auto flex-col items-center gap-2 py-6"
                  onClick={() => {
                    toast.success('Attendance report download started');
                  }}
                >
                  <CalendarCheck className="size-6 text-blue-600" />
                  <div className="text-xs font-medium">Attendance Report</div>
                </Button>
                <Button
                  variant="outline"
                  className="h-auto flex-col items-center gap-2 py-6"
                  onClick={async () => {
                    try {
                      const res = await fetch(`/api/report-cards?studentId=${child.id}&isPublished=true`);
                      const json = await res.json();
                      const reportCardId = json.data?.[0]?.id;
                      if (reportCardId) {
                        window.open(`/api/report-cards/${reportCardId}/pdf`, '_blank');
                      } else {
                        toast.error('No published report card found for this student');
                      }
                    } catch {
                      toast.error('Failed to fetch report card');
                    }
                  }}
                >
                  <FileText className="size-6 text-emerald-600" />
                  <div className="text-xs font-medium">Report Card</div>
                </Button>
                <Button
                  variant="outline"
                  className="h-auto flex-col items-center gap-2 py-6"
                  onClick={() => {
                    toast.success('Payment receipt download started');
                  }}
                >
                  <CreditCard className="size-6 text-purple-600" />
                  <div className="text-xs font-medium">Payment Receipts</div>
                </Button>
              </div>
              <div className="mt-3 text-xs text-muted-foreground flex items-center gap-2">
                <Download className="size-3" /> Click to download
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
