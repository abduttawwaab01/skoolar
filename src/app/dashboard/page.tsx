'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { useAppStore, navigationByRole, type DashboardView, type UserRole, type NavItem } from '@/store/app-store';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { ConfirmProvider } from '@/components/confirm-dialog';

// Map of view IDs to their components
const viewComponents: Record<DashboardView, () => Promise<any>> = {
  'super-admin-dashboard': () => import('@/components/dashboards/super-admin-dashboard').then(m => m.SuperAdminDashboard),
  'school-admin-dashboard-view': () => import('@/components/dashboards/school-admin-dashboard').then(m => m.SchoolAdminDashboard),
  'teacher-dashboard-view': () => import('@/components/dashboards/teacher-dashboard').then(m => m.TeacherDashboard),
  'student-dashboard-view': () => import('@/components/dashboards/student-dashboard').then(m => m.StudentDashboard),
  'student-exams': () => import('@/components/dashboards/student-exams').then(m => m.StudentExams),
  'student-results': () => import('@/components/dashboards/student-results').then(m => m.StudentResults),
  'student-homework': () => import('@/components/dashboards/student-homework').then(m => m.StudentHomework),
  'student-analytics': () => import('@/components/dashboards/student-analytics').then(m => m.StudentAnalytics),
  'student-attendance': () => import('@/components/dashboards/student-attendance').then(m => m.StudentAttendance),
  'student-report-cards': () => import('@/components/dashboards/student-report-cards').then(m => m.StudentReportCards),
  'parent-attendance': () => import('@/components/dashboards/parent-attendance').then(m => m.ParentAttendance),
  'parent-download-reports': () => import('@/components/dashboards/parent-download-reports').then(m => m.default),
  'accountant-students': () => import('@/components/dashboards/accountant-students').then(m => m.default),
  'director-students': () => import('@/components/dashboards/director-students').then(m => m.default),
  'director-teachers': () => import('@/components/dashboards/director-teachers').then(m => m.default),
  'director-attendance': () => import('@/components/dashboards/director-attendance').then(m => m.default),
  'director-results': () => import('@/components/dashboards/director-results').then(m => m.default),
  'director-finance': () => import('@/components/dashboards/director-finance').then(m => m.default),
  'parent-dashboard-view': () => import('@/components/dashboards/parent-dashboard').then(m => m.ParentDashboard),
  'accountant-dashboard-view': () => import('@/components/dashboards/accountant-dashboard').then(m => m.AccountantDashboard),
  'librarian-dashboard-view': () => import('@/components/dashboards/librarian-dashboard').then(m => m.LibrarianDashboard),
  'overview': () => import('@/components/dashboards/overview-view').then(m => m.OverviewView),
  'schools': () => import('@/components/dashboards/schools-view').then(m => m.SchoolsView),
  'registration-codes': () => import('@/components/dashboards/registration-codes-view').then(m => m.RegistrationCodesView),
  'academic-structure': () => import('@/components/dashboards/classes-view').then(m => m.ClassesView),
  'students': () => import('@/components/dashboards/students-view').then(m => m.StudentsView),
  'teachers': () => import('@/components/dashboards/teachers-view').then(m => m.TeachersView),
  'parents': () => import('@/components/dashboards/parents-view').then(m => m.ParentsView),
  'classes': () => import('@/components/dashboards/classes-view').then(m => m.ClassesView),
  'subjects': () => import('@/components/dashboards/subjects-view').then(m => m.SubjectsView),
  'attendance': () => import('@/components/dashboards/attendance-view').then(m => m.AttendanceView),
  'staff-attendance': () => import('@/components/dashboards/staff-attendance-view').then(m => m.StaffAttendanceView),
  'staff-self-attendance': () => import('@/components/dashboards/staff-self-attendance').then(m => m.StaffSelfAttendance),
  'exams': () => import('@/components/dashboards/exams-view').then(m => m.ExamsView),
  'results': () => import('@/components/dashboards/results-view').then(m => m.ResultsView),
  'report-cards': () => import('@/components/dashboards/report-card-view').then(m => m.ReportCardView),
  'finance': () => import('@/components/dashboards/payments-view').then(m => m.PaymentsView),
  'payments': () => import('@/components/dashboards/payments-view').then(m => m.PaymentsView),
  'fee-structure': () => import('@/components/dashboards/fee-structure-view').then(m => m.FeeStructureView),
  'expenses': () => import('@/components/dashboards/expenses-view').then(m => m.ExpensesView),
  'library': () => import('@/components/dashboards/books-view').then(m => m.BooksView),
  'books': () => import('@/components/dashboards/books-view').then(m => m.BooksView),
  'borrow-records': () => import('@/components/dashboards/borrow-records-view').then(m => m.BorrowRecordsView),
  'id-cards': () => import('@/components/features/id-card-generator').then(m => m.IDCardGenerator),
  'id-scanner': () => import('@/components/dashboards/id-scanner-view').then(m => m.IdScannerView),
  'analytics': () => import('@/components/dashboards/analytics-view').then(m => m.AnalyticsView),
  'behavior': () => import('@/components/dashboards/behavior-view').then(m => m.BehaviorView),
  'achievements': () => import('@/components/dashboards/student-achievements').then(m => m.StudentAchievements),
  'announcements': () => import('@/components/dashboards/announcements-view').then(m => m.AnnouncementsView),
  'calendar': () => import('@/components/dashboards/calendar-view').then(m => m.CalendarView),
  'timetable': () => import('@/components/dashboards/timetable-view').then(m => m.TimetableView),
  'notifications': () => import('@/components/dashboards/notifications-view').then(m => m.NotificationsView),
  'audit-logs': () => import('@/components/dashboards/audit-logs-view').then(m => m.AuditLogsView),
  'system-health': () => import('@/components/dashboards/system-health-view').then(m => m.SystemHealthView),
  'settings': () => import('@/components/dashboards/settings-view').then(m => m.SettingsView),
  'feedback': () => import('@/components/dashboards/feedback-view').then(m => m.FeedbackView),
  'health-records': () => import('@/components/dashboards/health-records-view').then(m => m.HealthRecordsView),
  'transport': () => import('@/components/dashboards/transport-view').then(m => m.TransportView),
  'lesson-plans': () => import('@/components/dashboards/teacher-lesson-plans').then(m => m.TeacherLessonPlans),
  'scheme-of-work': () => import('@/components/dashboards/scheme-of-work-view').then(m => m.SchemeOfWorkView),
  'ai-assistant': () => import('@/components/dashboards/teacher-ai-assistant').then(m => m.TeacherAIAssistant),
  'school-profile': () => import('@/components/dashboards/school-profile-view').then(m => m.SchoolProfileView),
  'branding': () => import('@/components/dashboards/branding-view').then(m => m.BrandingView),
  'reports': () => import('@/components/dashboards/reports-view').then(m => m.ReportsView),
  'users-management': () => import('@/components/dashboards/users-management').then(m => m.UsersManagement),
  'payment-verification': () => import('@/components/dashboards/payment-verification-view').then(m => m.PaymentVerificationView),
  'ai-grading': () => import('@/components/features/ai-grading-assistant').then(m => m.default),
  'bulk-operations': () => import('@/components/features/bulk-operations').then(m => m.default),
  'advanced-search': () => import('@/components/features/advanced-search').then(m => m.default),
  'school-comparison': () => import('@/components/features/multi-school-comparison').then(m => m.default),
  'data-import': () => import('@/components/features/data-import-export').then(m => m.default),
  'in-app-chat': () => import('@/components/dashboards/messaging-center').then(m => m.MessagingCenter),
  'student-promotion': () => import('@/components/features/student-promotion').then(m => m.default),
  'school-calendar-enhanced': () => import('@/components/features/school-calendar').then(m => m.default),
  'parent-portal': () => import('@/components/features/parent-portal-enhanced').then(m => m.default),
  'admin-analytics-advanced': () => import('@/components/features/admin-analytics-advanced').then(m => m.default),
  'student-diary': () => import('@/components/features/student-diary').then(m => m.default),
  'student-ai-chat': () => import('@/components/features/ai-homework-helper').then(m => m.default),
  'homework': () => import('@/components/features/homework-management').then(m => m.default),
  'video-lessons': () => import('@/components/dashboards/video-lessons').then(m => m.VideoLessonsView),
  'student-lesson-notes': () => import('@/components/dashboards/student-lesson-plans').then(m => m.StudentLessonPlans),
  'student-video-lessons': () => import('@/components/dashboards/student-video-lessons').then(m => m.StudentVideoLessons),
  'parent-lesson-notes': () => import('@/components/dashboards/parent-lesson-notes').then(m => m.ParentLessonNotes),
  'parent-homework': () => import('@/components/features/homework-management').then(m => m.default),
  'parent-exams': () => import('@/components/dashboards/parent-exams').then(m => m.ParentExams),
  'parent-video-lessons': () => import('@/components/dashboards/parent-video-lessons').then(m => m.ParentVideoLessons),
  'teacher-homework': () => import('@/components/features/homework-management').then(m => m.default),

  'teacher-grades': () => import('@/components/dashboards/teacher-grades').then(m => m.TeacherGrades),
  'support': () => import('@/components/dashboards/support-view').then(m => m.SupportView),
  'subscription': () => import('@/components/dashboards/subscription-view').then(m => m.SubscriptionView),
  'school-settings': () => import('@/components/dashboards/school-settings-view').then(m => m.SchoolSettingsView),
  'platform-management': () => import('@/components/platform/platform-admin-panel').then(m => m.PlatformAdminPanel),
  'testimonials': () => import('@/components/dashboards/testimonials-manager').then(m => m.TestimonialsManager),
  'trusted-schools': () => import('@/components/dashboards/trusted-schools-manager').then(m => m.TrustedSchoolsManager),
  'school-controls': () => import('@/components/features/school-controls').then(m => m.SchoolControlsPanel),
  'overlay-management': () => import('@/components/features/overlay-management').then(m => m.OverlayManagement),
  'plans-manager': () => import('@/components/dashboards/plans-manager').then(m => m.PlansManager),
  'danger-zone': () => import('@/components/dashboards/danger-zone').then(m => m.DangerZone),
  'class-monitoring': () => import('@/components/dashboards/class-monitoring').then(m => m.ClassMonitoring),
  'messaging-center': () => import('@/components/dashboards/messaging-center').then(m => m.MessagingCenter),
  'weekly-evaluations': () => import('@/components/features/weekly-evaluation').then(m => m.WeeklyEvaluation),
  'entrance-exams': () => import('@/components/dashboards/entrance-exams-view').then(m => m.EntranceExamsView),
  'teacher-tasks': () => import('@/components/features/teacher-tasks-management').then(m => m.TeacherTasksManagement),
  'teacher-my-tasks': () => import('@/components/dashboards/teacher-tasks-view').then(m => m.TeacherTasksView),
  'teacher-performance': () => import('@/components/features/teacher-tasks-management').then(m => m.TeacherTasksManagement),
  'student-leaderboard': () => import('@/components/features/student-leaderboard').then(m => m.StudentLeaderboard),
  'parent-analytics': () => import('@/components/features/parent-analytics').then(m => m.ParentAnalytics),
  'profile': () => import('@/components/profile/profile-view').then(m => m.ProfileView),
  'lesson-progress-reports': () => import('@/components/dashboards/lesson-progress-reports').then(m => m.LessonProgressReports),
  'year-results': () => import('@/components/dashboards/year-results-view').then(m => m.YearResultsView),
  'parent-results-view': () => import('@/components/dashboards/parent-results').then(m => m.ParentResults),
  'parent-report-cards-view': () => import('@/components/dashboards/parent-report-cards').then(m => m.ParentReportCards),
  'parent-finance': () => import('@/components/dashboards/parent-finance').then(m => m.ParentFinance),
  'job-postings': () => import('@/components/dashboards/job-postings-view').then(m => m.JobPostingsManagement),
  'live-classes': () => import('@/components/dashboards/live-classes-view').then(m => m.LiveClassesView),

  // Assessment Hub views
  'assessment-hub': () => import('@/components/dashboards/assessment-hub-view').then(m => m.AssessmentHubView),
  'assessment-student-list': () => import('@/components/dashboards/assessment-student-list-view').then(m => m.AssessmentStudentListView),
  'assessment-student-create': () => import('@/components/dashboards/assessment-student-create-view').then(m => m.AssessmentStudentCreateView),
  'assessment-student-take': () => import('@/components/dashboards/assessment-student-take-view').then(m => m.AssessmentStudentTakeView),
  'assessment-student-results': () => import('@/components/dashboards/assessment-student-results-view').then(m => m.AssessmentStudentResultsView),
  'assessment-student-profile': () => import('@/components/dashboards/assessment-student-profile-view').then(m => m.AssessmentStudentProfileView),
  'assessment-student-growth': () => import('@/components/dashboards/assessment-student-growth-view').then(m => m.AssessmentStudentGrowthView),
  'assessment-teacher-list': () => import('@/components/dashboards/assessment-teacher-list-view').then(m => m.AssessmentTeacherListView),
  'assessment-teacher-create': () => import('@/components/dashboards/assessment-teacher-create-view').then(m => m.AssessmentTeacherCreateView),
  'assessment-teacher-take': () => import('@/components/dashboards/assessment-teacher-take-view').then(m => m.AssessmentTeacherTakeView),
  'assessment-teacher-results': () => import('@/components/dashboards/assessment-teacher-results-view').then(m => m.AssessmentTeacherResultsView),
  'assessment-teacher-competency': () => import('@/components/dashboards/assessment-teacher-competency-view').then(m => m.AssessmentTeacherCompetencyView),
  'assessment-360-feedback': () => import('@/components/dashboards/assessment-360-feedback-view').then(m => m.Assessment360FeedbackView),
  'assessment-observations': () => import('@/components/dashboards/assessment-observations-view').then(m => m.AssessmentObservationsView),
  'assessment-templates': () => import('@/components/dashboards/assessment-templates-view').then(m => m.AssessmentTemplatesView),
  'assessment-analytics-view': () => import('@/components/dashboards/assessment-analytics-view').then(m => m.AssessmentAnalyticsView),
};

