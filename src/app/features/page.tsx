'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  School, GraduationCap, Users, BookOpen, CreditCard, 
  Calendar, BarChart3, MessageSquare, Shield, Zap, 
  FileText, Award, Bell, Settings, Video, Library,
  QrCode, ClipboardList, Search, Globe, Smartphone,
  Menu, X, FileText as FileTextIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const featureCategories = [
  {
    title: 'Academic Excellence',
    description: 'Complete academic management from curriculum to results',
    features: [
      { icon: BookOpen, title: 'Curriculum Management', desc: 'Organize subjects, classes, and academic structure.' },
      { icon: FileText, title: 'Exam & Assessment', desc: 'Create, administer, and grade exams with auto-scoring.' },
      { icon: Award, title: 'Report Cards', desc: 'Automated report card generation with templates.' },
      { icon: ClipboardList, title: 'Weekly Evaluations', desc: 'Track student progress weekly and share with parents.' },
      { icon: Video, title: 'Video Lessons', desc: 'Host and manage video content for remote learning.' },
    ],
  },
  {
    title: 'Student & Staff Management',
    description: 'Comprehensive profiles and ID card system',
    features: [
      { icon: Users, title: 'Multi-Role Users', desc: 'Admins, Teachers, Students, Parents, Accountants, Librarians, Directors.' },
      { icon: QrCode, title: 'Smart ID Cards', desc: 'Generate scannable ID cards with QR codes for attendance and verification.' },
      { icon: Search, title: 'Advanced Search', desc: 'Find anything across your school instantly.' },
      { icon: GraduationCap, title: 'Student Promotion', desc: 'Automated promotion workflow with history tracking.' },
      { icon: Smartphone, title: 'Attendance Scanning', desc: 'Use phone camera to mark attendance via QR.' },
    ],
  },
  {
    title: 'Communication & Engagement',
    description: 'Stay connected with every stakeholder',
    features: [
      { icon: MessageSquare, title: 'In-App Messaging', desc: 'Direct messaging between teachers, parents, and students.' },
      { icon: Bell, title: 'Announcements', desc: 'School-wide alerts and targeted communications.' },
      { icon: Calendar, title: 'Event Calendar', desc: 'Shared calendar with events, holidays, and exams.' },
      { icon: Globe, title: 'Learning Hub', desc: 'Public knowledge sharing and storytelling platform.' },
      { icon: Library, title: 'Library System', desc: 'Digital catalog with borrowing management.' },
    ],
  },
  {
    title: 'Finance & Administration',
    description: 'Simplify school finances and operations',
    features: [
      { icon: CreditCard, title: 'Payment Integration', desc: 'Accept online payments via Paystack.' },
      { icon: BarChart3, title: 'Analytics Dashboard', desc: 'Real-time insights on school performance.' },
      { icon: Shield, title: 'Platform Security', desc: 'Role-based access and secure data handling.' },
      { icon: Settings, title: 'Custom Branding', desc: 'Personalize with school colors, logo, and themes.' },
      { icon: Zap, title: 'AI Assistant', desc: 'AI-powered grading, homework help, and chat.' },
    ],
  },
];

