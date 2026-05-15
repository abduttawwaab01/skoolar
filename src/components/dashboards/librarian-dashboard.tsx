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
  TrendingUp, BarChart3, Users, Star, History
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, PieChart, Pie
} from 'recharts';

const CATEGORY_COLORS = ['#059669', '#7C3AED', '#DC2626', '#0891B2', '#D97706', '#EC4899', '#6366F1'];

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
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
          fetch(`/api/library/books?schoolId=${selectedSchoolId}&limit=500`),
          fetch(`/api/library/borrow?schoolId=${selectedSchoolId}&limit=500`),
        ]);
        if (!booksRes.ok || !borrowsRes.ok) throw new Error('Failed to load library data');
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

  // Most Borrowed Books
  const mostBorrowed = useMemo(() => {
    return books
      .map(b => ({
        name: b.title.length > 20 ? b.title.slice(0, 20) + '...' : b.title,
        count: b._count?.borrowRecords || 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [books]);

  // Books by category
  const categories = useMemo(() => {
    const catMap = new Map<string, number>();
    books.forEach(b => {
      const cat = b.category || 'General';
      catMap.set(cat, (catMap.get(cat) || 0) + (b.totalCopies || 0));
    });
    return Array.from(catMap.entries())
      .map(([name, count]) => ({ name, value: count }))
      .sort((a, b) => b.value - a.value);
  }, [books]);

  // Recent activity
  const recentActivity = useMemo(() => {
    return borrowRecords.slice(0, 5).map(b => ({
      id: b.id,
      student: b.student?.user?.name || 'Unknown',
      book: b.book?.title || 'Unknown',
      date: new Date(b.borrowDate).toLocaleDateString(),
      status: b.status,
    }));
  }, [borrowRecords]);

  if (loading) return <DashboardSkeleton />;

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <KpiCard title="Total Inventory" value={stats.totalBooks.toLocaleString()} icon={BookOpen} iconBgColor="bg-blue-100" iconColor="text-blue-600" changeLabel="books in total" />
        <KpiCard title="On Shelf" value={stats.available.toLocaleString()} icon={BookCheck} iconBgColor="bg-emerald-100" iconColor="text-emerald-600" />
        <KpiCard title="Issued" value={stats.borrowed.toLocaleString()} icon={History} iconBgColor="bg-amber-100" iconColor="text-amber-600" />
        <KpiCard title="Overdue" value={stats.overdue.toLocaleString()} icon={AlertTriangle} iconBgColor="bg-red-100" iconColor="text-red-600" change={stats.overdue > 0 ? Math.round((stats.overdue / stats.borrowed) * 100) : 0} changeLabel="needs attention" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Most Borrowed Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Star className="size-4 text-amber-500 fill-amber-500" />
              Most Borrowed Books
            </CardTitle>
            <CardDescription>Popular titles by borrow frequency</CardDescription>
          </CardHeader>
          <CardContent>
            {mostBorrowed.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={mostBorrowed} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-muted" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} width={120} />
                  <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: 8 }} />
                  <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">No borrow data yet</div>
            )}
          </CardContent>
        </Card>

        {/* Category Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Category Mix</CardTitle>
            <CardDescription>Inventory breakdown</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={categories}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {categories.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-2">
              {categories.slice(0, 4).map((cat, i) => (
                <div key={cat.name} className="flex items-center gap-2">
                  <div className="size-2 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }} />
                  <span className="text-xs text-muted-foreground truncate max-w-[80px]">{cat.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <History className="size-4 text-blue-500" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.length > 0 ? recentActivity.map((act) => (
                <div key={act.id} className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0">
                  <div className="space-y-1">
                    <p className="text-sm font-medium leading-none">{act.student}</p>
                    <p className="text-xs text-muted-foreground">Borrowed "{act.book}"</p>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="text-xs font-medium">{act.date}</p>
                    <StatusBadge variant={act.status === 'borrowed' ? 'info' : 'success'} size="sm">
                      {act.status}
                    </StatusBadge>
                  </div>
                </div>
              )) : (
                <div className="py-8 text-center text-sm text-muted-foreground">No recent activity</div>
              )}
            </div>
            <Button variant="ghost" className="w-full mt-4 text-xs" onClick={() => setCurrentView('borrow-records')}>
              View All Records <ArrowRight className="size-3 ml-1" />
            </Button>
          </CardContent>
        </Card>

        {/* Overdue Warnings */}
        <Card className="border-red-100 bg-red-50/20">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-red-700">
              <AlertTriangle className="size-4" />
              Critical Overdue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {borrowRecords.filter(b => b.status === 'borrowed' && new Date(b.dueDate) < new Date()).slice(0, 4).map(over => (
                <div key={over.id} className="flex items-center gap-3 rounded-lg border border-red-100 bg-white p-3">
                  <div className="size-8 rounded-full bg-red-100 flex items-center justify-center text-red-600 shrink-0">
                    <Users className="size-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{over.student?.user?.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{over.book?.title}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-red-600">
                      {Math.ceil((new Date().getTime() - new Date(over.dueDate).getTime()) / (1000 * 60 * 60 * 24))} days
                    </p>
                    <p className="text-[9px] text-red-400">Late</p>
                  </div>
                </div>
              ))}
              {stats.overdue === 0 && (
                <div className="py-8 text-center text-sm text-muted-foreground italic">
                  All books returned on time!
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
