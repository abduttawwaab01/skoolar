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

function compressImage(dataUrl: string, maxW = 300, maxH = 400, quality = 0.7): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let w = img.width, h = img.height;
      if (w > maxW) { h = (h * maxW) / w; w = maxW; }
      if (h > maxH) { w = (w * maxH) / h; h = maxH; }
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(img, 0, 0, w, h);
      resolve(c.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}
import { TEMPLATE_PRESETS, TERM_SCORE_TYPE_PRESETS } from '@/lib/report-card-print-utils/templates';
import type { ScoreTypeConfig } from '@/lib/report-card-print-utils/types';

export function ReportCardPrintConfigurator() {
  const { config, setConfig, setSubjects, setScoreTypes, addStudent, addStudentsBulk, removeStudent, clearStudents, setSchoolLogo, addDomain, removeDomain } = useReportCardPrintStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const bulkRef = useRef<HTMLTextAreaElement>(null);
  const studentPhotoRef = useRef<HTMLInputElement>(null);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result) {
        compressImage(reader.result as string, 400, 200).then(setSchoolLogo);
      }
    };
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

  const handleStudentPhoto = async (studentId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result) {
        compressImage(reader.result as string).then(url => {
          useReportCardPrintStore.getState().setStudentPhoto(studentId, url);
        });
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
              <Label className="text-xs">School Phone</Label>
              <Input value={config.schoolPhone} onChange={e => setConfig({ schoolPhone: e.target.value })} placeholder="e.g. +234 800 000 0000" />
            </div>
            <div>
              <Label className="text-xs">School Email</Label>
              <Input value={config.schoolEmail} onChange={e => setConfig({ schoolEmail: e.target.value })} placeholder="e.g. info@school.edu.ng" />
            </div>
            <div>
              <Label className="text-xs">School Website</Label>
              <Input value={config.schoolWebsite} onChange={e => setConfig({ schoolWebsite: e.target.value })} placeholder="e.g. www.school.edu.ng" />
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
            <CardTitle className="text-sm">Learning Domains</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2">
              <Label className="text-xs cursor-pointer flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={config.showDomains}
                  onChange={e => setConfig({ showDomains: e.target.checked })}
                  className="size-3.5"
                />
                Show learning domains on report card
              </Label>
            </div>
            <p className="text-[10px] text-muted-foreground">Learning domains (Cognitive, Affective, Psychomotor, etc.) rate student traits on a 1–5 scale.</p>
            {config.domains.map(dom => (
              <details key={dom.id} className="border rounded p-2 text-xs">
                <summary className="cursor-pointer font-medium">{dom.name}</summary>
                <div className="mt-2 space-y-2">
                  <div className="flex gap-1 items-center">
                    <Label className="text-xs shrink-0">Domain Name:</Label>
                    <Input
                      className="text-xs flex-1"
                      value={dom.name}
                      onChange={e => useReportCardPrintStore.getState().updateDomain(dom.id, { name: e.target.value })}
                    />
                    <Button variant="ghost" size="icon" className="size-6 shrink-0" onClick={() => removeDomain(dom.id)}>
                      <X className="size-3" />
                    </Button>
                  </div>
                  <div>
                    <Label className="text-xs">Traits (Rating 1–5 each):</Label>
                    <div className="mt-1 space-y-1">
                      {dom.traits.map(t => (
                        <div key={t.id} className="flex gap-1 items-center">
                          <Input
                            className="flex-1 text-xs"
                            value={t.label}
                            onChange={e => {
                              const traits = dom.traits.map(t2 => t2.id === t.id ? { ...t2, label: e.target.value } : t2);
                              useReportCardPrintStore.getState().updateDomain(dom.id, { traits });
                            }}
                          />
                          <Input
                            className="w-14 text-xs"
                            type="number"
                            min={1}
                            max={5}
                            value={t.maxScore}
                            onChange={e => {
                              const traits = dom.traits.map(t2 => t2.id === t.id ? { ...t2, maxScore: Number(e.target.value) } : t2);
                              useReportCardPrintStore.getState().updateDomain(dom.id, { traits });
                            }}
                          />
                          <Button variant="ghost" size="icon" className="size-6 shrink-0" onClick={() => {
                            const traits = dom.traits.filter(t2 => t2.id !== t.id);
                            useReportCardPrintStore.getState().updateDomain(dom.id, { traits });
                          }}>
                            <X className="size-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                    <Button variant="outline" size="sm" className="w-full text-xs mt-1" onClick={() => {
                      const traits = [...dom.traits, { id: `tr_${Date.now()}`, label: `Trait ${dom.traits.length + 1}`, maxScore: 5 }];
                      useReportCardPrintStore.getState().updateDomain(dom.id, { traits });
                    }}>
                      <Plus className="size-3 mr-1" />Add Trait
                    </Button>
                  </div>
                </div>
              </details>
            ))}
            <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => {
              const name = `Domain ${config.domains.length + 1}`;
              addDomain(name);
            }}>
              <Plus className="size-3 mr-1" />Add Domain
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
                  input.onchange = async (e: any) => {
                    const file = e.target?.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => {
                      if (reader.result) {
                        compressImage(reader.result as string).then(url => {
                          useReportCardPrintStore.getState().setStudentPhoto(st.id, url);
                        });
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
                    {config.domains.length > 0 && config.showDomains && (
                      <div className="mt-2 pt-2 border-t border-border space-y-1">
                        <Label className="text-xs text-muted-foreground font-semibold">Domain Scores (1–5)</Label>
                        {config.domains.map(dom => (
                          dom.traits.length > 0 && (
                            <div key={dom.id}>
                              <span className="text-[10px] text-muted-foreground">{dom.name}:</span>
                              <div className="flex flex-wrap gap-1 mt-0.5">
                                {dom.traits.map(t => (
                                  <div key={t.id} className="flex items-center gap-0.5">
                                    <span className="text-[10px] w-16 truncate">{t.label}</span>
                                    <Input
                                      className="w-12 text-xs"
                                      type="number"
                                      min={1}
                                      max={t.maxScore}
                                      value={st.domainScores?.[dom.id]?.[t.id] ?? ''}
                                      onChange={e => {
                                        const v = e.target.value === '' ? undefined : Number(e.target.value);
                                        useReportCardPrintStore.getState().updateStudentDomainScore(st.id, dom.id, t.id, v);
                                      }}
                                    />
                                    <span className="text-[10px] text-muted-foreground">/{t.maxScore}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )
                        ))}
                      </div>
                    )}
                    <div className="mt-2 pt-2 border-t border-border">
                      <Label className="text-xs text-muted-foreground font-semibold">Attendance</Label>
                      <div className="flex gap-2 mt-0.5">
                        <div className="flex items-center gap-1">
                          <Label className="text-[10px]">Present:</Label>
                          <Input
                            className="w-14 text-xs"
                            type="number"
                            min={0}
                            value={st.attendance?.present ?? 0}
                            onChange={e => useReportCardPrintStore.getState().setStudentAttendance(st.id, 'present', Number(e.target.value))}
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <Label className="text-[10px]">Absent:</Label>
                          <Input
                            className="w-14 text-xs"
                            type="number"
                            min={0}
                            value={st.attendance?.absent ?? 0}
                            onChange={e => useReportCardPrintStore.getState().setStudentAttendance(st.id, 'absent', Number(e.target.value))}
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <Label className="text-[10px]">Total Days:</Label>
                          <Input
                            className="w-14 text-xs"
                            type="number"
                            min={0}
                            value={st.attendance?.total ?? 0}
                            onChange={e => useReportCardPrintStore.getState().setStudentAttendance(st.id, 'total', Number(e.target.value))}
                          />
                        </div>
                      </div>
                    </div>
                      <div className="mt-2 pt-2 border-t border-border">
                        <Label className="text-xs text-muted-foreground">Teacher Comment</Label>
                        <Textarea
                          className="text-xs mt-0.5"
                          rows={1}
                          value={st.teacherComment || ''}
                          onChange={e => useReportCardPrintStore.getState().setStudentComment(st.id, 'teacherComment', e.target.value)}
                        />
                        <Label className="text-xs text-muted-foreground mt-1">Principal Comment</Label>
                        <Textarea
                          className="text-xs mt-0.5"
                          rows={1}
                          value={st.principalComment || ''}
                          onChange={e => useReportCardPrintStore.getState().setStudentComment(st.id, 'principalComment', e.target.value)}
                        />
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

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Color Scheme</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Primary Color</Label>
                <div className="flex items-center gap-2 mt-0.5">
                  <input
                    type="color"
                    value={config.primaryColor}
                    onChange={e => setConfig({ primaryColor: e.target.value })}
                    className="size-8 cursor-pointer rounded border p-0.5"
                  />
                  <Input
                    className="text-xs font-mono"
                    value={config.primaryColor}
                    onChange={e => setConfig({ primaryColor: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">Secondary Color</Label>
                <div className="flex items-center gap-2 mt-0.5">
                  <input
                    type="color"
                    value={config.secondaryColor}
                    onChange={e => setConfig({ secondaryColor: e.target.value })}
                    className="size-8 cursor-pointer rounded border p-0.5"
                  />
                  <Input
                    className="text-xs font-mono"
                    value={config.secondaryColor}
                    onChange={e => setConfig({ secondaryColor: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">Background</Label>
                <div className="flex items-center gap-2 mt-0.5">
                  <input
                    type="color"
                    value={config.backgroundColor}
                    onChange={e => setConfig({ backgroundColor: e.target.value })}
                    className="size-8 cursor-pointer rounded border p-0.5"
                  />
                  <Input
                    className="text-xs font-mono"
                    value={config.backgroundColor}
                    onChange={e => setConfig({ backgroundColor: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">Text Color</Label>
                <div className="flex items-center gap-2 mt-0.5">
                  <input
                    type="color"
                    value={config.textColor}
                    onChange={e => setConfig({ textColor: e.target.value })}
                    className="size-8 cursor-pointer rounded border p-0.5"
                  />
                  <Input
                    className="text-xs font-mono"
                    value={config.textColor}
                    onChange={e => setConfig({ textColor: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">Each template has a default palette. Customize colors here to override.</p>
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
}
