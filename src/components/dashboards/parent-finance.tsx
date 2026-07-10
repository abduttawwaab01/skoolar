'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';
import {
  Wallet, CreditCard, AlertTriangle, CheckCircle2, Clock, Download,
  Building2, Copy, Check, Upload, ExternalLink, Banknote,
} from 'lucide-react';
import { jsPDF } from 'jspdf';

interface ApiStudent {
  id: string;
  admissionNo: string;
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

interface SchoolBankDetails {
  bankName?: string | null;
  bankAccountName?: string | null;
  bankAccountNumber?: string | null;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(amount);
}

function generateReceipt(payment: ApiPayment, childName: string) {
  try {
    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 15;

    doc.setDrawColor(5, 150, 105);
    doc.setLineWidth(1.5);
    doc.rect(margin, margin, pageW - 2 * margin, pageH - 2 * margin);
    doc.setLineWidth(0.5);
    doc.rect(margin + 3, margin + 3, pageW - 2 * margin - 6, pageH - 2 * margin - 6);

    doc.setFontSize(18);
    doc.setTextColor(5, 150, 105);
    doc.text('PAYMENT RECEIPT', 105, 28, { align: 'center' });

    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(`Receipt No: ${payment.receiptNo || 'N/A'}`, pageW - margin - 5, 20, { align: 'right' });
    doc.text(`Date: ${new Date(payment.createdAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}`, pageW - margin - 5, 27, { align: 'right' });

    doc.setDrawColor(5, 150, 105);
    doc.setLineWidth(0.8);
    doc.line(margin + 5, 35, pageW - margin - 5, 35);

    doc.setFontSize(10);
    doc.setTextColor(5, 150, 105);
    doc.text('STUDENT INFORMATION', margin + 5, 44);

    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    doc.text(`Student Name: ${payment.student?.user?.name || childName || 'N/A'}`, margin + 5, 53);
    doc.text(`Admission No: ${payment.student?.admissionNo || 'N/A'}`, margin + 5, 61);
    doc.text(`Class: ${payment.student?.class?.name || 'N/A'}`, margin + 5, 69);

    doc.setFontSize(10);
    doc.setTextColor(5, 150, 105);
    doc.text('PAYMENT DETAILS', margin + 5, 82);

    (doc as any).autoTable({
      startY: 87,
      head: [['Description', 'Amount']],
      body: [
        ['Fee Payment', `NGN ${payment.amount.toLocaleString()}`],
      ],
      theme: 'grid',
      headStyles: { fillColor: [5, 150, 105], textColor: [255, 255, 255], fontSize: 9, fontStyle: 'bold' },
      bodyStyles: { fontSize: 9, textColor: [60, 60, 60] },
      columnStyles: { 0: { cellWidth: 120 }, 1: { cellWidth: 50, halign: 'right' } },
      foot: [['Total Paid', `NGN ${payment.amount.toLocaleString()}`]],
      footStyles: { fillColor: [240, 253, 244], textColor: [5, 150, 105], fontSize: 10, fontStyle: 'bold' },
    });

    const fy = (doc as any).lastAutoTable.finalY + 15;
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(`Payment Method: ${(payment.method || 'N/A').toUpperCase()}`, margin + 5, fy);
    doc.text(`Reference: ${payment.reference || 'N/A'}`, margin + 5, fy + 7);
    doc.text(`Status: ${payment.status === 'verified' ? 'PAID' : payment.status}`, margin + 5, fy + 14);

    doc.setFontSize(8);
    doc.setTextColor(180, 180, 180);
    doc.text('Thank you for your payment.', 105, fy + 30, { align: 'center' });
    doc.text('This is an electronically generated receipt.', 105, fy + 36, { align: 'center' });

    doc.save(`Receipt_${payment.receiptNo || payment.id}.pdf`);
    return true;
  } catch (e) {
    console.error('Receipt generation failed', e);
    return false;
  }
}

export function ParentFinance() {
  const { currentUser, selectedSchoolId } = useAppStore();
  const schoolId = currentUser.schoolId || selectedSchoolId || '';
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<ApiPayment[]>([]);
  const [feeStructures, setFeeStructures] = useState<ApiFeeStructure[]>([]);
  const [children, setChildren] = useState<ApiStudent[]>([]);
  const [bankDetails, setBankDetails] = useState<SchoolBankDetails | null>(null);
  const [schoolName, setSchoolName] = useState('');
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [evidenceDialogOpen, setEvidenceDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [evidenceNote, setEvidenceNote] = useState('');
  const [copiedField, setCopiedField] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        const [paymentsRes, feeRes, childrenRes, schoolRes] = await Promise.all([
          fetch(`/api/payments?schoolId=${schoolId}&limit=50`),
          fetch(`/api/fee-structure?schoolId=${schoolId}&limit=50`),
          fetch(`/api/parent/children?schoolId=${schoolId}`),
          fetch(`/api/schools?schoolId=${schoolId}`),
        ]);

        if (paymentsRes.ok) {
          const json = await paymentsRes.json();
          setPayments(json.data || json || []);
        }
        if (feeRes.ok) {
          const json = await feeRes.json();
          setFeeStructures(json.data?.records || json.data || json || []);
        }
        if (childrenRes.ok) {
          const json = await childrenRes.json();
          const childrenData: ApiStudent[] = json.data || [];
          setChildren(childrenData);
        }
        if (schoolRes.ok) {
          const json = await schoolRes.json();
          const schoolData = json.data?.[0] || json.data || json;
          if (schoolData) {
            setSchoolName(schoolData.name || '');
            setBankDetails({
              bankName: schoolData.bankName,
              bankAccountName: schoolData.bankAccountName,
              bankAccountNumber: schoolData.bankAccountNumber,
            });
          }
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

  const feeBreakdown = useMemo(() => {
    if (feeStructures.length === 0) return [];
    const totalFeeAmount = feeStructures.reduce((s, f) => s + f.amount, 0);
    const totalPaid = payments
      .filter(p => p.status === 'verified' || p.status === 'completed')
      .reduce((sum, p) => sum + p.amount, 0);
    return feeStructures.map(fs => {
      const ratio = totalFeeAmount > 0 ? Math.min(totalPaid / totalFeeAmount, 1) : 0;
      const paid = Math.round(fs.amount * ratio);
      return {
        item: fs.name,
        amount: fs.amount,
        paid,
        status: paid >= fs.amount ? 'paid' : paid > 0 ? 'partial' : 'unpaid' as const,
      };
    });
  }, [feeStructures, payments]);

  const totalFees = feeBreakdown.reduce((sum, f) => sum + f.amount, 0);
  const paidFees = feeBreakdown.filter(f => f.status === 'paid').reduce((sum, f) => sum + f.amount, 0);
  const outstanding = totalFees - paidFees;

  const handleCopy = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(''), 2000);
      toast.success('Copied!');
    } catch {
      toast.error('Failed to copy');
    }
  };

