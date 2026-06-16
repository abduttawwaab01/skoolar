'use client';

import React, { useState, useEffect } from 'react';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Loader2 } from 'lucide-react';
import { formatCurrency } from '@/lib/salary-utils/calculations';
import { SalaryConfigForm } from './salary-config-form';

export function SalaryConfigList() {
  const [configs, setConfigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | undefined>();

  const fetchConfigs = () => {
    setLoading(true);
    setError('');
    fetch('/api/salary/config')
      .then(r => r.json())
      .then(res => setConfigs(res.data || []))
      .catch(() => setError('Failed to load salary configs'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchConfigs(); }, []);

  const totalGross = (cfg: any) =>
    (cfg.baseSalary || 0) + (cfg.housingAllowance || 0) + (cfg.transportAllowance || 0) + (cfg.medicalAllowance || 0) + (cfg.bonus || 0);

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="size-6 animate-spin" /></div>;
  if (error) return <p className="text-xs text-red-500 text-center py-4">{error}</p>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => { setEditId(undefined); setShowForm(true); }}>
          <Plus className="size-4 mr-1" /> Add Salary Config
        </Button>
      </div>

      {configs.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No salary configurations found.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Staff Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Base Salary</TableHead>
              <TableHead>Housing</TableHead>
              <TableHead>Transport</TableHead>
              <TableHead>Medical</TableHead>
              <TableHead>Total Gross</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {configs.map((cfg) => (
              <TableRow key={cfg.id}>
                <TableCell className="font-medium">{cfg.user?.name || cfg.staffName || '-'}</TableCell>
                <TableCell>{cfg.user?.role || cfg.role || '-'}</TableCell>
                <TableCell>{formatCurrency(cfg.baseSalary || 0)}</TableCell>
                <TableCell>{formatCurrency(cfg.housingAllowance || 0)}</TableCell>
                <TableCell>{formatCurrency(cfg.transportAllowance || 0)}</TableCell>
                <TableCell>{formatCurrency(cfg.medicalAllowance || 0)}</TableCell>
                <TableCell className="font-medium">{formatCurrency(totalGross(cfg))}</TableCell>
                <TableCell>
                  <Badge variant={cfg.isActive === false ? 'secondary' : 'default'} className="text-[10px]">
                    {cfg.isActive === false ? 'Inactive' : 'Active'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" onClick={() => { setEditId(cfg.id); setShowForm(true); }}>
                    <Pencil className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {showForm && (
        <SalaryConfigForm
          editId={editId}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); fetchConfigs(); }}
        />
      )}
    </div>
  );
}
