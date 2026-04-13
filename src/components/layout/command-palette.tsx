'use client';

import { useState, useEffect, useCallback } from 'react';
import { CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem, CommandSeparator } from '@/components/ui/command';
import { useAppStore } from '@/store/app-store';
import { useRouter } from 'next/navigation';
import {
  LayoutDashboard, Users, GraduationCap, BookOpen, Calendar, FileText,
  BarChart3, Settings, Bell, MessageSquare, Wallet, Library, ScanLine,
  Award, TrendingUp, Megaphone, Shield, Palette, CreditCard, Receipt,
  Target, Sparkles, Repeat, GitCompare, FileBarChart, Building2, KeyRound,
  Activity, UserRound, BookText, IdCard, CalendarCheck, FileEdit,
} from 'lucide-react';

const iconMap: Record<string, React.ElementType> = {
  'layout-dashboard': LayoutDashboard, 'building-2': Building2, 'key-round': KeyRound,
  'bar-chart-3': BarChart3, 'activity': Activity, 'file-text': FileText,
  'bell': Bell, 'settings': Settings, 'graduation-cap': GraduationCap,
  'users': Users, 'calendar-check': CalendarCheck, 'file-edit': FileEdit,
  'file-bar-chart': FileBarChart, 'award': Award, 'wallet': Wallet,
  'credit-card': CreditCard, 'receipt': Receipt, 'id-card': IdCard,
  'megaphone': Megaphone, 'calendar': Calendar, 'message-square': MessageSquare,
  'mail': MessageSquare, 'building': Building2, 'palette': Palette,
  'chalkboard-teacher': BookUser, 'user-graduate': UserRound,
  'book-open': BookOpen, 'book-text': BookText, 'sparkles': Sparkles,
  'trending-up': TrendingUp, 'trophy': Award, 'repeat': Repeat,
  'scan-line': ScanLine, 'library': Library, 'target': Target,
  'shield': Shield, 'arrow-up-circle': TrendingUp, 'git-compare': GitCompare,
};

function BookUser({ className }: { className?: string }) {
  return <GraduationCap className={className} />;
}

interface NavItem {
  id: string;
  label: string;
  icon: string;
  category?: string;
}

