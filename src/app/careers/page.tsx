'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Briefcase, MapPin, Clock, DollarSign, Globe, ChevronRight, Send, Loader2, Building2 } from 'lucide-react';
import { toast, Toaster } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface JobPosting {
  id: string;
  title: string;
  department: string | null;
  description: string;
  requirements: string | null;
  responsibilities: string | null;
  qualifications: string | null;
  location: string | null;
  type: string;
  experience: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  isRemote: boolean;
  expiresAt: string | null;
  code: string;
  school: { id: string; name: string; logo: string | null; primaryColor: string };
}

const jobTypes: Record<string, { label: string; color: string }> = {
  full_time: { label: 'Full Time', color: '#10b981' },
  part_time: { label: 'Part Time', color: '#3b82f6' },
  contract: { label: 'Contract', color: '#8b5cf6' },
  internship: { label: 'Internship', color: '#f59e0b' },
  freelance: { label: 'Freelance', color: '#6b7280' },
};

function JobCard({ job, onApply }: { job: JobPosting; onApply: (job: JobPosting) => void }) {
  const typeInfo = jobTypes[job.type] || { label: job.type, color: '#6b7280' };
  const currency = job.salaryCurrency || '$';
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border bg-card p-6 hover:shadow-lg transition-shadow"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-semibold text-lg">{job.title}</h3>
            <Badge style={{ backgroundColor: typeInfo.color + '20', color: typeInfo.color }}>
              {typeInfo.label}
            </Badge>
            {job.isRemote && (
              <Badge variant="secondary">Remote</Badge>
            )}
          </div>
          
          {job.department && (
            <p className="text-sm text-muted-foreground mb-3">{job.department}</p>
          )}
          
          <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
            {job.description}
          </p>
          
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            {job.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                {job.location}
              </span>
            )}
            {job.salaryMin || job.salaryMax ? (
              <span className="flex items-center gap-1">
                <DollarSign className="h-4 w-4" />
                {currency}{job.salaryMin || '?'} - {currency}{job.salaryMax || '?'}
              </span>
            ) : null}
          </div>
        </div>
        
        <Button onClick={() => onApply(job)}>
          Apply Now
        </Button>
      </div>
    </motion.div>
  );
}

