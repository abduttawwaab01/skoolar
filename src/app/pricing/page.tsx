'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Check, X, Sparkles, GraduationCap, Building2, Users, Shield, BarChart3,
  Clock, Headphones, Zap, Star, ArrowRight, ChevronDown, ChevronUp,
  Crown, Rocket, Gift, Lock, MessageCircle, BookOpen, CreditCard,
  Smartphone, Globe, Database, Cpu, TrendingUp, Award, ShieldCheck
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

interface PlanData {
  id: string;
  name: string;
  displayName: string;
  price: number;
  yearlyPrice: number | null;
  maxStudents: number;
  maxTeachers: number;
  maxClasses: number;
  features: string;
  isActive: boolean;
}

const defaultPlans = [
  {
    id: '1', name: 'basic', displayName: 'Basic', price: 0, yearlyPrice: 0,
    maxStudents: 100, maxTeachers: 10, maxClasses: 15,
    features: JSON.stringify(['Up to 100 students', 'Up to 10 teachers', 'Basic attendance tracking', 'Simple report cards', 'Calendar & events', 'Notice board', 'Email support']),
    isActive: true,
  },
  {
    id: '2', name: 'standard', displayName: 'Standard', price: 15000, yearlyPrice: 150000,
    maxStudents: 500, maxTeachers: 30, maxClasses: 30,
    features: JSON.stringify(['Up to 500 students', 'Up to 30 teachers', 'Advanced attendance with QR scanning', 'Comprehensive report cards', 'AI Grading Assistant', 'Homework management', 'Video lessons', 'Parent portal', 'In-app messaging', 'Priority email & chat support']),
    isActive: true,
  },
  {
    id: '3', name: 'premium', displayName: 'Premium', price: 35000, yearlyPrice: 350000,
    maxStudents: 2000, maxTeachers: 100, maxClasses: 80,
    features: JSON.stringify(['Up to 2,000 students', 'Up to 100 teachers', 'Everything in Standard', 'AI Quiz Generator', 'ID Card generator', 'Multi-school support', 'Advanced analytics & AI insights', 'Data import/export', 'Transport management', 'Library management', 'Custom branding', 'Dedicated support manager', 'API access']),
    isActive: true,
  },
  {
    id: '4', name: 'enterprise', displayName: 'Enterprise', price: 75000, yearlyPrice: 750000,
    maxStudents: 5000, maxTeachers: 300, maxClasses: 200,
    features: JSON.stringify(['Unlimited students', 'Up to 300 teachers', 'Everything in Premium', 'White-label solution', 'Custom integrations', 'On-premise deployment option', 'SLA guarantee 99.9%', 'Advanced security & SSO', 'Custom training & onboarding', 'Dedicated engineering support', 'Executive dashboard']),
    isActive: true,
  },
];

const planIcons: Record<string, React.ElementType> = {
  basic: GraduationCap,
  standard: Building2,
  premium: Crown,
  enterprise: Shield,
};

const planGradients: Record<string, string> = {
  basic: 'from-gray-100 to-gray-50',
  standard: 'from-blue-100 to-blue-50',
  premium: 'from-emerald-100 to-emerald-50',
  enterprise: 'from-amber-100 to-amber-50',
};

const planIconBg: Record<string, string> = {
  basic: 'bg-gray-100 text-gray-600',
  standard: 'bg-blue-100 text-blue-600',
  premium: 'bg-emerald-100 text-emerald-600',
  enterprise: 'bg-amber-100 text-amber-600',
};

const planDescriptions: Record<string, string> = {
  basic: 'Perfect for small schools just getting started with digital management.',
  standard: 'Ideal for growing schools that need advanced features and parent engagement.',
  premium: 'Best for established schools wanting AI-powered tools and customization.',
  enterprise: 'Designed for school groups and large institutions needing full control.',
};

