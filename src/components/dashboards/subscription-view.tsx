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
  CreditCard,
  Users,
  GraduationCap,
  CheckCircle,
  Clock,
  ChevronDown,
  Shield,
  School,
  Star,
  Zap,
  Crown,
  ArrowRight,
  Info,
  X,
  Settings,
  AlertCircle,
  Loader2,
  BookOpen,
  CheckCircle2,
} from 'lucide-react';

// --- Types ---
interface Plan {
  id: string;
  name: string;
  displayName: string;
  price: number;
  priceDisplay?: string;
  yearlyPrice: number | null;
  maxStudents: number;
  maxTeachers: number;
  maxClasses: number;
  features: string;
  isActive: boolean;
  paystackPlanCode: string | null;
}

interface SchoolData {
  id: string;
  name: string;
  planId: string | null;
  plan: string;
  maxStudents: number;
  maxTeachers: number;
  isActive: boolean;
  email: string | null;
  _count: {
    students: number;
    teachers: number;
    classes: number;
  };
}

interface PaymentData {
  id: string;
  schoolId: string;
  planId: string;
  reference: string;
  amount: number;
  currency: string;
  channel: string | null;
  status: string;
  startDate: string;
  endDate: string;
  createdAt: string;
  isActive: boolean;
  plan: {
    id: string;
    name: string;
    displayName: string;
    maxStudents: number;
    maxTeachers: number;
    maxClasses: number;
    features: string;
  } | null;
}

