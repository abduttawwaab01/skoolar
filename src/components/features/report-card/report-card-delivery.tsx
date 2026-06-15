'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Send, MessageSquare, Mail } from 'lucide-react';
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export function ReportCardDelivery() {
  const { currentUser } = useAppStore();
  const schoolId = currentUser?.schoolId || '';

  const [reportCards, setReportCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState('');
  const [recipient, setRecipient] = useState('');
  const [method, setMethod] = useState<'whatsapp' | 'email'>('whatsapp');
  const [delivering, setDelivering] = useState(false);

  const fetchPublished = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/report-cards?schoolId=${schoolId}&isPublished=true`);
      const json = await res.json();
      setReportCards(json.data || []);
    } catch { setReportCards([]); }
    finally { setLoading(false); }
  }, [schoolId]);

  useEffect(() => { fetchPublished(); }, [fetchPublished]);

  const handleDeliver = async () => {
    if (!selectedId || !recipient) { toast.error('Select report card and enter recipient'); return; }
    setDelivering(true);
    try {
      const res = await fetch(`/api/report-cards/${selectedId}/deliver`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method, recipient }),
      });
      if (!res.ok) throw new Error('Delivery failed');
      const json = await res.json();
      if (json.whatsappUrl) window.open(json.whatsappUrl, '_blank');
      toast.success('Delivered successfully');
    } catch { toast.error('Delivery failed'); }
    finally { setDelivering(false); }
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="size-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Send className="size-4" />Send Report Cards
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Published Report Card</Label>
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select..." /></SelectTrigger>
              <SelectContent>
                {reportCards.map((rc: any) => (
                  <SelectItem key={rc.id} value={rc.id} className="text-xs">
                    {rc.student?.name || rc.student?.user?.name || 'N/A'} - {rc.term?.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2">
            <Button size="sm" variant={method === 'whatsapp' ? 'default' : 'outline'} onClick={() => setMethod('whatsapp')}>
              <MessageSquare className="size-3.5 mr-1" />WhatsApp
            </Button>
            <Button size="sm" variant={method === 'email' ? 'default' : 'outline'} onClick={() => setMethod('email')}>
              <Mail className="size-3.5 mr-1" />Email
            </Button>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">{method === 'whatsapp' ? 'Phone Number' : 'Email Address'}</Label>
            <Input className="h-8 text-xs" value={recipient} onChange={(e) => setRecipient(e.target.value)}
              placeholder={method === 'whatsapp' ? '+2348012345678' : 'parent@example.com'} />
          </div>

          <Button size="sm" onClick={handleDeliver} disabled={delivering || !selectedId || !recipient}>
            {delivering ? <Loader2 className="size-3.5 animate-spin mr-1" /> : <Send className="size-3.5 mr-1" />}
            {delivering ? 'Sending...' : 'Send'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
