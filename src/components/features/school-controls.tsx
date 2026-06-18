'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Search, Building2, Users, GraduationCap, Shield, Save, Loader2, CheckCircle2,
  BookOpen, FileEdit, Video, Library, Bus, Heart, CalendarCheck, Megaphone,
  Calendar, MessageSquare, CreditCard, Award, BarChart3, Layers, Upload,
  SearchX, UserCheck, Bell, Pin, Target, ArrowUpDown, ClipboardList,
  ChevronRight, Settings, XCircle, AlertTriangle, Brain, Sparkles,
  Clock, UserPlus, ListChecks, Monitor, Fingerprint, ClipboardCheck,
  Briefcase, TrendingUp, Notebook, Download, Package, History,
} from 'lucide-react';
import { toast } from 'sonner';

// ─── Types ──────────────────────────────────────────────────────────────────

interface School {
  id: string;
  name: string;
  slug: string;
  plan: string;
  isActive: boolean;
  primaryColor: string;
  _count: { students: number; teachers: number; classes: number };
}

interface SchoolControls {
  schoolId: string;
  schoolName: string;
  disabledFeatures: string[];
  disabledUserRoles: string[];
}

const PLATFORM_FEATURES = [
  { id: 'exams', label: 'Examinations & Tests', icon: FileEdit, description: 'Create and manage exams, tests, and quizzes' },
  { id: 'homework', label: 'Homework', icon: BookOpen, description: 'Assign and track homework submissions' },
  { id: 'video_lessons', label: 'Video Lessons', icon: Video, description: 'Video, text, audio, and image lessons' },
  { id: 'live_classes', label: 'Live Classes', icon: Video, description: 'Real-time virtual classrooms with video, chat, whiteboard' },
  { id: 'library', label: 'Library', icon: Library, description: 'Book catalog and borrow records' },
  { id: 'transport', label: 'Transport', icon: Bus, description: 'School transport routes and stops' },
  { id: 'health_records', label: 'Health Records', icon: Heart, description: 'Student health and medical records' },
  { id: 'attendance', label: 'Attendance', icon: CalendarCheck, description: 'Daily attendance tracking' },
  { id: 'staff_attendance', label: 'Staff Attendance', icon: Fingerprint, description: 'Staff check-in/out attendance' },
  { id: 'announcements', label: 'Announcements', icon: Megaphone, description: 'School-wide announcements' },
  { id: 'calendar', label: 'Calendar & Events', icon: Calendar, description: 'School calendar and events' },
  { id: 'timetable', label: 'Timetable', icon: Clock, description: 'Class scheduling and timetables' },
  { id: 'scheme_of_work', label: 'Scheme of Work', icon: ListChecks, description: 'Curriculum planning and scheme of work' },
  { id: 'feedback', label: 'Feedback', icon: MessageSquare, description: 'Student and parent feedback system' },
  { id: 'chat', label: 'Messaging / Chat', icon: MessageSquare, description: 'In-app messaging system' },
  { id: 'report_cards', label: 'Report Cards', icon: Award, description: 'Generate and publish report cards' },

  { id: 'behavior', label: 'Behavior Tracking', icon: Target, description: 'Student behavior and discipline records' },
  { id: 'achievements', label: 'Achievements & Badges', icon: Award, description: 'Student badges and achievements' },
  { id: 'parent_portal', label: 'Parent Portal', icon: Users, description: 'Parent access to child data' },
  { id: 'notifications', label: 'Notifications', icon: Bell, description: 'Push and in-app notifications' },
  { id: 'support_tickets', label: 'Support Tickets', icon: Settings, description: 'Technical support requests' },
  { id: 'analytics', label: 'Analytics & Reports', icon: BarChart3, description: 'Performance analytics dashboards' },
  { id: 'bulk_operations', label: 'Bulk Operations', icon: Layers, description: 'Bulk import/export/updates' },
  { id: 'data_import_export', label: 'Data Import/Export', icon: Upload, description: 'Import and export data files' },
  { id: 'advanced_search', label: 'Advanced Search', icon: Search, description: 'Advanced search across all data' },
  { id: 'student_promotion', label: 'Student Promotion', icon: ArrowUpDown, description: 'Promote students to next class' },
  { id: 'grading', label: 'Grading System', icon: ClipboardList, description: 'Score entry and grade management' },
  { id: 'lesson_plans', label: 'Lesson Plans', icon: BookOpen, description: 'Teacher lesson planning tools' },
  { id: 'fee_management', label: 'Fee Management', icon: CreditCard, description: 'Fee structure and payments' },
  { id: 'weekly_evaluations', label: 'Weekly Evaluations', icon: ClipboardCheck, description: 'Weekly student evaluations by teachers' },
  { id: 'class_monitoring', label: 'Class Monitoring', icon: Monitor, description: 'Real-time class activity monitoring' },
  { id: 'entrance_exams', label: 'Entrance Exams', icon: FileEdit, description: 'School entrance exam management' },
  { id: 'job_postings', label: 'Careers & Jobs', icon: Briefcase, description: 'Job postings and career management' },
  { id: 'student_diary', label: 'Student Diary', icon: Notebook, description: 'Personal student diary/journal' },
  { id: 'ai_assistant', label: 'AI Teaching Assistant', icon: Brain, description: 'AI-powered teaching tools and assistant' },
  { id: 'ai_grading', label: 'AI Grading', icon: Sparkles, description: 'Automated AI grading of assignments' },
  { id: 'ai_timetable_generator', label: 'AI Timetable Generator', icon: Sparkles, description: 'AI-powered timetable creation' },
  { id: 'ai_scheme_of_work_generator', label: 'AI Scheme of Work', icon: Sparkles, description: 'AI-generated curriculum schemes' },
  { id: 'ai_lesson_note_generator', label: 'AI Lesson Note Generator', icon: Sparkles, description: 'AI-powered lesson plan creation' },
  { id: 'ai_homework_generator', label: 'AI Homework Generator', icon: Sparkles, description: 'AI-generated homework assignments' },
  { id: 'ai_report_card_writer', label: 'AI Report Card Writer', icon: Sparkles, description: 'AI-generated report card comments' },
  { id: 'ai_pd_planner', label: 'AI PD Planner', icon: Brain, description: 'AI-powered professional development plans' },
  { id: 'ai_admin_dashboard', label: 'AI Admin Intel', icon: Brain, description: 'AI analytics, forecasts, and insights for admins' },
  { id: 'teacher_tasks', label: 'Teacher Tasks', icon: ListChecks, description: 'Task management for teachers' },
  { id: 'teacher_performance', label: 'Teacher Performance', icon: TrendingUp, description: 'Teacher performance tracking' },
  { id: 'student_leaderboard', label: 'Leaderboard', icon: Award, description: 'Gamification and student leaderboards' },
  { id: 'lesson_progress', label: 'Lesson Progress Reports', icon: BarChart3, description: 'Track lesson and learning progress' },
  { id: 'testimonials', label: 'Testimonials', icon: MessageSquare, description: 'School testimonials management' },
  { id: 'trusted_schools', label: 'Trusted Schools', icon: Shield, description: 'Trusted school listing management' },
  { id: 'payment_verification', label: 'Payment Verification', icon: CheckCircle2, description: 'Payment approval workflow' },
  { id: 'student_lesson_notes', label: 'Lesson Notes', icon: BookOpen, description: 'Lesson notes for students' },
  { id: 'parent_downloads', label: 'Parent Downloads', icon: Download, description: 'Parent report download access' },
  { id: 'hostels', label: 'Hostel Management', icon: Building2, description: 'Hostel allocation and room management' },
  { id: 'inventory', label: 'Inventory Management', icon: Package, description: 'School asset and inventory tracking' },
  { id: 'alumni', label: 'Alumni Management', icon: GraduationCap, description: 'Alumni records and event management' },
  { id: 'clubs', label: 'Clubs & Societies', icon: Users, description: 'Student clubs and membership management' },
  { id: 'enrollment_history', label: 'Enrollment History', icon: History, description: 'Student enrollment change history' },
] as const;

