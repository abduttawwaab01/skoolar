'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Send, BookOpen, CheckCircle2, AlertCircle, ArrowLeft, ArrowRight,
  ChevronRight, Sparkles, Lightbulb, FileText, Image as ImageIcon, Eye,
  PenLine, Target, Type, Clock, Hash, User, Mail, Phone
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { PublicLayout } from '@/components/layout/public-layout';

const levels = ['Beginner', 'Intermediate', 'Advanced'];
const grades = ['JSS 1', 'JSS 2', 'JSS 3', 'SSS 1', 'SSS 2', 'SSS 3'];

const categoryOptions = [
  { value: 'General', label: 'General', icon: '📖', color: 'from-blue-100 to-blue-50 border-blue-200 hover:border-blue-300' },
  { value: 'Adventure', label: 'Adventure', icon: '🧭', color: 'from-orange-100 to-orange-50 border-orange-200 hover:border-orange-300' },
  { value: 'Fantasy', label: 'Fantasy', icon: '🧙', color: 'from-purple-100 to-purple-50 border-purple-200 hover:border-purple-300' },
  { value: 'Science Fiction', label: 'Sci-Fi', icon: '🚀', color: 'from-cyan-100 to-cyan-50 border-cyan-200 hover:border-cyan-300' },
  { value: 'Mystery', label: 'Mystery', icon: '🔍', color: 'from-rose-100 to-rose-50 border-rose-200 hover:border-rose-300' },
  { value: 'Non-Fiction', label: 'Non-Fiction', icon: '📚', color: 'from-emerald-100 to-emerald-50 border-emerald-200 hover:border-emerald-300' },
  { value: 'Romance', label: 'Romance', icon: '💕', color: 'from-pink-100 to-pink-50 border-pink-200 hover:border-pink-300' },
  { value: 'Horror', label: 'Horror', icon: '👻', color: 'from-gray-200 to-gray-50 border-gray-300 hover:border-gray-400' },
  { value: 'Comedy', label: 'Comedy', icon: '😂', color: 'from-amber-100 to-amber-50 border-amber-200 hover:border-amber-300' },
  { value: 'Drama', label: 'Drama', icon: '🎭', color: 'from-violet-100 to-violet-50 border-violet-200 hover:border-violet-300' },
];

const writingTips = [
  {
    title: 'Start with a hook',
    description: 'Begin your story with something that grabs the reader\'s attention — a question, action, or surprising statement.',
    icon: '🎣',
  },
  {
    title: 'Show, don\'t tell',
    description: 'Instead of saying "he was sad," describe his drooping shoulders, the way he stared at the floor.',
    icon: '👁️',
  },
  {
    title: 'Create vivid characters',
    description: 'Give your characters distinct personalities, motivations, and flaws that readers can relate to.',
    icon: '👤',
  },
  {
    title: 'Build tension',
    description: 'Keep readers engaged by gradually building tension throughout your story.',
    icon: '📈',
  },
  {
    title: 'Use sensory details',
    description: 'Include sight, sound, smell, touch, and taste to bring your story world to life.',
    icon: '✨',
  },
  {
    title: 'Edit ruthlessly',
    description: 'Cut unnecessary words and scenes. Every sentence should serve a purpose.',
    icon: '✂️',
  },
  {
    title: 'Read your work aloud',
    description: 'This helps you catch awkward phrasing and improves the natural flow of your writing.',
    icon: '🗣️',
  },
  {
    title: 'End memorably',
    description: 'Leave your reader with something to think about — a twist, question, or powerful image.',
    icon: '🏁',
  },
];

const WORD_GOAL_MIN = 500;
const WORD_GOAL_IDEAL = 2000;
const WORD_GOAL_MAX = 50000;

interface FormData {
  title: string;
  content: string;
  authorName: string;
  authorEmail: string;
  authorPhone: string;
  level: string;
  grade: string;
  category: string;
  coverImage: string;
}

