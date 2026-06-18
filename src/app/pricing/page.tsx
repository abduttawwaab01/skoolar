'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Check, X, Sparkles, GraduationCap, Building2, Users, Shield, BarChart3,
  Clock, Headphones, Zap, Star, ArrowRight, ChevronDown, ChevronUp,
  Crown, Rocket, Gift, Lock, MessageCircle, BookOpen, CreditCard,
  Smartphone, Globe, Database, Cpu, TrendingUp, ShieldCheck,
  MessageSquare, Settings2, SlidersHorizontal
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion';
import { PublicLayout } from '@/components/layout/public-layout';
import { motion, AnimatePresence } from 'framer-motion';
import { fadeIn, slideUp, staggerContainer, scaleIn } from '@/lib/motion-variants';

interface PlanPricingRecord {
  id: string;
  planId: string;
  schoolType: string;
  monthlyPrice: number;
  termPrice: number;
  sessionPrice: number;
}

interface PlanData {
  id: string;
  name: string;
  displayName: string;
  price: number;
  yearlyPrice: number | null;
  pricingType: string;
  maxStudents: number;
  maxTeachers: number;
  maxClasses: number;
  features: string;
  isActive: boolean;
  pricing: PlanPricingRecord[];
}

const defaultPlans: PlanData[] = [
  {
    id: 'free', name: 'free', displayName: 'Free', price: 0, yearlyPrice: 0,
    pricingType: 'free',
    maxStudents: 30, maxTeachers: 5, maxClasses: 10,
    features: JSON.stringify(['30 Students', '5 Teachers', '1 Admin Account', 'Basic Report Cards', 'Attendance Tracking', 'Community Support', 'Partnership with Skoolar']),
    isActive: true,
    pricing: [],
  },
  {
    id: 'pro', name: 'pro', displayName: 'Pro', price: 0, yearlyPrice: 0,
    pricingType: 'per_student',
    maxStudents: 99999, maxTeachers: 99999, maxClasses: 99999,
    features: JSON.stringify(['All Free Features', 'Students Portal', 'Parents Portal', 'Director Portal', 'AI Grading Assistant', 'AI Quiz Generator', 'AI Chat', 'Email Support', 'Partnership with Skoolar']),
    isActive: true,
    pricing: [
      { id: '', planId: '', schoolType: 'primary', monthlyPrice: 100, termPrice: 400, sessionPrice: 800 },
      { id: '', planId: '', schoolType: 'secondary', monthlyPrice: 200, termPrice: 600, sessionPrice: 1000 },
      { id: '', planId: '', schoolType: 'primary_secondary', monthlyPrice: 200, termPrice: 600, sessionPrice: 1000 },
      { id: '', planId: '', schoolType: 'higher_institution', monthlyPrice: 300, termPrice: 900, sessionPrice: 1500 },
    ],
  },
  {
    id: 'custom', name: 'custom', displayName: 'Custom', price: 0, yearlyPrice: 0,
    pricingType: 'custom',
    maxStudents: 99999, maxTeachers: 99999, maxClasses: 99999,
    features: JSON.stringify(['Unlimited Everything', 'Tailored Solutions', 'Dedicated Support', 'Contact via WhatsApp']),
    isActive: true,
    pricing: [],
  },
];

const planIcons: Record<string, React.ElementType> = {
  free: GraduationCap,
  pro: Building2,
  custom: Shield,
};

const planIconBg: Record<string, string> = {
  free: 'bg-gray-100 text-gray-600',
  pro: 'bg-emerald-100 text-emerald-600',
  custom: 'bg-blue-100 text-blue-600',
};

const planDescriptions: Record<string, string> = {
  free: 'Perfect for small schools just getting started with digital management.',
  pro: 'Pay per student — ideal for growing schools that need advanced features.',
  custom: 'Designed for institutions needing custom features and dedicated support.',
};