  const handleSubmitEvidence = async () => {
    if (!evidenceNote.trim()) {
      toast.error('Please provide a payment description');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId,
          studentId: children[0]?.id,
          amount: outstanding,
          method: 'bank-transfer',
          reference: `EVIDENCE-${Date.now()}`,
          status: 'pending_verification',
          paidBy: currentUser.name || 'Parent',
        }),
      });
      if (!res.ok) throw new Error('Failed to submit');
      toast.success('Payment evidence submitted! Awaiting verification.');
      setEvidenceDialogOpen(false);
      setEvidenceNote('');
    } catch {
      toast.error('Failed to submit evidence');
    } finally {
      setSubmitting(false);
    }
  };

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
          <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
            <DialogTrigger asChild>
              <Button disabled={outstanding <= 0}>
                <CreditCard className="size-4 mr-2" /> Pay ₦{outstanding.toLocaleString()}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Pay School Fees</DialogTitle>
                <DialogDescription>
                  Transfer the exact amount to the school&apos;s bank account below, then submit your payment evidence.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200">
                  <p className="text-sm font-semibold text-emerald-800 mb-2">Amount to Pay</p>
                  <p className="text-2xl font-bold text-emerald-700">{formatCurrency(outstanding)}</p>
                </div>
                {bankDetails?.bankName ? (
                  <div className="p-4 rounded-lg bg-blue-50 border border-blue-200 space-y-3">
                    <p className="text-sm font-semibold text-blue-800 flex items-center gap-2">
                      <Building2 className="size-4" /> School Bank Account
                    </p>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-blue-600">Bank:</span>
                        <span className="font-medium flex items-center gap-2">
                          {bankDetails.bankName}
                          <button onClick={() => handleCopy(bankDetails.bankName || '', 'bank')} className="text-blue-400 hover:text-blue-600">
                            {copiedField === 'bank' ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                          </button>
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-blue-600">Account Name:</span>
                        <span className="font-medium flex items-center gap-2">
                          {bankDetails.bankAccountName}
                          <button onClick={() => handleCopy(bankDetails.bankAccountName || '', 'acctName')} className="text-blue-400 hover:text-blue-600">
                            {copiedField === 'acctName' ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                          </button>
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-blue-600">Account Number:</span>
                        <span className="font-medium flex items-center gap-2">
                          {bankDetails.bankAccountNumber}
                          <button onClick={() => handleCopy(bankDetails.bankAccountNumber || '', 'acctNo')} className="text-blue-400 hover:text-blue-600">
                            {copiedField === 'acctNo' ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                          </button>
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-lg bg-amber-50 border border-amber-200">
                    <p className="text-sm text-amber-700">School bank details not yet configured. Please contact the school for payment instructions.</p>
                  </div>
                )}
                <Button className="w-full gap-2" onClick={() => { setPayDialogOpen(false); setEvidenceDialogOpen(true); }}>
                  <Upload className="size-4" /> I Have Made Payment
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={evidenceDialogOpen} onOpenChange={setEvidenceDialogOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Submit Payment Evidence</DialogTitle>
                <DialogDescription>
                  Tell us about your payment so we can verify it quickly.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                  <p className="text-xs text-emerald-700">Amount Paid</p>
                  <p className="text-lg font-bold text-emerald-600">{formatCurrency(outstanding)}</p>
                </div>
                <div className="space-y-2">
                  <Label>Payment Description</Label>
                  <Textarea
                    placeholder="Enter transaction reference, bank used, date of transfer, and any other details..."
                    value={evidenceNote}
                    onChange={(e) => setEvidenceNote(e.target.value)}
                    rows={4}
                  />
                  <p className="text-xs text-muted-foreground">Include: bank name, transaction reference, amount, date of transfer</p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEvidenceDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleSubmitEvidence} disabled={submitting}>
                  {submitting ? 'Submitting...' : 'Submit for Verification'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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

      {/* Bank Details Banner */}
      {bankDetails?.bankName && (
        <Card className="border-blue-200 bg-blue-50/30">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Building2 className="size-5 text-blue-600 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-blue-800">School Bank Account</p>
                <div className="flex flex-wrap gap-x-6 gap-y-1 mt-1 text-sm">
                  <span><span className="text-blue-500">Bank:</span> <span className="font-medium">{bankDetails.bankName}</span></span>
                  <span><span className="text-blue-500">Name:</span> <span className="font-medium">{bankDetails.bankAccountName}</span></span>
                  <span><span className="text-blue-500">Account:</span> <span className="font-medium">{bankDetails.bankAccountNumber}</span></span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Fee Breakdown */}
      {feeBreakdown.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Fee Breakdown — Current Term</CardTitle>
            <CardDescription>Itemized fee structure</CardDescription>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
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
      )}

      {/* No Fees Configured */}
      {feeBreakdown.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <Banknote className="size-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No fee structure configured yet</p>
            <p className="text-sm mt-1">Fee items will appear here once the school sets them up.</p>
          </CardContent>
        </Card>
      )}

      {/* Outstanding Alert */}
      {outstanding > 0 && feeBreakdown.length > 0 && (
        <Card className="border-amber-200 bg-gradient-to-r from-amber-50/50 to-transparent">
          <CardContent className="p-4 flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="size-5 text-amber-600" />
              <div>
                <p className="font-semibold text-amber-800">Outstanding Balance: ₦{outstanding.toLocaleString()}</p>
                <p className="text-sm text-amber-600">Please ensure all fees are paid before the deadline to avoid late charges.</p>
              </div>
            </div>
            <Button className="shrink-0" onClick={() => setPayDialogOpen(true)}>
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
          <div className="max-h-96 overflow-y-auto overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Receipt</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.length > 0 ? payments.map(payment => (
                  <TableRow key={payment.id}>
                    <TableCell className="font-medium">{payment.createdAt ? new Date(payment.createdAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono">{payment.receiptNo || payment.reference || '—'}</TableCell>
                    <TableCell>{payment.method || '—'}</TableCell>
                    <TableCell className="text-right font-semibold">₦{payment.amount.toLocaleString()}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={payment.status === 'verified' || payment.status === 'completed' ? 'default' : 'outline'} className={`text-xs ${payment.status === 'verified' || payment.status === 'completed' ? 'bg-emerald-600' : 'text-amber-600 border-amber-300'}`}>
                        {payment.status === 'verified' ? 'Paid' : payment.status === 'pending_verification' ? 'Pending' : payment.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {(payment.status === 'verified' || payment.status === 'completed') && (
                        <Button variant="ghost" size="sm" className="text-blue-600 h-7 text-xs" onClick={() => {
                          if (generateReceipt(payment, childName)) {
                            toast.success('Receipt downloaded');
                          } else {
                            toast.error('Failed to generate receipt');
                          }
                        }}>
                          <Download className="size-3 mr-1" /> PDF
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
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
