'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { SessionProvider } from 'next-auth/react';
import { School, ArrowLeft, FileText } from 'lucide-react';
import { LoginPage } from '@/components/auth/login-page';
import { RegisterPage } from '@/components/auth/register-page';
import { Toaster } from 'sonner';
import { Button } from '@/components/ui/button';

function AuthContent() {
  const [authView, setAuthView] = useState<'login' | 'register'>('login');
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-4">
      <div className="w-full max-w-md">
        {/* Back to Home */}
        <div className="mb-4">
          <Link href="/">
            <Button variant="ghost" size="sm" className="text-gray-500 hover:text-gray-700">
              <ArrowLeft className="size-4 mr-1" />
              Back to Home
            </Button>
          </Link>
        </div>
        
        <div className="text-center mb-6">
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <School className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">Skoolar</span>
          </Link>
          <h1 className="text-xl font-bold text-gray-900">
            {authView === 'login' ? 'Welcome back' : 'Create your school account'}
          </h1>
          <p className="text-gray-600 mt-1 text-sm">
            {authView === 'login' 
              ? 'Log in to access your dashboard' 
              : 'Get started with your school in minutes'}
          </p>
        </div>

        {/* Entrance Exam / Interview Portal Link — Prominent */}
        <Link
          href="/entrance"
          className="flex items-center gap-3 w-full rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 px-4 py-3 mb-4 hover:shadow-md hover:border-emerald-300 transition-all duration-200 group"
        >
          <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-200 transition-colors">
            <FileText className="h-5 w-5 text-emerald-600" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-emerald-800">Entrance Exam & Interview Portal</p>
            <p className="text-xs text-emerald-600">For school applicants — no login required</p>
          </div>
          <span className="ml-auto text-emerald-500 group-hover:translate-x-1 transition-transform">→</span>
        </Link>
        
        {authView === 'login' ? (
          <LoginPage onSwitchToRegister={() => setAuthView('register')} />
        ) : (
          <RegisterPage onSwitchToLogin={() => setAuthView('login')} />
        )}

        {/* Entrance Exam Link — Secondary */}
        <div className="mt-4 text-center">
          <Link
            href="/entrance"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 hover:text-emerald-700 transition-colors"
          >
            <FileText className="h-3.5 w-3.5" />
            Take Entrance Exam / Job Interview
            <span>→</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPageRoute() {
  return (
    <SessionProvider>
      <AuthContent />
      <Toaster position="top-right" richColors closeButton />
    </SessionProvider>
  );
}
