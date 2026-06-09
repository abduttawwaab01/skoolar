'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';
import { FileText, Plus, Copy } from 'lucide-react';

export function AssessmentTemplatesView() {
  const { currentUser, setCurrentView } = useAppStore();
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showInstantiate, setShowInstantiate] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [targetType, setTargetType] = useState('STUDENT');
  const [type, setType] = useState('DIAGNOSTIC');
  const [saving, setSaving] = useState(false);

  const schoolId = currentUser.schoolId || '';

  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/assessment-hub/templates?schoolId=${schoolId}`);
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.data || []);
      }
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [schoolId]);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const handleCreate = async () => {
    if (!name.trim()) { toast.error('Name is required'); return; }
    try {
      setSaving(true);
      const res = await fetch('/api/assessment-hub/templates', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolId, name, description, targetType, type }),
      });
      if (res.ok) { toast.success('Template created'); setShowCreate(false); setName(''); setDescription(''); fetchTemplates(); }
      else { const err = await res.json(); toast.error(err.error || 'Failed'); }
    } catch { toast.error('Failed'); } finally { setSaving(false); }
  };

  const handleInstantiate = async (templateId: string, title: string) => {
    try {
      const res = await fetch(`/api/assessment-hub/templates/${templateId}/instantiate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolId, title, createdById: currentUser.id }),
      });
      if (res.ok) { toast.success('Assessment created from template'); setShowInstantiate(null); }
      else { const err = await res.json(); toast.error(err.error || 'Failed'); }
    } catch { toast.error('Failed'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Assessment Templates</h1>
          <p className="text-muted-foreground">Reusable templates for creating assessments</p>
        </div>
        <Button onClick={() => setShowCreate(!showCreate)}>
          <Plus className="h-4 w-4 mr-2" /> {showCreate ? 'Cancel' : 'Create Template'}
        </Button>
      </div>

      {showCreate && (
        <Card>
          <CardHeader><CardTitle className="text-base">New Template</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div className="space-y-2">
                <Label>Target</Label>
                <Select value={targetType} onValueChange={setTargetType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="STUDENT">Student</SelectItem>
                    <SelectItem value="TEACHER">Teacher</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="DIAGNOSTIC">Diagnostic</SelectItem>
                  <SelectItem value="FORMATIVE">Formative</SelectItem>
                  <SelectItem value="SUMMATIVE">Summative</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} /></div>
            <Button onClick={handleCreate} disabled={saving}>{saving ? 'Saving...' : 'Create'}</Button>
          </CardContent>
        </Card>
      )}

      {showInstantiate && (
        <Card>
          <CardHeader><CardTitle className="text-base">Create from Template</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">Enter a title for the new assessment:</p>
            <div className="flex gap-2">
              <Input id="instantiate-title" placeholder="Assessment title" className="flex-1" />
              <Button onClick={() => {
                const title = (document.getElementById('instantiate-title') as HTMLInputElement)?.value;
                if (title?.trim()) handleInstantiate(showInstantiate, title);
                else toast.error('Enter a title');
              }}><Copy className="h-4 w-4 mr-2" /> Create</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="space-y-3">{[1,2,3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
      ) : templates.length === 0 ? (
        <Card><CardContent className="py-12 text-center"><FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3" /><p className="text-muted-foreground">No templates yet</p></CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((t: any) => (
            <Card key={t.id} className="hover:shadow-sm transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">{t.name}</CardTitle>
                  <Badge variant="outline" className="text-[10px]">{t.targetType}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{t.description || 'No description'}</p>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">{t.type}</span>
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setShowInstantiate(t.id)}>
                    <Copy className="h-3 w-3 mr-1" /> Use Template
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
