'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  CreditCard, Users, GraduationCap, CheckCircle, Clock, School, Star, Zap, Crown, ArrowRight, Info, X, Loader2, BookOpen, CheckCircle2, AlertCircle, Building2, Shield, Phone, MessageCircle, Search, Settings, Download,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';

interface Plan {
  id: string; name: string; displayName: string; price: number; pricingType: string;
  maxStudents: number; maxTeachers: number; maxClasses: number;
  features: string; isActive: boolean;
  pricing: Array<{ id: string; schoolType: string; monthlyPrice: number; termPrice: number; sessionPrice: number }>;
}

interface SchoolData {
  id: string; name: string; slug: string; email: string | null; phone: string | null;
  plan: string; planId: string | null; schoolType: string | null;
  maxStudents: number; maxTeachers: number; isActive: boolean;
  _count: { students: number; teachers: number; classes: number };
}

interface PaymentData {
  id: string; reference: string; amount: number; currency: string; channel: string | null;
  status: string; startDate: string; endDate: string; createdAt: string;
  schoolType: string | null; studentCount: number; duration: string | null;
  plan: { id: string; name: string; displayName: string; maxStudents: number; maxTeachers: number; maxClasses: number; features: string } | null;
  school: { id: string; name: string; slug: string; email: string | null; phone: string | null; schoolType: string | null } | null;
}

function formatDate(dateStr: string) {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}

