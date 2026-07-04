'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { School, ArrowRight, CheckCircle2, Timer, ChevronRight, Shield, Lock, Eye } from 'lucide-react';
import { toast, Toaster } from 'sonner';
import { Calculator } from '@/components/shared/calculator';

interface ExamQuestion {
  id: string;
  type: string;
  questionText: string;
  options: string | null;
  marks: number;
  mediaUrl: string | null;
  order: number;
}

interface ExamData {
  id: string;
  title: string;
  description: string | null;
  type: string;
  duration: number | null;
  instructions: string | null;
  totalMarks: number;
  school: { id: string; name: string; logo: string | null; primaryColor: string };
  questions: ExamQuestion[];
  securitySettings: Record<string, boolean | number> | null;
  allowCalculator: boolean;
  calculatorMode: 'none' | 'basic' | 'scientific' | 'both';
}

type Step = 'code-entry' | 'registration' | 'pending-approval' | 'rejected' | 'deferred-offer' | 'exam-room' | 'submitted';

interface RegistrationResult {
  id: string;
  registrationStatus: string;
}

function CodeEntryStep({ onValidated }: {
  onValidated: (exam: ExamData) => void;
}) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/public/entrance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim().toUpperCase() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Invalid code');
      onValidated(json.data);
    } catch (err: any) {
      toast.error(err.message || 'Invalid or expired exam code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="w-full max-w-md mx-auto">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-8 text-white text-center">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
            <Lock className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold">Enter Your Access Code</h2>
          <p className="text-emerald-100 mt-1 text-sm">Enter the code provided by your school or interviewer</p>
        </div>
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Exam / Interview Code</label>
            <input type="text" value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="e.g. ABC123" maxLength={8}
              className="w-full px-4 py-4 rounded-xl border-2 border-gray-200 text-center text-2xl font-bold tracking-widest focus:border-emerald-500 focus:outline-none transition-colors font-mono" required />
          </div>
          <button type="submit" disabled={loading || code.length < 5}
            className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-4 rounded-xl font-semibold text-lg flex items-center justify-center gap-3 hover:from-emerald-700 hover:to-teal-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/20">
            {loading ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <>Verify Code <ArrowRight className="h-5 w-5" /></>}
          </button>
          <div className="text-center">
            <Link href="/login" className="text-sm text-gray-500 hover:text-emerald-600 transition-colors">← Back to Login</Link>
          </div>
        </form>
      </div>
    </motion.div>
  );
}

