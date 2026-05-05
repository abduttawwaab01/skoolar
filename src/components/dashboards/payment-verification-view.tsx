'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';
import { 
  CreditCard, 
  Building2, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Search,
  Loader2,
  FileText,
  ArrowRight
} from 'lucide-react';

interface PendingPayment {
  id: string;
  schoolId: string;
  planId: string;
  reference: string;
  amount: number;
  currency: string;
  status: string;
  startDate: string;
  endDate: string;
  createdAt: string;
  channel: string;
  school: {
    id: string;
    name: string;
    slug: string;
  };
  plan: {
    id: string;
    name: string;
    displayName: string;
    price: number;
  };
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateStr: string) {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

const statusColors: Record<string, string> = {
  pending_verification: 'bg-amber-100 text-amber-700 border-amber-200',
  success: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  failed: 'bg-red-100 text-red-700 border-red-200',
};

export function PaymentVerificationView() {
  const { currentRole } = useAppStore();
  const [payments, setPayments] = React.useState<PendingPayment[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [processingId, setProcessingId] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState('');

  const isSuperAdmin = currentRole === 'SUPER_ADMIN';

  React.useEffect(() => {
    if (!isSuperAdmin) return;
    fetchPayments();
  }, [isSuperAdmin]);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/payments/manual?status=pending_verification');
      const json = await res.json();
      setPayments(Array.isArray(json.data) ? json.data : []);
    } catch {
      toast.error('Failed to load payments');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (paymentId: string, action: 'approve' | 'reject') => {
    try {
      setProcessingId(paymentId);
      const res = await fetch('/api/payments/manual', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId, action }),
      });
      
      const json = await res.json();
      
      if (res.ok) {
        toast.success(json.message);
        fetchPayments();
      } else {
        toast.error(json.error || 'Failed to process payment');
      }
    } catch {
      toast.error('Failed to process payment');
    } finally {
      setProcessingId(null);
    }
  };

  const filteredPayments = React.useMemo(() => {
    if (!search.trim()) return payments;
    const q = search.toLowerCase();
    return payments.filter(
      (p) => 
        p.school.name.toLowerCase().includes(q) ||
        p.reference.toLowerCase().includes(q) ||
        p.plan.displayName.toLowerCase().includes(q)
    );
  }, [payments, search]);

  const totalPending = payments.length;
  const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);

  if (!isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <CreditCard className="size-12 opacity-30 mb-3" />
        <p className="font-medium">Access Denied</p>
        <p className="text-sm mt-1">Only Super Admins can access this page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Payment Verification</h2>
          <p className="text-sm text-muted-foreground">Review and verify manual bank transfer payments</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1.5">
            <Clock className="size-3.5" />
            {totalPending} Pending
          </Badge>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-amber-100">
                <Clock className="size-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-xl font-bold">{totalPending}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-100">
                <CreditCard className="size-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Amount</p>
                <p className="text-xl font-bold">{formatCurrency(totalAmount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-blue-100">
                <Building2 className="size-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Schools</p>
                <p className="text-xl font-bold">{new Set(payments.map(p => p.schoolId)).size}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by school, reference, or plan..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Payments List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : filteredPayments.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CheckCircle className="size-12 text-emerald-500 mb-3" />
            <p className="font-medium text-gray-900">All caught up!</p>
            <p className="text-sm text-muted-foreground">No pending payments to verify.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredPayments.map((payment) => (
            <Card key={payment.id} className="border-amber-200 bg-amber-50/50">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  {/* School Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Building2 className="size-4 text-muted-foreground" />
                      <span className="font-semibold">{payment.school.name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <FileText className="size-3.5" />
                      <code className="text-xs">{payment.reference}</code>
                      <span>•</span>
                      <span>{formatDate(payment.createdAt)}</span>
                    </div>
                  </div>

                  {/* Plan Info */}
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm font-medium">{payment.plan.displayName}</p>
                      <p className="text-lg font-bold text-emerald-600">{formatCurrency(payment.amount)}</p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700"
                        onClick={() => handleVerify(payment.id, 'approve')}
                        disabled={processingId === payment.id}
                      >
                        {processingId === payment.id ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <CheckCircle className="size-4" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-red-200 text-red-600 hover:bg-red-50"
                        onClick={() => handleVerify(payment.id, 'reject')}
                        disabled={processingId === payment.id}
                      >
                        <XCircle className="size-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}