// --- Helpers ---
function formatDate(dateStr: string) {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function parseFeatures(features: string): string[] {
  try {
    // If already valid JSON array, parse it
    const parsed = JSON.parse(features);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // If plain text, split by comma or return as single item
    if (features && typeof features === 'string') {
      if (features.includes(',')) {
        return features.split(',').map((f) => f.trim());
      }
      return [features];
    }
  }
  return [];
}

function daysUntil(dateStr: string, nowOverride?: Date) {
  const target = new Date(dateStr);
  const d = nowOverride || new Date();
  const diff = target.getTime() - d.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

const statusConfig: Record<string, { label: string; color: string }> = {
  success: { label: 'Active', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  pending: { label: 'Pending', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  failed: { label: 'Failed', color: 'bg-red-100 text-red-700 border-red-200' },
  abandoned: { label: 'Abandoned', color: 'bg-gray-100 text-gray-600 border-gray-200' },
};

const planIcons: Record<string, React.ElementType> = {
  free: Zap,
  pro: Star,
  custom: Shield,
};

const planColors: Record<string, { border: string; bg: string; badge: string; text: string }> = {
  free: { border: 'border-gray-200', bg: 'bg-gray-50', badge: 'bg-gray-100 text-gray-600', text: 'text-gray-900' },
  pro: { border: 'border-emerald-200', bg: 'bg-emerald-50/50', badge: 'bg-emerald-100 text-emerald-700', text: 'text-emerald-900' },
  custom: { border: 'border-blue-200', bg: 'bg-blue-50/50', badge: 'bg-blue-100 text-blue-700', text: 'text-blue-900' },
};

// --- Default plan features for display ---
const defaultPlans = [
  {
    name: 'free',
    displayName: 'Free',
    price: 0,
    priceDisplay: 'Free',
    maxStudents: 50,
    maxTeachers: 5,
    maxClasses: 10,
    features: ['Up to 50 students', 'Up to 5 teachers', 'Up to 10 classes', 'Basic report cards', 'Attendance tracking', 'Community support'],
  },
  {
    name: 'pro',
    displayName: 'Pro',
    price: 9999,
    priceDisplay: '₦9,999/month',
    maxStudents: 300,
    maxTeachers: 50,
    maxClasses: -1,
    features: ['Up to 300 students', 'Up to 50 teachers', 'Unlimited classes', 'Up to 50 library books', '500MB storage', 'Advanced report cards', 'Video lessons', 'AI grading assistant', 'Homework management', 'Email support', 'Transport tracking'],
  },
  {
    name: 'custom',
    displayName: 'Custom',
    price: 0,
    priceDisplay: 'Contact via WhatsApp',
    maxStudents: -1,
    maxTeachers: -1,
    maxClasses: -1,
    features: ['Unlimited students', 'Unlimited teachers', 'Unlimited classes', 'Custom features', 'Custom pricing', 'Dedicated support', '_whatsapp:+2349152929772'],
  },
];

// --- Component ---
 export function SubscriptionView() {
    const { currentUser, currentRole } = useAppStore();
    const [mounted, setMounted] = React.useState(false);
    React.useEffect(() => { setMounted(true); }, []);
    const now = mounted ? new Date() : undefined;
    const [school, setSchool] = React.useState<SchoolData | null>(null);
   const [plans, setPlans] = React.useState<Plan[]>([]);
   const [payment, setPayment] = React.useState<PaymentData | null>(null);
   const [loading, setLoading] = React.useState(true);
   const [subscribing, setSubscribing] = React.useState<string | null>(null);
   
   // Bank transfer modal state
   const [showBankTransfer, setShowBankTransfer] = React.useState(false);
   const [selectedPlan, setSelectedPlan] = React.useState<Plan | null>(null);
   const [transferAmount, setTransferAmount] = React.useState('');
   const [transferDate, setTransferDate] = React.useState('');
   const [transferNote, setTransferNote] = React.useState('');
   const [submittingPayment, setSubmittingPayment] = React.useState(false);
   const [bankDetails, setBankDetails] = React.useState<{ bankName?: string; accountNumber?: string; accountName?: string }>({});
   const [loadingBank, setLoadingBank] = React.useState(true);
   const [billingCycle, setBillingCycle] = React.useState<'monthly' | 'yearly'>('monthly');

  const isSuperAdmin = currentRole === 'SUPER_ADMIN';

  const schoolId = currentUser.schoolId;

   // Fetch data
   React.useEffect(() => {
     async function fetchData() {
       try {
setLoading(true);
          const promises: Promise<void>[] = [];

          // Fetch school using the logged-in user's school ID
          const schoolPromise = fetch(`/api/schools?schoolId=${schoolId}`)
            .then((res) => res.json())
            .then((json) => {
              const data = json.data || [];
              if (data.length > 0) setSchool(data[0]);
            })
            .catch(() => {});
          promises.push(schoolPromise);

         // Fetch plans
         const plansPromise = fetch('/api/plans')
           .then((res) => res.json())
           .then((json) => {
             setPlans(json.data || []);
           })
           .catch(() => {});
         promises.push(plansPromise);

         // Fetch platform settings (for bank details)
         const settingsPromise = fetch('/api/platform/settings')
           .then((res) => res.json())
           .then((json) => {
             if (json.success && json.data) {
               setBankDetails({
                 bankName: json.data.paymentBankName,
                 accountNumber: json.data.paymentBankAccount,
                 accountName: json.data.paymentBankAccountName,
               });
             }
           })
           .catch(() => {});
         promises.push(settingsPromise);

         // Fetch payment
         if (schoolId) {
           const paymentPromise = fetch(`/api/payments/subscribe?schoolId=${schoolId}`)
             .then((res) => res.json())
             .then((json) => {
               if (json.data) setPayment(json.data);
             })
             .catch(() => {});
           promises.push(paymentPromise);
         }

         await Promise.all(promises);
       } catch {
         toast.error('Failed to load subscription data');
       } finally {
         setLoading(false);
         setLoadingBank(false);
       }
     }
     fetchData();
   }, [schoolId]);

  // Get current plan info
  const currentPlan = React.useMemo(() => {
    if (payment?.plan) {
      return {
        name: payment.plan.displayName || payment.plan.name,
        id: payment.plan.id,
        maxStudents: payment.plan.maxStudents,
        maxTeachers: payment.plan.maxTeachers,
        maxClasses: payment.plan.maxClasses,
        isActive: payment.isActive,
        endDate: payment.endDate,
        amount: payment.amount,
      };
    }
    // Fallback to school plan string
    if (school) {
      const matchedDefault = defaultPlans.find((p) => p.name === school.plan || p.name === school.plan?.toLowerCase());
      if (matchedDefault) {
        return {
          name: matchedDefault.displayName,
          id: school.planId || school.plan,
          maxStudents: matchedDefault.maxStudents,
          maxTeachers: matchedDefault.maxTeachers,
          maxClasses: matchedDefault.maxClasses,
          isActive: true,
          endDate: null,
          amount: matchedDefault.price,
        };
      }
      return {
        name: school.plan || 'Free',
        id: school.planId || school.plan,
        maxStudents: school.maxStudents,
        maxTeachers: school.maxTeachers,
        maxClasses: -1,
        isActive: true,
        endDate: null,
        amount: 0,
      };
    }
    return null;
  }, [school, payment]);

  // Merge DB plans with default plans for display
  const displayPlans = React.useMemo(() => {
    if (plans.length > 0) {
      return plans.map((p) => ({
        ...p,
        featuresList: typeof p.features === 'string' ? parseFeatures(p.features) : [],
      }));
    }
    return defaultPlans.map((p) => ({
      id: p.name,
      name: p.name,
      displayName: p.displayName,
      price: p.price,
      priceDisplay: p.priceDisplay,
      yearlyPrice: null,
      maxStudents: p.maxStudents,
      maxTeachers: p.maxTeachers,
      maxClasses: p.maxClasses,
      features: JSON.stringify(p.features),
      isActive: true,
      paystackPlanCode: null,
      featuresList: p.features,
    }));
  }, [plans]);



   // Handle subscribe - attempt Paystack online payment first
   const handleSubscribe = (plan: typeof displayPlans[0]) => {
     if (!schoolId) {
       toast.error('School information is missing. Please log in again.');
       return;
     }
     
     // Handle Custom plan - redirect to WhatsApp
     if (plan.name === 'custom') {
       const message = encodeURIComponent('Hello, I want to subscribe to the Custom plan for my school. Please advise on features and pricing.');
       window.open(`https://wa.me/2349152929772?text=${message}`, '_blank');
       return;
     }
     
     // Handle Free plan - no payment needed
     if (plan.price === 0) {
       toast.info('You are on the Free plan. Enjoy using Skoolar!');
       return;
     }
     
     // Get correct price based on billing cycle
     const price = billingCycle === 'yearly' && plan.yearlyPrice && plan.yearlyPrice > 0 
       ? plan.yearlyPrice 
       : plan.price;
     
     // Set selected plan details
     setSelectedPlan(plan as Plan);
     setTransferAmount(String(price));
     
     // Try Paystack online payment first — fallback to bank transfer if unavailable
     if (school?.email) {
       handlePaystackPaymentFromPlan(plan, price);
     } else {
       // No email on school — show bank transfer with warning
       toast.warning('School email required for online payment. Please update your school profile or use bank transfer.');
       setShowBankTransfer(true);
     }
   };

   // Helper: initiate Paystack payment from a plan card directly
   const handlePaystackPaymentFromPlan = async (plan: typeof displayPlans[0], price: number) => {
     if (!schoolId || !plan) return;
     setSubscribing(plan.id);
     try {
       const res = await fetch('/api/payments/subscribe', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
           schoolId,
           planId: plan.id,
           email: school?.email,
           amount: price,
           duration: billingCycle,
           planCode: (plan as Plan).paystackPlanCode || undefined,
         }),
       });
       const json = await res.json();
       if (res.ok && json.data?.authorization_url) {
         window.location.href = json.data.authorization_url;
       } else {
         toast.warning('Online payment unavailable. Please use bank transfer.');
         setShowBankTransfer(true);
       }
     } catch {
       toast.warning('Online payment unavailable. Please use bank transfer.');
       setShowBankTransfer(true);
     } finally {
       setSubscribing(null);
     }
   };

  // Get payment details - use bank details from platform settings if available
  const paymentDetails = bankDetails?.accountNumber 
    ? bankDetails 
    : { bankName: 'PalmPay', accountNumber: '9033460322', accountName: 'Skoolar' };

   // Handle Paystack online payment
   const handlePaystackPayment = async () => {
     const plan = selectedPlan;
     if (!schoolId || !plan) return;
     if (!school?.email) {
       toast.error('School email is required for online payment. Please update your school profile first.');
       return;
     }
     
     // Get correct price based on billing cycle
     const price = billingCycle === 'yearly' && plan.yearlyPrice && plan.yearlyPrice > 0 
       ? plan.yearlyPrice 
       : plan.price;
     
     try {
       setSubscribing(plan.id);
       setShowBankTransfer(false);
       const res = await fetch('/api/payments/subscribe', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ 
           schoolId, 
           planId: plan.id, 
           email: school.email, 
           amount: price,
           duration: billingCycle,
           planCode: (plan as Plan).paystackPlanCode || undefined 
         }),
       });
       const json = await res.json();
       if (res.ok && json.data?.authorization_url) {
         window.location.href = json.data.authorization_url;
       } else {
         toast.error(json.error || 'Online payment unavailable. Please use bank transfer.');
         setShowBankTransfer(true);
       }
     } catch {
       toast.error('Online payment unavailable. Please try bank transfer.');
       setShowBankTransfer(true);
     } finally {
       setSubscribing(null);
     }
   };

   // Handle manual bank transfer submission
   const handleSubmitBankTransfer = async () => {
     if (!selectedPlan || !schoolId || !transferAmount || !transferDate) {
       toast.error('Please fill in all required fields');
       return;
     }

     setSubmittingPayment(true);
     try {
       const res = await fetch('/api/payments/manual', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
           schoolId,
           planId: selectedPlan.id,
           amount: Number(transferAmount),
           transferDate,
           notes: transferNote,
           duration: billingCycle,
         }),
       });

      if (res.ok) {
        toast.success('Payment submitted! We will verify and activate your plan shortly. Contact us on WhatsApp for confirmation.');
        
        // Redirect to WhatsApp for confirmation
        const confirmMessage = encodeURIComponent(`I just made a payment of ₦${transferAmount} for the ${selectedPlan.displayName} plan. Please confirm my subscription. School: ${school?.name}`);
        window.open(`https://wa.me/2349152929772?text=${confirmMessage}`, '_blank');
        
        setShowBankTransfer(false);
        setSelectedPlan(null);
        setTransferAmount('');
        setTransferDate('');
        setTransferNote('');
      } else {
        const json = await res.json();
        toast.error(json.error || 'Failed to submit payment');
      }
    } catch {
      toast.error('Failed to submit payment');
    } finally {
      setSubmittingPayment(false);
    }
  };

  const isFree = !payment || !payment.plan || payment.plan.name === 'free' || payment.plan.name === 'basic';
  const daysLeft = payment?.endDate ? daysUntil(payment.endDate, now) : null;
  const isExpiringSoon = daysLeft !== null && daysLeft <= 14 && daysLeft > 0;
  const isExpired = daysLeft !== null && daysLeft <= 0;

  // --- Loading State ---
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <Skeleton className="h-7 w-48 mb-1" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <Skeleton className="h-36 rounded-xl" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-80 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Bank Transfer Payment Modal */}
      <Dialog open={showBankTransfer} onOpenChange={setShowBankTransfer}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Complete Your Payment</DialogTitle>
            <DialogDescription>
              Pay online with card via Paystack, or transfer to the bank account below.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Bank Details */}
            <div className="p-4 bg-gray-50 rounded-lg space-y-2">
              <p className="text-sm font-medium text-gray-900">Bank Transfer Details</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-gray-500">Bank Name:</span>
                <span className="font-medium">{paymentDetails.bankName}</span>
                <span className="text-gray-500">Account Number:</span>
                <span className="font-medium">{paymentDetails.accountNumber}</span>
                <span className="text-gray-500">Account Name:</span>
                <span className="font-medium">{paymentDetails.accountName}</span>
              </div>
               {selectedPlan && (
                 <div className="mt-2 pt-2 border-t">
                   <div className="flex items-center justify-between">
                     <div>
                       <p className="text-sm">
                         <span className="text-gray-500">Plan: </span>
                         <span className="font-medium">{selectedPlan.displayName}</span>
                       </p>
                       <p className="text-xs text-muted-foreground mt-0.5">
                         Billing: {billingCycle === 'yearly' ? 'Yearly (12 months)' : 'Monthly'}
                       </p>
                     </div>
                     <div className="text-right">
                       <p className="text-lg font-bold text-emerald-600">
                         {formatCurrency(Number(transferAmount))}
                       </p>
                       <p className="text-xs text-muted-foreground">
                         /{billingCycle === 'yearly' ? 'year' : 'month'}
                       </p>
                     </div>
                   </div>
                 </div>
               )}
            </div>

            {/* Payment Form */}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="amount">Amount Paid *</Label>
                  <Input
                    id="amount"
                    type="number"
                    placeholder="e.g. 5000"
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="date">Transfer Date *</Label>
                  <Input
                    id="date"
                    type="date"
                    value={transferDate}
                    onChange={(e) => setTransferDate(e.target.value)}
                  />
                </div>
              </div>
              
              <div className="space-y-1">
                <Label htmlFor="note">Notes (Optional)</Label>
                <Input
                  id="note"
                  placeholder="Any additional information..."
                  value={transferNote}
                  onChange={(e) => setTransferNote(e.target.value)}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button
                variant="default"
                className="flex-1 gap-2"
                onClick={() => {
                  setShowBankTransfer(false);
                  if (selectedPlan) handlePaystackPayment();
                }}
              >
                <CreditCard className="size-4" />
                Pay with Card
              </Button>
              <Button
                variant="outline"
                className="flex-1 gap-2"
                onClick={handleSubmitBankTransfer}
                disabled={submittingPayment || !transferAmount || !transferDate}
              >
                {submittingPayment && <Loader2 className="size-4 animate-spin" />}
                Bank Transfer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Subscription & Billing</h2>
          <p className="text-sm text-muted-foreground">Manage your school plan and view payment history</p>
        </div>
        <Badge variant="outline" className="w-fit gap-1.5">
          <School className="size-3.5" />
          {school?.name || currentUser.schoolName}
        </Badge>
      </div>

      {/* Upgrade Banner (Free Plan) */}
      {isFree && !isSuperAdmin && (
        <Card className="border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50">
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex size-12 items-center justify-center rounded-xl bg-emerald-100 shrink-0">
                <Zap className="size-6 text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-emerald-900">Upgrade Your Plan</h3>
                <p className="text-sm text-emerald-700 mt-0.5">
                  You&apos;re on the Free plan. Upgrade to unlock more students, teachers, classes, and premium features like AI grading and video lessons.
                </p>
              </div>
              <Button className="gap-2 shrink-0" onClick={() => {
                const proPlan = displayPlans.find((p) => p.name === 'pro');
                if (proPlan) {
                  const el = document.getElementById(`plan-${proPlan.id}`);
                  el?.scrollIntoView({ behavior: 'smooth' });
                }
              }}>
                <ArrowRight className="size-4" />
                View Plans
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Expiring Soon Banner */}
      {isExpiringSoon && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="size-5 text-amber-600 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-800">
                  Your subscription expires in {daysLeft} day{daysLeft !== 1 ? 's' : ''}
                </p>
                <p className="text-xs text-amber-600 mt-0.5">Renew to avoid losing access to premium features.</p>
              </div>
              <Button size="sm" variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-100">
                Renew Now
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Expired Banner */}
      {isExpired && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="size-5 text-red-600 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-800">Your subscription has expired</p>
                <p className="text-xs text-red-600 mt-0.5">Please renew to continue using premium features.</p>
              </div>
              <Button size="sm" className="bg-red-600 hover:bg-red-700">
                Renew Now
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Current Plan Card */}
      {currentPlan && (
        <Card className={cn(
          'relative overflow-hidden',
          isSuperAdmin ? 'border-dashed' : ''
        )}>
          {isSuperAdmin && (
            <div className="absolute top-3 right-3">
              <Badge variant="outline" className="text-[10px] gap-1">
                <Shield className="size-3" />
                Super Admin
              </Badge>
            </div>
          )}
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className={cn(
                'flex size-11 items-center justify-center rounded-xl',
                currentPlan.isActive ? 'bg-emerald-100' : 'bg-gray-100'
              )}>
                <CreditCard className={cn('size-5', currentPlan.isActive ? 'text-emerald-600' : 'text-gray-500')} />
              </div>
              <div>
                <CardTitle className="text-base">Current Plan: {currentPlan.name}</CardTitle>
                <CardDescription>
                  {currentPlan.isActive ? (
                    <span className="flex items-center gap-1.5 text-emerald-600">
                      <CheckCircle2 className="size-3.5" /> Active
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-gray-500">
                      <Clock className="size-3.5" /> Inactive
                    </span>
                  )}
                  {currentPlan.endDate && ` · Expires ${formatDate(currentPlan.endDate)}`}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Users className="size-4 text-blue-600 shrink-0" />
                <div>
                  <p className="text-[11px] text-muted-foreground">Students</p>
                  <p className="text-sm font-semibold">{school?._count.students || 0} / {currentPlan.maxStudents === -1 ? '∞' : currentPlan.maxStudents}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <GraduationCap className="size-4 text-violet-600 shrink-0" />
                <div>
                  <p className="text-[11px] text-muted-foreground">Teachers</p>
                  <p className="text-sm font-semibold">{school?._count.teachers || 0} / {currentPlan.maxTeachers === -1 ? '∞' : currentPlan.maxTeachers}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <BookOpen className="size-4 text-amber-600 shrink-0" />
                <div>
                  <p className="text-[11px] text-muted-foreground">Classes</p>
                  <p className="text-sm font-semibold">{school?._count.classes || 0} / {currentPlan.maxClasses === -1 ? '∞' : currentPlan.maxClasses}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <CreditCard className="size-4 text-emerald-600 shrink-0" />
                <div>
                  <p className="text-[11px] text-muted-foreground">Amount</p>
                  <p className="text-sm font-semibold">{formatCurrency(currentPlan.amount)}/mo</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

       {/* Plan Comparison Cards */}
       <div>
         <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
           <h3 className="text-base font-semibold">Available Plans</h3>
           
           {/* Billing Cycle Toggle */}
           <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-1">
             <button
               onClick={() => setBillingCycle('monthly')}
               className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                 billingCycle === 'monthly' 
                   ? 'bg-white shadow text-foreground' 
                   : 'text-muted-foreground hover:text-foreground'
               }`}
             >
               Monthly
             </button>
             <button
               onClick={() => setBillingCycle('yearly')}
               className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1.5 ${
                 billingCycle === 'yearly' 
                   ? 'bg-white shadow text-foreground' 
                   : 'text-muted-foreground hover:text-foreground'
               }`}
             >
               Yearly
               <Badge className="bg-emerald-100 text-emerald-700 border-0 text-[10px]">
                 Save up to 20%
               </Badge>
             </button>
           </div>
         </div>
         
         <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {displayPlans.map((plan) => {
            const pColor = planColors[plan.name] || planColors.free;
            const PlanIcon = planIcons[plan.name] || Zap;
            const isCurrentPlan = currentPlan?.id === plan.id || currentPlan?.name?.toLowerCase() === plan.name?.toLowerCase();
            const isPopular = plan.name === 'pro';

            return (
              <Card
                key={plan.id}
                id={`plan-${plan.id}`}
                className={cn(
                  'relative transition-all hover:shadow-md',
                  pColor.border,
                  isPopular && 'ring-2 ring-emerald-500 ring-offset-1',
                  isCurrentPlan && 'bg-emerald-50/30'
                )}
              >
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-emerald-600 text-white text-[10px] px-2.5">Most Popular</Badge>
                  </div>
                )}
                <CardContent className="p-5">
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className={cn('flex size-10 items-center justify-center rounded-lg', pColor.bg)}>
                      <PlanIcon className={cn('size-5', pColor.badge.replace('bg-', 'text-').split(' ')[0])} />
                    </div>
                    <div>
                      <h4 className="font-semibold">{plan.displayName}</h4>
                      <Badge variant="outline" className={cn('text-[10px]', pColor.badge)}>{plan.name}</Badge>
                    </div>
                  </div>

                   {/* Price */}
                   <div className="mb-4">
                     <div className="flex items-baseline gap-1">
                       {plan.price === 0 ? (
                         <span className="text-2xl font-bold">Free</span>
                       ) : billingCycle === 'yearly' && plan.yearlyPrice && plan.yearlyPrice > 0 ? (
                         <>
                           <span className="text-2xl font-bold">{formatCurrency(plan.yearlyPrice)}</span>
                           <span className="text-xs text-muted-foreground">/year</span>
                         </>
                       ) : (
                         <>
                           <span className="text-2xl font-bold">{formatCurrency(plan.price)}</span>
                           <span className="text-xs text-muted-foreground">/month</span>
                         </>
                       )}
                     </div>
                     {plan.price > 0 && plan.yearlyPrice && plan.yearlyPrice > 0 && (
                       <p className="text-[11px] text-muted-foreground mt-0.5">
                         {billingCycle === 'monthly' ? (
                           <>
                             Or {formatCurrency(plan.yearlyPrice)}/year 
                             <Badge className="text-[10px] ml-1 bg-emerald-50 text-emerald-700">
                               Save {formatCurrency(plan.price * 12 - plan.yearlyPrice)}
                             </Badge>
                           </>
                         ) : (
                           <>
                             <span className="line-through text-muted-foreground/70">{formatCurrency(plan.price * 12)}/year</span>
                             <span className="ml-1 text-emerald-600">
                               Save {formatCurrency(plan.price * 12 - plan.yearlyPrice)} ({Math.round(((plan.price * 12 - plan.yearlyPrice) / (plan.price * 12)) * 100)}%)
                             </span>
                           </>
                         )}
                       </p>
                     )}
                   </div>

                  {/* Limits */}
                  <div className="space-y-2 mb-4 text-xs">
                    <div className="flex items-center gap-2">
                      <Users className="size-3.5 text-muted-foreground" />
                      <span>
                        {plan.maxStudents === -1 ? 'Unlimited' : `Up to ${plan.maxStudents}`} students
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <GraduationCap className="size-3.5 text-muted-foreground" />
                      <span>
                        {plan.maxTeachers === -1 ? 'Unlimited' : `Up to ${plan.maxTeachers}`} teachers
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <BookOpen className="size-3.5 text-muted-foreground" />
                      <span>
                        {plan.maxClasses === -1 ? 'Unlimited' : `Up to ${plan.maxClasses}`} classes
                      </span>
                    </div>
                  </div>

                  <Separator className="my-4" />

                  {/* Features */}
                  <div className="space-y-2 mb-5">
                    {(plan.featuresList || parseFeatures(plan.features)).map((feature: string, i: number) => (
                      <div key={i} className="flex items-start gap-2 text-xs">
                        <CheckCircle className="size-3.5 text-emerald-500 shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>

                  {/* Action Button */}
                  {isCurrentPlan ? (
                    <Button variant="outline" className="w-full" disabled>
                      <CheckCircle className="size-4 mr-2" />
                      Current Plan
                    </Button>
                  ) : (
                    <Button
                      className={cn(
                        'w-full gap-2',
                        isPopular ? 'bg-emerald-600 hover:bg-emerald-700' : ''
                      )}
                      onClick={() => handleSubscribe(plan)}
                      disabled={subscribing === plan.id || isSuperAdmin}
                    >
                      {subscribing === plan.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <CreditCard className="size-4" />
                      )}
                      {isSuperAdmin ? 'Admin Managed' : plan.price === 0 ? 'Downgrade' : 'Subscribe'}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Payment History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Payment History</CardTitle>
              <CardDescription>View your subscription payment records</CardDescription>
            </div>
            <CreditCard className="size-5 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent>
          {!payment ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <CreditCard className="size-10 opacity-30 mb-3" />
              <p className="text-sm font-medium">No payment history</p>
              <p className="text-xs mt-1">Payment records will appear here after your first subscription</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 font-medium text-muted-foreground text-xs">Date</th>
                    <th className="pb-3 font-medium text-muted-foreground text-xs">Plan</th>
                    <th className="pb-3 font-medium text-muted-foreground text-xs">Amount</th>
                    <th className="pb-3 font-medium text-muted-foreground text-xs">Reference</th>
                    <th className="pb-3 font-medium text-muted-foreground text-xs">Status</th>
                    <th className="pb-3 font-medium text-muted-foreground text-xs">Period</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b last:border-0">
                    <td className="py-3">{formatDate(payment.createdAt)}</td>
                    <td className="py-3 font-medium">{payment.plan?.displayName || payment.plan?.name || 'N/A'}</td>
                    <td className="py-3 font-semibold">{formatCurrency(payment.amount)}</td>
                    <td className="py-3">
                      <code className="text-xs bg-muted px-2 py-1 rounded">{payment.reference.slice(0, 20)}...</code>
                    </td>
                    <td className="py-3">
                      <Badge className={cn('text-[10px] border', statusConfig[payment.status]?.color || statusConfig.pending.color)}>
                        {statusConfig[payment.status]?.label || payment.status}
                      </Badge>
                    </td>
                    <td className="py-3 text-xs text-muted-foreground">
                      {formatDate(payment.startDate)} – {formatDate(payment.endDate)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Super Admin: Manage School Plans */}
      {isSuperAdmin && <SuperAdminPlanManager plans={displayPlans} />}
    </div>
  );
}

// --- Super Admin: School Plan Management ---
interface AdminSchoolData {
  id: string;
  name: string;
  email: string | null;
  plan: string;
  planId: string | null;
  isActive: boolean;
  createdAt: string;
  _count: {
    students: number;
    teachers: number;
    classes: number;
  };
}

function SuperAdminPlanManager({ plans }: { plans: Array<{ id: string; name: string; displayName: string; price: number }> }) {
  const [allSchools, setAllSchools] = React.useState<AdminSchoolData[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [upgradingId, setUpgradingId] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState('');

  const fetchSchools = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/schools?limit=100');
      const json = await res.json();
      setAllSchools(json.data || []);
    } catch {
      toast.error('Failed to load schools');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchSchools();
  }, [fetchSchools]);

  const filteredSchools = React.useMemo(() => {
    if (!search.trim()) return allSchools;
    const q = search.toLowerCase();
    return allSchools.filter(
      (s) => s.name.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q)
    );
  }, [allSchools, search]);

  const handlePlanChange = async (schoolId: string, newPlanId: string, schoolName: string) => {
    try {
      setUpgradingId(schoolId);
      const res = await fetch(`/api/schools/${schoolId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: newPlanId }),
      });
      if (res.ok) {
        const planName = plans.find((p) => p.id === newPlanId)?.displayName || newPlanId;
        toast.success(`Plan for "${schoolName}" updated to ${planName}`);
        fetchSchools();
      } else {
        const json = await res.json();
        toast.error(json.error || 'Failed to update plan');
      }
    } catch {
      toast.error('Failed to update plan');
    } finally {
      setUpgradingId(null);
    }
  };

  const planBadgeColor = (planName: string) => {
    const colors: Record<string, string> = {
      free: 'bg-gray-100 text-gray-600',
      pro: 'bg-emerald-100 text-emerald-700',
      custom: 'bg-blue-100 text-blue-700',
    };
    return colors[planName?.toLowerCase()] || 'bg-gray-100 text-gray-600';
  };

  return (
    <Card className="border-red-200/50">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-lg bg-red-100">
              <Shield className="size-5 text-red-600" />
            </div>
            <div>
              <CardTitle className="text-base">Manage School Plans</CardTitle>
              <CardDescription>View and change subscription plans for all schools</CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="text-xs w-fit gap-1">
            {allSchools.length} School{allSchools.length !== 1 ? 's' : ''}
          </Badge>
        </div>
        <div className="mt-3">
          <div className="relative max-w-sm">
            <input
              type="text"
              placeholder="Search schools..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 rounded-lg" />
            ))}
          </div>
        ) : filteredSchools.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <School className="size-10 opacity-30 mb-3" />
            <p className="text-sm font-medium">
              {search ? 'No schools match your search' : 'No schools registered yet'}
            </p>
            <p className="text-xs mt-1">
              {search ? 'Try a different search term' : 'Schools will appear here after registration'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs">School</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs hidden md:table-cell">Current Plan</th>
                  <th className="text-center py-3 px-4 font-medium text-muted-foreground text-xs hidden sm:table-cell">Students</th>
                  <th className="text-center py-3 px-4 font-medium text-muted-foreground text-xs hidden sm:table-cell">Teachers</th>
                  <th className="text-center py-3 px-4 font-medium text-muted-foreground text-xs hidden lg:table-cell">Status</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground text-xs">Change Plan</th>
                </tr>
              </thead>
              <tbody>
                {filteredSchools.map((s) => {
                  const isUpgrading = upgradingId === s.id;
                  return (
                    <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-100 shrink-0">
                            <School className="size-4 text-emerald-600" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium truncate max-w-[180px]">{s.name}</p>
                            <p className="text-[11px] text-muted-foreground truncate max-w-[180px]">
                              {s.email || s.id.slice(0, 12) + '...'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 hidden md:table-cell">
                        <Badge className={cn('text-[10px] border-0', planBadgeColor(s.plan))}>
                          {(s.plan || 'free').charAt(0).toUpperCase() + (s.plan || 'free').slice(1)}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-center hidden sm:table-cell">
                        <span className="font-medium">{s._count.students}</span>
                      </td>
                      <td className="py-3 px-4 text-center hidden sm:table-cell">
                        <span className="font-medium">{s._count.teachers}</span>
                      </td>
                      <td className="py-3 px-4 text-center hidden lg:table-cell">
                        <Badge
                          className={cn(
                            'text-[10px] border-0',
                            s.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                          )}
                        >
                          {s.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Select
                            value={s.planId || ''}
                            onValueChange={(val) => handlePlanChange(s.id, val, s.name)}
                            disabled={isUpgrading}
                          >
                             <SelectTrigger className="w-full sm:w-[140px] h-8 text-xs">
                              {isUpgrading ? (
                                <span className="flex items-center gap-1.5">
                                  <Loader2 className="size-3 animate-spin" />
                                  Updating...
                                </span>
                              ) : (
                                <SelectValue placeholder="Select plan" />
                              )}
                            </SelectTrigger>
                            <SelectContent>
                              {plans.map((p) => (
                                <SelectItem key={p.id} value={p.id} className="text-xs">
                                  <span className="flex items-center gap-2">
                                    {p.displayName}
                                    {p.price === 0 ? (
                                      <span className="text-muted-foreground">(Free)</span>
                                    ) : (
                                      <span className="text-muted-foreground">({formatCurrency(p.price)}/mo)</span>
                                    )}
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
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
    </Card>
  );
}
