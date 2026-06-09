'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useAppStore, navigationByRole, type NavItem, type DashboardView, type UserRole } from '@/store/app-store';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { slideUp, fadeIn, staggerContainer } from '@/lib/motion-variants';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { soundEffects, areSoundsEnabled, toggleSounds, initAudioOnInteraction } from '@/lib/ui-sounds';
import { handleSilentError } from '@/lib/error-handler';
import {
  LayoutDashboard, Building2, KeyRound, BarChart3, Activity, FileText,
  Bell, Settings, GraduationCap, Users, CalendarCheck, FileEdit,
  FileBarChart, Award, Wallet, CreditCard, Receipt, IdCard, Megaphone,
  Calendar, MessageSquare, Mail, Building, Palette, BookUser,
  UserRound, BookOpen, BookText, Sparkles, TrendingUp, Trophy,
  Repeat, ScanLine, Library, Target, Shield, Moon, Sun, Menu, Search,
  LogOut, ChevronDown, X, Check, AlertTriangle, Info, AlertCircle,
  School, RefreshCw, Layers, ArrowUpCircle, GitCompare, Brain,
  Upload, Download, MessageCircle, BrainCircuit, Video, ClipboardList,
  LifeBuoy, Pin, Sliders, Search as SearchIcon, Volume2, VolumeX, Clock,
} from 'lucide-react';
import { AnnouncementTicker } from '@/components/platform/announcement-ticker';
import { AdvertCarousel } from '@/components/platform/advert-carousel';
import { ResponsiveCanvas } from '@/components/shared/responsive-canvas';
import { CommandPalette } from './command-palette';
import { usePWANative } from '@/hooks/use-pwa-native';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';

// ── Mobile Bottom Navigation ──
// Defines 4-5 essential views per role. Each view ID must match the role's navigationByRole.
const roleBottomNav: Record<UserRole, { id: DashboardView; label: string; icon: React.ElementType }[]> = {
  SUPER_ADMIN: [
    { id: 'super-admin-dashboard', label: 'Home', icon: LayoutDashboard },
    { id: 'schools', label: 'Schools', icon: Building2 },
    { id: 'messaging-center', label: 'Chat', icon: MessageSquare },
    { id: 'settings', label: 'Settings', icon: Settings },
  ],
  SCHOOL_ADMIN: [
    { id: 'school-admin-dashboard-view', label: 'Home', icon: LayoutDashboard },
    { id: 'students', label: 'Students', icon: Users },
    { id: 'attendance', label: 'Attendance', icon: CalendarCheck },
    { id: 'in-app-chat', label: 'Chat', icon: MessageSquare },
    { id: 'payments', label: 'Payments', icon: Wallet },
  ],
  TEACHER: [
    { id: 'teacher-dashboard-view', label: 'Home', icon: LayoutDashboard },
    { id: 'attendance', label: 'Attendance', icon: CalendarCheck },
    { id: 'students', label: 'Students', icon: Users },
    { id: 'in-app-chat', label: 'Chat', icon: MessageSquare },
    { id: 'teacher-homework', label: 'Homework', icon: BookOpen },
  ],
  STUDENT: [
    { id: 'student-dashboard-view', label: 'Home', icon: LayoutDashboard },
    { id: 'student-results', label: 'Results', icon: FileBarChart },
    { id: 'student-exams', label: 'Exams', icon: FileEdit },
    { id: 'in-app-chat', label: 'Chat', icon: MessageSquare },
    { id: 'student-homework', label: 'Homework', icon: BookOpen },
  ],
  PARENT: [
    { id: 'parent-dashboard-view', label: 'Home', icon: LayoutDashboard },
    { id: 'parent-portal', label: 'Children', icon: Users },
    { id: 'parent-attendance', label: 'Attendance', icon: CalendarCheck },
    { id: 'in-app-chat', label: 'Chat', icon: MessageSquare },
    { id: 'parent-finance', label: 'Payments', icon: Wallet },
  ],
  ACCOUNTANT: [
    { id: 'accountant-dashboard-view', label: 'Home', icon: LayoutDashboard },
    { id: 'payments', label: 'Payments', icon: Wallet },
    { id: 'fee-structure', label: 'Fee Structure', icon: Receipt },
    { id: 'finance', label: 'Reports', icon: FileBarChart },
  ],
  LIBRARIAN: [
    { id: 'librarian-dashboard-view', label: 'Home', icon: LayoutDashboard },
    { id: 'books', label: 'Books', icon: BookOpen },
    { id: 'borrow-records', label: 'Borrowed', icon: Repeat },
    { id: 'id-scanner', label: 'Scanner', icon: ScanLine },
  ],
  DIRECTOR: [
    { id: 'overview', label: 'Home', icon: LayoutDashboard },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'director-students', label: 'Students', icon: Users },
    { id: 'director-attendance', label: 'Attendance', icon: CalendarCheck },
  ],
};