const faqItems = [
  {
    question: 'Can I switch plans at any time?',
    answer: 'Yes, you can upgrade or downgrade your plan at any time. When upgrading, you\'ll be charged the prorated difference. When downgrading, the change takes effect at the start of your next billing cycle.',
  },
  {
    question: 'Is there a free trial?',
    answer: 'Yes! All paid plans come with a 14-day free trial. No credit card required to start. You\'ll have full access to all features during the trial period.',
  },
  {
    question: 'What happens when my trial ends?',
    answer: 'After the trial, you can choose to subscribe to any plan. If you don\'t subscribe, your account will automatically move to the Free plan with limited features. All your data will be preserved.',
  },
  {
    question: 'Do you offer discounts for multiple schools?',
    answer: 'Yes, we offer special pricing for school groups, districts, and educational networks. Contact our sales team at sales@skoolar.com for custom enterprise pricing.',
  },
  {
    question: 'What payment methods do you accept?',
    answer: 'We accept bank transfers, debit cards, and credit cards through our secure Paystack integration. For Enterprise plans, we also support purchase orders and invoicing.',
  },
  {
    question: 'Is my data safe and secure?',
    answer: 'Absolutely. We use industry-standard encryption (SSL/TLS), regular backups, and enterprise-grade infrastructure. Enterprise plans include additional security features like SSO and custom data residency options.',
  },
  {
    question: 'Can I cancel my subscription?',
    answer: 'Yes, you can cancel at any time with no penalties. Your access continues until the end of your current billing period. We also offer a 30-day money-back guarantee for new subscriptions.',
  },
  {
    question: 'Do you provide training and onboarding?',
    answer: 'Yes, all plans include access to our knowledge base and video tutorials. Standard plans include email support, Premium plans include dedicated onboarding sessions, and Enterprise plans include custom training programs.',
  },
];

const testimonials = [
  {
    name: 'Mrs. Adebayo',
    role: 'Proprietress, Graceville Academy',
    content: 'Skoolar has transformed how we manage our school. The attendance and grading features save us hours every week.',
    plan: 'Standard',
    avatar: '👩‍🏫',
  },
  {
    name: 'Mr. Okonkwo',
    role: 'Principal, Apex College',
    content: 'The AI grading assistant is incredible. It has reduced our teachers\' workload by 40% while maintaining quality.',
    plan: 'Premium',
    avatar: '👨‍💼',
  },
  {
    name: 'Dr. Fatimah',
    role: 'Director, Horizon Schools',
    content: 'Managing 5 schools from one dashboard is a game-changer. Enterprise plan is worth every naira.',
    plan: 'Enterprise',
    avatar: '👩‍💼',
  },
];

const comparisonFeatures = [
  { category: 'Core', features: [
    { name: 'Student Management', basic: '100', standard: '500', premium: '2,000', enterprise: 'Unlimited' },
    { name: 'Teacher Management', basic: '10', standard: '30', premium: '100', enterprise: '300' },
    { name: 'Class Management', basic: '15', standard: '30', premium: '80', enterprise: '200' },
    { name: 'Attendance Tracking', basic: true, standard: true, premium: true, enterprise: true },
  ]},
  { category: 'Academics', features: [
    { name: 'Report Cards', basic: 'Basic', standard: 'Advanced', premium: 'Advanced', enterprise: 'Advanced' },
    { name: 'Score Types & Weights', basic: false, standard: true, premium: true, enterprise: true },
    { name: 'Homework Management', basic: false, standard: true, premium: true, enterprise: true },
    { name: 'AI Grading Assistant', basic: false, standard: true, premium: true, enterprise: true },
    { name: 'AI Quiz Generator', basic: false, standard: false, premium: true, enterprise: true },
  ]},
  { category: 'Communication', features: [
    { name: 'Parent Portal', basic: false, standard: true, premium: true, enterprise: true },
    { name: 'In-App Messaging', basic: false, standard: true, premium: true, enterprise: true },
    { name: 'Announcements', basic: true, standard: true, premium: true, enterprise: true },
    { name: 'Notice Board', basic: true, standard: true, premium: true, enterprise: true },
  ]},
  { category: 'Advanced', features: [
    { name: 'Video Lessons', basic: false, standard: true, premium: true, enterprise: true },
    { name: 'Student AI Chat', basic: false, standard: true, premium: true, enterprise: true },
    { name: 'ID Card Generator', basic: false, standard: false, premium: true, enterprise: true },
    { name: 'Multi-School Support', basic: false, standard: false, premium: true, enterprise: true },
    { name: 'Custom Branding', basic: false, standard: false, premium: true, enterprise: true },
    { name: 'Data Import/Export', basic: false, standard: false, premium: true, enterprise: true },
    { name: 'API Access', basic: false, standard: false, premium: true, enterprise: true },
  ]},
  { category: 'Support', features: [
    { name: 'Email Support', basic: true, standard: true, premium: true, enterprise: true },
    { name: 'Chat Support', basic: false, standard: true, premium: true, enterprise: true },
    { name: 'Dedicated Manager', basic: false, standard: false, premium: true, enterprise: true },
    { name: 'Custom Training', basic: false, standard: false, premium: false, enterprise: true },
    { name: 'SLA Guarantee', basic: false, standard: false, premium: false, enterprise: true },
  ]},
];

