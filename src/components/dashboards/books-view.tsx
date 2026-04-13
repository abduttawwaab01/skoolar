'use client';

import * as React from 'react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/shared/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppStore } from '@/store/app-store';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface Book {
  id: string;
  title: string;
  author: string | null;
  isbn: string | null;
  category: string | null;
  totalCopies: number;
  availableCopies: number;
}

type BookRow = Book & { available: number };

function TableSkeleton() {
  return <Skeleton className="h-[400px] rounded-xl" />;
}

export function BooksView() {
  const { selectedSchoolId } = useAppStore();
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  const [formData, setFormData] = React.useState({
    title: '',
    author: '',
    isbn: '',
    category: '',
    totalCopies: '',
  });

  const fetchBooks = useCallback(async () => {
    if (!selectedSchoolId) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/library/books?schoolId=${selectedSchoolId}&limit=200`);
      if (!res.ok) throw new Error('Failed to load books');
      const json = await res.json();
      setBooks(json.data || []);
    } catch (err) {
      toast.error('Failed to load books');
    } finally {
      setLoading(false);
    }
  }, [selectedSchoolId]);

  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

  const tableData = useMemo((): BookRow[] => {
    return books.map(b => ({
      ...b,
      available: b.availableCopies,
    }));
  }, [books]);

  const columns: ColumnDef<BookRow>[] = [
    { accessorKey: 'title', header: 'Title' },
    { accessorKey: 'author', header: 'Author' },
    { accessorKey: 'category', header: 'Category' },
    { accessorKey: 'totalCopies', header: 'Total Copies' },
    { accessorKey: 'available', header: 'Available' },
  ];

  const handleSubmit = async () => {
    if (!formData.title) {
      toast.error('Please enter a book title');
      return;
    }
    if (!selectedSchoolId) return;
    try {
      setSubmitting(true);
      const res = await fetch('/api/library/books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: selectedSchoolId,
          title: formData.title,
          author: formData.author || null,
          isbn: formData.isbn || null,
          category: formData.category || null,
          totalCopies: parseInt(formData.totalCopies) || 1,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to add book');
      }
      toast.success('Book added successfully');
      setOpen(false);
      setFormData({ title: '', author: '', isbn: '', category: '', totalCopies: '' });
      fetchBooks();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add book');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Book Management</h2>
          <p className="text-sm text-muted-foreground">Manage library book inventory</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="size-4 mr-2" />Add Book</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Book</DialogTitle>
              <DialogDescription>Add a new book to the library catalog.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input placeholder="Enter book title" value={formData.title} onChange={e => setFormData(f => ({ ...f, title: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Author</Label>
                <Input placeholder="Enter author name" value={formData.author} onChange={e => setFormData(f => ({ ...f, author: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>ISBN</Label>
                <Input placeholder="978-XXXXXXXXXX" value={formData.isbn} onChange={e => setFormData(f => ({ ...f, isbn: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={formData.category} onValueChange={v => setFormData(f => ({ ...f, category: v }))}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="textbooks">Textbooks</SelectItem>
                    <SelectItem value="novels">Novels</SelectItem>
                    <SelectItem value="science">Science</SelectItem>
                    <SelectItem value="history">History</SelectItem>
                    <SelectItem value="arts">Arts</SelectItem>
                    <SelectItem value="reference">Reference</SelectItem>
                    <SelectItem value="digital">Digital</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Total Copies</Label>
                <Input placeholder="25" type="number" value={formData.totalCopies} onChange={e => setFormData(f => ({ ...f, totalCopies: e.target.value }))} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={submitting}>{submitting ? 'Adding...' : 'Add Book'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Data Table */}
      {loading ? (
        <TableSkeleton />
      ) : (
        <DataTable columns={columns} data={tableData} searchKey="title" searchPlaceholder="Search by title..." />
      )}
    </div>
  );
}
