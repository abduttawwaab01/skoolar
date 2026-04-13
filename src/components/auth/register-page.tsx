'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { School, Mail, Lock, Eye, EyeOff, Loader2, ArrowRight, ArrowLeft, User, KeyRound, CheckCircle2, AlertCircle, Sparkles, Gift, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { soundEffects } from '@/lib/ui-sounds';
import { motion, AnimatePresence } from 'framer-motion';
import { fadeIn, slideUp, staggerContainer, scaleIn } from '@/lib/motion-variants';

export function RegisterPage({ onSwitchToLogin }: { onSwitchToLogin: () => void }) {
  const [registrationType, setRegistrationType] = useState<'free' | 'code'>('free');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    registrationCode: '',
    schoolName: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) newErrors.name = 'Full name is required';
    if (!formData.email.trim()) newErrors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = 'Invalid email format';
    
    if (registrationType === 'code' && !formData.registrationCode.trim()) {
      newErrors.registrationCode = 'Registration code is required';
    }
    
    if (!formData.schoolName.trim()) newErrors.schoolName = 'School name is required';
    if (!formData.password) newErrors.password = 'Password is required';
    else if (formData.password.length < 6) newErrors.password = 'Password must be at least 6 characters';
    if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = 'Passwords do not match';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          registrationCode: registrationType === 'code' ? formData.registrationCode : null,
          schoolName: formData.schoolName,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error('Registration Failed ❌', {
          description: data.error || 'Something went wrong.',
        });
        soundEffects.error();
        return;
      }

      toast.success('Account created! 🎉', {
        description: 'Your school has been created. You can now sign in.',
      });
      soundEffects.success();

      onSwitchToLogin();
    } catch {
      toast.error('Registration Failed ❌', {
        description: 'An unexpected error occurred. Please try again.',
      });
      soundEffects.error();
    } finally {
      setIsLoading(false);
    }
  };

  const passwordStrength = (() => {
    if (!formData.password) return { level: 0, label: '', color: '' };
    let score = 0;
    if (formData.password.length >= 6) score++;
    if (formData.password.length >= 10) score++;
    if (/[A-Z]/.test(formData.password)) score++;
    if (/[0-9]/.test(formData.password)) score++;
    if (/[^A-Za-z0-9]/.test(formData.password)) score++;

    if (score <= 2) return { level: 1, label: 'Weak', color: 'bg-red-500' };
    if (score <= 3) return { level: 2, label: 'Fair', color: 'bg-amber-500' };
    if (score <= 4) return { level: 3, label: 'Good', color: 'bg-emerald-500' };
    return { level: 4, label: 'Strong', color: 'bg-emerald-600' };
  })();

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
        <div className="absolute inset-0 opacity-[0.02]" style={{
          backgroundImage: 'radial-gradient(circle, #059669 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }} />
      </div>

      <motion.div 
        className="relative z-10 mx-auto w-full max-w-lg px-4 py-8"
        initial="hidden"
        animate="visible"
        variants={fadeIn}
      >
        <motion.div variants={scaleIn}>
          <Card className="border-0 shadow-2xl shadow-emerald-500/10 bg-white/80 backdrop-blur-xl overflow-hidden">
            <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 to-teal-600" />
            <CardHeader className="space-y-1 pb-4 text-center">
              <motion.div 
                className="flex items-center justify-center gap-2 mb-2"
                variants={slideUp}
              >
                <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/20">
                  <School className="size-5" />
                </div>
                <h1 className="text-xl font-bold tracking-tight">Skoolar</h1>
              </motion.div>
              <CardTitle className="text-2xl font-bold tracking-tight">✨ Create Account</CardTitle>
              <CardDescription>
                Register your school on the Skoolar platform
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handleSubmit} className="space-y-4">
                <motion.div 
                  className="grid gap-4"
                  variants={staggerContainer}
                >
                  {/* Registration Type Toggle */}
                  <motion.div variants={slideUp} className="space-y-3">
                    <Label className="text-xs font-bold uppercase tracking-wider text-gray-500">
                      Choose Registration Type
                    </Label>
                    <RadioGroup
                      value={registrationType}
                      onValueChange={(value) => setRegistrationType(value as 'free' | 'code')}
                      className="flex gap-4"
                    >
                      <div className="flex items-center space-x-2 flex-1">
                        <RadioGroupItem value="free" id="free" className="peer" />
                        <Label 
                          htmlFor="free" 
                          className="flex items-center gap-2 cursor-pointer peer-data-[state=checked]:text-emerald-600"
                        >
                          <Gift className="size-4 text-emerald-500" />
                          <span className="font-medium">Free Account</span>
                          <Badge variant="secondary" className="ml-auto text-[10px] bg-emerald-100 text-emerald-700">
                            Quick
                          </Badge>
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2 flex-1">
                        <RadioGroupItem value="code" id="code" className="peer" />
                        <Label 
                          htmlFor="code" 
                          className="flex items-center gap-2 cursor-pointer peer-data-[state=checked]:text-emerald-600"
                        >
                          <KeyRound className="size-4 text-amber-500" />
                          <span className="font-medium">With Code</span>
                        </Label>
                      </div>
                    </RadioGroup>
                  </motion.div>

                  {/* Registration Code (Conditional) */}
                  {registrationType === 'code' && (
                    <motion.div variants={slideUp} className="space-y-2">
                      <Label htmlFor="registration-code" className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                        🔑 Registration Code
                      </Label>
                      <Input
                        id="registration-code"
                        type="text"
                        placeholder="Enter your school registration code"
                        value={formData.registrationCode}
                        onChange={(e) => handleChange('registrationCode', e.target.value)}
                        className={`h-11 bg-gray-50/50 border-gray-200 focus:bg-white focus:ring-emerald-500/20 transition-all rounded-xl ${errors.registrationCode ? 'border-red-300' : ''}`}
                        disabled={isLoading}
                      />
                      {errors.registrationCode && <p className="text-xs text-red-500 flex items-center gap-1 mt-1"><AlertCircle className="size-3" />{errors.registrationCode}</p>}
                      <p className="text-[10px] text-gray-400">Enter the code provided by your school administrator</p>
                    </motion.div>
                  )}

                  {/* School Name */}
                  <motion.div variants={slideUp} className="space-y-2">
                    <Label htmlFor="school-name" className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                      🏫 School Name
                    </Label>
                    <Input
                      id="school-name"
                      type="text"
                      placeholder="e.g. Greenfield Academy"
                      value={formData.schoolName}
                      onChange={(e) => handleChange('schoolName', e.target.value)}
                      className={`h-11 bg-gray-50/50 border-gray-200 focus:bg-white focus:ring-emerald-500/20 transition-all rounded-xl ${errors.schoolName ? 'border-red-300' : ''}`}
                      required
                      disabled={isLoading}
                    />
                    {errors.schoolName && <p className="text-xs text-red-500 flex items-center gap-1 mt-1"><AlertCircle className="size-3" />{errors.schoolName}</p>}
                  </motion.div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Full Name */}
                    <motion.div variants={slideUp} className="space-y-2">
                      <Label htmlFor="name" className="text-xs font-bold uppercase tracking-wider text-gray-500">Full Name</Label>
                      <div className="relative group">
                        <User className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400 group-focus-within:text-emerald-500 transition-colors" />
                        <Input
                          id="name"
                          type="text"
                          placeholder="Full name"
                          value={formData.name}
                          onChange={(e) => handleChange('name', e.target.value)}
                          className={`pl-10 h-11 bg-gray-50/50 border-gray-200 focus:bg-white focus:ring-emerald-500/20 transition-all rounded-xl ${errors.name ? 'border-red-300' : ''}`}
                          required
                          disabled={isLoading}
                        />
                      </div>
                      {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
                    </motion.div>

                    {/* Email */}
                    <motion.div variants={slideUp} className="space-y-2">
                      <Label htmlFor="reg-email" className="text-xs font-bold uppercase tracking-wider text-gray-500">Email Address</Label>
                      <div className="relative group">
                        <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400 group-focus-within:text-emerald-500 transition-colors" />
                        <Input
                          id="reg-email"
                          type="email"
                          placeholder="you@school.com"
                          value={formData.email}
                          onChange={(e) => handleChange('email', e.target.value)}
                          className={`pl-10 h-11 bg-gray-50/50 border-gray-200 focus:bg-white focus:ring-emerald-500/20 transition-all rounded-xl ${errors.email ? 'border-red-300' : ''}`}
                          required
                          disabled={isLoading}
                        />
                      </div>
                      {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
                    </motion.div>
                  </div>

                  {/* Password */}
                  <motion.div variants={slideUp} className="space-y-2">
                    <Label htmlFor="reg-password" title="At least 6 characters" className="text-xs font-bold uppercase tracking-wider text-gray-500">Create Password</Label>
                    <div className="relative group">
                      <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400 group-focus-within:text-emerald-500 transition-colors" />
                      <Input
                        id="reg-password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={formData.password}
                        onChange={(e) => handleChange('password', e.target.value)}
                        className={`pl-10 pr-10 h-11 bg-gray-50/50 border-gray-200 focus:bg-white focus:ring-emerald-500/20 transition-all rounded-xl ${errors.password ? 'border-red-300' : ''}`}
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
                    {formData.password && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-1 mt-2">
                        <div className="flex gap-1">
                          {[1, 2, 3, 4].map((i) => (
                            <div
                              key={i}
                              className={`h-1 flex-1 rounded-full transition-all duration-500 ${
                                i <= passwordStrength.level ? passwordStrength.color : 'bg-gray-200'
                              }`}
                            />
                          ))}
                        </div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Strength: {passwordStrength.label}</p>
                      </motion.div>
                    )}
                    {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
                  </motion.div>

                  {/* Confirm Password */}
                  <motion.div variants={slideUp} className="space-y-2">
                    <Label htmlFor="confirm-password" className="text-xs font-bold uppercase tracking-wider text-gray-500">Confirm Password</Label>
                    <div className="relative group">
                      <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400 group-focus-within:text-emerald-500 transition-colors" />
                      <Input
                        id="confirm-password"
                        type={showConfirmPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={formData.confirmPassword}
                        onChange={(e) => handleChange('confirmPassword', e.target.value)}
                        className={`pl-10 pr-10 h-11 bg-gray-50/50 border-gray-200 focus:bg-white focus:ring-emerald-500/20 transition-all rounded-xl ${errors.confirmPassword ? 'border-red-300' : ''}`}
                        required
                        disabled={isLoading}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-emerald-500 transition-colors"
                      >
                        {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                    {errors.confirmPassword && <p className="text-xs text-red-500 mt-1">{errors.confirmPassword}</p>}
                    {formData.confirmPassword && formData.password === formData.confirmPassword && (
                      <motion.p initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }} className="text-xs text-emerald-600 flex items-center gap-1 font-medium mt-1"><CheckCircle2 className="size-3" />Passwords match</motion.p>
                    )}
                  </motion.div>
                </motion.div>

                <motion.div variants={slideUp} className="pt-2">
                  <Button
                    type="submit"
                    className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-lg shadow-emerald-600/20 transition-all rounded-xl gap-2"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        Create Account
                        <ArrowRight className="size-4" />
                      </>
                    )}
                  </Button>
                </motion.div>
              </form>

              <Separator className="bg-gray-100" />

              <motion.div variants={fadeIn}>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-gray-600 hover:text-emerald-600 font-medium h-12 bg-white/40 hover:bg-white/80 rounded-xl transition-all"
                  onClick={onSwitchToLogin}
                >
                  <ArrowLeft className="size-4 mr-2" />
                  Already have an account? Sign in
                </Button>
              </motion.div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-6 text-center text-[10px] text-gray-400 font-medium uppercase tracking-widest"
        >
          &copy; {new Date().getFullYear()} Skoolar Platform. All rights reserved.
        </motion.p>
      </motion.div>
    </div>
  );
}