export default function FeaturesPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50">
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <School className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold text-gray-900 tracking-tight">Skoolar</span>
          </Link>
          <nav className="hidden md:flex items-center gap-4">
            <Link href="/features" className="text-sm font-medium text-emerald-600">Features</Link>
            <Link href="/pricing" className="text-sm text-gray-600 hover:text-gray-900">Pricing</Link>
            <Link href="/learning-hub" className="text-sm text-gray-600 hover:text-gray-900">Learning Hub</Link>
            <Link href="/stories" className="text-sm text-gray-600 hover:text-gray-900">Stories</Link>
            <Link href="/entrance" className="text-sm text-gray-600 hover:text-gray-900">Entrance Exam</Link>
          </nav>
          <div className="hidden md:flex gap-2">
            <Link href="/login">
              <Button variant="ghost" size="sm">Log in</Button>
            </Link>
            <Link href="/register">
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700">Get Started</Button>
            </Link>
          </div>
          {/* Mobile menu toggle */}
          <button
            className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile menu dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t bg-white px-4 py-4 space-y-3 animate-in slide-in-from-top-2 fade-in">
            <Link href="/features" className="block text-sm font-medium text-emerald-600 py-2" onClick={() => setMobileMenuOpen(false)}>Features</Link>
            <Link href="/pricing" className="block text-sm text-gray-600 hover:text-gray-900 py-2" onClick={() => setMobileMenuOpen(false)}>Pricing</Link>
            <Link href="/learning-hub" className="block text-sm text-gray-600 hover:text-gray-900 py-2" onClick={() => setMobileMenuOpen(false)}>Learning Hub</Link>
            <Link href="/stories" className="block text-sm text-gray-600 hover:text-gray-900 py-2" onClick={() => setMobileMenuOpen(false)}>Stories</Link>
            <Link href="/entrance" className="flex items-center gap-2 text-sm font-medium text-emerald-700 py-2" onClick={() => setMobileMenuOpen(false)}>
              <FileTextIcon className="h-4 w-4" /> Entrance Exam
            </Link>
            <div className="flex gap-2 pt-2 border-t">
              <Link href="/login" className="flex-1" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="outline" size="sm" className="w-full">Log in</Button>
              </Link>
              <Link href="/register" className="flex-1" onClick={() => setMobileMenuOpen(false)}>
                <Button size="sm" className="w-full bg-emerald-600 hover:bg-emerald-700">Get Started</Button>
              </Link>
            </div>
          </div>
        )}
      </header>

      <main className="max-w-6xl mx-auto px-4 py-16">
        {/* Hero */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
            Everything Your School Needs,
            <span className="text-emerald-600 block">All in One Platform</span>
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
            From academics and attendance to payments and parent engagement, Skoolar has you covered.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/register">
              <Button size="lg" className="bg-emerald-600 hover:bg-emerald-700 px-8">
                Start Free Trial
              </Button>
            </Link>
            <Link href="/pricing">
              <Button size="lg" variant="outline" className="px-8">
                View Pricing
              </Button>
            </Link>
          </div>
        </div>

        {/* Feature Categories */}
        <div className="space-y-16">
          {featureCategories.map((category, idx) => (
            <section key={idx} id={category.title.toLowerCase().replace(/\s+/g, '-')}>
              <div className="text-center mb-8">
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900">{category.title}</h2>
                <p className="text-gray-600 mt-2">{category.description}</p>
              </div>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {category.features.map((feature, fIdx) => {
                  const Icon = feature.icon;
                  return (
                    <Card key={fIdx} className="border-2 hover:border-emerald-200 transition-all hover:shadow-lg group">
                      <CardHeader>
                        <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                          <Icon className="h-6 w-6 text-emerald-600" />
                        </div>
                        <CardTitle className="text-lg">{feature.title}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <CardDescription className="text-gray-600 leading-relaxed">
                          {feature.desc}
                        </CardDescription>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        {/* CTA */}
        <section className="mt-20 text-center bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-12 text-white">
          <h2 className="text-3xl font-bold mb-4">Ready to Get Started?</h2>
          <p className="text-emerald-100 mb-8 max-w-2xl mx-auto">
            Join thousands of schools already using Skoolar. Start your free trial today.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/register">
              <Button size="lg" className="bg-white text-emerald-700 hover:bg-gray-100">
                Create Free Account
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10">
                Existing User? Log In
              </Button>
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300 py-12 mt-12">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                  <School className="h-4 w-4 text-white" />
                </div>
                <span className="font-bold text-white">Skoolar</span>
              </div>
              <p className="text-sm">Comprehensive school management platform.</p>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Product</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/features" className="hover:text-white">Features</Link></li>
                <li><Link href="/pricing" className="hover:text-white">Pricing</Link></li>
                <li><Link href="/learning-hub" className="hover:text-white">Learning Hub</Link></li>
                <li><Link href="/stories" className="hover:text-white">Stories</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/privacy" className="hover:text-white">Privacy Policy</Link></li>
                <li><Link href="/cookies" className="hover:text-white">Cookie Policy</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Contact</h4>
              <ul className="space-y-2 text-sm">
                <li>support@skoolar.com</li>
                <li>SKOOLAR | Odebunmi Tawwāb</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 text-center text-sm">
            © {new Date().getFullYear()} Skoolar | Odebunmi Tawwāb. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}