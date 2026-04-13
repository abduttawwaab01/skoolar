'use client';

import * as React from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/shared/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { SafeFormattedDate } from '@/components/shared/safe-formatted-date';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { RefreshCw, XCircle } from 'lucide-react';

interface AuditLogRecord {
  id: string;
  userId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  details: string | null;
  ipAddress: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string; role: string } | null;
  schoolId: string | null;
}

const actionColors: Record<string, string> = {
  create: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  update: 'bg-blue-100 text-blue-700 border-blue-200',
  delete: 'bg-red-100 text-red-700 border-red-200',
  login: 'bg-violet-100 text-violet-700 border-violet-200',
  export: 'bg-amber-100 text-amber-700 border-amber-200',
};

export function AuditLogsView() {
  const [logs, setLogs] = React.useState<AuditLogRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [actionFilter, setActionFilter] = React.useState('all');

  const fetchLogs = React.useCallback(async (action?: string) => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      params.set('limit', '100');
      if (action && action !== 'all') params.set('action', action);
      const res = await fetch(`/api/audit-logs?${params}`);
      if (!res.ok) throw new Error('Failed to fetch audit logs');
      const json = await res.json();
      setLogs(json.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const handleFilterChange = (value: string) => {
    setActionFilter(value);
    fetchLogs(value === 'all' ? undefined : value);
  };

  const columns: ColumnDef<AuditLogRecord>[] = [
    {
      accessorKey: 'user',
      header: 'User',
      cell: ({ row }) => (
        <span className="text-sm font-medium">{row.original.user?.name || 'System'}</span>
      ),
    },
    {
      accessorKey: 'action',
      header: 'Action',
      cell: ({ row }) => (
        <Badge className={cn('text-xs border capitalize', actionColors[row.original.action] || '')}>
          {row.original.action}
        </Badge>
      ),
    },
    {
      accessorKey: 'entity',
      header: 'Entity',
      cell: ({ row }) => <span className="text-sm">{row.original.entity}</span>,
    },
    {
      accessorKey: 'details',
      header: 'Details',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground max-w-xs truncate block">
          {row.original.details || '-'}
        </span>
      ),
    },
    {
      accessorKey: 'time',
      header: 'Time',
      cell: ({ row }) => (
        <SafeFormattedDate 
          date={row.original.createdAt} 
          className="text-xs text-muted-foreground whitespace-nowrap" 
        />
      ),
    },
  ];

  if (error && logs.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Audit Logs</h2>
            <p className="text-sm text-muted-foreground">Track all system activities and changes</p>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-16 space-y-4">
          <div className="size-12 rounded-full bg-red-100 flex items-center justify-center"><XCircle className="size-6 text-red-600" /></div>
          <div className="text-center">
            <p className="text-sm font-medium">Failed to load audit logs</p>
            <p className="text-xs text-muted-foreground mt-1">{error}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => fetchLogs()}><RefreshCw className="size-3.5 mr-1.5" /> Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Audit Logs</h2>
          <p className="text-sm text-muted-foreground">Track all system activities and changes</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={actionFilter} onValueChange={handleFilterChange}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Filter by action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              <SelectItem value="create">Create</SelectItem>
              <SelectItem value="update">Update</SelectItem>
              <SelectItem value="delete">Delete</SelectItem>
              <SelectItem value="login">Login</SelectItem>
              <SelectItem value="export">Export</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={logs}
          searchKey="user"
          searchPlaceholder="Search by user..."
          emptyMessage="No audit logs found."
        />
      )}
    </div>
  );
}
