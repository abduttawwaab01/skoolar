'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppStore } from '@/store/app-store';
import { RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

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
  const { selectedSchoolId } = useAppStore();
  const [records, setRecords] = useState<BorrowRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRecords = useCallback(async () => {
    if (!selectedSchoolId) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/library/borrow?schoolId=${selectedSchoolId}&limit=200`);
      if (!res.ok) throw new Error('Failed to load borrow records');
      const json = await res.json();
      setRecords(json.data || []);
    } catch (err) {
      toast.error('Failed to load borrow records');
    } finally {
      setLoading(false);
    }
  }, [selectedSchoolId]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

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

  const columns: ColumnDef<BorrowRow>[] = [
    { accessorKey: 'student', header: 'Student' },
    { accessorKey: 'book', header: 'Book' },
    { accessorKey: 'borrowDate', header: 'Borrow Date' },
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
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => handleReturn(row.original.id)}>
            <RotateCcw className="size-3.5" />
            Return
          </Button>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Borrow Records</h2>
        <p className="text-sm text-muted-foreground">Track book borrowing and returns</p>
      </div>

      {loading ? (
        <TableSkeleton />
      ) : (
        <DataTable columns={columns} data={tableData} searchKey="student" searchPlaceholder="Search student..." />
      )}
    </div>
  );
}