const USER_ROLES = [
  { id: 'SCHOOL_ADMIN', label: 'School Admin', icon: Shield, description: 'School administrators' },
  { id: 'TEACHER', label: 'Teacher', icon: GraduationCap, description: 'Teaching staff' },
  { id: 'STUDENT', label: 'Student', icon: GraduationCap, description: 'Students' },
  { id: 'PARENT', label: 'Parent', icon: Users, description: 'Parents and guardians' },
  { id: 'ACCOUNTANT', label: 'Accountant', icon: CreditCard, description: 'Financial staff' },
  { id: 'LIBRARIAN', label: 'Librarian', icon: Library, description: 'Library staff' },
  { id: 'DIRECTOR', label: 'Director', icon: Shield, description: 'School directors' },
] as const;

// ─── Main Component ─────────────────────────────────────────────────────────

export function SchoolControlsPanel() {
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Detail dialog
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [controls, setControls] = useState<SchoolControls | null>(null);
  const [localDisabledFeatures, setLocalDisabledFeatures] = useState<Set<string>>(new Set());
  const [localDisabledRoles, setLocalDisabledRoles] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [loadingControls, setLoadingControls] = useState(false);

  // Fetch schools
  useEffect(() => {
    const fetchSchools = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/schools?limit=100');
        if (!res.ok) throw new Error('Failed');
        const json = await res.json();
        setSchools(json.data || []);
      } catch {
        toast.error('Failed to load schools');
      } finally {
        setLoading(false);
      }
    };
    fetchSchools();
  }, []);

  // Filtered schools
  const filteredSchools = schools.filter(s =>
    !searchQuery || s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Open school controls dialog
  const openSchoolControls = async (school: School) => {
    setSelectedSchool(school);
    setDialogOpen(true);
    setLoadingControls(true);
    setLocalDisabledFeatures(new Set());
    setLocalDisabledRoles(new Set());

    try {
      const res = await fetch(`/api/schools/${school.id}/controls`);
      if (res.ok) {
        const json = await res.json();
        const data = json.data as SchoolControls;
        setControls(data);
        setLocalDisabledFeatures(new Set(data.disabledFeatures || []));
        setLocalDisabledRoles(new Set(data.disabledUserRoles || []));
      } else {
        setControls({ schoolId: school.id, schoolName: school.name, disabledFeatures: [], disabledUserRoles: [] });
      }
    } catch {
      setControls({ schoolId: school.id, schoolName: school.name, disabledFeatures: [], disabledUserRoles: [] });
    } finally {
      setLoadingControls(false);
    }
  };

  // Toggle feature
  const toggleFeature = (featureId: string) => {
    setLocalDisabledFeatures(prev => {
      const next = new Set(prev);
      if (next.has(featureId)) {
        next.delete(featureId);
      } else {
        next.add(featureId);
      }
      return next;
    });
  };

  // Toggle role
  const toggleRole = (roleId: string) => {
    setLocalDisabledRoles(prev => {
      const next = new Set(prev);
      if (next.has(roleId)) {
        next.delete(roleId);
      } else {
        next.add(roleId);
      }
      return next;
    });
  };

  // Save controls
  const handleSave = async () => {
    if (!selectedSchool) return;
    try {
      setSaving(true);
      const res = await fetch(`/api/schools/${selectedSchool.id}/controls`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          disabledFeatures: Array.from(localDisabledFeatures),
          disabledUserRoles: Array.from(localDisabledRoles),
        }),
      });
      if (!res.ok) throw new Error('Failed to save');
      toast.success(`Controls updated for ${selectedSchool.name}`);
      setDialogOpen(false);
    } catch {
      toast.error('Failed to save controls');
    } finally {
      setSaving(false);
    }
  };

  const planBadge = (plan: string) => {
    const colors: Record<string, string> = {
      enterprise: 'bg-emerald-100 text-emerald-700',
      pro: 'bg-blue-100 text-blue-700',
      basic: 'bg-gray-100 text-gray-600',
    };
    return <Badge variant="outline" className={colors[plan] || colors.basic}>{plan}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">School Feature Controls</h1>
        <p className="text-muted-foreground">Enable or disable features and user roles per school</p>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search schools..."
            className="pl-9"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <Badge variant="outline">{filteredSchools.length} schools</Badge>
      </div>

      {/* Schools Grid */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : filteredSchools.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-8 flex flex-col items-center justify-center text-center gap-3">
            <SearchX className="size-12 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No schools found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredSchools.map(school => {
            const featureCount = controls?.schoolId === school.id
              ? controls.disabledFeatures.length
              : 0;
            const roleCount = controls?.schoolId === school.id
              ? controls.disabledUserRoles.length
              : 0;

            return (
              <Card
                key={school.id}
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => openSchoolControls(school)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div
                      className="size-10 rounded-lg flex items-center justify-center text-white font-bold text-xs shrink-0"
                      style={{ backgroundColor: school.primaryColor || '#059669' }}
                    >
                      {school.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{school.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {planBadge(school.plan)}
                        <span className="text-xs text-muted-foreground">
                          {(school._count?.students || 0)} students
                        </span>
                      </div>
                      {featureCount > 0 && (
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-200 bg-amber-50">
                            {featureCount} features disabled
                          </Badge>
                          {roleCount > 0 && (
                            <Badge variant="outline" className="text-[10px] text-red-600 border-red-200 bg-red-50">
                              {roleCount} roles disabled
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                    <ChevronRight className="size-4 text-muted-foreground shrink-0 mt-1" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Controls Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[95vh] sm:max-h-[90vh] flex flex-col p-0 overflow-hidden gap-0">
          <DialogHeader className="p-6 border-b shrink-0 bg-background/95 backdrop-blur-xs">
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <Building2 className="size-5 text-emerald-600 animate-pulse" />
              {selectedSchool?.name} — Feature Controls
            </DialogTitle>
            <DialogDescription className="mt-1 text-xs">
              Enable or disable platform features and user roles for this school.
              Disabled features will be hidden from the school&apos;s dashboard.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {loadingControls ? (
              <div className="space-y-4 py-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-5 w-10" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-6">
                {/* Features Section */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <Settings className="size-4 text-emerald-600" />
                      Platform Features
                      {localDisabledFeatures.size > 0 && (
                        <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-200 bg-amber-50">
                          {localDisabledFeatures.size} disabled
                        </Badge>
                      )}
                    </h3>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs h-7 hover:bg-muted"
                        onClick={() => setLocalDisabledFeatures(new Set(PLATFORM_FEATURES.map(f => f.id)))}
                      >
                        Disable All
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs h-7 hover:bg-muted"
                        onClick={() => setLocalDisabledFeatures(new Set())}
                      >
                        Enable All
                      </Button>
                    </div>
                  </div>
                  <div className="border border-muted/80 rounded-lg shadow-2xs overflow-hidden">
                    <div className="divide-y divide-muted/50 max-h-[350px] overflow-y-auto">
                      {PLATFORM_FEATURES.map(feature => {
                        const isDisabled = localDisabledFeatures.has(feature.id);
                        const Icon = feature.icon;
                        return (
                          <div
                            key={feature.id}
                            className={`flex items-center justify-between p-3 hover:bg-muted/30 transition-colors ${isDisabled ? 'opacity-50 bg-muted/10' : ''}`}
                          >
                            <div className="flex items-center gap-3 min-w-0 mr-4">
                              <div className={`size-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${isDisabled ? 'bg-muted text-muted-foreground' : 'bg-emerald-100/80 text-emerald-600'}`}>
                                <Icon className="size-4" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-foreground/90 leading-none mb-1">{feature.label}</p>
                                <p className="text-[11px] text-muted-foreground line-clamp-1">{feature.description}</p>
                              </div>
                            </div>
                            <Switch
                              checked={!isDisabled}
                              onCheckedChange={() => toggleFeature(feature.id)}
                              className="data-[state=checked]:bg-emerald-600 shrink-0"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <Separator className="bg-muted/60" />

                {/* User Roles Section */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <UserCheck className="size-4 text-blue-600" />
                      User Roles
                      {localDisabledRoles.size > 0 && (
                        <Badge variant="outline" className="text-[10px] text-red-600 border-red-200 bg-red-50">
                          {localDisabledRoles.size} disabled
                        </Badge>
                      )}
                    </h3>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs h-7 hover:bg-muted"
                        onClick={() => setLocalDisabledRoles(new Set(USER_ROLES.map(r => r.id)))}
                      >
                        Disable All
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs h-7 hover:bg-muted"
                        onClick={() => setLocalDisabledRoles(new Set())}
                      >
                        Enable All
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {USER_ROLES.map(role => {
                      const isDisabled = localDisabledRoles.has(role.id);
                      const Icon = role.icon;
                      return (
                        <Card key={role.id} className={`border border-muted/80 shadow-2xs transition-all hover:shadow-2xs ${isDisabled ? 'opacity-50 bg-muted/10' : ''}`}>
                          <CardContent className="p-3.5 flex items-center justify-between">
                            <div className="flex items-center gap-3 mr-4 min-w-0">
                              <div className={`size-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${isDisabled ? 'bg-muted text-muted-foreground' : 'bg-blue-100/80 text-blue-600'}`}>
                                <Icon className="size-4" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-foreground/90 leading-none mb-1">{role.label}</p>
                                <p className="text-[11px] text-muted-foreground line-clamp-1">{role.description}</p>
                              </div>
                            </div>
                            <Switch
                              checked={!isDisabled}
                              onCheckedChange={() => toggleRole(role.id)}
                              className="data-[state=checked]:bg-blue-600 shrink-0"
                            />
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>

                {localDisabledFeatures.size > 0 && localDisabledRoles.size > 0 && (
                  <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/70 p-4 shadow-2xs">
                    <AlertTriangle className="size-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-amber-800">Warning</p>
                      <p className="text-[11px] text-amber-700 leading-relaxed mt-1">
                        You have disabled {localDisabledFeatures.size} features and {localDisabledRoles.size} user roles.
                        Disabled features will be hidden from the school&apos;s navigation and UI.
                        Users with disabled roles will not be able to log in.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="p-4 border-t bg-muted/30 shrink-0 flex justify-end gap-3 sticky bottom-0 z-10 flex-row">
            <Button variant="outline" className="rounded-xl px-5" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-6">
              {saving ? <><Loader2 className="size-4 mr-2 animate-spin" /> Saving...</> : <><Save className="size-4 mr-2" /> Save Controls</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
