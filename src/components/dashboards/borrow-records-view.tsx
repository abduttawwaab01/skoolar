'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppStore } from '@/store/app-store';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Plus, RotateCcw, Search, BookOpen, User, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

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
  };
  student?: {
    id: string;
    admissionNo: string;
    user: { name: string | null; email: string | null };
  };
}

type BorrowRow = {
  id: string;
  student: string;
  book: string;
  borrowDate: string;
  dueDate: string;
  status: string;
  fine: number;
};

function TableSkeleton() {
  return <Skeleton className="h-[400px] rounded-xl" />;
}

export function BorrowRecordsView() {
  const { currentUser, selectedSchoolId } = useAppStore();
  const schoolId = currentUser.schoolId || selectedSchoolId || '';
  const [records, setRecords] = useState<BorrowRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('');

  // Search states
  const [studentSearch, setStudentSearch] = useState('');
  const [foundStudents, setFoundStudents] = useState<any[]>([]);
  const [bookSearch, setBookSearch] = useState('');
  const [foundBooks, setFoundBooks] = useState<any[]>([]);
  const [mounted, setMounted] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    studentId: '',
    bookId: '',
    dueDate: '',
    remarks: '',
  });

  useEffect(() => {
    setFormData(prev => ({ ...prev, dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] }));
    setMounted(true);
  }, []);

  const fetchRecords = useCallback(async () => {
    if (!schoolId || !statusFilter) return;
    try {
      setLoading(true);
      const statusParam = statusFilter !== 'All' ? `&status=${statusFilter.toLowerCase()}` : '';
      const res = await fetch(`/api/library/borrow?schoolId=${schoolId}&limit=500${statusParam}`);
      if (!res.ok) throw new Error('Failed to load borrow records');
      const json = await res.json();
      setRecords(json.data || []);
    } catch (err) {
      toast.error('Failed to load borrow records');
    } finally {
      setLoading(false);
    }
  }, [schoolId, statusFilter]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // Search logic
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (studentSearch.length > 1) {
        const res = await fetch(`/api/students?schoolId=${schoolId}&search=${studentSearch}&limit=5`);
        if (res.ok) {
          const json = await res.json();
          setFoundStudents(json.data || []);
        }
      } else {
        setFoundStudents([]);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [studentSearch, schoolId]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (bookSearch.length > 1) {
        const res = await fetch(`/api/library/books?schoolId=${schoolId}&search=${bookSearch}&available=true&limit=5`);
        if (res.ok) {
          const json = await res.json();
          setFoundBooks(json.data || []);
        }
      } else {
        setFoundBooks([]);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [bookSearch, schoolId]);

  const handleSubmit = async () => {
    if (!formData.studentId || !formData.bookId || !formData.dueDate) {
      toast.error('Please select a student, a book, and a due date');
      return;
    }
    try {
      setSubmitting(true);
      const res = await fetch('/api/library/borrow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId,
          ...formData,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to borrow book');
      }
      toast.success('Book borrowed successfully');
      setOpen(false);
      setFormData({ studentId: '', bookId: '', dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], remarks: '' });
      setStudentSearch('');
      setBookSearch('');
      fetchRecords();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to borrow book');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReturn = async (recordId: string) => {
    try {
      const res = await fetch('/api/library/borrow', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: recordId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to return book');
      }
      toast.success('Book returned successfully');
      fetchRecords();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to return book');
    }
  };

  const tableData = useMemo((): BorrowRow[] => {
    return records.map(r => ({
      id: r.id,
      student: r.student?.user?.name || r.student?.admissionNo || 'Unknown',
      book: r.book?.title || 'Unknown',
      borrowDate: r.borrowDate ? new Date(r.borrowDate).toLocaleDateString() : 'N/A',
      dueDate: r.dueDate ? new Date(r.dueDate).toLocaleDateString() : 'N/A',
      status: r.status === 'borrowed' && new Date(r.dueDate) < new Date() ? 'overdue' : r.status,
      fine: r.fine || 0,
    }));
  }, [records]);

  const columns: ColumnDef<BorrowRow>[] = [
    { accessorKey: 'student', header: 'Student' },
    { accessorKey: 'book', header: 'Book' },
    { accessorKey: 'borrowDate', header: 'Borrowed' },
    { accessorKey: 'dueDate', header: 'Due Date' },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const s = row.getValue<string>('status');
        const variant = s === 'borrowed' ? 'info' : s === 'overdue' ? 'error' : 'success';
        return <StatusBadge variant={variant} size="sm">{s}</StatusBadge>;
      },
    },
    {
      accessorKey: 'fine',
      header: 'Fine',
      cell: ({ row }) => {
        const fine = row.getValue<number>('fine');
        return fine > 0 ? <span className="text-red-600 font-medium">₦{fine.toLocaleString()}</span> : <span className="text-muted-foreground">—</span>;
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const status = row.original.status;
        if (status === 'returned') return null;
        return (
          <Button size="sm" variant="outline" className="gap-1.5 h-8" onClick={() => handleReturn(row.original.id)}>
            <RotateCcw className="size-3.5" />
            Return
          </Button>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold">Borrowing & Returns</h2>
          <p className="text-sm text-muted-foreground">Manage book issuing and overdue tracking</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="size-4 mr-2" />Issue Book</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[450px]">
            <DialogHeader>
              <DialogTitle>Issue Book to Student</DialogTitle>
              <DialogDescription>Search for a student and a book to issue.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              {/* Student Search */}
              <div className="space-y-2">
                <Label>Student</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search name or admission no..." 
                    className="pl-9" 
                    value={studentSearch} 
                    onChange={e => setStudentSearch(e.target.value)} 
                  />
                </div>
                {foundStudents.length > 0 && (
                  <div className="border rounded-md mt-1 divide-y bg-white shadow-sm max-h-32 overflow-y-auto">
                    {foundStudents.map(s => (
                      <div 
                        key={s.id} 
                        className={cn(
                          "p-2 hover:bg-blue-50 cursor-pointer text-sm flex items-center justify-between",
                          formData.studentId === s.id && "bg-blue-50"
                        )}
                        onClick={() => {
                          setFormData(f => ({ ...f, studentId: s.id }));
                          setStudentSearch(s.user.name);
                          setFoundStudents([]);
                        }}
                      >
                        <div>
                          <p className="font-medium">{s.user.name}</p>
                          <p className="text-[10px] text-muted-foreground">{s.admissionNo} • {s.class?.name || 'No Class'}</p>
                        </div>
                        {formData.studentId === s.id && <User className="size-4 text-blue-600" />}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Book Search */}
              <div className="space-y-2">
                <Label>Book</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search book title or author..." 
                    className="pl-9" 
                    value={bookSearch} 
                    onChange={e => setBookSearch(e.target.value)} 
                  />
                </div>
                {foundBooks.length > 0 && (
                  <div className="border rounded-md mt-1 divide-y bg-white shadow-sm max-h-32 overflow-y-auto">
                    {foundBooks.map(b => (
                      <div 
                        key={b.id} 
                        className={cn(
                          "p-2 hover:bg-blue-50 cursor-pointer text-sm flex items-center justify-between",
                          formData.bookId === b.id && "bg-blue-50"
                        )}
                        onClick={() => {
                          setFormData(f => ({ ...f, bookId: b.id }));
                          setBookSearch(b.title);
                          setFoundBooks([]);
                        }}
                      >
                        <div>
                          <p className="font-medium">{b.title}</p>
                          <p className="text-[10px] text-muted-foreground">{b.author || 'Unknown'} • {b.availableCopies} available</p>
                        </div>
                        {formData.bookId === b.id && <BookOpen className="size-4 text-blue-600" />}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1"><Calendar className="size-3" /> Due Date</Label>
                  <Input type="date" value={formData.dueDate} onChange={e => setFormData(f => ({ ...f, dueDate: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Remarks</Label>
                  <Input placeholder="Optional..." value={formData.remarks} onChange={e => setFormData(f => ({ ...f, remarks: e.target.value }))} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={submitting}>{submitting ? 'Issuing...' : 'Issue Book'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filter Buttons */}
      <div className="flex gap-2 flex-wrap">
        {['All', 'Borrowed', 'Overdue', 'Returned'].map(filter => (
          <Button
            key={filter}
            variant={statusFilter === filter ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter(filter)}
            className={cn(statusFilter === filter && 'pointer-events-none')}
          >
            {filter}
          </Button>
        ))}
      </div>

      {!statusFilter ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <BookOpen className="size-12 opacity-30 mb-3" />
          <p className="text-lg font-medium">Select a status to view borrow records</p>
          <p className="text-sm">Choose from All, Borrowed, Overdue, or Returned above</p>
        </div>
      ) : loading ? (
        <TableSkeleton />
      ) : (
        <DataTable columns={columns} data={tableData} searchKey="student" searchPlaceholder="Search by student name..." />
      )}
    </div>
  );
}
