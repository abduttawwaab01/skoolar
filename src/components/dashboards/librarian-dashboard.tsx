'use client';

import { useState, useEffect, useMemo } from 'react';
import { KpiCard } from '@/components/shared/kpi-card';
import { StatusBadge } from '@/components/shared/status-badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';
import {
  BookOpen, BookCheck, BookX, AlertTriangle, ArrowRight,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

const CATEGORY_COLORS = ['#059669', '#7C3AED', '#DC2626', '#0891B2', '#D97706', '#EC4899', '#6366F1'];

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
      <Skeleton className="h-72 rounded-xl" />
    </div>
  );
}

interface BookRecord {
  id: string;
  title: string;
  author: string | null;
  category: string | null;
  totalCopies: number;
  availableCopies: number;
  _count?: { borrowRecords: number };
}

interface BorrowRecord {
  id: string;
  bookId: string;
  studentId: string;
  borrowDate: string;
  dueDate: string;
  returnDate: string | null;
  status: string;
  fine: number | null;
  book?: {
    id: string;
    title: string;
    author: string | null;
    isbn: string | null;
    category: string | null;
    coverImage: string | null;
  };
  student?: {
    id: string;
    admissionNo: string;
    user: { name: string | null; email: string | null };
    class: { name: string; section: string | null } | null;
  };
}

export function LibrarianDashboard() {
  const { setCurrentView, selectedSchoolId } = useAppStore();
  const [books, setBooks] = useState<BookRecord[]>([]);
  const [borrowRecords, setBorrowRecords] = useState<BorrowRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!selectedSchoolId) return;
      try {
        setLoading(true);
        const [booksRes, borrowsRes] = await Promise.all([
          fetch(`/api/library/books?schoolId=${selectedSchoolId}&limit=200`),
          fetch(`/api/library/borrow?schoolId=${selectedSchoolId}&limit=200`),
        ]);
        if (!booksRes.ok) throw new Error('Failed to load books');
        if (!borrowsRes.ok) throw new Error('Failed to load borrow records');
        const booksJson = await booksRes.json();
        const borrowsJson = await borrowsRes.json();
        setBooks(booksJson.data || []);
        setBorrowRecords(borrowsJson.data || []);
      } catch (err) {
        toast.error('Failed to load library data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [selectedSchoolId]);

  // Stats
  const stats = useMemo(() => {
    const totalBooks = books.reduce((sum, b) => sum + (b.totalCopies || 0), 0);
    const available = books.reduce((sum, b) => sum + (b.availableCopies || 0), 0);
    const borrowed = borrowRecords.filter(b => b.status === 'borrowed').length;
    const overdue = borrowRecords.filter(b => {
      if (b.status !== 'borrowed') return false;
      return new Date(b.dueDate) < new Date();
    }).length;
    return { totalBooks, available, borrowed, overdue };
  }, [books, borrowRecords]);

  // Books by category
  const categories = useMemo(() => {
    const catMap = new Map<string, number>();
    books.forEach(b => {
      const cat = b.category || 'Uncategorized';
      catMap.set(cat, (catMap.get(cat) || 0) + (b.totalCopies || 0));
    });
    return Array.from(catMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 7);
  }, [books]);

  // Recent borrows
  const recentBorrows = useMemo(() => {
    return borrowRecords.slice(0, 6).map(b => ({
      id: b.id,
      book: b.book?.title || 'Unknown',
      student: b.student?.user?.name || 'Unknown',
      dueDate: b.dueDate ? new Date(b.dueDate).toLocaleDateString() : 'N/A',
      status: b.status === 'overdue' || (b.status === 'borrowed' && new Date(b.dueDate) < new Date()) ? 'overdue' : b.status,
    }));
  }, [borrowRecords]);

  // Overdue alerts
  const overdueAlerts = useMemo(() => {
    return borrowRecords
      .filter(b => b.status === 'borrowed' && new Date(b.dueDate) < new Date())
      .map(b => {
        const daysOverdue = Math.ceil((new Date().getTime() - new Date(b.dueDate).getTime()) / (1000 * 60 * 60 * 24));
        return {
          student: b.student?.user?.name || 'Unknown',
          book: b.book?.title || 'Unknown',
          due: new Date(b.dueDate).toISOString().split('T')[0],
          days: daysOverdue,
        };
      });
  }, [borrowRecords]);

  if (loading) return <DashboardSkeleton />;

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <KpiCard title="Total Books" value={stats.totalBooks.toLocaleString()} icon={BookOpen} iconBgColor="bg-emerald-100" iconColor="text-emerald-600" changeLabel="in library" />
        <KpiCard title="Available" value={stats.available.toLocaleString()} icon={BookCheck} iconBgColor="bg-blue-100" iconColor="text-blue-600" />
        <KpiCard title="Borrowed" value={stats.borrowed.toLocaleString()} icon={BookX} iconBgColor="bg-amber-100" iconColor="text-amber-600" />
        <KpiCard title="Overdue" value={stats.overdue.toLocaleString()} icon={AlertTriangle} iconBgColor="bg-red-100" iconColor="text-red-600" change={stats.overdue > 0 ? Math.round((stats.overdue / stats.borrowed) * 100) : 0} changeLabel="need attention" />
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Books by Category */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Books by Category</CardTitle>
            <CardDescription>Distribution across categories</CardDescription>
          </CardHeader>
          <CardContent>
            {categories.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={categories} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} width={70} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))' }} />
                  <Bar dataKey="count" name="Books" radius={[0, 4, 4, 0]}>
                    {categories.map((_, i) => (
                      <Bar key={i} dataKey="count" fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} radius={[0, 4, 4, 0]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[280px] text-sm text-muted-foreground">No category data yet</div>
            )}
          </CardContent>
        </Card>

        {/* Recent Borrows */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Recent Borrows</CardTitle>
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => setCurrentView('borrow-records')}>View all</Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentBorrows.length > 0 ? recentBorrows.map(borrow => (
                <div key={borrow.id} className="flex items-center gap-3 rounded-lg border p-3">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-blue-100 text-blue-600 shrink-0">
                    <BookOpen className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{borrow.book}</p>
                    <p className="text-xs text-muted-foreground">{borrow.student} · Due {borrow.dueDate}</p>
                  </div>
                  <StatusBadge variant={borrow.status === 'borrowed' ? 'info' : 'error'} size="sm">
                    {borrow.status}
                  </StatusBadge>
                </div>
              )) : (
                <div className="text-sm text-muted-foreground text-center py-6">No borrow records yet</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Overdue Alerts */}
      <Card className="border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-red-600" />
            <CardTitle className="text-base text-red-700 dark:text-red-400">Overdue Alerts</CardTitle>
          </div>
          <CardDescription>These books are overdue and need immediate attention</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {overdueAlerts.length > 0 ? overdueAlerts.map((item, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border border-red-200 dark:border-red-800 bg-white dark:bg-red-950/30 p-3">
                <div>
                  <p className="text-sm font-medium">{item.student}</p>
                  <p className="text-xs text-muted-foreground">{item.book} · Due {item.due}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-red-600">{item.days} days</p>
                  <p className="text-[10px] text-red-500">overdue</p>
                </div>
              </div>
            )) : (
              <div className="text-sm text-muted-foreground text-center py-4">No overdue books</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