function daysUntil(dateStr: string, nowOverride?: Date) {
  const target = new Date(dateStr);
  const d = nowOverride || new Date();
  return Math.ceil((target.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

function handleDownloadSubscriptionReceipt(payment: PaymentData) {
  try {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFontSize(20);
    doc.text('Skoolar', pageWidth / 2, 20, { align: 'center' });
    doc.setFontSize(13);
    doc.text('Payment Receipt', pageWidth / 2, 28, { align: 'center' });

    doc.setFontSize(9);
    doc.text(`Receipt #: ${payment.reference}`, 14, 40);
    doc.text(`Date Issued: ${formatDate(payment.createdAt)}`, pageWidth - 14, 40, { align: 'right' });

    doc.line(14, 44, pageWidth - 14, 44);

    const school = payment.school;
    const rows: Array<[string, string]> = [
      ['School', school?.name || 'N/A'],
      ['Plan', payment.plan?.displayName || 'N/A'],
      ['School Type', schoolTypeOptions.find((o) => o.value === (payment.schoolType || school?.schoolType || ''))?.label || payment.schoolType || 'N/A'],
      ['Duration', durationOptions.find((d) => d.value === payment.duration)?.label || payment.duration || 'N/A'],
      ['Students', String(payment.studentCount || '-')],
      ['Amount', formatCurrency(payment.amount)],
      ['Start Date', formatDate(payment.startDate)],
      ['End Date', formatDate(payment.endDate)],
      ['Status', statusConfig[payment.status]?.label || payment.status],
    ];

    autoTable(doc, {
      startY: 48,
      head: [['Field', 'Details']],
      body: rows,
      theme: 'grid',
      headStyles: { fillColor: [22, 163, 74], fontSize: 9 },
      styles: { fontSize: 9 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 }, 1: { cellWidth: 'auto' } },
    });

    const finalY = (doc as any).lastAutoTable.finalY || 80;
    doc.setFontSize(8);
    doc.text('Thank you for choosing Skoolar!', pageWidth / 2, finalY + 15, { align: 'center' });
    doc.text('This is a computer-generated receipt.', pageWidth / 2, finalY + 21, { align: 'center' });

    doc.save(`receipt-${payment.reference}.pdf`);
  } catch { toast.error('Failed to generate receipt'); }
}

const statusConfig: Record<string, { label: string; color: string }> = {
  success: { label: 'Active', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  pending: { label: 'Pending', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  failed: { label: 'Failed', color: 'bg-red-100 text-red-700 border-red-200' },
  pending_verification: { label: 'Awaiting Verification', color: 'bg-amber-100 text-amber-700 border-amber-200' },
};

const schoolTypeOptions = [
  { value: 'primary', label: 'Primary School' },
  { value: 'secondary', label: 'Secondary School' },
  { value: 'primary_secondary', label: 'Primary & Secondary' },
  { value: 'higher_institution', label: 'Higher Institution' },
];

const durationOptions = [
  { value: 'monthly', label: '1 Month' },
  { value: 'term', label: '4 Months (Per Term)' },
  { value: 'session', label: '10 Months (Per Session)' },
];

export function SubscriptionView() {
  const { currentUser, currentRole } = useAppStore();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => { setMounted(true); }, []);
  const now = mounted ? new Date() : undefined;

  const [school, setSchool] = React.useState<SchoolData | null>(null);
  const [plans, setPlans] = React.useState<Plan[]>([]);
  const [payment, setPayment] = React.useState<PaymentData | null>(null);
  const [allPayments, setAllPayments] = React.useState<PaymentData[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);

  const [selectedSchoolType, setSelectedSchoolType] = React.useState('');
  const [studentCount, setStudentCount] = React.useState(100);
  const [selectedPlanId, setSelectedPlanId] = React.useState('');
  const [selectedDuration, setSelectedDuration] = React.useState('term');

  const [showResult, setShowResult] = React.useState(false);
  const [resultData, setResultData] = React.useState<{
    payment: { id: string; reference: string; amount: number };
    bankDetails: { bankName?: string; accountNumber?: string; accountName?: string };
    whatsappUrl: string;
  } | null>(null);

  const isSuperAdmin = currentRole === 'SUPER_ADMIN';
  const schoolId = currentUser.schoolId;

  React.useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const [schoolRes, plansRes, paymentRes, allPayRes] = await Promise.all([
          fetch(`/api/schools?schoolId=${schoolId}`),
          fetch('/api/plans'),
          fetch(`/api/payments/subscribe?schoolId=${schoolId}`),
          schoolId ? fetch(`/api/subscription/requests?schoolId=${schoolId}`).then(r => r.json().catch(() => ({ data: [] }))) : Promise.resolve({ data: [] }),
        ]);

        const schoolJson = await schoolRes.json();
        const schoolData = schoolJson.data || [];
        if (schoolData.length > 0) {
          setSchool(schoolData[0]);
          setSelectedSchoolType(schoolData[0].schoolType || '');
        }

        const plansJson = await plansRes.json();
        setPlans(plansJson.data || plansJson || []);
        if (plansJson.data?.length > 0) {
          const paidPlans = plansJson.data.filter((p: Plan) => p.pricingType === 'per_student');
          if (paidPlans.length > 0) setSelectedPlanId(paidPlans[0].id);
        }

        const paymentJson = await paymentRes.json();
        if (paymentJson.data) setPayment(paymentJson.data);

        setAllPayments(allPayRes.data || []);
      } catch {
        toast.error('Failed to load subscription data');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [schoolId]);

  const currentPlan = React.useMemo(() => {
    if (payment?.plan) {
      return {
        name: payment.plan.displayName || payment.plan.name,
        id: payment.plan.id,
        maxStudents: payment.plan.maxStudents,
        maxTeachers: payment.plan.maxTeachers,
        maxClasses: payment.plan.maxClasses,
        endDate: payment.endDate,
        amount: payment.amount,
      };
    }
    if (school) {
      const plan = plans.find((p) => p.name === school.plan || p.id === school.planId);
      if (plan) {
        return {
          name: plan.displayName,
          id: plan.id,
          maxStudents: plan.maxStudents,
          maxTeachers: plan.maxTeachers,
          maxClasses: plan.maxClasses,
          endDate: null,
          amount: 0,
        };
      }
      return {
        name: school.plan || 'Free',
        id: school.planId || school.plan,
        maxStudents: school.maxStudents,
        maxTeachers: school.maxTeachers,
        maxClasses: -1,
        endDate: null,
        amount: 0,
      };
    }
    return null;
  }, [school, payment, plans]);

  const daysLeft = payment?.endDate ? daysUntil(payment.endDate, now) : null;
  const isExpiringSoon = daysLeft !== null && daysLeft <= 14 && daysLeft > 0;
  const isExpired = daysLeft !== null && daysLeft <= 0;
  const isFree = !payment?.plan || payment.plan.name === 'free';

  const pendingRequest = React.useMemo(() => {
    return allPayments.find((p) => p.status === 'pending' || p.status === 'pending_verification');
  }, [allPayments]);

  const calculatedAmount = React.useMemo(() => {
    if (!selectedPlanId || !selectedSchoolType || !selectedDuration) return null;
    const plan = plans.find((p) => p.id === selectedPlanId);
    if (!plan) return null;
    const pricing = plan.pricing?.find((pr) => pr.schoolType === selectedSchoolType);
    if (!pricing) return null;
    const pricePerStudent = selectedDuration === 'monthly' ? pricing.monthlyPrice : selectedDuration === 'term' ? pricing.termPrice : pricing.sessionPrice;
    return pricePerStudent * studentCount;
  }, [selectedPlanId, selectedSchoolType, selectedDuration, studentCount, plans]);

  const pricingInfo = React.useMemo(() => {
    if (!selectedPlanId || !selectedSchoolType) return null;
    const plan = plans.find((p) => p.id === selectedPlanId);
    if (!plan) return null;
    return plan.pricing?.find((pr) => pr.schoolType === selectedSchoolType) || null;
  }, [selectedPlanId, selectedSchoolType, plans]);

  const handleSubmitRequest = async () => {
    if (!selectedSchoolType) { toast.error('Please select a school type'); return; }
    if (studentCount < 1) { toast.error('Please enter a valid student count'); return; }
    if (!selectedPlanId) { toast.error('Please select a plan'); return; }
    if (!selectedDuration) { toast.error('Please select a duration'); return; }

    setSubmitting(true);
    try {
      const res = await fetch('/api/subscription/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: selectedPlanId,
          schoolType: selectedSchoolType,
          studentCount,
          duration: selectedDuration,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setResultData(json.data);
        setShowResult(true);
        toast.success('Request submitted! Follow the payment instructions below.');
      } else {
        toast.error(json.error || 'Failed to submit request');
      }
    } catch {
      toast.error('Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-7 w-48 mb-1" />
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-36 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Dialog open={showResult} onOpenChange={setShowResult}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Payment Instructions</DialogTitle>
            <DialogDescription>Complete your payment to activate the subscription.</DialogDescription>
          </DialogHeader>
          {resultData && (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="size-5 text-emerald-600" />
                  <p className="font-semibold text-emerald-800">Request Submitted!</p>
                </div>
                <p className="text-sm text-emerald-700">
                  Reference: <code className="bg-emerald-100 px-1.5 py-0.5 rounded text-xs">{resultData.payment.reference}</code>
                </p>
                <p className="text-lg font-bold text-emerald-700 mt-1">
                  Amount: {formatCurrency(resultData.payment.amount)}
                </p>
              </div>
              <div className="p-4 bg-blue-50 rounded-lg space-y-2">
                <p className="text-sm font-medium text-blue-900">Bank Transfer Details</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="text-blue-600">Bank Name:</span>
                  <span className="font-medium">{resultData.bankDetails.bankName || 'PalmPay'}</span>
                  <span className="text-blue-600">Account Number:</span>
                  <span className="font-medium">{resultData.bankDetails.accountNumber || '9033460322'}</span>
                  <span className="text-blue-600">Account Name:</span>
                  <span className="font-medium">{resultData.bankDetails.accountName || 'Skoolar'}</span>
                  <span className="text-blue-600">Amount:</span>
                  <span className="font-bold text-lg">{formatCurrency(resultData.payment.amount)}</span>
                </div>
              </div>
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <p className="text-sm font-medium text-green-800 mb-2">After Payment</p>
                <p className="text-sm text-green-700 mb-3">Send a WhatsApp message with your payment details for verification.</p>
                <Button className="w-full gap-2 bg-green-600 hover:bg-green-700" onClick={() => window.open(resultData.whatsappUrl, '_blank')}>
                  <MessageCircle className="size-4" />
                  Verify via WhatsApp
                </Button>
              </div>
              <p className="text-xs text-muted-foreground text-center">Your plan will be activated after the Super Admin verifies your payment.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Subscription & Billing</h2>
          <p className="text-sm text-muted-foreground">Manage your school plan and subscription</p>
        </div>
        <Badge variant="outline" className="w-fit gap-1.5">
          <School className="size-3.5" />
          {school?.name || currentUser.schoolName}
        </Badge>
      </div>

      {isExpired && !isSuperAdmin && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex size-12 items-center justify-center rounded-xl bg-red-100 shrink-0">
                <AlertCircle className="size-6 text-red-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-red-900">Your Subscription Has Expired</h3>
                <p className="text-sm text-red-700 mt-0.5">
                  Your school subscription expired on {payment?.endDate ? formatDate(payment.endDate) : 'N/A'}.
                  Please upgrade to restore access for all users.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {isExpiringSoon && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="size-5 text-amber-600 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-800">
                  Your subscription expires in {daysLeft} day{daysLeft !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {isFree && !isExpired && !isSuperAdmin && (
        <Card className="border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center gap-4">
              <div className="flex size-12 items-center justify-center rounded-xl bg-emerald-100 shrink-0">
                <Zap className="size-6 text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-emerald-900">You&apos;re on the Free Plan</h3>
                <p className="text-sm text-emerald-700 mt-0.5">Upgrade to unlock unlimited students, teachers, classes, and premium features.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {currentPlan && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-xl bg-emerald-100">
                <CreditCard className="size-5 text-emerald-600" />
              </div>
              <div>
                <CardTitle className="text-base">Current Plan: {currentPlan.name}</CardTitle>
                <CardDescription>
                  {!isExpired ? (
                    <span className="flex items-center gap-1.5 text-emerald-600">
                      <CheckCircle2 className="size-3.5" /> Active
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-red-500">
                      <Clock className="size-3.5" /> Expired
                    </span>
                  )}
                  {payment?.endDate && ' \u00B7 ' + (isExpired ? 'Expired' : 'Expires') + ' ' + formatDate(payment.endDate)}
                  {school?.schoolType && ' \u00B7 ' + (schoolTypeOptions.find(o => o.value === school.schoolType)?.label || school.schoolType)}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Users className="size-4 text-blue-600 shrink-0" />
                <div>
                  <p className="text-[11px] text-muted-foreground">Students</p>
                  <p className="text-sm font-semibold">{school?._count.students || 0} / {currentPlan.maxStudents === -1 ? '\u221E' : currentPlan.maxStudents}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <GraduationCap className="size-4 text-violet-600 shrink-0" />
                <div>
                  <p className="text-[11px] text-muted-foreground">Teachers</p>
                  <p className="text-sm font-semibold">{school?._count.teachers || 0} / {currentPlan.maxTeachers === -1 ? '\u221E' : currentPlan.maxTeachers}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <BookOpen className="size-4 text-amber-600 shrink-0" />
                <div>
                  <p className="text-[11px] text-muted-foreground">Classes</p>
                  <p className="text-sm font-semibold">{school?._count.classes || 0} / {currentPlan.maxClasses === -1 ? '\u221E' : currentPlan.maxClasses}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Building2 className="size-4 text-emerald-600 shrink-0" />
                <div>
                  <p className="text-[11px] text-muted-foreground">School Type</p>
                  <p className="text-sm font-semibold">{school?.schoolType ? (schoolTypeOptions.find(o => o.value === school.schoolType)?.label || school.schoolType) : 'Not set'}</p>
                </div>
              </div>
            </div>
            {payment && payment.studentCount > 0 && (
              <div className="mt-3 text-xs text-muted-foreground">
                Subscribed for {payment.studentCount} student{payment.studentCount !== 1 ? 's' : ''}
                {payment.duration && ' \u00B7 ' + (durationOptions.find(d => d.value === payment.duration)?.label || payment.duration + ' months')}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {pendingRequest && !isSuperAdmin && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Clock className="size-5 text-amber-600 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-800">Upgrade Request Pending</p>
                <p className="text-xs text-amber-600 mt-0.5">
                  Your upgrade request for {pendingRequest.plan?.displayName || 'a plan'} ({formatCurrency(pendingRequest.amount || 0)}) is awaiting Super Admin approval.
                  Please ensure you&apos;ve paid and sent a WhatsApp verification.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!isSuperAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{isExpired ? 'Renew Your Subscription' : 'Upgrade Your Plan'}</CardTitle>
            <CardDescription>
              {isExpired ? 'Your subscription has expired. Select a new plan to restore access.' : 'Choose your preferred plan and options below.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>School Type</Label>
                <Select value={selectedSchoolType} onValueChange={setSelectedSchoolType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select school type" />
                  </SelectTrigger>
                  <SelectContent>
                    {schoolTypeOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Number of Students</Label>
                <Input type="number" min={1} value={studentCount} onChange={(e) => setStudentCount(Math.max(1, parseInt(e.target.value) || 1))} />
              </div>
              <div className="space-y-2">
                <Label>Plan</Label>
                <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select plan" />
                  </SelectTrigger>
                  <SelectContent>
                    {plans.filter((p) => p.pricingType === 'per_student' && p.isActive).map((plan) => (
                      <SelectItem key={plan.id} value={plan.id}>{plan.displayName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Duration</Label>
                <Select value={selectedDuration} onValueChange={setSelectedDuration}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select duration" />
                  </SelectTrigger>
                  <SelectContent>
                    {durationOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {pricingInfo && selectedSchoolType && (
              <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                <p className="text-sm font-medium mb-2">Pricing Breakdown</p>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div className="text-center p-2 rounded bg-background">
                    <p className="text-muted-foreground text-xs">Per Student</p>
                    <p className="font-semibold">{formatCurrency(pricingInfo.monthlyPrice)}/mo</p>
                  </div>
                  <div className="text-center p-2 rounded bg-background">
                    <p className="text-muted-foreground text-xs">Per Term</p>
                    <p className="font-semibold">{formatCurrency(pricingInfo.termPrice)}</p>
                  </div>
                  <div className="text-center p-2 rounded bg-background">
                    <p className="text-muted-foreground text-xs">Per Session</p>
                    <p className="font-semibold">{formatCurrency(pricingInfo.sessionPrice)}</p>
                  </div>
                </div>
              </div>
            )}

            {calculatedAmount !== null && (
              <div className="mt-4 p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-emerald-900">Total Amount</p>
                    <p className="text-xs text-emerald-700">
                      {(() => { const unitPrice = pricingInfo ? (selectedDuration === 'monthly' ? pricingInfo.monthlyPrice : selectedDuration === 'term' ? pricingInfo.termPrice : pricingInfo.sessionPrice) : 0; return formatCurrency(unitPrice); })()}
                      /student \u00D7 {studentCount} student{studentCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <p className="text-2xl font-bold text-emerald-600">{formatCurrency(calculatedAmount)}</p>
                </div>
              </div>
            )}

            <Button className="w-full mt-4 gap-2" size="lg" onClick={handleSubmitRequest}
              disabled={submitting || !selectedSchoolType || !selectedPlanId || !selectedDuration || studentCount < 1}>
              {submitting ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
              {submitting ? 'Submitting...' : isExpired ? 'Renew Now' : 'Submit Upgrade Request'}
            </Button>
          </CardContent>
        </Card>
      )}

      {allPayments.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Request History</CardTitle>
                <CardDescription>Your subscription requests and payments</CardDescription>
              </div>
              <CreditCard className="size-5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 font-medium text-muted-foreground text-xs">Date</th>
                    <th className="pb-3 font-medium text-muted-foreground text-xs">Plan</th>
                    <th className="pb-3 font-medium text-muted-foreground text-xs">Amount</th>
                    <th className="pb-3 font-medium text-muted-foreground text-xs">Duration</th>
                    <th className="pb-3 font-medium text-muted-foreground text-xs">Students</th>
                    <th className="pb-3 font-medium text-muted-foreground text-xs">Status</th>
                    <th className="pb-3 font-medium text-muted-foreground text-xs">Period</th>
                    <th className="pb-3 font-medium text-muted-foreground text-xs">Receipt</th>
                  </tr>
                </thead>
                <tbody>
                  {allPayments.map((p) => (
                    <tr key={p.id} className="border-b last:border-0">
                      <td className="py-3">{formatDate(p.createdAt)}</td>
                      <td className="py-3 font-medium">{p.plan?.displayName || 'N/A'}</td>
                      <td className="py-3 font-semibold">{formatCurrency(p.amount)}</td>
                      <td className="py-3">{durationOptions.find(d => d.value === p.duration)?.label || p.duration || 'N/A'}</td>
                      <td className="py-3">{p.studentCount || '-'}</td>
                      <td className="py-3">
                        <Badge className={cn('text-[10px] border', statusConfig[p.status]?.color || 'bg-gray-100 text-gray-600')}>
                          {statusConfig[p.status]?.label || p.status}
                        </Badge>
                      </td>
                      <td className="py-3 text-xs text-muted-foreground">
                        {formatDate(p.startDate)} -- {formatDate(p.endDate)}
                      </td>
                      <td className="py-3 text-center">
                        {p.status === 'success' ? (
                          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => handleDownloadSubscriptionReceipt(p)}>
                            <Download className="size-3" /> PDF
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">--</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {isSuperAdmin && (
        <div className="space-y-6">
          <Separator />
          <h3 className="text-lg font-semibold">Super Admin Controls</h3>
          <SubscriptionRequestsManager />
          <ExpiredSchoolsView />
          <PlanPricingManager />
        </div>
      )}
    </div>
  );
}

// --- Super Admin: All Subscription Requests ---
function SubscriptionRequestsManager() {
  const [requests, setRequests] = React.useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = React.useState(true);
  const [processingId, setProcessingId] = React.useState<string | null>(null);
  const [statusFilter, setStatusFilter] = React.useState<string>('all');
  const [approveDialogTarget, setApproveDialogTarget] = React.useState<string | null>(null);
  const [approveEndDate, setApproveEndDate] = React.useState('');

  const fetchRequests = React.useCallback(async () => {
    try {
      setLoading(true);
      const statusParam = statusFilter !== 'all' ? `?status=${statusFilter}` : '';
      const res = await fetch(`/api/subscription/requests${statusParam}`);
      const json = await res.json();
      setRequests(json.data || []);
    } catch { toast.error('Failed to load requests'); }
    finally { setLoading(false); }
  }, [statusFilter]);

  React.useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const handleApprove = async (id: string, endDate?: string) => {
    setProcessingId(id);
    try {
      const body: Record<string, unknown> = { action: 'approve' };
      if (endDate && endDate.trim()) body.endDate = endDate.trim();
      const res = await fetch(`/api/subscription/requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (res.ok) { toast.success(json.message); fetchRequests(); }
      else toast.error(json.error);
    } catch { toast.error('Failed to approve'); }
    finally { setProcessingId(null); }
  };

  const handleReject = async (id: string) => {
    setProcessingId(id);
    try {
      const res = await fetch(`/api/subscription/requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject' }),
      });
      const json = await res.json();
      if (res.ok) { toast.success(json.message); fetchRequests(); }
      else toast.error(json.error);
    } catch { toast.error('Failed to reject'); }
    finally { setProcessingId(null); }
  };

  const filterOptions = [
    { value: 'all', label: 'All' },
    { value: 'pending', label: 'Pending' },
    { value: 'pending_verification', label: 'Awaiting Verification' },
    { value: 'success', label: 'Active' },
    { value: 'failed', label: 'Failed' },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-lg bg-amber-100">
            <Clock className="size-5 text-amber-600" />
          </div>
          <div>
            <CardTitle className="text-base">Subscription Requests</CardTitle>
            <CardDescription>Review, approve, reject requests and download receipts</CardDescription>
          </div>
        </div>
        <div className="mt-3 flex gap-2 flex-wrap">
          {filterOptions.map((opt) => (
            <Button
              key={opt.value}
              size="sm"
              variant={statusFilter === opt.value ? 'default' : 'outline'}
              className="h-7 text-xs"
              onClick={() => setStatusFilter(opt.value)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
        ) : requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <CheckCircle className="size-10 text-emerald-500 mb-2" />
            <p className="text-sm font-medium">No requests found</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs">School</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs hidden md:table-cell">Type</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs">Plan</th>
                  <th className="text-center py-3 px-4 font-medium text-muted-foreground text-xs">Students</th>
                  <th className="text-center py-3 px-4 font-medium text-muted-foreground text-xs hidden sm:table-cell">Duration</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground text-xs">Amount</th>
                  <th className="text-center py-3 px-4 font-medium text-muted-foreground text-xs hidden sm:table-cell">Status</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground text-xs">Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((req) => {
                  const school = (req.school || {}) as Record<string, unknown>;
                  const plan = (req.plan || {}) as Record<string, unknown>;
                  const id = req.id as string;
                  const isProcessing = processingId === id;
                  const reqStatus = req.status as string;
                  const reqAmount = req.amount as number;
                  return (
                    <tr key={id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="py-3 px-4">
                        <p className="font-medium text-xs">{school.name as string}</p>
                        <p className="text-[10px] text-muted-foreground">{school.email as string || ''}</p>
                      </td>
                      <td className="py-3 px-4 hidden md:table-cell text-xs">
                        {schoolTypeOptions.find(o => o.value === (req.schoolType as string))?.label || (req.schoolType as string) || '-'}
                      </td>
                      <td className="py-3 px-4 text-xs">{plan.displayName as string || plan.name as string}</td>
                      <td className="py-3 px-4 text-center text-xs">{(req.studentCount as number) || '-'}</td>
                      <td className="py-3 px-4 text-center hidden sm:table-cell text-xs">
                        {durationOptions.find(d => d.value === (req.duration as string))?.label || (req.duration as string) || '-'}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-xs">{formatCurrency(reqAmount)}</td>
                      <td className="py-3 px-4 text-center hidden sm:table-cell">
                        <Badge className={cn('text-[10px] border', statusConfig[reqStatus]?.color || 'bg-gray-100 text-gray-600')}>
                          {statusConfig[reqStatus]?.label || reqStatus}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {reqStatus === 'success' ? (
                            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => {
                              handleDownloadSubscriptionReceipt(req as unknown as PaymentData);
                            }}>
                              <Download className="size-3" /> PDF
                            </Button>
                          ) : (
                            <>
                              <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700" onClick={() => { setApproveDialogTarget(id); setApproveEndDate(''); }} disabled={isProcessing}>
                                {isProcessing ? <Loader2 className="size-3 animate-spin" /> : <CheckCircle className="size-3" />}
                              </Button>
                              <Button size="sm" variant="outline" className="h-7 text-xs border-red-200 text-red-600 hover:bg-red-50" onClick={() => handleReject(id)} disabled={isProcessing}>
                                <X className="size-3" />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      {approveDialogTarget && (
        <Dialog open={true} onOpenChange={(v) => { if (!v) setApproveDialogTarget(null); }}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Approve Request</DialogTitle>
              <DialogDescription>Set expiration date or leave blank for auto-calculated.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid gap-2">
                <Label>Expiration Date (optional)</Label>
                <Input type="date" value={approveEndDate} onChange={e => setApproveEndDate(e.target.value)} />
              </div>
              <p className="text-xs text-muted-foreground">Leave blank to automatically calculate based on duration.</p>
            </div>
            <div className="flex justify-end gap-2 mt-2">
              <Button variant="outline" size="sm" onClick={() => setApproveDialogTarget(null)}>Cancel</Button>
              <Button size="sm" onClick={async () => { await handleApprove(approveDialogTarget, approveEndDate); setApproveDialogTarget(null); }}>
                Confirm Approve
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}

// --- Super Admin: Expired Schools ---
function UpgradeDialog({
  open,
  onOpenChange,
  schoolId,
  schoolName,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  schoolId: string;
  schoolName: string;
  onSuccess: (id: string) => void;
}) {
  const [plans, setPlans] = React.useState<{ id: string; name: string; displayName: string }[]>([]);
  const [planId, setPlanId] = React.useState('');
  const [duration, setDuration] = React.useState('term');
  const [customEndDate, setCustomEndDate] = React.useState('');
  const [useCustomDate, setUseCustomDate] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [durationMode, setDurationMode] = React.useState<'duration' | 'customDate' | 'days'>('duration');
  const [upgradeDays, setUpgradeDays] = React.useState(30);

  React.useEffect(() => {
    if (!open) return;
    fetch('/api/plans?isActive=true')
      .then(r => r.json())
      .then(json => {
        if (json.data) {
          setPlans(json.data.map((p: { id: string; name: string; displayName: string }) => ({ id: p.id, name: p.name, displayName: p.displayName })));
          const defaultPlan = json.data.find((p: { name: string }) => p.name === 'pro');
          setPlanId(defaultPlan?.id || json.data[0]?.id || '');
        }
      })
      .catch(() => {});
    setDuration('term');
    setCustomEndDate('');
    setUseCustomDate(false);
    setDurationMode('duration');
    setUpgradeDays(30);
  }, [open]);

  const handleSubmit = async () => {
    if (!planId) { toast.error('Please select a plan'); return; }
    if (durationMode === 'customDate' && !customEndDate) { toast.error('Please set an expiration date'); return; }
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = { schoolId, planId };
      if (durationMode === 'customDate') {
        body.endDate = customEndDate;
      } else if (durationMode === 'days') {
        body.days = upgradeDays;
      } else {
        body.duration = duration;
      }
      const res = await fetch('/api/subscription/manual-upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.success) { toast.success(json.message); onSuccess(schoolId); onOpenChange(false); }
      else toast.error(json.error);
    } catch { toast.error('Failed to upgrade'); }
    finally { setSubmitting(false); }
  };

  const computedEndDate = React.useMemo(() => {
    if (durationMode === 'customDate') return customEndDate || 'Not set';
    if (durationMode === 'days') {
      const d = new Date();
      d.setDate(d.getDate() + upgradeDays);
      return d.toISOString().split('T')[0];
    }
    const months: Record<string, number> = { monthly: 1, term: 4, session: 10 };
    const d = new Date();
    d.setMonth(d.getMonth() + (months[duration] || 4));
    return d.toISOString().split('T')[0];
  }, [duration, durationMode, customEndDate, upgradeDays]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upgrade &quot;{schoolName}&quot;</DialogTitle>
          <DialogDescription>Select a plan and duration for the upgrade.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Plan</Label>
            <Select value={planId} onValueChange={setPlanId}>
              <SelectTrigger><SelectValue placeholder="Select plan" /></SelectTrigger>
              <SelectContent>
                {plans.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.displayName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            {(['duration', 'customDate', 'days'] as const).map(opt => (
              <Button key={opt} variant={durationMode === opt ? 'default' : 'outline'} size="sm" className="flex-1 text-xs" onClick={() => setDurationMode(opt)}>
                {opt === 'duration' ? 'Standard' : opt === 'customDate' ? 'End Date' : 'Days'}
              </Button>
            ))}
          </div>
          {durationMode === 'customDate' ? (
            <div className="grid gap-2">
              <Label>Expiration Date</Label>
              <Input type="date" value={customEndDate} onChange={e => setCustomEndDate(e.target.value)} />
            </div>
          ) : durationMode === 'days' ? (
            <div className="grid gap-2">
              <Label>Number of Days</Label>
              <div className="flex gap-2">
                {[7, 14, 30, 60, 90].map(d => (
                  <Button key={d} variant={upgradeDays === d ? 'default' : 'outline'} size="sm" onClick={() => setUpgradeDays(d)} className="flex-1 text-xs">{d}d</Button>
                ))}
              </div>
              <Input type="number" value={upgradeDays} onChange={e => setUpgradeDays(parseInt(e.target.value) || 30)} min={1} className="mt-1" />
            </div>
          ) : (
            <div className="grid gap-2">
              <Label>Duration</Label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly (1 month)</SelectItem>
                  <SelectItem value="term">Term (4 months)</SelectItem>
                  <SelectItem value="session">Session (10 months)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="rounded-lg bg-muted p-3 text-sm">
            <span className="font-medium">End date:</span> {computedEndDate}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting}>{submitting ? 'Upgrading...' : 'Upgrade'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ExpiredSchoolsView() {
  const [schools, setSchools] = React.useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [upgradeTarget, setUpgradeTarget] = React.useState<{ schoolId: string; schoolName: string } | null>(null);

  React.useEffect(() => {
    async function fetchExpired() {
      try {
        setLoading(true);
        const res = await fetch('/api/subscription/expired-schools');
        const json = await res.json();
        setSchools(json.data || []);
      } catch { toast.error('Failed to load expired schools'); }
      finally { setLoading(false); }
    }
    fetchExpired();
  }, []);

  const filtered = React.useMemo(() => {
    if (!search.trim()) return schools;
    const q = search.toLowerCase();
    return schools.filter((s) => {
      const school = (s.school || {}) as Record<string, unknown>;
      return (school.name as string || '').toLowerCase().includes(q);
    });
  }, [schools, search]);

  const handleUpgradeSuccess = (schoolId: string) => {
    setSchools(prev => prev.filter(s => (s.school as Record<string, unknown>)?.id !== schoolId));
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-lg bg-red-100">
            <AlertCircle className="size-5 text-red-600" />
          </div>
          <div>
            <CardTitle className="text-base">Expired Schools</CardTitle>
            <CardDescription>Schools with expired subscriptions</CardDescription>
          </div>
        </div>
        <div className="mt-3 relative max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search schools..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <CheckCircle className="size-10 text-emerald-500 mb-2" />
            <p className="text-sm font-medium">No expired schools</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs">School</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs hidden md:table-cell">Type</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs">Plan</th>
                  <th className="text-center py-3 px-4 font-medium text-muted-foreground text-xs">Expired</th>
                  <th className="text-center py-3 px-4 font-medium text-muted-foreground text-xs hidden sm:table-cell">Days Ago</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground text-xs">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry) => {
                  const school = (entry.school || {}) as Record<string, unknown>;
                  const plan = (entry.plan || {}) as Record<string, unknown>;
                  const schoolId = (school.id || entry.schoolId) as string;
                  return (
                    <tr key={entry.id as string} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="py-3 px-4">
                        <p className="font-medium text-xs">{school.name as string}</p>
                        <p className="text-[10px] text-muted-foreground">{school.email as string || school.phone as string || ''}</p>
                      </td>
                      <td className="py-3 px-4 hidden md:table-cell text-xs">
                        {schoolTypeOptions.find(o => o.value === (school.schoolType as string))?.label || (school.schoolType as string) || '-'}
                      </td>
                      <td className="py-3 px-4 text-xs">{plan.displayName as string || plan.name as string}</td>
                      <td className="py-3 px-4 text-center text-xs">{entry.expiredAt ? formatDate(entry.expiredAt as string) : 'N/A'}</td>
                      <td className="py-3 px-4 text-center hidden sm:table-cell text-xs">
                        <Badge variant="outline" className="text-red-600 border-red-200">{(entry.daysSinceExpiry as number) || 0}d</Badge>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button size="sm" className="h-7 text-xs" onClick={() => setUpgradeTarget({ schoolId, schoolName: school.name as string })}>
                          <Zap className="size-3 mr-1" /> Upgrade
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <UpgradeDialog
        open={!!upgradeTarget}
        onOpenChange={(v) => { if (!v) setUpgradeTarget(null); }}
        schoolId={upgradeTarget?.schoolId || ''}
        schoolName={upgradeTarget?.schoolName || ''}
        onSuccess={handleUpgradeSuccess}
      />
    </Card>
  );
}

// --- Super Admin: Plan Pricing Editor ---
function PlanPricingManager() {
  const [pricingRecords, setPricingRecords] = React.useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = React.useState(true);
  const [savingId, setSavingId] = React.useState<string | null>(null);
  const [editValues, setEditValues] = React.useState<Record<string, Record<string, number>>>({});

  React.useEffect(() => {
    async function fetchPricing() {
      try {
        setLoading(true);
        const res = await fetch('/api/subscription/pricing');
        const json = await res.json();
        setPricingRecords(json.data || []);
      } catch { toast.error('Failed to load pricing'); }
      finally { setLoading(false); }
    }
    fetchPricing();
  }, []);

  const handleFieldChange = (id: string, field: 'monthlyPrice' | 'termPrice' | 'sessionPrice', value: number) => {
    setEditValues((prev) => ({
      ...prev,
      [id]: { ...(prev[id] || {}), [field]: value },
    }));
  };

  const handleSave = async (id: string) => {
    setSavingId(id);
    try {
      const updates = editValues[id];
      if (!updates) { toast.error('No changes'); return; }
      const res = await fetch('/api/subscription/pricing', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...updates }),
      });
      const json = await res.json();
      if (res.ok) {
        toast.success(json.message);
        setPricingRecords((prev) => prev.map((p) => (p.id === id ? { ...p, ...json.data } : p)));
        setEditValues((prev) => { const c = { ...prev }; delete c[id]; return c; });
      } else toast.error(json.error);
    } catch { toast.error('Failed to save'); }
    finally { setSavingId(null); }
  };

  const getFieldValue = (record: Record<string, unknown>, field: string) => {
    return editValues[record.id as string]?.[field] ?? record[field] as number;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-lg bg-blue-100">
            <Settings className="size-5 text-blue-600" />
          </div>
          <div>
            <CardTitle className="text-base">Plan Pricing</CardTitle>
            <CardDescription>Manage per-student pricing for each plan and school type</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>
        ) : pricingRecords.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No pricing records found.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs">Plan</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs">School Type</th>
                  <th className="text-center py-3 px-4 font-medium text-muted-foreground text-xs">Monthly (per student)</th>
                  <th className="text-center py-3 px-4 font-medium text-muted-foreground text-xs">Term (per student)</th>
                  <th className="text-center py-3 px-4 font-medium text-muted-foreground text-xs">Session (per student)</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground text-xs">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pricingRecords.map((record) => {
                  const id = record.id as string;
                  const plan = (record.plan || {}) as Record<string, unknown>;
                  const isSaving = savingId === id;
                  const hasChanges = !!editValues[id];
                  return (
                    <tr key={id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="py-3 px-4 text-xs font-medium">{plan.displayName as string || plan.name as string}</td>
                      <td className="py-3 px-4 text-xs">
                        {schoolTypeOptions.find(o => o.value === (record.schoolType as string))?.label || (record.schoolType as string)}
                      </td>
                      {(['monthlyPrice', 'termPrice', 'sessionPrice'] as const).map((field) => (
                        <td key={field} className="py-3 px-4 text-center">
                          <input
                            type="number"
                            className="w-20 text-center text-xs py-1 px-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={getFieldValue(record, field)}
                            onChange={(e) => handleFieldChange(id, field, Math.max(0, parseInt(e.target.value) || 0))}
                          />
                        </td>
                      ))}
                      <td className="py-3 px-4 text-right">
                        <Button size="sm" className="h-7 text-xs" onClick={() => handleSave(id)} disabled={isSaving || !hasChanges}>
                          {isSaving ? <Loader2 className="size-3 animate-spin" /> : <CheckCircle className="size-3" />}
                          {isSaving ? ' Saving...' : ' Save'}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