function RegistrationForm({ exam, onRegistered }: { exam: ExamData; onRegistered: (result: RegistrationResult) => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [appliedClass, setAppliedClass] = useState('');
  const [loading, setLoading] = useState(false);

  const classOptions = ['JS1', 'JS2', 'JS3', 'SS1', 'SS2', 'SS3', 'Primary 1', 'Primary 2', 'Primary 3', 'Primary 4', 'Primary 5', 'Primary 6'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !address.trim()) {
      toast.error('Name and address are required.');
      return;
    }
    setLoading(true);
    try {
      const sessionRes = await fetch('/api/auth/session');
      const session = await sessionRes.json();
      const userId = session?.user?.id || null;

      const res = await fetch('/api/entrance-exams?action=register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          examId: exam.id,
          applicantName: name,
          applicantEmail: email || null,
          applicantPhone: phone || null,
          applicantAddress: address,
          appliedClass: appliedClass || null,
          userId,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Registration failed');
      toast.success('Registration submitted!');
      onRegistered({ id: json.data.id, registrationStatus: json.data.registrationStatus });
    } catch (err: any) {
      toast.error(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} className="w-full max-w-lg mx-auto">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            {exam.school.logo ? (
              <img src={exam.school.logo} alt={exam.school.name} className="w-10 h-10 rounded-lg" />
            ) : (
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: exam.school.primaryColor + '20' }}>
                <School className="h-5 w-5" style={{ color: exam.school.primaryColor }} />
              </div>
            )}
            <div>
              <h3 className="font-bold text-gray-900">{exam.school.name}</h3>
              <p className="text-sm text-gray-500">{exam.title} · Registration</p>
            </div>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Class Applying For <span className="text-red-500">*</span></label>
            <select value={appliedClass} onChange={e => setAppliedClass(e.target.value)} required
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-emerald-500 focus:outline-none">
              <option value="">Select class</option>
              {classOptions.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Full Name <span className="text-red-500">*</span></label>
            <input value={name} onChange={e => setName(e.target.value)} type="text" placeholder="Enter your full name" required
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-emerald-500 focus:outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
              <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="your@email.com"
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-emerald-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Phone</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} type="tel" placeholder="Phone number"
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-emerald-500 focus:outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Address <span className="text-red-500">*</span></label>
            <textarea value={address} onChange={e => setAddress(e.target.value)} placeholder="Your full address" required rows={2}
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-emerald-500 focus:outline-none" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-4 rounded-xl font-semibold text-lg flex items-center justify-center gap-3 hover:from-emerald-700 hover:to-teal-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/20">
            {loading ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" /> : 'Start Exam'}
          </button>
        </form>
      </div>
    </motion.div>
  );
}

function ExamRoom({ exam, attemptId, onSubmitted }: {
  exam: ExamData;
  attemptId?: string;
  onSubmitted: (score: number) => void;
}) {
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [currentQ, setCurrentQ] = useState(0);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [violations, setViolations] = useState<Array<{ type: string; timestamp: string }>>([]);
  const [timeLeft, setTimeLeft] = useState(exam.duration ? exam.duration * 60 : null);
  const [submitting, setSubmitting] = useState(false);
  const [showViolation, setShowViolation] = useState(false);
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const startTime = useRef(Date.now());
  const handleSubmitRef = useRef<(() => void) | null>(null);

  const questions = exam.questions;
  const security = exam.securitySettings;
  const tabCountRef = useRef(0);
  tabCountRef.current = tabSwitchCount;

  useEffect(() => {
    if (security?.fullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
    return () => {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, [security]);

  useEffect(() => {
    if (!security?.tabSwitchWarning) return;
    const handleVisibility = () => {
      if (document.hidden) {
        const newCount = tabCountRef.current + 1;
        setTabSwitchCount(newCount);
        tabCountRef.current = newCount;
        setViolations(prev => [...prev, { type: 'tab_switch', timestamp: new Date().toISOString() }]);
        setShowViolation(true);
        setTimeout(() => setShowViolation(false), 3000);
        if (security?.tabSwitchAutoSubmit && handleSubmitRef.current) handleSubmitRef.current();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [security]);

  useEffect(() => {
    if (!security?.blockCopyPaste) return;
    const prevent = (e: Event) => e.preventDefault();
    document.addEventListener('copy', prevent);
    document.addEventListener('cut', prevent);
    document.addEventListener('paste', prevent);
    return () => { document.removeEventListener('copy', prevent); document.removeEventListener('cut', prevent); document.removeEventListener('paste', prevent); };
  }, [security]);

  useEffect(() => {
    if (!security?.blockRightClick) return;
    const prevent = (e: MouseEvent) => e.preventDefault();
    document.addEventListener('contextmenu', prevent);
    return () => document.removeEventListener('contextmenu', prevent);
  }, [security]);

  useEffect(() => {
    if (!security?.blockKeyboardShortcuts && !security?.fullscreen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (security?.fullscreen && e.key === 'Escape') { e.preventDefault(); return; }
      if ((e.ctrlKey || e.metaKey) && ['c', 'v', 'x', 'a', 's', 'p', 'u', 'i'].includes(e.key.toLowerCase())) e.preventDefault();
      if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && ['I', 'J', 'C', 'K'].includes(e.key.toUpperCase()))) e.preventDefault();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [security]);

  useEffect(() => {
    if (timeLeft === null) return;
    if (timeLeft <= 0) { handleSubmit(); return; }
    const t = setTimeout(() => setTimeLeft(prev => (prev !== null ? prev - 1 : null)), 1000);
    return () => clearTimeout(t);
  }, [timeLeft]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const handleAnswer = (qId: string, answer: string) => setAnswers(prev => ({ ...prev, [qId]: answer }));

  const handleSubmit = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    const timeTakenSeconds = Math.floor((Date.now() - startTime.current) / 1000);
    try {
      const res = await fetch(`/api/public/entrance/${exam.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers, securityViolations: violations, tabSwitchCount, timeTakenSeconds, attemptId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      onSubmitted(json.data?.score || 0);
    } catch (err: any) {
      toast.error(err.message || 'Submission failed');
      setSubmitting(false);
    }
  }, [submitting, exam.id, answers, violations, tabSwitchCount, attemptId, onSubmitted]);

  handleSubmitRef.current = handleSubmit;

  const q = questions[currentQ];
  const progressPct = questions.length > 0 ? ((currentQ + 1) / questions.length) * 100 : 0;
  const answeredCount = Object.keys(answers).length;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: exam.school.primaryColor + '20' }}>
            <School className="h-4 w-4" style={{ color: exam.school.primaryColor }} />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900 truncate max-w-[200px]">{exam.title}</p>
            <p className="text-xs text-gray-500">{exam.school.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {tabSwitchCount > 0 && (
            <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full font-semibold">⚠️ {tabSwitchCount} switch{tabSwitchCount > 1 ? 'es' : ''}</span>
          )}
          {timeLeft !== null && (
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold ${timeLeft < 300 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
              <Timer className="h-4 w-4" /> {formatTime(timeLeft)}
            </div>
          )}
          {exam.allowCalculator && exam.calculatorMode !== 'none' && (
            <button onClick={() => setCalculatorOpen(prev => !prev)}
              className={`text-sm font-semibold px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5 ${calculatorOpen ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="2" width="16" height="20" rx="2" /><line x1="8" y1="6" x2="16" y2="6" /><line x1="8" y1="10" x2="8" y2="10.01" /><line x1="12" y1="10" x2="12" y2="10.01" /><line x1="16" y1="10" x2="16" y2="10.01" /><line x1="8" y1="14" x2="8" y2="14.01" /><line x1="12" y1="14" x2="12" y2="14.01" /><line x1="16" y1="14" x2="16" y2="14.01" /><line x1="8" y1="18" x2="8" y2="18.01" /><line x1="12" y1="18" x2="12" y2="18.01" /><line x1="16" y1="18" x2="16" y2="18.01" />
              </svg>
              Calculator
            </button>
          )}
          <button onClick={handleSubmit} disabled={submitting}
            className="bg-emerald-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50">
            {submitting ? 'Submitting...' : 'Submit Exam'}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showViolation && (
          <motion.div initial={{ y: -50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -50, opacity: 0 }}
            className="bg-red-600 text-white text-center py-2.5 text-sm font-semibold">
            ⚠️ Tab switching detected! This is recorded. Violations: {tabSwitchCount}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-white border-b border-gray-200 px-4 py-2">
        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
          <span>Question {currentQ + 1} of {questions.length}</span>
          <span>{answeredCount} of {questions.length} answered</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-300" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="hidden md:flex flex-col w-56 bg-white border-r border-gray-200 p-3 overflow-y-auto gap-1">
          <p className="text-xs font-semibold text-gray-500 mb-2">Questions</p>
          <div className="grid grid-cols-5 gap-1">
            {questions.map((_, i) => (
              <button key={i} onClick={() => setCurrentQ(i)}
                className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors ${i === currentQ ? 'bg-emerald-600 text-white' : answers[questions[i].id] ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {i + 1}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          {q && (
            <motion.div key={q.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }}>
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 max-w-3xl mx-auto">
                <div className="flex items-start justify-between mb-4">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                    {q.type} · {q.marks} mark{q.marks !== 1 ? 's' : ''}
                  </span>
                </div>
                <p className="text-base md:text-lg font-medium text-gray-900 leading-relaxed mb-6 whitespace-pre-wrap">{q.questionText}</p>
                {q.mediaUrl && <img src={q.mediaUrl} alt="Question media" className="w-full max-h-64 object-contain rounded-xl border border-gray-200 mb-6" />}

                {(q.type === 'MCQ' || q.type === 'TRUE_FALSE') && q.options && (() => {
                  const opts: string[] = JSON.parse(q.options);
                  return (
                    <div className="space-y-3">
                      {opts.map((opt, i) => (
                        <label key={i} className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${answers[q.id] === opt ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}>
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${answers[q.id] === opt ? 'border-emerald-500 bg-emerald-500' : 'border-gray-300'}`}>
                            {answers[q.id] === opt && <div className="w-2 h-2 rounded-full bg-white" />}
                          </div>
                          <input type="radio" name={q.id} value={opt} checked={answers[q.id] === opt} onChange={e => handleAnswer(q.id, e.target.value)} className="sr-only" />
                          <span className="font-medium">{opt}</span>
                        </label>
                      ))}
                    </div>
                  );
                })()}

                {q.type === 'MULTI_SELECT' && q.options && (() => {
                  const opts: string[] = JSON.parse(q.options);
                  const sel: string[] = (answers[q.id] as string[]) || [];
                  const toggle = (opt: string) => {
                    const newSel = sel.includes(opt) ? sel.filter(s => s !== opt) : [...sel, opt];
                    setAnswers(prev => ({ ...prev, [q.id]: newSel }));
                  };
                  return (
                    <div className="space-y-3">
                      <p className="text-xs text-gray-500 mb-2">Select all that apply</p>
                      {opts.map((opt, i) => (
                        <label key={i} onClick={() => toggle(opt)} className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${sel.includes(opt) ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 hover:border-gray-300'}`}>
                          <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center ${sel.includes(opt) ? 'border-emerald-500 bg-emerald-500' : 'border-gray-300'}`}>
                            {sel.includes(opt) && <CheckCircle2 className="h-3 w-3 text-white" />}
                          </div>
                          <span className="font-medium">{opt}</span>
                        </label>
                      ))}
                    </div>
                  );
                })()}

                {(q.type === 'SHORT_ANSWER' || q.type === 'FILL_BLANK') && (
                  <input type="text" value={(answers[q.id] as string) || ''} onChange={e => handleAnswer(q.id, e.target.value)} placeholder="Type your answer here..."
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-emerald-500 focus:outline-none transition-colors" />
                )}

                {q.type === 'ESSAY' && (
                  <textarea value={(answers[q.id] as string) || ''} onChange={e => handleAnswer(q.id, e.target.value)} placeholder="Write your detailed answer here..." rows={8}
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-emerald-500 focus:outline-none transition-colors resize-none" />
                )}

                <div className="flex justify-between mt-8 gap-3">
                  <button onClick={() => setCurrentQ(prev => Math.max(0, prev - 1))} disabled={currentQ === 0}
                    className="px-6 py-2.5 rounded-xl border-2 border-gray-200 font-semibold text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                    ← Previous
                  </button>
                  {currentQ < questions.length - 1 ? (
                    <button onClick={() => setCurrentQ(prev => prev + 1)}
                      className="px-6 py-2.5 rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-700 transition-colors flex items-center gap-2">
                      Next <ChevronRight className="h-4 w-4" />
                    </button>
                  ) : (
                    <button onClick={handleSubmit} disabled={submitting}
                      className="px-8 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-sm hover:from-emerald-700 hover:to-teal-700 transition-all shadow-lg shadow-emerald-500/30 flex items-center gap-2 disabled:opacity-50">
                      {submitting ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <CheckCircle2 className="h-4 w-4" />}
                      Submit Exam
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
          {questions.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground py-24">
              <Eye className="h-12 w-12 opacity-30" />
              <p className="text-lg font-semibold">No questions yet</p>
              <p className="text-sm">The admin has not added questions to this exam yet. Please contact your school.</p>
            </div>
          )}
        </div>
      </div>
      {exam.allowCalculator && exam.calculatorMode !== 'none' && calculatorOpen && (
        <Calculator mode={exam.calculatorMode === 'scientific' ? 'scientific' : 'basic'} allowedMode={exam.calculatorMode} onToggle={() => setCalculatorOpen(false)} />
      )}
    </motion.div>
  );
}

function SubmittedScreen({ score, total, school }: { score: number; total: number; school: string }) {
  const pct = total > 0 ? Math.round((score / total) * 100) : 0;
  return (
    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md mx-auto text-center">
      <div className="bg-white rounded-2xl shadow-xl p-10 border border-gray-100">
        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="h-10 w-10 text-emerald-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Exam Submitted!</h2>
        <p className="text-gray-500 mb-6">Your exam has been submitted to <strong>{school}</strong>. Your results are now pending review by the school administration.</p>
        <div className="bg-gray-50 rounded-xl p-4 mb-6">
          <p className="text-sm text-gray-500">Auto-Graded Score</p>
          <p className="text-4xl font-bold text-emerald-600 mt-1">{score} <span className="text-xl text-gray-400">/ {total}</span></p>
          <p className="text-sm text-gray-500 mt-1">{pct}% · The admin will review essay and subjective questions before making an admission decision.</p>
        </div>
        <Link href="/login" className="inline-flex items-center justify-center gap-2 w-full text-emerald-700 border-2 border-emerald-200 rounded-xl py-3 font-semibold hover:bg-emerald-50 transition-colors mb-3">
          ← Return to Login
        </Link>
      </div>
    </motion.div>
  );
}

interface EntranceWizardProps {
  initialExam?: ExamData;
  hideHeader?: boolean;
}

export function EntranceWizard({ initialExam, hideHeader }: EntranceWizardProps) {
  const [step, setStep] = useState<Step>(initialExam ? 'registration' : 'code-entry');
  const [exam, setExam] = useState<ExamData | null>(initialExam || null);
  const [attemptId, setAttemptId] = useState<string | undefined>(undefined);
  const [finalScore, setFinalScore] = useState(0);

  const handleCodeValidated = (e: ExamData) => {
    setExam(e);
    setStep('registration');
  };

  const handleRegistered = (result: RegistrationResult) => {
    setAttemptId(result.id);
    setStep('exam-room');
  };

  const handleSubmitted = (score: number) => {
    setFinalScore(score);
    setStep('submitted');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50">
      <Toaster position="top-right" richColors closeButton />

      {!hideHeader && step !== 'exam-room' && (
        <header className="bg-white/80 backdrop-blur border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                <School className="h-4 w-4 text-white" />
              </div>
              <span className="font-bold text-gray-900">Skoolar</span>
            </Link>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Shield className="h-4 w-4 text-emerald-500" />
              <span>Secure Exam Portal</span>
            </div>
          </div>
        </header>
      )}

      <main className={step !== 'exam-room' ? 'max-w-2xl mx-auto px-4 py-8' : ''}>
        <AnimatePresence mode="wait">
          {step === 'code-entry' && <CodeEntryStep onValidated={handleCodeValidated} />}
          {step === 'registration' && exam && <RegistrationForm exam={exam} onRegistered={handleRegistered} />}
          {step === 'exam-room' && exam && <ExamRoom exam={exam} attemptId={attemptId} onSubmitted={handleSubmitted} />}
          {step === 'submitted' && exam && <SubmittedScreen score={finalScore} total={exam.totalMarks} school={exam.school.name} />}
        </AnimatePresence>
      </main>
    </div>
  );
}
