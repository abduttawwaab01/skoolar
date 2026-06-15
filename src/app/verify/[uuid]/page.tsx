'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  CheckCircle2, XCircle, AlertTriangle, Clock,
  ExternalLink, School, User, Hash, Calendar, Shield,
} from 'lucide-react';

interface VerificationData {
  valid: boolean;
  status: string;
  message: string;
  cardData?: {
    uuid: string;
    fullName: string;
    displayId: string;
    personType: string;
    schoolName: string;
    designName?: string;
    issueDate: string;
    expiryDate?: string | null;
  };
}

export default function VerifyPage() {
  const params = useParams<{ uuid: string }>();
  const [data, setData] = useState<VerificationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function verify() {
      try {
        const res = await fetch(`/api/id-cards/verify/${params.uuid}`);
        const json = await res.json();
        setData(json);
      } catch {
        setError('Failed to verify ID card');
      } finally {
        setLoading(false);
      }
    }
    verify();
  }, [params.uuid]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 space-y-4">
            <Skeleton className="h-8 w-3/4 mx-auto" />
            <Skeleton className="h-20 w-20 rounded-full mx-auto" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3 mx-auto" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="p-8">
            <XCircle className="size-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Verification Failed</h2>
            <p className="text-gray-500">{error || 'Unable to verify this ID card.'}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    active: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    expired: 'bg-red-100 text-red-800 border-red-200',
    suspended: 'bg-amber-100 text-amber-800 border-amber-200',
    replaced: 'bg-blue-100 text-blue-800 border-blue-200',
    not_found: 'bg-gray-100 text-gray-800 border-gray-200',
  };

  const statusIcons: Record<string, React.ReactNode> = {
    active: <CheckCircle2 className="size-5 text-emerald-500" />,
    expired: <Clock className="size-5 text-red-500" />,
    suspended: <AlertTriangle className="size-5 text-amber-500" />,
    replaced: <Shield className="size-5 text-blue-500" />,
    not_found: <XCircle className="size-5 text-gray-500" />,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg border-0">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-3">
            <div className={`p-3 rounded-full ${data.valid ? 'bg-emerald-50' : 'bg-red-50'}`}>
              {data.valid
                ? <CheckCircle2 className="size-10 text-emerald-500" />
                : <XCircle className="size-10 text-red-500" />
              }
            </div>
          </div>
          <CardTitle className="text-xl font-bold">
            ID Card Verification
          </CardTitle>
          <div className="flex justify-center mt-2">
            <Badge className={`px-3 py-1 text-xs font-medium border ${statusColors[data.status] || 'bg-gray-100 text-gray-800'}`}>
              <span className="flex items-center gap-1.5">
                {statusIcons[data.status] || null}
                {data.status.charAt(0).toUpperCase() + data.status.slice(1)}
              </span>
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 p-6">
          <p className="text-center text-sm text-gray-600">{data.message}</p>

          {data.cardData && (
            <div className="bg-gray-50 rounded-lg p-4 space-y-3 border">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-50 rounded-full">
                  <User className="size-4 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Full Name</p>
                  <p className="text-sm font-semibold text-gray-900">{data.cardData.fullName}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 rounded-full">
                  <Hash className="size-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">ID Number</p>
                  <p className="text-sm font-semibold text-gray-900">{data.cardData.displayId}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-50 rounded-full">
                  <Shield className="size-4 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Type</p>
                  <p className="text-sm font-semibold text-gray-900 capitalize">{data.cardData.personType}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-50 rounded-full">
                  <School className="size-4 text-amber-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">School</p>
                  <p className="text-sm font-semibold text-gray-900">{data.cardData.schoolName}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="p-2 bg-cyan-50 rounded-full">
                  <Calendar className="size-4 text-cyan-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Issued</p>
                  <p className="text-sm font-semibold text-gray-900">{data.cardData.issueDate}</p>
                </div>
              </div>

              {data.cardData.expiryDate && (
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-50 rounded-full">
                    <Clock className="size-4 text-red-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Expires</p>
                    <p className="text-sm font-semibold text-gray-900">{data.cardData.expiryDate}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="text-center pt-2">
            <p className="text-xs text-gray-400 mb-3">
              UUID: {params.uuid.slice(0, 8)}...{params.uuid.slice(-4)}
            </p>
            <Button variant="outline" size="sm" onClick={() => window.print()} className="text-xs">
              <ExternalLink className="size-3 mr-1" /> Print Verification
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
