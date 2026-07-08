'use client';

import React, { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Upload, Plus, X } from 'lucide-react';
import { useReportCardPrintStore } from '@/store/report-card-print-store';
import { TEMPLATE_PRESETS, TERM_SCORE_TYPE_PRESETS } from '@/lib/report-card-print-utils/templates';
import type { ScoreTypeConfig } from '@/lib/report-card-print-utils/types';

export function ReportCardPrintConfigurator() {
  const { config, setConfig, setSubjects, setScoreTypes, addStudent, addStudentsBulk, removeStudent, clearStudents, setSchoolLogo } = useReportCardPrintStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const bulkRef = useRef<HTMLTextAreaElement>(null);
  const studentPhotoRef = useRef<HTMLInputElement>(null);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { if (reader.result) setSchoolLogo(reader.result as string); };
    reader.readAsDataURL(file);
  };

  const handleTemplateChange = (templateId: string) => {
    const preset = TEMPLATE_PRESETS[templateId];
    if (preset) setConfig(preset);
  };

  const handleBulkAdd = () => {
    const text = bulkRef.current?.value;
    if (!text?.trim()) return;
    const names = text.split('\n').map(s => s.trim()).filter(Boolean);
    addStudentsBulk(names);
    if (bulkRef.current) bulkRef.current.value = '';
  };

  const handleStudentPhoto = (studentId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result) {
        useReportCardPrintStore.getState().setStudentPhoto(studentId, reader.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <ScrollArea className="h-full">
      <div className="space-y-4 p-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Template</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={config.templateId} onValueChange={handleTemplateChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="classic">Classic (Navy)</SelectItem>
                <SelectItem value="modern">Modern (Teal)</SelectItem>
                <SelectItem value="vibrant">Vibrant (Orange)</SelectItem>
                <SelectItem value="executive">Executive (Dark/Gold)</SelectItem>
                <SelectItem value="compact">Compact (Blue)</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">School Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <Label className="text-xs">School Name</Label>
              <Input value={config.schoolName} onChange={e => setConfig({ schoolName: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">School Address</Label>
              <Input value={config.schoolAddress} onChange={e => setConfig({ schoolAddress: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">School Logo</Label>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                  <Upload className="size-3 mr-1" />Upload
                </Button>
                {config.schoolLogoDataUrl && <span className="text-xs text-muted-foreground">Uploaded</span>}
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
            </div>
            <div>
              <Label className="text-xs">Term / Session</Label>
              <Input value={config.sessionLabel} onChange={e => setConfig({ sessionLabel: e.target.value })} placeholder="e.g. 2024/2025 - 1st Term" />
            </div>
            <div>
              <Label className="text-xs">Class</Label>
              <Input value={config.className} onChange={e => setConfig({ className: e.target.value })} placeholder="e.g. Grade 5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Term Score Types</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Select
              value={config.scoreTypes.length > 0 ? 'custom' : 'first'}
              onValueChange={(v) => {
                const preset = TERM_SCORE_TYPE_PRESETS[v];
                if (preset) setScoreTypes(preset.types.map(t => ({ ...t })));
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TERM_SCORE_TYPE_PRESETS).map(([key, val]) => (
                  <SelectItem key={key} value={key}>{val.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {config.scoreTypes.map((st, i) => (
              <div key={st.id} className="flex gap-1 items-center">
                <Input
                  className="flex-1 text-xs"
                  value={st.label}
                  onChange={e => {
                    const types = [...config.scoreTypes];
                    types[i] = { ...types[i], label: e.target.value };
                    setScoreTypes(types);
                  }}
                />
                <Input
                  className="w-16 text-xs"
                  type="number"
                  value={st.maxScore}
                  onChange={e => {
                    const types = [...config.scoreTypes];
                    types[i] = { ...types[i], maxScore: Number(e.target.value) };
                    setScoreTypes(types);
                  }}
                />
                {i > 0 && (
                  <Button variant="ghost" size="icon" className="size-6" onClick={() => {
                    const types = config.scoreTypes.filter((_, idx) => idx !== i);
                    setScoreTypes(types);
                  }}>
                    <X className="size-3" />
                  </Button>
                )}
              </div>
            ))}
            <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => {
              const types = [...config.scoreTypes, { id: `st_${Date.now()}`, label: 'Score', maxScore: 100, includeInTotal: true }];
              setScoreTypes(types);
            }}>
              <Plus className="size-3 mr-1" />Add Score Type
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Subjects</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {config.subjects.map((subj, i) => (
              <div key={i} className="flex gap-1">
                <Input
                  className="flex-1 text-xs"
                  value={subj}
                  onChange={e => {
                    const subs = [...config.subjects];
                    subs[i] = e.target.value;
                    setSubjects(subs);
                  }}
                />
                <Button variant="ghost" size="icon" className="size-6" onClick={() => {
                  setSubjects(config.subjects.filter((_, idx) => idx !== i));
                }}>
                  <X className="size-3" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => {
              setSubjects([...config.subjects, `Subject ${config.subjects.length + 1}`]);
            }}>
              <Plus className="size-3 mr-1" />Add Subject
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Students</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {config.students.length === 0 && <p className="text-xs text-muted-foreground">No students added yet.</p>}
            {config.students.length > 0 && (
              <div className="max-h-40 overflow-y-auto space-y-1">
                {config.students.map(st => (
                  <div key={st.id} className="flex items-center gap-1 text-xs">
                    <span className="flex-1 truncate">{st.name}</span>
                    <Button variant="ghost" size="icon" className="size-5" onClick={() => removeStudent(st.id)}>
                      <X className="size-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-1">
              <Input
                placeholder="Student name"
                className="text-xs"
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    addStudent((e.target as HTMLInputElement).value);
                    (e.target as HTMLInputElement).value = '';
                  }
                }}
              />
              <Button variant="outline" size="sm" className="text-xs" onClick={() => {
                const name = prompt('Student name:');
                if (name?.trim()) addStudent(name.trim());
              }}>
                <Plus className="size-3" />
              </Button>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Bulk Add (one per line)</Label>
              <Textarea ref={bulkRef} className="text-xs min-h-[60px]" placeholder="John Doe&#10;Jane Smith&#10;..." />
              <div className="flex gap-1">
                <Button variant="outline" size="sm" className="text-xs" onClick={handleBulkAdd}>Add All</Button>
                <Button variant="destructive" size="sm" className="text-xs" onClick={clearStudents}>Clear All</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Student Photos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {config.students.length === 0 && <p className="text-xs text-muted-foreground">Add students first.</p>}
            {config.students.map(st => (
              <div key={st.id} className="flex items-center gap-2 text-xs">
                <span className="flex-1 truncate">{st.name}</span>
                {st.photoDataUrl
                  ? <span className="text-green-600">Photo set</span>
                  : <span className="text-muted-foreground">No photo</span>
                }
                <Button variant="outline" size="sm" className="text-xs" onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = 'image/*';
                  input.onchange = (e: any) => {
                    const file = e.target?.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => {
                      if (reader.result) {
                        useReportCardPrintStore.getState().setStudentPhoto(st.id, reader.result as string);
                      }
                    };
                    reader.readAsDataURL(file);
                  };
                  input.click();
                }}>
                  <Upload className="size-3 mr-1" />Upload
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Scores</CardTitle>
          </CardHeader>
          <CardContent>
            {config.students.length === 0 && <p className="text-xs text-muted-foreground">Add students first.</p>}
            {config.subjects.length === 0 && <p className="text-xs text-muted-foreground">Add subjects first.</p>}
            {config.students.length > 0 && config.subjects.length > 0 && (
              <div className="max-h-96 overflow-auto space-y-2">
                {config.students.map(st => (
                  <details key={st.id} className="border rounded p-2 text-xs">
                    <summary className="cursor-pointer font-medium">{st.name}</summary>
                    <div className="mt-2 space-y-1">
                      {config.subjects.map(subj => (
                        <div key={subj} className="flex gap-1 items-center">
                          <span className="w-24 shrink-0 truncate">{subj}</span>
                          {config.scoreTypes.map(stc => (
                            <Input
                              key={stc.id}
                              className="w-14 text-xs"
                              type="number"
                              placeholder={stc.label.slice(0, 4)}
                              value={(st.scores[subj]?.[stc.id] ?? '') as any}
                              onChange={e => {
                                const v = e.target.value === '' ? undefined : Number(e.target.value);
                                useReportCardPrintStore.getState().updateStudentScore(st.id, subj, stc.id, v);
                              }}
                            />
                          ))}
                        </div>
                      ))}
                    </div>
                  </details>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Comments / Next Term</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <Label className="text-xs">Teacher Comment</Label>
              <Textarea value={config.teacherComment} onChange={e => setConfig({ teacherComment: e.target.value })} className="text-xs" rows={2} />
            </div>
            <div>
              <Label className="text-xs">Principal Comment</Label>
              <Textarea value={config.principalComment} onChange={e => setConfig({ principalComment: e.target.value })} className="text-xs" rows={2} />
            </div>
            <div>
              <Label className="text-xs">Next Term (Fee / Resumption)</Label>
              <Textarea value={config.nextTermBegins} onChange={e => setConfig({ nextTermBegins: e.target.value })} className="text-xs" rows={2} />
            </div>
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
}
