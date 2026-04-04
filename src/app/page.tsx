'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SessionProvider, useSession } from 'next-auth/react';
import { 
  School, GraduationCap, Users, BookOpen, CreditCard, 
  Calendar, BarChart3, MessageSquare, Shield, ArrowRight,
  CheckCircle2, Zap, Lock, Sparkles, X, Menu, ArrowUpRight, ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AnnouncementTicker } from '@/components/platform/announcement-ticker';
import { Toaster } from 'sonner';
import { LoginPage } from '@/components/auth/login-page';
import { RegisterPage } from '@/components/auth/register-page';
import { motion, AnimatePresence } from 'framer-motion';
import { fadeIn, slideUp, staggerContainer, scaleIn } from '@/lib/motion-variants';
import { cn } from '@/lib/utils';

const features = [
  {
    icon: Users,
    title: 'Multi-Role Management',
    description: 'Comprehensive dashboards for School Admins, Teachers, Students, Parents, Accountants, Librarians, and Directors.'
  },
  {
    icon: BookOpen,
    title: 'Academic Management',
    description: 'Complete student records, attendance tracking, exam management, and automated report card generation.'
  },
  {
    icon: CreditCard,
    title: 'Payment Integration',
    description: 'Seamless fee management with Paystack integration for online payments and financial tracking.'
  },
  {
    icon: BarChart3,
    title: 'Analytics & Reports',
    description: 'Real-time analytics, performance insights, and exportable reports for data-driven decisions.'
  },
  {
    icon: MessageSquare,
    title: 'Communication Hub',
    description: 'Announcements, messaging, homework tracking, and parent-teacher communication all in one place.'
  },
  {
    icon: Calendar,
    title: 'School Calendar',
    description: 'Event management, academic scheduling, and term-based organization made simple.'
  }
];

const stats = [
  { value: '10+', label: 'User Roles' },
  { value: '50+', label: 'Features' },
  { value: '100%', label: 'Web-Based' },
  { value: 'AI-Powered', label: 'Smart Assistant' }
];

function PublicNavbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinks = [
    { href: '/features', label: 'Features' },
    { href: '/blog', label: 'Blog' },
    { href: '/stories', label: 'Stories' },
    { href: '/learning-hub', label: 'Learning Hub' },
    { href: '/pricing', label: 'Pricing' },
    { href: '/entrance', label: 'Entrance Exam' },
  ];

  const mobileNavLinks = [
    { href: '/features', label: 'Features' },
    { href: '/blog', label: 'Blog' },
    { href: '/stories', label: 'Stories' },
    { href: '/learning-hub', label: 'Learning Hub' },
    { href: '/pricing', label: 'Pricing' },
    { href: '/entrance', label: 'Entrance Exam' },
    { href: '/login', label: 'Log in' },
    { href: '/register', label: 'Register School' },
  ];

  return (
    <header className="sticky top-0 z-50 bg-white/70 backdrop-blur-xl border-b border-white/20 shadow-sm transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 lg:px-8 h-20 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-600 to-emerald-500 flex items-center justify-center shadow-lg shadow-indigo-200 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500">
            <School className="h-6 w-6 text-white" />
          </div>
          <span className="text-2xl font-bold text-gray-900 tracking-tighter uppercase italic">Skoolar</span>
        </Link>

        <nav className="hidden md:flex items-center gap-2 bg-gray-100/50 p-1.5 rounded-2xl backdrop-blur-sm border border-white/40">
          {navLinks.map((link) => {
            const isActive = pathname === link.href || pathname.startsWith(link.href + '/');
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all",
                  isActive
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-white/40'
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <Link href="/entrance">
            <Button variant="outline" size="sm" className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 font-bold text-xs uppercase tracking-widest rounded-xl transition-all">
              Entrance Exam
            </Button>
          </Link>
          <Link href="/login">
            <Button variant="ghost" size="sm" className="text-gray-900 font-bold text-xs uppercase tracking-widest hover:bg-transparent hover:text-indigo-600 transition-colors">
              Log in
            </Button>
          </Link>
          <Link href="/register">
            <Button size="sm" className="bg-gray-900 hover:bg-indigo-700 text-white shadow-xl shadow-gray-200 rounded-xl px-6 h-11 font-bold text-xs uppercase tracking-widest transition-all hover:scale-105 active:scale-95">
              Get Started
            </Button>
          </Link>
        </div>

        {/* Mobile menu button */}
        <button 
          className="md:hidden size-11 flex items-center justify-center rounded-2xl bg-gray-50 border border-gray-100 text-gray-600"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {/* Mobile Navigation */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-white/95 backdrop-blur-2xl border-t overflow-hidden"
          >
            <nav className="flex flex-col p-4 gap-2">
              {mobileNavLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="px-5 py-4 rounded-2xl text-sm font-bold uppercase tracking-widest bg-gray-50 hover:bg-indigo-50 hover:text-indigo-600 transition-all border border-transparent hover:border-indigo-100"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-emerald-50 via-white to-teal-50 py-20 md:py-28">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMtOS45NDEgMC0xOCA4LjA1OS0xOCAxOHM4LjA1OSAxOCAxOCAxOCAxOC04LjA1OSAxOC0xOC04LjA1OS0xOC0xOC0xOHptMCAzMmMtNy43MzIgMC0xNC02LjI2OC0xNC0xNHM2LjI2OC0xNCAxNC0xNCAxNCA2LjI2OCAxNCAxNC02LjI2OCAxNC0xNHoiIGZpbGw9IiNlMGEwZDQiIGZpbGwtb3BhY2l0eT0iLjEiLz48L2c+PC9zdmc+')] opacity-30"></div>
      
      <div className="max-w-6xl mx-auto px-4 relative">
        <motion.div 
          className="max-w-3xl mx-auto text-center"
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
        >
          <motion.div 
            variants={fadeIn}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-100 text-emerald-700 text-sm font-medium mb-6"
          >
            <Zap className="h-4 w-4" />
            <span>AI-Powered School Management</span>
          </motion.div>
          
          <motion.h1 
            variants={slideUp}
            className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 tracking-tight mb-6"
          >
            Modern School Management{' '}
            <span className="text-emerald-600">Made Simple</span>
          </motion.h1>
          
          <motion.p 
            variants={slideUp}
            className="text-lg md:text-xl text-gray-600 mb-8 max-w-2xl mx-auto"
          >
            Streamline admissions, academics, attendance, payments, and communications. 
            Everything your school needs in one powerful platform.
          </motion.p>
          
          <motion.div 
            variants={slideUp}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link href="/register">
              <Button size="lg" className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 h-12">
                Get Started Free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="border-gray-300 text-gray-700 hover:bg-gray-50 px-8">
                Log in to Dashboard
              </Button>
            </Link>
          </motion.div>
          
          <motion.div 
            variants={fadeIn}
            className="flex items-center justify-center gap-8 mt-8 text-sm text-gray-500"
          >
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span>No credit card required</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span>14-day free trial</span>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

function FeaturesSection() {
  return (
    <section className="py-20 bg-white">
      <div className="max-w-6xl mx-auto px-4">
        <motion.div 
          className="text-center mb-16"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeIn}
        >
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Everything Your School Needs
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            A comprehensive platform designed to simplify school administration 
            and enhance the learning experience.
          </p>
        </motion.div>
        
        <motion.div 
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-8"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          variants={staggerContainer}
        >
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.div 
                key={index}
                variants={slideUp}
                className="group relative p-8 rounded-[2rem] border-2 border-gray-50 bg-white hover:border-indigo-100 hover:shadow-2xl hover:shadow-indigo-500/5 transition-all duration-500 cursor-default"
              >
                <div className="absolute top-0 right-0 p-6 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ArrowUpRight className="size-6 text-indigo-400" />
                </div>
                <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mb-8 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500 shadow-inner">
                  <Icon className="h-8 w-8 text-indigo-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3 uppercase tracking-tight">
                  {feature.title}
                </h3>
                <p className="text-gray-500 text-sm font-medium leading-relaxed">
                  {feature.description}
                </p>
                <div className="mt-6 pt-6 border-t border-gray-50 flex items-center gap-2 text-[10px] font-bold text-indigo-600 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
                  Explore module <ChevronRight className="size-3" />
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}

function StatsSection() {
  return (
    <section className="py-16 bg-emerald-600">
      <div className="max-w-6xl mx-auto px-4">
        <motion.div 
          className="grid grid-cols-2 md:grid-cols-4 gap-8"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={staggerContainer}
        >
          {stats.map((stat, index) => (
            <motion.div 
              key={index} 
              variants={scaleIn}
              className="text-center"
            >
              <div className="text-3xl md:text-4xl font-bold text-white mb-1">
                {stat.value}
              </div>
              <div className="text-emerald-100 text-sm">
                {stat.label}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function CTASection() {
  return (
    <section className="py-20 bg-gradient-to-br from-gray-900 to-gray-800">
      <div className="max-w-4xl mx-auto px-4 text-center">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={slideUp}
        >
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to Transform Your School?
          </h2>
          <p className="text-gray-300 mb-8 text-lg">
            Join hundreds of schools already using Skoolar to streamline their operations.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/register">
              <Button size="lg" className="bg-emerald-500 hover:bg-emerald-600 text-white px-8">
                Start Free Trial
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="/pricing">
              <Button size="lg" variant="outline" className="border-gray-600 text-white hover:bg-gray-800 px-8">
                View Pricing
              </Button>
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function Footer() {
  const footerLinks = [
    { href: '/features', label: 'Features' },
    { href: '/blog', label: 'Blog' },
    { href: '/stories', label: 'Stories' },
    { href: '/learning-hub', label: 'Learning Hub' },
    { href: '/pricing', label: 'Pricing' },
    { href: '/entrance', label: 'Entrance Exam' },
    { href: '/privacy', label: 'Privacy Policy' },
    { href: '/cookies', label: 'Cookie Policy' },
  ];

  const socialLinks = [
    { name: 'Facebook', url: 'https://facebook.com/skoolar' },
    { name: 'Twitter', url: 'https://twitter.com/skoolar' },
    { name: 'Instagram', url: 'https://instagram.com/skoolar' },
    { name: 'LinkedIn', url: 'https://linkedin.com/company/skoolar' },
  ];

  return (
    <footer className="bg-gray-50 border-t py-12">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <School className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-gray-900">Skoolar</span>
          </div>
          
          <nav className="flex flex-wrap items-center justify-center gap-4 md:gap-6">
            {footerLinks.map((link) => (
              <Link 
                key={link.href} 
                href={link.href}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          
          <div className="flex items-center gap-3">
            {socialLinks.map((social) => (
              <a
                key={social.name}
                href={social.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-gray-500 hover:text-emerald-600 transition-colors"
              >
                {social.name}
              </a>
            ))}
          </div>
        </div>
        
        <div className="mt-8 pt-8 border-t text-center text-sm text-gray-500">
          © {new Date().getFullYear()} SKOOLAR | Odebunmi Tawwāb. All rights reserved.
        </div>
      </div>
    </footer>
  );
}

function HomeContent() {
  const { data: session, status } = useSession();
  
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
      </div>
    );
  }
  
  if (session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Welcome back!</h2>
          <p className="text-gray-600 mb-6">Redirecting to your dashboard...</p>
          <Link href="/dashboard">
            <Button>Go to Dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }
  
  return (
    <>
      <AnnouncementTicker />
      <PublicNavbar />
      <main>
        <HeroSection />
        <StatsSection />
        <FeaturesSection />
        <CTASection />
      </main>
      <Footer />
    </>
  );
}

export default function Home() {
  return (
    <SessionProvider>
      <HomeContent />
      <Toaster position="top-right" richColors closeButton />
    </SessionProvider>
  );
}