const faqItems = [
  {
    question: 'Can I switch plans at any time?',
    answer: 'Yes, you can upgrade or downgrade your plan at any time. Upgrading gives you immediate access to new features. Downgrading takes effect at the start of your next billing period.',
  },
  {
    question: 'What happens if my subscription expires?',
    answer: 'When your subscription expires, your school\'s access will be limited until you renew. The school administrator can submit a new subscription request from the dashboard. All your data is preserved and will be accessible again once the subscription is renewed.',
  },
  {
    question: 'Do you offer discounts for multiple schools?',
    answer: 'Yes, we offer special pricing for school groups, districts, and educational networks. Contact us at hello@skoolar.com for custom enterprise pricing.',
  },
  {
    question: 'What payment methods do you accept?',
    answer: 'We accept bank transfers and online payments through Paystack (debit cards, credit cards). For Custom plans, we also support purchase orders and invoicing.',
  },
  {
    question: 'Is my data safe and secure?',
    answer: 'Absolutely. We use industry-standard encryption (SSL/TLS), regular backups, and enterprise-grade infrastructure. Custom plans include additional security features like SSO and custom data residency options.',
  },
  {
    question: 'Can I cancel my subscription?',
    answer: 'Yes, you can cancel at any time with no penalties. Your access continues until the end of your current billing period.',
  },
  {
    question: 'Do you provide training and onboarding?',
    answer: 'Yes, all plans include access to our knowledge base and video tutorials. Pro and Custom plans include email support. Custom plans include dedicated onboarding sessions and custom training programs.',
  },
  {
    question: 'What is the Free plan?',
    answer: 'The Free plan is perfect for small schools just getting started. It includes up to 30 students, 5 teachers, and 10 classes with basic features like attendance tracking and report cards. You can upgrade anytime as your school grows.',
  },
];

const testimonials = [
  {
    name: 'Mrs. Adebayo',
    role: 'Proprietress, Graceville Academy',
    content: 'Skoolar has transformed how we manage our school. The attendance and grading features save us hours every week.',
    plan: 'Pro',
    avatar: '👩‍🏫',
  },
  {
    name: 'Mr. Okonkwo',
    role: 'Principal, Apex College',
    content: 'The AI grading assistant is incredible. It has reduced our teachers\' workload by 40% while maintaining quality.',
    plan: 'Pro',
    avatar: '👨‍💼',
  },
  {
    name: 'Dr. Fatimah',
    role: 'Director, Horizon Schools',
    content: 'Managing multiple schools from one dashboard is a game-changer. The Custom plan is worth every naira.',
    plan: 'Custom',
    avatar: '👩‍💼',
  },
];

const comparisonFeatures = [
  { category: 'Core', features: [
    { name: 'Pricing Model', free: 'Free Forever', pro: 'Per Student', custom: 'Custom Quote' },
    { name: 'Students', free: '30', pro: 'Unlimited', custom: 'Unlimited' },
    { name: 'Teachers', free: '5', pro: 'Unlimited', custom: 'Unlimited' },
    { name: 'Classes', free: '10', pro: 'Unlimited', custom: 'Unlimited' },
    { name: 'Admin Accounts', free: '1', pro: '1', custom: '5' },
    { name: 'Attendance Tracking', free: true, pro: true, custom: true },
  ]},
  { category: 'Academics', features: [
    { name: 'Report Cards', free: 'Basic', pro: 'Advanced', custom: 'Advanced' },
    { name: 'Score Types & Weights', free: false, pro: true, custom: true },
    { name: 'Homework Management', free: false, pro: true, custom: true },
    { name: 'AI Grading Assistant', free: false, pro: true, custom: true },
    { name: 'AI Quiz Generator', free: false, pro: true, custom: true },
  ]},
  { category: 'Portals', features: [
    { name: 'Students Portal', free: false, pro: true, custom: true },
    { name: 'Parents Portal', free: false, pro: true, custom: true },
    { name: 'Director Portal', free: false, pro: true, custom: true },
    { name: 'Accountant Portal', free: false, pro: false, custom: true },
    { name: 'Librarian Portal', free: false, pro: false, custom: true },
  ]},
  { category: 'AI & Features', features: [
    { name: 'Video Lessons', free: false, pro: true, custom: true },
    { name: 'Student AI Chat', free: false, pro: true, custom: true },
    { name: 'ID Card Generator', free: false, pro: false, custom: true },
    { name: 'Custom Branding', free: false, pro: true, custom: true },
    { name: 'Data Import/Export', free: false, pro: true, custom: true },
    { name: 'API Access', free: false, pro: false, custom: true },
  ]},
  { category: 'Support', features: [
    { name: 'Email Support', free: true, pro: true, custom: true },
    { name: 'Chat Support', free: false, pro: false, custom: true },
    { name: 'WhatsApp Support', free: false, pro: false, custom: true },
    { name: 'Dedicated Manager', free: false, pro: false, custom: true },
    { name: 'Custom Training', free: false, pro: false, custom: true },
    { name: 'Partnership', free: true, pro: true, custom: true },
  ]},
];

