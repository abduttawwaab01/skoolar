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
import { Plus, Upload, Download, Search, MapPin, Barcode } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Book {
  id: string;
  title: string;
  author: string | null;
  isbn: string | null;
  category: string | null;
  totalCopies: number;
  availableCopies: number;
  location: string | null;
  barcode: string | null;
}

type BookRow = Book & { available: number };

function TableSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-32" />
      </div>
      <Skeleton className="h-[400px] rounded-xl" />
    </div>
  );
}

export function BooksView() {
  const { selectedSchoolId, currentUser } = useAppStore();
  const schoolId = currentUser.schoolId || selectedSchoolId || '';
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = React.useState(false);
  const [bulkOpen, setBulkOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [categoryFilter, setCategoryFilter] = React.useState<string>('');

  const [formData, setFormData] = React.useState({
    title: '',
    author: '',
    isbn: '',
    category: 'General',
    totalCopies: '1',
    location: '',
    barcode: '',
  });

  const fetchBooks = useCallback(async () => {
    if (!schoolId || !categoryFilter) return;
    try {
      setLoading(true);
      const categoryParam = categoryFilter !== 'All' ? `&category=${categoryFilter}` : '';
      const res = await fetch(`/api/library/books?schoolId=${schoolId}&limit=500${categoryParam}`);
      if (!res.ok) throw new Error('Failed to load books');
      const json = await res.json();
      setBooks(json.data || []);
    } catch (err) {
      toast.error('Failed to load books');
    } finally {
      setLoading(false);
    }
  }, [schoolId, categoryFilter]);

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
    { 
      accessorKey: 'title', 
      header: 'Title',
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.title}</p>
          <p className="text-[10px] text-muted-foreground">{row.original.author || 'Unknown Author'}</p>
        </div>
      )
    },
    { accessorKey: 'category', header: 'Category' },
    { 
      accessorKey: 'location', 
      header: 'Location',
      cell: ({ row }) => row.original.location ? (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="size-3" />
          {row.original.location}
        </div>
      ) : '—'
    },
    { accessorKey: 'totalCopies', header: 'Total' },
    { 
      accessorKey: 'available', 
      header: 'Available',
      cell: ({ row }) => (
        <span className={cn(
          "font-medium",
          row.original.availableCopies === 0 ? "text-red-600" : 
          row.original.availableCopies < 3 ? "text-amber-600" : "text-emerald-600"
        )}>
          {row.original.availableCopies}
        </span>
      )
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <Button variant="ghost" size="sm" onClick={() => {
          setFormData({
            title: row.original.title,
            author: row.original.author || '',
            isbn: row.original.isbn || '',
            category: row.original.category || 'General',
            totalCopies: row.original.totalCopies.toString(),
            location: row.original.location || '',
            barcode: row.original.barcode || '',
          });
          setOpen(true);
        }}>Edit</Button>
      )
    }
  ];

  const handleSubmit = async () => {
    if (!formData.title) {
      toast.error('Please enter a book title');
      return;
    }
    if (!schoolId) return;
    try {
      setSubmitting(true);
      const res = await fetch('/api/library/books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId,
          ...formData,
          totalCopies: parseInt(formData.totalCopies) || 1,
        }),
      });
      if (!res.ok) throw new Error('Failed to save book');
      toast.success('Book saved successfully');
      setOpen(false);
      setFormData({ title: '', author: '', isbn: '', category: 'General', totalCopies: '1', location: '', barcode: '' });
      fetchBooks();
    } catch (err) {
      toast.error('Failed to save book');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const csv = event.target?.result as string;
      const lines = csv.split(/\r?\n/).filter(line => line.trim());
      const parseCSVLine = (line: string): string[] => {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '"') {
            inQuotes = !inQuotes;
          } else if (ch === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
          } else {
            current += ch;
          }
        }
        result.push(current.trim());
        return result;
      };
      const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());
      
      const booksToUpload = lines.slice(1).filter(line => line.trim()).map(line => {
        const values = parseCSVLine(line);
        const book: any = {};
        headers.forEach((header, i) => {
          book[header] = values[i]?.trim();
        });
        return book;
      });

      if (booksToUpload.length === 0) {
        toast.error('No valid data found in CSV');
        return;
      }

      try {
        setSubmitting(true);
        const res = await fetch('/api/library/books', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'bulk-upload',
            schoolId,
            books: booksToUpload,
          }),
        });
        if (!res.ok) throw new Error('Bulk upload failed');
        toast.success(`Successfully uploaded ${booksToUpload.length} books`);
        setBulkOpen(false);
        fetchBooks();
      } catch (err) {
        toast.error('Failed to upload books');
      } finally {
        setSubmitting(false);
      }
    };
    reader.readAsText(file);
  };

  const downloadTemplate = () => {
    const csvContent = "title,author,isbn,category,totalCopies,location,barcode\nMathematics Grade 1,John Doe,978-1234567890,Textbooks,20,Shelf A1,BK001";
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'library_books_template.csv';
    a.click();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold">Library Catalog</h2>
          <p className="text-sm text-muted-foreground">Manage books, inventory, and shelf locations</p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
            <DialogTrigger asChild>
              <Button variant="outline"><Upload className="size-4 mr-2" />Bulk Upload</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Bulk Upload Books</DialogTitle>
                <DialogDescription>Upload a CSV file with your book inventory.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <Button variant="ghost" className="w-full justify-start text-blue-600" onClick={downloadTemplate}>
                  <Download className="size-4 mr-2" /> Download CSV Template
                </Button>
                <div className="border-2 border-dashed rounded-lg p-8 text-center space-y-2">
                  <Input type="file" accept=".csv" onChange={handleFileUpload} disabled={submitting} className="hidden" id="csv-upload" />
                  <Label htmlFor="csv-upload" className="cursor-pointer">
                    <div className="flex flex-col items-center gap-2">
                      <div className="size-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                        <Upload className="size-5" />
                      </div>
                      <p className="text-sm font-medium">Click to select CSV file</p>
                      <p className="text-xs text-muted-foreground">Ensure columns match the template</p>
                    </div>
                  </Label>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="size-4 mr-2" />Add Book</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Book Details</DialogTitle>
                <DialogDescription>Add or update book information in the catalog.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-2">
                <div className="space-y-2">
                  <Label>Book Title</Label>
                  <Input placeholder="e.g. Things Fall Apart" value={formData.title} onChange={e => setFormData(f => ({ ...f, title: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Author</Label>
                    <Input placeholder="Chinua Achebe" value={formData.author} onChange={e => setFormData(f => ({ ...f, author: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>ISBN</Label>
                    <Input placeholder="978-XXXX" value={formData.isbn} onChange={e => setFormData(f => ({ ...f, isbn: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select value={formData.category} onValueChange={v => setFormData(f => ({ ...f, category: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="General">General</SelectItem>
                        <SelectItem value="Textbooks">Textbooks</SelectItem>
                        <SelectItem value="Novels">Novels</SelectItem>
                        <SelectItem value="Science">Science</SelectItem>
                        <SelectItem value="History">History</SelectItem>
                        <SelectItem value="Reference">Reference</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Total Copies</Label>
                    <Input type="number" value={formData.totalCopies} onChange={e => setFormData(f => ({ ...f, totalCopies: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1"><MapPin className="size-3" /> Location / Shelf</Label>
                    <Input placeholder="Shelf B-12" value={formData.location} onChange={e => setFormData(f => ({ ...f, location: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1"><Barcode className="size-3" /> Barcode</Label>
                    <Input placeholder="LIB-0001" value={formData.barcode} onChange={e => setFormData(f => ({ ...f, barcode: e.target.value }))} />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={handleSubmit} disabled={submitting}>{submitting ? 'Saving...' : 'Save Book'}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 flex-wrap">
        {['All', 'General', 'Textbooks', 'Novels', 'Science', 'History', 'Reference'].map(cat => (
          <Button
            key={cat}
            variant={categoryFilter === cat ? 'default' : 'outline'}
            size="sm"
            onClick={() => setCategoryFilter(cat)}
            className={cn(categoryFilter === cat && 'pointer-events-none')}
          >
            {cat}
          </Button>
        ))}
      </div>

      {!categoryFilter ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Search className="size-12 opacity-30 mb-3" />
          <p className="text-lg font-medium">Select a category to view books</p>
          <p className="text-sm">Choose from the categories above to browse the catalog</p>
        </div>
      ) : loading ? (
        <TableSkeleton />
      ) : (
        <DataTable columns={columns} data={tableData} searchKey="title" searchPlaceholder="Search by title, author, or ISBN..." />
      )}
    </div>
  );
}
