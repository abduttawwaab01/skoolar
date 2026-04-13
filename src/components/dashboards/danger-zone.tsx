'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';
import { handleSilentError } from '@/lib/error-handler';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, Trash2, RefreshCw, ShieldAlert, School, Database, Users, GraduationCap, ClipboardList, Calendar, BookOpen, DollarSign, MessageSquare, BarChart3, FileText, Activity, AlertOctagon, CheckCircle, XCircle, Clock, ChevronDown } from 'lucide-react';
import { Label } from '@/components/ui/label';

interface DataSummary { [key: string]: number; }
interface SchoolInfo { id: string; name: string; slug: string; isActive: boolean; createdAt: string; }
interface DangerLogEntry { id: string; performedBy: string; action: string; targetType: string | null; targetId: string | null; details: string | null; createdAt: string; }

const DATA_TYPES = [
  { key: 'students', label: 'Students', icon: Users, color: 'text-blue-600', bgColor: 'bg-blue-50' },
  { key: 'teachers', label: 'Teachers', icon: GraduationCap, color: 'text-purple-600', bgColor: 'bg-purple-50' },
  { key: 'parents', label: 'Parents', icon: Users, color: 'text-green-600', bgColor: 'bg-green-50' },
  { key: 'exams', label: 'Exams & Questions', icon: ClipboardList, color: 'text-orange-600', bgColor: 'bg-orange-50' },
  { key: 'attendance', label: 'Attendance Records', icon: Calendar, color: 'text-teal-600', bgColor: 'bg-teal-50' },
  { key: 'payments', label: 'Payments', icon: DollarSign, color: 'text-emerald-600', bgColor: 'bg-emerald-50' },
  { key: 'homework', label: 'Homework', icon: BookOpen, color: 'text-indigo-600', bgColor: 'bg-indigo-50' },
  { key: 'homework_questions', label: 'Homework Questions', icon: BookOpen, color: 'text-violet-600', bgColor: 'bg-violet-50' },
  { key: 'homework_answers', label: 'Homework Answers', icon: BookOpen, color: 'text-fuchsia-600', bgColor: 'bg-fuchsia-50' },
  { key: 'announcements', label: 'Announcements', icon: MessageSquare, color: 'text-pink-600', bgColor: 'bg-pink-50' },
  { key: 'events', label: 'Events', icon: Calendar, color: 'text-cyan-600', bgColor: 'bg-cyan-50' },
  { key: 'library', label: 'Library', icon: BookOpen, color: 'text-amber-600', bgColor: 'bg-amber-50' },
  { key: 'behavior', label: 'Behavior Logs', icon: Activity, color: 'text-red-600', bgColor: 'bg-red-50' },
  { key: 'reports', label: 'Report Cards', icon: FileText, color: 'text-violet-600', bgColor: 'bg-violet-50' },
  { key: 'feedback', label: 'Feedback', icon: MessageSquare, color: 'text-lime-600', bgColor: 'bg-lime-50' },
  { key: 'notifications', label: 'Notifications', icon: MessageSquare, color: 'text-sky-600', bgColor: 'bg-sky-50' },
  { key: 'messages', label: 'Messages', icon: MessageSquare, color: 'text-rose-600', bgColor: 'bg-rose-50' },
  { key: 'conversations', label: 'Conversations', icon: Users, color: 'text-fuchsia-600', bgColor: 'bg-fuchsia-50' },
  { key: 'users', label: 'All Users', icon: Users, color: 'text-gray-600', bgColor: 'bg-gray-50' },
];