const schoolTypeOptions = [
  { value: 'primary', label: 'Primary School' },
  { value: 'secondary', label: 'Secondary School' },
  { value: 'primary_secondary', label: 'Primary & Secondary' },
  { value: 'higher_institution', label: 'Higher Institution' },
];

function PlanCard({
  plan,
  isPopular,
  billingPeriod,
  studentCount,
  schoolType,
}: {
  plan: PlanData;
  isPopular: boolean;
  billingPeriod: 'session' | 'term';
  studentCount: number;
  schoolType: string;
}) {
  const Icon = planIcons[plan.name] || GraduationCap;
  const features = JSON.parse(plan.features || '[]') as string[];

  const isPerStudent = plan.pricingType === 'per_student';
  const isFree = plan.pricingType === 'free';
  const isCustom = plan.pricingType === 'custom';

  const pricingRecord = plan.pricing?.find(p => p.schoolType === schoolType);
  const unitPrice = billingPeriod === 'session' ? pricingRecord?.sessionPrice : pricingRecord?.termPrice;
  const totalPrice = isPerStudent && unitPrice ? unitPrice * studentCount : plan.price;
  const periodLabel = billingPeriod === 'session' ? 'session' : 'term';

  return (
    <motion.div
      variants={slideUp}
      className={`relative bg-white rounded-2xl border-2 p-6 md:p-8 flex flex-col transition-all duration-300 hover:shadow-xl h-full ${
        isPopular
          ? 'border-emerald-500 shadow-lg shadow-emerald-500/10 ring-4 ring-emerald-500/5 scale-[1.02] md:scale-105'
          : 'border-gray-200 hover:border-gray-300 hover:shadow-gray-200/50'
      }`}
    >
      {isPopular && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
          <div className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-4 py-1.5 rounded-full text-xs font-bold shadow-lg shadow-emerald-500/30 flex items-center gap-1">
            <Star className="h-3 w-3 fill-white" />
            Most Popular
          </div>
        </div>
      )}

      <div className="mb-6">
        <div className="flex items-center gap-3 mb-3">
          <div className={`w-12 h-12 rounded-xl ${planIconBg[plan.name] || 'bg-gray-100 text-gray-600'} flex items-center justify-center`}>
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900">{plan.displayName}</h3>
            <p className="text-xs text-gray-500 capitalize">{plan.name} plan</p>
          </div>
        </div>
        <p className="text-sm text-gray-500 leading-relaxed">
          {planDescriptions[plan.name] || 'A comprehensive plan for your school.'}
        </p>
      </div>

      {/* Price */}
      <div className="mb-6 pb-6 border-b border-gray-100">
        {isFree ? (
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-bold text-gray-900">Free</span>
            <span className="text-sm text-gray-500">forever</span>
          </div>
        ) : isCustom ? (
          <p className="text-sm text-gray-500 italic">Custom quote — contact us</p>
        ) : isPerStudent && unitPrice ? (
          <div>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-bold text-gray-900">₦{unitPrice.toLocaleString()}</span>
              <span className="text-sm text-gray-500">/student/{periodLabel}</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Total: ₦{totalPrice.toLocaleString()} for {studentCount} students/{periodLabel}
            </p>
            {billingPeriod === 'term' && pricingRecord?.sessionPrice && (
              <p className="text-xs text-gray-400">
                Or ₦{pricingRecord.sessionPrice.toLocaleString()}/student/session
              </p>
            )}
            {billingPeriod === 'session' && pricingRecord?.termPrice && (
              <p className="text-xs text-gray-400">
                Or ₦{pricingRecord.termPrice.toLocaleString()}/student/term
              </p>
            )}
          </div>
        ) : null}
      </div>

      {/* Features */}
      <ul className="flex-1 space-y-3 mb-8">
        {features.map((feature, idx) => (
          <li key={idx} className="flex items-start gap-2.5 text-sm">
            <Check className={`h-4 w-4 shrink-0 mt-0.5 ${
              isPopular ? 'text-emerald-500' : 'text-gray-400'
            }`} />
            <span className="text-gray-700">{feature}</span>
          </li>
        ))}
      </ul>

      {/* CTA Button */}
      {isCustom ? (
        <a
          href="https://wa.me/2349152929772?text=Hello%20Skoolar%20Admin%2C%20I%27m%20interested%20in%20a%20Custom%20Plan%20for%20my%20school.%20Please%20provide%20me%20with%20a%20quote%20and%20more%20details."
          target="_blank"
          rel="noopener noreferrer"
          className="block"
        >
          <Button className="w-full h-11 font-semibold text-sm bg-white border-2 border-gray-200 hover:border-gray-300 text-gray-900 hover:bg-gray-50" variant="outline">
            <span className="flex items-center justify-center gap-2"><MessageSquare className="h-4 w-4" /> Contact Us</span>
          </Button>
        </a>
      ) : (
        <Link href="/register" className="block">
          <Button
            className={`w-full h-11 font-semibold text-sm transition-all ${
              isPopular
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-lg shadow-emerald-500/25'
                : isFree
                ? 'bg-gray-900 hover:bg-gray-800 text-white'
                : 'bg-white border-2 border-gray-200 hover:border-gray-300 text-gray-900 hover:bg-gray-50'
            }`}
            variant={isPopular ? 'default' : 'outline'}
          >
            {isFree ? (
              <span className="flex items-center justify-center gap-2"><Rocket className="h-4 w-4" /> Get Started Free</span>
            ) : (
              <span className="flex items-center justify-center gap-2"><Zap className="h-4 w-4" /> Get Started</span>
            )}
          </Button>
        </Link>
      )}
    </motion.div>
  );
}