const roleDefaultView: Record<UserRole, DashboardView> = {
  SUPER_ADMIN: 'super-admin-dashboard',
  SCHOOL_ADMIN: 'school-admin-dashboard-view',
  TEACHER: 'teacher-dashboard-view',
  STUDENT: 'student-dashboard-view',
  PARENT: 'parent-dashboard-view',
  ACCOUNTANT: 'accountant-dashboard-view',
  LIBRARIAN: 'librarian-dashboard-view',
  DIRECTOR: 'overview',
};

function getAllValidViews(role: UserRole): DashboardView[] {
  const items = navigationByRole[role];
  if (!items) return [];
  const views: DashboardView[] = [];
  const walk = (navItems: NavItem[]) => {
    for (const item of navItems) {
      views.push(item.id);
      if (item.children) walk(item.children);
    }
  };
  walk(items);
  return views;
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { currentView, setCurrentView, setCurrentRole, setCurrentUser, currentUser, selectedSchoolId, setSelectedSchoolId } = useAppStore();
  const [ViewComponent, setViewComponent] = useState<React.ComponentType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const prefetchViewData = useCallback(async (view: DashboardView) => {
    const contextSchoolId = useAppStore.getState().selectedSchoolId || currentUser.schoolId;

    const prefetchFunctions: Partial<Record<DashboardView, () => Promise<unknown>>> = {
      'students': () => queryClient.prefetchQuery({
        queryKey: ['students', { limit: 50 }, contextSchoolId],
        queryFn: () => fetch(`/api/students?limit=50${contextSchoolId ? `&schoolId=${contextSchoolId}` : ''}`).then(r => r.json()),
      }),
      'teachers': () => queryClient.prefetchQuery({
        queryKey: ['teachers', { limit: 50 }, contextSchoolId],
        queryFn: () => fetch(`/api/teachers?limit=50${contextSchoolId ? `&schoolId=${contextSchoolId}` : ''}`).then(r => r.json()),
      }),
      'classes': () => queryClient.prefetchQuery({
        queryKey: ['classes', contextSchoolId],
        queryFn: () => fetch(`/api/classes${contextSchoolId ? `?schoolId=${contextSchoolId}` : ''}`).then(r => r.json()),
      }),
      'attendance': () => queryClient.prefetchQuery({
        queryKey: ['attendance', { limit: 100 }, contextSchoolId],
        queryFn: () => fetch(`/api/attendance?limit=100${contextSchoolId ? `&schoolId=${contextSchoolId}` : ''}`).then(r => r.json()),
      }),
      'exams': () => queryClient.prefetchQuery({
        queryKey: ['exams', contextSchoolId],
        queryFn: () => fetch(`/api/exams${contextSchoolId ? `?schoolId=${contextSchoolId}` : ''}`).then(r => r.json()),
      }),
      'results': () => queryClient.prefetchQuery({
        queryKey: ['results', contextSchoolId],
        queryFn: () => fetch(`/api/results${contextSchoolId ? `?schoolId=${contextSchoolId}` : ''}`).then(r => r.json()),
      }),
      'finance': () => queryClient.prefetchQuery({
        queryKey: ['payments', contextSchoolId],
        queryFn: () => fetch(`/api/payments${contextSchoolId ? `?schoolId=${contextSchoolId}` : ''}`).then(r => r.json()),
      }),
      'payments': () => queryClient.prefetchQuery({
        queryKey: ['payments', contextSchoolId],
        queryFn: () => fetch(`/api/payments${contextSchoolId ? `?schoolId=${contextSchoolId}` : ''}`).then(r => r.json()),
      }),
      'expenses': () => queryClient.prefetchQuery({
        queryKey: ['expenses', contextSchoolId],
        queryFn: () => fetch(`/api/expenses${contextSchoolId ? `?schoolId=${contextSchoolId}` : ''}`).then(r => r.json()),
      }),
      'analytics': () => {
        return queryClient.prefetchQuery({
          queryKey: ['analytics', contextSchoolId],
          queryFn: () => fetch(`/api/analytics${contextSchoolId ? `?schoolId=${contextSchoolId}` : ''}`).then(r => r.json()),
        });
      },
      'announcements': () => queryClient.prefetchQuery({
        queryKey: ['announcements', contextSchoolId],
        queryFn: () => fetch(`/api/announcements?schoolId=${contextSchoolId}`).then(r => r.json()),
      }),
      'subjects': () => queryClient.prefetchQuery({
        queryKey: ['subjects', contextSchoolId],
        queryFn: () => fetch(`/api/subjects?schoolId=${contextSchoolId}`).then(r => r.json()),
      }),
      'homework': () => queryClient.prefetchQuery({
        queryKey: ['homework', contextSchoolId],
        queryFn: () => fetch(`/api/homework?schoolId=${contextSchoolId}`).then(r => r.json()),
      }),
    };

    const func = prefetchFunctions[view];
    if (func) await func();
  }, [currentUser.schoolId, queryClient]);

  const loadView = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Guard: reset stale persisted views (e.g. 'report-card-view' removed from navigation)
      const role = useAppStore.getState().currentRole;
      if (role) {
        const validViews = getAllValidViews(role);
        if (!validViews.includes(currentView)) {
          setCurrentView(roleDefaultView[role]);
          return;
        }
      }

      // Check if view exists
      const importFn = viewComponents[currentView];
      if (!importFn) {
        throw new Error(`View "${currentView}" not found.`);
      }

      // Load component and prefetch data in parallel
      const [LoadedComponent] = await Promise.all([
        importFn(),
        prefetchViewData(currentView)
      ]);

      setViewComponent(() => LoadedComponent);
    } catch (err) {
      console.error('Error loading view:', err);
      setError(err instanceof Error ? err.message : 'Failed to load component');
      toast.error('Navigation error');
    } finally {
      setLoading(false);
    }
  }, [currentView, prefetchViewData]);

  useEffect(() => {
    if (status === 'loading') return;

    if (status === 'unauthenticated') {
      router.push('/login');
      return;
    }

    if (session?.user) {
      setCurrentRole(session.user.role as UserRole);
      setCurrentUser({
        id: session.user.id,
        name: session.user.name || '',
        email: session.user.email || '',
        avatar: session.user.avatar || null,
        schoolId: session.user.schoolId || '',
        schoolName: session.user.schoolName || 'Skoolar Platform',
        planName: session.user.planName || 'free',
      });

      // Reset view to default if current view is not valid for the role
      const validViews = getAllValidViews(session.user.role as UserRole);
      if (!validViews.includes(currentView)) {
        setCurrentView(roleDefaultView[session.user.role as UserRole]);
      }

      // Auto-initialize selectedSchoolId for non-super-admin users
      if (session.user.role !== 'SUPER_ADMIN' && !selectedSchoolId && session.user.schoolId) {
        setSelectedSchoolId(session.user.schoolId);
      }
    }
  }, [session, status, router, setCurrentRole, setCurrentUser, currentView, setCurrentView, selectedSchoolId, setSelectedSchoolId]);

  useEffect(() => {
    if (status === 'authenticated') {
      loadView();
    }
  }, [currentView, status, loadView]);

  if (status === 'loading' || (loading && !ViewComponent)) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="space-y-4 w-full max-w-md">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-32 w-full" />
            <div className="grid grid-cols-3 gap-4">
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell>
        <Alert variant="destructive" className="max-w-2xl mx-auto mt-10">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error Loading View</AlertTitle>
          <AlertDescription className="mt-2">
            {error}
            <div className="mt-4">
              <Button variant="outline" onClick={() => setCurrentView(roleDefaultView[session?.user?.role as UserRole])}>
                Return to Dashboard
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      </AppShell>
    );
  }

  return (
    <ConfirmProvider>
      <AppShell>
        {ViewComponent ? <ViewComponent /> : <div className="p-8 text-center text-muted-foreground">Initializing view...</div>}
      </AppShell>
    </ConfirmProvider>
  );
}
