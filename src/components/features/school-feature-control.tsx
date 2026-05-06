'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { useAppStore } from '@/store/app-store';
import {
  Building2, Shield, Users, GraduationCap, Lock, Unlock, Save, CheckCircle2, XCircle, School, UserCog, Calculator as CalcIcon, BookOpen, Video, ClipboardList, TrendingUp, BarChart3, MessageSquare, Bell, FileEdit, Award, Calendar, Wallet, Library, Eye, Heart, Settings, UserCheck,
  FileText, ArrowUpCircle, Layers, Search, Mail, Palette, Sliders, Upload, ScanLine, IdCard, ClipboardCheck, Megaphone, Pin, LifeBuoy, ShieldAlert,
  BookText, Clock, CreditCard, Receipt, Repeat, Briefcase, List, Trophy, Sparkles, Play, PenTool, MonitorPlay, ShieldCheck, MessageCircle, User,
  Download, KeyRound, Activity, GitCompare,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// All available features in the platform
const ALL_FEATURES: { id: string; label: string; icon: typeof Shield; category: string; description: string }[] = [
  // Academics
  { id: 'exams', label: 'Exams & Tests', icon: FileEdit, category: 'Academics', description: 'Create and manage examinations, tests, and quizzes' },
  { id: 'homework', label: 'Homework', icon: ClipboardList, category: 'Academics', description: 'Assign and grade homework tasks' },
  { id: 'video-lessons', label: 'Video Lessons', icon: Video, category: 'Academics', description: 'Upload and share video lessons' },
  { id: 'attendance', label: 'Attendance', icon: Calendar, category: 'Academics', description: 'Track daily student attendance' },
  { id: 'report-cards', label: 'Report Cards', icon: Award, category: 'Academics', description: 'Generate student report cards' },
  { id: 'results', label: 'Results & Scores', icon: BarChart3, category: 'Academics', description: 'View and manage academic results' },
  { id: 'analytics', label: 'Performance Analytics', icon: TrendingUp, category: 'Academics', description: 'Track student performance trends' },
  { id: 'ai-grading', label: 'AI Grading', icon: Settings, category: 'Academics', description: 'AI-powered assignment grading' },
  { id: 'ai-assistant', label: 'AI Assistant', icon: Sparkles, category: 'Academics', description: 'AI study assistant for students' },
  { id: 'lesson-plans', label: 'Lesson Plans', icon: BookText, category: 'Academics', description: 'Create and manage lesson plans' },
  { id: 'academic-structure', label: 'Academic Structure', icon: GraduationCap, category: 'Academics', description: 'Manage classes, subjects, and academic terms' },
  { id: 'subjects', label: 'Subjects', icon: BookOpen, category: 'Academics', description: 'Manage academic subjects' },
  { id: 'classes', label: 'Classes', icon: Users, category: 'Academics', description: 'Manage classes and class groups' },
  { id: 'teacher-grades', label: 'Teacher Grades', icon: Award, category: 'Academics', description: 'View and manage teacher grading' },
  { id: 'student-promotion', label: 'Student Promotions', icon: ArrowUpCircle, category: 'Academics', description: 'Promote students to next class/grade' },
  { id: 'report-card-view', label: 'Generate Report Cards', icon: FileText, category: 'Academics', description: 'Generate and publish student report cards' },
  { id: 'entrance-exams', label: 'Entrance Exams', icon: UserCheck, category: 'Academics', description: 'Manage entrance examinations and applications' },
  { id: 'year-results', label: 'Year Results', icon: BarChart3, category: 'Academics', description: 'Comprehensive year results (Term 1-3)' },
  { id: 'weekly-evaluations', label: 'Weekly Evaluations', icon: ClipboardCheck, category: 'Academics', description: 'Create and manage weekly student evaluations' },
  { id: 'timetable', label: 'Timetable', icon: Clock, category: 'Academics', description: 'Manage school and class timetables' },
  { id: 'student-leaderboard', label: 'Student Leaderboard', icon: Trophy, category: 'Academics', description: 'Display student performance leaderboard' },
  { id: 'student-video-lessons', label: 'Student Video Lessons', icon: Play, category: 'Academics', description: 'Students access video lessons' },
  { id: 'student-ai-chat', label: 'Student AI Chat', icon: Sparkles, category: 'Academics', description: 'AI study chat for students' },
  { id: 'teacher-tasks', label: 'Teacher Tasks', icon: ClipboardList, category: 'Academics', description: 'Manage teacher tasks and assignments' },
  { id: 'teacher-performance', label: 'Teacher Performance', icon: TrendingUp, category: 'Academics', description: 'Track teacher performance metrics' },
  // Student Life
  { id: 'achievements', label: 'Achievements', icon: Heart, category: 'Student Life', description: 'Student badges and achievements' },
  { id: 'behavior', label: 'Behavior Tracking', icon: Eye, category: 'Student Life', description: 'Track student behavior and discipline' },
  { id: 'health-records', label: 'Health Records', icon: Settings, category: 'Student Life', description: 'Student health and medical records' },
  { id: 'transport', label: 'Transport', icon: School, category: 'Student Life', description: 'School bus routes and transport' },
  { id: 'student-diary', label: 'Student Diary', icon: BookOpen, category: 'Student Life', description: 'Digital student diary' },
  { id: 'parent-portal', label: 'Parent Portal', icon: User, category: 'Student Life', description: 'Parent access to student information' },
  { id: 'parent-analytics', label: 'Parent Analytics', icon: BarChart3, category: 'Student Life', description: 'Parents view child analytics' },
  { id: 'parent-homework', label: 'Parent Homework View', icon: BookOpen, category: 'Student Life', description: 'Parents view child homework' },
  { id: 'parent-video-lessons', label: 'Parent Video Lessons', icon: Video, category: 'Student Life', description: 'Parents view child video lessons' },
  // Communication
  { id: 'announcements', label: 'Announcements', icon: Bell, category: 'Communication', description: 'School-wide announcements' },
  { id: 'in-app-chat', label: 'Messaging', icon: MessageSquare, category: 'Communication', description: 'In-app messaging system' },
  { id: 'feedback', label: 'Feedback', icon: MessageSquare, category: 'Communication', description: 'Student/parent feedback system' },
  { id: 'calendar', label: 'Calendar', icon: Calendar, category: 'Communication', description: 'School events calendar' },
  { id: 'notice-board', label: 'Notice Board', icon: FileEdit, category: 'Communication', description: 'School notice board' },
  { id: 'communication', label: 'Communication Center', icon: Mail, category: 'Communication', description: 'School-wide messaging and announcements' },
  { id: 'messaging-center', label: 'Messaging Center', icon: MessageCircle, category: 'Communication', description: 'Centralized messaging hub' },
  { id: 'notifications', label: 'Notifications', icon: Bell, category: 'Communication', description: 'System notifications management' },
  // Finance
  { id: 'finance', label: 'Fee Payments', icon: Wallet, category: 'Finance', description: 'Fee structure and payment tracking' },
  { id: 'payments', label: 'Payments', icon: CreditCard, category: 'Finance', description: 'Track and manage payments' },
  { id: 'fee-structure', label: 'Fee Structure', icon: Receipt, category: 'Finance', description: 'Define fee structures and billing' },
  { id: 'subscription', label: 'Subscription & Billing', icon: Wallet, category: 'Finance', description: 'Manage subscription and billing details' },
  { id: 'payment-verification', label: 'Payment Verification', icon: CreditCard, category: 'Finance', description: 'Verify and approve payments' },
  // Resources
  { id: 'library', label: 'Library', icon: BookOpen, category: 'Resources', description: 'Library and book management' },
  { id: 'books', label: 'Books', icon: BookOpen, category: 'Resources', description: 'Manage library books catalog' },
  { id: 'borrow-records', label: 'Borrow Records', icon: Repeat, category: 'Resources', description: 'Track book borrowing records' },
  { id: 'id-cards', label: 'ID Cards', icon: IdCard, category: 'Resources', description: 'Generate and manage student/staff ID cards' },
  { id: 'id-scanner', label: 'ID Scanner', icon: ScanLine, category: 'Resources', description: 'Scan student/staff ID cards' },
  { id: 'video-checkpoints', label: 'Video Checkpoints', icon: MonitorPlay, category: 'Resources', description: 'Video lesson checkpoints and quizzes' },
  // Operations
  { id: 'data-import', label: 'Data Import', icon: Upload, category: 'Operations', description: 'Import school data' },
  { id: 'data-export', label: 'Data Export', icon: Download, category: 'Operations', description: 'Export school data' },
  { id: 'bulk-operations', label: 'Bulk Operations', icon: Layers, category: 'Operations', description: 'Perform bulk operations on records' },
  { id: 'advanced-search', label: 'Advanced Search', icon: Search, category: 'Operations', description: 'Advanced search across all records' },
  { id: 'school-profile', label: 'School Profile', icon: Building2, category: 'Operations', description: 'Manage school public profile and information' },
  { id: 'school-settings', label: 'School Settings', icon: Sliders, category: 'Operations', description: 'Configure school-wide settings' },
  { id: 'branding', label: 'Branding', icon: Palette, category: 'Operations', description: 'Customize school branding and themes' },
  { id: 'class-monitoring', label: 'Class Monitoring', icon: Eye, category: 'Operations', description: 'Real-time class activity monitoring' },
  { id: 'school-calendar-enhanced', label: 'School Calendar', icon: Calendar, category: 'Operations', description: 'Enhanced school calendar with events' },
  { id: 'staff-attendance', label: 'Staff Attendance', icon: ShieldCheck, category: 'Operations', description: 'Track staff attendance' },
  { id: 'staff-self-attendance', label: 'Staff Self Attendance', icon: UserCheck, category: 'Operations', description: 'Staff mark their own attendance' },
  { id: 'job-postings', label: 'Job Postings', icon: Briefcase, category: 'Operations', description: 'Post and manage job openings' },
  { id: 'support', label: 'Support Requests', icon: LifeBuoy, category: 'Operations', description: 'Submit and manage support tickets' },
  { id: 'reports', label: 'Reports', icon: FileText, category: 'Operations', description: 'Generate and view reports' },
  // Admin
  { id: 'users-management', label: 'User Management', icon: Users, category: 'Admin', description: 'Manage school users and roles' },
  { id: 'students', label: 'Students', icon: GraduationCap, category: 'Admin', description: 'Manage student records' },
  { id: 'teachers', label: 'Teachers', icon: UserCog, category: 'Admin', description: 'Manage teacher records' },
  { id: 'parents', label: 'Parents', icon: User, category: 'Admin', description: 'Manage parent records' },
  { id: 'settings', label: 'Settings', icon: Settings, category: 'Admin', description: 'General system settings' },
  // Super Admin
  { id: 'schools', label: 'Schools', icon: Building2, category: 'Super Admin', description: 'Manage all schools on the platform' },
  { id: 'registration-codes', label: 'Registration Codes', icon: KeyRound, category: 'Super Admin', description: 'Manage school registration codes' },
  { id: 'system-health', label: 'System Health', icon: Activity, category: 'Super Admin', description: 'Monitor platform system health' },
  { id: 'audit-logs', label: 'Audit Logs', icon: FileText, category: 'Super Admin', description: 'View platform audit trails' },
  { id: 'school-comparison', label: 'School Comparison', icon: GitCompare, category: 'Super Admin', description: 'Compare metrics across schools' },
  { id: 'admin-analytics-advanced', label: 'Advanced Analytics', icon: Sparkles, category: 'Super Admin', description: 'Advanced platform analytics' },
  { id: 'platform-management', label: 'Platform Manager', icon: Shield, category: 'Super Admin', description: 'Manage platform-wide settings' },
  { id: 'school-controls', label: 'School Controls', icon: Sliders, category: 'Super Admin', description: 'Control feature access for schools' },
  { id: 'overlay-management', label: 'Overlay Manager', icon: Layers, category: 'Super Admin', description: 'Manage platform overlays' },
  { id: 'plans-manager', label: 'Plan Manager', icon: CreditCard, category: 'Super Admin', description: 'Manage subscription plans' },
  { id: 'danger-zone', label: 'Danger Zone', icon: ShieldAlert, category: 'Super Admin', description: 'Dangerous operations (use with caution)' },
];

const ALL_USER_ROLES: { id: string; label: string; description: string }[] = [
  { id: 'STUDENT', label: 'Students', description: 'Can enroll in classes, take exams, view results' },
  { id: 'TEACHER', label: 'Teachers', description: 'Can create content, grade students, manage classes' },
  { id: 'PARENT', label: 'Parents', description: 'Can view child performance and pay fees' },
  { id: 'ACCOUNTANT', label: 'Accountants', description: 'Can manage finances and payments' },
  { id: 'LIBRARIAN', label: 'Librarians', description: 'Can manage library and books' },
  { id: 'DIRECTOR', label: 'Directors', description: 'Can oversee academics and staff' },
];

interface SchoolInfo {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  isActive: boolean;
  plan: string;
  region: string | null;
  _count: { students: number; teachers: number };
}

export function SchoolFeatureControl() {
  const { currentUser, currentRole } = useAppStore();
  const [schools, setSchools] = useState<SchoolInfo[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState<string | null>(null);
  const [disabledFeatures, setDisabledFeatures] = useState<string[]>([]);
  const [disabledRoles, setDisabledRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchSchools = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/schools?limit=100');
      if (res.ok) {
        const json = await res.json();
        setSchools((json.data || []).filter((s: SchoolInfo) => s.isActive));
      }
    } catch {
      toast.error('Failed to load schools');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // For non-super admin, automatically set selected school to their own school
    if (currentRole !== 'SUPER_ADMIN' && currentUser.schoolId) {
      setSelectedSchoolId(currentUser.schoolId);
    }
  }, [currentRole, currentUser.schoolId]);

  useEffect(() => { fetchSchools(); }, [fetchSchools]);

  const fetchControls = useCallback(async (schoolId: string) => {
    try {
      const res = await fetch(`/api/schools/${schoolId}/controls`);
      if (res.ok) {
        const json = await res.json();
        setDisabledFeatures(json.data?.disabledFeatures || []);
        setDisabledRoles(json.data?.disabledUserRoles || []);
      }
    } catch {
      // Silent
    }
  }, []);

  const handleSchoolSelect = (schoolId: string) => {
    setSelectedSchoolId(schoolId);
    fetchControls(schoolId);
  };

  const toggleFeature = (featureId: string) => {
    setDisabledFeatures(prev =>
      prev.includes(featureId) ? prev.filter(f => f !== featureId) : [...prev, featureId]
    );
  };

  const toggleRole = (roleId: string) => {
    setDisabledRoles(prev =>
      prev.includes(roleId) ? prev.filter(r => r !== roleId) : [...prev, roleId]
    );
  };

  const handleSave = async () => {
    if (!selectedSchoolId) return;
    try {
      setSaving(true);
      const res = await fetch(`/api/schools/${selectedSchoolId}/controls`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          disabledFeatures,
          disabledUserRoles: disabledRoles,
        }),
      });
      if (res.ok) {
        toast.success('School controls updated successfully');
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error((err as { error?: string }).error || 'Failed to save');
      }
    } catch {
      toast.error('Failed to save controls');
    } finally {
      setSaving(false);
    }
  };

  const filteredSchools = searchQuery
    ? schools.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : schools;

  const featureCategories = [...new Set(ALL_FEATURES.map(f => f.category))];

  const selectedSchool = schools.find(s => s.id === selectedSchoolId);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight">School Feature & User Control</h2>
        <p className="text-sm text-muted-foreground">Select a school to manage which features and user roles are available</p>
      </div>

      {/* School Selector - Only for Super Admin */}
      {currentRole === 'SUPER_ADMIN' && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Select School</CardTitle>
            <CardDescription>Choose a school to configure</CardDescription>
          </CardHeader>
          <CardContent className="pb-4">
            {loading ? (
              <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : (
              <>
                <div className="relative mb-3">
                  <input
                    type="text"
                    placeholder="Search schools..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>
                <div className="max-h-64 overflow-y-auto space-y-1">
                  {filteredSchools.map(school => (
                    <button
                      key={school.id}
                      onClick={() => handleSchoolSelect(school.id)}
                      className={cn(
                        'w-full flex items-center gap-3 rounded-lg border p-3 text-left transition-colors',
                        selectedSchoolId === school.id
                          ? 'border-primary bg-primary/5 ring-1 ring-primary'
                          : 'hover:bg-muted/50'
                      )}
                    >
                      <div
                        className="size-10 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
                        style={{ backgroundColor: '#059669' }}
                      >
                        {school.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{school.name}</p>
                        <p className="text-xs text-muted-foreground">
                        {school.region} · {school.plan} plan · {(school._count?.students || 0)} students
                      </p>
                    </div>
                    {selectedSchoolId === school.id && (
                      <CheckCircle2 className="size-5 text-primary shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </CardContent>
        </Card>
      )}

    {/* Controls Panel */}
      {selectedSchool && selectedSchool && (
        <>
          {/* Features Toggle */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Lock className="size-4" />
                    Feature Controls
                  </CardTitle>
                  <CardDescription>
                    <span className="text-xs">
                      Disabled features: <Badge variant="destructive" className="ml-1 text-[10px]">{disabledFeatures.length}</Badge>
                    </span>
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-xs">
                  {selectedSchool.name}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {featureCategories.map(category => (
                  <div key={category}>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">{category}</h4>
                    <div className="space-y-1">
                      {ALL_FEATURES.filter(f => f.category === category).map(feature => {
                        const isDisabled = disabledFeatures.includes(feature.id);
                        const FeatureIcon = feature.icon;
                        return (
                          <div
                            key={feature.id}
                            className={cn(
                              'flex items-center justify-between gap-3 rounded-lg border p-3 transition-colors',
                              isDisabled ? 'bg-red-50/50 border-red-200/50' : 'hover:bg-muted/50'
                            )}
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <div className={cn(
                                'size-8 rounded-lg flex items-center justify-center shrink-0',
                                isDisabled ? 'bg-red-100 text-red-500' : 'bg-emerald-100 text-emerald-600'
                              )}>
                                <FeatureIcon className="size-3.5" />
                              </div>
                              <div className="min-w-0">
                                <p className={cn('text-sm font-medium', isDisabled && 'text-red-600 line-through')}>
                                  {feature.label}
                                </p>
                                <p className="text-[11px] text-muted-foreground truncate">{feature.description}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={cn(
                                'text-[10px] font-medium px-1.5 py-0.5 rounded',
                                isDisabled ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                              )}>
                                {isDisabled ? 'DISABLED' : 'ACTIVE'}
                              </span>
                              <Switch
                                checked={!isDisabled}
                                onCheckedChange={() => toggleFeature(feature.id)}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* User Roles Toggle */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <UserCog className="size-4" />
                    User Role Controls
                  </CardTitle>
                  <CardDescription>
                    <span className="text-xs">
                      Disabled roles: <Badge variant="destructive" className="ml-1 text-[10px]">{disabledRoles.length}</Badge>
                    </span>
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-4">
                Disabled user roles cannot be created or assigned in this school. Existing users with disabled roles will lose access.
              </p>
              <div className="space-y-1">
                {ALL_USER_ROLES.map(role => {
                  const isDisabled = disabledRoles.includes(role.id);
                  return (
                    <div
                      key={role.id}
                      className={cn(
                        'flex items-center justify-between gap-3 rounded-lg border p-3 transition-colors',
                        isDisabled ? 'bg-red-50/50 border-red-200/50' : 'hover:bg-muted/50'
                      )}
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <div className={cn(
                          'size-8 rounded-lg flex items-center justify-center shrink-0',
                          isDisabled ? 'bg-red-100 text-red-500' : 'bg-blue-100 text-blue-600'
                        )}>
                          <Users className="size-3.5" />
                        </div>
                        <div>
                          <p className={cn('text-sm font-medium', isDisabled && 'text-red-600 line-through')}>{role.label}</p>
                          <p className="text-[11px] text-muted-foreground">{role.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          'text-[10px] font-medium px-1.5 py-0.5 rounded',
                          isDisabled ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                        )}>
                          {isDisabled ? 'DISABLED' : 'ACTIVE'}
                        </span>
                        <Switch
                          checked={!isDisabled}
                          onCheckedChange={() => toggleRole(role.id)}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="min-w-32"
            >
              <Save className="size-4 mr-2" />
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
