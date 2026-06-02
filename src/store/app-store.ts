import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type UserRole = 'SUPER_ADMIN' | 'SCHOOL_ADMIN' | 'TEACHER' | 'STUDENT' | 'PARENT' | 'ACCOUNTANT' | 'LIBRARIAN' | 'DIRECTOR';

export type DashboardView = 
  | 'overview' | 'super-admin-dashboard' | 'schools' | 'registration-codes' | 'academic-structure' 
  | 'students' | 'teachers' | 'parents' | 'classes' | 'subjects'
  | 'attendance' | 'staff-attendance' | 'staff-self-attendance' | 'exams' | 'results' | 'report-cards'
  | 'finance' | 'payments' | 'fee-structure' | 'expenses'
  | 'library' | 'books' | 'borrow-records'
  | 'id-cards' | 'id-scanner'
  | 'analytics' | 'behavior' | 'achievements'
  | 'announcements' | 'calendar' | 'notifications'
  | 'audit-logs' | 'system-health' | 'settings'
  | 'feedback' | 'health-records' | 'transport'
  | 'communication' | 'lesson-plans' | 'ai-assistant'
  | 'school-profile' | 'branding' | 'reports' | 'users-management'
  | 'ai-grading' | 'bulk-operations' | 'advanced-search'
  | 'school-comparison' | 'data-import' | 'in-app-chat'
  | 'student-promotion' | 'school-calendar-enhanced'
  | 'parent-portal' | 'admin-analytics-advanced'
  | 'notice-board' | 'student-diary' | 'student-ai-chat'
  | 'homework' | 'video-lessons' | 'student-video-lessons'
  | 'parent-homework' | 'parent-exams' | 'parent-video-lessons' | 'teacher-homework'
  | 'student-exams' | 'student-results' | 'student-homework' | 'student-analytics'
  | 'report-card-view' | 'support' | 'subscription' | 'school-settings'
  | 'platform-management' | 'school-controls' | 'overlay-management' | 'plans-manager' | 'danger-zone'
  | 'class-monitoring' | 'messaging-center' | 'weekly-evaluations'
  | 'entrance-exams' | 'payment-verification' | 'job-postings'
  | 'teacher-grades' | 'timetable'
  | 'scheme-of-work'
  | 'teacher-tasks' | 'teacher-my-tasks' | 'teacher-performance' | 'student-leaderboard'
  | 'parent-analytics'
  | 'year-results' | 'lesson-progress-reports'
  | 'testimonials' | 'trusted-schools'
  | 'profile'
  | 'parent-results-view'
  | 'parent-report-cards-view'
  | 'parent-finance'
  | 'school-admin-dashboard-view' | 'teacher-dashboard-view' | 'student-dashboard-view'
  | 'parent-dashboard-view' | 'accountant-dashboard-view' | 'librarian-dashboard-view'
  | 'student-attendance' | 'student-report-cards' | 'parent-attendance'
  | 'parent-download-reports' | 'accountant-students'
  | 'director-students' | 'director-teachers' | 'director-attendance' | 'director-results' | 'director-finance'
  | 'student-lesson-notes' | 'parent-lesson-notes';

