'use client';

import React, { useState, useEffect, startTransition } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Plus, Loader2, TrendingUp } from 'lucide-react';
import { formatCurrency } from '@/lib/salary-utils/calculations';
import { SalaryPromotionForm } from './salary-promotion-form';
import { toast } from 'sonner';

export function SalaryPromotionRequests() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);

  const fetchRequests = () => {
    startTransition(() => {
      setLoading(true);
      setError('');
    });
    fetch('/api/salary/advances')
      .then(r => r.json())
      .then(res => {
        const all = res.data || [];
        const promotions = all.filter((a: any) => a.reason?.startsWith('[PROMOTION]') || a.reason?.startsWith('[UPGRADE]') || a.reason?.startsWith('[ROLE_CHANGE]') || a.reason?.startsWith('[INCREMENT]'));
        startTransition(() => {
          setRequests(promotions);
        });
      })
      .catch(() => startTransition(() => setError('Failed to load requests')))
      .finally(() => startTransition(() => setLoading(false)));
  };

  useEffect(() => { fetchRequests(); }, []);

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="size-6 animate-spin" /></div>;
  if (error) return <p className="text-xs text-red-500 text-center py-4">{error}</p>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">Request a salary review or promotion</p>
        <Button size="sm" onClick={() => setShowForm(true)}>
          <Plus className="size-4 mr-1" /> New Request
        </Button>
      </div>

      {requests.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <TrendingUp className="size-8 mx-auto mb-2 opacity-30" />
            <p className="font-medium">No promotion requests yet</p>
            <p className="text-sm mt-1">Submit a request for a salary review or promotion.</p>
          </CardContent>
        </Card>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Requested Salary</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.map((r: any) => {
              const type = r.reason?.startsWith('[PROMOTION]') ? 'Promotion' : r.reason?.startsWith('[UPGRADE]') ? 'Upgrade' : r.reason?.startsWith('[ROLE_CHANGE]') ? 'Role Change' : 'Increment';
              const cleanReason = r.reason?.replace(/\[(PROMOTION|UPGRADE|ROLE_CHANGE|INCREMENT)\]\s*/, '')?.split('\n')[0] || '';
              return (
                <TableRow key={r.id}>
                  <TableCell className="text-xs">{new Date(r.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{type}</Badge></TableCell>
                  <TableCell className="font-medium">{formatCurrency(r.amount)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-xs truncate">{cleanReason}</TableCell>
                  <TableCell>
                    <Badge className={`text-[10px] ${r.status === 'APPROVED' ? 'bg-green-100 text-green-800' : r.status === 'REJECTED' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                      {r.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      {showForm && (
        <SalaryPromotionForm
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); fetchRequests(); }}
        />
      )}
    </div>
  );
}
