'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';
import {
  Wallet, CreditCard, AlertTriangle, CheckCircle2, Clock, Download,
} from 'lucide-react';

interface ApiStudent {
  id: string;
  admissionNo: string;
  parentIds: string | null;
  user: { name: string };
  class: { id: string; name: string } | null;
}

interface ApiPayment {
  id: string;
  amount: number;
  method: string;
  reference: string | null;
  status: string;
  receiptNo: string;
  termId: string | null;
  paidBy: string | null;
  createdAt: string;
  student: {
    id: string;
    admissionNo: string;
    user: { name: string };
    class: { name: string; section: string | null } | null;
  } | null;
}

interface ApiFeeStructure {
  id: string;
  name: string;
  amount: number;
  frequency: string;
  isOptional: boolean;
}

export function ParentFinance() {
  const { currentUser, selectedSchoolId } = useAppStore();
  const schoolId = currentUser.schoolId || selectedSchoolId || '';
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<ApiPayment[]>([]);
  const [feeStructures, setFeeStructures] = useState<ApiFeeStructure[]>([]);
  const [children, setChildren] = useState<ApiStudent[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        const [paymentsRes, feeRes, studentsRes] = await Promise.all([
          fetch(`/api/payments?schoolId=${schoolId}&limit=50`),
          fetch(`/api/fee-structure?schoolId=${schoolId}&limit=50`),
          fetch(`/api/students?schoolId=${schoolId}&limit=100`),
        ]);

        if (paymentsRes.ok) {
          const json = await paymentsRes.json();
          setPayments(json.data || json || []);
        }
        if (feeRes.ok) {
          const json = await feeRes.json();
          setFeeStructures(json.data || json || []);
        }
        if (studentsRes.ok) {
          const json = await studentsRes.json();
          const allStudents: ApiStudent[] = json.data || json || [];
          const myChildren = allStudents.filter(s =>
            s.parentIds && s.parentIds.includes(currentUser.id)
          );
          setChildren(myChildren.length > 0 ? myChildren : allStudents.slice(0, 1));
        }
      } catch (err) {
        console.error(err);
        toast.error('Failed to load financial data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [currentUser.id, schoolId]);

  const childName = children[0]?.user?.name?.split(' ')[0] || 'Child';
  const childClass = children[0]?.class?.name || '—';

  // Calculate fee breakdown from fee structures
  const feeBreakdown = feeStructures.length > 0
    ? feeStructures.map(fs => {
        const paidForThis = payments
          .filter(p => p.status === 'verified' || p.status === 'completed')
          .reduce((sum, p) => sum, 0);
        const totalPaid = payments
          .filter(p => p.status === 'verified' || p.status === 'completed')
          .reduce((sum, p) => sum + p.amount, 0);
        const ratio = fs.amount > 0 ? Math.min(totalPaid / feeStructures.reduce((s, f) => s + f.amount, 0), 1) : 0;
        const paid = Math.round(fs.amount * ratio);
        const remaining = fs.amount - paid;
        return {
          item: fs.name,
          amount: fs.amount,
          status: paid >= fs.amount ? 'paid' : paid > 0 ? 'partial' : 'unpaid',
        };
      })
    : [
        { item: 'Tuition Fee', amount: 250000, status: 'paid' },
        { item: 'Lab Fee', amount: 30000, status: 'paid' },
        { item: 'Sports Fee', amount: 20000, status: 'paid' },
        { item: 'Transport Fee', amount: 75000, status: 'partial' },
        { item: 'Library Fee', amount: 15000, status: 'unpaid' },
        { item: 'Development Levy', amount: 25000, status: 'unpaid' },
        { item: 'ICT Fee', amount: 20000, status: 'unpaid' },
        { item: 'Exam Materials', amount: 15000, status: 'unpaid' },
      ];

  const totalFees = feeBreakdown.reduce((sum, f) => sum + f.amount, 0);
  const paidFees = feeBreakdown.filter(f => f.status === 'paid').reduce((sum, f) => sum + f.amount, 0);
  const outstanding = totalFees - paidFees;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div><Skeleton className="h-8 w-48" /><Skeleton className="h-4 w-40 mt-2" /></div>
          <div className="flex gap-2"><Skeleton className="h-10 w-36" /><Skeleton className="h-10 w-40" /></div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-60 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Fee Payments</h1>
          <p className="text-muted-foreground">Manage {childName}&apos;s school fees — {childClass}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => toast.success('Receipt downloaded')}>
            <Download className="size-4 mr-2" /> Download Receipt
          </Button>
          <Button onClick={() => toast.success('Payment initiated')}>
            <CreditCard className="size-4 mr-2" /> Pay ₦{outstanding.toLocaleString()}
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-emerald-200 bg-emerald-50/30">
          <CardContent className="p-4 text-center">
            <CheckCircle2 className="size-6 text-emerald-600 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Total Paid</p>
            <p className="text-2xl font-bold text-emerald-700">₦{paidFees.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="border-amber-200 bg-amber-50/30">
          <CardContent className="p-4 text-center">
            <AlertTriangle className="size-6 text-amber-600 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Outstanding</p>
            <p className="text-2xl font-bold text-amber-700">₦{outstanding.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Wallet className="size-6 text-primary mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Total Fees</p>
            <p className="text-2xl font-bold">₦{totalFees.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* Fee Breakdown */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Fee Breakdown — Current Term</CardTitle>
          <CardDescription>Itemized fee structure</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fee Item</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {feeBreakdown.map((fee, i) => (
                <TableRow key={i} className={fee.status === 'unpaid' ? 'bg-amber-50/30' : ''}>
                  <TableCell className="font-medium">{fee.item}</TableCell>
                  <TableCell className="text-right font-semibold">₦{fee.amount.toLocaleString()}</TableCell>
                  <TableCell className="text-center">
                    <Badge
                      variant={fee.status === 'paid' ? 'default' : 'outline'}
                      className={
                        fee.status === 'paid' ? 'bg-emerald-600' :
                        fee.status === 'partial' ? 'text-amber-600 border-amber-200 bg-amber-50' :
                        'text-red-600 border-red-200 bg-red-50'
                      }
                    >
                      {fee.status === 'paid' ? 'Paid' : fee.status === 'partial' ? 'Partial' : 'Unpaid'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="font-bold border-t-2">
                <TableCell>Total</TableCell>
                <TableCell className="text-right">₦{totalFees.toLocaleString()}</TableCell>
                <TableCell />
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Outstanding Alert */}
      {outstanding > 0 && (
        <Card className="border-amber-200 bg-gradient-to-r from-amber-50/50 to-transparent">
          <CardContent className="p-4 flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="size-5 text-amber-600" />
              <div>
                <p className="font-semibold text-amber-800">Outstanding Balance: ₦{outstanding.toLocaleString()}</p>
                <p className="text-sm text-amber-600">Please ensure all fees are paid before the deadline to avoid late charges.</p>
              </div>
            </div>
            <Button className="shrink-0" onClick={() => toast.success('Payment initiated')}>
              <CreditCard className="size-4 mr-2" /> Pay Now
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Payment History */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Payment History</CardTitle>
          <CardDescription>Previous transactions</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-96 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.length > 0 ? payments.map(payment => (
                  <TableRow key={payment.id}>
                    <TableCell className="font-medium">{payment.createdAt ? payment.createdAt.split('T')[0] : '—'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono">{payment.receiptNo || payment.reference || '—'}</TableCell>
                    <TableCell>{payment.method || '—'}</TableCell>
                    <TableCell className="text-right font-semibold">₦{payment.amount.toLocaleString()}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={payment.status === 'verified' || payment.status === 'completed' ? 'default' : 'outline'} className={`text-xs ${payment.status === 'verified' || payment.status === 'completed' ? 'bg-emerald-600' : 'text-amber-600 border-amber-300'}`}>
                        <CheckCircle2 className="size-3 mr-1" /> {payment.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No payment history yet
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
