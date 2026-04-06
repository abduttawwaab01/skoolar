import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type UserRole = 'SUPER_ADMIN' | 'SCHOOL_ADMIN' | 'TEACHER' | 'STUDENT' | 'PARENT' | 'ACCOUNTANT' | 'LIBRARIAN' | 'DIRECTOR';

export type DashboardView = 
  | 'overview' | 'super-admin-dashboard' | 'schools' | 'registration-codes' | 'academic-structure' 
  | 'students' | 'teachers' | 'parents' | 'classes' | 'subjects'
  | 'attendance' | 'staff-attendance' | 'staff-self-attendance' | 'exams' | 'results' | 'report-cards'
  | 'finance' | 'payments' | 'fee-structure'
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
  | 'parent-homework' | 'parent-video-lessons' | 'teacher-homework'
  | 'report-card-view' | 'support' | 'subscription' | 'school-settings'
  | 'platform-management' | 'school-controls' | 'overlay-management' | 'plans-manager' | 'danger-zone'
  | 'class-monitoring' | 'messaging-center' | 'weekly-evaluations'
  | 'entrance-exams' | 'payment-verification'
  | 'teacher-grades';

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
      partialize: (state) => ({
        theme: state.theme,
        selectedSchoolId: state.selectedSchoolId,
        sidebarOpen: state.sidebarOpen,
        // Don't persist currentView - always reset on load based on role
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
    { id: 'schools', label: 'Schools', icon: 'building-2', badge: 4 },
    { id: 'registration-codes', label: 'Registration Codes', icon: 'key-round' },
    { id: 'analytics', label: 'Global Analytics', icon: 'bar-chart-3' },
    { id: 'system-health', label: 'System Health', icon: 'activity' },
    { id: 'audit-logs', label: 'Audit Logs', icon: 'file-text' },
    { id: 'school-comparison', label: 'Compare Schools', icon: 'git-compare' },
    { id: 'admin-analytics-advanced', label: 'Advanced Analytics', icon: 'sparkles' },
    { id: 'notifications', label: 'Notifications', icon: 'bell', badge: 4 },
    { id: 'support', label: 'Support', icon: 'life-buoy' },
    { id: 'messaging-center', label: 'Messaging', icon: 'message-circle' },
    { id: 'platform-management', label: 'Platform Manager', icon: 'shield' },
    { id: 'school-controls', label: 'School Controls', icon: 'sliders-horizontal' },
    { id: 'overlay-management', label: 'Overlay Manager', icon: 'layers' },
    { id: 'plans-manager', label: 'Plan Manager', icon: 'credit-card' },
    { id: 'danger-zone', label: 'Danger Zone', icon: 'alert-triangle' },
    { id: 'settings', label: 'Settings', icon: 'settings' },
  ],
    SCHOOL_ADMIN: [
      { id: 'overview', label: 'Dashboard', icon: 'layout-dashboard' },
      { id: 'academic-structure', label: 'Academic Structure', icon: 'graduation-cap', children: [
        { id: 'classes', label: 'Classes', icon: 'users' },
        { id: 'subjects', label: 'Subjects', icon: 'book-open' },
      ]},
      { id: 'students', label: 'Students', icon: 'user-graduate', badge: 847 },
      { id: 'teachers', label: 'Teachers', icon: 'chalkboard-teacher' },
      { id: 'parents', label: 'Parents', icon: 'user' },
      { id: 'users-management', label: 'User Management', icon: 'users' },
      { id: 'attendance', label: 'Attendance', icon: 'calendar-check' },
      { id: 'staff-attendance', label: 'Staff Attendance', icon: 'shield' },
      { id: 'id-scanner', label: 'ID Scanner', icon: 'scan-line' },
      { id: 'exams', label: 'Examinations', icon: 'file-edit' },
      { id: 'entrance-exams', label: 'Entrance & Interviews', icon: 'clipboard-check' },
      { id: 'results', label: 'Results & Reports', icon: 'file-bar-chart' },
      { id: 'report-cards', label: 'Report Cards', icon: 'award' },
      { id: 'report-card-view', label: 'Generate Report Cards', icon: 'file-text' },
      { id: 'finance', label: 'Finance', icon: 'wallet', children: [
        { id: 'payments', label: 'Payments', icon: 'credit-card' },
        { id: 'fee-structure', label: 'Fee Structure', icon: 'receipt' },
      ]},
      { id: 'homework', label: 'Homework', icon: 'book-open' },
      { id: 'video-lessons', label: 'Video Lessons', icon: 'video' },
      { id: 'id-cards', label: 'ID Cards', icon: 'id-card' },
      { id: 'weekly-evaluations', label: 'Weekly Evaluations', icon: 'clipboard-list' },
      { id: 'student-promotion', label: 'Promotions', icon: 'arrow-up-circle' },
      { id: 'bulk-operations', label: 'Bulk Operations', icon: 'layers' },
      { id: 'data-import', label: 'Import/Export Data', icon: 'upload' },
      { id: 'advanced-search', label: 'Advanced Search', icon: 'search' },
      { id: 'in-app-chat', label: 'Messaging', icon: 'message-circle', badge: 3 },
      { id: 'class-monitoring', label: 'Class Monitoring', icon: 'eye' },
      { id: 'announcements', label: 'Announcements', icon: 'megaphone' },
      { id: 'notice-board', label: 'Notice Board', icon: 'pin' },
      { id: 'calendar', label: 'Calendar', icon: 'calendar' },
      { id: 'feedback', label: 'Feedback', icon: 'message-square' },
      { id: 'communication', label: 'Communication', icon: 'mail' },
      { id: 'school-profile', label: 'School Profile', icon: 'building' },
      { id: 'branding', label: 'Branding', icon: 'palette' },
      { id: 'school-settings', label: 'School Settings', icon: 'sliders' },
      { id: 'subscription', label: 'Subscription', icon: 'credit-card' },
      { id: 'support', label: 'Support', icon: 'life-buoy' },
      { id: 'settings', label: 'Settings', icon: 'settings' },
    ],
   TEACHER: [
       { id: 'overview', label: 'Dashboard', icon: 'layout-dashboard' },
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
       { id: 'video-lessons', label: 'Video Lessons', icon: 'video' },
       { id: 'ai-assistant', label: 'AI Assistant', icon: 'sparkles' },
       { id: 'weekly-evaluations', label: 'Weekly Evaluations', icon: 'clipboard-list' },
       { id: 'in-app-chat', label: 'Messages', icon: 'message-circle', badge: 3 },
       { id: 'class-monitoring', label: 'Class Monitor', icon: 'eye' },
       { id: 'announcements', label: 'Announcements', icon: 'megaphone' },
       { id: 'notice-board', label: 'Notice Board', icon: 'pin' },
       { id: 'calendar', label: 'Calendar', icon: 'calendar' },
       { id: 'analytics', label: 'Performance', icon: 'trending-up' },
    ],
  STUDENT: [
    { id: 'overview', label: 'Dashboard', icon: 'layout-dashboard' },
    { id: 'results', label: 'My Results', icon: 'file-bar-chart' },
    { id: 'report-cards', label: 'Report Cards', icon: 'award' },
    { id: 'attendance', label: 'Attendance', icon: 'calendar-check' },
    { id: 'homework', label: 'Homework', icon: 'book-open' },
    { id: 'exams', label: 'Take Exam', icon: 'file-edit' },
    { id: 'analytics', label: 'Performance', icon: 'trending-up' },
    { id: 'achievements', label: 'Achievements', icon: 'trophy' },
    { id: 'student-video-lessons', label: 'Video Lessons', icon: 'video' },
    { id: 'student-diary', label: 'My Diary', icon: 'book-open' },
    { id: 'in-app-chat', label: 'Messages', icon: 'message-circle' },
    { id: 'announcements', label: 'Announcements', icon: 'megaphone' },
    { id: 'school-calendar-enhanced', label: 'Calendar', icon: 'calendar' },
    { id: 'student-ai-chat', label: 'AI Study Assistant', icon: 'sparkles' },
    { id: 'notifications', label: 'Notifications', icon: 'bell', badge: 2 },
  ],
   PARENT: [
    { id: 'overview', label: 'Dashboard', icon: 'layout-dashboard' },
    { id: 'parent-portal', label: 'My Children', icon: 'users' },
    { id: 'results', label: 'Child Results', icon: 'file-bar-chart' },
    { id: 'report-cards', label: 'Report Cards', icon: 'award' },
    { id: 'attendance', label: 'Attendance', icon: 'calendar-check' },
    { id: 'parent-homework', label: 'Child Homework', icon: 'book-open' },
    { id: 'parent-video-lessons', label: 'Video Lessons', icon: 'video' },
    { id: 'student-diary', label: 'Child Diary', icon: 'book-open' },
    { id: 'finance', label: 'Fee Payments', icon: 'wallet' },
    { id: 'in-app-chat', label: 'Messages', icon: 'message-circle', badge: 5 },
    { id: 'announcements', label: 'Announcements', icon: 'megaphone' },
    { id: 'notice-board', label: 'Notice Board', icon: 'pin' },
    { id: 'calendar', label: 'Calendar', icon: 'calendar' },
    { id: 'notifications', label: 'Notifications', icon: 'bell', badge: 5 },
    { id: 'feedback', label: 'Feedback', icon: 'message-square' },
    { id: 'data-import', label: 'Download Reports', icon: 'download' },
  ],
  ACCOUNTANT: [
    { id: 'overview', label: 'Dashboard', icon: 'layout-dashboard' },
    { id: 'payments', label: 'Payments', icon: 'credit-card' },
    { id: 'fee-structure', label: 'Fee Structure', icon: 'receipt' },
    { id: 'finance', label: 'Financial Reports', icon: 'bar-chart-3' },
    { id: 'students', label: 'Student Accounts', icon: 'user-graduate' },
    { id: 'analytics', label: 'Analytics', icon: 'trending-up' },
    { id: 'notifications', label: 'Notifications', icon: 'bell' },
  ],
  LIBRARIAN: [
    { id: 'overview', label: 'Dashboard', icon: 'layout-dashboard' },
    { id: 'books', label: 'Books', icon: 'book-open' },
    { id: 'borrow-records', label: 'Borrow Records', icon: 'repeat' },
    { id: 'id-scanner', label: 'ID Scanner', icon: 'scan-line' },
    { id: 'analytics', label: 'Statistics', icon: 'bar-chart-3' },
    { id: 'notifications', label: 'Notifications', icon: 'bell' },
  ],
     DIRECTOR: [
       { id: 'overview', label: 'Executive Dashboard', icon: 'layout-dashboard' },
       { id: 'analytics', label: 'Analytics', icon: 'bar-chart-3' },
       { id: 'students', label: 'Student Overview', icon: 'user-graduate' },
       { id: 'teachers', label: 'Teacher Overview', icon: 'chalkboard-teacher' },
       { id: 'entrance-exams', label: 'Entrance & Interviews', icon: 'clipboard-check' },
       { id: 'weekly-evaluations', label: 'Weekly Evaluations', icon: 'clipboard-list' },
       { id: 'finance', label: 'Financial Overview', icon: 'wallet' },
       { id: 'attendance', label: 'Student Attendance', icon: 'calendar-check' },
       { id: 'staff-attendance', label: 'Staff Attendance', icon: 'shield' },
       { id: 'results', label: 'Academic Performance', icon: 'file-bar-chart' },
       { id: 'announcements', label: 'Announcements', icon: 'megaphone' },
       { id: 'notice-board', label: 'Notice Board', icon: 'pin' },
       { id: 'calendar', label: 'Calendar', icon: 'calendar' },
       { id: 'reports', label: 'Reports', icon: 'file-text' },
       { id: 'feedback', label: 'Feedback', icon: 'message-square' },
    ],
  };
