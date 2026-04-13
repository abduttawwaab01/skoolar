'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { KpiCard } from '@/components/shared/kpi-card';
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Plus,
  MessageSquare,
  Clock,
  CheckCircle2,
  AlertCircle,
  Star,
  Loader2,
  LifeBuoy,
  ChevronRight,
  X,
  Search,
  Filter,
  Send,
} from 'lucide-react';

// --- Types ---
interface SupportTicket {
  id: string;
  schoolId: string;
  userId: string | null;
  subject: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  response: string | null;
  assignedTo: string | null;
  rating: number | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// --- Helpers ---
const statusConfig: Record<string, { label: string; color: string }> = {
  open: { label: 'Open', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  in_progress: { label: 'In Progress', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  waiting_response: { label: 'Waiting', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  resolved: { label: 'Resolved', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  closed: { label: 'Closed', color: 'bg-gray-100 text-gray-600 border-gray-200' },
};

const priorityConfig: Record<string, { label: string; color: string }> = {
  low: { label: 'Low', color: 'bg-slate-100 text-slate-600 border-slate-200' },
  medium: { label: 'Medium', color: 'bg-sky-100 text-sky-700 border-sky-200' },
  high: { label: 'High', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  urgent: { label: 'Urgent', color: 'bg-red-100 text-red-700 border-red-200' },
};

const categoryConfig: Record<string, { label: string; color: string }> = {
  general: { label: 'General', color: 'bg-gray-100 text-gray-700 border-gray-200' },
  billing: { label: 'Billing', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  technical: { label: 'Technical', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  feature_request: { label: 'Feature Request', color: 'bg-violet-100 text-violet-700 border-violet-200' },
  bug_report: { label: 'Bug Report', color: 'bg-red-100 text-red-700 border-red-200' },
};

function formatDate(dateStr: string) {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(dateStr: string) {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function StarRating({ rating, interactive, onRate }: { rating: number; interactive?: boolean; onRate?: (r: number) => void }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            'size-4 transition-colors',
            i < rating ? 'text-amber-400 fill-amber-400' : 'text-gray-300',
            interactive && 'cursor-pointer hover:text-amber-400 hover:scale-110'
          )}
          onClick={() => interactive && onRate && onRate(i + 1)}
        />
      ))}
    </div>
  );
}

// --- Component ---
export function SupportView() {
  const { currentUser, currentRole } = useAppStore();
  const [tickets, setTickets] = React.useState<SupportTicket[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [categoryFilter, setCategoryFilter] = React.useState('all');
  const [searchQuery, setSearchQuery] = React.useState('');

  // Create dialog
  const [createOpen, setCreateOpen] = React.useState(false);
  const [createForm, setCreateForm] = React.useState({
    subject: '',
    description: '',
    category: 'general',
    priority: 'medium',
  });
  const [creating, setCreating] = React.useState(false);

  // Detail dialog
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [selectedTicket, setSelectedTicket] = React.useState<SupportTicket | null>(null);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [staffResponse, setStaffResponse] = React.useState('');
  const [submittingResponse, setSubmittingResponse] = React.useState(false);
  const [ratingSubmitting, setRatingSubmitting] = React.useState(false);

  const isStaff = currentRole === 'SUPER_ADMIN' || currentRole === 'SCHOOL_ADMIN';

  // Fetch tickets
  const fetchTickets = React.useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ schoolId: currentUser.schoolId, limit: '50' });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (categoryFilter !== 'all') params.set('category', categoryFilter);

      const res = await fetch(`/api/support?${params}`);
      if (res.ok) {
        const json = await res.json();
        setTickets(json.data || []);
      }
    } catch {
      toast.error('Failed to load support tickets');
    } finally {
      setLoading(false);
    }
  }, [currentUser.schoolId, statusFilter, categoryFilter]);

