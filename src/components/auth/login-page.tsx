'use client';

import React, { useState, useEffect, useRef } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { School, Mail, Lock, Eye, EyeOff, Loader2, ArrowRight, UserPlus, Search, Check, GraduationCap, Users, UserCircle, Briefcase } from 'lucide-react';
import { toast } from 'sonner';
import { LoginOverlay } from '@/components/shared/login-overlay';
import { playLogin, playError } from '@/lib/ui-sounds';

interface SchoolOption {
  id: string;
  name: string;
  slug: string;
  logo?: string | null;
}

const ROLES = [
  { value: 'ADMIN', label: 'School Admin', icon: School, description: 'Manage your school' },
  { value: 'TEACHER', label: 'Teacher', icon: GraduationCap, description: 'Teacher dashboard' },
  { value: 'STUDENT', label: 'Student', icon: UserCircle, description: 'Student portal' },
  { value: 'PARENT', label: 'Parent', icon: Users, description: 'Parent portal' },
  { value: 'DIRECTOR', label: 'Director', icon: Briefcase, description: 'School director' },
];

export function LoginPage({ onSwitchToRegister }: { onSwitchToRegister?: () => void }) {
  const router = useRouter();
  const [step, setStep] = useState<'credentials' | 'school'>('school');
  const [selectedRole, setSelectedRole] = useState('');
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [selectedSchool, setSelectedSchool] = useState<SchoolOption | null>(null);
  const [schoolSearch, setSchoolSearch] = useState('');
  const [schoolLoading, setSchoolLoading] = useState(false);
  const [schoolOpen, setSchoolOpen] = useState(false);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const commandRef = useRef<HTMLDivElement>(null);

  // Fetch schools when needed
  useEffect(() => {
    if (step === 'school' && schools.length === 0) {
      fetchSchools();
    }
  }, [step]);

  // Filter schools based on search
  const filteredSchools = schools.filter(school =>
    school.name.toLowerCase().includes(schoolSearch.toLowerCase()) ||
    school.slug.toLowerCase().includes(schoolSearch.toLowerCase())
  );

  async function fetchSchools() {
    setSchoolLoading(true);
    try {
      const res = await fetch('/api/schools?limit=100&isActive=true');
      const json = await res.json();
      if (json.data) {
        setSchools(json.data);
      }
    } catch {
      // handle silently
    } finally {
      setSchoolLoading(false);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // Check if Super Admin - either email is admin@skoolar.com OR role is selected as Platform Admin
      const isSuperAdmin = email.toLowerCase() === 'admin@skoolar.com' || selectedRole === 'SUPER_ADMIN';

      if (isSuperAdmin) {
        // Super Admin login directly
        const result = await signIn('credentials', {
          email,
          password,
          role: 'SUPER_ADMIN',
          redirect: false,
        });

        if (result?.error) {
          setError('Invalid email or password. Please try again.');
          toast.error('Login failed', {
            description: 'Invalid email or password.',
          });
          playError();
        } else if (result?.ok) {
          toast.success('Welcome back!', {
            description: 'Redirecting to dashboard...',
          });
          playLogin();
          router.push('/');
          router.refresh();
        }
      } else {
        // For other users, require school selection first
        if (!selectedSchool) {
          setStep('school');
          setIsLoading(false);
          return;
        }

        const credentials: Record<string, string> = {
          email,
          password,
          role: selectedRole,
          schoolId: selectedSchool.id,
        };

        const result = await signIn('credentials', {
          ...credentials,
          redirect: false,
        });

        if (result?.error) {
          setError('Invalid email or password. Please try again.');
          toast.error('Login failed', {
            description: 'Invalid email or password.',
          });
          playError();
        } else if (result?.ok) {
          const roleLabel = ROLES.find(r => r.value === selectedRole)?.label || 'User';
          toast.success(`Welcome back, ${roleLabel}!`, {
            description: 'Redirecting to dashboard...',
          });
          playLogin();
          router.push('/');
          router.refresh();
        }
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const selectedRoleData = ROLES.find(r => r.value === selectedRole);
  const RoleIcon = selectedRoleData?.icon || School;

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-emerald-50 via-white to-teal-50">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 size-80 rounded-full bg-emerald-100/50 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 size-80 rounded-full bg-teal-100/50 blur-3xl" />
        <div className="absolute top-1/4 left-1/4 size-40 rounded-full bg-emerald-200/30 blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 size-60 rounded-full bg-teal-200/20 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.02]" style={{
          backgroundImage: 'radial-gradient(circle, #059669 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }} />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-md px-4 py-8">
        {/* Login Form */}
        <div className="w-full mx-auto">
            <Card className="border-0 shadow-xl shadow-gray-200/50 bg-white/80 backdrop-blur-xl">
              <CardHeader className="space-y-1 pb-4 text-center">
                {/* Progress indicator */}
                <div className="flex items-center justify-center gap-2 mb-2">
                  {['school', 'credentials'].map((s, i) => {
                    const isActive = step === s;
                    const isPast = ['school', 'credentials'].indexOf(step) > i;
                    return (
                      <React.Fragment key={s}>
                        <div className={`w-2.5 h-2.5 rounded-full transition-all ${isActive ? 'bg-emerald-500 scale-110' : isPast ? 'bg-emerald-300' : 'bg-gray-200'}`} />
                        {s !== 'credentials' && <div className={`w-6 h-0.5 transition-all ${isPast ? 'bg-emerald-300' : 'bg-gray-200'}`} />}
                      </React.Fragment>
                    );
                  })}
                </div>
                
                <CardTitle className="text-2xl font-bold">
                  {step === 'school' ? '🏫 Select Your School' : 'Welcome Back!'}
                </CardTitle>
                <CardDescription>
                  {step === 'school' 
                    ? 'Search and select your school' 
                    : `Enter your ${selectedSchool?.name || 'school'} credentials`}
                </CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {/* Step 1: School Selection */}
                {step === 'school' && (
                  <div className="space-y-3">
                    <Popover open={schoolOpen} onOpenChange={setSchoolOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          className="w-full h-12 justify-between font-normal"
                        >
                          {selectedSchool ? (
                            <div className="flex items-center gap-2">
                              {selectedSchool.logo ? (
                                <img src={selectedSchool.logo} alt="" className="w-6 h-6 rounded object-cover" />
                              ) : (
                                <School className="size-5 text-emerald-600" />
                              )}
                              <span>{selectedSchool.name}</span>
                            </div>
                          ) : (
                            <>
                              <Search className="size-4 mr-2" />
                              <span className="text-gray-400">Search for your school...</span>
                            </>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[380px] p-0" align="start">
                        <Command className="w-full">
                          <CommandInput 
                            placeholder="Search schools..." 
                            value={schoolSearch}
                            onValueChange={setSchoolSearch}
                            className="h-10"
                          />
                          <CommandList className="max-h-[250px] overflow-auto">
                            <CommandEmpty>
                              {schoolLoading ? (
                                <div className="flex items-center justify-center p-4">
                                  <Loader2 className="size-4 animate-spin mr-2" />
                                  Loading schools...
                                </div>
                              ) : (
                                'No school found.'
                              )}
                            </CommandEmpty>
                            <CommandGroup>
                              {filteredSchools.map((school) => (
                                <CommandItem
                                  key={school.id}
                                  onSelect={() => {
                                    setSelectedSchool(school);
                                    setSchoolOpen(false);
                                    setStep('credentials');
                                  }}
                                  className="cursor-pointer"
                                >
                                  <School className="size-4 mr-2 text-emerald-600" />
                                  <span className="flex-1">{school.name}</span>
                                  <span className="text-xs text-gray-400">{school.slug}</span>
                                  {selectedSchool?.id === school.id && (
                                    <Check className="size-4 text-emerald-600" />
                                  )}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    
                    <div className="text-center">
                      <p className="text-xs text-gray-500 mb-3">Or login as Super Admin</p>
                      <Button 
                        variant="outline" 
                        onClick={() => {
                          setSelectedSchool(null);
                          setStep('credentials');
                        }}
                        className="w-full"
                      >
                        Continue without school
                      </Button>
                    </div>
                  </div>
                )}

                {/* Step 2: Credentials */}
                {step === 'credentials' && (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    {selectedSchool && (
                      <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-50 border border-emerald-100">
                        <School className="size-4 text-emerald-600" />
                        <span className="text-sm text-emerald-700 font-medium">{selectedSchool.name}</span>
                      </div>
                    )}

                    {!selectedSchool && (
                      <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-50 border border-amber-100">
                        <span className="text-sm text-amber-700 font-medium">Platform Admin</span>
                      </div>
                    )}

                    {error && (
                      <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        <svg className="size-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                        </svg>
                        {error}
                      </div>
                    )}

                    {/* Email field */}
                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
                        <Input
                          id="email"
                          type="email"
                          placeholder="Enter your email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="pl-10 h-11 bg-gray-50/50 border-gray-200 focus:bg-white transition-colors"
                          required
                          disabled={isLoading}
                        />
                      </div>
                    </div>

                    {/* Role Selection */}
                    {!selectedSchool && (
                      <div className="space-y-2">
                        <Label>Login as</Label>
                        <div className="grid grid-cols-2 gap-2">
                          {ROLES.map((role) => {
                            const Icon = role.icon;
                            return (
                              <button
                                key={role.value}
                                type="button"
                                onClick={() => setSelectedRole(role.value)}
                                className={`flex items-center gap-2 p-2 rounded-lg border transition-all ${
                                  selectedRole === role.value
                                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                                    : 'border-gray-200 hover:border-emerald-300'
                                }`}
                              >
                                <Icon className="size-4" />
                                <span className="text-sm font-medium">{role.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Password field */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="password">Password</Label>
                        <button
                          type="button"
                          className="text-xs font-medium text-emerald-600 hover:text-emerald-700 transition-colors"
                        >
                          Forgot password?
                        </button>
                      </div>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
                        <Input
                          id="password"
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Enter your password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="pl-10 pr-10 h-11 bg-gray-50/50 border-gray-200 focus:bg-white transition-colors"
                          required
                          disabled={isLoading}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      {selectedSchool && (
                        <Button type="button" variant="outline" onClick={() => setStep('school')}>
                          Back
                        </Button>
                      )}
                      <Button
                        type="submit"
                        className="flex-1 h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-lg shadow-emerald-600/20 transition-all"
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="size-4 mr-2 animate-spin" />
                            Signing in...
                          </>
                        ) : (
                          <>
                            Sign In
                            <ArrowRight className="size-4 ml-2" />
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                )}
              </CardContent>
            </Card>

            {/* Footer */}
            <div className="mt-4 space-y-2">
              {onSwitchToRegister && step === 'school' && (
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-gray-500 hover:text-gray-700"
                  onClick={onSwitchToRegister}
                >
                  <UserPlus className="size-4 mr-2" />
                  Don&apos;t have an account? Create one
                </Button>
              )}
              <p className="text-center text-xs text-gray-400">
                &copy; {new Date().getFullYear()} Skoolar Platform. All rights reserved.
              </p>
            </div>
          </div>
        </div>
        <LoginOverlay />
      </div>
    );
  }