function FeatureCell({ value }: { value: boolean | string }) {
  if (typeof value === 'boolean') {
    return value ? (
      <Check className="h-5 w-5 text-emerald-500 mx-auto" />
    ) : (
      <X className="h-5 w-5 text-gray-300 mx-auto" />
    );
  }
  return <span className="text-sm text-gray-700 font-medium">{value}</span>;
}

export default function PricingPage() {
  const [plans, setPlans] = useState<PlanData[]>([]);
  const [loading, setLoading] = useState(true);
  const [billingPeriod, setBillingPeriod] = useState<'session' | 'term'>('session');
  const [studentCount, setStudentCount] = useState(100);
  const [schoolType, setSchoolType] = useState('primary');

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const res = await fetch('/api/plans');
        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          setPlans(defaultPlans);
          return;
        }
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setPlans(json.data);
        } else {
          setPlans(defaultPlans);
        }
      } catch {
        setPlans(defaultPlans);
      } finally {
        setLoading(false);
      }
    };
    fetchPlans();
  }, []);

  const displayPlans = plans.length > 0 ? plans : defaultPlans;

  return (
    <PublicLayout>
      {/* Hero */}
      <section className="relative overflow-hidden pt-32 pb-24 md:pt-48 md:pb-40">
        <div className="absolute inset-0 mesh-bg opacity-40" />
        <div className="absolute top-0 inset-x-0 h-40 bg-gradient-to-b from-white to-transparent z-0" />
        {/* Background decorations */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-20 -left-20 w-80 h-80 bg-white/5 rounded-full blur-3xl animate-pulse" />
          <div className="absolute -bottom-20 -right-20 w-96 h-96 bg-emerald-400/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
          <div className="absolute top-1/3 right-[15%] opacity-10 text-5xl">🏫</div>
          <div className="absolute bottom-1/4 left-[10%] opacity-10 text-4xl">🎓</div>
        </div>

        <motion.div 
          className="max-w-4xl mx-auto text-center relative z-10"
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
        >
          <motion.div 
            variants={fadeIn}
            className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 mb-6"
          >
            <Sparkles className="h-4 w-4 text-amber-300" />
            <span className="text-sm font-medium">Simple, Transparent Pricing</span>
          </motion.div>
          <motion.h1 
            variants={slideUp}
            className="text-5xl md:text-7xl lg:text-[5.5rem] font-bold text-gray-900 tracking-tighter leading-[0.9] mb-8"
          >
            Invest in Your <span className="text-indigo-600 italic">Academic</span> Future
          </motion.h1>
          <motion.p 
            variants={slideUp}
            className="text-xl md:text-2xl font-medium text-gray-500 mb-12 max-w-3xl mx-auto leading-relaxed"
          >
            Simple, transparent pricing designed to grow with your institution. 
            All plans include exhaustive features and world-class support.
          </motion.p>

          {/* Billing & Student Count */}
          <motion.div 
            variants={scaleIn}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <div className="inline-flex items-center gap-1 bg-gray-100/50 p-1.5 rounded-2xl backdrop-blur-sm border border-white/40 shadow-inner">
              <button
                onClick={() => setBillingPeriod('session')}
                className={`px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${
                  billingPeriod === 'session'
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-gray-400 hover:text-gray-900 hover:bg-white/40'
                }`}
              >
                Per Session
              </button>
              <button
                onClick={() => setBillingPeriod('term')}
                className={`px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${
                  billingPeriod === 'term'
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-gray-400 hover:text-gray-900 hover:bg-white/40'
                }`}
              >
                Per Term
              </button>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Building2 className="h-4 w-4" />
              <span>Type:</span>
              <select
                value={schoolType}
                onChange={(e) => setSchoolType(e.target.value)}
                className="h-9 rounded-lg border border-gray-200 px-2 text-sm font-medium text-gray-900 bg-white/80"
              >
                {schoolTypeOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Users className="h-4 w-4" />
              <span>Students:</span>
              <input
                type="number"
                min={1}
                max={99999}
                value={studentCount}
                onChange={(e) => setStudentCount(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-20 h-9 rounded-lg border border-gray-200 px-2 text-center text-sm font-medium text-gray-900 bg-white/80"
              />
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* Trust badges */}
      <motion.div 
        className="bg-white border-b"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        viewport={{ once: true }}
      >
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex flex-wrap items-center justify-center gap-6 md:gap-10 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-500" />
              <span>SSL Secured</span>
            </div>
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-emerald-500" />
              <span>Paystack Integrated</span>
            </div>
            <div className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-emerald-500" />
              <span>Free Plan Available</span>
            </div>
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-emerald-500" />
              <span>Bank Transfer & Online Payment</span>
            </div>
          </div>
        </div>
      </motion.div>

       {/* Plans Grid */}
      <div className="max-w-6xl mx-auto px-4 py-16">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[600px] rounded-2xl" />
            ))}
          </div>
        ) : (
          <motion.div
            className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start max-w-5xl mx-auto"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
            variants={staggerContainer}
          >
            {displayPlans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                isPopular={plan.name === 'pro'}
                billingPeriod={billingPeriod}
                studentCount={studentCount}
                schoolType={schoolType}
              />
            ))}
          </motion.div>
        )}
      </div>

      {/* Custom Plan Card */}
      <div className="max-w-6xl mx-auto px-4 pb-16">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeIn}
        >
          <Card className="relative overflow-hidden border-2 border-dashed border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50 hover:shadow-xl transition-all duration-300">
            <div className="absolute top-4 right-4">
              <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px]">
                <Settings2 className="h-3 w-3 mr-1" />
                TAILORED
              </Badge>
            </div>
            <CardContent className="p-8 md:p-10">
              <div className="flex flex-col md:flex-row items-start md:items-center gap-6 md:gap-10">
                <div className="flex-shrink-0">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-200/50">
                    <SlidersHorizontal className="h-8 w-8 text-white" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">Custom Plan</h3>
                  <p className="text-gray-600 mb-4 max-w-2xl">
                    Need specific features for your school? Get a tailored plan designed just for you.
                    Pick and choose the features you need and pay only for what you use.
                  </p>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {['Custom Features', 'Flexible Limits', 'Dedicated Support', 'Tailored Pricing'].map((item, i) => (
                      <Badge key={i} variant="outline" className="bg-white/60 border-amber-200 text-amber-700 text-[11px]">
                        <Check className="h-3 w-3 mr-1 text-amber-500" />
                        {item}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex-shrink-0 w-full md:w-auto">
                  <a
                    href="https://wa.me/2349152929772?text=Hello%20Skoolar%20Admin%2C%20I%27m%20interested%20in%20a%20Custom%20Plan%20for%20my%20school.%20Please%20provide%20me%20with%20a%20quote%20and%20more%20details."
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full md:w-auto"
                  >
                    <Button
                      size="lg"
                      className="w-full md:w-auto bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg shadow-amber-200/50 gap-2"
                    >
                      <MessageSquare className="h-5 w-5" />
                      Get Custom Quote on WhatsApp
                    </Button>
                  </a>
                  <p className="text-[11px] text-gray-400 text-center mt-2">+234 915 292 9772</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Key Features Highlight */}
      <div className="bg-gray-50 py-16">
        <div className="max-w-6xl mx-auto px-4">
          <motion.div 
            className="text-center mb-12"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeIn}
          >
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 mb-4">Why Skoolar?</Badge>
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Everything You Need to Run Your School</h2>
            <p className="text-gray-500 max-w-2xl mx-auto">From attendance to AI-powered grading, Skoolar covers every aspect of school management.</p>
          </motion.div>

          <motion.div 
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            variants={staggerContainer}
          >
            {[
              { icon: Smartphone, title: 'Mobile Friendly', desc: 'Access on any device. Teachers and parents love the responsive design.', color: 'bg-blue-100 text-blue-600' },
              { icon: Cpu, title: 'AI-Powered', desc: 'AI grading assistant, quiz generator, and smart analytics save hours.', color: 'bg-purple-100 text-purple-600' },
              { icon: Database, title: 'Secure & Reliable', desc: 'Enterprise-grade security with automatic backups and 99.9% uptime.', color: 'bg-emerald-100 text-emerald-600' },
              { icon: Globe, title: 'Parent Engagement', desc: 'Real-time updates, messaging, and report cards keep parents connected.', color: 'bg-amber-100 text-amber-600' },
              { icon: BarChart3, title: 'Smart Analytics', desc: 'Track performance, attendance trends, and school-wide metrics.', color: 'bg-rose-100 text-rose-600' },
              { icon: BookOpen, title: 'Rich Content', desc: 'Video lessons, stories library, and learning hub for students.', color: 'bg-indigo-100 text-indigo-600' },
              { icon: MessageCircle, title: 'Communication', desc: 'In-app messaging, announcements, and notice boards.', color: 'bg-cyan-100 text-cyan-600' },
              { icon: TrendingUp, title: 'Scalable', desc: 'From 100 to 5,000+ students — grow without limits.', color: 'bg-violet-100 text-violet-600' },
            ].map((feature, idx) => {
              const Icon = feature.icon;
              return (
                <motion.div key={idx} variants={fadeIn}>
                  <Card className="border-gray-100 hover:shadow-lg hover:border-gray-200 transition-all duration-300 h-full">
                    <CardContent className="p-6">
                      <div className={`w-11 h-11 rounded-xl ${feature.color} flex items-center justify-center mb-4`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <h3 className="font-bold text-gray-900 mb-2">{feature.title}</h3>
                      <p className="text-sm text-gray-500 leading-relaxed">{feature.desc}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </div>

      {/* Feature Comparison Table */}
      <div className="max-w-6xl mx-auto px-4 py-16">
        <div className="text-center mb-10">
          <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 mb-4">Compare Plans</Badge>
          <h2 className="text-3xl font-bold text-gray-900 mb-3">Detailed Feature Comparison</h2>
          <p className="text-gray-500 max-w-lg mx-auto">See exactly what&apos;s included in each plan to make the best decision for your school.</p>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-gray-200 shadow-sm">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left p-4 text-sm font-semibold text-gray-700 w-1/4">Feature</th>
                {displayPlans.map((plan) => {
                  const Icon = planIcons[plan.name] || GraduationCap;
                  const isPopular = plan.name === 'pro';
                  return (
                    <th
                      key={plan.id}
                      className={`p-4 text-center font-semibold text-sm ${
                        isPopular ? 'bg-emerald-50 text-emerald-700' : 'text-gray-700'
                      }`}
                    >
                      <div className="flex flex-col items-center gap-1">
                        <Icon className="h-4 w-4" />
                        <span>{plan.displayName}</span>
                        {plan.pricingType === 'per_student' && (
                          <Badge className="text-[9px] bg-emerald-100 text-emerald-700 border-0">per student</Badge>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {comparisonFeatures.map((category) => (
                <React.Fragment key={category.category}>
                  {/* Category Header */}
                  <tr>
                    <td
                      colSpan={4}
                      className="bg-gray-50 px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider"
                    >
                      {category.category}
                    </td>
                  </tr>
                  {/* Features */}
                  {category.features.map((feature) => (
                    <tr key={feature.name} className="border-t border-gray-100 hover:bg-gray-50/50 transition-colors">
                      <td className="p-4 text-sm text-gray-700 font-medium">{feature.name}</td>
                      <td className="p-4 text-center"><FeatureCell value={feature.free} /></td>
                      <td className="p-4 text-center bg-emerald-50/50"><FeatureCell value={feature.pro} /></td>
                      <td className="p-4 text-center"><FeatureCell value={feature.custom} /></td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Testimonials */}
      <div className="bg-gradient-to-br from-gray-50 to-white py-16">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-10">
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 mb-4">Testimonials</Badge>
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Loved by Schools Across Nigeria</h2>
            <p className="text-gray-500">See what educators are saying about Skoolar.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t, idx) => (
              <Card key={idx} className="border-gray-100 hover:shadow-lg transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center gap-1 mb-4">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star key={star} className="h-4 w-4 text-amber-400 fill-amber-400" />
                    ))}
                  </div>
                  <p className="text-gray-700 text-sm leading-relaxed mb-4 italic">&ldquo;{t.content}&rdquo;</p>
                  <Separator className="mb-4" />
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center text-lg">
                      {t.avatar}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{t.name}</p>
                      <p className="text-xs text-gray-500">{t.role}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] ml-auto bg-emerald-50 text-emerald-700 border-emerald-200">
                      {t.plan}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* FAQ */}
      <div className="max-w-3xl mx-auto px-4 py-16">
        <div className="text-center mb-10">
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 mb-4">FAQ</Badge>
          <h2 className="text-3xl font-bold text-gray-900 mb-3">Frequently Asked Questions</h2>
          <p className="text-gray-500">Everything you need to know about our pricing and plans.</p>
        </div>

        <Accordion type="single" collapsible className="space-y-3">
          {faqItems.map((faq, idx) => (
            <AccordionItem
              key={idx}
              value={`faq-${idx}`}
              className="bg-white rounded-xl border border-gray-200 px-6 shadow-sm data-[state=open]:shadow-md transition-shadow"
            >
              <AccordionTrigger className="text-left text-sm font-semibold text-gray-900 hover:no-underline py-4">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="text-sm text-gray-600 leading-relaxed pb-4">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>

      {/* CTA Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 py-20 px-4">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-20 -right-20 w-80 h-80 bg-white/5 rounded-full blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-96 h-96 bg-emerald-400/10 rounded-full blur-3xl" />
        </div>
        <motion.div 
          className="max-w-3xl mx-auto text-center relative z-10"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={slideUp}
        >
          <div className="w-16 h-16 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center mx-auto mb-6">
            <Rocket className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Ready to Transform Your School?</h2>
          <p className="text-emerald-100 text-lg mb-8 max-w-xl mx-auto leading-relaxed">
            Join hundreds of schools already using Skoolar to streamline operations, engage parents, and boost academic outcomes.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register">
              <Button className="bg-white text-emerald-700 hover:bg-emerald-50 gap-2 shadow-lg px-8 h-12 font-semibold text-base">
                <Zap className="h-5 w-5" /> Get Started Free
              </Button>
            </Link>
            <a href="mailto:hello@skoolar.com">
              <Button variant="ghost" className="text-white/80 hover:text-white hover:bg-white/10 gap-2 h-12">
                <Headphones className="h-5 w-5" /> Contact Sales
              </Button>
            </a>
          </div>
          <p className="text-emerald-200/60 text-xs mt-6">
            Start with the Free plan &bull; Upgrade anytime &bull; Cancel anytime
          </p>
        </motion.div>
      </div>

      {/* Trust badges */}
      <div className="bg-white py-8">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex flex-wrap items-center justify-center gap-8 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-500" />
              <span>SSL Secured</span>
            </div>
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-emerald-500" />
              <span>Paystack Integrated</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-emerald-500" />
              <span>Start Free, Upgrade Anytime</span>
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