  React.useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  // Create ticket
  const handleCreate = async () => {
    if (!createForm.subject.trim() || !createForm.description.trim()) {
      toast.error('Please fill in subject and description');
      return;
    }
    try {
      setCreating(true);
      const res = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: currentUser.schoolId,
          userId: currentUser.id,
          ...createForm,
        }),
      });
      if (res.ok) {
        toast.success('Support ticket created successfully');
        setCreateOpen(false);
        setCreateForm({ subject: '', description: '', category: 'general', priority: 'medium' });
        fetchTickets();
      } else {
        const json = await res.json();
        toast.error(json.error || 'Failed to create ticket');
      }
    } catch {
      toast.error('Failed to create ticket');
    } finally {
      setCreating(false);
    }
  };

  // Open detail
  const openDetail = async (ticket: SupportTicket) => {
    setSelectedTicket(ticket);
    setStaffResponse('');
    setDetailOpen(true);
    // Fetch latest detail
    try {
      setDetailLoading(true);
      const res = await fetch(`/api/support/${ticket.id}`);
      if (res.ok) {
        const json = await res.json();
        setSelectedTicket(json.data);
      }
    } catch {
      // Use existing data
    } finally {
      setDetailLoading(false);
    }
  };

  // Change status
  const handleStatusChange = async (newStatus: string) => {
    if (!selectedTicket) return;
    try {
      const res = await fetch(`/api/support/${selectedTicket.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const json = await res.json();
        setSelectedTicket(json.data);
        toast.success(`Status changed to ${statusConfig[newStatus]?.label || newStatus}`);
        fetchTickets();
      }
    } catch {
      toast.error('Failed to update status');
    }
  };

  // Submit staff response
  const handleResponse = async () => {
    if (!selectedTicket || !staffResponse.trim()) return;
    try {
      setSubmittingResponse(true);
      const res = await fetch(`/api/support/${selectedTicket.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: staffResponse, status: 'waiting_response' }),
      });
      if (res.ok) {
        const json = await res.json();
        setSelectedTicket(json.data);
        setStaffResponse('');
        toast.success('Response sent successfully');
        fetchTickets();
      }
    } catch {
      toast.error('Failed to send response');
    } finally {
      setSubmittingResponse(false);
    }
  };

  // Rate ticket
  const handleRate = async (rating: number) => {
    if (!selectedTicket) return;
    try {
      setRatingSubmitting(true);
      const res = await fetch(`/api/support/${selectedTicket.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating }),
      });
      if (res.ok) {
        const json = await res.json();
        setSelectedTicket(json.data);
        toast.success('Thank you for your rating!');
        fetchTickets();
      }
    } catch {
      toast.error('Failed to submit rating');
    } finally {
      setRatingSubmitting(false);
    }
  };

  // Stats
  const stats = React.useMemo(() => {
    const allOpen = tickets.filter(t => t.status === 'open').length;
    const inProgress = tickets.filter(t => t.status === 'in_progress').length;
    const resolved = tickets.filter(t => t.status === 'resolved').length;
    return { open: allOpen, inProgress, resolved, total: tickets.length };
  }, [tickets]);

  // Filter by search
  const filteredTickets = React.useMemo(() => {
    if (!searchQuery.trim()) return tickets;
    const q = searchQuery.toLowerCase();
    return tickets.filter(
      t =>
        t.subject.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
    );
  }, [tickets, searchQuery]);

  // Tabs
  const statusTabs = [
    { value: 'all', label: 'All' },
    { value: 'open', label: 'Open' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'waiting_response', label: 'Waiting' },
    { value: 'resolved', label: 'Resolved' },
    { value: 'closed', label: 'Closed' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Support Center</h2>
          <p className="text-sm text-muted-foreground">Get help and manage support tickets</p>
        </div>
        <Button className="gap-2" onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
          New Ticket
        </Button>
      </div>

      {/* Stats */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard title="Open Tickets" value={stats.open} icon={AlertCircle} iconColor="text-blue-600" iconBgColor="bg-blue-100" />
          <KpiCard title="In Progress" value={stats.inProgress} icon={Clock} iconColor="text-amber-600" iconBgColor="bg-amber-100" />
          <KpiCard title="Resolved" value={stats.resolved} icon={CheckCircle2} iconColor="text-emerald-600" iconBgColor="bg-emerald-100" />
          <KpiCard title="Total Tickets" value={stats.total} icon={MessageSquare} iconColor="text-violet-600" iconBgColor="bg-violet-100" />
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Status tabs */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 flex-1">
              {statusTabs.map(tab => (
                <button
                  key={tab.value}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors',
                    statusFilter === tab.value
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'text-muted-foreground hover:bg-muted'
                  )}
                  onClick={() => setStatusFilter(tab.value)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Category dropdown */}
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <Filter className="size-3.5 mr-2" />
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="general">General</SelectItem>
                <SelectItem value="billing">Billing</SelectItem>
                <SelectItem value="technical">Technical</SelectItem>
                <SelectItem value="feature_request">Feature Request</SelectItem>
                <SelectItem value="bug_report">Bug Report</SelectItem>
              </SelectContent>
            </Select>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                placeholder="Search tickets..."
                className="pl-9 w-full sm:w-[200px]"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ticket List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
      ) : filteredTickets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <LifeBuoy className="size-12 opacity-30 mb-3" />
          <p className="text-sm font-medium">No tickets found</p>
          <p className="text-xs mt-1">
            {searchQuery || categoryFilter !== 'all' || statusFilter !== 'all'
              ? 'Try adjusting your filters'
              : 'Create a new ticket to get help'}
          </p>
          {!searchQuery && categoryFilter === 'all' && statusFilter === 'all' && (
            <Button variant="outline" size="sm" className="mt-3 gap-2" onClick={() => setCreateOpen(true)}>
              <Plus className="size-3.5" />
              Create Ticket
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
          {filteredTickets.map(ticket => {
            const sConf = statusConfig[ticket.status] || statusConfig.open;
            const pConf = priorityConfig[ticket.priority] || priorityConfig.medium;
            const cConf = categoryConfig[ticket.category] || categoryConfig.general;
            return (
              <Card
                key={ticket.id}
                className="hover:shadow-md transition-shadow cursor-pointer group"
                onClick={() => openDetail(ticket)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-medium text-sm truncate">{ticket.subject}</h3>
                        <Badge className={cn('text-[10px] border shrink-0', cConf.color)}>{cConf.label}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{ticket.description}</p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <Badge className={cn('text-[10px] border', sConf.color)}>{sConf.label}</Badge>
                        <Badge className={cn('text-[10px] border', pConf.color)}>{pConf.label}</Badge>
                        <span className="text-[11px] text-muted-foreground">{formatDate(ticket.createdAt)}</span>
                      </div>
                    </div>
                    <ChevronRight className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Ticket Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Support Ticket</DialogTitle>
            <DialogDescription>Describe your issue and our team will help you resolve it.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Subject *</Label>
              <Input
                placeholder="Brief summary of your issue"
                value={createForm.subject}
                onChange={(e) => setCreateForm(f => ({ ...f, subject: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label>Description *</Label>
              <Textarea
                placeholder="Provide as much detail as possible..."
                rows={4}
                value={createForm.description}
                onChange={(e) => setCreateForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Category</Label>
                <Select value={createForm.category} onValueChange={(v) => setCreateForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="billing">Billing</SelectItem>
                    <SelectItem value="technical">Technical</SelectItem>
                    <SelectItem value="feature_request">Feature Request</SelectItem>
                    <SelectItem value="bug_report">Bug Report</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Priority</Label>
                <Select value={createForm.priority} onValueChange={(v) => setCreateForm(f => ({ ...f, priority: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating} className="gap-2">
              {creating && <Loader2 className="size-4 animate-spin" />}
              Submit Ticket
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ticket Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          {detailLoading || !selectedTicket ? (
            <div className="py-8 space-y-4">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 flex-wrap">
                  <DialogTitle className="text-lg">{selectedTicket.subject}</DialogTitle>
                  <Badge className={cn('text-[10px] border', statusConfig[selectedTicket.status]?.color)}>
                    {statusConfig[selectedTicket.status]?.label}
                  </Badge>
                  <Badge className={cn('text-[10px] border', priorityConfig[selectedTicket.priority]?.color)}>
                    {priorityConfig[selectedTicket.priority]?.label}
                  </Badge>
                  <Badge className={cn('text-[10px] border', categoryConfig[selectedTicket.category]?.color)}>
                    {categoryConfig[selectedTicket.category]?.label}
                  </Badge>
                </div>
                <DialogDescription>
                  Created {formatDateTime(selectedTicket.createdAt)}
                  {selectedTicket.resolvedAt && ` · Resolved ${formatDateTime(selectedTicket.resolvedAt)}`}
                </DialogDescription>
              </DialogHeader>

              {/* Description */}
              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground font-medium mb-1">Description</p>
                <p className="text-sm whitespace-pre-wrap">{selectedTicket.description}</p>
              </div>

              {/* Status Timeline */}
              <div className="rounded-lg border p-4">
                <p className="text-sm font-medium mb-3">Status Timeline</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-emerald-500" />
                    <span className="text-xs">Ticket created</span>
                    <span className="text-xs text-muted-foreground ml-auto">{formatDateTime(selectedTicket.createdAt)}</span>
                  </div>
                  {selectedTicket.updatedAt !== selectedTicket.createdAt && (
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="size-4 text-blue-500" />
                      <span className="text-xs">Last updated</span>
                      <span className="text-xs text-muted-foreground ml-auto">{formatDateTime(selectedTicket.updatedAt)}</span>
                    </div>
                  )}
                  {selectedTicket.resolvedAt && (
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="size-4 text-emerald-600" />
                      <span className="text-xs font-medium text-emerald-700">Resolved</span>
                      <span className="text-xs text-muted-foreground ml-auto">{formatDateTime(selectedTicket.resolvedAt)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Staff Response */}
              {selectedTicket.response && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-sm font-medium text-emerald-800 mb-1">Staff Response</p>
                  <p className="text-sm text-emerald-900 whitespace-pre-wrap">{selectedTicket.response}</p>
                </div>
              )}

              {/* Rating (for resolved/closed tickets) */}
              {(selectedTicket.status === 'resolved' || selectedTicket.status === 'closed') && (
                <div className="rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Rate this support</p>
                    {ratingSubmitting ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : selectedTicket.rating ? (
                      <div className="flex items-center gap-2">
                        <StarRating rating={selectedTicket.rating} />
                        <span className="text-xs text-muted-foreground">{selectedTicket.rating}/5</span>
                      </div>
                    ) : (
                      <StarRating rating={0} interactive onRate={handleRate} />
                    )}
                  </div>
                </div>
              )}

              {/* Staff Controls */}
              {isStaff && (
                <>
                  <Separator />
                  <div className="space-y-4">
                    <p className="text-sm font-medium">Admin Actions</p>

                    {/* Status change buttons */}
                    <div className="flex flex-wrap gap-2">
                      {selectedTicket.status !== 'in_progress' && (
                        <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => handleStatusChange('in_progress')}>
                          <Clock className="size-3" /> Mark In Progress
                        </Button>
                      )}
                      {selectedTicket.status !== 'waiting_response' && (
                        <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => handleStatusChange('waiting_response')}>
                          <MessageSquare className="size-3" /> Waiting for User
                        </Button>
                      )}
                      {selectedTicket.status !== 'resolved' && (
                        <Button size="sm" variant="outline" className="gap-1.5 text-xs text-emerald-700" onClick={() => handleStatusChange('resolved')}>
                          <CheckCircle2 className="size-3" /> Mark Resolved
                        </Button>
                      )}
                      {selectedTicket.status !== 'closed' && (
                        <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => handleStatusChange('closed')}>
                          <X className="size-3" /> Close Ticket
                        </Button>
                      )}
                    </div>

                    {/* Response textarea */}
                    <div className="grid gap-2">
                      <Label>Respond to ticket</Label>
                      <Textarea
                        placeholder="Type your response to the user..."
                        rows={3}
                        value={staffResponse}
                        onChange={(e) => setStaffResponse(e.target.value)}
                      />
                      <Button
                        size="sm"
                        onClick={handleResponse}
                        disabled={submittingResponse || !staffResponse.trim()}
                        className="gap-2 w-fit"
                      >
                        {submittingResponse ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                        Send Response
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
