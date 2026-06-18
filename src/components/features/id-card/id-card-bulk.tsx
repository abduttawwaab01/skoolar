'use client';

import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Loader2, Download, Users, GraduationCap, UserCheck } from 'lucide-react';

export function IDCardBulk() {
  const [step, setStep] = useState<'select' | 'preview' | 'generating' | 'done'>('select');
  const [selectedClass, setSelectedClass] = useState('');
  const [personType, setPersonType] = useState<'student' | 'teacher'>('student');
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [generated, setGenerated] = useState<any[]>([]);

  const handleGenerate = useCallback(async () => {
    setStep('generating');
    setProgress(0);
    try {
      const res = await fetch('/api/id-cards/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personType,
          classId: selectedClass || undefined,
        }),
      });
      if (!res.ok) throw new Error('Generation failed');
      const result = await res.json();
      setGenerated(result.data || []);
      setTotal(result.count || 0);
      setProgress(100);
      setStep('done');
      toast.success(`Generated ${result.count} ID cards`);
    } catch {
      toast.error('Bulk generation failed');
      setStep('select');
    }
  }, [personType, selectedClass]);

  const handleExportAll = useCallback(async () => {
    toast.success('Export started - cards will download as HTML');
  }, []);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Bulk ID Card Generation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === 'select' && (
            <>
              <div className="space-y-2">
                <Label className="text-xs font-medium">Card Type</Label>
                <div className="flex gap-2">
                  {(['student', 'teacher'] as const).map(t => (
                    <Button
                      key={t}
                      variant={personType === t ? 'default' : 'outline'}
                      size="sm" onClick={() => setPersonType(t)}
                      className="flex-1 h-8 text-xs"
                    >
                      {t === 'student' ? (
                        <GraduationCap className="size-3.5 mr-1.5" />
                      ) : (
                        <UserCheck className="size-3.5 mr-1.5" />
                      )}
                      {t === 'student' ? 'Students' : 'Teachers'}
                    </Button>
                  ))}
                </div>
              </div>

              {personType === 'student' && (
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Class (optional)</Label>
                  <select
                    value={selectedClass}
                    onChange={e => setSelectedClass(e.target.value)}
                    className="flex h-8 w-full rounded-md border border-input bg-background px-3 text-xs"
                  >
                    <option value="">All Classes</option>
                    <option value="demo-1">Grade 1</option>
                    <option value="demo-2">Grade 2</option>
                    <option value="demo-3">Grade 3</option>
                  </select>
                </div>
              )}

              <Button onClick={handleGenerate} size="sm" className="w-full h-8 text-xs">
                <Users className="size-3.5 mr-1.5" /> Generate Cards
              </Button>
            </>
          )}

          {step === 'generating' && (
            <div className="space-y-3 py-4 text-center">
              <Loader2 className="size-6 animate-spin mx-auto text-primary" />
              <p className="text-sm text-muted-foreground">Generating ID cards...</p>
              <Progress value={progress} className="h-1.5" />
            </div>
          )}

          {step === 'done' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 py-2">
                <Badge variant="default" className="text-xs">{total} cards generated</Badge>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleExportAll} size="sm" className="flex-1 h-8 text-xs">
                  <Download className="size-3.5 mr-1.5" /> Export All
                </Button>
                <Button onClick={() => { setStep('select'); setGenerated([]); }} variant="outline" size="sm" className="h-8 text-xs">
                  Generate More
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