interface AppState {
  currentRole: UserRole;
  setCurrentRole: (role: UserRole) => void;
  currentUser: {
    id: string;
    name: string;
    email: string;
    avatar: string | null;
    schoolId: string;
    schoolName: string;
    planName: string;
  };
  setCurrentUser: (user: AppState['currentUser']) => void;
  currentView: DashboardView;
  setCurrentView: (view: DashboardView) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  toggleTheme: () => void;
  selectedSchoolId: string | null;
  setSelectedSchoolId: (id: string | null) => void;
  selectedTermId: string | null;
  setSelectedTermId: (id: string | null) => void;
  selectedClassId: string | null;
  setSelectedClassId: (id: string | null) => void;
  showNotifications: boolean;
  setShowNotifications: (show: boolean) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  disabledFeatures: string[];
  setDisabledFeatures: (features: string[]) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      currentRole: 'SUPER_ADMIN',
      setCurrentRole: (role) => set({ currentRole: role }),
      setCurrentUser: (user) => set({ currentUser: user }),
      currentUser: {
        id: '',
        name: 'User',
        email: '',
        avatar: null,
        schoolId: '',
        schoolName: 'Skoolar Platform',
        planName: 'free',
      },
      currentView: 'overview',
      setCurrentView: (view) => set({ currentView: view }),
      sidebarOpen: true,
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      theme: 'light',
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),
       selectedSchoolId: null,
       setSelectedSchoolId: (id) => set({ selectedSchoolId: id }),
       selectedTermId: null,
       setSelectedTermId: (id) => set({ selectedTermId: id }),
       selectedClassId: null,
       setSelectedClassId: (id) => set({ selectedClassId: id }),
      showNotifications: false,
      setShowNotifications: (show) => set({ showNotifications: show }),
      searchQuery: '',
      setSearchQuery: (query) => set({ searchQuery: query }),
      isLoading: false,
      setIsLoading: (loading) => set({ isLoading: loading }),
      disabledFeatures: [],
      setDisabledFeatures: (features) => set({ disabledFeatures: features }),
    }),
    {
      name: 'skoolar-store',
      // CRITICAL: skipHydration prevents the server and client from rendering
      // different state on first paint (which causes React hydration mismatches).
      // The AppShell manually rehydrates after mount in a client-only effect.
      skipHydration: true,
      partialize: (state) => ({
        theme: state.theme,
        selectedSchoolId: state.selectedSchoolId,
        sidebarOpen: state.sidebarOpen,
        currentView: state.currentView,
        currentRole: state.currentRole,
      }),
    }
  )
);

export interface NavItem {
  id: DashboardView;
  label: string;
  icon: string;
  badge?: number;
  children?: NavItem[];
}