function PlanCard({
  plan,
  isPopular,
  billingPeriod,
}: {
  plan: PlanData;
  isPopular: boolean;
  billingPeriod: 'monthly' | 'yearly';
}) {
  const Icon = planIcons[plan.name] || GraduationCap;
  const features = JSON.parse(plan.features || '[]') as string[];
  const price = billingPeriod === 'yearly' && plan.yearlyPrice ? plan.yearlyPrice / 12 : plan.price;
  const yearlySavings = plan.yearlyPrice ? (plan.price * 12 - plan.yearlyPrice) : 0;

  return (
    <motion.div
      variants={slideUp}
      className={`relative bg-white rounded-2xl border-2 p-6 md:p-8 flex flex-col transition-all duration-300 hover:shadow-xl h-full ${
        isPopular
          ? 'border-emerald-500 shadow-lg shadow-emerald-500/10 ring-4 ring-emerald-500/5 scale-[1.02] md:scale-105'
          : 'border-gray-200 hover:border-gray-300 hover:shadow-gray-200/50'
      }`}
    >
      {/* Popular Badge */}
      {isPopular && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
          <div className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-4 py-1.5 rounded-full text-xs font-bold shadow-lg shadow-emerald-500/30 flex items-center gap-1">
            <Star className="h-3 w-3 fill-white" />
            Most Popular
          </div>
        </div>
      )}

      {/* Plan Header */}
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
        <div className="flex items-baseline gap-1">
          {plan.price === 0 ? (
            <span className="text-4xl font-bold text-gray-900">Free</span>
          ) : (
            <>
              <span className="text-4xl font-bold text-gray-900">
                ₦{Math.round(price).toLocaleString()}
              </span>
              <span className="text-sm text-gray-500">/month</span>
            </>
          )}
        </div>
        {billingPeriod === 'yearly' && plan.yearlyPrice && plan.price > 0 && (
          <div className="mt-2 flex items-center gap-2">
            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]">
              Save ₦{yearlySavings.toLocaleString()}/year
            </Badge>
            <span className="text-xs text-gray-400">₦{plan.yearlyPrice.toLocaleString()} billed annually</span>
          </div>
        )}
        {billingPeriod === 'monthly' && plan.price > 0 && plan.yearlyPrice && (
          <p className="text-xs text-gray-400 mt-1">
            Or ₦{plan.yearlyPrice.toLocaleString()}/year — save 17%
          </p>
        )}
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
      <Link href="/" className="block">
        <Button
          className={`w-full h-11 font-semibold text-sm transition-all ${
            isPopular
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-lg shadow-emerald-500/25'
              : plan.price === 0
              ? 'bg-gray-900 hover:bg-gray-800 text-white'
              : 'bg-white border-2 border-gray-200 hover:border-gray-300 text-gray-900 hover:bg-gray-50'
          }`}
          variant={isPopular ? 'default' : 'outline'}
        >
          {plan.price === 0 ? (
            <span className="flex items-center justify-center gap-2"><Rocket className="h-4 w-4" /> Get Started Free</span>
          ) : (
            <span className="flex items-center justify-center gap-2"><Zap className="h-4 w-4" /> Start Free Trial</span>
          )}
        </Button>
      </Link>
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
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const res = await fetch('/api/plans');
        const json = await res.json();
        if (json.success) setPlans(json.data || []);
      } catch {
        /* silent */
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

          {/* Billing Toggle */}
          <motion.div 
            variants={scaleIn}
            className="inline-flex items-center gap-1 bg-gray-100/50 p-1.5 rounded-2xl backdrop-blur-sm border border-white/40 shadow-inner"
          >
            <button
              onClick={() => setBillingPeriod('monthly')}
              className={`px-8 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${
                billingPeriod === 'monthly'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-gray-400 hover:text-gray-900 hover:bg-white/40'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingPeriod('yearly')}
              className={`px-8 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${
                billingPeriod === 'yearly'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-gray-400 hover:text-gray-900 hover:bg-white/40'
              }`}
            >
              Yearly
              <Badge className="bg-emerald-500 text-white text-[10px] border-0 px-2 font-bold">SAVE 17%</Badge>
            </button>
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
              <span>14-Day Free Trial</span>
            </div>
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-emerald-500" />
              <span>No Credit Card Required</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Plans Grid */}
      <div className="max-w-6xl mx-auto px-4 py-16">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-[600px] rounded-2xl" />
            ))}
          </div>
        ) : (
          <motion.div 
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-start"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
            variants={staggerContainer}
          >
            {displayPlans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                isPopular={plan.name === 'premium'}
                billingPeriod={billingPeriod}
              />
            ))}
          </motion.div>
        )}
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
                  const isPopular = plan.name === 'premium';
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
                      colSpan={5}
                      className="bg-gray-50 px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider"
                    >
                      {category.category}
                    </td>
                  </tr>
                  {/* Features */}
                  {category.features.map((feature) => (
                    <tr key={feature.name} className="border-t border-gray-100 hover:bg-gray-50/50 transition-colors">
                      <td className="p-4 text-sm text-gray-700 font-medium">{feature.name}</td>
                      <td className="p-4 text-center"><FeatureCell value={feature.basic} /></td>
                      <td className="p-4 text-center bg-emerald-50/30"><FeatureCell value={feature.standard} /></td>
                      <td className="p-4 text-center bg-emerald-50/50"><FeatureCell value={feature.premium} /></td>
                      <td className="p-4 text-center"><FeatureCell value={feature.enterprise} /></td>
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
            <Link href="/">
              <Button className="bg-white text-emerald-700 hover:bg-emerald-50 gap-2 shadow-lg px-8 h-12 font-semibold text-base">
                <Zap className="h-5 w-5" /> Start Free Trial
              </Button>
            </Link>
            <a href="mailto:hello@skoolar.com">
              <Button variant="ghost" className="text-white/80 hover:text-white hover:bg-white/10 gap-2 h-12">
                <Headphones className="h-5 w-5" /> Contact Sales
              </Button>
            </a>
          </div>
          <p className="text-emerald-200/60 text-xs mt-6">
            No credit card required &bull; 14-day free trial &bull; Cancel anytime
          </p>
        </motion.div>
      </div>

      {/* Money-back guarantee */}
      <div className="bg-white py-8">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex flex-wrap items-center justify-center gap-8 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-emerald-500" />
              <span>30-Day Money-Back Guarantee</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-emerald-500" />
              <span>14-Day Free Trial</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-500" />
              <span>Enterprise-Grade Security</span>
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
