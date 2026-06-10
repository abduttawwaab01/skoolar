'use client';

import * as React from 'react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/shared/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/shared/status-badge';
import { useAppStore } from '@/store/app-store';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { motion } from 'framer-motion';
import { fadeIn, staggerContainer, slideUp } from '@/lib/motion-variants';
import { Package, Plus, Search, AlertTriangle, Layers, Barcode, MapPin, Wrench, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface InventoryCategory {
  id: string;
  name: string;
  description: string | null;
  _count?: { items: number };
}

interface InventoryItem {
  id: string;
  schoolId: string;
  categoryId: string | null;
  name: string;
  description: string | null;
  quantity: number;
  minQuantity: number;
  unit: string | null;
  condition: string;
  purchaseDate: string | null;
  purchasePrice: number | null;
  supplier: string | null;
  location: string | null;
  serialNumber: string | null;
  barcode: string | null;
  notes: string | null;
  isConsumable: boolean;
  status: string;
  assignedTo: string | null;
  imageUrl: string | null;
  category: { id: string; name: string } | null;
}

function TableSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-32" />
      </div>
      <Skeleton className="h-[400px] rounded-xl" />
    </div>
  );
}

const conditionBadge: Record<string, { variant: 'success' | 'warning' | 'error' | 'neutral' | 'info'; label: string }> = {
  new: { variant: 'success', label: 'New' },
  good: { variant: 'info', label: 'Good' },
  fair: { variant: 'warning', label: 'Fair' },
  poor: { variant: 'error', label: 'Poor' },
  damaged: { variant: 'error', label: 'Damaged' },
};

const statusBadgeMap: Record<string, { variant: 'success' | 'warning' | 'error' | 'neutral' | 'info'; label: string }> = {
  available: { variant: 'success', label: 'Available' },
  in_use: { variant: 'info', label: 'In Use' },
  under_maintenance: { variant: 'warning', label: 'Under Maintenance' },
  retired: { variant: 'error', label: 'Retired' },
};

const defaultForm = {
  name: '',
  description: '',
  categoryId: '',
  quantity: '1',
  minQuantity: '0',
  unit: '',
  condition: 'new',
  purchaseDate: '',
  purchasePrice: '',
  supplier: '',
  location: '',
  serialNumber: '',
  barcode: '',
  notes: '',
  isConsumable: false,
  status: 'available',
  assignedTo: '',
};