export function DangerZone() {
  const { currentUser, currentRole } = useAppStore();
  const [schools, setSchools] = useState<SchoolInfo[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const [dataSummary, setDataSummary] = useState<DataSummary | null>(null);
  const [systemSummary, setSystemSummary] = useState<{ schools: number; users: number; students: number; teachers: number; payments: number } | null>(null);
  const [dangerLogs, setDangerLogs] = useState<DangerLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [operating, setOperating] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean; action: string; title: string; description: string; confirmText: string; data: Record<string, unknown> }>({ isOpen: false, action: '', title: '', description: '', confirmText: '', data: {} });
  const [confirmInput, setConfirmInput] = useState('');
  const [countdown, setCountdown] = useState(0);

  const isSuperAdmin = currentRole === 'SUPER_ADMIN';

  const fetchData = useCallback(async () => {
    try {
      const [schoolsRes, systemRes, logsRes] = await Promise.all([
        fetch('/api/danger-zone?action=schools-list').then(r => r.json()),
        fetch('/api/danger-zone?action=system-summary').then(r => r.json()),
        fetch('/api/danger-zone?action=audit-log').then(r => r.json()),
      ]);
      if (schoolsRes.success) setSchools(schoolsRes.data);
      if (systemRes.success) setSystemSummary(systemRes.data);
      if (logsRes.success) setDangerLogs(logsRes.data);
    } catch (error: unknown) { handleSilentError(error); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const fetchSchoolData = useCallback(async (schoolId: string) => {
    if (!schoolId) return;
    try {
      const res = await fetch(`/api/danger-zone?action=data-summary&schoolId=${schoolId}`);
      const json = await res.json();
      if (json.success) setDataSummary(json.data);
    } catch (error: unknown) { handleSilentError(error); }
  }, []);

  useEffect(() => {
    if (selectedSchoolId) fetchSchoolData(selectedSchoolId);
    else setDataSummary(null);
  }, [selectedSchoolId, fetchSchoolData]);

  const executeAction = async (action: string, data: Record<string, unknown>) => {
    setOperating(true);
    try {
      const res = await fetch('/api/danger-zone', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...data, performedBy: currentUser.id }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(json.message);
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        setConfirmInput('');
        fetchData();
        if (selectedSchoolId) fetchSchoolData(selectedSchoolId);
      } else {
        toast.error(json.message || 'Operation failed');
      }
    } catch (error: unknown) { handleSilentError(error);
      toast.error('Network error');
    } finally { setOperating(false); }
  };

  const openConfirm = (action: string, title: string, description: string, confirmText: string, data: Record<string, unknown>) => {
    setConfirmDialog({ isOpen: true, action, title, description, confirmText, data });
    setConfirmInput('');
    setCountdown(0);
  };

  const handleConfirm = () => {
    if (confirmInput !== confirmDialog.confirmText) {
      toast.error(`Please type "${confirmDialog.confirmText}" to confirm`);
      return;
    }
    if (countdown > 0) return;
    executeAction(confirmDialog.action, confirmDialog.data);
  };

  if (!isSuperAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md"><CardContent className="p-8 text-center">
          <ShieldAlert className="h-12 w-12 mx-auto mb-4 text-red-500" />
          <h2 className="text-xl font-bold text-gray-900">Access Denied</h2>
          <p className="text-sm text-gray-500 mt-2">This area is restricted to Super Admins only.</p>
        </CardContent></Card>
      </div>
    );
  }

  if (loading) {
    return <div className="space-y-4"><Skeleton className="h-12 w-96" /><Skeleton className="h-64" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Warning Banner */}
      <div className="bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl p-6 shadow-lg">
        <div className="flex items-center gap-3 mb-2">
          <AlertTriangle className="h-8 w-8" />
          <h1 className="text-2xl font-bold">Danger Zone</h1>
        </div>
        <p className="text-red-100 text-sm leading-relaxed max-w-2xl">
          These actions are <strong>irreversible</strong>. Deleting data or resetting systems will permanently remove records from the database.
          All operations are logged for audit purposes. Proceed with extreme caution.
        </p>
      </div>

      {/* System Overview */}
      {systemSummary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Schools', value: systemSummary.schools, icon: School, color: 'text-blue-600' },
            { label: 'Total Users', value: systemSummary.users, icon: Users, color: 'text-emerald-600' },
            { label: 'Total Students', value: systemSummary.students, icon: GraduationCap, color: 'text-purple-600' },
            { label: 'Total Payments', value: systemSummary.payments, icon: DollarSign, color: 'text-amber-600' },
          ].map((item, i) => (
            <Card key={i}><CardContent className="p-4 flex items-center gap-3">
              <item.icon className={`h-5 w-5 ${item.color}`} />
              <div><p className="text-xs text-gray-500">{item.label}</p><p className="text-xl font-bold">{item.value.toLocaleString()}</p></div>
            </CardContent></Card>
          ))}
        </div>
      )}

      <Tabs defaultValue="school-data">
        <TabsList className="grid w-full max-w-lg grid-cols-4">
          <TabsTrigger value="school-data">School Data</TabsTrigger>
          <TabsTrigger value="school-reset">School Reset</TabsTrigger>
          <TabsTrigger value="system-reset" className="text-red-600">System Reset</TabsTrigger>
          <TabsTrigger value="activity-log">Activity Log</TabsTrigger>
        </TabsList>

        {/* Tab 1: School Data Management */}
        <TabsContent value="school-data" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Select School</CardTitle></CardHeader>
            <CardContent>
              <Select value={selectedSchoolId} onValueChange={v => setSelectedSchoolId(v)}>
                <SelectTrigger><SelectValue placeholder="Choose a school..." /></SelectTrigger>
                <SelectContent>{schools.map(s => <SelectItem key={s.id} value={s.id}>{s.name} ({s.slug})</SelectItem>)}</SelectContent>
              </Select>
            </CardContent>
          </Card>

          {dataSummary && selectedSchoolId && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {DATA_TYPES.map(dt => {
                const count = dataSummary[dt.key] || 0;
                return (
                  <Card key={dt.key} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className={`p-2 rounded-lg ${dt.bgColor}`}><dt.icon className={`h-4 w-4 ${dt.color}`} /></div>
                        <span className="text-xs text-gray-400 font-mono">{count.toLocaleString()}</span>
                      </div>
                      <p className="text-xs font-medium text-gray-700 mb-2">{dt.label}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 text-xs"
                        disabled={count === 0 || operating}
                        onClick={() => openConfirm('delete-school-data', `Delete ${dt.label}`, `This will permanently delete ${count.toLocaleString()} ${dt.label.toLowerCase()} record(s) for this school. This cannot be undone.`, 'DELETE', { schoolId: selectedSchoolId, dataType: dt.key })}
                      >
                        <Trash2 className="h-3 w-3 mr-1" /> Delete
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {dataSummary && selectedSchoolId && (
            <Button
              variant="destructive"
              className="w-full"
              disabled={operating}
              onClick={() => {
                const school = schools.find(s => s.id === selectedSchoolId);
                openConfirm('delete-school-data', 'Delete ALL School Data', `This will delete every single piece of data for "${school?.name}" including all users, students, teachers, exams, payments, and everything else. The school itself will be removed. This is the most destructive operation for a single school.`, 'DELETE_ALL_DATA', { schoolId: selectedSchoolId, dataType: 'all' });
              }}
            >
              <Trash2 className="h-4 w-4 mr-2" /> Delete ALL Data for This School
            </Button>
          )}
        </TabsContent>

        {/* Tab 2: School Reset */}
        <TabsContent value="school-reset" className="space-y-4 mt-4">
          <Card className="border-red-200">
            <CardHeader><CardTitle className="text-base text-red-700">Reset School</CardTitle><CardDescription>Reset a school to a clean state while optionally keeping the admin account.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <Select value={selectedSchoolId} onValueChange={v => setSelectedSchoolId(v)}>
                <SelectTrigger><SelectValue placeholder="Choose a school..." /></SelectTrigger>
                <SelectContent>{schools.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>

              {selectedSchoolId && dataSummary && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-2">
                  <p className="text-sm font-medium text-red-700">This will delete:</p>
                  <ul className="text-xs text-red-600 space-y-1 list-disc list-inside">
                    {DATA_TYPES.filter(dt => (dataSummary[dt.key] || 0) > 0).slice(0, 10).map(dt => (
                      <li key={dt.key}>{dt.label}: {dataSummary[dt.key].toLocaleString()}</li>
                    ))}
                    <li>...and all other associated data</li>
                  </ul>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  className="border-red-300 text-red-600 hover:bg-red-50"
                  disabled={!selectedSchoolId || operating}
                  onClick={() => {
                    const school = schools.find(s => s.id === selectedSchoolId);
                    openConfirm('reset-school', 'Reset School (Keep Admin)', `Reset "${school?.name}" to a clean state. The school admin account will be preserved. All other data will be permanently deleted.`, 'RESET', { schoolId: selectedSchoolId, keepAdmin: true });
                  }}
                >
                  <RefreshCw className="h-4 w-4 mr-2" /> Reset (Keep Admin)
                </Button>
                <Button
                  variant="destructive"
                  disabled={!selectedSchoolId || operating}
                  onClick={() => {
                    const school = schools.find(s => s.id === selectedSchoolId);
                    openConfirm('reset-school', 'Reset School (Complete)', `Completely reset "${school?.name}". The school and ALL data including the admin account will be permanently deleted.`, 'RESET_COMPLETE', { schoolId: selectedSchoolId, keepAdmin: false });
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" /> Reset (Delete Everything)
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: System Reset */}
        <TabsContent value="system-reset" className="space-y-4 mt-4">
          <Card className="border-red-300 bg-red-50/50">
            <CardHeader>
              <CardTitle className="text-lg text-red-700 flex items-center gap-2"><AlertOctagon className="h-5 w-5" /> NUCLEAR OPTION - Complete System Reset</CardTitle>
              <CardDescription>This is the most destructive operation available. It will delete everything.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-white border border-red-200 rounded-lg p-4 space-y-2">
                <p className="text-sm font-medium text-red-700">What will happen:</p>
                <ul className="text-xs text-gray-700 space-y-1 list-disc list-inside">
                  <li>All {systemSummary?.schools || 0} schools will be permanently deleted</li>
                  <li>All {systemSummary?.users || 0} user accounts will be removed (except Super Admin)</li>
                  <li>All student records, exam data, attendance, payments will be gone</li>
                  <li>All messages, announcements, events, homework will be gone</li>
                  <li>All subscription plans, registration codes will be gone</li>
                  <li>Only the Super Admin login will be preserved</li>
                </ul>
              </div>

              <div className="bg-white border border-amber-200 rounded-lg p-4">
                <p className="text-sm font-medium text-amber-700">What will be kept:</p>
                <ul className="text-xs text-gray-700 space-y-1 list-disc list-inside">
                  <li>Super Admin user account and credentials</li>
                  <li>Danger Zone audit logs</li>
                </ul>
              </div>

              <Button
                variant="destructive"
                size="lg"
                className="w-full text-lg py-6"
                disabled={operating}
                onClick={() => openConfirm('reset-system', 'COMPLETE SYSTEM RESET', 'This will permanently delete ALL data from the entire system. Only the Super Admin account will remain. This operation cannot be undone under any circumstances. ARE YOU ABSOLUTELY SURE?', 'SKOOLAR_RESET_ALL', {})}
              >
                <AlertOctagon className="h-5 w-5 mr-2" /> Reset Entire System
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: Activity Log */}
        <TabsContent value="activity-log" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Danger Zone Operations Log</CardTitle></CardHeader>
            <CardContent>
              {dangerLogs.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">No operations recorded yet.</p>
              ) : (
                <div className="space-y-2">
                  {dangerLogs.map(log => (
                    <div key={log.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                      <div className={`p-2 rounded-lg ${log.action.includes('reset-system') ? 'bg-red-100' : log.action.includes('reset-school') ? 'bg-orange-100' : 'bg-amber-100'}`}>
                        <Trash2 className={`h-4 w-4 ${log.action.includes('reset-system') ? 'text-red-600' : log.action.includes('reset-school') ? 'text-orange-600' : 'text-amber-600'}`} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">{log.action}</Badge>
                          {log.targetId && <span className="text-xs text-gray-400">Target: {log.targetId.slice(0, 8)}...</span>}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">By: {log.performedBy} · {new Date(log.createdAt).toLocaleString()}</p>
                        {log.details && <p className="text-xs text-gray-400 mt-1 font-mono">{log.details.slice(0, 100)}...</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialog.isOpen} onOpenChange={open => { if (!operating) setConfirmDialog(prev => ({ ...prev, isOpen: open })); }}>
        <DialogContent className="border-red-200">
          <DialogHeader>
            <DialogTitle className="text-red-700 flex items-center gap-2"><AlertTriangle className="h-5 w-5" /> {confirmDialog.title}</DialogTitle>
            <DialogDescription>{confirmDialog.description}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <Label className="text-sm font-medium text-red-700">Type <code className="bg-red-100 px-2 py-0.5 rounded font-bold">{confirmDialog.confirmText}</code> to confirm</Label>
              <Input
                value={confirmInput}
                onChange={e => setConfirmInput(e.target.value)}
                placeholder={confirmDialog.confirmText}
                className="mt-2 border-red-300 focus:ring-red-500"
                autoFocus
              />
            </div>
            {confirmInput === confirmDialog.confirmText && countdown === 0 && (
              <p className="text-xs text-red-600 text-center">Confirmation matched. Click execute to proceed.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog(prev => ({ ...prev, open }))} disabled={operating}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={handleConfirm}
              disabled={confirmInput !== confirmDialog.confirmText || operating}
            >
              {operating ? (
                <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Executing...</>
              ) : (
                <><Trash2 className="h-4 w-4 mr-2" /> Execute</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
