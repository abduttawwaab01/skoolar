'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { SessionProvider } from 'next-auth/react';
import { School } from 'lucide-react';
import { LoginPage } from '@/components/auth/login-page';
import { RegisterPage } from '@/components/auth/register-page';
import { Toaster } from 'sonner';

function AuthContent() {
  const [authView, setAuthView] = useState<'login' | 'register'>('login');
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-4">
      <div className="w-full max-w-md">
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
        
        {authView === 'login' ? (
          <LoginPage onSwitchToRegister={() => setAuthView('register')} />
        ) : (
          <RegisterPage onSwitchToLogin={() => setAuthView('login')} />
        )}

        {/* Entrance Exam / Interview Portal Link */}
        <div className="mt-6 text-center">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-gradient-to-br from-emerald-50 via-white to-teal-50 px-3 text-gray-500">or</span>
            </div>
          </div>
          <div className="mt-4">
            <Link
              href="/entrance"
              className="inline-flex items-center gap-2 w-full justify-center rounded-xl border-2 border-dashed border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 hover:border-emerald-400 transition-all duration-200"
            >
              <span className="text-lg">📋</span>
              Take Entrance Exam / Job Interview
              <span className="text-emerald-500 text-xs ml-1">→</span>
            </Link>
            <p className="text-xs text-gray-400 mt-2">For school applicants & interview candidates. No login required.</p>
          </div>
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