const navItemsByRole: Record<string, NavItem[]> = {
  SUPER_ADMIN: [
    { id: 'overview', label: 'Dashboard', icon: 'layout-dashboard', category: 'Navigation' },
    { id: 'schools', label: 'Schools', icon: 'building-2', category: 'Management' },
    { id: 'registration-codes', label: 'Registration Codes', icon: 'key-round', category: 'Management' },
    { id: 'admin-analytics-advanced', label: 'Analytics', icon: 'bar-chart-3', category: 'Analytics' },
    { id: 'system-health', label: 'System Health', icon: 'activity', category: 'System' },
    { id: 'audit-logs', label: 'Audit Logs', icon: 'file-text', category: 'System' },
    { id: 'overlay-management', label: 'Overlay Manager', icon: 'palette', category: 'Platform' },
    { id: 'plans-manager', label: 'Plan Manager', icon: 'credit-card', category: 'Platform' },
    { id: 'danger-zone', label: 'Danger Zone', icon: 'shield', category: 'System' },
    { id: 'settings', label: 'Settings', icon: 'settings', category: 'System' },
  ],
  SCHOOL_ADMIN: [
    { id: 'overview', label: 'Dashboard', icon: 'layout-dashboard', category: 'Navigation' },
    { id: 'students', label: 'Students', icon: 'users', category: 'People' },
    { id: 'teachers', label: 'Teachers', icon: 'graduation-cap', category: 'People' },
    { id: 'parents', label: 'Parents', icon: 'user-graduate', category: 'People' },
    { id: 'classes', label: 'Classes', icon: 'building-2', category: 'Academics' },
    { id: 'subjects', label: 'Subjects', icon: 'book-open', category: 'Academics' },
    { id: 'attendance', label: 'Attendance', icon: 'calendar-check', category: 'Tracking' },
    { id: 'staff-attendance', label: 'Staff Attendance', icon: 'calendar-check', category: 'Tracking' },
    { id: 'exams', label: 'Exams', icon: 'file-edit', category: 'Academics' },
    { id: 'results', label: 'Results', icon: 'file-bar-chart', category: 'Academics' },
    { id: 'report-cards', label: 'Report Cards', icon: 'award', category: 'Academics' },
    { id: 'finance', label: 'Finance', icon: 'wallet', category: 'Finance' },
    { id: 'payments', label: 'Payments', icon: 'credit-card', category: 'Finance' },
    { id: 'homework', label: 'Homework', icon: 'book-text', category: 'Academics' },
    { id: 'video-lessons', label: 'Video Lessons', icon: 'sparkles', category: 'Academics' },
    { id: 'id-cards', label: 'ID Cards', icon: 'id-card', category: 'Tools' },
    { id: 'in-app-chat', label: 'Messaging', icon: 'message-square', category: 'Communication' },
    { id: 'announcements', label: 'Announcements', icon: 'megaphone', category: 'Communication' },
    { id: 'school-calendar-enhanced', label: 'Calendar', icon: 'calendar', category: 'Communication' },
    { id: 'school-profile', label: 'School Profile', icon: 'building-2', category: 'Settings' },
    { id: 'branding', label: 'Branding', icon: 'palette', category: 'Settings' },
    { id: 'school-settings', label: 'School Settings', icon: 'settings', category: 'Settings' },
    { id: 'settings', label: 'Settings', icon: 'settings', category: 'Settings' },
  ],
  TEACHER: [
    { id: 'overview', label: 'Dashboard', icon: 'layout-dashboard', category: 'Navigation' },
    { id: 'attendance', label: 'Attendance', icon: 'calendar-check', category: 'Tracking' },
    { id: 'homework', label: 'Homework', icon: 'book-text', category: 'Academics' },
    { id: 'exams', label: 'Exams', icon: 'file-edit', category: 'Academics' },
    { id: 'teacher-grades', label: 'Grade Students', icon: 'award', category: 'Academics' },
    { id: 'video-lessons', label: 'Video Lessons', icon: 'sparkles', category: 'Academics' },
    { id: 'in-app-chat', label: 'Messages', icon: 'message-square', category: 'Communication' },
    { id: 'announcements', label: 'Announcements', icon: 'megaphone', category: 'Communication' },
  ],
  STUDENT: [
    { id: 'overview', label: 'Dashboard', icon: 'layout-dashboard', category: 'Navigation' },
    { id: 'results', label: 'My Results', icon: 'file-bar-chart', category: 'Academics' },
    { id: 'report-cards', label: 'Report Cards', icon: 'award', category: 'Academics' },
    { id: 'attendance', label: 'Attendance', icon: 'calendar-check', category: 'Tracking' },
    { id: 'homework', label: 'Homework', icon: 'book-text', category: 'Academics' },
    { id: 'student-exams', label: 'Take Exam', icon: 'file-edit', category: 'Academics' },
    { id: 'video-lessons', label: 'Video Lessons', icon: 'sparkles', category: 'Academics' },
    { id: 'in-app-chat', label: 'Messages', icon: 'message-square', category: 'Communication' },
  ],
  PARENT: [
    { id: 'overview', label: 'Dashboard', icon: 'layout-dashboard', category: 'Navigation' },
    { id: 'parent-children', label: 'My Children', icon: 'users', category: 'Children' },
    { id: 'parent-results', label: 'Child Results', icon: 'file-bar-chart', category: 'Academics' },
    { id: 'report-cards', label: 'Report Cards', icon: 'award', category: 'Academics' },
    { id: 'parent-attendance', label: 'Attendance', icon: 'calendar-check', category: 'Tracking' },
    { id: 'parent-homework', label: 'Child Homework', icon: 'book-text', category: 'Academics' },
    { id: 'parent-finance', label: 'Fee Payments', icon: 'credit-card', category: 'Finance' },
    { id: 'in-app-chat', label: 'Messages', icon: 'message-square', category: 'Communication' },
  ],
  ACCOUNTANT: [
    { id: 'overview', label: 'Dashboard', icon: 'layout-dashboard', category: 'Navigation' },
    { id: 'payments', label: 'Payments', icon: 'credit-card', category: 'Finance' },
    { id: 'fee-structure', label: 'Fee Structure', icon: 'receipt', category: 'Finance' },
    { id: 'analytics', label: 'Financial Reports', icon: 'bar-chart-3', category: 'Analytics' },
  ],
  LIBRARIAN: [
    { id: 'overview', label: 'Dashboard', icon: 'layout-dashboard', category: 'Navigation' },
    { id: 'books', label: 'Books', icon: 'library', category: 'Library' },
    { id: 'borrow-records', label: 'Borrow Records', icon: 'book-open', category: 'Library' },
    { id: 'id-scanner', label: 'ID Scanner', icon: 'scan-line', category: 'Tools' },
  ],
  DIRECTOR: [
    { id: 'overview', label: 'Dashboard', icon: 'layout-dashboard', category: 'Navigation' },
    { id: 'analytics', label: 'Analytics', icon: 'bar-chart-3', category: 'Analytics' },
    { id: 'reports', label: 'Reports', icon: 'file-text', category: 'Reports' },
    { id: 'announcements', label: 'Announcements', icon: 'megaphone', category: 'Communication' },
  ],
};

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const { currentRole, setCurrentView } = useAppStore();
  const router = useRouter();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    const openPalette = () => setOpen(true);
    document.addEventListener('keydown', down);
    window.addEventListener('open-command-palette', openPalette);
    return () => {
      document.removeEventListener('keydown', down);
      window.removeEventListener('open-command-palette', openPalette);
    };
  }, []);

  const handleSelect = useCallback((viewId: string) => {
    setCurrentView(viewId as any);
    setOpen(false);
    router.push('/dashboard');
  }, [setCurrentView, router]);

  const items = navItemsByRole[currentRole] || navItemsByRole.SCHOOL_ADMIN;
  const grouped = items.reduce<Record<string, NavItem[]>>((acc, item) => {
    const cat = item.category || 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  return (
    <CommandDialog open={open} onOpenChange={setOpen} title="Command Palette" description="Search and navigate quickly">
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        {Object.entries(grouped).map(([category, catItems]) => (
          <div key={category}>
            <CommandGroup heading={category}>
              {catItems.map((item) => {
                const Icon = iconMap[item.icon] || LayoutDashboard;
                return (
                  <CommandItem key={item.id} onSelect={() => handleSelect(item.id)}>
                    <Icon className="h-4 w-4 mr-2" />
                    <span>{item.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            <CommandSeparator />
          </div>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