function ApplicationForm({ job, onSubmit, onCancel }: {
  job: JobPosting;
  onSubmit: (data: { applicantName: string; applicantEmail: string; applicantPhone: string; applicantAddress: string; resumeUrl: string; coverLetter: string; linkedinUrl: string; portfolioUrl: string; yearsExperience?: number }) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    applicantName: '',
    applicantEmail: '',
    applicantPhone: '',
    applicantAddress: '',
    resumeUrl: '',
    coverLetter: '',
    linkedinUrl: '',
    portfolioUrl: '',
    yearsExperience: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.applicantName || !form.applicantEmail) {
      toast.error('Name and email are required');
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({
        ...form,
        yearsExperience: form.yearsExperience ? parseInt(form.yearsExperience) : undefined,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Card>
        <CardHeader>
          <CardTitle>Apply for {job.title}</CardTitle>
          <CardDescription>
            at {job.school.name}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label>Full Name *</Label>
                <Input
                  value={form.applicantName}
                  onChange={e => setForm(f => ({ ...f, applicantName: e.target.value }))}
                  placeholder="Your full name"
                  required
                />
              </div>
              
              <div className="grid gap-2">
                <Label>Email *</Label>
                <Input
                  type="email"
                  value={form.applicantEmail}
                  onChange={e => setForm(f => ({ ...f, applicantEmail: e.target.value }))}
                  placeholder="your@email.com"
                  required
                />
              </div>
              
              <div className="grid gap-2">
                <Label>Phone</Label>
                <Input
                  value={form.applicantPhone}
                  onChange={e => setForm(f => ({ ...f, applicantPhone: e.target.value }))}
                  placeholder="+1 234 567 8900"
                />
              </div>
              
              <div className="grid gap-2">
                <Label>Address</Label>
                <Input
                  value={form.applicantAddress}
                  onChange={e => setForm(f => ({ ...f, applicantAddress: e.target.value }))}
                  placeholder="Your current address"
                />
              </div>
              
              <div className="grid gap-2">
                <Label>Years of Experience</Label>
                <Input
                  type="number"
                  value={form.yearsExperience}
                  onChange={e => setForm(f => ({ ...f, yearsExperience: e.target.value }))}
                  placeholder="e.g., 3"
                />
              </div>
              
              <div className="grid gap-2">
                <Label>Resume URL (Google Drive, Dropbox, etc.)</Label>
                <Input
                  value={form.resumeUrl}
                  onChange={e => setForm(f => ({ ...f, resumeUrl: e.target.value }))}
                  placeholder="Link to your resume"
                />
              </div>
              
              <div className="grid gap-2">
                <Label>LinkedIn Profile</Label>
                <Input
                  value={form.linkedinUrl}
                  onChange={e => setForm(f => ({ ...f, linkedinUrl: e.target.value }))}
                  placeholder="https://linkedin.com/in/yourprofile"
                />
              </div>
              
              <div className="grid gap-2">
                <Label>Portfolio Website</Label>
                <Input
                  value={form.portfolioUrl}
                  onChange={e => setForm(f => ({ ...f, portfolioUrl: e.target.value }))}
                  placeholder="https://yourportfolio.com"
                />
              </div>
              
              <div className="grid gap-2">
                <Label>Cover Letter</Label>
                <Textarea
                  value={form.coverLetter}
                  onChange={e => setForm(f => ({ ...f, coverLetter: e.target.value }))}
                  placeholder="Tell us why you're the ideal candidate..."
                  className="min-h-[120px]"
                />
              </div>
            </div>
            
            <div className="flex gap-2 pt-4">
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...</>
                ) : (
                  <><Send className="mr-2 h-4 w-4" /> Submit Application</>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function CareersPage() {
  const [search, setSearch] = useState('');
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<JobPosting | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    loadJobs();
  }, [search]);

  const loadJobs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      params.set('limit', '50');
      const res = await fetch(`/api/public/jobs?${params}`);
      if (!res.ok) throw new Error('Failed to load jobs');
      const data = await res.json();
      setJobs(data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async (data: { applicantName: string; applicantEmail: string; applicantPhone: string; applicantAddress: string; resumeUrl: string; coverLetter: string; linkedinUrl: string; portfolioUrl: string; yearsExperience?: number }) => {
    if (!selectedJob) return;
    
    try {
      const res = await fetch('/api/public/jobs/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobPostingId: selectedJob.id,
          ...data,
        }),
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to submit application');
      }
      
      toast.success('Application submitted successfully!');
      setSubmitted(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to submit application';
      toast.error(message);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center p-4">
        <Card className="max-w-md text-center">
          <CardContent className="pt-6">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4"
            >
              <Briefcase className="h-10 w-10 text-green-600" />
            </motion.div>
            <h2 className="text-2xl font-bold mb-2">Application Submitted!</h2>
            <p className="text-muted-foreground mb-6">
              Thank you for applying. The school will review your application and get back to you soon.
            </p>
            <Button onClick={() => { setSubmitted(false); setSelectedJob(null); }}>
              Browse More Jobs
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="container mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4 flex items-center justify-center gap-3">
            <Briefcase className="h-10 w-10" />
            Careers
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Explorejob opportunities at schools and apply directly online
          </p>
        </div>

        {selectedJob ? (
          <div className="max-w-2xl mx-auto">
            <div className="rounded-lg border bg-card p-6 mb-6">
              <div className="flex items-center gap-4 mb-4">
                {selectedJob.school.logo ? (
                  <img src={selectedJob.school.logo} alt={selectedJob.school.name} className="h-12 w-12 rounded object-cover" />
                ) : (
                  <div className="h-12 w-12 rounded bg-muted flex items-center justify-center">
                    <Building2 className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <div>
                  <h2 className="font-semibold text-lg">{selectedJob.title}</h2>
                  <p className="text-sm text-muted-foreground">{selectedJob.school.name}</p>
                </div>
              </div>
              
              {selectedJob.requirements && (
                <div className="mb-4">
                  <h3 className="font-medium mb-2">Requirements</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{selectedJob.requirements}</p>
                </div>
              )}
              
              {selectedJob.responsibilities && (
                <div className="mb-4">
                  <h3 className="font-medium mb-2">Responsibilities</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{selectedJob.responsibilities}</p>
                </div>
              )}
              
              {selectedJob.qualifications && (
                <div className="mb-4">
                  <h3 className="font-medium mb-2">Qualifications</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{selectedJob.qualifications}</p>
                </div>
              )}
            </div>
            
            <ApplicationForm
              job={selectedJob}
              onSubmit={handleApply}
              onCancel={() => setSelectedJob(null)}
            />
          </div>
        ) : (
          <>
            <div className="max-w-md mx-auto mb-8">
              <Input
                placeholder="Search jobs..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : jobs.length === 0 ? (
              <Card className="max-w-md mx-auto">
                <CardContent className="pt-6 text-center">
                  <Briefcase className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    No job openings available at the moment. Please check back later.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 max-w-3xl mx-auto">
                {jobs.map(job => (
                  <JobCard key={job.id} job={job} onApply={setSelectedJob} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
      
      <Toaster />
    </div>
  );
}