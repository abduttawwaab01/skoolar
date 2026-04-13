'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { School, Mail, Lock, Eye, EyeOff, Loader2, ArrowRight, UserPlus, Search, Check, GraduationCap, Users, UserCircle, Briefcase, Shield, Sparkles, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LoginOverlay } from '@/components/shared/login-overlay';
import { playLogin, playError } from '@/lib/ui-sounds';
import { motion, AnimatePresence } from 'framer-motion';
import { fadeIn, slideUp, staggerContainer, scaleIn } from '@/lib/motion-variants';
import { cn } from '@/lib/utils';

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
  { value: 'SUPER_ADMIN', label: 'Platform Admin', icon: Shield, description: 'Platform super admin' },
];

export function LoginPage({ onSwitchToRegister }: { onSwitchToRegister?: () => void }) {
  const router = useRouter();
  const [loginMode, setLoginMode] = useState<'member' | 'staff'>('member');
  const [step, setStep] = useState<'credentials' | 'school'>('school');
  const [selectedRole, setSelectedRole] = useState('');
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [selectedSchool, setSelectedSchool] = useState<SchoolOption | null>(null);
  const [schoolSearch, setSchoolSearch] = useState('');
  const [schoolLoading, setSchoolLoading] = useState(false);
  const [schoolOpen, setSchoolOpen] = useState(false);
  
  const handleModeChange = (mode: 'member' | 'staff') => {
    setLoginMode(mode);
    if (mode === 'staff') {
      setSelectedSchool(null);
      setSelectedRole('SUPER_ADMIN');
      setStep('credentials');
      toast('System Access Mode Enabled 🛡️', {
        description: 'Direct platform authentication activated.',
      });
    } else {
      setStep('school');
      setSelectedRole('');
    }
  };
  
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
      // Check if Super Admin - either email matches super admin config OR role is selected as Platform Admin
      const isSuperAdmin = email.toLowerCase() === process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL?.toLowerCase() || selectedRole === 'SUPER_ADMIN';

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
          router.push('/dashboard');
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
          router.push('/dashboard');
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
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 0.6, scale: 1 }}
          transition={{ duration: 2, repeat: Infinity, repeatType: 'reverse' }}
          className="absolute -top-40 -right-40 size-80 rounded-full bg-emerald-100/50 blur-3xl" 
        />
        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 0.6, scale: 1 }}
          transition={{ duration: 2.5, repeat: Infinity, repeatType: 'reverse', delay: 0.5 }}
          className="absolute -bottom-40 -left-40 size-80 rounded-full bg-teal-100/50 blur-3xl" 
        />
        <div className="absolute top-1/4 left-1/4 size-40 rounded-full bg-emerald-200/30 blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 size-60 rounded-full bg-teal-200/20 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.02]" style={{
          backgroundImage: 'radial-gradient(circle, #059669 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }} />
      </div>

      <motion.div 
        className="relative z-10 mx-auto w-full max-w-md px-4 py-8"
        initial="hidden"
        animate="visible"
        variants={fadeIn}
      >
        {/* Login Form */}
        <div className="w-full mx-auto">
          <motion.div variants={scaleIn}>
            <Card className="border-0 shadow-2xl shadow-emerald-500/10 bg-white/80 backdrop-blur-xl overflow-hidden">
              <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 to-teal-600" />
              <CardHeader className="space-y-1 pb-4 text-center">
                {/* Progress indicator */}
                <div className="flex items-center justify-center gap-2 mb-4">
                  {['school', 'credentials'].map((s, i) => {
                    const isActive = step === s;
                    const isPast = ['school', 'credentials'].indexOf(step) > i;
                    return (
                      <React.Fragment key={s}>
                        <motion.div 
                          initial={false}
                          animate={{ 
                            backgroundColor: isActive ? '#10b981' : isPast ? '#6ee7b7' : '#e5e7eb',
                            scale: isActive ? 1.2 : 1
                          }}
                          className="w-2.5 h-2.5 rounded-full transition-all" 
                        />
                        {s !== 'credentials' && (
                          <div className={`w-8 h-0.5 transition-all ${isPast ? 'bg-emerald-300' : 'bg-gray-200'}`} />
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
                
                <CardTitle className="text-2xl font-bold flex items-center justify-center gap-2">
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={step + loginMode}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                    >
                      {loginMode === 'staff' ? 'Platform Authentication' : step === 'school' ? 'Portal Selection' : 'Secure Entry'}
                    </motion.span>
                  </AnimatePresence>
                </CardTitle>
                <CardDescription>
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={step + loginMode}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      {loginMode === 'staff' 
                        ? 'Authorized System Personnel Only' 
                        : step === 'school' 
                          ? 'Locate your educational institution' 
                          : `Accessing ${selectedSchool?.name || 'Portal'}`}
                    </motion.span>
                  </AnimatePresence>
                </CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <div className="flex justify-center mb-4">
                  <button 
                    onClick={() => handleModeChange(loginMode === 'member' ? 'staff' : 'member')}
                    className={cn(
                      "group flex items-center justify-center size-12 rounded-2xl transition-all duration-500 border-2 shadow-inner",
                      loginMode === 'staff' 
                        ? "bg-gray-900 border-gray-800 text-white scale-110 rotate-[360deg] shadow-2xl shadow-indigo-500/20" 
                        : "bg-white border-gray-100 text-gray-400 hover:border-indigo-100 hover:text-indigo-600 hover:shadow-lg hover:shadow-indigo-500/10"
                    )}
                  >
                    {loginMode === 'staff' ? <Shield className="size-6" /> : <School className="size-6" />}
                  </button>
                </div>

                <AnimatePresence mode="wait">
                  {step === 'school' ? (
                    <motion.div 
                      key="school-step"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-3"
                    >
                      <Popover open={schoolOpen} onOpenChange={setSchoolOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            className="w-full h-12 justify-between font-normal border-gray-200 hover:border-emerald-500 hover:bg-emerald-50/50 transition-all rounded-xl"
                          >
                            {selectedSchool ? (
                              <div className="flex items-center gap-2 text-emerald-700 font-medium">
                                {selectedSchool.logo ? (
                                  <img src={selectedSchool.logo} alt="" className="w-6 h-6 rounded-md object-cover" />
                                ) : (
                                  <School className="size-5 text-emerald-600" />
                                )}
                                <span>{selectedSchool.name}</span>
                              </div>
                            ) : (
                              <>
                                <Search className="size-4 mr-2 text-gray-400" />
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
                    </motion.div>
                  ) : (
                    <motion.form 
                      key="credentials-step"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2 }}
                      onSubmit={handleSubmit} 
                      className="space-y-4"
                    >
                      {selectedSchool && (
                        <motion.div 
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-100"
                        >
                          <div className="p-1.5 rounded-lg bg-emerald-200/50 text-emerald-700">
                            <School className="size-4" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-emerald-900 leading-none">{selectedSchool.name}</p>
                            <p className="text-[10px] text-emerald-600 mt-1 uppercase tracking-wider font-semibold">Active Session Selection</p>
                          </div>
                        </motion.div>
                      )}

                      {!selectedSchool && loginMode === 'staff' && (
                        <motion.div 
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="flex items-center gap-2 p-3 rounded-xl bg-indigo-50 border border-indigo-100 shadow-sm shadow-indigo-100/50"
                        >
                          <div className="p-1.5 rounded-lg bg-indigo-200/50 text-indigo-700">
                            <Shield className="size-4" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-indigo-900 leading-none">System Administrator</p>
                            <p className="text-[10px] text-indigo-600 mt-1 uppercase tracking-wider font-semibold">Global Management Access</p>
                          </div>
                        </motion.div>
                      )}

                      {error && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                        >
                          <AlertTriangle className="size-4 shrink-0" />
                          {error}
                        </motion.div>
                      )}

                      {/* Email field */}
                      <div className="space-y-2">
                        <Label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-gray-500">Email Address</Label>
                        <div className="relative group">
                          <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400 group-focus-within:text-emerald-500 transition-colors" />
                          <Input
                            id="email"
                            type="email"
                            placeholder="your@email.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="pl-10 h-11 bg-gray-50/50 border-gray-200 focus:bg-white focus:ring-emerald-500/20 transition-all rounded-xl"
                            required
                            disabled={isLoading}
                          />
                        </div>
                      </div>

                      {/* Role Selection */}
                      {selectedSchool && (
                        <div className="space-y-2">
                          <Label className="text-xs font-bold uppercase tracking-wider text-gray-500">Portal Access</Label>
                          <div className="grid grid-cols-2 gap-2">
                            {ROLES.filter(r => r.value !== 'SUPER_ADMIN').map((role) => {
                              const Icon = role.icon;
                              const isActive = selectedRole === role.value;
                              return (
                                <motion.button
                                  key={role.value}
                                  type="button"
                                  whileHover={{ scale: 1.02, y: -1 }}
                                  whileTap={{ scale: 0.98 }}
                                  onClick={() => setSelectedRole(role.value)}
                                  className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition-all ${
                                    isActive
                                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm ring-1 ring-emerald-500'
                                      : 'border-gray-200 hover:border-emerald-200 hover:bg-gray-50'
                                  }`}
                                >
                                  <div className={`p-1.5 rounded-lg ${isActive ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                                    <Icon className="size-3.5" />
                                  </div>
                                  <span className="text-xs font-bold truncate">{role.label}</span>
                                </motion.button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Password field */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="password" className="text-xs font-bold uppercase tracking-wider text-gray-500">Password</Label>
                          <Link
                            href="/forgot-password"
                            className="text-xs font-bold text-emerald-600 hover:text-emerald-700 transition-colors"
                          >
                            Forgot?
                          </Link>
                        </div>
                        <div className="relative group">
                          <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400 group-focus-within:text-emerald-500 transition-colors" />
                          <Input
                            id="password"
                            type={showPassword ? 'text' : 'password'}
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="pl-10 pr-10 h-11 bg-gray-50/50 border-gray-200 focus:bg-white focus:ring-emerald-500/20 transition-all rounded-xl"
                            required
                            disabled={isLoading}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-emerald-500 transition-colors"
                          >
                            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                          </button>
                        </div>
                      </div>

                      <div className="flex gap-3 pt-2">
                        {selectedSchool && (
                          <Button 
                            type="button" 
                            variant="outline" 
                            onClick={() => setStep('school')}
                            className="rounded-xl px-6 h-12"
                          >
                            Back
                          </Button>
                        )}
                        <Button
                          type="submit"
                          className="flex-1 h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-lg shadow-emerald-600/20 transition-all rounded-xl gap-2"
                          disabled={isLoading}
                        >
                          {isLoading ? (
                            <>
                              <Loader2 className="size-4 animate-spin" />
                              Authenticating...
                            </>
                          ) : (
                            <>
                              Sign In
                              <ArrowRight className="size-4" />
                            </>
                          )}
                        </Button>
                      </div>
                    </motion.form>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          </motion.div>

          {/* Footer */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-6 space-y-4"
          >
            {onSwitchToRegister && step === 'school' && (
              <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-gray-600 hover:text-emerald-600 font-medium h-12 bg-white/40 hover:bg-white/80 rounded-xl"
                  onClick={onSwitchToRegister}
                >
                  <UserPlus className="size-4 mr-2" />
                  New to Skoolar? Register School
                </Button>
              </motion.div>
            )}
            <div className="flex items-center justify-center gap-4 text-[10px] text-gray-400 font-medium uppercase tracking-widest">
              <span className="hover:text-emerald-500 cursor-pointer transition-colors">Privacy</span>
              <span className="w-1 h-1 rounded-full bg-gray-300" />
              <span className="hover:text-emerald-500 cursor-pointer transition-colors">Terms</span>
              <span className="w-1 h-1 rounded-full bg-gray-300" />
              <span className="hover:text-emerald-500 cursor-pointer transition-colors">Support</span>
            </div>
          </motion.div>
        </div>
      </motion.div>
      <LoginOverlay />
    </div>
  );
}