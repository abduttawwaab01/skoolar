'use client';

import React from 'react';
import Link from 'next/link';
import { 
  School, GraduationCap, Users, BookOpen, CreditCard, 
  Calendar, BarChart3, MessageSquare, Shield, Zap, 
  FileText, Award, Bell, Settings, Video, Library,
  QrCode, ClipboardList, Search, Globe, Smartphone,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PublicLayout } from '@/components/layout/public-layout';

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
  return (
    <PublicLayout>
      <div className="bg-gradient-to-br from-emerald-50 via-white to-teal-50">
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
      </div>
    </PublicLayout>
  );
}