function StepIndicator({ current, total }: { current: number; total: number }) {
  const steps = [
    { num: 1, label: 'Story Details', icon: FileText },
    { num: 2, label: 'Content', icon: PenLine },
    { num: 3, label: 'Cover & Review', icon: Eye },
    { num: 4, label: 'Submit', icon: Send },
  ];

  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {steps.map((step, idx) => {
        const Icon = step.icon;
        const isCompleted = current > step.num;
        const isActive = current === step.num;
        return (
          <React.Fragment key={step.num}>
            <div className="flex flex-col items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                  isCompleted
                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                    : isActive
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30 ring-4 ring-purple-500/10'
                    : 'bg-gray-100 text-gray-400'
                }`}
              >
                {isCompleted ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-4 w-4" />}
              </div>
              <span
                className={`text-[10px] mt-1.5 font-medium hidden sm:block ${
                  isActive ? 'text-purple-700' : isCompleted ? 'text-emerald-600' : 'text-gray-400'
                }`}
              >
                {step.label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div
                className={`h-0.5 w-12 sm:w-20 md:w-24 transition-all duration-300 mb-4 sm:mb-0 ${
                  isCompleted ? 'bg-emerald-400' : 'bg-gray-200'
                }`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function WritingTipsSidebar() {
  return (
    <Card className="border-purple-100 bg-gradient-to-br from-purple-50/50 to-indigo-50/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-purple-900 flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-amber-500" />
          Writing Tips
        </CardTitle>
        <CardDescription className="text-xs text-purple-700/70">
          Quick tips to make your story stand out
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0 space-y-3 max-h-96 overflow-y-auto">
        {writingTips.map((tip, idx) => (
          <div key={idx} className="flex gap-3 p-2 rounded-lg hover:bg-white/60 transition-colors">
            <span className="text-lg shrink-0">{tip.icon}</span>
            <div>
              <p className="text-xs font-semibold text-gray-900">{tip.title}</p>
              <p className="text-[11px] text-gray-500 leading-relaxed">{tip.description}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function WordCounter({ content }: { content: string }) {
  const words = content.trim() ? content.trim().split(/\s+/).length : 0;
  const characters = content.length;
  const sentences = content.split(/[.!?]+/).filter((s) => s.trim()).length;
  const paragraphs = content.split(/\n\n+/).filter((s) => s.trim()).length;
  const estimatedMinutes = Math.max(1, Math.ceil(words / 200));
  const progress = Math.min(100, (words / WORD_GOAL_IDEAL) * 100);

  return (
    <div className="bg-gray-50 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Word Counter</span>
        <span className="text-xs text-gray-400">Goal: {WORD_GOAL_IDEAL.toLocaleString()} words</span>
      </div>
      <div className="flex items-center gap-3">
        <Progress value={progress} className="h-2 flex-1" />
        <span className={`text-sm font-bold ${words >= WORD_GOAL_MIN ? 'text-emerald-600' : 'text-amber-600'}`}>
          {words.toLocaleString()}
        </span>
      </div>
      {words > 0 && words < WORD_GOAL_MIN && (
        <p className="text-xs text-amber-600 flex items-center gap-1">
          <Target className="h-3 w-3" />
          Add {(WORD_GOAL_MIN - words).toLocaleString()} more words to reach minimum
        </p>
      )}
      {words >= WORD_GOAL_MIN && (
        <p className="text-xs text-emerald-600 flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Minimum word count reached! Great work.
        </p>
      )}
      <div className="grid grid-cols-4 gap-2 text-center">
        <div className="bg-white rounded-lg p-2">
          <p className="text-sm font-bold text-gray-900">{words.toLocaleString()}</p>
          <p className="text-[10px] text-gray-400">Words</p>
        </div>
        <div className="bg-white rounded-lg p-2">
          <p className="text-sm font-bold text-gray-900">{characters.toLocaleString()}</p>
          <p className="text-[10px] text-gray-400">Chars</p>
        </div>
        <div className="bg-white rounded-lg p-2">
          <p className="text-sm font-bold text-gray-900">{sentences}</p>
          <p className="text-[10px] text-gray-400">Sentences</p>
        </div>
        <div className="bg-white rounded-lg p-2">
          <p className="text-sm font-bold text-gray-900">~{estimatedMinutes}m</p>
          <p className="text-[10px] text-gray-400">Read time</p>
        </div>
      </div>
    </div>
  );
}

function CategorySelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-3">
      <Label className="text-sm font-semibold text-gray-700">Choose a Category</Label>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {categoryOptions.map((cat) => (
          <button
            key={cat.value}
            type="button"
            onClick={() => onChange(cat.value)}
            className={`relative rounded-xl border-2 bg-gradient-to-br p-3 text-center transition-all duration-200 ${
              value === cat.value
                ? `${cat.color} shadow-md ring-2 ring-purple-400/50 scale-[1.02]`
                : `bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm`
            }`}
          >
            <span className="text-2xl block mb-1">{cat.icon}</span>
            <span className="text-xs font-semibold text-gray-700">{cat.label}</span>
            {value === cat.value && (
              <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-purple-600 rounded-full flex items-center justify-center">
                <CheckCircle2 className="h-3.5 w-3.5 text-white" />
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

function PreviewPanel({ form }: { form: FormData }) {
  const words = form.content.trim() ? form.content.trim().split(/\s+/).length : 0;
  const catInfo = categoryOptions.find((c) => c.value === form.category);

  return (
    <div className="space-y-6">
      {/* Preview Header */}
      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-2xl p-6 border border-purple-100/50">
        <div className="flex items-center gap-2 mb-4">
          <Eye className="h-5 w-5 text-purple-600" />
          <h3 className="text-lg font-bold text-gray-900">Story Preview</h3>
        </div>

        {/* Cover */}
        <div className={`rounded-xl h-48 bg-gradient-to-br ${catInfo?.color || 'from-purple-100 to-indigo-100'} flex items-center justify-center mb-4 overflow-hidden`}>
          {form.coverImage ? (
            <img src={form.coverImage} alt="Cover" className="w-full h-full object-cover" />
          ) : (
            <div className="text-center">
              <BookOpen className="h-12 w-12 text-purple-300 mx-auto mb-2" />
              <p className="text-sm text-purple-400">No cover image</p>
            </div>
          )}
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-2 mb-3">
          {form.level && <Badge className="bg-purple-100 text-purple-700 text-xs">{form.level}</Badge>}
          {form.grade && <Badge className="bg-indigo-100 text-indigo-700 text-xs">{form.grade}</Badge>}
          <Badge variant="outline" className="text-xs">{catInfo?.icon} {catInfo?.label || form.category}</Badge>
        </div>

        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          {form.title || 'Untitled Story'}
        </h2>

        <div className="flex items-center gap-4 text-sm text-gray-500">
          {form.authorName && (
            <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" />{form.authorName}</span>
          )}
          <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />~{Math.max(1, Math.ceil(words / 200))} min read</span>
          <span className="flex items-center gap-1"><Hash className="h-3.5 w-3.5" />{words.toLocaleString()} words</span>
        </div>
      </div>

      {/* Preview Content */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-gray-700">Story Content</CardTitle>
        </CardHeader>
        <CardContent>
          {form.content ? (
            <div className="prose prose-sm max-w-none">
              <div className="whitespace-pre-wrap text-gray-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: form.content.replace(/\n/g, '<br/>') }} />
            </div>
          ) : (
            <p className="text-sm text-gray-400 italic">No content yet.</p>
          )}
        </CardContent>
      </Card>

      {/* Summary */}
      <Card className="border-emerald-100">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-emerald-900 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            Submission Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {[
            { label: 'Title', value: form.title, required: true },
            { label: 'Author', value: form.authorName, required: true },
            { label: 'Email', value: form.authorEmail, required: true },
            { label: 'Category', value: form.category, required: true },
            { label: 'Level', value: form.level, required: false },
            { label: 'Grade', value: form.grade, required: false },
            { label: 'Word Count', value: words.toLocaleString(), required: false },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between">
              <span className="text-gray-500">{item.label} {item.required && <span className="text-red-400">*</span>}</span>
              <span className={`font-medium ${item.value ? 'text-gray-900' : 'text-red-400 italic'}`}>
                {item.value || 'Missing'}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export default function SubmitStoryPage() {
  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<FormData>({
    title: '',
    content: '',
    authorName: '',
    authorEmail: '',
    authorPhone: '',
    level: '',
    grade: '',
    category: 'General',
    coverImage: '',
  });

  const updateForm = (key: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const canProceedStep1 = form.title.trim().length > 0 && form.authorName.trim().length > 0 && form.authorEmail.trim().length > 0;
  const canProceedStep2 = form.content.trim().length >= WORD_GOAL_MIN;
  const canProceedStep3 = true;
  const canSubmit = canProceedStep1 && canProceedStep2;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) {
      toast.error('Please complete all required fields and write at least 500 words.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/platform/story-submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (json.success) {
        setSubmitted(true);
        toast.success('Story submitted successfully!');
      } else {
        toast.error(json.message || 'Failed to submit. Please try again.');
      }
    } catch {
      toast.error('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <PublicLayout>
        <div className="flex items-center justify-center py-16 px-4">
          <Card className="max-w-lg w-full border-0 shadow-xl">
            <CardContent className="pt-10 pb-10 text-center">
              <div className="relative mb-6">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/30">
                  <CheckCircle2 className="h-10 w-10 text-white" />
                </div>
                <div className="absolute -top-1 -right-1 w-8 h-8 rounded-full bg-amber-400 flex items-center justify-center shadow-lg text-sm animate-bounce">
                  🎉
                </div>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Story Submitted!</h2>
              <p className="text-gray-500 mb-2 max-w-sm mx-auto">
                Thank you for your submission, <span className="font-semibold text-gray-700">{form.authorName}</span>!
              </p>
              <p className="text-sm text-gray-400 mb-8 max-w-md mx-auto">
                Our editorial team will review your story and get back to you via email. Approved stories will be published on our Stories page. This usually takes 1-3 business days.
              </p>

              <div className="bg-emerald-50 rounded-xl p-4 mb-8">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-lg font-bold text-emerald-700">{form.content.trim().split(/\s+/).length.toLocaleString()}</p>
                    <p className="text-xs text-emerald-600">Words</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-emerald-700">{Math.ceil(form.content.trim().split(/\s+/).length / 200)}</p>
                    <p className="text-xs text-emerald-600">Min Read</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-emerald-700">{form.category}</p>
                    <p className="text-xs text-emerald-600">Category</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link href="/stories">
                  <Button className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 w-full sm:w-auto">
                    <BookOpen className="h-4 w-4" /> Browse Stories
                  </Button>
                </Link>
                <Link href="/submit-story">
                  <Button variant="outline" className="gap-2 w-full sm:w-auto" onClick={() => { setSubmitted(false); setStep(1); setForm({ title: '', content: '', authorName: '', authorEmail: '', authorPhone: '', level: '', grade: '', category: 'General', coverImage: '' }); }}>
                    <Sparkles className="h-4 w-4" /> Submit Another
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
        {/* Header */}
        <div className="bg-gradient-to-br from-purple-600 via-indigo-600 to-violet-700 text-white py-12 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 mb-4">
              <PenLine className="h-4 w-4" />
              <span className="text-sm font-medium">Story Submission</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold mb-3">Share Your Story</h1>
            <p className="text-purple-100 max-w-lg mx-auto leading-relaxed">
              Submit your creative writing to be published on our platform. All submissions are reviewed by our editorial team before being published.
            </p>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-8">
          {/* Step Indicator */}
          <StepIndicator current={step} total={4} />

          {/* Step Content */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Form */}
            <div className="lg:col-span-2">
              <Card className="border-gray-200 shadow-sm">
                <CardContent className="pt-6">
                  <form onSubmit={handleSubmit}>
                    {/* Step 1: Story Details */}
                    {step === 1 && (
                      <div className="space-y-6">
                        <div>
                          <h2 className="text-lg font-bold text-gray-900 mb-1 flex items-center gap-2">
                            <FileText className="h-5 w-5 text-purple-600" />
                            Story Details
                          </h2>
                          <p className="text-sm text-gray-500">Tell us about your story and yourself.</p>
                        </div>

                        {/* Title */}
                        <div className="space-y-2">
                          <Label htmlFor="title" className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                            <Type className="h-3.5 w-3.5" />
                            Story Title <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            id="title"
                            value={form.title}
                            onChange={(e) => updateForm('title', e.target.value)}
                            placeholder="Enter a captivating title for your story..."
                            className="h-11"
                          />
                          <p className="text-xs text-gray-400">{form.title.length}/200 characters</p>
                        </div>

                        {/* Author Info */}
                        <div className="space-y-2">
                          <p className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5" />
                            Author Information <span className="text-red-500">*</span>
                          </p>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div>
                              <Label htmlFor="authorName" className="text-xs text-gray-500 mb-1 block">Full Name *</Label>
                              <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <Input
                                  id="authorName"
                                  value={form.authorName}
                                  onChange={(e) => updateForm('authorName', e.target.value)}
                                  placeholder="John Doe"
                                  className="pl-9 h-10"
                                />
                              </div>
                            </div>
                            <div>
                              <Label htmlFor="authorEmail" className="text-xs text-gray-500 mb-1 block">Email *</Label>
                              <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <Input
                                  id="authorEmail"
                                  type="email"
                                  value={form.authorEmail}
                                  onChange={(e) => updateForm('authorEmail', e.target.value)}
                                  placeholder="your@email.com"
                                  className="pl-9 h-10"
                                />
                              </div>
                            </div>
                            <div>
                              <Label htmlFor="authorPhone" className="text-xs text-gray-500 mb-1 block">Phone (Optional)</Label>
                              <div className="relative">
                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <Input
                                  id="authorPhone"
                                  type="tel"
                                  value={form.authorPhone}
                                  onChange={(e) => updateForm('authorPhone', e.target.value)}
                                  placeholder="+234..."
                                  className="pl-9 h-10"
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Level & Grade */}
                        <div className="space-y-2">
                          <p className="text-sm font-semibold text-gray-700">Reading Level & Grade</p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <Label className="text-xs text-gray-500 mb-1 block">Level (Optional)</Label>
                              <Select value={form.level} onValueChange={(v) => updateForm('level', v)}>
                                <SelectTrigger className="h-10">
                                  <SelectValue placeholder="Select level" />
                                </SelectTrigger>
                                <SelectContent>
                                  {levels.map((l) => (
                                    <SelectItem key={l} value={l}>{l}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-xs text-gray-500 mb-1 block">Grade (Optional)</Label>
                              <Select value={form.grade} onValueChange={(v) => updateForm('grade', v)}>
                                <SelectTrigger className="h-10">
                                  <SelectValue placeholder="Select grade" />
                                </SelectTrigger>
                                <SelectContent>
                                  {grades.map((g) => (
                                    <SelectItem key={g} value={g}>{g}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>

                        {/* Category Selection */}
                        <CategorySelector value={form.category} onChange={(v) => updateForm('category', v)} />
                      </div>
                    )}

                    {/* Step 2: Story Content */}
                    {step === 2 && (
                      <div className="space-y-6">
                        <div>
                          <h2 className="text-lg font-bold text-gray-900 mb-1 flex items-center gap-2">
                            <PenLine className="h-5 w-5 text-purple-600" />
                            Story Content
                          </h2>
                          <p className="text-sm text-gray-500">Write your story. Minimum 500 words recommended for best reading experience.</p>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="content" className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                            <FileText className="h-3.5 w-3.5" />
                            Your Story <span className="text-red-500">*</span>
                          </Label>
                          <Textarea
                            id="content"
                            value={form.content}
                            onChange={(e) => updateForm('content', e.target.value)}
                            placeholder="Once upon a time, in a world not so different from ours..."
                            rows={18}
                            className="text-base leading-relaxed resize-y min-h-[400px] font-[Georgia,serif]"
                          />
                        </div>

                        <WordCounter content={form.content} />
                      </div>
                    )}

                    {/* Step 3: Cover & Review */}
                    {step === 3 && (
                      <div className="space-y-6">
                        <div>
                          <h2 className="text-lg font-bold text-gray-900 mb-1 flex items-center gap-2">
                            <ImageIcon className="h-5 w-5 text-purple-600" />
                            Cover Image & Preview
                          </h2>
                          <p className="text-sm text-gray-500">Add a cover image and preview your story before submitting.</p>
                        </div>

                        {/* Cover Image Upload */}
                        <div className="space-y-2">
                          <Label htmlFor="coverImage" className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                            <ImageIcon className="h-3.5 w-3.5" />
                            Cover Image URL (Optional)
                          </Label>
                          <div className="relative">
                            <Input
                              id="coverImage"
                              value={form.coverImage}
                              onChange={(e) => updateForm('coverImage', e.target.value)}
                              placeholder="https://example.com/your-cover-image.jpg"
                              className="h-11"
                            />
                          </div>
                          <p className="text-xs text-gray-400">
                            Provide a direct URL to your cover image. Recommended size: 1200x630px
                          </p>

                          {/* Cover Preview */}
                          {form.coverImage && (
                            <div className="mt-3 rounded-xl overflow-hidden border border-gray-200 h-48">
                              <img src={form.coverImage} alt="Cover preview" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                            </div>
                          )}
                          {!form.coverImage && (
                            <div className="mt-3 rounded-xl border-2 border-dashed border-gray-200 h-48 flex flex-col items-center justify-center bg-gray-50">
                              <ImageIcon className="h-10 w-10 text-gray-300 mb-2" />
                              <p className="text-sm text-gray-400">No cover image provided</p>
                              <p className="text-xs text-gray-300 mt-1">Your story will use a default cover</p>
                            </div>
                          )}
                        </div>

                        <Separator />

                        {/* Guidelines */}
                        <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                          <div className="flex items-start gap-3">
                            <AlertCircle className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                            <div className="text-sm text-blue-800">
                              <p className="font-semibold mb-1">Submission Guidelines</p>
                              <ul className="list-disc list-inside space-y-1 text-blue-700">
                                <li>Stories must be original work</li>
                                <li>Content should be appropriate for all ages</li>
                                <li>Minimum 500 characters recommended</li>
                                <li>Our team will review and may suggest edits before publishing</li>
                                <li>You&apos;ll be notified via email once your story is reviewed</li>
                              </ul>
                            </div>
                          </div>
                        </div>

                        {/* Preview */}
                        <PreviewPanel form={form} />
                      </div>
                    )}

                    {/* Step 4: Submit */}
                    {step === 4 && (
                      <div className="space-y-6">
                        <div className="text-center py-6">
                          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-purple-500/20">
                            <Send className="h-8 w-8 text-white" />
                          </div>
                          <h2 className="text-xl font-bold text-gray-900 mb-2">Ready to Submit?</h2>
                          <p className="text-sm text-gray-500 max-w-md mx-auto">
                            Review your story details one last time. Once submitted, our editorial team will review it within 1-3 business days.
                          </p>
                        </div>

                        <PreviewPanel form={form} />

                        {!canSubmit && (
                          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                            <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                            <div>
                              <p className="text-sm font-semibold text-amber-800">Please fix the following before submitting:</p>
                              <ul className="text-sm text-amber-700 mt-1 list-disc list-inside">
                                {!form.title && <li>Story title is required</li>}
                                {!form.authorName && <li>Author name is required</li>}
                                {!form.authorEmail && <li>Email is required</li>}
                                {form.content.trim().split(/\s+/).length < WORD_GOAL_MIN && (
                                  <li>Story needs at least {WORD_GOAL_MIN} words (currently {form.content.trim().split(/\s+/).length})</li>
                                )}
                              </ul>
                            </div>
                          </div>
                        )}

                        {canSubmit && (
                          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
                            <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                            <p className="text-sm text-emerald-700">
                              <span className="font-semibold">Everything looks great!</span> Your story is ready to be submitted for review.
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Navigation Buttons */}
                    <div className="flex items-center justify-between mt-8 pt-6 border-t">
                      {step > 1 ? (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setStep(step - 1)}
                          className="gap-2"
                        >
                          <ArrowLeft className="h-4 w-4" /> Previous
                        </Button>
                      ) : (
                        <Link href="/stories">
                          <Button type="button" variant="ghost" className="gap-2 text-gray-500">
                            <ArrowLeft className="h-4 w-4" /> Back to Stories
                          </Button>
                        </Link>
                      )}

                      {step < 4 ? (
                        <Button
                          type="button"
                          onClick={() => {
                            if (step === 1 && !canProceedStep1) {
                              toast.error('Please fill in title, author name, and email.');
                              return;
                            }
                            if (step === 2 && !canProceedStep2) {
                              toast.error(`Please write at least ${WORD_GOAL_MIN} words.`);
                              return;
                            }
                            setStep(step + 1);
                          }}
                          className="bg-purple-600 hover:bg-purple-700 text-white gap-2"
                        >
                          Next <ChevronRight className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button
                          type="submit"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                          disabled={loading || !canSubmit}
                        >
                          {loading ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              Submitting...
                            </>
                          ) : (
                            <>
                              <Send className="h-4 w-4" />
                              Submit Story
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </form>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar - Writing Tips (steps 1-2) */}
            {(step === 1 || step === 2) && (
              <div className="hidden lg:block">
                <WritingTipsSidebar />
              </div>
            )}

            {/* Sidebar - Progress (step 3-4) */}
            {(step === 3 || step === 4) && (
              <div className="hidden lg:block space-y-4">
                <Card className="border-gray-100">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                      <Target className="h-4 w-4 text-purple-600" />
                      Completion Checklist
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {[
                      { label: 'Story title', done: !!form.title },
                      { label: 'Author information', done: !!form.authorName && !!form.authorEmail },
                      { label: 'Category selected', done: !!form.category },
                      { label: `Min ${WORD_GOAL_MIN} words`, done: form.content.trim().split(/\s+/).length >= WORD_GOAL_MIN },
                      { label: 'Cover image (optional)', done: !!form.coverImage },
                    ].map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm">
                        {item.done ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                        ) : (
                          <div className="w-4 h-4 rounded-full border-2 border-gray-300 shrink-0" />
                        )}
                        <span className={item.done ? 'text-gray-700' : 'text-gray-400'}>{item.label}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