function MobileBottomNav() {
  const { currentView, setCurrentView, currentRole, mobileSidebarOpen } = useAppStore();

  const items = roleBottomNav[currentRole] || [];
  if (items.length === 0) return null;

  return (
    <nav className={`mobile-bottom-nav ${mobileSidebarOpen ? 'hidden' : ''}`} aria-label="Mobile navigation">
      {items.map(item => {
        const isActive = currentView === item.id;
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            className={`mobile-bottom-nav-btn ${isActive ? 'active' : ''}`}
            onClick={() => setCurrentView(item.id)}
            aria-label={item.label}
          >
            <Icon className="size-5" />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

const iconMap: Record<string, React.ElementType> = {
  'layout-dashboard': LayoutDashboard, 'building-2': Building2, 'key-round': KeyRound,
  'bar-chart-3': BarChart3, 'activity': Activity, 'file-text': FileText,
  'bell': Bell, 'settings': Settings, 'graduation-cap': GraduationCap,
  'users': Users, 'calendar-check': CalendarCheck, 'file-edit': FileEdit,
  'file-bar-chart': FileBarChart, 'award': Award, 'wallet': Wallet,
  'credit-card': CreditCard, 'receipt': Receipt, 'id-card': IdCard,
  'megaphone': Megaphone, 'calendar': Calendar, 'message-square': MessageSquare,
  'mail': Mail, 'building': Building, 'palette': Palette,
  'chalkboard-teacher': BookUser, 'user-graduate': UserRound,
  'book-open': BookOpen, 'book-text': BookText, 'sparkles': Sparkles,
  'trending-up': TrendingUp, 'trophy': Trophy, 'repeat': Repeat,
  'scan-line': ScanLine, 'library': Library, 'target': Target,
  'shield': Shield,
  'arrow-up-circle': ArrowUpCircle, 'git-compare': GitCompare,
  'brain': Brain, 'layers': Layers, 'upload': Upload, 'download': Download,
  'message-circle': MessageCircle, 'brain-circuit': BrainCircuit,
  'video': Video, 'clipboard-list': ClipboardList,
  'life-buoy': LifeBuoy, 'pin': Pin, 'sliders': Sliders, 'search': SearchIcon,
  'eye': Search, 'clock': Clock,
};

const roleConfig: Record<UserRole, { label: string; color: string; bg: string; emoji: string }> = {
  SUPER_ADMIN: { label: 'Super Admin', color: 'text-red-700', bg: 'bg-red-100 border-red-200', emoji: '👑' },
  SCHOOL_ADMIN: { label: 'School Admin', color: 'text-emerald-700', bg: 'bg-emerald-100 border-emerald-200', emoji: '🏫' },
  TEACHER: { label: 'Teacher', color: 'text-blue-700', bg: 'bg-blue-100 border-blue-200', emoji: '👩‍🏫' },
  STUDENT: { label: 'Student', color: 'text-purple-700', bg: 'bg-purple-100 border-purple-200', emoji: '🎓' },
  PARENT: { label: 'Parent', color: 'text-amber-700', bg: 'bg-amber-100 border-amber-200', emoji: '🤝' },
  ACCOUNTANT: { label: 'Accountant', color: 'text-cyan-700', bg: 'bg-cyan-100 border-cyan-200', emoji: '💰' },
  LIBRARIAN: { label: 'Librarian', color: 'text-violet-700', bg: 'bg-violet-100 border-violet-200', emoji: '📚' },
  DIRECTOR: { label: 'Director', color: 'text-pink-700', bg: 'bg-pink-100 border-pink-200', emoji: '👔' },
};

 const navEmojiMap: Record<string, string> = {
   'overview': '📊',
   'dashboard': '📊',
   'schools': '🏫',
   'registration-codes': '🔑',
   'analytics': '📈',
   'system-health': '💚',
   'audit-logs': '📋',
   'notifications': '🔔',
   'settings': '⚙️',
   'academic-structure': '🎓',
   'students': '👩‍🎓',
   'teachers': '👩‍🏫',
   'parents': '👨‍👩‍👧',
   'classes': '👥',
   'subjects': '📖',
   'attendance': '📅',
   'examinations': '📝',
   'exams': '📝',
   'results': '📊',
   'report-cards': '📑',

   'finance': '💳',
   'payments': '💸',
   'fee-structure': '🧾',
   'id-cards': '🪪',
   'id-scanner': '📷',
    'announcements': '📢',
    'calendar': '📆',
    'feedback': '💬',
    'in-app-chat': '💬',
   'homework': '📚',
   'video-lessons': '🎥',
   'student-lesson-notes': '📓',
   'parent-lesson-notes': '📓',
   'student-video-lessons': '🎥',
   'student-ai-chat': '🤖',
   'ai-assistant': '🤖',
   'ai-grading': '🧠',
   'lesson-plans': '📓',
   'weekly-evaluations': '📋',
   'class-monitoring': '👁️',
   'school-profile': '🏢',
   'branding': '🎨',
   'school-settings': '⚙️',
   'subscription': '💳',
   'support': '🆘',
   'platform-management': '🛡️',
   'school-controls': '🎛️',
   'overlay-management': '📺',
   'plans-manager': '📋',
   'danger-zone': '⚠️',
   'reports': '📄',
   'data-import': '📥',
   'data-export': '📤',
   'student-promotion': '🔼',
    'school-calendar-enhanced': '🗓️',
    'parent-portal': '👨‍👩‍👧',
    'admin-analytics-advanced': '📊',
    'student-diary': '📔',
    'parent-homework': '📚',
    'parent-finance': '💳',
    'teacher-homework': '📝',

    'health-records': '🏥',
    'transport': '🚌',
    'achievements': '🏆',
    'behavior': '⚖️',
    'books': '📕',
    'borrow-records': '📋',
    'users-management': '👥',
  };

const viewTitles: Record<string, string> = {
  'overview': 'Dashboard', 'super-admin-dashboard': 'Platform Overview', 'schools': 'Schools', 'registration-codes': 'Registration Codes',
  'analytics': 'Analytics', 'system-health': 'System Health', 'audit-logs': 'Audit Logs',
  'notifications': 'Notifications', 'settings': 'Settings', 'academic-structure': 'Academic Structure',
  'students': 'Students', 'teachers': 'Teachers', 'parents': 'Parents', 'classes': 'Classes',
  'subjects': 'Subjects', 'attendance': 'Attendance', 'exams': 'Examinations',
  'results': 'Results & Reports', 'report-cards': 'Report Cards', 'finance': 'Finance',
  'payments': 'Payments', 'fee-structure': 'Fee Structure', 'id-cards': 'ID Cards',
  'id-scanner': 'ID Scanner', 'announcements': 'Announcements', 'calendar': 'Calendar',
    'feedback': 'Feedback', 'school-profile': 'School Profile',
  'branding': 'Branding', 'lesson-plans': 'Lesson Plans', 'ai-assistant': 'AI Assistant',
  'achievements': 'Achievements', 'behavior': 'Behavior Tracking', 'health-records': 'Health Records',
  'transport': 'Transport', 'books': 'Books', 'borrow-records': 'Borrow Records',
  'reports': 'Reports',
  'users-management': 'User Management',
  'platform-management': 'Platform Management',
  'ai-grading': 'AI Grading',
  'bulk-operations': 'Bulk Operations',
  'advanced-search': 'Advanced Search',
  'school-comparison': 'School Comparison',
  'data-import': 'Import/Export',
  'in-app-chat': 'Messaging',
  'student-promotion': 'Student Promotion',
  'school-calendar-enhanced': 'Calendar',
  'parent-portal': 'Parent Portal',
  'admin-analytics-advanced': 'Advanced Analytics',
  'teacher-homework': 'Homework Management',
  'homework': 'My Homework',
  'parent-homework': 'Child Homework',
  'parent-finance': 'Fee Payments',
  'video-lessons': 'Video Lessons',
  'student-lesson-notes': 'Lesson Notes',
  'parent-lesson-notes': 'Lesson Notes',
  'student-video-lessons': 'Video Lessons',
  'student-ai-chat': 'AI Study Assistant',
  'support': 'Support',
  'subscription': 'Subscription',
  'school-settings': 'School Settings',
  'student-diary': 'Student Diary',

  'class-monitoring': 'Class Monitoring',
  'plans-manager': 'Plan Manager',
  'danger-zone': 'Danger Zone',
  'school-controls': 'School Controls',
  'overlay-management': 'Overlay Manager',
};

function NavItemButton({ item, collapsed }: { item: NavItem; collapsed?: boolean }) {
  const { currentView, setCurrentView } = useAppStore();
  const isActive = currentView === item.id;
  const Icon = iconMap[item.icon] || LayoutDashboard;
  const emoji = navEmojiMap[item.label.toLowerCase()] || navEmojiMap[item.id] || '';

  if (item.children) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={cn(
              'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200',
              item.children.some(c => currentView === c.id)
                ? 'bg-primary/10 text-primary shadow-sm'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              collapsed && 'justify-center px-2'
            )}
            onClick={() => soundEffects.click()}
          >
            <span className="flex items-center justify-center">
              {collapsed ? (
                <span className="text-base">{emoji || '📊'}</span>
              ) : (
                <Icon className="size-4 shrink-0" />
              )}
            </span>
            {!collapsed && (
              <>
                <span className="flex-1 text-left">{item.label}</span>
                <ChevronDown className="size-3.5 opacity-50" />
              </>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" className="w-52">
          {item.children.map(child => {
            const ChildIcon = iconMap[child.icon] || LayoutDashboard;
            const childEmoji = navEmojiMap[child.label.toLowerCase()] || navEmojiMap[child.id] || '';
            const isChildActive = currentView === child.id;
            return (
              <DropdownMenuItem
                key={child.id}
                onClick={() => {
                  setCurrentView(child.id as DashboardView);
                  soundEffects.navigate();
                }}
                className={cn('gap-2', isChildActive && 'bg-primary/5 text-primary font-medium')}
              >
                <span className="text-sm">{childEmoji}</span>
                <span className="flex-1">{child.label}</span>
                {isChildActive && <div className="size-1.5 rounded-full bg-primary" />}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  const button = (
    <button
      onClick={() => {
        setCurrentView(item.id as DashboardView);
        soundEffects.navigate();
      }}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200',
        isActive
          ? 'bg-primary/10 text-primary shadow-sm'
          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
        collapsed && 'justify-center px-2'
      )}
    >
      <span className="flex items-center justify-center">
        {collapsed ? (
          <span className="text-base">{emoji || '📊'}</span>
        ) : (
          <Icon className="size-4 shrink-0" />
        )}
      </span>
      {!collapsed && (
        <>
          <span className="flex items-center gap-1.5 flex-1 text-left">
            <span className="text-sm">{emoji}</span>
            {item.label}
          </span>
          {item.badge !== undefined && (
            <Badge variant="secondary" className="ml-auto h-5 min-w-[20px] justify-center px-1.5 text-xs bg-primary/10 text-primary">
              {item.badge}
            </Badge>
          )}
        </>
      )}
      {/* Active indicator for collapsed sidebar */}
      {collapsed && isActive && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full bg-primary" />
      )}
    </button>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="right" className="flex items-center gap-2">
          <span>{emoji}</span>
          {item.label}
          {item.badge !== undefined && <Badge variant="secondary" className="h-5 px-1.5 text-xs">{item.badge}</Badge>}
        </TooltipContent>
      </Tooltip>
    );
  }

  return button;
}

// Map DashboardView IDs to PLATFORM_FEATURES IDs (kebab-case → snake_case)
const viewToFeatureMap: Record<string, string> = {
  'video-lessons': 'video_lessons',
  'live-classes': 'live_classes',
  'staff-attendance': 'staff_attendance',
  'timetable': 'timetable',
  'scheme-of-work': 'scheme_of_work',
  'class-monitoring': 'class_monitoring',
  'entrance-exams': 'entrance_exams',
  'job-postings': 'job_postings',
  'student-diary': 'student_diary',
  'ai-assistant': 'ai_assistant',
  'ai-grading': 'ai_grading',
  'teacher-tasks': 'teacher_tasks',
  'teacher-my-tasks': 'teacher_tasks',
  'teacher-performance': 'teacher_performance',
  'student-leaderboard': 'student_leaderboard',
  'lesson-progress-reports': 'lesson_progress',
  'testimonials': 'testimonials',
  'trusted-schools': 'trusted_schools',
  'payment-verification': 'payment_verification',
  'student-lesson-notes': 'student_lesson_notes',
  'parent-lesson-notes': 'student_lesson_notes',
  'parent-download-reports': 'parent_downloads',
  'weekly-evaluations': 'weekly_evaluations',
  'id-scanner': 'id_scanner',
  'report-cards': 'report_cards',
  'id-cards': 'id_cards',
  'health-records': 'health_records',
  'data-import': 'data_import_export',
  'advanced-search': 'advanced_search',
  'student-promotion': 'student_promotion',
  'student-ai-chat': 'ai_assistant',
  'lesson-plans': 'lesson_plans',
  'school-calendar-enhanced': 'calendar',
  'in-app-chat': 'chat',
  'messaging-center': 'chat',
  'teacher-grades': 'grading',
  'bulk-operations': 'bulk_operations',
  'fee-structure': 'fee_management',
  'parent-portal': 'parent_portal',
  'admin-analytics-advanced': 'analytics',
  'school-comparison': 'analytics',
  'books': 'library',
  'borrow-records': 'library',
  'support': 'support_tickets',
};

function SidebarContent() {
  const { currentRole, currentUser, sidebarOpen, disabledFeatures } = useAppStore();
  const allNavItems = navigationByRole[currentRole] || [];

  // Filter navigation items based on disabled features
  const navItems = allNavItems.filter(item => {
    if (currentRole === 'SUPER_ADMIN') return true;
    const featureId = viewToFeatureMap[item.id] || item.id;
    return !disabledFeatures.includes(featureId);
  });

  const rc = roleConfig[currentRole];
  const initials = currentUser.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className="flex items-center gap-3 px-4 py-5">
        <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-200/50">
          <School className="size-5" />
        </div>
        {sidebarOpen && (
          <div className="min-w-0">
            <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
              Skoolar
            </h1>
            <p className="text-[11px] text-muted-foreground">📚 Multi-School Platform</p>
          </div>
        )}
      </div>

      <Separator className="opacity-60" />

      {/* Role Badge */}
      {sidebarOpen && (
        <div className="px-3 py-3">
          <div className={cn('flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors', rc.bg, rc.color)}>
            <span className="text-base">{rc.emoji}</span>
            <span className="flex-1 font-medium">{rc.label}</span>
          </div>
        </div>
      )}

      <Separator className="opacity-60" />

      {/* Free Plan Upgrade Banner */}
      {sidebarOpen && currentUser.planName === 'free' && currentRole !== 'SUPER_ADMIN' && (
        <div className="px-3 pt-3">
          {currentRole === 'SCHOOL_ADMIN' ? (
            <button
              onClick={() => { const store = useAppStore.getState(); store.setCurrentView('subscription'); }}
              className="flex w-full items-center gap-2 rounded-lg border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 px-3 py-2.5 transition-all hover:from-amber-100 hover:to-orange-100 hover:shadow-sm cursor-pointer text-left"
            >
              <div className="flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-sm shrink-0">
                <ArrowUpCircle className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-amber-800">Free Plan</p>
                <p className="text-[10px] text-amber-600 leading-tight">Upgrade to unlock more features</p>
              </div>
              <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 text-[10px] px-2 py-0.5">
                Upgrade
              </Badge>
            </button>
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 px-3 py-2.5 opacity-80">
              <div className="flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-sm shrink-0">
                <ArrowUpCircle className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-amber-800">Free Plan</p>
                <p className="text-[10px] text-amber-600 leading-tight">Contact admin to upgrade</p>
              </div>
              <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 text-[10px] px-2 py-0.5">
                Free
              </Badge>
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <ScrollArea className="flex-1 min-h-0 px-3 py-2">
        <nav className="space-y-0.5">
          {navItems.map(item => (
            <NavItemButton key={item.id} item={item} collapsed={!sidebarOpen} />
          ))}
        </nav>
      </ScrollArea>

      <Separator className="opacity-60" />

      {/* User */}
      <div className="px-3 py-3">
        <div className={cn('flex items-center gap-3 rounded-lg px-2 py-2', sidebarOpen ? '' : 'justify-center')}>
          <Avatar className="size-8 ring-2 ring-emerald-100">
            <AvatarFallback className="bg-gradient-to-br from-emerald-100 to-teal-100 text-emerald-700 text-xs font-semibold">{initials}</AvatarFallback>
          </Avatar>
          {sidebarOpen && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{currentUser.name}</p>
              <p className="truncate text-xs text-muted-foreground">{currentUser.schoolName}</p>
            </div>
          )}
          {sidebarOpen && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="size-7 hover:bg-red-50 hover:text-red-600" onClick={() => { soundEffects.logout(); window.location.href = '/api/auth/signout?callbackUrl=/login'; }}>
                  <LogOut className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Logout</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    </div>
  );
}

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: string;
  category: string;
  isRead: boolean;
  createdAt: string;
  actionUrl?: string | null;
}

const notifTypeEmoji: Record<string, string> = { success: '✅', warning: '⚠️', error: '❌', info: 'ℹ️' };
const notifColorMap: Record<string, string> = { success: 'border-l-emerald-500', warning: 'border-l-amber-500', error: 'border-l-red-500', info: 'border-l-sky-500' };
const categoryEmoji: Record<string, string> = {
  attendance: '📋', report_card: '📄', payment: '💳', exam: '📝',
  admission: '🎓', announcement: '📢', task: '✅', evaluation: '⭐', job: '💼', general: '📌',
};

function NotificationsPanel() {
  const { showNotifications, setShowNotifications, currentUser } = useAppStore();
  const [mounted, setMounted] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/notifications?userId=${currentUser.id}&limit=20`);
      if (res.ok) {
        const json = await res.json();
        setNotifications(json.data || []);
      }
      } catch (error: unknown) { handleSilentError(error, 'Fetch schools'); } finally { setLoading(false); }
  }, [currentUser.id]);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (showNotifications) {
      fetchNotifications();
      soundEffects.notification();
    }
  }, [showNotifications, fetchNotifications]);

  const handleMarkAllRead = async () => {
    try {
      setMarkingAll(true);
      const res = await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAll: true, userId: currentUser.id }),
      });
      if (res.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
        const json = await res.json();
        toast.success(`${json.message || 'All notifications marked as read'} ✅`);
        soundEffects.success();
      }
    } catch (error: unknown) { handleSilentError(error);
      toast.error('Failed to mark notifications as read ❌');
      soundEffects.error();
    } finally {
      setMarkingAll(false);
    }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  function formatTime(dateStr: string) {
    if (!mounted) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  }

  return (
    <div className={cn('fixed inset-y-0 right-0 z-50 w-full max-w-md transform bg-background border-l shadow-2xl transition-transform duration-300 ease-out', showNotifications ? 'translate-x-0' : 'translate-x-full')}>
    <div className="flex h-full min-h-0 flex-col">
        <div className="flex items-center justify-between border-b px-4 py-3 bg-gradient-to-r from-emerald-50/50 to-teal-50/50">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            🔔 Notifications
            {unreadCount > 0 && (
              <Badge className="bg-emerald-500 text-white">{unreadCount}</Badge>
            )}
          </h3>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-emerald-600" onClick={handleMarkAllRead} disabled={markingAll || unreadCount === 0}>
              {markingAll ? '...' : '✓ Mark all read'}
            </Button>
            <Button variant="ghost" size="icon" className="size-8" onClick={() => { setShowNotifications(false); soundEffects.modalClose(); }}>
              <X className="size-4" />
            </Button>
          </div>
        </div>
        <ScrollArea className="flex-1">
          {loading ? (
            <div className="divide-y">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="flex gap-3 px-4 py-3">
                  <Skeleton className="mt-0.5 size-8 rounded-full shrink-0" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <span className="text-4xl mb-3">🔕</span>
              <p className="text-sm font-medium">All caught up!</p>
              <p className="text-xs text-muted-foreground mt-1">No new notifications</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map(n => (
                <div
                  key={n.id}
                  className={cn(
                    'flex gap-3 px-4 py-3 border-l-4 transition-all duration-200 hover:bg-accent/50',
                    n.actionUrl && 'cursor-pointer',
                    notifColorMap[n.type] || 'border-l-gray-300',
                    !n.isRead && 'bg-accent/30'
                  )}
                  onClick={() => {
                    if (n.actionUrl) {
                      window.location.href = n.actionUrl;
                    }
                  }}
                >
                  <div className="mt-0.5 size-8 rounded-full bg-muted flex items-center justify-center shrink-0 text-sm">
                    {notifTypeEmoji[n.type] || '📌'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className={cn('text-sm leading-tight', !n.isRead && 'font-semibold')}>{n.title}</p>
                        <span className="text-[10px] text-muted-foreground">
                          {categoryEmoji[n.category] || '📌'} {n.category}
                        </span>
                      </div>
                      {!n.isRead && <span className="mt-1 size-2 rounded-full bg-emerald-500 shrink-0 animate-pulse" />}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{n.message}</p>
                    <p className="mt-1.5 text-[11px] text-muted-foreground flex items-center gap-1">
                      <Clock className="size-3" />
                      {formatTime(n.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}

interface SchoolItem {
  id: string;
  name: string;
}

function useSchools() {
  const [schools, setSchools] = useState<SchoolItem[]>([]);
  const [loading, setLoading] = useState(true);
  const currentRole = useAppStore((s) => s.currentRole);

  useEffect(() => {
    async function fetchSchools() {
      try {
        // SUPER_ADMIN uses authenticated endpoint, others use public endpoint
        const url = currentRole === 'SUPER_ADMIN'
          ? '/api/schools?limit=50'
          : '/api/schools?public=true&limit=100';
        const res = await fetch(url);
        if (res.ok) {
          const json = await res.json();
          setSchools(json.data || []);
        }
      } catch (error: unknown) { handleSilentError(error, 'Fetch schools'); } finally { setLoading(false); }
    }
    fetchSchools();
  }, [currentRole]);

  return { schools, loading };
}

function SchoolSelector() {
  const { selectedSchoolId, setSelectedSchoolId } = useAppStore();
  const { schools, loading } = useSchools();

  const selectedName = selectedSchoolId
    ? schools.find(s => s.id === selectedSchoolId)?.name || 'All Schools'
    : 'All Schools';

  if (loading) {
    return (
      <Button variant="outline" size="sm" className="hidden md:flex gap-2" disabled>
        🏫 <Skeleton className="h-4 w-24" />
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="hidden md:flex gap-2" onClick={() => soundEffects.click()}>
          🏫 <span>{selectedName}</span>
          <ChevronDown className="size-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={() => { setSelectedSchoolId(null); soundEffects.click(); }}>🏫 All Schools</DropdownMenuItem>
        {schools.map(school => (
          <DropdownMenuItem key={school.id} onClick={() => { setSelectedSchoolId(school.id); soundEffects.click(); }}>
            {school.name}
            {selectedSchoolId === school.id && <Check className="ml-auto size-4 text-emerald-500" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SchoolSelectorMobile() {
  const { selectedSchoolId, setSelectedSchoolId } = useAppStore();
  const { schools, loading } = useSchools();

  if (loading) {
    return <div className="px-2 py-1 text-xs text-muted-foreground">Loading...</div>;
  }

  return (
    <>
      <DropdownMenuItem onClick={() => { setSelectedSchoolId(null); soundEffects.click(); }}>
        🏫 All Schools
        {!selectedSchoolId && <Check className="ml-auto size-4 text-emerald-500" />}
      </DropdownMenuItem>
      {schools.map(school => (
        <DropdownMenuItem key={school.id} onClick={() => { setSelectedSchoolId(school.id); soundEffects.click(); }}>
          {school.name}
          {selectedSchoolId === school.id && <Check className="ml-auto size-4 text-emerald-500" />}
        </DropdownMenuItem>
      ))}
    </>
  );
}

function SoundToggle() {
  const [enabled, setEnabled] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true); // eslint-disable-line react-hooks/set-state-in-effect
    setEnabled(areSoundsEnabled());
  }, []);

  const handleToggle = () => {
    const newState = toggleSounds();
    setEnabled(newState);
    if (newState) {
      soundEffects.toggleOn();
      toast.success('Sounds enabled 🔊');
    } else {
      toast.info('Sounds muted 🔇');
    }
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" className="hidden sm:inline-flex size-7 sm:size-9" onClick={handleToggle} suppressHydrationWarning>
          {mounted && enabled ? <Volume2 className="size-3.5 sm:size-4 text-emerald-600" /> : <VolumeX className="size-3.5 sm:size-4 text-muted-foreground" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{mounted && enabled ? 'Mute sounds' : 'Enable sounds'}</TooltipContent>
    </Tooltip>
  );
}

function Header() {
  const { data: session } = useSession();
  const { currentView, setShowNotifications, setCurrentView, currentRole, selectedSchoolId, setSelectedSchoolId, sidebarOpen, setSidebarOpen, currentUser, setCurrentRole, theme, setTheme: setAppTheme, toggleTheme, mobileSidebarOpen, setMobileSidebarOpen } = useAppStore();
  const { theme: nextTheme, setTheme } = useTheme();
  const title = viewTitles[currentView] || 'Dashboard';
  const titleEmoji = navEmojiMap[currentView] || navEmojiMap[currentView] || '📊';
  const [unreadCount, setUnreadCount] = useState(0);
  const rc = roleConfig[currentRole];

  // Sync theme between next-themes and app store
  useEffect(() => {
    if (theme && nextTheme !== theme) {
      setTheme(theme);
    }
  }, [theme, nextTheme, setTheme]);

  const toggleThemeHandler = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setAppTheme(newTheme);
    setTheme(newTheme);
    soundEffects.toggleOn();
  };

   useEffect(() => {
     async function fetchUnreadCount() {
       try {
         const res = await fetch(`/api/notifications?userId=${currentUser.id}&limit=1`);
         if (res.ok) {
           const json = await res.json();
           const count = json.unreadCount || 0;
           setUnreadCount(count);
           // Removed automatic sound to comply with browser autoplay policies
         }
       } catch (error: unknown) { handleSilentError(error, 'Fetch unread count'); }
     }
     fetchUnreadCount();
     const interval = setInterval(() => {
       if (document.visibilityState === 'visible') {
         fetchUnreadCount();
       }
     }, 60000); // Poll every 60 seconds instead of 30, only when tab is visible
     return () => clearInterval(interval);
   }, [currentUser.id]);

  useEffect(() => {
    if (session?.user) {
      const u = session.user;
      if (u.email && u.name && u.role) {
        useAppStore.getState().setCurrentUser({
          id: u.id, name: u.name, email: u.email, avatar: u.avatar,
          schoolId: u.schoolId || '', schoolName: u.schoolName || 'Skoolar Platform',
          planName: u.planName || 'free',
        });
        setCurrentRole(u.role as UserRole);
      }
    }
  }, [session, setCurrentRole]);

  // Real-time plan check — refresh plan from server so upgrade banner leaves immediately after upgrade
  useEffect(() => {
    const schoolId = currentUser.schoolId;
    if (!schoolId || currentRole === 'SUPER_ADMIN') return;

    const fetchPlan = async () => {
      try {
        const res = await fetch(`/api/schools/${schoolId}`);
        if (res.ok) {
          const school = await res.json();
          if (school.plan && school.plan !== currentUser.planName) {
            useAppStore.setState((state) => ({
              currentUser: { ...state.currentUser, planName: school.plan },
            }));
          }
        }
      } catch {
        // Silently fail — session plan is the fallback
      }
    };
    fetchPlan();
  }, [currentUser.schoolId, currentRole]);

  const displayName = session?.user?.name || currentUser.name;
  const displayInitials = displayName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-0.5 sm:gap-2 lg:gap-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-1.5 sm:px-4 lg:px-6">
      {/* Mobile menu */}
      <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="lg:hidden size-7 sm:size-9" onClick={() => { soundEffects.click(); setMobileSidebarOpen(true); }}>
            <Menu className="size-4 sm:size-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[88vw] max-w-sm p-0 overflow-y-auto" style={{ overscrollBehavior: 'contain' }}>
          <SidebarContent />
        </SheetContent>
      </Sheet>

      {/* Collapse sidebar (desktop) */}
      <Button variant="ghost" size="icon" className="hidden lg:flex size-9" onClick={() => { setSidebarOpen(!sidebarOpen); soundEffects.click(); }}>
        <Menu className="size-5" />
      </Button>

      {/* Title with emoji */}
      <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
        <span className="text-lg hidden sm:inline">{titleEmoji}</span>
        <h2 className="text-base sm:text-lg font-semibold truncate">{title}</h2>
        <Badge variant="outline" className={cn('hidden sm:inline-flex text-[10px] gap-1', rc.bg, rc.color)}>
          <span>{rc.emoji}</span>
          {rc.label}
        </Badge>
      </div>

      <div className="flex-1 min-w-0" />

      {/* School selector (Super Admin) - Desktop */}
      <div className="hidden md:block">
        {currentRole === 'SUPER_ADMIN' && <SchoolSelector />}
      </div>

      {/* Search - Desktop */}
      <Button variant="outline" size="sm" className="hidden lg:flex gap-2 text-muted-foreground w-48 lg:w-64 justify-start" onClick={() => { soundEffects.search(); window.dispatchEvent(new CustomEvent('open-command-palette')); }}>
        <Search className="size-3.5" />
        <span className="text-sm">Search...</span>
        <kbd className="ml-auto pointer-events-none hidden md:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
          ⌘K
        </kbd>
      </Button>

      {/* Mobile: Search and School selector buttons */}
      <div className="flex items-center gap-1 md:hidden">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="size-7 sm:size-9" onClick={() => { soundEffects.search(); window.dispatchEvent(new CustomEvent('open-command-palette')); }}>
              <Search className="size-3.5 sm:size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Search</TooltipContent>
        </Tooltip>
        {currentRole === 'SUPER_ADMIN' && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-7 sm:size-9" onClick={() => soundEffects.click()}>
                <Building2 className="size-3.5 sm:size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <SchoolSelectorMobile />
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Sound toggle */}
      <SoundToggle />

      {/* Theme toggle */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="hidden sm:inline-flex size-7 sm:size-9" onClick={toggleThemeHandler}>
            {theme === 'light' ? <Moon className="size-3.5 sm:size-4" /> : <Sun className="size-3.5 sm:size-4 text-amber-500" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{theme === 'light' ? '🌙 Dark mode' : '☀️ Light mode'}</TooltipContent>
      </Tooltip>

      {/* Live indicator */}
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="hidden sm:flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-1">
            <span className="relative flex size-2">
              <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75" />
              <span className="relative rounded-full size-2 bg-emerald-500" />
            </span>
            <span className="text-[11px] font-medium text-emerald-700">Live</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>Real-time updates active</TooltipContent>
      </Tooltip>

      {/* Notifications */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="relative size-7 sm:size-9" onClick={() => { setShowNotifications(true); soundEffects.click(); }}>
            <span className="relative" data-notification-count={unreadCount}>
              🔔
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground ring-2 ring-background">
                  {unreadCount}
                </span>
              )}
            </span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Notifications{unreadCount > 0 ? ` (${unreadCount} unread)` : ''}</TooltipContent>
      </Tooltip>

      {/* Auth indicator */}
      {session?.user && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="hidden lg:flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-1">
              <span className="text-[11px] font-medium text-emerald-700">
                👋 {session.user.name?.split(' ')[0]}
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent>{session.user.email}</TooltipContent>
        </Tooltip>
      )}

      {/* User */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="gap-2 pl-2" onClick={() => soundEffects.click()}>
            <Avatar className="size-7 ring-2 ring-emerald-100">
              <AvatarFallback className="bg-gradient-to-br from-emerald-100 to-teal-100 text-emerald-700 text-[10px] font-semibold">{displayInitials}</AvatarFallback>
            </Avatar>
            <span className="hidden md:inline text-sm">{displayName.split(' ')[0]}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium">{displayName}</p>
              <p className="text-xs text-muted-foreground">{session?.user?.email || currentUser.email}</p>
              <Badge variant="outline" className={cn('w-fit text-[10px] mt-1 gap-1', rc.bg, rc.color)}>
                <span>{rc.emoji}</span> {rc.label}
              </Badge>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => { setCurrentView('settings'); soundEffects.click(); }}>⚙️ Settings</DropdownMenuItem>
          <DropdownMenuItem onClick={() => { soundEffects.refresh(); toast.success('Data synced ✅'); }}>🔄 Sync Data</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive" onClick={() => { soundEffects.logout(); window.location.href = '/api/auth/signout?callbackUrl=/login'; }}>🚪 Logout</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}

 export function AppShell({ children }: { children: React.ReactNode }) {
    const { sidebarOpen, showNotifications, setShowNotifications, currentRole, selectedSchoolId, currentView, setDisabledFeatures } = useAppStore();
    const [schoolTheme, setSchoolTheme] = useState<string>('default');
    const [hydrated, setHydrated] = useState(false);

   // CRITICAL: Rehydrate the persisted Zustand store AFTER the first client
   // render so the server-rendered HTML matches the client's initial state.
   // Without this, the persisted theme/role/sidebarOpen differ between server
   // and client and React throws a hydration mismatch.
   useEffect(() => {
     useAppStore.persist?.rehydrate?.();
     setHydrated(true);
   }, []);

   // Init audio on mount
   useEffect(() => {
     initAudioOnInteraction();
   }, []);

   // Determine if we should show the advert (only on primary dashboard for non-SUPER_ADMIN)
   const isPrimaryDashboardView = currentRole !== 'SUPER_ADMIN' && currentView === 'overview';

  useEffect(() => {
    if (!selectedSchoolId || currentRole === 'SUPER_ADMIN') return;
    let cancelled = false;
    const fetchSchoolSettings = async () => {
      try {
        const res = await fetch(`/api/schools/${selectedSchoolId}/controls`);
        if (res.ok) {
          const json = await res.json();
          if (!cancelled) {
            if (json.data?.theme) setSchoolTheme(json.data.theme);
            if (json.data?.disabledFeatures) setDisabledFeatures(json.data.disabledFeatures);
          }
        }
      } catch (error: unknown) { handleSilentError(error); /* silent */ }
    };
    fetchSchoolSettings();
    return () => { cancelled = true; };
  }, [selectedSchoolId, currentRole, setDisabledFeatures]);

  // ── Refresh: pull-to-refresh and manual refresh ──
  const refreshCurrentView = useCallback(async () => {
    try {
      const res = await fetch(`/api/analytics${selectedSchoolId ? `?schoolId=${selectedSchoolId}` : ''}`);
      if (res.ok) toast.success('Data refreshed ✅');
    } catch { toast.error('Refresh failed ❌'); }
  }, [selectedSchoolId]);

  const { refreshing: ptrRefreshing, PullToRefreshIndicator } = usePullToRefresh({
    onRefresh: refreshCurrentView,
    threshold: 80,
    disabled: false,
  });

  // ── PWA Native Features ──
  const { setBadge, clearBadge, isStandalone } = usePWANative({
    onBack: () => {
      if (showNotifications) {
        setShowNotifications(false);
      }
    },
  });

  // Update app badge with unread count
  useEffect(() => {
    const unreadEl = document.querySelector('[data-notification-count]');
    if (unreadEl) {
      const count = parseInt(unreadEl.getAttribute('data-notification-count') || '0');
      if (count > 0) setBadge(count);
      else clearBadge();
    }
  }, [setBadge, clearBadge]);

  return (
    <div className={`flex min-h-[100dvh] overflow-hidden bg-muted/30 ${schoolTheme !== 'default' ? `theme-${schoolTheme}` : ''}`}>
      {/* Sidebar - Desktop */}
      <aside className={cn(
        'hidden lg:flex flex-col border-r bg-card transition-all duration-300 relative',
        sidebarOpen ? 'w-64' : 'w-[68px]'
      )}>
        <SidebarContent />
      </aside>

       {/* Main content */}
       <div className="flex flex-1 flex-col overflow-hidden relative min-w-0">
         <div className="absolute inset-0 bg-mesh-bg opacity-30 pointer-events-none" />
         <AnnouncementTicker />
         <Header />
          <ScrollArea className="flex-1 bg-white/20 backdrop-blur-3xl relative z-10 momentum-scroll">
            <main className="relative p-3 sm:p-4 lg:p-8 min-w-0 has-bottom-nav">
              {PullToRefreshIndicator}
              {ptrRefreshing && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm">
                  <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
                    <div className="pull-to-refresh-indicator">
                      <div className="spinner" />
                      Refreshing...
                    </div>
                  </div>
                </div>
              )}
              {/* Show AdvertCarousel only on primary dashboard view for non-SUPER_ADMIN */}
              {currentRole !== 'SUPER_ADMIN' && isPrimaryDashboardView && (
                <AdvertCarousel />
              )}
              <AnimatePresence mode="wait">
                <motion.div
                  key={useAppStore.getState().currentView}
                  initial={{ opacity: 0, y: 10, filter: 'blur(10px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: -10, filter: 'blur(10px)' }}
                  transition={{ duration: 0.3, ease: "circOut" }}
                >
                  <ResponsiveCanvas viewId={useAppStore.getState().currentView}>
                    {children}
                  </ResponsiveCanvas>
                </motion.div>
              </AnimatePresence>
            </main>
         </ScrollArea>
       </div>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav />

      {/* Notifications overlay */}
      {showNotifications && (
        <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm" onClick={() => { setShowNotifications(false); soundEffects.modalClose(); }} />
      )}
      <NotificationsPanel />
      <CommandPalette />
    </div>
  );
}
