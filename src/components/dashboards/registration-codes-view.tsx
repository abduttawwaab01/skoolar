'use client';

import * as React from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
 import { Copy, KeyRound, Plus, RefreshCw, XCircle, Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface RegistrationCodeRecord {
  id: string;
  code: string;
  plan: string;
  region: string | null;
  maxUses: number;
  usedCount: number;
  expiresAt: string;
  isUsed: boolean;
  schoolId: string | null;
  school: { id: string; name: string } | null;
  createdBy: string | null;
  createdAt: string;
}

const planColors: Record<string, string> = {
  enterprise: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  pro: 'bg-blue-100 text-blue-700 border-blue-200',
  basic: 'bg-gray-100 text-gray-700 border-gray-200',
};

function CodeCell({ code }: { code: string }) {
  const [copied, setCopied] = React.useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="flex items-center gap-2">
      <code className="font-mono text-xs bg-muted px-2 py-1 rounded">{code}</code>
      <Button variant="ghost" size="icon" className="size-7" onClick={handleCopy}>
        <Copy className="size-3.5" />
      </Button>
      {copied && <span className="text-xs text-emerald-600">Copied!</span>}
    </div>
  );
}

export function RegistrationCodesView() {
  const [codes, setCodes] = React.useState<RegistrationCodeRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
   const [open, setOpen] = React.useState(false);
   const [editOpen, setEditOpen] = React.useState(false);
   const [deleteConfirmId, setDeleteConfirmId] = React.useState<string | null>(null);
   const [formPlan, setFormPlan] = React.useState('');
   const [formRegion, setFormRegion] = React.useState('');
   const [formMaxUses, setFormMaxUses] = React.useState('1');
   const [formExpiry, setFormExpiry] = React.useState('');
   const [editingCode, setEditingCode] = React.useState<RegistrationCodeRecord | null>(null);

  const fetchCodes = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/registration-codes?limit=50');
      if (!res.ok) throw new Error('Failed to fetch registration codes');
      const json = await res.json();
      setCodes(Array.isArray(json.data) ? json.data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { fetchCodes(); }, [fetchCodes]);

   const handleGenerate = async () => {
     if (!formPlan) {
       toast.error('Please select a plan');
       return;
     }
     try {
       setSubmitting(true);
       const res = await fetch('/api/registration-codes', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
           plan: formPlan,
           region: formRegion || null,
           maxUses: parseInt(formMaxUses) || 1,
           expiresAt: formExpiry || null,
           count: 1,
         }),
       });
       if (!res.ok) {
         const err = await res.json();
         throw new Error(err.error || 'Failed to generate code');
       }
       const json = await res.json();
       toast.success(json.message || 'Registration code generated successfully');
       setOpen(false);
       setFormPlan('');
       setFormRegion('');
       setFormMaxUses('1');
       setFormExpiry('');
       fetchCodes();
     } catch (err) {
       toast.error(err instanceof Error ? err.message : 'Failed to generate code');
     } finally {
       setSubmitting(false);
     }
   };

   const handleEdit = (code: RegistrationCodeRecord) => {
     setEditingCode(code);
     setFormPlan(code.plan);
     setFormRegion(code.region || '');
     setFormMaxUses(String(code.maxUses));
     setFormExpiry(code.expiresAt ? new Date(code.expiresAt).toISOString().split('T')[0] : '');
     setEditOpen(true);
   };

   const handleUpdate = async () => {
     if (!editingCode) return;
     try {
       setSubmitting(true);
       const res = await fetch('/api/registration-codes', {
         method: 'PUT',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
           id: editingCode.id,
           plan: formPlan,
           region: formRegion || null,
           maxUses: parseInt(formMaxUses) || 1,
           expiresAt: formExpiry || null,
         }),
       });
       if (!res.ok) {
         const err = await res.json();
         throw new Error(err.error || 'Failed to update code');
       }
       const json = await res.json();
       toast.success(json.message || 'Registration code updated successfully');
       setEditOpen(false);
       setEditingCode(null);
       fetchCodes();
     } catch (err) {
       toast.error(err instanceof Error ? err.message : 'Failed to update code');
     } finally {
       setSubmitting(false);
     }
   };

   const handleDelete = async (id: string) => {
     try {
       const res = await fetch(`/api/registration-codes?id=${id}`, {
         method: 'DELETE',
       });
       if (!res.ok) {
         const err = await res.json();
         throw new Error(err.error || 'Failed to delete code');
       }
       toast.success('Registration code deleted successfully');
       setDeleteConfirmId(null);
       fetchCodes();
     } catch (err) {
       toast.error(err instanceof Error ? err.message : 'Failed to delete code');
     }
   };

  const columns: ColumnDef<RegistrationCodeRecord>[] = [
    {
      accessorKey: 'code',
      header: 'Code',
      cell: ({ row }) => <CodeCell code={row.original.code} />,
    },
    {
      accessorKey: 'plan',
      header: 'Plan',
      cell: ({ row }) => (
        <Badge className={planColors[row.original.plan] + ' text-xs border'}>
          {row.original.plan}
        </Badge>
      ),
    },
    {
      accessorKey: 'region',
      header: 'Region',
      cell: ({ row }) => (
        <span className="text-sm">{row.original.region || <span className="text-muted-foreground">Any</span>}</span>
      ),
    },
    {
      accessorKey: 'maxUses',
      header: 'Max Uses',
      cell: ({ row }) => <span className="text-sm">{row.original.maxUses}</span>,
    },
    {
      accessorKey: 'usedCount',
      header: 'Used',
      cell: ({ row }) => <span className="text-sm">{row.original.usedCount}</span>,
    },
    {
      accessorKey: 'expiresAt',
      header: 'Expires',
      cell: ({ row }) => <span className="text-sm">{row.original.expiresAt ? new Date(row.original.expiresAt).toISOString().split('T')[0] : 'Never'}</span>,
    },
     {
       accessorKey: 'isUsed',
       header: 'Status',
       cell: ({ row }) => {
         const isUsed = row.original.isUsed;
         const isExpired = row.original.expiresAt ? new Date(row.original.expiresAt) < new Date() : false;
         if (isUsed) return <StatusBadge variant="neutral">Used</StatusBadge>;
         if (isExpired) return <StatusBadge variant="warning">Expired</StatusBadge>;
         return <StatusBadge variant="success">Active</StatusBadge>;
       },
     },
     {
       accessorKey: 'actions',
       header: 'Actions',
       cell: ({ row }) => {
         const code = row.original;
         return (
           <div className="flex items-center gap-2">
             <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(code)} title="Edit">
               <Edit className="size-4" />
             </Button>
             <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => setDeleteConfirmId(code.id)} title="Delete">
               <Trash2 className="size-4" />
             </Button>
           </div>
         );
       },
     },
   ];

  if (error && codes.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Registration Codes</h2>
            <p className="text-sm text-muted-foreground">Manage codes for school registration</p>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-16 space-y-4">
          <div className="size-12 rounded-full bg-red-100 flex items-center justify-center"><XCircle className="size-6 text-red-600" /></div>
          <div className="text-center">
            <p className="text-sm font-medium">Failed to load registration codes</p>
            <p className="text-xs text-muted-foreground mt-1">{error}</p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchCodes}><RefreshCw className="size-3.5 mr-1.5" /> Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Registration Codes</h2>
          <p className="text-sm text-muted-foreground">Manage codes for school registration</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="size-4" />
              Generate Code
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <KeyRound className="size-5" />
                Generate Registration Code
              </DialogTitle>
              <DialogDescription>
                Create a new registration code for a school to sign up.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Plan</Label>
                <Select value={formPlan} onValueChange={setFormPlan}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select plan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                    <SelectItem value="pro">Pro</SelectItem>
                    <SelectItem value="basic">Basic</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Region</Label>
                <Input
                  placeholder="e.g. Southwest (optional)"
                  value={formRegion}
                  onChange={(e) => setFormRegion(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>Max Uses</Label>
                <Input
                  type="number"
                  min="1"
                  value={formMaxUses}
                  onChange={(e) => setFormMaxUses(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>Expiry Date</Label>
                <Input
                  type="date"
                  value={formExpiry}
                  onChange={(e) => setFormExpiry(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={handleGenerate} disabled={submitting}>
                {submitting ? 'Generating...' : 'Generate Code'}
              </Button>
            </DialogFooter>
           </DialogContent>
         </Dialog>

         {/* Edit Code Dialog */}
         <Dialog open={editOpen} onOpenChange={setEditOpen}>
           <DialogContent>
             <DialogHeader>
               <DialogTitle className="flex items-center gap-2">
                 <Edit className="size-5" />
                 Edit Registration Code
               </DialogTitle>
               <DialogDescription>
                 Update the settings for this registration code.
               </DialogDescription>
             </DialogHeader>
             <div className="grid gap-4 py-4">
               <div className="grid gap-2">
                 <Label>Plan</Label>
                 <Select value={formPlan} onValueChange={setFormPlan}>
                   <SelectTrigger>
                     <SelectValue placeholder="Select plan" />
                   </SelectTrigger>
                   <SelectContent>
                     <SelectItem value="enterprise">Enterprise</SelectItem>
                     <SelectItem value="pro">Pro</SelectItem>
                     <SelectItem value="basic">Basic</SelectItem>
                   </SelectContent>
                 </Select>
               </div>
               <div className="grid gap-2">
                 <Label>Region</Label>
                 <Input
                   placeholder="e.g. Southwest (optional)"
                   value={formRegion}
                   onChange={(e) => setFormRegion(e.target.value)}
                 />
               </div>
               <div className="grid gap-2">
                 <Label>Max Uses</Label>
                 <Input
                   type="number"
                   min="1"
                   value={formMaxUses}
                   onChange={(e) => setFormMaxUses(e.target.value)}
                 />
               </div>
               <div className="grid gap-2">
                 <Label>Expiry Date</Label>
                 <Input
                   type="date"
                   value={formExpiry}
                   onChange={(e) => setFormExpiry(e.target.value)}
                 />
               </div>
             </div>
             <DialogFooter>
               <Button variant="outline" onClick={() => { setEditOpen(false); setEditingCode(null); }}>Cancel</Button>
               <Button onClick={handleUpdate} disabled={submitting}>
                 {submitting ? 'Updating...' : 'Update Code'}
               </Button>
             </DialogFooter>
           </DialogContent>
         </Dialog>

         {/* Delete Confirmation Dialog */}
         <Dialog open={!!deleteConfirmId} onOpenChange={(open) => { if (!open) setDeleteConfirmId(null); }}>
           <DialogContent>
             <DialogHeader>
               <DialogTitle>Delete Registration Code</DialogTitle>
               <DialogDescription>
                 Are you sure you want to delete this registration code? This action cannot be undone.
               </DialogDescription>
             </DialogHeader>
             <DialogFooter>
               <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
               <Button variant="destructive" onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}>
                 Delete
               </Button>
             </DialogFooter>
           </DialogContent>
         </Dialog>
       </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={codes}
          searchKey="code"
          searchPlaceholder="Search codes..."
          emptyMessage="No registration codes found."
        />
      )}
    </div>
  );
}
