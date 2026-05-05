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
// Map of view IDs to their components - Using a loader function type to avoid TS component mismatch
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const viewComponents: Record<DashboardView, () => Promise<any>> = {
  'super-admin-dashboard': () => import('@/components/dashboards/super-admin-dashboard').then(m => m.SuperAdminDashboard),
  overview: () => import('@/components/dashboards/overview-view').then(m => m.OverviewView),
  schools: () => import('@/components/dashboards/schools-view').then(m => m.SchoolsView),
  'registration-codes': () => import('@/components/dashboards/registration-codes-view').then(m => m.RegistrationCodesView),
  'academic-structure': () => import('@/components/dashboards/classes-view').then(m => m.ClassesView),
  students: () => import('@/components/dashboards/students-view').then(m => m.StudentsView),
  teachers: () => import('@/components/dashboards/teachers-view').then(m => m.TeachersView),
  parents: () => import('@/components/dashboards/parents-view').then(m => m.ParentsView),
  classes: () => import('@/components/dashboards/classes-view').then(m => m.ClassesView),
  subjects: () => import('@/components/dashboards/subjects-view').then(m => m.SubjectsView),
  attendance: () => import('@/components/dashboards/attendance-view').then(m => m.AttendanceView),
  'staff-attendance': () => import('@/components/dashboards/staff-attendance-view').then(m => m.StaffAttendanceView),
  exams: () => import('@/components/dashboards/exams-view').then(m => m.ExamsView),
  results: () => import('@/components/dashboards/results-view').then(m => m.ResultsView),
  'report-cards': () => import('@/components/dashboards/report-card-view').then(m => m.ReportCardView),
  finance: () => import('@/components/dashboards/payments-view').then(m => m.PaymentsView),
  payments: () => import('@/components/dashboards/payments-view').then(m => m.PaymentsView),
  'fee-structure': () => import('@/components/dashboards/fee-structure-view').then(m => m.FeeStructureView),
  library: () => import('@/components/dashboards/books-view').then(m => m.BooksView),
  books: () => import('@/components/dashboards/books-view').then(m => m.BooksView),
  'borrow-records': () => import('@/components/dashboards/borrow-records-view').then(m => m.BorrowRecordsView),
  'id-cards': () => import('@/components/features/id-card-generator').then(m => m.IDCardGenerator),
  'id-scanner': () => import('@/components/dashboards/id-scanner-view').then(m => m.IdScannerView),
  analytics: () => import('@/components/dashboards/analytics-view').then(m => m.AnalyticsView),
  behavior: () => import('@/components/dashboards/behavior-view').then(m => m.BehaviorView),
  achievements: () => import('@/components/dashboards/student-achievements').then(m => m.StudentAchievements),
  announcements: () => import('@/components/dashboards/announcements-view').then(m => m.AnnouncementsView),
  calendar: () => import('@/components/dashboards/calendar-view').then(m => m.CalendarView),
  notifications: () => import('@/components/dashboards/notifications-view').then(m => m.NotificationsView),
  'audit-logs': () => import('@/components/dashboards/audit-logs-view').then(m => m.AuditLogsView),
  'system-health': () => import('@/components/dashboards/system-health-view').then(m => m.SystemHealthView),
  settings: () => import('@/components/dashboards/settings-view').then(m => m.SettingsView),
  feedback: () => import('@/components/dashboards/feedback-view').then(m => m.FeedbackView),
  'health-records': () => import('@/components/dashboards/health-records-view').then(m => m.HealthRecordsView),
  transport: () => import('@/components/dashboards/transport-view').then(m => m.TransportView),
  communication: () => import('@/components/dashboards/communication-view').then(m => m.CommunicationView),
  'lesson-plans': () => import('@/components/dashboards/teacher-lesson-plans').then(m => m.TeacherLessonPlans),
  'ai-assistant': () => import('@/components/dashboards/teacher-ai-assistant').then(m => m.TeacherAIAssistant),
  'school-profile': () => import('@/components/dashboards/school-profile-view').then(m => m.SchoolProfileView),
  branding: () => import('@/components/dashboards/branding-view').then(m => m.BrandingView),
  reports: () => import('@/components/dashboards/reports-view').then(m => m.ReportsView),
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
  'notice-board': () => import('@/components/features/notice-board').then(m => m.default),
  'student-diary': () => import('@/components/features/student-diary').then(m => m.default),
  'student-ai-chat': () => import('@/components/features/ai-homework-helper').then(m => m.default),
  homework: () => import('@/components/features/homework-management').then(m => m.default),
  'video-lessons': () => import('@/components/dashboards/video-lessons').then(m => m.VideoLessonsView),
  'student-video-lessons': () => import('@/components/features/video-lessons').then(m => m.default),
  'parent-homework': () => import('@/components/features/homework-management').then(m => m.default),
  'parent-video-lessons': () => import('@/components/features/video-lessons').then(m => m.default),
  'teacher-homework': () => import('@/components/features/homework-management').then(m => m.default),
  'report-card-view': () => import('@/components/dashboards/report-card-view').then(m => m.ReportCardView),
  'teacher-grades': () => import('@/components/dashboards/teacher-grades').then(m => m.TeacherGrades),
  support: () => import('@/components/dashboards/support-view').then(m => m.SupportView),
  subscription: () => import('@/components/dashboards/subscription-view').then(m => m.SubscriptionView),
  'school-settings': () => import('@/components/dashboards/school-settings-view').then(m => m.SchoolSettingsView),
  'platform-management': () => import('@/components/platform/platform-admin-panel').then(m => m.PlatformAdminPanel),
  'school-controls': () => import('@/components/features/school-controls').then(m => m.SchoolControlsPanel),
  'overlay-management': () => import('@/components/features/overlay-management').then(m => m.OverlayManagement),
  'plans-manager': () => import('@/components/dashboards/plans-manager').then(m => m.PlansManager),
  'danger-zone': () => import('@/components/dashboards/danger-zone').then(m => m.DangerZone),
  'class-monitoring': () => import('@/components/dashboards/class-monitoring').then(m => m.ClassMonitoring),
  'messaging-center': () => import('@/components/features/in-app-chat').then(m => m.default),
  'weekly-evaluations': () => import('@/components/features/weekly-evaluation').then(m => m.WeeklyEvaluation),
  'entrance-exams': () => import('@/components/dashboards/entrance-exams-view').then(m => m.EntranceExamsView),
  'staff-self-attendance': () => import('@/components/dashboards/staff-self-attendance').then(m => m.StaffSelfAttendance),
};

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { currentView, setCurrentView, currentRole, setCurrentRole, setCurrentUser, currentUser } = useAppStore();
  const [ViewComponent, setViewComponent] = useState<React.ComponentType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const prefetchViewData = useCallback(async (view: DashboardView) => {
    if (!currentUser.schoolId) return;
    
    const prefetchFunctions: Partial<Record<DashboardView, () => Promise<unknown>>> = {
      'students': () => queryClient.prefetchQuery({
        queryKey: ['students', { limit: 50 }, currentUser.schoolId],
        queryFn: () => fetch(`/api/students?limit=50`).then(r => r.json()),
      }),
      'teachers': () => queryClient.prefetchQuery({
        queryKey: ['teachers', { limit: 50 }, currentUser.schoolId],
        queryFn: () => fetch(`/api/teachers?limit=50`).then(r => r.json()),
      }),
      'classes': () => queryClient.prefetchQuery({
        queryKey: ['classes', currentUser.schoolId],
        queryFn: () => fetch(`/api/classes?schoolId=${currentUser.schoolId}`).then(r => r.json()),
      }),
      'attendance': () => queryClient.prefetchQuery({
        queryKey: ['attendance', { limit: 100 }, currentUser.schoolId],
        queryFn: () => fetch(`/api/attendance?limit=100`).then(r => r.json()),
      }),
      'exams': () => queryClient.prefetchQuery({
        queryKey: ['exams', currentUser.schoolId],
        queryFn: () => fetch(`/api/exams`).then(r => r.json()),
      }),
      'results': () => queryClient.prefetchQuery({
        queryKey: ['results', currentUser.schoolId],
        queryFn: () => fetch(`/api/results`).then(r => r.json()),
      }),
      'finance': () => queryClient.prefetchQuery({
        queryKey: ['payments', currentUser.schoolId],
        queryFn: () => fetch(`/api/payments`).then(r => r.json()),
      }),
      'payments': () => queryClient.prefetchQuery({
        queryKey: ['payments', currentUser.schoolId],
        queryFn: () => fetch(`/api/payments`).then(r => r.json()),
      }),
      'analytics': () => {
        if (!currentUser.schoolId) return Promise.resolve() as Promise<unknown>;
        return queryClient.prefetchQuery({
          queryKey: ['analytics', currentUser.schoolId],
          queryFn: () => fetch(`/api/analytics?schoolId=${currentUser.schoolId}`).then(r => r.json()),
        });
      },
      'announcements': () => queryClient.prefetchQuery({
        queryKey: ['announcements', currentUser.schoolId],
        queryFn: () => fetch(`/api/announcements?schoolId=${currentUser.schoolId}`).then(r => r.json()),
      }),
      'subjects': () => queryClient.prefetchQuery({
        queryKey: ['subjects', currentUser.schoolId],
        queryFn: () => fetch(`/api/subjects?schoolId=${currentUser.schoolId}`).then(r => r.json()),
      }),
      'homework': () => queryClient.prefetchQuery({
        queryKey: ['homework', currentUser.schoolId],
        queryFn: () => fetch(`/api/homework`).then(r => r.json()),
      }),
      'overview': () => {
        if (!currentUser.schoolId) return Promise.resolve() as Promise<unknown>;
        return queryClient.prefetchQuery({
          queryKey: ['analytics', currentUser.schoolId],
          queryFn: () => fetch(`/api/analytics?schoolId=${currentUser.schoolId}`).then(r => r.json()),
        });
      },
    };

    const prefetchFn = prefetchFunctions[view];
    if (prefetchFn) {
      prefetchFn().catch(console.error);
    }
  }, [queryClient, currentUser.schoolId]);

  const [prevView, setPrevView] = useState<DashboardView | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Load component when currentView changes (after initial setup)
  useEffect(() => {
    // Skip during initial load - wait for setupDashboard to complete
    if (isInitialLoad || !session || currentView === prevView) return;
    
     const loadComponent = async () => {
       setPrevView(currentView);
       setLoading(true);
       try {
         const loader = viewComponents[currentView];
         if (!loader) {
           throw new Error(`No component loader found for view: ${currentView}`);
         }
         const mod = await loader();
         const Component = (typeof mod === 'function') ? mod : (mod.default || Object.values(mod)[0]);
         if (!Component) {
           throw new Error(`Component not found in module for view: ${currentView}`);
         }
         setViewComponent(() => Component);
         setError(null);
         prefetchViewData(currentView);
       } catch (err) {
         console.error(`Failed to load view component "${currentView}":`, err);
         setError(`Failed to load ${currentView} view. ${err instanceof Error ? err.message : 'Please refresh the page.'}`);
       } finally {
         setLoading(false);
       }
     };
    
    loadComponent();
  }, [currentView, session, prefetchViewData, prevView, isInitialLoad]);

  // Initial setup on mount
  useEffect(() => {
    if (status === 'loading') return;
    
    if (!session) {
      router.push('/login');
      return;
    }

    // Set user info in store and load initial component
    const setupDashboard = async () => {
      if (!session.user) return;

      setCurrentUser({
        id: session.user.id || '',
        name: session.user.name || 'User',
        email: session.user.email || '',
        avatar: session.user.avatar || null,
        schoolId: session.user.schoolId || '',
        schoolName: session.user.schoolName || 'Skoolar Platform',
      });
      
      const userRole = (session.user.role as UserRole) || 'STUDENT';
      setCurrentRole(userRole);
      
      // For non-super admin, automatically set selected school to their school
      if (userRole !== 'SUPER_ADMIN' && session.user.schoolId) {
        useAppStore.getState().setSelectedSchoolId(session.user.schoolId);
      }
      
      // Determine correct view based on role
      let viewToLoad: DashboardView;
      if (userRole === 'SUPER_ADMIN') {
        viewToLoad = 'super-admin-dashboard';
      } else {
        viewToLoad = 'overview';
      }
      
      setCurrentView(viewToLoad);
      setIsInitialLoad(false);
      setPrevView(viewToLoad);
      
      // Load the initial component
       try {
         const loader = viewComponents[viewToLoad];
         if (!loader) {
           throw new Error(`No component loader found for view: ${viewToLoad}`);
         }
         const mod = await loader();
         const Component = (typeof mod === 'function') ? mod : (mod.default || Object.values(mod)[0]);
         if (!Component) {
           throw new Error(`Component not found in module for view: ${viewToLoad}`);
         }
         setViewComponent(() => Component);
         setError(null);
         prefetchViewData(viewToLoad);
       } catch (err) {
         console.error(`Failed to load initial view "${viewToLoad}":`, err);
         setError(`Failed to load dashboard. ${err instanceof Error ? err.message : 'Please refresh the page.'}`);
       } finally {
         setLoading(false);
       }
    };

    setupDashboard();
  }, [session, status, router, setCurrentUser, setCurrentRole, setCurrentView, prefetchViewData]);

  if (status === 'loading' || loading) {
    return (
      <AppShell>
        <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
          <div className="space-y-4 text-center">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-64 w-full max-w-4xl" />
          </div>
        </div>
      </AppShell>
    );
  }

  if (!session) {
    return null;
  }

  if (error) {
    return (
      <AppShell>
        <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
          <div className="text-center space-y-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <Button onClick={() => window.location.reload()}>Refresh Page</Button>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <ConfirmProvider>
        {ViewComponent ? <ViewComponent /> : (
          <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
            <Skeleton className="h-64 w-full max-w-4xl" />
          </div>
        )}
      </ConfirmProvider>
    </AppShell>
  );
}