export function InventoryView() {
  const { selectedSchoolId, currentUser } = useAppStore();
  const schoolId = currentUser.schoolId || selectedSchoolId || '';
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [categories, setCategories] = useState<InventoryCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [formData, setFormData] = useState(defaultForm);

  const [catForm, setCatForm] = useState({ name: '', description: '' });

  const fetchItems = useCallback(async () => {
    if (!schoolId) return;
    try {
      setLoading(true);
      const params = new URLSearchParams({ schoolId, limit: '500' });
      if (filterCategory !== 'all') params.set('categoryId', filterCategory);
      if (filterStatus !== 'all') params.set('status', filterStatus);
      if (searchQuery) params.set('search', searchQuery);

      const res = await fetch(`/api/inventory?${params}`);
      if (!res.ok) throw new Error('Failed to load items');
      const json = await res.json();
      setItems(json.data || []);
    } catch {
      toast.error('Failed to load inventory items');
    } finally {
      setLoading(false);
    }
  }, [schoolId, filterCategory, filterStatus, searchQuery]);

  const fetchCategories = useCallback(async () => {
    if (!schoolId) return;
    try {
      const res = await fetch(`/api/inventory/categories?schoolId=${schoolId}`);
      if (!res.ok) throw new Error('Failed to load categories');
      const json = await res.json();
      setCategories(json.data || []);
    } catch {
      // Silently fail
    }
  }, [schoolId]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const lowStockItems = useMemo(() => {
    return items.filter(item => item.quantity <= item.minQuantity);
  }, [items]);

  const resetForm = () => {
    setFormData(defaultForm);
    setEditingId(null);
  };

  const openEdit = (item: InventoryItem) => {
    setFormData({
      name: item.name,
      description: item.description || '',
      categoryId: item.categoryId || '',
      quantity: item.quantity.toString(),
      minQuantity: item.minQuantity.toString(),
      unit: item.unit || '',
      condition: item.condition,
      purchaseDate: item.purchaseDate ? item.purchaseDate.split('T')[0] : '',
      purchasePrice: item.purchasePrice?.toString() || '',
      supplier: item.supplier || '',
      location: item.location || '',
      serialNumber: item.serialNumber || '',
      barcode: item.barcode || '',
      notes: item.notes || '',
      isConsumable: item.isConsumable,
      status: item.status,
      assignedTo: item.assignedTo || '',
    });
    setEditingId(item.id);
    setOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name) {
      toast.error('Please enter an item name');
      return;
    }
    if (!schoolId) return;
    try {
      setSubmitting(true);
      const payload: any = {
        schoolId,
        ...formData,
        quantity: parseInt(formData.quantity) || 1,
        minQuantity: parseInt(formData.minQuantity) || 0,
        purchasePrice: formData.purchasePrice ? parseFloat(formData.purchasePrice) : undefined,
        categoryId: formData.categoryId || undefined,
      };
      if (!payload.purchaseDate) delete payload.purchaseDate;

      const url = editingId ? `/api/inventory/${editingId}` : '/api/inventory';
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to save item');
      toast.success(editingId ? 'Item updated successfully' : 'Item created successfully');
      setOpen(false);
      resetForm();
      fetchItems();
    } catch {
      toast.error('Failed to save item');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/inventory/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete item');
      toast.success('Item deleted successfully');
      fetchItems();
    } catch {
      toast.error('Failed to delete item');
    }
  };

  const handleCreateCategory = async () => {
    if (!catForm.name) {
      toast.error('Please enter a category name');
      return;
    }
    try {
      setSubmitting(true);
      const res = await fetch('/api/inventory/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolId, ...catForm }),
      });
      if (!res.ok) throw new Error('Failed to create category');
      toast.success('Category created successfully');
      setCatOpen(false);
      setCatForm({ name: '', description: '' });
      fetchCategories();
    } catch {
      toast.error('Failed to create category');
    } finally {
      setSubmitting(false);
    }
  };

  const columns: ColumnDef<InventoryItem>[] = [
    {
      accessorKey: 'name',
      header: 'Item Name',
      cell: ({ row }) => (
        <div>
          <p className="font-medium flex items-center gap-2">
            {row.original.name}
            {row.original.quantity <= row.original.minQuantity && (
              <AlertTriangle className="size-3.5 text-amber-500 shrink-0" />
            )}
          </p>
          {row.original.serialNumber && (
            <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
              <Barcode className="size-3" />
              {row.original.serialNumber}
            </p>
          )}
        </div>
      ),
    },
    {
      id: 'category',
      header: 'Category',
      cell: ({ row }) => (
        <span className="text-sm">{row.original.category?.name || '—'}</span>
      ),
    },
    {
      accessorKey: 'quantity',
      header: 'Qty',
      cell: ({ row }) => {
        const item = row.original;
        const isLow = item.quantity <= item.minQuantity;
        return (
          <div className="flex items-center gap-1.5">
            <span className={cn(
              'font-medium tabular-nums',
              isLow ? 'text-red-600' : 'text-emerald-600',
            )}>
              {item.quantity}
            </span>
            {item.unit && <span className="text-xs text-muted-foreground">{item.unit}</span>}
            {isLow && (
              <span className="text-[10px] text-amber-600 font-medium">(Low)</span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const mapping = statusBadgeMap[row.original.status] || statusBadgeMap.available;
        return (
          <StatusBadge variant={mapping.variant} size="sm">
            {mapping.label}
          </StatusBadge>
        );
      },
    },
    {
      accessorKey: 'condition',
      header: 'Condition',
      cell: ({ row }) => {
        const mapping = conditionBadge[row.original.condition] || conditionBadge.good;
        return (
          <Badge variant="outline" className="text-xs">
            {mapping.label}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'location',
      header: 'Location',
      cell: ({ row }) => row.original.location ? (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="size-3" />
          {row.original.location}
        </div>
      ) : '—',
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => openEdit(row.original)}>
            Edit
          </Button>
          <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600" onClick={() => handleDelete(row.original.id)}>
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  const summaryCards = [
    {
      label: 'Total Items',
      value: items.length,
      icon: Package,
      color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/50',
    },
    {
      label: 'Categories',
      value: categories.length,
      icon: Layers,
      color: 'text-purple-600 bg-purple-50 dark:bg-purple-950/50',
    },
    {
      label: 'Low Stock',
      value: lowStockItems.length,
      icon: AlertTriangle,
      color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/50',
    },
    {
      label: 'Under Maintenance',
      value: items.filter(i => i.status === 'under_maintenance').length,
      icon: Wrench,
      color: 'text-rose-600 bg-rose-50 dark:bg-rose-950/50',
    },
  ];

  return (
    <motion.div className="space-y-6" variants={staggerContainer} initial="hidden" animate="visible">
      <motion.div variants={fadeIn} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold">Inventory Management</h2>
          <p className="text-sm text-muted-foreground">Track and manage school assets and supplies</p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={catOpen} onOpenChange={setCatOpen}>
            <DialogTrigger asChild>
              <Button variant="outline"><Layers className="size-4 mr-2" />Categories</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[450px]">
              <DialogHeader>
                <DialogTitle>Category Management</DialogTitle>
                <DialogDescription>Create and manage inventory categories.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-3">
                  <Label>Category Name</Label>
                  <Input
                    placeholder="e.g. Electronics, Furniture"
                    value={catForm.name}
                    onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description (optional)</Label>
                  <Input
                    placeholder="Brief description"
                    value={catForm.description}
                    onChange={e => setCatForm(f => ({ ...f, description: e.target.value }))}
                  />
                </div>
                <Button onClick={handleCreateCategory} disabled={submitting} className="w-full">
                  {submitting ? 'Creating...' : 'Create Category'}
                </Button>
                {categories.length > 0 && (
                  <div className="border rounded-lg divide-y">
                    {categories.map(cat => (
                      <div key={cat.id} className="flex items-center justify-between px-3 py-2 text-sm">
                        <span>{cat.name}</span>
                        <span className="text-xs text-muted-foreground">{cat._count?.items ?? 0} items</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) resetForm(); }}>
            <DialogTrigger asChild>
              <Button><Plus className="size-4 mr-2" />Add Item</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingId ? 'Edit Item' : 'Add Inventory Item'}</DialogTitle>
                <DialogDescription>Enter the details of the inventory item.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-2">
                <div className="space-y-2">
                  <Label>Item Name *</Label>
                  <Input placeholder="e.g. Dell Laptop" value={formData.name} onChange={e => setFormData(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select value={formData.categoryId} onValueChange={v => setFormData(f => ({ ...f, categoryId: v === 'none' ? '' : v }))}>
                      <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {categories.map(cat => (
                          <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={formData.status} onValueChange={v => setFormData(f => ({ ...f, status: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="available">Available</SelectItem>
                        <SelectItem value="in_use">In Use</SelectItem>
                        <SelectItem value="under_maintenance">Under Maintenance</SelectItem>
                        <SelectItem value="retired">Retired</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Quantity</Label>
                    <Input type="number" min="0" value={formData.quantity} onChange={e => setFormData(f => ({ ...f, quantity: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Min Quantity</Label>
                    <Input type="number" min="0" value={formData.minQuantity} onChange={e => setFormData(f => ({ ...f, minQuantity: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Unit</Label>
                    <Input placeholder="pcs, kg, box" value={formData.unit} onChange={e => setFormData(f => ({ ...f, unit: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Condition</Label>
                    <Select value={formData.condition} onValueChange={v => setFormData(f => ({ ...f, condition: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new">New</SelectItem>
                        <SelectItem value="good">Good</SelectItem>
                        <SelectItem value="fair">Fair</SelectItem>
                        <SelectItem value="poor">Poor</SelectItem>
                        <SelectItem value="damaged">Damaged</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Purchase Price</Label>
                    <Input type="number" min="0" step="0.01" placeholder="0.00" value={formData.purchasePrice} onChange={e => setFormData(f => ({ ...f, purchasePrice: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Supplier</Label>
                    <Input placeholder="Supplier name" value={formData.supplier} onChange={e => setFormData(f => ({ ...f, supplier: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Purchase Date</Label>
                    <Input type="date" value={formData.purchaseDate} onChange={e => setFormData(f => ({ ...f, purchaseDate: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1"><Barcode className="size-3" /> Serial Number</Label>
                    <Input placeholder="SN-001" value={formData.serialNumber} onChange={e => setFormData(f => ({ ...f, serialNumber: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1"><Barcode className="size-3" /> Barcode</Label>
                    <Input placeholder="INV-0001" value={formData.barcode} onChange={e => setFormData(f => ({ ...f, barcode: e.target.value }))} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1"><MapPin className="size-3" /> Location</Label>
                  <Input placeholder="Store Room, Shelf A3" value={formData.location} onChange={e => setFormData(f => ({ ...f, location: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Assigned To</Label>
                  <Input placeholder="John Doe" value={formData.assignedTo} onChange={e => setFormData(f => ({ ...f, assignedTo: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea placeholder="Additional notes..." value={formData.notes} onChange={e => setFormData(f => ({ ...f, notes: e.target.value }))} />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isConsumable"
                    checked={formData.isConsumable}
                    onChange={e => setFormData(f => ({ ...f, isConsumable: e.target.checked }))}
                    className="rounded border-gray-300"
                  />
                  <Label htmlFor="isConsumable" className="text-sm">This item is consumable</Label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setOpen(false); resetForm(); }}>Cancel</Button>
                <Button onClick={handleSubmit} disabled={submitting}>{submitting ? 'Saving...' : 'Save Item'}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </motion.div>

      <motion.div variants={slideUp} className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {summaryCards.map((card, i) => (
          <motion.div
            key={card.label}
            variants={slideUp}
            className="rounded-xl border bg-card p-4 flex items-center gap-3"
          >
            <div className={cn('size-10 rounded-lg flex items-center justify-center shrink-0', card.color)}>
              <card.icon className="size-5" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{card.value}</p>
              <p className="text-xs text-muted-foreground">{card.label}</p>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {lowStockItems.length > 0 && (
        <motion.div variants={slideUp} className="rounded-xl border border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20 p-4">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 mb-2">
            <AlertTriangle className="size-4" />
            <span className="font-semibold text-sm">Low Stock Alert</span>
            <span className="text-xs text-amber-600/70">({lowStockItems.length} items)</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {lowStockItems.slice(0, 6).map(item => (
              <Badge key={item.id} variant="outline" className="bg-white dark:bg-amber-950/40 text-xs">
                {item.name} ({item.quantity})
              </Badge>
            ))}
            {lowStockItems.length > 6 && (
              <Badge variant="secondary" className="text-xs">+{lowStockItems.length - 6} more</Badge>
            )}
          </div>
        </motion.div>
      )}

      <motion.div variants={slideUp} className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search items..."
            className="pl-8"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="All Categories" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map(cat => (
              <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="All Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="available">Available</SelectItem>
            <SelectItem value="in_use">In Use</SelectItem>
            <SelectItem value="under_maintenance">Under Maintenance</SelectItem>
            <SelectItem value="retired">Retired</SelectItem>
          </SelectContent>
        </Select>
      </motion.div>

      <motion.div variants={fadeIn}>
        {loading ? (
          <TableSkeleton />
        ) : (
          <DataTable
            columns={columns}
            data={items}
            searchKey="name"
            searchPlaceholder="Search items..."
            emptyMessage="No inventory items found"
            emptyIcon={<Package className="size-12 text-muted-foreground/50" />}
          />
        )}
      </motion.div>
    </motion.div>
  );
}
