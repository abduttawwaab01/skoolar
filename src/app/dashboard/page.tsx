'use client';

import React, { useEffect, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { useAppStore, navigationByRole, type DashboardView, type UserRole, type NavItem } from '@/store/app-store';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

// Map of view IDs to their components
// Map of view IDs to their components - Using a loader function type to avoid TS component mismatch
const viewComponents: Record<DashboardView, () => Promise<any>> = {
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
  'report-cards': () => import('@/components/dashboards/results-view').then(m => m.ResultsView),
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
  'ai-grading': () => import('@/components/features/ai-grading-assistant').then(m => m.default || m.AIGradingAssistant),
  'bulk-operations': () => import('@/components/features/bulk-operations').then(m => m.default || m.BulkOperations),
  'advanced-search': () => import('@/components/features/advanced-search').then(m => m.default || m.AdvancedSearch),
  'school-comparison': () => import('@/components/features/multi-school-comparison').then(m => m.default || m.MultiSchoolComparison),
  'data-import': () => import('@/components/features/data-import-export').then(m => m.default || m.DataImportExport),
  'in-app-chat': () => import('@/components/dashboards/messaging-center').then(m => m.MessagingCenter),
  'student-promotion': () => import('@/components/features/student-promotion').then(m => m.default || m.StudentPromotion),
  'school-calendar-enhanced': () => import('@/components/features/school-calendar').then(m => m.default || m.SchoolCalendar),
  'parent-portal': () => import('@/components/features/parent-portal-enhanced').then(m => m.default || m.ParentPortalEnhanced),
  'admin-analytics-advanced': () => import('@/components/features/admin-analytics-advanced').then(m => m.default || m.AdminAnalyticsAdvanced),
  'notice-board': () => import('@/components/features/notice-board').then(m => m.default || m.NoticeBoard),
  'student-diary': () => import('@/components/features/student-diary').then(m => m.default || m.StudentDiary),
  'student-ai-chat': () => import('@/components/features/ai-homework-helper').then(m => m.default || m.AIHomeworkHelper),
  homework: () => import('@/components/features/homework-management').then(m => m.default || m.HomeworkManagement),
  'video-lessons': () => import('@/components/dashboards/video-lessons').then(m => m.default || m.VideoLessons),
  'student-video-lessons': () => import('@/components/features/video-lessons').then(m => m.default || m.VideoLessons),
  'parent-homework': () => import('@/components/features/homework-management').then(m => m.default || m.HomeworkManagement),
  'teacher-homework': () => import('@/components/features/homework-management').then(m => m.default || m.HomeworkManagement),
  'report-card-view': () => import('@/components/dashboards/report-card-view').then(m => m.ReportCardView),
  'teacher-grades': () => import('@/components/dashboards/teacher-grades').then(m => m.TeacherGrades || m.default),
  support: () => import('@/components/dashboards/support-view').then(m => m.SupportView),
  subscription: () => import('@/components/dashboards/subscription-view').then(m => m.SubscriptionView),
  'school-settings': () => import('@/components/dashboards/school-settings-view').then(m => m.SchoolSettingsView),
  'platform-management': () => import('@/components/platform/platform-admin-panel').then(m => m.PlatformAdminPanel),
  'school-controls': () => import('@/components/features/school-controls').then(m => m.SchoolControlsPanel),
  'overlay-management': () => import('@/components/features/overlay-management').then(m => m.OverlayManagement),
  'plans-manager': () => import('@/components/dashboards/plans-manager').then(m => m.PlansManager),
  'danger-zone': () => import('@/components/dashboards/danger-zone').then(m => m.DangerZone),
  'class-monitoring': () => import('@/components/dashboards/class-monitoring').then(m => m.ClassMonitoring),
  'messaging-center': () => import('@/components/features/in-app-chat').then(m => m.default || m.InAppChat),
  'weekly-evaluations': () => import('@/components/features/weekly-evaluation').then(m => m.WeeklyEvaluation),
  'entrance-exams': () => import('@/components/dashboards/entrance-exams-view').then(m => m.EntranceExamsView),
};

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { currentView, setCurrentView, currentRole, setCurrentRole, setCurrentUser } = useAppStore();
  const [ViewComponent, setViewComponent] = useState<React.ComponentType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'loading') return;
    
    if (!session) {
      router.push('/login');
      return;
    }

    // Set user info in store
    if (session.user) {
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
      
      // For SUPER_ADMIN, set default view to platform-management if not set
      if (userRole === 'SUPER_ADMIN' && !currentView) {
        setCurrentView('platform-management');
      }
    }
  }, [session, status, router, setCurrentUser, setCurrentRole, currentView, setCurrentView]);

  // Separate effect to load component after role is set
  useEffect(() => {
    if (status === 'loading') return;
    if (!session) return;
    
    const loadComponent = async () => {
      try {
        const viewToLoad = currentView || 'overview';
        const loader = viewComponents[viewToLoad as DashboardView];
        
        if (loader) {
          const mod = await loader();
          const Component = (typeof mod === 'function') ? mod : (mod.default || Object.values(mod)[0]);
          setViewComponent(() => Component);
          setError(null);
        } else {
          // Fallback to overview
          const mod = await viewComponents.overview();
          const Component = mod.default || Object.values(mod)[0];
          setViewComponent(() => Component);
          setCurrentView('overview');
          setError(null);
        }
      } catch (err) {
        console.error('Failed to load view component:', err);
        setError('Failed to load dashboard. Please refresh the page.');
      } finally {
        setLoading(false);
      }
    };

    loadComponent();
  }, [currentView, session, status, setCurrentView]);

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
      {ViewComponent ? <ViewComponent /> : (
        <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
          <Skeleton className="h-64 w-full max-w-4xl" />
        </div>
      )}
    </AppShell>
  );
}