export const navigationByRole: Record<UserRole, NavItem[]> = {
   SUPER_ADMIN: [
     { id: 'super-admin-dashboard', label: 'Dashboard', icon: 'layout-dashboard' },
     { id: 'users-management', label: 'User Management', icon: 'users' },
     { id: 'schools', label: 'Schools', icon: 'building-2' },
     { id: 'registration-codes', label: 'Registration Codes', icon: 'key-round' },
     { id: 'analytics', label: 'Global Analytics', icon: 'bar-chart-3' },
     { id: 'system-health', label: 'System Health', icon: 'activity' },
     { id: 'audit-logs', label: 'Audit Logs', icon: 'file-text' },
     { id: 'school-comparison', label: 'Compare Schools', icon: 'git-compare' },
     { id: 'admin-analytics-advanced', label: 'Advanced Analytics', icon: 'sparkles' },
     { id: 'notifications', label: 'Notifications', icon: 'bell' },
     { id: 'support', label: 'Support', icon: 'life-buoy' },
     { id: 'messaging-center', label: 'Messaging', icon: 'message-circle' },
      { id: 'platform-management', label: 'Platform Manager', icon: 'shield' },
      { id: 'testimonials', label: 'Testimonials', icon: 'star' },
      { id: 'trusted-schools', label: 'Trusted Schools', icon: 'building-2' },
      { id: 'school-controls', label: 'School Controls', icon: 'sliders-horizontal' },
     { id: 'overlay-management', label: 'Overlay Manager', icon: 'layers' },
     { id: 'plans-manager', label: 'Plan Manager', icon: 'credit-card' },
     { id: 'danger-zone', label: 'Danger Zone', icon: 'alert-triangle' },
     { id: 'settings', label: 'Settings', icon: 'settings' },
     { id: 'profile', label: 'Profile', icon: 'user' },
   ],
     SCHOOL_ADMIN: [
        { id: 'school-admin-dashboard-view', label: 'Dashboard', icon: 'layout-dashboard' },
       { id: 'academic-structure', label: 'Academic Structure', icon: 'graduation-cap', children: [
         { id: 'classes', label: 'Classes', icon: 'users' },
        { id: 'subjects', label: 'Subjects', icon: 'book-open' },
        { id: 'scheme-of-work', label: 'Scheme of Work', icon: 'book-text' },
        ]},
       { id: 'students', label: 'Students', icon: 'user-graduate' },
       { id: 'teachers', label: 'Teachers', icon: 'chalkboard-teacher' },
       { id: 'parents', label: 'Parents', icon: 'user' },
       { id: 'users-management', label: 'User Management', icon: 'users' },
       { id: 'attendance', label: 'Attendance', icon: 'calendar-check' },
       { id: 'staff-attendance', label: 'Staff Attendance', icon: 'shield' },
       { id: 'id-scanner', label: 'ID Scanner', icon: 'scan-line' },
       { id: 'exams', label: 'Examinations', icon: 'file-edit' },
     { id: 'entrance-exams', label: 'Entrance Exams', icon: 'clipboard-check' },
       { id: 'job-postings', label: 'Careers', icon: 'briefcase' },
       { id: 'results', label: 'Results & Reports', icon: 'file-bar-chart' },
       { id: 'report-cards', label: 'Report Cards', icon: 'award' },
        { id: 'report-card-view', label: 'Generate Report Cards', icon: 'file-text' },
        { id: 'teacher-grades', label: 'Score Entry', icon: 'award' },
        { id: 'finance', label: 'Finance', icon: 'wallet', children: [
         { id: 'payments', label: 'Payments', icon: 'credit-card' },
         { id: 'fee-structure', label: 'Fee Structure', icon: 'receipt' },
         { id: 'expenses', label: 'Expenses', icon: 'trending-down' },
       ]},
       { id: 'homework', label: 'Homework', icon: 'book-open' },
        { id: 'video-lessons', label: 'Video Lessons', icon: 'video' },
        { id: 'lesson-progress-reports', label: 'Lesson Reports', icon: 'bar-chart-3' },
        { id: 'id-cards', label: 'ID Cards', icon: 'id-card' },
       { id: 'weekly-evaluations', label: 'Weekly Evaluations', icon: 'clipboard-list' },
       { id: 'student-promotion', label: 'Promotions', icon: 'arrow-up-circle' },
       { id: 'bulk-operations', label: 'Bulk Operations', icon: 'layers' },
       { id: 'data-import', label: 'Import/Export Data', icon: 'upload' },
       { id: 'advanced-search', label: 'Advanced Search', icon: 'search' },
{ id: 'in-app-chat', label: 'Messaging', icon: 'message-circle' },
        { id: 'class-monitoring', label: 'Class Monitoring', icon: 'eye' },
        { id: 'notice-board', label: 'Notice Board', icon: 'pin' },
      { id: 'calendar', label: 'Calendar', icon: 'calendar' },
        { id: 'timetable', label: 'Timetable', icon: 'clock' },
        { id: 'feedback', label: 'Feedback', icon: 'message-square' },
       { id: 'communication', label: 'Communication', icon: 'mail' },
       { id: 'school-profile', label: 'School Profile', icon: 'building' },
       { id: 'branding', label: 'Branding', icon: 'palette' },
       { id: 'school-settings', label: 'School Settings', icon: 'sliders' },
        { id: 'subscription', label: 'Subscription', icon: 'credit-card' },
        { id: 'support', label: 'Support', icon: 'life-buoy' },
        { id: 'profile', label: 'Profile', icon: 'user' },
     ],
    TEACHER: [
        { id: 'teacher-dashboard-view', label: 'Dashboard', icon: 'layout-dashboard' },
        { id: 'classes', label: 'My Classes', icon: 'users' },
        { id: 'attendance', label: 'Attendance', icon: 'calendar-check' },
         { id: 'id-scanner', label: 'ID Scanner', icon: 'scan-line' },
         { id: 'staff-self-attendance', label: 'My Attendance', icon: 'shield' },
         { id: 'teacher-homework', label: 'Homework', icon: 'book-open' },
        { id: 'exams', label: 'Exams & Tests', icon: 'file-edit' },
        { id: 'results', label: 'Grade Students', icon: 'file-bar-chart' },
        { id: 'teacher-grades', label: 'Scores & Reports', icon: 'award' },
        { id: 'ai-grading', label: 'AI Grading', icon: 'brain' },
        { id: 'lesson-plans', label: 'Lesson Plans', icon: 'book-text' },
        { id: 'scheme-of-work', label: 'Scheme of Work', icon: 'book-text' },
        { id: 'video-lessons', label: 'Video Lessons', icon: 'video' },
        { id: 'lesson-progress-reports', label: 'Lesson Reports', icon: 'bar-chart-3' },
        { id: 'ai-assistant', label: 'AI Assistant', icon: 'sparkles' },
        { id: 'weekly-evaluations', label: 'Weekly Evaluations', icon: 'clipboard-list' },
        { id: 'in-app-chat', label: 'Messages', icon: 'message-circle' },
        { id: 'class-monitoring', label: 'Class Monitor', icon: 'eye' },
        { id: 'announcements', label: 'Announcements', icon: 'megaphone' },
        { id: 'notice-board', label: 'Notice Board', icon: 'pin' },
        { id: 'calendar', label: 'Calendar', icon: 'calendar' },
        { id: 'id-cards', label: 'ID Cards', icon: 'id-card' },
        { id: 'analytics', label: 'Performance', icon: 'trending-up' },
        { id: 'teacher-my-tasks', label: 'My Tasks', icon: 'clipboard-list' },
        { id: 'feedback', label: 'Feedback', icon: 'message-square' },
        { id: 'profile', label: 'Profile', icon: 'user' },
    ],
  STUDENT: [
    { id: 'student-dashboard-view', label: 'Dashboard', icon: 'layout-dashboard' },
    { id: 'student-lesson-notes', label: 'Lesson Notes', icon: 'book-text' },
    { id: 'student-results', label: 'My Results', icon: 'file-bar-chart' },
    { id: 'student-report-cards', label: 'Report Cards', icon: 'award' },
    { id: 'student-attendance', label: 'Attendance', icon: 'calendar-check' },
    { id: 'timetable', label: 'Timetable', icon: 'clock' },
    { id: 'student-homework', label: 'Homework', icon: 'book-open' },
    { id: 'student-exams', label: 'Take Exam', icon: 'file-edit' },
    { id: 'student-analytics', label: 'Performance', icon: 'trending-up' },
    { id: 'achievements', label: 'Achievements', icon: 'trophy' },
    { id: 'student-video-lessons', label: 'Video Lessons', icon: 'video' },
    { id: 'student-diary', label: 'My Diary', icon: 'book-open' },
    { id: 'in-app-chat', label: 'Messages', icon: 'message-circle' },
    { id: 'announcements', label: 'Announcements', icon: 'megaphone' },
    { id: 'school-calendar-enhanced', label: 'Calendar', icon: 'calendar' },
    { id: 'student-ai-chat', label: 'AI Study Assistant', icon: 'sparkles' },
    { id: 'feedback', label: 'Feedback', icon: 'message-square' },
    { id: 'notifications', label: 'Notifications', icon: 'bell' },
  ],
    PARENT: [
     { id: 'parent-dashboard-view', label: 'Dashboard', icon: 'layout-dashboard' },
     { id: 'parent-portal', label: 'My Children', icon: 'users' },
     { id: 'parent-results-view', label: 'Child Results', icon: 'file-bar-chart' },
     { id: 'parent-report-cards-view', label: 'Report Cards', icon: 'award' },
     { id: 'parent-attendance', label: 'Attendance', icon: 'calendar-check' },
     { id: 'parent-homework', label: 'Child Homework', icon: 'book-open' },
     { id: 'parent-exams', label: 'Tests & Exams', icon: 'graduation-cap' },
     { id: 'parent-lesson-notes', label: 'Lesson Notes', icon: 'book-text' },
     { id: 'parent-video-lessons', label: 'Video Lessons', icon: 'video' },
     { id: 'student-diary', label: 'Child Diary', icon: 'book-open' },
     { id: 'parent-finance', label: 'Fee Payments', icon: 'wallet' },
     { id: 'in-app-chat', label: 'Messages', icon: 'message-circle' },
     { id: 'announcements', label: 'Announcements', icon: 'megaphone' },
     { id: 'notice-board', label: 'Notice Board', icon: 'pin' },
     { id: 'calendar', label: 'Calendar', icon: 'calendar' },
     { id: 'notifications', label: 'Notifications', icon: 'bell' },
     { id: 'feedback', label: 'Feedback', icon: 'message-square' },
      { id: 'parent-download-reports', label: 'Download Reports', icon: 'download' },
    ],
   ACCOUNTANT: [
     { id: 'accountant-dashboard-view', label: 'Dashboard', icon: 'layout-dashboard' },
     { id: 'payments', label: 'Payments', icon: 'credit-card' },
     { id: 'fee-structure', label: 'Fee Structure', icon: 'receipt' },
     { id: 'expenses', label: 'Expenses', icon: 'trending-down' },
      { id: 'finance', label: 'Financial Reports', icon: 'bar-chart-3' },
      { id: 'accountant-students', label: 'Student Accounts', icon: 'user-graduate' },
      { id: 'analytics', label: 'Analytics', icon: 'trending-up' },
      { id: 'feedback', label: 'Feedback', icon: 'message-square' },
      { id: 'notifications', label: 'Notifications', icon: 'bell' },
      { id: 'profile', label: 'Profile', icon: 'user' },
    ],
    LIBRARIAN: [
     { id: 'librarian-dashboard-view', label: 'Dashboard', icon: 'layout-dashboard' },
     { id: 'books', label: 'Books', icon: 'book-open' },
     { id: 'borrow-records', label: 'Borrow Records', icon: 'repeat' },
     { id: 'id-scanner', label: 'ID Scanner', icon: 'scan-line' },
      { id: 'analytics', label: 'Statistics', icon: 'bar-chart-3' },
      { id: 'feedback', label: 'Feedback', icon: 'message-square' },
      { id: 'notifications', label: 'Notifications', icon: 'bell' },
      { id: 'profile', label: 'Profile', icon: 'user' },
    ],
       DIRECTOR: [
        { id: 'overview', label: 'Executive Dashboard', icon: 'layout-dashboard' },
        { id: 'analytics', label: 'Analytics', icon: 'bar-chart-3' },
        { id: 'director-students', label: 'Student Overview', icon: 'user-graduate' },
        { id: 'director-teachers', label: 'Teacher Overview', icon: 'chalkboard-teacher' },
      { id: 'entrance-exams', label: 'Entrance & Interviews', icon: 'clipboard-check' },
        { id: 'job-postings', label: 'Careers', icon: 'briefcase' },
        { id: 'scheme-of-work', label: 'Scheme of Work', icon: 'book-text' },
         { id: 'weekly-evaluations', label: 'Weekly Evaluations', icon: 'clipboard-list' },
        { id: 'director-finance', label: 'Financial Overview', icon: 'wallet' },
        { id: 'director-attendance', label: 'Student Attendance', icon: 'calendar-check' },
        { id: 'staff-attendance', label: 'Staff Attendance', icon: 'shield' },
        { id: 'director-results', label: 'Academic Performance', icon: 'file-bar-chart' },
        { id: 'announcements', label: 'Announcements', icon: 'megaphone' },
        { id: 'notice-board', label: 'Notice Board', icon: 'pin' },
        { id: 'calendar', label: 'Calendar', icon: 'calendar' },
        { id: 'reports', label: 'Reports', icon: 'file-text' },
        { id: 'feedback', label: 'Feedback', icon: 'message-square' },
        { id: 'profile', label: 'Profile', icon: 'user' },
     ],
  };
